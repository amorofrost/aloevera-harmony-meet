# Metrics route normalization, endpoint filtering & per-endpoint drill-down — design

**Date:** 2026-05-27
**Status:** Approved (pending implementation plan)
**Area:** Monitoring & metrics (see [MONITORING.md](../../MONITORING.md))
**Repos touched:** `lovecraft` (backend) + `aloevera-harmony-meet` (frontend admin dashboard)

---

## Problem

The admin metrics dashboard (`/admin/metrics`) has three related shortcomings in its request-timing panel:

1. **Resource IDs leak into the metric identifier.** Endpoints like `/api/v1/users/55126c3e-21fd-457c-9953-dc66f83186b3` and `/api/v1/forum/topics/98f9d06f-…` are recorded as distinct metrics per resource. The operator wants per-**API** aggregates (calls + latency per route), not per-resource rows.

   Root cause: `RequestMetricsMiddleware` *intends* to record the ASP.NET route template (`api/v1/users/{id}`) but calls the wrong API — `context.GetEndpoint()?.Metadata.GetMetadata<RouteEndpoint>()` returns null for controller-action endpoints, so the middleware silently falls back to the raw request path (which contains the GUID). The frontend `frontend_perf` path has a working but separate heuristic (`MetricsController.NormalizeEndpoint`).

2. **No way to focus on specific endpoints.** The "Top endpoints by count" panel shows a fixed top-N list with no filtering.

3. **The latency chart is meaningless.** The "Latency percentiles" chart next to the endpoint list calls `timeseries` with no `dimensionKey`, so it merges histograms across *all* endpoints into one set of percentiles — an aggregate that doesn't correspond to anything actionable.

## Goals

- Normalize request-timing **and** frontend-perf dimension keys so resource IDs collapse to a placeholder (`{id}`), giving per-API aggregates.
- Add a client-side **filter** (search + method toggles) to the endpoint list.
- Replace the confusing aggregated latency chart with a **per-endpoint drill-down**: clicking an endpoint shows call-count and latency (p50/p95/p99) over time for that endpoint.

## Non-goals

- No historical data migration. Existing `metricsminute` / `metricshour` rows were already wiped by the operator, so new writes start clean. No read-time re-collapse of old GUID rows is needed.
- No per-status-code drill-down view (errors-vs-success breakdown). Status codes are retained in the stored dimension key for future use but are aggregated away in the table and drill-down.
- No persisted/pinned endpoint watchlist. Filtering is ephemeral client-side state.

---

## Design

### 1. Normalization (backend)

New shared helper `MetricsRouteNormalizer.Normalize(string path)` in `Lovecraft.Backend/Services/Metrics/`:

