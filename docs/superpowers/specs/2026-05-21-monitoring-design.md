# Monitoring & Instrumentation — design spec

**Date:** 2026-05-21
**Scope:** Operational visibility into the running stack — container status, request volume + latency (backend and frontend perspectives), and BI metrics (registered users, DAU, MAU, currently active). Toggleable on/off per category. Admin-only dashboard at `/admin/metrics`. Structured logging via Serilog → stdout in all .NET containers.
**Out of scope (explicit):** Real distributed tracing across services (no OpenTelemetry collector). Log shipping to a central store (Loki / App Insights / etc.) — Serilog writes to stdout only; ingestion is a follow-up. Frontend error tracking (Sentry) — frontend half of TD.5 stays separate. Alerting / paging on threshold breach. Per-endpoint sampling rates. Mobile-native instrumentation. Synthetic monitoring (uptime checks from outside the VM).
**Repos touched:** `lovecraft` (backend, telegram-bot, notifications-worker), `aloevera-harmony-meet` (frontend + admin shell).
**Resolves:** TD.5 (no structured logging or monitoring in production) — backend half. Frontend half (Sentry) deliberately deferred.
**Related:** [`2026-04-16-roles-and-acl-design.md`](./2026-04-16-roles-and-acl-design.md) (`[RequireStaffRole("admin")]` reuse, `appconfig` runtime toggle pattern); [`2026-05-17-notifications-design.md`](./2026-05-17-notifications-design.md) (`Lovecraft.NotificationsWorker` container we extend, existing `JanitorWorker`, `IPresenceTracker`).

---

## Goal

Today the operator has no way to answer basic questions:
- *Are all four containers up right now?* (Requires SSH to the VM.)
- *How long does a typical `POST /auth/login` take? Has it gotten slower?* (No data captured.)
- *How many people registered yesterday? How many are using the app right now?* (No data captured.)
- *Why did this specific request return 500 at 14:23 last Tuesday?* (`docker logs` has unstructured text only.)

This spec builds a built-in, admin-facing dashboard plus structured logs so all of those questions become one click or one `grep`. The metrics path is opinionated and Azure-Tables-native; the logs path uses Serilog so we can pipe to App Insights / Loki later without code change.

---

## Non-goals

- No new container for metrics. Workers fold into the existing `Lovecraft.NotificationsWorker`. Dashboard is a new page in the existing admin shell.
- No Prometheus, no Grafana, no cAdvisor, no Docker socket exposure. Building those into a small single-VM deployment is more operational surface than it's worth.
- No external observability SaaS (Datadog, New Relic, etc.). Anything we send to a third party is a separate decision.
- No log shipping in this PR. Stdout JSON only. The right sink (App Insights vs Loki) is a separate decision once we have logs flowing.
- No frontend Web Vitals or React Router navigation timing. API call latency only. (Both are easy to bolt on later — the collector channel is the only contract.)
- No per-endpoint sampling rates. Per-category toggle is the granularity. If volume becomes a problem we revisit.
- No alerting / paging. The dashboard is for pull-based investigation, not push-based incident response.

---

## Architecture summary

Producers in every .NET process (backend, telegram-bot, notifications-worker) feed an in-process `IMetricsCollector` singleton. The collector buffers samples in a bounded `Channel<MetricSample>` (cap 1000, drop-oldest if full) so the request path never blocks on a slow write. A `MetricsFlushWorker` BackgroundService drains every 10s and writes to `metricsminute` via Azure Tables `MergeEntity` (atomic counter increment).

The frontend ships samples in batches via a new `POST /api/v1/metrics/frontend` endpoint. Backend validates and writes to the same `metricsminute` table.

Hourly, a new `MetricsRollupWorker` in `Lovecraft.NotificationsWorker` aggregates the previous hour's minute rows into `metricshour` (90-day retention vs 24h for minute). The existing `JanitorWorker` gets three extra cleanup passes.

Dashboard reads from `metricsminute` for ≤24h ranges and `metricshour` beyond that. Auto-refreshes every 30s. Paused when the browser tab isn't visible.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Producers (samples)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Frontend    │  │ Backend API  │  │ TelegramBot +           │  │
│  │ apiClient   │  │ middleware + │  │ NotificationsWorker     │  │
│  │ interceptor │  │ BI producers │  │ (heartbeat only)        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬────────────┘  │
│         │ POST           │ direct                │ direct        │
│         ▼                ▼                       ▼               │
│              ┌────────────────────────┐                          │
│              │ IMetricsCollector      │   in-process channel     │
│              │ (Channel<Sample>)      │   cap 1000 drop-oldest   │
│              └────────────┬───────────┘                          │
│                           │ flush every 10s                      │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │ metricsminute table    │   bucketed counter       │
│              │ PK = "{yyyy-MM-ddTHH}# │   + histogram (B0..B8)   │
│              │       {category}"      │                          │
│              │ RK = "{mm}#{dimkey}"   │                          │
│              └────────────┬───────────┘                          │
│                           │ MetricsRollupWorker, hourly :05      │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │ metricshour table      │                          │
│              └────────────┬───────────┘                          │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │ /admin/metrics page    │
                │ (recharts; auto-       │
                │  refresh 30s)          │
                └────────────────────────┘
