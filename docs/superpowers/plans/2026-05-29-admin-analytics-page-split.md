# Split Admin Metrics into Metrics + Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the admin `/admin/metrics` page into a technical **Metrics** page and a new BI **Analytics** page (`/admin/analytics`), and split the backing `overview` API into a technical endpoint + a BI endpoint.

**Architecture:** Backend splits `GET /admin/metrics/overview` into `overview` (technical: req/hr + p95) and a new `bi-overview` (registered/DAU/MAU/online), each computing only its own data. Frontend: `adminApi` gets two DTOs + methods; `MetricsOverviewTiles` becomes technical-only and a new `BiOverviewTiles` is added; `AdminMetricsPage` drops its BI sections and a new `AdminAnalyticsPage` hosts them; one route + one nav link added.

**Tech Stack:** .NET 10 / ASP.NET Core, xUnit (backend); React 18 / TypeScript, recharts, Vitest + RTL (frontend).

**Spec:** [`docs/superpowers/specs/2026-05-29-admin-analytics-page-split-design.md`](../specs/2026-05-29-admin-analytics-page-split-design.md)

**Command working directories:** backend from `D:\src\lovecraft\Lovecraft` (`dotnet test Lovecraft.UnitTests`); frontend from `D:\src\aloevera-harmony-meet` (`npm run test:run`, `npx vitest run <file>`, `npx tsc -b`). Git: `git -C "D:\src\lovecraft"` / `git -C "D:\src\aloevera-harmony-meet"`. Do NOT push.

**Frontend type-check note:** root `tsconfig.json` is a solution file — use `npx tsc -b`. Known PRE-EXISTING unrelated `tsc -b` errors on main (`Chats.tsx`, `Likes.tsx`, `Profile.tsx`, `Search.tsx`, `matchingApi.ts`, `webPush.test.ts`, `dual-location-picker.test.tsx`) — ignore; only ensure files you touch are clean. Note: removing `MetricsOverviewDto` (Task 2) introduces *temporary* errors in `MetricsOverviewTiles.tsx` + `AdminMetricsPage.tsx` that are resolved by Tasks 3 & 4 — call those out as expected, not regressions.

---

## File Structure

**Backend (`lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs`):** replace `MetricsOverviewDto` with `TechnicalOverviewDto` + `BiOverviewDto`; split `GetOverview` into `GetOverview` (technical) + `GetBiOverview`. Tests in `AdminMetricsControllerTests.cs`.

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` — DTO types + `getOverview` (technical) + new `getBiOverview`.
- `admin/components/metrics/MetricTile.tsx` *(new — shared presentational tile)*.
- `admin/components/metrics/MetricsOverviewTiles.tsx` — technical tiles (Req/hr, p95).
- `admin/components/metrics/BiOverviewTiles.tsx` *(new)*.
- `admin/pages/AdminMetricsPage.tsx` — drop BI sections, relocate range selector, retype overview.
- `admin/pages/AdminAnalyticsPage.tsx` *(new)*.
- `admin/AdminApp.tsx` — `/analytics` route. `admin/components/AdminLayout.tsx` — "Analytics" nav link.
- tests: `admin/pages/__tests__/AdminMetricsPage.test.tsx` (update), `admin/pages/__tests__/AdminAnalyticsPage.test.tsx` (new), `admin/components/metrics/__tests__/BiOverviewTiles.test.tsx` (new).

**Docs:** `aloevera-harmony-meet/docs/MONITORING.md`, `lovecraft/Lovecraft/docs/MONITORING.md`.

---

## Task 1: Backend — split the overview endpoint

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\AdminMetricsController.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AdminMetricsControllerTests.cs`

- [ ] **Step 1: Update the existing overview test + add a bi-overview test**

In `AdminMetricsControllerTests.cs`, the existing test `GetOverview_AggregatesFromMultipleSources` currently reads `ApiResponse<MetricsOverviewDto>` and asserts BI + technical fields. Replace that test body with the technical-only shape, and add a new bi-overview test:

