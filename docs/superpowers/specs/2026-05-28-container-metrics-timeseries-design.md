# Container metrics over time + CPU utilization — design

**Date:** 2026-05-28
**Status:** Approved (pending implementation plan). Revised after discovering only the `backend` container records `container_stats` time series today; the two worker containers write only their latest-snapshot row.
**Area:** Monitoring & metrics (see [MONITORING.md](../../MONITORING.md))
**Repos touched:** `lovecraft` (backend + both worker projects) + `aloevera-harmony-meet` (frontend admin dashboard)

---

## Problem

The admin metrics dashboard's "Container status" card is a table of the **latest snapshot only** — current heap, working-set, and thread count per container. Operators can't see how those metrics moved over time, and there's no CPU metric at all.

Discovered during planning: the three .NET heartbeat workers are **not** structurally alike.
- **`Lovecraft.Backend`** `ContainerHeartbeatWorker` uses `IMetricsCollector` and records `RecordTiming("container_stats", "{container}|gc_heap_mb"|"working_set_mb"|"thread_count", value)` every 30s → `metricsminute`/`metricshour`. So `backend` **has** time-series history.
- **`Lovecraft.TelegramBot`** and **`Lovecraft.NotificationsWorker`** heartbeat workers write **only the latest `containerstatus` row** directly via `TableServiceClient` — no `IMetricsCollector`, no time series. So those containers have **no history** today.

All workers capture cumulative `CpuSecondsTotal` into the snapshot but never derive a utilization % nor record a CPU series.

## Goals

- Clicking a container row reveals that container's **heap, working-set, threads, and CPU%** over time as charts (avg line + min/max band).
- Add **CPU utilization %** (0–100%, normalized across all cores) to the collected set — surfaced as a current value in the table and as a time series.
- **All three .NET containers accumulate gauge time-series history going forward** — the two worker containers start recording via a new internal backend ingest endpoint (decision: full chart coverage, not backend-only).

## Non-goals