```

Tradeoffs documented:
- **In-memory buffer with drop-oldest** instead of a durable queue. Worst-case a flush window of samples is lost on crash. Acceptable for metrics; we're not billing on this data.
- **10s flush latency** instead of synchronous write. Adds up to 10s lag to the dashboard. Acceptable; the dashboard polls every 30s.
- **Per-category toggle** instead of per-endpoint sampling rates. Less flexible but matches existing `appconfig` patterns and is enough at this scale.

---

## Storage schema (4 new Azure Tables)

Total tables go from 28 → 32. All names respect existing `AZURE_TABLE_PREFIX`. Names match existing convention (lowercase, no underscores).

### `metricsminute` — bucketed counters + histograms (high-volume)

| Key | Value |
|---|---|
| PartitionKey | `{yyyy-MM-ddTHH}#{category}` (e.g. `2026-05-21T14#request_timing`) |
| RowKey | `{mm}#{dimensionKey}` (e.g. `23#backend\|POST\|/auth/login\|200`) |
| Columns | `Count` (long), `SumMs?` (long), `MinMs?` (long), `MaxMs?` (long), `B0..B8` (long, bucket counts), `LabelsJson` (string, denormalized parse of dimensionKey for query convenience) |

**Histogram bucket boundaries** (ms): `[25, 50, 100, 250, 500, 1000, 2500, 5000, ∞]`. Bucket `Bi` holds the count of samples falling into the range bounded above by the *i*-th boundary (i.e. non-cumulative): `B0` = count in `[0, 25]`, `B1` = count in `(25, 50]`, …, `B8` = count in `(5000, ∞)`. `Sum(B0..B8) == Count`. Mergeable on rollup; percentiles interpolated at read time via linear interpolation within the containing bucket.

**Retention:** 24 hours. Janitor deletes partitions where `parsedTimestamp < (now - retention_minute_hours)`.

### `metricshour` — same shape, hourly buckets (long-retention)

| Key | Value |
|---|---|
| PartitionKey | `{yyyy-MM-dd}#{category}` (e.g. `2026-05-21#request_timing`) |
| RowKey | `{HH}#{dimensionKey}` (e.g. `14#backend\|POST\|/auth/login\|200`) |
| Columns | Same as `metricsminute` plus `SourceMinuteRowCount` (long) — used by the rollup worker for idempotent re-aggregation |

**Retention:** 90 days. Janitor deletes partitions where `parsedDate < (now - retention_hour_days)`.

### `dailyactiveusers` — set per day, for DAU/MAU

| Key | Value |
|---|---|
| PartitionKey | `{yyyy-MM-dd}` |
| RowKey | `{userId}` |
| Columns | `FirstSeenUtc` (DateTime), `LastSeenUtc` (DateTime), `RequestCount` (long) |

Backend middleware does a write-coalesced upsert per `(userId, date)` — first authenticated request for that combo within a 60s window triggers one `MergeEntity` (increment `RequestCount`, set `LastSeenUtc`); subsequent requests within the window are no-op via in-process `ConcurrentDictionary<(userId, date), DateTime>`.

**Retention:** `retention_dau_days + 1` days (default 31 — covers a full 30-day MAU window plus today). Janitor deletes partitions where `parsedDate < (now - retention_dau_days - 1)`.

### `containerstatus` — current latest state per container

| Key | Value |
|---|---|
| PartitionKey | `"STATUS"` |
| RowKey | container name: `backend`, `telegram-bot`, `notifications-worker`, `frontend` |
| Columns | `LastHeartbeatUtc` (DateTime), `StartedAtUtc` (DateTime), `Version` (string), `GcHeapMb?` (long), `WorkingSetMb?` (long), `ThreadCount?` (int), `CpuSecondsTotal?` (double), `RequestsServed?` (long), `Note?` (string — used by frontend row to record `"HTTP {status}"` instead of process stats) |

Each .NET container's `ContainerHeartbeatWorker` upserts its own row every 30s. Frontend row is written by a backend probe that hits the local nginx `/health` endpoint and records the status code (more on this in §Instrumentation surface).

**Retention:** constant size (4 rows). No janitor work needed.

---

## Instrumentation surface

### `IMetricsCollector` interface (shared across .NET projects)

Lives in `Lovecraft.Backend/Services/Metrics/` (extracted to `Lovecraft.Common` only if telegram-bot / notifications-worker need it — likely yes; see §Code locations).