```csharp
    [Fact]
    public async Task GetOverview_ReturnsTechnicalKpis()
    {
        using var client = _factory.CreateClientAsUser("admin-ovr-tech", "admin");
        var resp = await client.GetAsync("/api/v1/admin/metrics/overview");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<TechnicalOverviewDto>>(JsonOpts);
        Assert.True(body!.Success);
        var dto = body.Data!;
        // Mock mode: no metricsminute table → zero requests, null p95
        Assert.Equal(0, dto.RequestsLastHour);
        Assert.Null(dto.P95LastHourMs);
    }

    [Fact]
    public async Task GetBiOverview_ReturnsBiKpis()
    {
        using var client = _factory.CreateClientAsUser("admin-ovr-bi", "admin");
        var resp = await client.GetAsync("/api/v1/admin/metrics/bi-overview");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<BiOverviewDto>>(JsonOpts);
        Assert.True(body!.Success);
        var dto = body.Data!;
        Assert.True(dto.Registered >= 0);
        Assert.Equal(0, dto.Dau);            // mock mode: no dailyactiveusers table
        Assert.Equal(0, dto.Mau);
        Assert.True(dto.CurrentlyActive >= 0);
    }

    [Fact]
    public async Task GetBiOverview_AsNonAdmin_Returns403()
    {
        using var client = _factory.CreateClientAsUser("regular-bi", "none");
        var resp = await client.GetAsync("/api/v1/admin/metrics/bi-overview");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }
```

If the OLD test method `GetOverview_AggregatesFromMultipleSources` still exists after adding these, DELETE it (its assertions reference removed `MetricsOverviewDto` BI fields and won't compile).

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.GetOverview_ReturnsTechnicalKpis|FullyQualifiedName~AdminMetricsControllerTests.GetBiOverview_ReturnsBiKpis"`
Expected: FAIL (compile — `TechnicalOverviewDto`/`BiOverviewDto` don't exist; `/bi-overview` route 404s).

- [ ] **Step 3: Replace the DTO + split the action**

In `AdminMetricsController.cs`, find the `MetricsOverviewDto` record (near the top with the other DTOs):

```csharp
public sealed record MetricsOverviewDto(
    int Registered,
    int Dau,
    int Mau,
    int CurrentlyActive,
    long RequestsLastHour,
    double? P95LastHourMs);
```

Replace it with the two records:

```csharp
public sealed record TechnicalOverviewDto(
    long RequestsLastHour,
    double? P95LastHourMs);

public sealed record BiOverviewDto(
    int Registered,
    int Dau,
    int Mau,
    int CurrentlyActive);
```

Then replace the entire `GetOverview` action (the `[HttpGet("overview")]` method) with these two actions:

```csharp
    // ─────────────────────────────────────────────────────────────────────────
    // GET /admin/metrics/overview — technical KPIs (requests/hr + p95)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<TechnicalOverviewDto>>> GetOverview(CancellationToken ct)
    {
        var (requestsLastHour, p95) = await GetLastHourRequestStatsAsync(ct);
        return Ok(ApiResponse<TechnicalOverviewDto>.SuccessResponse(
            new TechnicalOverviewDto(requestsLastHour, p95)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /admin/metrics/bi-overview — business KPIs (registered/DAU/MAU/online)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("bi-overview")]
    public async Task<ActionResult<ApiResponse<BiOverviewDto>>> GetBiOverview(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var registered = _userCache.GetAll().Count;

        var activeThreshold = DateTime.UtcNow.AddMinutes(-5);
        var currentlyActive = _userCache.GetAll().Count(u => u.LastSeen >= activeThreshold);

        var dauTask = _mau.GetDauAsync(today, ct);
        var mauTask = _mau.GetMauAsync(today, ct);
        await Task.WhenAll(dauTask, mauTask);

        return Ok(ApiResponse<BiOverviewDto>.SuccessResponse(
            new BiOverviewDto(registered, dauTask.Result, mauTask.Result, currentlyActive)));
    }
```

- [ ] **Step 4: Build + run, verify PASS**

Run: `dotnet build Lovecraft.Backend` then `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests"`
Expected: build clean (confirm no other code referenced `MetricsOverviewDto` — `grep -rn "MetricsOverviewDto" "D:\src\lovecraft\Lovecraft"` should return nothing after this change); the 3 new tests pass; all other AdminMetrics tests pass.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): split overview into technical + bi-overview endpoints"
```

---

## Task 2: Frontend adminApi — split types + methods

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\adminApi.ts`

- [ ] **Step 1: Replace the `MetricsOverviewDto` type with two types**

Find (around line 280):

```typescript
export interface MetricsOverviewDto {
  registered: number;
  dau: number;
  mau: number;
  currentlyActive: number;
  requestsLastHour: number;
  p95LastHourMs: number | null;
}
```

Replace with:

```typescript
export interface TechnicalOverviewDto {
  requestsLastHour: number;
  p95LastHourMs: number | null;
}

export interface BiOverviewDto {
  registered: number;
  dau: number;
  mau: number;
  currentlyActive: number;
}
```

- [ ] **Step 2: Update `getOverview` + add `getBiOverview`**

In the `metrics: {` namespace, replace the existing `getOverview` method with:

```typescript
    async getOverview(): Promise<ApiResponse<TechnicalOverviewDto>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: { requestsLastHour: 240, p95LastHourMs: 180 },
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<TechnicalOverviewDto>('/api/v1/admin/metrics/overview');
    },

    async getBiOverview(): Promise<ApiResponse<BiOverviewDto>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: { registered: 12, dau: 4, mau: 12, currentlyActive: 1 },
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<BiOverviewDto>('/api/v1/admin/metrics/bi-overview');
    },
```

- [ ] **Step 3: Type-check (expected cascade)**

Run (from `D:\src\aloevera-harmony-meet`): `npx tsc -b`
Expected: NEW errors ONLY in `MetricsOverviewTiles.tsx` (references removed `MetricsOverviewDto` + `.registered/.dau/...`) and `AdminMetricsPage.tsx` (imports `MetricsOverviewDto`). These are resolved in Tasks 3 & 4. No errors inside `adminApi.ts`. Plus the known pre-existing unrelated errors. Report the list to confirm it's only those two files (+ pre-existing).

- [ ] **Step 4: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/services/api/adminApi.ts
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): split overview DTO/method into technical + bi-overview"
```

---

## Task 3: Frontend — `MetricTile` + technical `MetricsOverviewTiles` + `BiOverviewTiles`

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\MetricTile.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\MetricsOverviewTiles.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\BiOverviewTiles.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\__tests__\BiOverviewTiles.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/BiOverviewTiles.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BiOverviewTiles } from '../BiOverviewTiles';

describe('BiOverviewTiles', () => {
  it('renders the four BI KPI values', () => {
    render(<BiOverviewTiles data={{ registered: 1247, dau: 89, mau: 412, currentlyActive: 7 }} loading={false} />);
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('1247')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText('Online now')).toBeInTheDocument();
  });

  it('shows em-dash when loading', () => {
    render(<BiOverviewTiles data={null} loading={true} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/components/metrics/__tests__/BiOverviewTiles.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Create the shared `MetricTile`**

Create `MetricTile.tsx`:

```tsx
import { Card } from '@/components/ui/card';

