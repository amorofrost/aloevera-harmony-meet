# Split admin Metrics into Metrics (technical) + Analytics (BI) — design

**Date:** 2026-05-29
**Status:** Approved (pending implementation plan)
**Area:** Admin dashboard / monitoring (see [MONITORING.md](../../MONITORING.md))
**Repos touched:** `lovecraft` (backend) + `aloevera-harmony-meet` (frontend admin)

---

## Problem

The admin `/admin/metrics` page mixes two unrelated concerns: **technical telemetry** (requests/hr, container status, request volume & latency) and **business/user metrics** (registered users, DAU, MAU, currently-online, user-activity-over-time, BI event counts). They serve different audiences and questions. Split them into two focused pages, and split the backing API so each page fetches only what it needs.

## Goals

- A focused **Metrics** page (`/admin/metrics`) with technical telemetry only.
- A new **Analytics** page (`/admin/analytics`) with the BI/user metrics.
- Split the overview API: one endpoint for technical KPIs, one for BI KPIs (each computing only its own data).

## Non-goals

- No new metrics or charts; this is a reorganization of existing sections.
- No new controller — the BI endpoints stay in `AdminMetricsController` under the `/admin/metrics` prefix (internal admin API; the page-level split is what matters).
- No change to `containers` / `timeseries` / `endpoint-stats` / `endpoint-timeseries` / `container-timeseries` / `config` endpoints.

---

## Design

### 1. Backend — split the overview endpoint

Today `GET /api/v1/admin/metrics/overview` returns `MetricsOverviewDto(Registered, Dau, Mau, CurrentlyActive, RequestsLastHour, P95LastHourMs)`, computed from the user cache (registered, currentlyActive), `MauCalculator` (dau, mau), and a `metricsminute` scan (requestsLastHour, p95). Split into two actions on `AdminMetricsController`:

- **`GET /admin/metrics/overview`** → `TechnicalOverviewDto(long RequestsLastHour, double? P95LastHourMs)`. Body computed solely from `GetLastHourRequestStatsAsync` (the `metricsminute` scan). No longer touches the user cache or `MauCalculator`.
- **`GET /admin/metrics/bi-overview`** *(new)* → `BiOverviewDto(int Registered, int Dau, int Mau, int CurrentlyActive)`. `Registered` = `_userCache.GetAll().Count`; `CurrentlyActive` = users with `LastSeen` within 5 min; `Dau`/`Mau` from `MauCalculator` (`GetDauAsync`/`GetMauAsync` for today). Both gated `[RequireStaffRole("admin")]` like all sibling endpoints; empty/zero in mock mode as today.

`MetricsOverviewDto` is removed (replaced by the two records). The existing `GET /admin/metrics/bi` (users-over-time arrays) and the BI-events data source used by `BiEventsPanel` are unchanged.

### 2. Frontend — adminApi

- Replace the `MetricsOverviewDto` type with `TechnicalOverviewDto { requestsLastHour: number; p95LastHourMs: number | null }` and `BiOverviewDto { registered: number; dau: number; mau: number; currentlyActive: number }`.
- `getOverview()` returns `ApiResponse<TechnicalOverviewDto>` (hits `/admin/metrics/overview`); mock returns `{ requestsLastHour, p95LastHourMs }`.
- New `getBiOverview()` returns `ApiResponse<BiOverviewDto>` (hits `/admin/metrics/bi-overview`); mock returns `{ registered, dau, mau, currentlyActive }`.

### 3. Frontend — components

- `MetricsOverviewTiles` → trimmed to the **technical** tiles: "Req / hr" and "p95 ms" (the p95 value already exists in the DTO; surfacing it makes the row useful). Takes `TechnicalOverviewDto | null`.
- **New `BiOverviewTiles`** (mirrors the `Tile` pattern) → "Registered", "DAU", "MAU", "Online now". Takes `BiOverviewDto | null`.
- `UsersTimeChart` and `BiEventsPanel` are unchanged internally; they move to the Analytics page.

### 4. Frontend — pages, routing, nav