```csharp
public interface IMetricsCollector
{
    void RecordTiming(string category, string dimensionKey, double ms);
    void RecordCount(string category, string dimensionKey, long delta = 1);
    void RecordContainerStatus(ContainerStatusSnapshot snapshot);
    Task FlushAsync(CancellationToken ct);  // graceful shutdown
}
```

One implementation per process — `AzureMetricsCollector` (production) or `MockMetricsCollector` (dev when `USE_AZURE_STORAGE=false`). The per-category toggle is **not** an implementation swap; the collector holds an internal `MetricsEnabledFlags { RequestTiming, BiEvents, ContainerStats, FrontendPerf }` snapshot, refreshed every 60s by a `MetricsConfigPoller` hosted service reading from `IAppConfigService`. Each `Record*` call returns early if the relevant category flag is `false`.

- **`AzureMetricsCollector`** — bounded `Channel<MetricSample>` (cap 1000, drop-oldest, never blocks). `MetricsFlushWorker` background service drains every 10s, groups samples by `(PK, RK)`, issues one `MergeEntity` per group (`Count += d.Count`, `SumMs += d.SumMs`, `MinMs = Math.Min`, `MaxMs = Math.Max`, `B0..B8 += d.B0..B8`). Retries on transient `RequestFailedException` with exponential backoff (max 3 attempts).
- **`MockMetricsCollector`** — static `ConcurrentDictionary<(PK, RK), MetricBucket>` with the same merge semantics so the dashboard renders during local dev without Azure.
- **`NoOpMetricsCollector`** — registered when no category flag is ever expected to be true (e.g. a future "disable telemetry entirely" build flag). Not used in the default deploy.

A single `AzureMetricsCollector` instance handles all four categories. When `request_timing` is off but `bi_events` is on, only the `RecordTiming` paths for `request_timing` short-circuit; BI calls continue flowing.

### `RequestMetricsMiddleware` (backend, registered after `UseAuthentication` / `UseAuthorization`)

For each request:
- Skip `/health`, `/metrics/*`, `/swagger/*`, `OPTIONS`.
- Stopwatch-wrap; after the next middleware completes, call `RecordTiming("request_timing", "backend|{method}|{routeTemplate}|{statusCode}", ms)`.
- **Use `RouteTemplate` not raw path** — `/api/v1/users/{id}` stays one dimension even when a million users exist. Pulled from `Endpoint.Metadata.GetMetadata<RouteEndpoint>().RoutePattern.RawText`. Fallback to raw path if no route template matched (e.g. 404 path) but truncate query string and replace numeric/guid segments to bound cardinality.
- If `User.FindFirst(NameIdentifier).Value` exists (authenticated), feed `(userId, today UTC)` to the write-coalesced DAU upserter.

Never throws — wraps the collector call in try/catch and `LogWarning` on failure.

### BI event producers (`category = "bi_events"`)

One-line calls inserted at six sites. Each is wrapped in try/catch + `LogWarning`; BI metrics must never fail the operation.

| Trigger | Dimension key |
|---|---|
| `AuthController.Register` success | `bi\|user_registered\|{authMethod}` (local/google/telegram) |
| `AuthController.Login` success | `bi\|user_login\|{authMethod}` |
| `MatchingService` mutual match | `bi\|match_created` |
| `ChatsController.SendMessage` (REST) | `bi\|message_sent` |
| `EventsController.Register` (attendance) | `bi\|event_registered\|{eventId}` |
| `ForumService.CreateTopicAsync` | `bi\|topic_created\|{sectionId}` |

`authMethod` for register comes from the endpoint hit (`/auth/register` = local, `/auth/google-register` = google, `/auth/telegram-register` + `/auth/telegram-miniapp-register` = telegram). For login, `local` for `/auth/login`; the SSO `*-login` endpoints emit `google` or `telegram` only on the `signedIn` branch (not `pending`).

### `ContainerHeartbeatWorker` (all three .NET containers)

`BackgroundService`, 30s tick:
- Read `Process.GetCurrentProcess()` → `WorkingSet64`, `Threads.Count`, `TotalProcessorTime.TotalSeconds`.
- Read `GC.GetTotalMemory(forceFullCollection: false)` → heap.
- Build `ContainerStatusSnapshot { Name, LastHeartbeatUtc = now, StartedAtUtc (cached on first tick), Version, ... }`.
- Call `_metrics.RecordContainerStatus(snapshot)` → upserts the row in `containerstatus`.
- Also record three `container_stats` histogram entries (per-minute samples of `working_set_mb`, `gc_heap_mb`, `thread_count`) into `metricsminute` for trends. Dimension key: `{container}|{metric}` (e.g. `backend|working_set_mb`). No timing data — just `Count=1` and a synthetic single-bucket histogram so the average across minute samples is recoverable.

### Frontend container probe