export function MetricTile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <Card className="p-4 flex flex-col items-center text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value === null ? '—' : value}</div>
    </Card>
  );
}
```

- [ ] **Step 4: Rewrite `MetricsOverviewTiles` (technical) using `MetricTile`**

Replace the entire contents of `MetricsOverviewTiles.tsx`:

```tsx
import type { TechnicalOverviewDto } from '@/services/api/adminApi';
import { MetricTile } from './MetricTile';

interface Props {
  data: TechnicalOverviewDto | null;
  loading: boolean;
}

export function MetricsOverviewTiles({ data, loading }: Props) {
  const v = (x: number | null | undefined) => (loading || x === undefined || x === null ? null : x);
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricTile label="Req / hr" value={v(data?.requestsLastHour)} />
      <MetricTile label="p95 ms" value={v(data?.p95LastHourMs)} />
    </div>
  );
}
```

- [ ] **Step 5: Create `BiOverviewTiles` using `MetricTile`**

Create `BiOverviewTiles.tsx`:

```tsx
import type { BiOverviewDto } from '@/services/api/adminApi';
import { MetricTile } from './MetricTile';

interface Props {
  data: BiOverviewDto | null;
  loading: boolean;
}

export function BiOverviewTiles({ data, loading }: Props) {
  const v = (x: number | null | undefined) => (loading || x === undefined || x === null ? null : x);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricTile label="Registered" value={v(data?.registered)} />
      <MetricTile label="DAU" value={v(data?.dau)} />
      <MetricTile label="MAU" value={v(data?.mau)} />
      <MetricTile label="Online now" value={v(data?.currentlyActive)} />
    </div>
  );
}
```

- [ ] **Step 6: Run, verify PASS + type-check**

Run: `npx vitest run src/admin/components/metrics/__tests__/BiOverviewTiles.test.tsx` (2 pass). Then `npx tsc -b` — `MetricsOverviewTiles.tsx`, `MetricTile.tsx`, `BiOverviewTiles.tsx` clean. `AdminMetricsPage.tsx` still errors (passes a `TechnicalOverviewDto` where it currently expects the old type / uses removed fields) — expected, fixed in Task 4. Confirm only `AdminMetricsPage.tsx` (+ pre-existing) errors remain.

- [ ] **Step 7: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/components/metrics/MetricTile.tsx src/admin/components/metrics/MetricsOverviewTiles.tsx src/admin/components/metrics/BiOverviewTiles.tsx src/admin/components/metrics/__tests__/BiOverviewTiles.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): technical overview tiles + new BiOverviewTiles (shared MetricTile)"
```

