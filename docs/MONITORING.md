# Monitoring & Instrumentation

**Status:** Shipped 2026-05-22. Live in production.
**Resolves:** TD.5 backend half (Serilog + dashboard). Frontend Sentry deferred.
**Design spec:** [`superpowers/specs/2026-05-21-monitoring-design.md`](./superpowers/specs/2026-05-21-monitoring-design.md)
**Implementation plan:** [`superpowers/plans/2026-05-21-monitoring.md`](./superpowers/plans/2026-05-21-monitoring.md)
**Backend operator notes:** [`../../lovecraft/Lovecraft/docs/MONITORING.md`](../../lovecraft/Lovecraft/docs/MONITORING.md)

---

## What this gives you

An admin-only dashboard at **`/admin/metrics`** showing:

- **5 KPI tiles:** Registered users, DAU, MAU, currently active, requests/hour with p95.
- **Container status grid:** `backend`, `telegram-bot`, `notifications-worker`, `frontend` — green/amber/red dot keyed by heartbeat freshness (`<60s` / `60–180s` / `>180s`).
- **Users-over-time chart:** registered total, DAU, MAU lines with selectable range (1h / 24h / 7d / 30d).
- **Request volume + latency:** top endpoints by count + p50/p95/p99 line chart.
- **BI events panel:** registrations by source, matches, messages, topics created.
- **Toggle sheet:** per-category collection on/off + retention controls.

Plus **structured JSON logs to stdout** in every .NET container, readable via `docker compose logs backend`.

---

## Daily operator tasks

### Reading the dashboard
- Sign in as an admin account (JWT `staffRole: admin`), navigate to `/admin/metrics`.
- Page auto-refreshes every 30s; paused while the browser tab is hidden.
- Range buttons (`1h` / `24h` / `7d` / `30d`) drive the time-series sections.

### Toggling categories at runtime
- Click **Settings** in the dashboard header → side drawer opens.
- Flip any category off (saves to `appconfig` Azure Table). The backend's `MetricsConfigPoller` re-reads every 60s, so changes propagate within a minute.
- Retention inputs (`retention_minute_hours` / `retention_hour_days` / `retention_dau_days`) drive the daily janitor sweep at 3am UTC.

### Searching logs for a request
Each request has a `traceId` correlated across the response header (`X-Request-Id`) and the JSON log entry:

```bash
# On the deployment VM
docker compose logs backend 2>&1 | grep '"traceId":"00-abc..."'
```

To find recent errors:
```bash
docker compose logs backend 2>&1 | grep '"@l":"Error"'
docker compose logs notifications-worker 2>&1 | grep '"@l":"Warning"'
```

---

## What gets collected

| Category | Source | Default | Dimension key shape |
|---|---|---|---|
| `request_timing` | Backend middleware (every HTTP request) | on | `backend\|{method}\|{route}\|{status}` |
| `bi_events` | 14 producer call sites (register/login/match/message/event-register/topic-create) | on | `bi\|user_registered\|local`, `bi\|match_created`, etc. |
| `container_stats` | `ContainerHeartbeatWorker` in each .NET process (30s tick) | on | `{container}\|working_set_mb` / `gc_heap_mb` / `thread_count`, `cpu_percent` |
| `frontend_perf` | Browser `apiClient` interceptor (batches every 30s) | on | `frontend\|{method}\|{route}\|{status}` |

Each toggle is independently switchable. When off, the corresponding `_metrics.Record*` calls short-circuit before doing any work — zero cost.

### What is NOT collected
- Per-user identifiable request traces (just route templates).
- Web Vitals / navigation timing on the frontend (apiClient calls only).
- Raw stack traces or request bodies — only counts + duration histograms.
- Anything when the corresponding category toggle is `false`.

---

## Where data lives

Four Azure Tables (counts as of shipping: 28 → 32 total):