The backend includes a tiny `FrontendProbeWorker` (`BackgroundService`, 60s tick) that does `GET http://frontend/health` (Docker internal hostname) and upserts a `containerstatus` row with `RowKey = "frontend"`, `Note = "HTTP {status}"`. No GC/working set data — nginx doesn't expose that without `stub_status`, and adding `stub_status` requires nginx config edits in the frontend repo. Bounded scope: green dot if status code is 200 within 5s, red otherwise.

### Frontend — `apiClient` interceptor

Wrap the existing `fetch` call in `src/services/api/apiClient.ts`:
- Capture `performance.now()` before send, again on response.
- Push `{ endpoint, method, status, durationMs, timestamp }` onto an in-memory array (cap 200, drop-oldest).
- Background `setInterval(30_000)` flushes the batch to `POST /api/v1/metrics/frontend`.

URL normalization mirrors backend route templates:
- Strip query string.
- Replace numeric path segments with `{id}` (regex `/\d+/`).
- Replace GUID-like segments with `{id}` (regex `/[0-9a-f]{8}-[0-9a-f]{4}-.../`).
- Leaves enum-style segments (`/google-login`, `/forum/sections/general/topics`) intact.

Only active when `frontend_perf` is enabled — frontend calls `GET /api/v1/metrics/config` on app load and every 5min; if `frontendPerf: false`, the interceptor goes dormant (cleared interval, drained array).

### TelegramBot + NotificationsWorker

Only `ContainerHeartbeatWorker`. No request timing — neither serves HTTP. Bot worker may add `bi_events` for `/start` later (`bi|bot_command|start`) but that's a follow-up.

---

## Toggle config & API surface

### `appconfig` partition (`metrics`)

New rows in the existing `appconfig` Azure Table (same pattern as `permissions` / `rank_thresholds`):

| PK | RK | Value | Default |
|---|---|---|---|
| `metrics` | `request_timing` | bool string | `true` |
| `metrics` | `bi_events` | bool string | `true` |
| `metrics` | `container_stats` | bool string | `true` |
| `metrics` | `frontend_perf` | bool string | `true` |
| `metrics` | `retention_minute_hours` | int string | `24` |
| `metrics` | `retention_hour_days` | int string | `90` |
| `metrics` | `retention_dau_days` | int string | `30` |

All four categories default **on**. Volume is low at current scale and the data is the whole point of building this. If `frontend_perf` ever becomes too chatty (e.g. a noisy mobile client flooding the channel), the admin can flip it off via the toggle sheet without a deploy.

`IAppConfigService` (existing) extended with a `MetricsConfig` record exposed via `IAppConfigService.GetMetricsConfigAsync()` (1h TTL like the existing permissions cache). `InvalidateAsync()` is called after the admin `PUT` so toggles take effect without waiting the full hour.

### New endpoints (all under `/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/metrics/config` | `[Authorize]` | Returns `{ requestTiming, biEvents, containerStats, frontendPerf }` — frontend interceptor uses this to decide whether to ship samples. Cached 5min client-side. |
| `POST` | `/metrics/frontend` | `[Authorize]` | Receives a batch of frontend samples `{ samples: [{ endpoint, method, status, durationMs, timestamp }] }`. Per-user rate limit: 10 req/min (separate bucket from `AuthRateLimit`). |
| `GET` | `/admin/metrics/overview` | `[RequireStaffRole("admin")]` | Top-of-dashboard summary: `{ registered, dau, mau, currentlyActive, requestsLastHour, p95LastHourMs }`. |
| `GET` | `/admin/metrics/containers` | `[RequireStaffRole("admin")]` | Reads `containerstatus` partition. Returns `[{ name, status: 'green'\|'amber'\|'red', heartbeatAgeSeconds, ... }]`. Thresholds: green `<60s`, amber `60–180s`, red `>180s`. |
| `GET` | `/admin/metrics/timeseries` | `[RequireStaffRole("admin")]` | Query params: `category` (required), `dimensionKey?` (optional filter), `from` (ISO), `to` (ISO), `resolution=minute\|hour`. Returns `[{ ts, count, p50?, p95?, p99? }]`. Picks `metricsminute` or `metricshour` table based on resolution. |
| `GET` | `/admin/metrics/bi` | `[RequireStaffRole("admin")]` | DAU/MAU/registered-by-day series. Reads `users` partition for total registered (cached 5min), `dailyactiveusers` for DAU per day, computes MAU per day from the same table (see §Aggregation worker → MAU). |
| `PUT` | `/admin/metrics/config` | `[RequireStaffRole("admin")]` | Update toggle values. Body: `Partial<MetricsConfig>`. Invalidates `IAppConfigService` cache. |

`GET /api/v1/admin/config` (existing) gets extended to include the `metrics` partition rows so the existing `AdminConfig` page surfaces them read-only.

### Rate-limit bucket on `POST /metrics/frontend`

**Per-user, not per-IP**. Multiple users behind a corporate NAT shouldn't share the bucket. Partition key for the limiter: `User.FindFirst(NameIdentifier).Value` (falls back to IP if claim is missing — shouldn't happen since `[Authorize]` is on the endpoint). Limit: 10 requests / 1 minute / user. Returns 429 + `Retry-After: 60` per existing rate-limiting convention.