- **`AdminMetricsPage`** keeps: technical overview tiles (`getOverview` → `MetricsOverviewTiles`), container status (+ container drill-down), request volume & latency (endpoint table + drill-down). It **drops** the `getBi` call, the `UsersTimeChart` card, and the `BiEventsPanel` card. Its range selector remains (now driving only endpoint-stats/timeseries + the container/endpoint drill-downs). Its overview fetch changes from `MetricsOverviewDto` to `TechnicalOverviewDto`.
- **New `AdminAnalyticsPage`** (`src/admin/pages/AdminAnalyticsPage.tsx`): BI overview tiles (`getBiOverview` → `BiOverviewTiles`); a "User activity over time" card with its own range selector (1h/24h/7d/30d → `getBi(range)` → `UsersTimeChart`); a "BI event counts" card (`BiEventsPanel`). Auto-refresh every 30s, paused on hidden tab, mirroring the Metrics page pattern.
- `AdminApp.tsx`: add `<Route path="/analytics" element={<AdminAnalyticsPage />} />` inside the `AdminLayout` route group.
- `AdminLayout.tsx`: add an "Analytics" `<Link to="/analytics">` next to the "Metrics" link.

### 5. Data flow

```
/admin/metrics   → getOverview()      → TechnicalOverviewDto  → Req/hr + p95 tiles
                 → getContainers()    → container status (+ drill-down)
                 → getEndpointStats() → request volume & latency (+ drill-down)

/admin/analytics → getBiOverview()    → Registered/DAU/MAU/Online tiles
                 → getBi(range)       → user-activity chart
                 → (BiEventsPanel's existing fetch) → BI event counts
```

---

## Testing

**Backend (`Lovecraft.UnitTests`):**
- Update the existing overview test (`AdminMetricsControllerTests.GetOverview_AggregatesFromMultipleSources`) to assert the **technical** shape only (`RequestsLastHour == 0` in mock mode; `P95LastHourMs` present/null) — and that it no longer carries BI fields (compile-enforced by the new DTO).
- New `bi-overview` test: returns `BiOverviewDto` with `Registered >= 0`, `Dau == 0`, `Mau == 0`, `CurrentlyActive >= 0` in mock mode; admin-gated (403 as non-admin, mirroring the existing config test).

**Frontend (`vitest`):**
- `AdminMetricsPage.test.tsx`: update the `getOverview` mock to the technical shape; assert the Req/hr (and p95) tile; remove BI-tile + user-activity assertions; add a `getBiOverview` mock only if the page references it (it shouldn't). Keep container + endpoint drill-down tests.
- New `AdminAnalyticsPage.test.tsx`: mock `getBiOverview` (4 BI values) + `getBi` + `BiEventsPanel`'s data; assert the BI tiles render, the user-activity chart renders, and the BI events panel renders.

---

## Files (anticipated)

**Backend (`lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs`):** replace `MetricsOverviewDto` with `TechnicalOverviewDto` + `BiOverviewDto`; split `GetOverview` into `GetOverview` (technical) + `GetBiOverview`. Tests in `AdminMetricsControllerTests.cs`.

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` — DTO types + `getOverview` (technical) + `getBiOverview`.
- `admin/components/metrics/MetricsOverviewTiles.tsx` — technical tiles.
- `admin/components/metrics/BiOverviewTiles.tsx` *(new)*.
- `admin/pages/AdminMetricsPage.tsx` — drop BI sections + retype overview.
- `admin/pages/AdminAnalyticsPage.tsx` *(new)*.
- `admin/AdminApp.tsx` — route. `admin/components/AdminLayout.tsx` — nav link.
- tests: `admin/pages/__tests__/AdminMetricsPage.test.tsx` (update), `admin/pages/__tests__/AdminAnalyticsPage.test.tsx` (new).

**Docs:** update both `MONITORING.md` files — note the `overview` (technical) + `bi-overview` (BI) endpoint split and the Metrics-vs-Analytics page split.

---

## Notes

- Both pages remain admin-gated via the existing `RequireAdmin` route guard + `[RequireStaffRole("admin")]` on the endpoints.
- No shared state between the pages; each fetches independently. The `UsersTimeChart`/`BiEventsPanel` components move without internal changes.
- `MetricsOverviewDto` removal is a breaking change to the `getOverview` contract — the only consumer is `AdminMetricsPage`, updated in the same change.