---

## Task 4: Frontend — trim `AdminMetricsPage` to technical telemetry

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\admin\pages\AdminMetricsPage.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\pages\__tests__\AdminMetricsPage.test.tsx`

- [ ] **Step 1: Update the page test (drop BI tiles, mock technical overview, relocate range expectations)**

In `AdminMetricsPage.test.tsx`:

(a) Change the `getOverview` mock to the technical shape:
```tsx
      getOverview: vi.fn().mockResolvedValue({
        success: true,
        data: { requestsLastHour: 1200, p95LastHourMs: 240 },
      }),
```
(b) Remove the `getBi` mock entry (the Metrics page no longer calls it).
(c) Replace the `renders overview tile values from API` test with one asserting the technical tile:
```tsx
  it('renders the technical overview tiles from API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1200')).toBeInTheDocument()); // Req / hr
    expect(screen.getByText('240')).toBeInTheDocument();                       // p95 ms
  });
```
(d) In the `shows a Settings button that can be clicked` test, change the wait from `screen.getByText('1247')` to `screen.getByText('1200')`.

(The container-row, visibility, endpoint drill-down, and ✕-clear tests stay as-is — they don't touch BI.)

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx`
Expected: FAIL — page still renders BI tiles / calls getBi / references `MetricsOverviewDto`; the new technical-tile assertions fail and/or the page errors.

- [ ] **Step 3: Edit `AdminMetricsPage.tsx`**

Make these edits:

(a) Imports — change the overview type and remove the BI-only imports:
- In the `from '@/services/api/adminApi'` import block: replace `type MetricsOverviewDto` with `type TechnicalOverviewDto`; remove `type BiTimeseriesDto`.
- Remove `import { UsersTimeChart } from '@/admin/components/metrics/UsersTimeChart';`
- Remove `import { BiEventsPanel } from '@/admin/components/metrics/BiEventsPanel';`

(b) State — change the overview state type and remove the `bi` state:
- `const [overview, setOverview] = useState<TechnicalOverviewDto | null>(null);`
- Delete `const [bi, setBi] = useState<BiTimeseriesDto | null>(null);`

(c) `fetchAll` — drop the BI fetch. Replace the ENTIRE `fetchAll` callback body with the following (drops the `biRange` line, the `getBi` call, and the `biData`/`setBi` usage; KEEPS the trailing endpoint/container drill-down refresh blocks and the `[fetchEndpointSeries, fetchContainerSeries]` dep array exactly as they were):
```tsx
  const fetchAll = useCallback(async (currentRange: Range) => {
    const from = new Date(Date.now() - rangeMs(currentRange)).toISOString();
    const to = new Date().toISOString();
    const resolution = resolutionFor(currentRange);

    const [ov, ct, epStats] = await Promise.all([
      adminApi.metrics.getOverview(),
      adminApi.metrics.getContainers(),
      adminApi.metrics.getEndpointStats({ from, to, resolution }),
    ]);

    if (ov.success && ov.data) setOverview(ov.data);
    if (ct.success && ct.data) setContainers(ct.data);
    if (epStats.success && epStats.data) setEndpointStats(epStats.data);

    setLoading(false);

    const sel = selectedRef.current;
    if (sel) void fetchEndpointSeries(sel, currentRange);

    const openContainer = expandedContainerRef.current;
    if (openContainer) void fetchContainerSeries(openContainer, currentRange);
  }, [fetchEndpointSeries, fetchContainerSeries]);
```