---

## Aggregation worker

All in the existing `Lovecraft.NotificationsWorker` container — no new container.

### `MetricsRollupWorker` (new `BackgroundService`)

Runs every hour at `:05`. For each category in `[request_timing, bi_events, container_stats, frontend_perf]`:

```
hour    = (now - 1h).truncate('hour')
pk      = "{hour:yyyy-MM-ddTHH}#{category}"
rows    = query metricsminute, filter: "PartitionKey eq '{pk}'"
grouped = rows.GroupBy(r => r.DimensionKey)
for each group:
    Count   = sum(r.Count)
    SumMs   = sum(r.SumMs ?? 0)
    MinMs   = min(r.MinMs)
    MaxMs   = max(r.MaxMs)
    B0..B8  = sum each bucket
    upsert metricshour PK="{hour:yyyy-MM-dd}#{category}", RK="{HH}#{dimensionKey}",
           SourceMinuteRowCount = rows.Length
```

Idempotent — if the worker crashes mid-loop and re-runs, the upsert overwrites with the same values.

**Missed-hours lookback:** if the worker is offline at :05 (deploy, crash), it picks up at the next run. The previous hour's minute rows are still readable until the janitor sweeps them at 3am UTC. After the current-hour rollup completes, the worker iterates the previous 6 hours and re-aggregates any whose `metricshour` row has `SourceMinuteRowCount` not matching the actual minute row count for that hour. Bounded at 6h to keep cost predictable.

### Extending `JanitorWorker` (existing — runs at 3am UTC daily)

Add three deletion passes after the existing notification cleanup:

```
metricsminute:    delete partitions where parsedTimestamp < (now - retention_minute_hours)
metricshour:      delete partitions where parsedDate      < (now - retention_hour_days)
dailyactiveusers: delete partitions where parsedDate      < (now - retention_dau_days - 1)
```

Azure Tables has no batch-delete-by-partition-key — janitor enumerates rows in each target partition and issues `DeleteEntity` calls in batches of 100 (Table Storage batch limit). Reads `retention_*` values from `appconfig` so changing them via the admin UI takes effect on the next 3am run.

### MAU computation (read-time, no precomputation)

```csharp
public async Task<int> GetMauAsync(DateOnly today)
{
    var seen = new HashSet<string>();
    for (int d = 0; d < 30; d++) {
        var pk = today.AddDays(-d).ToString("yyyy-MM-dd");
        await foreach (var row in table.QueryAsync<DailyActiveUserEntity>(
                filter: $"PartitionKey eq '{pk}'", select: ["RowKey"])) {
            seen.Add(row.RowKey);
        }
    }
    return seen.Count;
}
```

30 partition scans, projecting only `RowKey`. At 10k DAU this is ~300k strings into a HashSet — well under 100ms. Cached 5 minutes via `IMemoryCache`. If it ever becomes slow we add a precomputed `mau_rolling` row updated nightly by the janitor.

### "Currently active" computation

Reuses the existing `IPresenceTracker` (introduced for notifications). Active = currently connected to SignalR `/hubs/chat` OR has a `users` row whose `LastSeen` is within the last 5 minutes. The SignalR set is in-process; combined count is computed in `AdminMetricsController.GetOverview` as the union (avoid double-counting users present in both).

### Mock mode

When `USE_AZURE_STORAGE=false`, `NotificationsWorker` doesn't run (existing behavior). The backend's collector uses `MockMetricsCollector` — a static `ConcurrentDictionary<(PK, RK), MetricBucket>` with the same merge semantics so the dashboard renders during local dev without Azure. Same pattern as `MockDataStore`.

---

## Admin dashboard UI

New route `/admin/metrics` in the admin shell (`src/admin/`). Single page, vertical scroll. Auto-refreshes every 30s; paused when `document.visibilityState !== 'visible'`. Uses `recharts` (currently installed but unused — UX.6 in `ISSUES.md` flagged it for removal; this is a real reason to keep it).

