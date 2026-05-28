# Container metrics over time + CPU utilization — design

**Date:** 2026-05-28
**Status:** Approved (pending implementation plan)
**Area:** Monitoring & metrics (see [MONITORING.md](../../MONITORING.md))
**Repos touched:** `lovecraft` (backend + both worker projects) + `aloevera-harmony-meet` (frontend admin dashboard)

---

## Problem

The admin metrics dashboard's "Container status" card is a table of the **latest snapshot only** — current heap, working-set, and thread count per container. Operators can't see how those metrics moved over time, even though the data is already collected: `ContainerHeartbeatWorker` records `RecordTiming("container_stats", "{container}|gc_heap_mb"|"working_set_mb"|"thread_count", value)` every 30s into `metricsminute`/`metricshour`.

Two gaps:
1. **No time-series view.** The history exists but nothing surfaces it; clicking a container shows nothing.
2. **No CPU metric.** The heartbeat captures cumulative `CpuSecondsTotal` into the snapshot row but never derives a utilization % nor records a CPU series. CPU is absent from both the table and (necessarily) any chart.

## Goals

- Clicking a container row reveals that container's **heap, working-set, threads, and CPU%** over time as charts (avg line + min/max band).
- Add **CPU utilization %** (0–100%, normalized across all cores) to the collected set — surfaced both as a current value in the table and as a time series for the chart.

## Non-goals

- No new storage tables. Reuse the existing `metricsminute`/`metricshour` `container_stats` category.
- No backfill. CPU has **no history until this deploys**; the series begins accumulating post-deploy.
- No change to the existing `timeseries` / `endpoint-timeseries` endpoints or the request-volume drill-down.
- The `frontend` container (nginx, no .NET process — its row is written by `FrontendProbeWorker`) has no process metrics; it shows "—" in the table and "No data" charts.

---

## Design

### 1. CPU collection (backend, all three .NET heartbeat workers)