| Table | Shape | Retention |
|---|---|---|
| `metricsminute` | `PK={yyyy-MM-ddTHH}_{category}`, `RK={mm}_{dimensionKey}`, columns: `Count`, `SumMs`, `MinMs`, `MaxMs`, 9 histogram buckets (`B0..B8`) | 24h (configurable) |
| `metricshour` | `PK={yyyy-MM-dd}_{category}`, `RK={HH}_{dimensionKey}`, same columns + `SourceMinuteRowCount` | 90d (configurable) |
| `dailyactiveusers` | `PK={yyyy-MM-dd}`, `RK=userId` — set semantics; MAU = union of last 30 partitions | 31d (DAU retention + 1) |
| `containerstatus` | `PK="STATUS"`, `RK={containerName}` — current latest snapshot only | constant (4 rows) |

**Histogram bucket boundaries (ms):** `[25, 50, 100, 250, 500, 1000, 2500, 5000, ∞]`. `B0..B8` are non-cumulative — `Sum(B0..B8) == Count`. Percentiles are interpolated within the containing bucket at read time.

### Critical Azure Table constraint (learned the hard way)

**Forbidden chars in PartitionKey/RowKey:** `/`, `\`, `#`, `?`, control chars.

Our dimension keys originally used `#` as a separator (per spec drafts) and embedded raw URL paths with `/` chars. Initial deploy silently dropped every write to `metricsminute` with `Azure.RequestFailedException: The 'PartitionKey' parameter ... is out of range`. Fixed in `dd4c13d` (backend):

- `#` separator → `_`
- `/` in URL paths → `~` (e.g. `~api~v1~users`)

If you ever extend the metrics surface, **never put user-controllable strings directly into PK/RK without sanitizing.** The unit tests using `MockMetricsCollector` (in-memory `ConcurrentDictionary`) accept any keys, so this class of bug hides until production.

---

## How the pipeline works

```
HTTP request → RequestMetricsMiddleware → IMetricsCollector.RecordTiming()
                                              ↓
                                      Bounded Channel (cap 1000, drop-oldest)
                                              ↓
                                      MetricsFlushWorker (every 10s)
                                              ↓
                                      metricsminute (Azure Table, MergeEntity)
                                              ↓
                              MetricsRollupWorker (in NotificationsWorker, hourly :05)
                                              ↓
                                      metricshour (Azure Table)
                                              ↓
                              AdminMetricsController → /admin/metrics page (recharts)
```

The frontend interceptor follows the same shape: each fetch is sampled, batched in memory (cap 200), flushed every 30s to `POST /api/v1/metrics/frontend`, which forwards to the same collector.

Daily 3am UTC: `JanitorWorker` deletes `metricsminute` partitions older than `retention_minute_hours`, `metricshour` older than `retention_hour_days`, `dailyactiveusers` older than `retention_dau_days + 1`.

---

## Key code locations

### Backend (`lovecraft/Lovecraft.Backend/`)
- `Services/Metrics/IMetricsCollector.cs` + `AzureMetricsCollector.cs` + `MockMetricsCollector.cs` — the collector contract.
- `Services/Metrics/MetricsFlushWorker.cs` — 10s drain to Azure.
- `Services/Metrics/MetricsConfigPoller.cs` — 60s refresh of category flags from appconfig.
- `Services/Metrics/ContainerHeartbeatWorker.cs` — 30s process snapshot.
- `Services/Metrics/FrontendProbeWorker.cs` — 60s probe of frontend `/health`.
- `Services/Metrics/DailyActiveUserCoalescer.cs` — write-coalesced DAU upserter (1 write per user-day per 60s).
- `Services/Metrics/MauCalculator.cs` — 30-partition union with `IMemoryCache` (5min TTL).
- `Middleware/RequestMetricsMiddleware.cs` — per-request timing capture.
- `Controllers/V1/MetricsController.cs` — `/metrics/config`, `/metrics/frontend`.
- `Controllers/V1/AdminMetricsController.cs` — `/admin/metrics/{overview,containers,timeseries,bi,config}`.
- `Storage/Entities/MetricMinuteEntity.cs`, `MetricHourEntity.cs`, `DailyActiveUserEntity.cs`, `ContainerStatusEntity.cs`.

### Workers
- `lovecraft/Lovecraft.NotificationsWorker/Workers/MetricsRollupWorker.cs` — hourly minute→hour.
- `lovecraft/Lovecraft.NotificationsWorker/Workers/JanitorWorker.cs` — daily retention sweep.
- Heartbeat workers duplicated in `Lovecraft.TelegramBot/Workers/` and `Lovecraft.NotificationsWorker/Workers/` (no shared lib — matches the existing entity-duplication precedent).