```
┌──────────────────────────────────────────────────────────────────────┐
│  Metrics                                            [⚙ Toggles]      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │Registered│ │   DAU    │ │   MAU    │ │ Online   │ │ Req/hr   │    │
│  │  1,247   │ │    89    │ │   412    │ │    7     │ │  1.2k    │    │
│  │  +12 ▲   │ │  +5 ▲    │ │  +28 ▲   │ │          │ │ p95 240ms│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│  Containers                                                           │
│  ┌─────────────────┬────────┬───────┬─────────┬─────────┬──────────┐ │
│  │ name            │ status │ uptime│ ws mb   │ heap mb │ threads  │ │
│  ├─────────────────┼────────┼───────┼─────────┼─────────┼──────────┤ │
│  │ backend         │ ● 12s  │ 4h12m │ 142     │ 38      │ 24       │ │
│  │ telegram-bot    │ ● 18s  │ 4h12m │ 38      │ 12      │ 12       │ │
│  │ notif-worker    │ ● 22s  │ 4h12m │ 62      │ 19      │ 18       │ │
│  │ frontend (web)  │ ● 200  │  —    │  —      │  —      │  —       │ │
│  └─────────────────┴────────┴───────┴─────────┴─────────┴──────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  Users over time                       [1h] [24h] [7d] [30d ✓]       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  ── registered total   ── DAU   ── MAU   ── currently active     ││
│  └──────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│  Request volume + latency           [1h] [24h ✓] [7d] [30d]          │
│  ┌─Top endpoints by count──────────────┬─Latency p50/p95/p99────────┐│
│  │ POST /auth/login           1,234    │  (line chart of selected   ││
│  │ GET  /api/v1/users           892    │   endpoint)                ││
│  │ GET  /api/v1/events          543    │                            ││
│  │ POST /api/v1/matching/likes  412    │                            ││
│  └─────────────────────────────────────┴─────────────────────────────┘│
│  Source toggle: [Backend ✓] [Frontend]                               │
├──────────────────────────────────────────────────────────────────────┤
│  BI events (last 24h)                                                │
│  Registrations:    142 local │ 89 google │ 23 telegram               │
│  Matches:          5                                                 │
│  Messages sent:    1,247                                             │
│  Event registers:  12  (FestivalX: 7, MeetupY: 3, ConcertZ: 2)       │
│  Topics created:   8                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Component structure

```
src/admin/pages/AdminMetricsPage.tsx       — top-level, owns time-range + source state
src/admin/components/metrics/
  ├─ MetricsOverviewTiles.tsx              — top KPI strip
  ├─ ContainerStatusTable.tsx              — green/amber/red dot grid
  ├─ UsersTimeChart.tsx                    — multi-line user counts
  ├─ RequestVolumeTable.tsx                — top endpoints list
  ├─ LatencyChart.tsx                      — p50/p95/p99 lines
  ├─ BiEventsPanel.tsx                     — registration/match counters
  └─ MetricsToggleSheet.tsx                — slide-out drawer for the 7 appconfig switches
```

### API wiring

`src/services/api/adminApi.ts` gets a new `metrics` namespace:

```typescript
adminApi.metrics = {
  getOverview(),                                            // → /admin/metrics/overview
  getContainers(),                                          // → /admin/metrics/containers
  getTimeseries(category, dimensionKey, range, resolution), // → /admin/metrics/timeseries
  getBi(range),                                             // → /admin/metrics/bi
  getConfig(),                                              // → /admin/metrics/config (read)
  putConfig(updates),                                       // → /admin/metrics/config (write)
}
```

Mock mode: returns plausible static data so the page renders during local dev without Azure.

### Toggle sheet

`MetricsToggleSheet` is a shadcn `<Sheet>` (side drawer). Renders 4 boolean switches + 3 retention number inputs. Save calls `PUT /admin/metrics/config` with optimistic update and a sonner toast on success/failure via `showApiError`.

### Auth + i18n

Page is gated by `[RequireStaffRole("admin")]` server-side and `getStaffRoleFromAccessToken() === 'admin'` client-side. All text via `t()` — translation keys added to `LanguageContext` under `admin.metrics.*` in both `ru` and `en`.

Moderators are not given read-only access in this first cut. If wanted, a follow-up can introduce a read-only mode by relaxing the server gate and conditionally hiding the toggle button client-side.

---

## Serilog → stdout

Replace the default `ILogger` configuration in all three .NET containers (`Lovecraft.Backend`, `Lovecraft.TelegramBot`, `Lovecraft.NotificationsWorker`) with structured JSON output captured by `docker logs`.

```csharp
// Program.cs in each container
builder.Host.UseSerilog((ctx, services, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "backend")   // or "telegram-bot" / "notifications-worker"
    .Enrich.WithProperty("version", AppRuntime.Version)
    .WriteTo.Console(new RenderedCompactJsonFormatter()));
```

Output (one event per line):

```json
{"@t":"2026-05-21T14:23:17.482Z","@l":"Warning","@m":"Failed to send Telegram notification","service":"backend","version":"1.2.3","traceId":"00-abc...","userId":"abc-123","notificationType":"matchCreated"}
```

### Request correlation

ASP.NET's built-in `Activity` provides a per-request `TraceId`. Middleware order:

```
UseSerilogRequestLogging()    ← logs each request with TraceId/method/path/status/ms
UseAuthentication()
UseAuthorization()
UseRouting()
RequestMetricsMiddleware      ← writes the metric sample
```

Every log line emitted within the request automatically inherits `TraceId` via `LogContext`. `UseSerilogRequestLogging()` also echoes `X-Request-Id` (= the TraceId) on the response header so the frontend (and any future Sentry integration) can correlate a 500 toast back to the exact log line.

### appsettings.json overrides (per container)

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.Hosting.Lifetime": "Information",
        "Azure.Core": "Warning"
      }
    }
  }
}
```