(d) Header — move the `RangeSelector` into the page header (it no longer lives in the removed user-activity card). Replace the header block:
```tsx
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Operational dashboard — refreshes every 30 s when visible.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RangeSelector value={range} onChange={setRange} />
          <Button variant="outline" onClick={() => setToggleOpen(true)}>Settings</Button>
        </div>
        <MetricsToggleSheet open={toggleOpen} onOpenChange={setToggleOpen} />
      </div>
```

(e) Delete the entire "3. Users time chart" `<Card>` block (the one titled "User activity over time" containing `<RangeSelector .../>` + `<UsersTimeChart data={bi} />`).

(f) Delete the entire "5. BI events" `<Card>` block (titled "BI event counts" containing `<BiEventsPanel />`).

After these edits the page renders: header (with range selector), technical overview tiles, container status (+ drill-down), request volume & latency (+ drill-down).

- [ ] **Step 4: Run, verify PASS + type-check**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx` (all pass). Then `npx tsc -b` — `AdminMetricsPage.tsx` clean now (ignore known pre-existing unrelated errors). `UsersTimeChart.tsx`/`BiEventsPanel.tsx` still compile (now unused by this page — they'll be used by Analytics in Task 5; an unused module is not a tsc error).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/pages/AdminMetricsPage.tsx src/admin/pages/__tests__/AdminMetricsPage.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): trim AdminMetricsPage to technical telemetry"
```

---

## Task 5: Frontend — new `AdminAnalyticsPage` + route + nav

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\admin\pages\AdminAnalyticsPage.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\admin\AdminApp.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\admin\components\AdminLayout.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\pages\__tests__\AdminAnalyticsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/AdminAnalyticsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAnalyticsPage from '../AdminAnalyticsPage';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 240 }}>{children}</div>
    ),
  };
});

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getBiOverview: vi.fn().mockResolvedValue({
        success: true,
        data: { registered: 1247, dau: 89, mau: 412, currentlyActive: 7 },
      }),
      getBi: vi.fn().mockResolvedValue({
        success: true,
        data: { days: ['2026-05-27', '2026-05-28'], registered: [11, 12], dau: [4, 4], mau: [11, 12] },
      }),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