- **Constraint stripping:** route-template tokens keep only the name — `{id:int}` → `{id}`, `{slug:regex(...)}` → `{slug}`, `{*rest}` → `{rest}`.
- **Per-segment heuristic** (applied to non-templated paths, i.e. 404s / unmatched routes): a segment that parses as a GUID (`Guid.TryParse`) or a pure integer (`long.TryParse`) becomes `{id}`. All other segments — slugs, literals like `general`, `event-discussions`, `me` — are preserved verbatim.
- **Azure-safe output:** the only non-alphanumeric characters the normalizer emits are `{`, `}`, `-`, `.`, `~` (segment separator, applied by the caller). None are in the forbidden PK/RK set (`/`, `\`, `#`, `?`, control chars). Unit-tested explicitly.

`RequestMetricsMiddleware` changes:
- Resolve the template correctly: `context.GetEndpoint() as RouteEndpoint` → `.RoutePattern.RawText`. When non-null, normalize it (strips constraints). When null (unmatched), normalize the raw `path` (heuristic collapses IDs).
- Build the dimension key as today: `backend|{method}|{normalizedPath~with~tildes}|{status}`.

`MetricsController.PostFrontend` changes:
- Replace the inline `NormalizeEndpoint` with a call to `MetricsRouteNormalizer.Normalize`, so `frontend_perf` and `request_timing` produce identical route shapes. (The existing `NormalizeEndpoint` static method is removed or becomes a thin delegate.)

Status code stays in the dimension key — aggregation across statuses happens at read time (§2).

### 2. Read-time aggregation + drill-down endpoint (backend)

`AdminMetricsController` changes:

**`GET /admin/metrics/endpoint-stats`** — reshape rows to one per `(method, route)`, summing `Count` and merging histogram buckets across all status codes.
- Response DTO `EndpointStatDto` becomes: `RouteKey` (`"{method}|{route}"`, stable id for drill-down), `Method`, `Route`, `Count`, `P50`, `P95`, `P99`. The `StatusCode` field is removed.
- The `limit` parameter is removed (or raised) so the client receives the full endpoint list and filters locally. Result still sorted by `Count` desc.

**New `GET /admin/metrics/endpoint-timeseries`** — params `method`, `route`, `from`, `to`, `resolution=minute|hour`.
- `route` is passed in human-readable slash form (e.g. `api/v1/users/{id}`, matching `EndpointStatDto.Route` minus the leading `/`); the controller re-encodes `/`→`~` to match the stored dimension-key form before scanning.
- Scans metric rows whose dimension key matches `backend|{method}|{route~encoded}|*` (any status), buckets by minute or hour, returns `TimeseriesPointDto[]` (existing shape: `Ts`, `Count`, `P50`, `P95`, `P99`).
- One call feeds both per-endpoint charts (count series + percentile series).

The existing `GET /admin/metrics/timeseries` stays for backward compatibility but the dashboard stops using it for the latency panel.

### 3. Frontend dashboard (`aloevera-harmony-meet`)

`adminApi.metrics` gains `getEndpointTimeseries({ method, route, from, to, resolution })`. `EndpointStatDto` type updated (drop `statusCode`, add `routeKey`).

**`RequestVolumeTable`** — filter controls above the table:
- Text input, substring match against `method` + `route`, client-side over the full list.
- Four method toggle pills (GET/POST/PUT/DELETE), default all on; clicking narrows. Pure client-side filtering — no API re-hit.

**Right half of the "Request volume & latency" card** — in-place drill-down:
- Default (no selection): empty state — *"Select an endpoint to see its trend over time."* Replaces the current aggregated `LatencyChart`.
- On row click: row highlights; right panel shows two stacked charts for that endpoint — call count over time, and p50/p95/p99 over time — from one `getEndpointTimeseries` call keyed by the row's `routeKey`. Header shows `GET /api/v1/users/{id}` with an **✕** to clear.
- Selection is `AdminMetricsPage` component state (not persisted); resets when the time range changes. The drill-down fetch uses the same `from`/`to`/`resolution` as the rest of the dashboard and re-fetches on the existing 30 s auto-refresh while a selection is active.
- The existing `LatencyChart` component is reused for the latency chart; a small count chart renders the `Count` series.

### 4. Data flow

```
request → RequestMetricsMiddleware
            endpoint as RouteEndpoint → RoutePattern.RawText (or raw path on miss)
            → MetricsRouteNormalizer.Normalize  (constraints stripped / IDs collapsed)
            → dim = backend|{method}|{route}|{status}
            → IMetricsCollector.RecordTiming("request_timing", dim, ms)

frontend apiClient sample → POST /metrics/frontend
            → MetricsRouteNormalizer.Normalize (same helper)
            → dim = frontend|{method}|{route}|{status}

dashboard load → GET /admin/metrics/endpoint-stats   (rows per method+route, status-merged)
row click      → GET /admin/metrics/endpoint-timeseries?method&route&from&to&resolution
                 → two charts (count + percentiles) for that endpoint
```

---

## Testing

**Backend (`Lovecraft.UnitTests`):**
- New `MetricsRouteNormalizerTests`: GUID → `{id}`, integer → `{id}`, `{id:int}` → `{id}`, slugs/literals preserved (`general`, `event-discussions`, `me`), multi-ID paths (`/users/{id}/images`), output contains no Azure-forbidden PK/RK chars.
- `AdminMetricsControllerTests`: `endpoint-stats` merges status codes into one `(method, route)` row with summed count + merged histogram; `endpoint-timeseries` matches all statuses for a route and buckets by minute/hour; percentile interpolation unchanged.
- `RequestMetricsMiddlewareTests`: a templated route records `{id}`, not the raw value (regression guard for the original bug).

**Frontend (`vitest`):**
- `AdminMetricsPage.test.tsx` / `RequestVolumeTable.test.tsx`: search filters rows; method pills filter rows; clicking a row calls `getEndpointTimeseries` and renders both charts; ✕ clears back to the empty state.

---

## Files (anticipated)

**Backend (`lovecraft/Lovecraft.Backend/`):**
- `Services/Metrics/MetricsRouteNormalizer.cs` *(new)*
- `Middleware/RequestMetricsMiddleware.cs` *(fix template lookup + use normalizer)*
- `Controllers/V1/MetricsController.cs` *(delegate to normalizer)*
- `Controllers/V1/AdminMetricsController.cs` *(reshape endpoint-stats DTO + aggregation; add endpoint-timeseries)*

**Backend tests (`lovecraft/Lovecraft.UnitTests/`):**
- `MetricsRouteNormalizerTests.cs` *(new)*, `AdminMetricsControllerTests.cs`, `RequestMetricsMiddlewareTests.cs`

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` *(add `getEndpointTimeseries`, update `EndpointStatDto`)*
- `admin/components/metrics/RequestVolumeTable.tsx` *(filter + selectable rows)*
- `admin/pages/AdminMetricsPage.tsx` *(selection state, drill-down wiring, drop aggregated latency call)*
- `admin/components/metrics/LatencyChart.tsx` *(reused; minor props if needed)* + a small count-chart (new or reuse)

**Docs:** update `aloevera-harmony-meet/docs/MONITORING.md` and `lovecraft/Lovecraft/docs/MONITORING.md` to describe normalization + the drill-down/filter behavior; note the dimension-key shape change.