These cut ASP.NET pipeline noise by ~80%; only app-level logs and the `UseSerilogRequestLogging` summary survive at Information level.

### Out of scope here

- **No log shipping.** Stdout JSON only. Adding a sink later is `cfg.WriteTo.Seq(...)` / `cfg.WriteTo.ApplicationInsights(...)` — one line, no code change.
- **No log retention management.** `docker compose` defaults rotate at 10MB × 3 files per container. If that becomes a problem, adjust compose `logging.options.max-size` / `max-file`.
- **No log search UI in the dashboard.** Logs are read via `docker compose logs backend | grep traceId`. In-app log search is a separate spec.
- **No frontend logging / Sentry.** Frontend `showApiError` already toasts and `console.error`s; full client-side error tracking stays as the deferred half of TD.5.

---

## Testing strategy

### Backend unit tests (`Lovecraft.UnitTests`)

| New test class | Coverage |
|---|---|
| `AzureMetricsCollectorTests` | Buffer caps at 1000 (drop-oldest behavior); flush merges multiple samples into one `MergeEntity` per `(PK, RK)`; transient `RequestFailedException` retried up to 3×; `NoOpMetricsCollector` substituted when category disabled. |
| `RequestMetricsMiddlewareTests` | Records timing for normal requests; skips `/health`, `/metrics/*`, `/swagger/*`, `OPTIONS`; uses route template not raw path; bumps `dailyactiveusers` write-coalesced (one merge per `(user, date)` per 60s); never throws when collector throws. |
| `MetricsRollupWorkerTests` | Hourly rollup sums `Count`/`SumMs`/buckets correctly; idempotent on re-run; missed-hours lookback re-aggregates when `SourceMinuteRowCount` mismatch; bounded to 6h. |
| `MetricsRetentionTests` | Janitor deletes minute partitions older than `retention_minute_hours`; deletes hour partitions older than `retention_hour_days`; deletes DAU partitions older than `retention_dau_days`; respects appconfig overrides. |
| `MetricsControllerTests` | Toggle endpoint requires admin (uses `TestAuthHandler` from `AclTests`); timeseries endpoint validates `category`/`resolution`; rate limiter on `POST /metrics/frontend` is per-user not per-IP. |
| `ContainerHeartbeatWorkerTests` | Writes 30s heartbeat; populates `WorkingSetMb`/`GcHeapMb`/`ThreadCount`; survives single Azure write failure; `StartedAtUtc` set once. |
| `MauComputationTests` | DAU = single partition count; MAU dedups across 30 partitions; `IMemoryCache` invalidation after TTL. |
| `MockMetricsCollectorTests` | Static buffer round-trip; rollup-on-read produces correct percentiles via bucket interpolation. |

### Frontend tests (`vitest`)

| New test file | Coverage |
|---|---|
| `src/services/api/apiClient.metrics.test.ts` | Wraps existing `fetch` non-invasively; batches samples, flushes every 30s; dormant when `GET /metrics/config` returns `frontendPerf: false`; URL normalization matches backend route templates; respects 200-sample cap (drop-oldest). |
| `src/admin/pages/__tests__/AdminMetricsPage.test.tsx` | Renders overview tiles with mock data; container row dots color-mapped by freshness threshold (green/amber/red boundaries); auto-refresh paused when `document.visibilityState !== 'visible'`; time-range buttons drive correct `resolution=minute\|hour` API params; admin-only gate redirects non-admin. |
| `src/admin/components/metrics/__tests__/MetricsToggleSheet.test.tsx` | Save calls `PUT /metrics/config`; optimistic update; toast via `showApiError` on failure. |

### Manual integration smoke (mock mode)

Validation checklist for the implementation PR:

1. `docker compose up --build -d` boots all four containers.
2. Open `/admin/metrics` as `test@example.com` → all 4 containers appear green within 60s.
3. Hit a few backend endpoints via Swagger → request volume tile increments; "Top endpoints" populates within 30s.
4. Register a new user → "Registered" tile increments by 1; "Today registrations" BI row shows source.
5. Open `/friends` in a second incognito tab → "Currently active" goes to 2.
6. Frontend chart populates within 60s of opening the dashboard (frontend_perf is on by default). Toggle it off via the sheet → samples stop flowing within 60s; toggle back on → samples resume.
7. `docker compose logs backend` → JSON-formatted lines with `traceId`, `service: backend`.

### Out of scope

- **No load testing** of the metrics pipeline itself. At current scale the channel + 10s flush is far from saturation. If we ever see the channel hit its 1000-sample cap (logged as a warning), that's the signal to add a perf test.
- **No Azure integration tests** for `AzureMetricsCollector`. Pattern mirrors existing `AzureUserService` — covered via mock store, real-Azure path covered by manual smoke + existing seeder integration coverage.
- **No screenshot / visual-regression** on the dashboard. RTL structural assertions are enough until the page stabilizes.