describe('AdminAnalyticsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the BI overview tiles from API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('renders the user-activity and BI-events sections', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('User activity over time')).toBeInTheDocument();
    expect(screen.getByText('BI event counts')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/pages/__tests__/AdminAnalyticsPage.test.tsx`
Expected: FAIL (page missing).

- [ ] **Step 3: Create `AdminAnalyticsPage.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  type BiOverviewDto,
  type BiTimeseriesDto,
} from '@/services/api/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BiOverviewTiles } from '@/admin/components/metrics/BiOverviewTiles';
import { UsersTimeChart } from '@/admin/components/metrics/UsersTimeChart';
import { BiEventsPanel } from '@/admin/components/metrics/BiEventsPanel';

type BiRange = '24h' | '7d' | '30d';

function RangeSelector({ value, onChange }: { value: BiRange; onChange: (r: BiRange) => void }) {
  const ranges: BiRange[] = ['24h', '7d', '30d'];
  return (
    <div className="flex gap-1">
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            value === r
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<BiOverviewDto | null>(null);
  const [bi, setBi] = useState<BiTimeseriesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<BiRange>('7d');

  const rangeRef = useRef(range);
  rangeRef.current = range;

  const fetchAll = useCallback(async (currentRange: BiRange) => {
    const [ov, biData] = await Promise.all([
      adminApi.metrics.getBiOverview(),
      adminApi.metrics.getBi(currentRange),
    ]);
    if (ov.success && ov.data) setOverview(ov.data);
    if (biData.success && biData.data) setBi(biData.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchAll(range);
  }, [range, fetchAll]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchAll(rangeRef.current);
    };
    const id = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          User &amp; business metrics — refreshes every 30 s when visible.
        </p>
      </div>

      <BiOverviewTiles data={overview} loading={loading} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">User activity over time</CardTitle>
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent>
          <UsersTimeChart data={bi} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">BI event counts</CardTitle>
        </CardHeader>
        <CardContent>
          <BiEventsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
```

(Note: `BiEventsPanel` is rendered with no props — it currently shows zeros by design; this preserves the existing behavior, which was identical on the Metrics page.)

- [ ] **Step 4: Add the route**

In `AdminApp.tsx`: add the import `import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";` (next to the `AdminMetricsPage` import), and add a route inside the `AdminLayout` route group, right after the `/metrics` route:

```tsx
            <Route path="/metrics" element={<AdminMetricsPage />} />
            <Route path="/analytics" element={<AdminAnalyticsPage />} />
```

- [ ] **Step 5: Add the nav link**

In `AdminLayout.tsx`, add an "Analytics" link right after the "Metrics" link:

```tsx
            <Link to="/metrics" className="hover:text-foreground">
              Metrics
            </Link>
            <Link to="/analytics" className="hover:text-foreground">
              Analytics
            </Link>
```

- [ ] **Step 6: Run, verify PASS + type-check + full suite**

Run: `npx vitest run src/admin/pages/__tests__/AdminAnalyticsPage.test.tsx` (2 pass). Then `npx tsc -b` — `AdminAnalyticsPage.tsx`, `AdminApp.tsx`, `AdminLayout.tsx` clean (ignore known pre-existing). Then `npm run test:run` — full suite green.

- [ ] **Step 7: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/pages/AdminAnalyticsPage.tsx src/admin/AdminApp.tsx src/admin/components/AdminLayout.tsx src/admin/pages/__tests__/AdminAnalyticsPage.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(admin): add Analytics page (BI metrics) + route + nav link"
```

---

## Task 6: Documentation

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docs\MONITORING.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\MONITORING.md`

- [ ] **Step 1: Frontend MONITORING.md**

(a) In the "API endpoints" table, replace the `overview` row's description with "KPI tiles — **technical** (req/hr + p95)" and add a `bi-overview` row right after it:
```
| `GET` | `/api/v1/admin/metrics/bi-overview` | admin | BI KPI tiles (registered, DAU, MAU, online now) |
```
(b) Under "Known follow-ups (not blocking)", add a bullet:
```
- **Metrics / Analytics page split (shipped 2026-05-29).** The admin dashboard is split into **Metrics** (`/admin/metrics` — technical telemetry: req/hr + p95, container status, request volume & latency) and **Analytics** (`/admin/analytics` — registered/DAU/MAU/online tiles, user-activity-over-time, BI event counts). The `overview` endpoint was split into `overview` (technical) + `bi-overview` (BI) so each page fetches only what it needs.
```

- [ ] **Step 2: Backend MONITORING.md**

(a) In the "Endpoints" table, change the `/admin/metrics/overview` row description to "Technical KPI tiles (req/hr + p95)" and add after it:
```
| `GET` | `/admin/metrics/bi-overview` | admin | BI KPI tiles (registered, DAU, MAU, online now) |
```

- [ ] **Step 3: Commit both**

```bash
git -C "D:\src\aloevera-harmony-meet" add docs/MONITORING.md
git -C "D:\src\aloevera-harmony-meet" commit -m "docs(admin): document Metrics/Analytics split + bi-overview endpoint"
git -C "D:\src\lovecraft" add Lovecraft/docs/MONITORING.md
git -C "D:\src\lovecraft" commit -m "docs(metrics): document overview/bi-overview split"
```

---

## Final verification

- [ ] **Backend**: from `D:\src\lovecraft\Lovecraft`, `dotnet test Lovecraft.UnitTests` → all pass.
- [ ] **Frontend**: from `D:\src\aloevera-harmony-meet`, `npx tsc -b` (only known pre-existing unrelated errors) + `npm run test:run` (all pass).
- [ ] **Manual smoke (optional, API mode):** `/admin/metrics` shows Req/hr + p95 tiles, container status, request volume & latency (no BI sections), with a working range selector in the header. `/admin/analytics` (reachable via the new nav link) shows Registered/DAU/MAU/Online tiles, the user-activity chart with its range selector, and the BI event counts panel.