### Frontend (`aloevera-harmony-meet/src/`)
- `services/api/metricsCollector.ts` — singleton wrapper around `fetch`.
- `services/api/apiClient.ts` — interceptor wires the collector into `request<T>`.
- `services/api/adminApi.ts` — `metrics` namespace (dual-mode mock/api).
- `admin/pages/AdminMetricsPage.tsx` — dashboard shell with auto-refresh + range selector.
- `admin/components/metrics/*.tsx` — 6 panel components + the toggle sheet.

---

## API endpoints

| Method | Path | Auth | Use |
|---|---|---|---|
| `GET` | `/api/v1/metrics/config` | `[Authorize]` | Frontend interceptor reads `frontendPerf` flag every 5min |
| `POST` | `/api/v1/metrics/frontend` | `[Authorize]` + per-user 10/min rate limit | Batch ingest from browser |
| `GET` | `/api/v1/admin/metrics/overview` | `[RequireStaffRole("admin")]` | KPI tiles |
| `GET` | `/api/v1/admin/metrics/containers` | admin | Container status grid |
| `GET` | `/api/v1/admin/metrics/timeseries` | admin | Charts (`?category=&from=&to=&resolution=minute\|hour`) |
| `GET` | `/api/v1/admin/metrics/endpoint-timeseries` | admin | Per-endpoint count+latency (`?method=&route=&from=&to=&resolution=`) |
| `GET` | `/api/v1/admin/metrics/container-timeseries` | admin | Per-container gauge series avg/min/max (`?container=&from=&to=&resolution=`) |
| `GET` | `/api/v1/admin/metrics/bi` | admin | Users-over-time series (`?range=24h\|7d\|30d`) |
| `GET` | `/api/v1/admin/metrics/config` | admin | Read toggle config (full incl. retention) |
| `PUT` | `/api/v1/admin/metrics/config` | admin | Update + invalidate cache |

---

## `appconfig` partition rows

```
PK = "metrics", RK = "request_timing"          Value = "true" | "false"   (default true)
PK = "metrics", RK = "bi_events"               Value = "true" | "false"   (default true)
PK = "metrics", RK = "container_stats"         Value = "true" | "false"   (default true)
PK = "metrics", RK = "frontend_perf"           Value = "true" | "false"   (default true)
PK = "metrics", RK = "retention_minute_hours"  Value = int                (default 24)
PK = "metrics", RK = "retention_hour_days"     Value = int                (default 90)
PK = "metrics", RK = "retention_dau_days"      Value = int                (default 30)
```

Rows are seeded by `Lovecraft.Tools.Seeder` on initial deploy. Missing rows fall back to `MetricsConfig.Defaults` per field (so the system works even pre-seeding).

---

## Operational gotchas

1. **`#` and `/` are illegal in Azure Table PK/RK.** Documented above. Sanitize any new dimension components.
2. **The minute table holds ≤24h of data.** Range queries beyond 24h must use `resolution=hour`.
3. **`MetricsRollupWorker` runs at `:05` of each hour.** Hour data for the current hour appears at the next `:05`. The worker also re-rolls up to 6h back idempotently if a previous run was missed.
4. **`MockMetricsCollector` is registered when `USE_AZURE_STORAGE=false`.** Local dev shows the dashboard but with zero metric rows (in-memory state only, lost on restart).
5. **DAU writes are coalesced per (user, day) per 60s.** First request of the day always writes; subsequent requests within 60s are no-ops. Process restart loses the in-memory coalescer state — first request after restart re-writes once.
6. **MAU is computed read-time** (5-min `IMemoryCache`). At >10k DAU consider adding a precomputed `mau_rolling` table updated by the janitor.
7. **Frontend interceptor goes dormant when `frontend_perf` toggle is off.** It rechecks `/api/v1/metrics/config` every 5min, so toggling on requires up to 5min before browsers resume sending.

---

## Known follow-ups (not blocking)