---

## Code locations

### Backend (`Lovecraft.Backend/`)

- `Services/Metrics/IMetricsCollector.cs` — interface
- `Services/Metrics/AzureMetricsCollector.cs` — real implementation
- `Services/Metrics/MockMetricsCollector.cs` — in-memory implementation
- `Services/Metrics/NoOpMetricsCollector.cs` — disabled-category implementation
- `Services/Metrics/MetricsFlushWorker.cs` — 10s drain BackgroundService
- `Services/Metrics/MetricsConfigPoller.cs` — 60s appconfig poll
- `Services/Metrics/ContainerHeartbeatWorker.cs` — 30s container snapshot writer
- `Services/Metrics/FrontendProbeWorker.cs` — 60s frontend health probe
- `Services/Metrics/DailyActiveUserCoalescer.cs` — write-coalesced DAU upserter
- `Services/Metrics/MauCalculator.cs` — 30-partition union with IMemoryCache
- `Middleware/RequestMetricsMiddleware.cs` — request timing middleware
- `Controllers/V1/MetricsController.cs` — `/metrics/config`, `/metrics/frontend`
- `Controllers/V1/AdminMetricsController.cs` — `/admin/metrics/*`
- `Storage/Entities/MetricMinuteEntity.cs`, `MetricHourEntity.cs`, `DailyActiveUserEntity.cs`, `ContainerStatusEntity.cs`
- `Storage/TableNames.cs` — add four constants

### Worker (`Lovecraft.NotificationsWorker/`)

- `Workers/MetricsRollupWorker.cs` — hourly rollup
- Extend `Workers/JanitorWorker.cs` — three new cleanup passes
- Mirror metric entity classes (same pattern as existing duplicated `NotificationEntity`)

### TelegramBot (`Lovecraft.TelegramBot/`)

- Reuse `ContainerHeartbeatWorker` (move to `Lovecraft.Common` or `Lovecraft.Backend.Shared`; see open question below).

### Frontend (`aloevera-harmony-meet/`)

- `src/admin/pages/AdminMetricsPage.tsx`
- `src/admin/components/metrics/*`
- `src/admin/components/AdminSidebar.tsx` — add nav entry (or wherever existing admin nav lives)
- `src/services/api/adminApi.ts` — extend `metrics` namespace
- `src/services/api/apiClient.ts` — add fetch wrapper interceptor
- `src/contexts/LanguageContext.tsx` — `admin.metrics.*` keys (ru + en)

### Configuration

- `appsettings.json` in each .NET container — Serilog config block
- `appconfig` Azure Table — seed `metrics` partition rows via `Lovecraft.Tools.Seeder` (existing tool gets a new section)

---

## Open follow-ups / future work

- **`ContainerHeartbeatWorker` location.** Currently sketched in `Lovecraft.Backend/Services/Metrics/`, but it's needed by all three .NET projects. Either extract to a shared library (`Lovecraft.Common` or a new `Lovecraft.Telemetry` lib) or duplicate (matches existing pattern in `Lovecraft.NotificationsWorker`). Decision deferred to implementation; both work.
- **nginx stub_status** for richer frontend container metrics. Would give us connection counts, active requests. Not in scope here; frontend probe just records HTTP status.
- **Read-only moderator view.** First cut is admin-only. If wanted, relax the controller gate and hide the toggle button client-side.
- **MAU precomputation.** If 30-partition union becomes slow, add a `mau_rolling` row updated nightly by the janitor.
- **Sentry / Loki / App Insights** for log shipping. Stdout JSON is the foundation; sink is a separate decision.
- **Alerting.** Pull-based dashboard only. Push alerts (Slack / email on threshold breach) would be a separate spec.
- **Per-endpoint sampling rates.** Per-category toggle is enough at current scale. Revisit if volume becomes a problem.
- **Frontend Web Vitals + navigation timing.** Easy bolt-on — the collector channel is the only contract.

---

## Migration plan

No data migration. New tables are created on first write by `AzureMetricsCollector` / heartbeat worker (`CreateIfNotExistsAsync` per existing pattern). Existing deployments pick up the changes via `docker compose up --build -d`. `appconfig` seed runs idempotently — if rows already exist, they're left alone; new rows are added with defaults.

If a deploy fails partway (e.g. backend updated but worker not yet), the system degrades safely:
- Backend writes to `metricsminute` — works in isolation.
- Worker not yet updated — minute rows accumulate until janitor sweep, hour rows don't get populated; dashboard's >24h ranges show empty. Acceptable for the deploy window.
- Worker updated but backend not — collector code missing in backend, no rows written, dashboard shows zeroes. Acceptable.

No backward-incompatible changes to existing tables or endpoints.