- No new storage tables. Reuse the existing `metricsminute`/`metricshour` `container_stats` category and the `containerstatus` snapshot table.
- No backfill. History (heap/WS/threads for the two workers, and CPU for all) **begins at deploy**; charts are empty for time before that.
- No change to the existing `timeseries` / `endpoint-timeseries` endpoints or the request-volume drill-down.
- The `frontend` container (nginx; its `containerstatus` row is written by the backend's `FrontendProbeWorker`) has no process metrics — "—" cells, empty charts.
- Workers do **not** get the full in-process `IMetricsCollector` machinery (channel/flush/Azure batching). They push samples over HTTP to the backend, which owns the single collector. This preserves worker-process isolation.

---

## Design

### 1a. CPU% + (for workers) gauge push — backend heartbeat worker

`Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker` already records the three gauges in-process. Add CPU:
- Worker holds per-instance state `_lastCpuSeconds` (double?) + `_lastSampleUtc` (DateTime?), initially null.
- Each tick: capture `cpuNow = Process.TotalProcessorTime.TotalSeconds` + `now`. After the first tick:
  ```
  elapsedSeconds = (now - _lastSampleUtc).TotalSeconds
  cpuPercent = (cpuNow - _lastCpuSeconds) / (elapsedSeconds * Environment.ProcessorCount) * 100
  cpuPercent = Math.Clamp(cpuPercent, 0, 100)
  ```
  Guard: `elapsedSeconds <= 0` → skip (null). First tick → null.
- `ContainerStatusSnapshot` + `ContainerStatusEntity` gain `double? CpuPercent`; the worker sets it on the snapshot before `RecordContainerStatusAsync`.
- When non-null: `_collector.RecordTiming("container_stats", "{container}|cpu_percent", cpuPercent.Value)`.

Because the CPU% delta needs cross-tick state, the computation lives in the worker loop (not the static `CaptureSnapshot`, which keeps returning `CpuSecondsTotal`). A small static helper `ComputeCpuPercent(cpuNow, cpuPrev, elapsedSeconds, processorCount)` (pure, returns `double?`) holds the math so it's unit-testable and reused by all three workers.

### 1b. Internal ingest endpoint (backend)

New action on the existing `InternalController` (`Route("api/v1/internal")`, `[RequireServiceToken]`):
- `POST /api/v1/internal/metrics/container-stats`, body `ContainerStatsIngestDto { string Container, long? GcHeapMb, long? WorkingSetMb, int? ThreadCount, double? CpuPercent }`.
- For each non-null field, call `_collector.RecordTiming("container_stats", "{Container}|{metric}", value)` (`gc_heap_mb`, `working_set_mb`, `thread_count`, `cpu_percent`). Returns 400 if `Container` blank; 204 otherwise.
- `InternalController` gains an injected `IMetricsCollector`.
- `Container` is sanitized into the dimension key the same way other dim keys are (it's a fixed known set — `telegram-bot`/`notifications-worker` — no `/ \ # ?`, so safe; still pass it straight into the `{container}|metric` shape consistent with the backend worker).

### 1c. Worker push — telegram-bot + notifications-worker heartbeat workers

Both worker heartbeat workers (each its own duplicated copy) change identically:
- Compute heap/WS/threads (as today) **plus** CPU% via the same delta logic + `ComputeCpuPercent` (duplicated per project, matching the existing worker-duplication precedent). Add `CpuPercent` to each worker project's `ContainerStatusEntity` copy and set it on the snapshot row write.
- After writing the snapshot row, **POST** a `ContainerStatsIngestDto` to `{BACKEND_INTERNAL_URL}/api/v1/internal/metrics/container-stats` with header `X-Service-Token: {INTERNAL_SERVICE_TOKEN}`. Best-effort: log on failure, never throw. CPU omitted (null) on the first tick.
- A small duplicated `ContainerMetricsReporter` (HttpClient + token) per worker project encapsulates the POST so it's unit-testable.
- **DI wiring:**
  - `Lovecraft.TelegramBot/Program.cs` already reads `serviceToken` + `backendUrl`; pass them (or a configured `HttpClient` + token) into `ContainerHeartbeatWorker`. When `serviceToken` is absent, the worker still writes the snapshot but skips the push (reporter null).
  - `Lovecraft.NotificationsWorker/Program.cs` does **not** read these yet — add `INTERNAL_SERVICE_TOKEN` + `BACKEND_INTERNAL_URL` (default `http://backend:8080`) reading and an `HttpClient`, then pass into its `ContainerHeartbeatWorker`. Same absent-token fallback.

### 2. Surface current CPU% in the table

- Backend `ContainerStatusDto` (in `AdminMetricsController`) gains `double? CpuPercent`, populated from the entity in `GetContainers`.
- Frontend `ContainerStatusDto` type gains `cpuPercent: number | null`.
- `ContainerStatusTable` renders a "CPU %" column ("—" when null).

### 3. Gauge timeseries endpoint (backend)

Histogram buckets are latency-tuned, so percentiles are meaningless for these gauges; but rows carry accurate `Count`, `SumMs`, `MinMs`, `MaxMs`.
- **New DTO** `GaugeTimeseriesPointDto(DateTime Ts, double? Avg, double? Min, double? Max)` — `Avg = Count > 0 ? (double)SumMs / Count : null`, `Min = MinMs`, `Max = MaxMs`.
- **New response DTO** `ContainerTimeseriesDto(List<GaugeTimeseriesPointDto> HeapMb, List<GaugeTimeseriesPointDto> WorkingSetMb, List<GaugeTimeseriesPointDto> ThreadCount, List<GaugeTimeseriesPointDto> CpuPercent)`.
- **New endpoint** `GET /api/v1/admin/metrics/container-timeseries?container=&from=&to=&resolution=minute|hour` (`[RequireStaffRole("admin")]`). 400 `MISSING_PARAM` if `container` blank; empty arrays in mock mode or for a container with no rows.
- A gauge-aggregation helper scans `container_stats` rows for each of the four dimension keys (`{container}|gc_heap_mb`, `|working_set_mb`, `|thread_count`, `|cpu_percent`), bucketed by minute/hour, computing avg/min/max from `SumMs`/`Count`/`MinMs`/`MaxMs`. **Separate** from the percentile-based `QueryMinuteTimeseriesAsync`/`QueryHourTimeseriesAsync` (untouched), since it reads the sum/min/max columns rather than histogram buckets. The partition-scan structure mirrors the existing methods.

### 4. Frontend UI (accordion drill-down)

- `adminApi.metrics` gains `getContainerTimeseries({ container, from, to, resolution })` → `ContainerTimeseriesDto` (dual-mode; mock returns small sample arrays). New frontend types `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto`.
- **New component** `GaugeBandChart` (`src/admin/components/metrics/GaugeBandChart.tsx`): recharts `ComposedChart` with a faint min–max `Area` band + an avg `Line`, props `{ points: GaugeTimeseriesPointDto[]; unit?: string }`. Empty state "No data." when `points` is empty.
- `ContainerStatusTable`:
  - New "CPU %" column.
  - Rows clickable + keyboard-activatable (`onClick`, `onKeyDown` Enter/Space, `tabIndex={0}`, `aria-expanded`) with a chevron affordance.
  - Single-expand accordion: clicking a row inserts a full-width `<tr>` directly beneath it with a 2×2 grid of `GaugeBandChart` (Heap MB, Working-set MB, Threads, CPU %). Clicking the same row collapses; another switches.
- Expanded-container selection + fetched series lifted to `AdminMetricsPage` (mirroring the endpoint drill-down) so the existing range selector + 30s auto-refresh refresh the open container, with the same stale-response guard (drop a response whose container no longer matches). `ContainerStatusTable` takes `expandedContainer`, `onToggle(name)`, `series`, `seriesLoading` props.
- Charts use the page's current range → resolution via the existing `resolutionFor` helper.

### 5. Data flow

```
backend container, every 30s:
  ContainerHeartbeatWorker (in-process IMetricsCollector)
    → snapshot (+ CpuPercent from Δcpu/(Δt·cores)) → RecordContainerStatusAsync
    → RecordTiming container_stats {backend}|gc_heap_mb|working_set_mb|thread_count|cpu_percent

telegram-bot / notifications-worker, every 30s:
  ContainerHeartbeatWorker (TableServiceClient + HttpClient)
    → snapshot row (+ CpuPercent) via UpsertEntity         (latest-snapshot, table)
    → POST /api/v1/internal/metrics/container-stats        (X-Service-Token)
        { container, gcHeapMb, workingSetMb, threadCount, cpuPercent }
        → backend InternalController → IMetricsCollector.RecordTiming(container_stats, …)

dashboard:
  containers table ← GET /admin/metrics/containers           (now incl. cpuPercent)
  row click → GET /admin/metrics/container-timeseries?container=&from=&to=&resolution
            → { heapMb, workingSetMb, threadCount, cpuPercent } : GaugeTimeseriesPointDto[]
            → 2×2 GaugeBandChart grid (avg line + min/max band)
```

---

## Testing

**Backend (`Lovecraft.UnitTests`):**
- `ComputeCpuPercent` math: first tick (null prev) → null; known `(cpuNow, cpuPrev, elapsed, cores)` → expected %; clamp at 0 and 100; `elapsed <= 0` → null.
- Gauge aggregation helper: rows with `SumMs/Count/MinMs/MaxMs` → expected `Avg/Min/Max` per bucket; `Count == 0` → null avg.
- `InternalControllerTests`: `container-stats` ingest records one `RecordTiming` per non-null field with the right dim keys; skips nulls; 400 on blank container; (existing `[RequireServiceToken]` 401/503 behavior already covered).
- `AdminMetricsControllerTests`: `container-timeseries` returns the four named series; empty in mock mode; 400 on missing `container`; unknown container → empty arrays.

**Frontend (`vitest`):**
- `GaugeBandChart.test.tsx`: empty-state "No data." for `points={[]}`.
- `AdminMetricsPage.test.tsx` (and/or new `ContainerStatusTable.test.tsx`): CPU % column renders; clicking a container row expands the accordion + calls `getContainerTimeseries` with that container; clicking again collapses.

---

## Files (anticipated)

**Backend (`lovecraft/`):**
- `Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs` — CPU delta + record; `ComputeCpuPercent` helper (or its own small file).
- `Lovecraft.Backend/Services/Metrics/ContainerStatusSnapshot.cs` — `+ double? CpuPercent`.
- `Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs` — `+ double? CpuPercent`.
- `Lovecraft.Backend/Controllers/V1/InternalController.cs` — `+ IMetricsCollector`, `+ POST metrics/container-stats`; `ContainerStatsIngestDto`.
- `Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs` — `+ CpuPercent` on `ContainerStatusDto`; `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto`; `GetContainerTimeseries` + gauge-aggregation helper.
- `Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs` + `Lovecraft.TelegramBot/Storage/ContainerStatusEntity.cs` + `ContainerMetricsReporter` + `Program.cs` wiring.
- `Lovecraft.NotificationsWorker/Workers/ContainerHeartbeatWorker.cs` + `Lovecraft.NotificationsWorker/Entities/ContainerStatusEntity.cs` + `ContainerMetricsReporter` + `Program.cs` wiring (incl. new token/url/HttpClient reading).
- `Lovecraft.UnitTests/` — CPU math, gauge aggregation, internal ingest, container-timeseries tests.

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` — `+ cpuPercent` on `ContainerStatusDto`; `GaugeTimeseriesPointDto` + `ContainerTimeseriesDto`; `getContainerTimeseries`.
- `admin/components/metrics/GaugeBandChart.tsx` *(new)*.
- `admin/components/metrics/ContainerStatusTable.tsx` — CPU column + accordion rows + chart grid.
- `admin/pages/AdminMetricsPage.tsx` — lift expanded-container state + series fetch + auto-refresh/stale guard.
- tests as above.

**Docs:** update `aloevera-harmony-meet/docs/MONITORING.md` + `lovecraft/Lovecraft/docs/MONITORING.md` (CPU metric + `cpu_percent` dim key; the worker→internal-endpoint ingest path; new `container-timeseries` endpoint; container drill-down; the latency-bucket-vs-gauge caveat).

---

## Notes / caveats

- **No history until deploy** (worker heap/WS/threads and all CPU).
- **`frontend`** container has no process metrics — empty charts, "—" cells.
- **Worker push is best-effort.** If the backend is unreachable or `INTERNAL_SERVICE_TOKEN` is unset, the worker still writes its snapshot row; only the time series is skipped. No ret/buffering — a dropped 30s sample is acceptable for a monitoring gauge.
- **Histogram buckets stay latency-tuned** and are unused for gauges; we read `SumMs/MinMs/MaxMs`. Documented so nobody "fixes" the percentiles for `container_stats`.
- **Worker entity duplication + duplicated `ComputeCpuPercent`/`ContainerMetricsReporter`** carry drift risk; the CPU field + push must be added to all copies in lockstep.