- **Admin shell doesn't init the frontend collector.** `src/admin/main.tsx` doesn't call `frontendMetrics.init()` — admin-page API traffic is not in `frontend_perf` samples. Trivial fix when needed.
- **No source toggle on the request-volume panel.** Dashboard always shows `request_timing` (backend perspective). `frontend_perf` data is collected but not surfaced.
- **Per-endpoint drill-down (shipped 2026-05-27).** Resource IDs in request-timing/frontend-perf dimension keys are normalized to `{id}` via `MetricsRouteNormalizer` (backend), so the endpoint list is per-API not per-resource. The endpoint table has a search box + GET/POST/PUT/DELETE filter pills (client-side). Clicking a row replaces the right panel with that endpoint's call-count and p50/p95/p99 charts over time, fed by `GET /api/v1/admin/metrics/endpoint-timeseries?method=&route=&from=&to=&resolution=`. `endpoint-stats` now returns one row per `(method, route)` summed across status codes (no `statusCode` field; new `routeKey` identifier).
- **No `bi|event_registered|{eventId}` breakdown.** Intentionally bounded — eventId is user-controllable string, putting it in RowKey was a cardinality + injection risk. If per-event breakdown is needed, query `eventattendees` instead.
- **No alerting.** Pull-based dashboard only. Threshold-based push alerts (Slack / email) would be a separate spec.
- **No log shipping.** Serilog writes JSON to stdout; `docker compose logs` is the access path. Adding a sink (App Insights / Loki / Seq) is a one-line config change in each container's `Program.cs`.
- **Frontend error tracking (Sentry) — TD.5 frontend half deferred.** Use `X-Request-Id` response header to correlate frontend errors to backend logs once Sentry is wired.
- **Container drill-down + CPU (shipped 2026-05-28).** A normalized CPU% (0–100% of all cores, derived from Δprocessor-seconds) is collected by all three .NET containers; `telegram-bot` + `notifications-worker` POST heap/WS/threads/CPU samples to the backend's `POST /api/v1/internal/metrics/container-stats` (service-token) so all accumulate history (starting at deploy; `frontend` has none). Clicking a container row in the status table expands a 2×2 chart grid (avg line + min/max band) fed by `container-timeseries`. Gauge charts use Sum/Count/Min/Max, NOT the latency-tuned histogram percentiles.

---

## Test coverage

Backend (`Lovecraft.UnitTests`, ~30 metrics-specific tests):
- `MockMetricsCollectorTests` (5) — bucket merge semantics, enable/disable gating.
- `AzureMetricsCollectorTests` (4) — buffer cap, batch grouping, drain.
- `DailyActiveUserCoalescerTests` (4) — window logic, day rollover.
- `RequestMetricsMiddlewareTests` (6) — path skips, OPTIONS skip, never-throws guarantee.
- `ContainerHeartbeatWorkerTests` (1) — process snapshot fields populated.
- `MetricsRollupWorkerTests` (1) — aggregation correctness.
- `MetricsRetentionTests` (4) — partition-date parsing for cleanup helpers.
- `MauCalculatorTests` (1) — partition-union dedup.
- `MetricsControllerTests` (2) — config endpoint + frontend ingest.
- `AdminMetricsControllerTests` (11) — overview, containers, timeseries, bi, config, percentile interpolation, admin gating.

Frontend (`vitest`, 8 metrics-specific tests):
- `apiClient.metrics.test.ts` (4) — enable/disable, cap, drop-oldest, flush.
- `MetricsToggleSheet.test.tsx` (4) — render switches/inputs, save calls `putConfig`.
- `AdminMetricsPage.test.tsx` (4) — overview tiles, container rows, Settings button, visibility-pause.

Run all: `dotnet test Lovecraft/Lovecraft.UnitTests` and `npm run test:run`.

---

## When to revisit

- If `metricsminute` row count regularly exceeds ~100k/day, the channel buffer (1000) may drop samples. Increase capacity or add per-endpoint sampling.
- If `MetricsRollupWorker` runs longer than 60s, add per-category parallelism or extend the lookback window.
- If MAU computation slows down (10k+ DAU), add the precomputed `mau_rolling` table.
- If multiple operators want different views, fork the dashboard or add saved views.
- If the team needs alerting, ship a separate spec — don't bolt it onto this code path.