`ContainerHeartbeatWorker` exists in three copies: `Lovecraft.Backend/Services/Metrics/`, `Lovecraft.TelegramBot/Workers/`, `Lovecraft.NotificationsWorker/Workers/` (deliberate duplication, matching the project's worker-isolation precedent). All three change identically:

- The worker holds per-instance state `_lastCpuSeconds` (double?) + `_lastSampleUtc` (DateTime?), initialized null.
- Each tick captures `cpuNow = Process.TotalProcessorTime.TotalSeconds` and `now`. After the first tick (when prior state exists):
  ```
  elapsedSeconds = (now - _lastSampleUtc).TotalSeconds
  cpuPercent = (cpuNow - _lastCpuSeconds) / (elapsedSeconds * Environment.ProcessorCount) * 100
  cpuPercent = Math.Clamp(cpuPercent, 0, 100)
  ```
  Guard: if `elapsedSeconds <= 0`, skip CPU this tick (leave null). First tick: `cpuPercent = null`.
- Update `_lastCpuSeconds`/`_lastSampleUtc` every tick.
- `ContainerStatusSnapshot` and `ContainerStatusEntity` (and the duplicated entity/snapshot copies in the worker projects) gain a nullable `double? CpuPercent`. The worker sets it on the snapshot before `RecordContainerStatusAsync`.
- When `cpuPercent` is non-null, also record the series: `RecordTiming("container_stats", "{container}|cpu_percent", cpuPercent.Value)`.

Note `CaptureSnapshot` is currently a static method producing a fresh snapshot with no cross-tick state. CPU% must be computed in the worker's `ExecuteAsync` loop (which holds the state) and assigned onto the snapshot after capture — `CaptureSnapshot` still captures `CpuSecondsTotal` as today; the worker computes the percent from consecutive values.

### 2. Surface current CPU% in the table (backend → frontend DTO)

- `ContainerStatusDto` (in `AdminMetricsController`) gains `double? CpuPercent`, populated from the entity.
- Frontend `ContainerStatusDto` type gains `cpuPercent: number | null`.
- `ContainerStatusTable` renders a new "CPU %" column ("—" when null).

### 3. Gauge timeseries endpoint (backend)

The stored histogram buckets are latency-tuned (`[25,50,…,5000]ms`), so percentiles are meaningless for these gauges. But `metricsminute`/`metricshour` rows carry accurate `Count`, `SumMs`, `MinMs`, `MaxMs`. Use those.

- **New DTO** `GaugeTimeseriesPointDto(DateTime Ts, double? Avg, double? Min, double? Max)` — `Avg = Count > 0 ? SumMs / Count : null`, `Min = MinMs`, `Max = MaxMs`.
- **New response DTO** `ContainerTimeseriesDto(List<GaugeTimeseriesPointDto> HeapMb, List<GaugeTimeseriesPointDto> WorkingSetMb, List<GaugeTimeseriesPointDto> ThreadCount, List<GaugeTimeseriesPointDto> CpuPercent)`.
- **New endpoint** `GET /api/v1/admin/metrics/container-timeseries?container=&from=&to=&resolution=minute|hour` (`[RequireStaffRole("admin")]`). Returns 400 `MISSING_PARAM` if `container` blank; empty arrays in mock mode (`_tables` null) or for a container with no rows.
- Implementation: a gauge-aggregation helper reads the `container_stats` rows matching each of the four dimension keys (`{container}|gc_heap_mb`, `|working_set_mb`, `|thread_count`, `|cpu_percent`), bucketed by minute/hour, computing avg/min/max per bucket. This is a **separate** helper from the percentile-based `QueryMinuteTimeseriesAsync`/`QueryHourTimeseriesAsync` (which stay untouched) — it reads `SumMs/MinMs/MaxMs` instead of histogram buckets. The minute/hour partition-scan structure mirrors the existing methods.

### 4. Frontend UI (accordion drill-down)

- `adminApi.metrics` gains `getContainerTimeseries({ container, from, to, resolution })` returning `ContainerTimeseriesDto` (dual-mode; mock returns empty arrays / small sample). New frontend types `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto`.
- **New component** `GaugeBandChart` (`src/admin/components/metrics/GaugeBandChart.tsx`): recharts `ComposedChart` with a faint min–max `Area` (two series or an `[min,max]` band) plus an avg `Line`. Props `{ points: GaugeTimeseriesPointDto[]; unit?: string }`. Empty state "No data." when `points` is empty (mirrors `RequestCountChart`).
- `ContainerStatusTable`:
  - New "CPU %" column.
  - Rows become clickable + keyboard-activatable (`onClick`, `onKeyDown` Enter/Space, `tabIndex={0}`, `aria-expanded`), with a chevron affordance.
  - Single-expand accordion: clicking a row inserts a full-width `<tr>` directly beneath it containing a 2×2 grid of `GaugeBandChart` (Heap MB, Working-set MB, Threads, CPU %). Clicking the same row collapses; clicking another switches.
- Selection + fetched series are lifted to `AdminMetricsPage` (mirroring the endpoint drill-down) so the existing range selector + 30s auto-refresh refresh the open container, with the same stale-response guard (drop a response whose container no longer matches the open one). `ContainerStatusTable` takes `expandedContainer`, `onToggle(name)`, `series`, `seriesLoading` props.
- Charts use the page's current range → resolution (`1h`/`24h` = minute, `7d`/`30d` = hour), same `resolutionFor` helper as the endpoint drill-down.

### 5. Data flow

```
each .NET container, every 30s:
  ContainerHeartbeatWorker tick
    → CaptureSnapshot (heap, ws, threads, cpuSecondsTotal)
    → compute cpuPercent from Δ(cpuSecondsTotal)/(Δt · cores)·100  (null on first tick)
    → snapshot.CpuPercent = cpuPercent
    → RecordContainerStatusAsync(snapshot)                  // latest-snapshot row (table)
    → RecordTiming("container_stats","{c}|gc_heap_mb",…)     // existing
       …|working_set_mb, …|thread_count
    → RecordTiming("container_stats","{c}|cpu_percent",…)    // new, when non-null

dashboard:
  containers table  ← GET /admin/metrics/containers   (now incl. cpuPercent)
  row click → GET /admin/metrics/container-timeseries?container=&from=&to=&resolution
            → { heapMb, workingSetMb, threadCount, cpuPercent } : GaugeTimeseriesPointDto[]
            → 2×2 GaugeBandChart grid (avg line + min/max band)
```

---

## Testing

**Backend (`Lovecraft.UnitTests`):**
- CPU percent math (extend `ContainerHeartbeatWorkerTests` or new `ContainerCpuPercentTests`): first tick → null; known `(ΔcpuSeconds, Δt, cores)` → expected %; clamp at 0 and 100; `elapsed <= 0` guard → null.
- Gauge aggregation helper: rows with `SumMs/Count/MinMs/MaxMs` → expected `Avg/Min/Max` per bucket; `Count == 0` → null avg.
- `AdminMetricsControllerTests`: `container-timeseries` returns the four named series; empty in mock mode; 400 on missing `container`; unknown container → empty arrays.

**Frontend (`vitest`):**
- `GaugeBandChart.test.tsx`: empty-state "No data." for `points={[]}`.
- `AdminMetricsPage.test.tsx` (and/or new `ContainerStatusTable.test.tsx`): CPU % column renders; clicking a container row expands the accordion and calls `getContainerTimeseries` with that container; clicking again collapses.

---

## Files (anticipated)

**Backend (`lovecraft/`):**
- `Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs` *(CPU delta + record)*
- `Lovecraft.Backend/Services/Metrics/ContainerStatusSnapshot.cs` *(+`CpuPercent`)*
- `Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs` *(+`CpuPercent`)*
- `Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs` *(+`CpuPercent` on `ContainerStatusDto`; `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto`; `GetContainerTimeseries` + gauge-aggregation helper)*
- `Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs` + its `ContainerStatusEntity`/snapshot copy *(CPU delta + record + field)*
- `Lovecraft.NotificationsWorker/Workers/ContainerHeartbeatWorker.cs` + its entity/snapshot copy *(same)*
- `Lovecraft.UnitTests/` — CPU math, gauge aggregation, controller tests

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` *(+`cpuPercent` on `ContainerStatusDto`; `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto` types; `getContainerTimeseries`)*
- `admin/components/metrics/GaugeBandChart.tsx` *(new)*
- `admin/components/metrics/ContainerStatusTable.tsx` *(CPU column + accordion rows + chart grid)*
- `admin/pages/AdminMetricsPage.tsx` *(lift expanded-container state + series fetch + auto-refresh/stale guard)*
- tests as above

**Docs:** update `aloevera-harmony-meet/docs/MONITORING.md` + `lovecraft/Lovecraft/docs/MONITORING.md` (CPU metric added to `container_stats`; new `container-timeseries` endpoint; container drill-down behavior; note the `cpu_percent` dimension key + the latency-bucket-vs-gauge caveat).

---

## Notes / caveats

- **No CPU history until deploy.** Charts show `cpuPercent` data only for time after this ships; before that the CPU chart is empty.
- **`frontend` container** has no process metrics — all four charts empty, table cells "—".
- **Histogram buckets stay latency-tuned** and are simply not used for gauges; we read `SumMs/MinMs/MaxMs`. Document this so a future reader doesn't try to "fix" the percentiles for container_stats.
- **Worker entity duplication** carries the usual drift risk; the CPU field must be added to all copies in lockstep.
