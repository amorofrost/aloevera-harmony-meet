# Metrics Route Normalization, Endpoint Filter & Drill-down — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse resource IDs in request-timing/frontend-perf metric keys to per-API placeholders (`{id}`), add a client-side endpoint filter, and replace the meaningless aggregated latency chart with a per-endpoint count+latency drill-down.

**Architecture:** Backend — a shared `MetricsRouteNormalizer` feeds both the request middleware (via the now-correctly-resolved ASP.NET route template) and the frontend-perf ingest endpoint; `AdminMetricsController` aggregates stored rows across status codes and gains a per-endpoint timeseries endpoint. Frontend — `RequestVolumeTable` gains search + method filters and clickable rows; `AdminMetricsPage` swaps the aggregated latency chart for an in-place drill-down (count + latency for the selected endpoint).

**Tech Stack:** .NET 10 / ASP.NET Core, Azure Table Storage, xUnit (backend); React 18 / TypeScript, recharts, Vitest + React Testing Library (frontend).

**Spec:** [`docs/superpowers/specs/2026-05-27-metrics-route-normalization-design.md`](../specs/2026-05-27-metrics-route-normalization-design.md)

**Command working directories:**
- Backend tests run from `D:\src\lovecraft\Lovecraft` — e.g. `dotnet test Lovecraft.UnitTests`.
- Frontend tests run from `D:\src\aloevera-harmony-meet` — e.g. `npm run test:run` or `npx vitest run <file>`.
- Git: backend repo is `D:\src\lovecraft`, frontend repo is `D:\src\aloevera-harmony-meet`. Commands below use `git -C "<repo>"`.

---

## File Structure

**Backend (`lovecraft/Lovecraft/`):**
- `Lovecraft.Backend/Services/Metrics/MetricsRouteNormalizer.cs` *(new)* — single normalization helper.
- `Lovecraft.Backend/Middleware/RequestMetricsMiddleware.cs` *(modify)* — fix route-template lookup, call normalizer.
- `Lovecraft.Backend/Controllers/V1/MetricsController.cs` *(modify)* — delegate frontend-perf normalization to the helper.
- `Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs` *(modify)* — reshape `EndpointStatDto`, aggregate across status, add `endpoint-timeseries`.
- `Lovecraft.UnitTests/MetricsRouteNormalizerTests.cs` *(new)*, `RequestMetricsMiddlewareTests.cs` *(modify)*, `AdminMetricsControllerTests.cs` *(modify)*.

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts` *(modify)* — `EndpointStatDto` type, mock data, `getEndpointTimeseries`.
- `admin/components/metrics/RequestVolumeTable.tsx` *(modify)* — filter + selectable rows, drop Status column.
- `admin/components/metrics/RequestCountChart.tsx` *(new)* — count-over-time chart.
- `admin/pages/AdminMetricsPage.tsx` *(modify)* — drill-down wiring.
- `admin/components/metrics/__tests__/RequestVolumeTable.test.tsx` *(new)*, `__tests__/RequestCountChart.test.tsx` *(new)*, `pages/__tests__/AdminMetricsPage.test.tsx` *(modify)*.

**Docs:** `aloevera-harmony-meet/docs/MONITORING.md`, `lovecraft/Lovecraft/docs/MONITORING.md`.

---

## Task 1: `MetricsRouteNormalizer` helper

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Metrics\MetricsRouteNormalizer.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\MetricsRouteNormalizerTests.cs`

- [ ] **Step 1: Write the failing test**

Create `MetricsRouteNormalizerTests.cs`:

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class MetricsRouteNormalizerTests
{
    [Theory]
    [InlineData("/api/v1/users/55126c3e-21fd-457c-9953-dc66f83186b3", "api~v1~users~{id}")]
    [InlineData("/api/v1/users/42", "api~v1~users~{id}")]
    [InlineData("api/v1/users/{id:guid}", "api~v1~users~{id}")]
    [InlineData("api/v1/forum/sections/{sectionId}/topics", "api~v1~forum~sections~{sectionId}~topics")]
    [InlineData("/api/v1/users/me", "api~v1~users~me")]
    [InlineData("/api/v1/forum/event-discussions/summary", "api~v1~forum~event-discussions~summary")]
    [InlineData("/api/v1/users/42/images", "api~v1~users~{id}~images")]
    [InlineData("/api/v1/events?code=ABC", "api~v1~events")]
    public void Normalize_ProducesExpectedShape(string input, string expected)
    {
        Assert.Equal(expected, MetricsRouteNormalizer.Normalize(input));
    }

    [Theory]
    [InlineData("/api/v1/users/55126c3e-21fd-457c-9953-dc66f83186b3")]
    [InlineData("api/v1/forum/topics/{topicId:guid}")]
    [InlineData("api/v1/files/{*path}")]
    public void Normalize_OutputHasNoAzureForbiddenChars(string input)
    {
        var result = MetricsRouteNormalizer.Normalize(input);
        Assert.DoesNotContain('/', result);
        Assert.DoesNotContain('\\', result);
        Assert.DoesNotContain('#', result);
        Assert.DoesNotContain('?', result);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~MetricsRouteNormalizerTests"`
Expected: FAIL — `MetricsRouteNormalizer` does not exist (compile error).

- [ ] **Step 3: Write the implementation**

Create `MetricsRouteNormalizer.cs`:

```csharp
namespace Lovecraft.Backend.Services.Metrics;

/// <summary>
/// Normalizes a request path or route template into a low-cardinality,
/// Azure-Table-safe dimension segment. Resource IDs collapse to {id};
/// route-template constraints are stripped; segments are joined with '~'
/// (Azure PK/RK forbids '/', '\', '#', '?').
/// </summary>
public static class MetricsRouteNormalizer
{
    public static string Normalize(string path)
    {
        if (string.IsNullOrEmpty(path)) return string.Empty;

        var q = path.IndexOf('?');
        if (q >= 0) path = path[..q];

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < segments.Length; i++)
            segments[i] = NormalizeSegment(segments[i]);

        return string.Join('~', segments);
    }

    private static string NormalizeSegment(string seg)
    {
        // Route-template token: {id}, {id:int}, {id=5}, {*catchAll}
        if (seg.Length >= 2 && seg[0] == '{' && seg[^1] == '}')
        {
            var inner = seg[1..^1].TrimStart('*');         // catch-all {*x}/{**x}
            var cut = inner.IndexOfAny(new[] { ':', '=' });
            if (cut >= 0) inner = inner[..cut];            // strip constraint/default
            return "{" + inner + "}";
        }

        // Heuristic for non-templated paths (404s, unmatched routes)
        if (Guid.TryParse(seg, out _)) return "{id}";
        if (long.TryParse(seg, out _)) return "{id}";
        return seg;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~MetricsRouteNormalizerTests"`
Expected: PASS (all theory cases).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsRouteNormalizer.cs Lovecraft/Lovecraft.UnitTests/MetricsRouteNormalizerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): add MetricsRouteNormalizer for ID collapsing"
```

---

## Task 2: Wire normalizer into `RequestMetricsMiddleware` (fix template lookup)

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Middleware\RequestMetricsMiddleware.cs:44-49`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\RequestMetricsMiddlewareTests.cs`

- [ ] **Step 1: Write the failing test**

Append this test to `RequestMetricsMiddlewareTests.cs` (add `using Microsoft.AspNetCore.Routing;` and `using Microsoft.AspNetCore.Routing.Patterns;` to the file's usings):

```csharp
    [Fact]
    public async Task MatchedRoute_RecordsTemplateNotRawId()
    {
        var collector = new MockMetricsCollector();
        var mw = new RequestMetricsMiddleware(c => { c.Response.StatusCode = 200; return Task.CompletedTask; },
                                              collector, new DailyActiveUserCoalescer());
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = "GET";
        ctx.Request.Path = "/api/v1/users/55126c3e-21fd-457c-9953-dc66f83186b3";

        // Simulate the matched endpoint carrying a route template with a GUID constraint.
        var endpoint = new RouteEndpoint(
            _ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/v1/users/{id:guid}"),
            order: 0,
            metadata: EndpointMetadataCollection.Empty,
            displayName: "Users.Get");
        ctx.SetEndpoint(endpoint);

        await mw.InvokeAsync(ctx);

        var row = Assert.Single(collector.Snapshot());
        Assert.Equal("backend|GET|api~v1~users~{id}|200", row.DimensionKey);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~RequestMetricsMiddlewareTests.MatchedRoute_RecordsTemplateNotRawId"`
Expected: FAIL — current code reads `Metadata.GetMetadata<RouteEndpoint>()` (null), falls back to the raw path → records `...users~55126c3e-...|200`, not `{id}`.

- [ ] **Step 3: Apply the fix**

In `RequestMetricsMiddleware.cs`, replace the body of the `finally` block's dimension-building lines (currently lines 45-49):

```csharp
                var routeEndpoint = context.GetEndpoint() as RouteEndpoint;
                var template = routeEndpoint?.RoutePattern.RawText;
                var pathForMetric = MetricsRouteNormalizer.Normalize(
                    !string.IsNullOrEmpty(template) ? template : path);
                var dim = $"backend|{context.Request.Method}|{pathForMetric}|{context.Response.StatusCode}";
                _collector.RecordTiming("request_timing", dim, sw.Elapsed.TotalMilliseconds);
```

(`using Microsoft.AspNetCore.Routing;` is already imported; `Lovecraft.Backend.Services.Metrics` is already imported.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~RequestMetricsMiddlewareTests"`
Expected: PASS — the new test passes; existing `NormalRequest_RecordsTiming` still passes (`/api/v1/auth/login` → `api~v1~auth~login`, no endpoint set so heuristic path).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Middleware/RequestMetricsMiddleware.cs Lovecraft/Lovecraft.UnitTests/RequestMetricsMiddlewareTests.cs
git -C "D:\src\lovecraft" commit -m "fix(metrics): record route template instead of raw path with IDs"
```

---

## Task 3: Delegate frontend-perf normalization to the shared helper

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\MetricsController.cs:44-69`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\MetricsControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Append to `MetricsControllerTests.cs`:

```csharp
    [Fact]
    public async Task PostFrontend_NormalizesResourceIdsInDimensionKey()
    {
        var collector = new MockMetricsCollector();
        var ctrl = new MetricsController(collector, new MockAppConfigService());
        var batch = new FrontendMetricsBatchDto(new[]
        {
            new FrontendMetricSampleDto(
                "/api/v1/users/55126c3e-21fd-457c-9953-dc66f83186b3", "GET", 200, 33),
        });

        await ctrl.PostFrontend(batch);

        var row = Assert.Single(collector.Snapshot());
        Assert.Equal("frontend|GET|api~v1~users~{id}|200", row.DimensionKey);
    }
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~MetricsControllerTests.PostFrontend_NormalizesResourceIdsInDimensionKey"`
Expected: PASS already (the existing `NormalizeEndpoint` collapses GUIDs). This test pins the behavior before we swap the implementation — if it fails, the existing normalizer differs and you must reconcile before continuing.

- [ ] **Step 3: Replace `NormalizeEndpoint` with the shared helper**

In `MetricsController.cs`, change the `PostFrontend` loop (around line 44-50) to call the shared normalizer:

```csharp
        foreach (var s in batch.Samples)
        {
            var endpoint = MetricsRouteNormalizer.Normalize(s.Endpoint);
            var dim = $"frontend|{s.Method}|{endpoint}|{s.Status}";
            _collector.RecordTiming("frontend_perf", dim, s.DurationMs);
        }
```

Delete the now-unused `public static string NormalizeEndpoint(string raw)` method (lines 57-69). Confirm nothing else references it:

Run: `grep -rn "NormalizeEndpoint" "D:\src\lovecraft\Lovecraft"`
Expected: no matches (only the deleted definition is gone).

(`using Lovecraft.Backend.Services.Metrics;` is already imported at the top of the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~MetricsControllerTests"`
Expected: PASS — both existing tests (`GetConfig_…`, `PostFrontend_RecordsEachSampleWithFrontendPrefix`) and the new one.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/MetricsController.cs Lovecraft/Lovecraft.UnitTests/MetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "refactor(metrics): use shared normalizer for frontend-perf ingest"
```

---

## Task 4: Aggregate `endpoint-stats` across status codes

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\AdminMetricsController.cs` (DTO `EndpointStatDto` lines 60-68; `GetEndpointStats` lines 319-386; helpers `AccumulateDim` 536-554 and `ParseEndpointStat` 556-573)
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AdminMetricsControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Append to `AdminMetricsControllerTests.cs`:

```csharp
    [Fact]
    public void AggregateEndpointStats_MergesAcrossStatusCodes()
    {
        var b200 = new long[HistogramBuckets.BucketCount]; b200[0] = 10;
        var b404 = new long[HistogramBuckets.BucketCount]; b404[1] = 5;
        var bLikes = new long[HistogramBuckets.BucketCount]; bLikes[0] = 7;

        var rows = new List<(string dimensionKey, long count, long[] buckets)>
        {
            ("backend|GET|api~v1~users~{id}|200", 10, b200),
            ("backend|GET|api~v1~users~{id}|404", 5,  b404),
            ("backend|POST|api~v1~matching~likes|200", 7, bLikes),
        };

        var result = AdminMetricsController.AggregateEndpointStats(rows);

        var users = Assert.Single(result, r => r.Route == "/api/v1/users/{id}");
        Assert.Equal("GET", users.Method);
        Assert.Equal(15, users.Count);                       // 10 + 5 merged across statuses
        Assert.Equal("GET|/api/v1/users/{id}", users.RouteKey);
        Assert.Equal("/api/v1/users/{id}", result[0].Route); // sorted by count desc
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.AggregateEndpointStats_MergesAcrossStatusCodes"`
Expected: FAIL — `AggregateEndpointStats` does not exist and `EndpointStatDto` has no `RouteKey`.

- [ ] **Step 3: Reshape the DTO**

In `AdminMetricsController.cs`, replace the `EndpointStatDto` record (lines 60-68) with:

```csharp
public sealed record EndpointStatDto(
    string RouteKey,            // "{method}|{route}" e.g. "GET|/api/v1/users/{id}"
    string Method,
    string Route,               // "/api/v1/users/{id}"
    long Count,
    double? P50,
    double? P95,
    double? P99);
```

- [ ] **Step 4: Add the aggregation helpers, remove `AccumulateDim`**

In `AdminMetricsController.cs`, delete the `AccumulateDim` method (lines 536-554) and replace `ParseEndpointStat` (lines 556-573) with the following two methods:

```csharp
    private static string StripStatus(string dimKey)
    {
        var lastPipe = dimKey.LastIndexOf('|');
        return lastPipe > 0 ? dimKey[..lastPipe] : dimKey;
    }

    /// <summary>
    /// Groups raw metric rows by (method, route) — dropping the status-code suffix —
    /// summing counts and merging histogram buckets. Sorted by count descending.
    /// </summary>
    public static List<EndpointStatDto> AggregateEndpointStats(
        IEnumerable<(string dimensionKey, long count, long[] buckets)> rows)
    {
        var byRoute = new Dictionary<string, (long count, long[] buckets)>();
        foreach (var (dimKey, count, buckets) in rows)
        {
            var routeDim = StripStatus(dimKey);
            if (!byRoute.TryGetValue(routeDim, out var acc))
                acc = (0, new long[HistogramBuckets.BucketCount]);
            acc.count += count;
            for (int i = 0; i < HistogramBuckets.BucketCount; i++)
                acc.buckets[i] += buckets[i];
            byRoute[routeDim] = acc;
        }

        return byRoute
            .Select(kv => ParseEndpointStat(kv.Key, kv.Value.count, kv.Value.buckets))
            .OrderByDescending(x => x.Count)
            .ToList();
    }

    private static EndpointStatDto ParseEndpointStat(string routeDim, long count, long[] buckets)
    {
        // routeDim format: "backend|METHOD|route~path"  (status already stripped)
        var parts = routeDim.Split('|');
        var method = parts.Length > 1 ? parts[1] : "?";
        var route  = parts.Length > 2 ? "/" + parts[2].Replace('~', '/') : routeDim;

        return new EndpointStatDto(
            RouteKey: $"{method}|{route}",
            Method:   method,
            Route:    route,
            Count:    count,
            P50: InterpolatePercentile(buckets, HistogramBuckets.Boundaries, 50),
            P95: InterpolatePercentile(buckets, HistogramBuckets.Boundaries, 95),
            P99: InterpolatePercentile(buckets, HistogramBuckets.Boundaries, 99));
    }
```

- [ ] **Step 5: Rewrite `GetEndpointStats` to collect rows then aggregate**

Replace the `GetEndpointStats` method (lines 319-386) with:

```csharp
    [HttpGet("endpoint-stats")]
    public async Task<ActionResult<ApiResponse<List<EndpointStatDto>>>> GetEndpointStats(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string resolution = "minute",
        CancellationToken ct = default)
    {
        if (_tables is null)
            return Ok(ApiResponse<List<EndpointStatDto>>.SuccessResponse(new List<EndpointStatDto>()));

        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var toUtc   = DateTime.SpecifyKind(to,   DateTimeKind.Utc);
        var useMinute = !string.Equals(resolution, "hour", StringComparison.OrdinalIgnoreCase);
        var table = _tables.GetTableClient(useMinute ? TableNames.MetricsMinute : TableNames.MetricsHour);
        await table.CreateIfNotExistsAsync(ct);

        var rows = new List<(string dimensionKey, long count, long[] buckets)>();

        if (useMinute)
        {
            var cursor = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, fromUtc.Hour, 0, 0, DateTimeKind.Utc);
            while (cursor <= toUtc)
            {
                var pk = $"{cursor:yyyy-MM-dd'T'HH}_request_timing";
                await foreach (var entity in table.QueryAsync<MetricMinuteEntity>(
                    filter: $"PartitionKey eq '{pk}'", cancellationToken: ct))
                {
                    var rk = entity.RowKey.Split('_', 2);
                    if (rk.Length < 2 || !int.TryParse(rk[0], out var min)) continue;
                    var ts = new DateTime(cursor.Year, cursor.Month, cursor.Day, cursor.Hour, min, 0, DateTimeKind.Utc);
                    if (ts < fromUtc || ts > toUtc) continue;
                    rows.Add((rk[1], entity.Count, BucketsOf(entity.B0, entity.B1, entity.B2, entity.B3,
                        entity.B4, entity.B5, entity.B6, entity.B7, entity.B8)));
                }
                cursor = cursor.AddHours(1);
            }
        }
        else
        {
            var cursor = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, 0, 0, 0, DateTimeKind.Utc);
            while (cursor <= toUtc)
            {
                var pk = $"{cursor:yyyy-MM-dd}_request_timing";
                await foreach (var entity in table.QueryAsync<MetricHourEntity>(
                    filter: $"PartitionKey eq '{pk}'", cancellationToken: ct))
                {
                    var rk = entity.RowKey.Split('_', 2);
                    if (rk.Length < 2 || !int.TryParse(rk[0], out var hr)) continue;
                    var ts = new DateTime(cursor.Year, cursor.Month, cursor.Day, hr, 0, 0, DateTimeKind.Utc);
                    if (ts < fromUtc || ts > toUtc) continue;
                    rows.Add((rk[1], entity.Count, BucketsOf(entity.B0, entity.B1, entity.B2, entity.B3,
                        entity.B4, entity.B5, entity.B6, entity.B7, entity.B8)));
                }
                cursor = cursor.AddDays(1);
            }
        }

        return Ok(ApiResponse<List<EndpointStatDto>>.SuccessResponse(AggregateEndpointStats(rows)));
    }

    private static long[] BucketsOf(long? b0, long? b1, long? b2, long? b3, long? b4,
                                    long? b5, long? b6, long? b7, long? b8) =>
        new[] { b0 ?? 0, b1 ?? 0, b2 ?? 0, b3 ?? 0, b4 ?? 0, b5 ?? 0, b6 ?? 0, b7 ?? 0, b8 ?? 0 };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests"`
Expected: PASS — new `AggregateEndpointStats_MergesAcrossStatusCodes` plus all existing AdminMetrics tests compile and pass.

- [ ] **Step 7: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): aggregate endpoint-stats per (method,route) across statuses"
```

---

## Task 5: Add `endpoint-timeseries` endpoint (per-endpoint drill-down)

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\AdminMetricsController.cs` (`GetTimeseries` caller lines 247-250; `QueryMinuteTimeseriesAsync` 476-534; `QueryHourTimeseriesAsync` 575-632; add new action + helper)
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AdminMetricsControllerTests.cs`

- [ ] **Step 1: Write the failing tests**

Append to `AdminMetricsControllerTests.cs`:

```csharp
    [Fact]
    public void BuildEndpointDimPrefix_MatchesAllStatusesForRoute()
    {
        var prefix = AdminMetricsController.BuildEndpointDimPrefix("GET", "/api/v1/users/{id}");
        Assert.Equal("backend|GET|api~v1~users~{id}|", prefix);
        Assert.StartsWith(prefix, "backend|GET|api~v1~users~{id}|200");
        Assert.StartsWith(prefix, "backend|GET|api~v1~users~{id}|404");
        Assert.False("backend|GET|api~v1~users|200".StartsWith(prefix, StringComparison.Ordinal));
    }

    [Fact]
    public async Task EndpointTimeseries_ReturnsEmptyInMockMode()
    {
        using var client = _factory.CreateClientAsUser("admin-metrics-ep1", "admin");
        var from = Uri.EscapeDataString(DateTime.UtcNow.AddHours(-2).ToString("o"));
        var to = Uri.EscapeDataString(DateTime.UtcNow.ToString("o"));
        var route = Uri.EscapeDataString("/api/v1/users/{id}");

        var resp = await client.GetAsync(
            $"/api/v1/admin/metrics/endpoint-timeseries?method=GET&route={route}&from={from}&to={to}&resolution=minute");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<List<TimeseriesPointDto>>>(JsonOpts);
        Assert.True(body!.Success);
        Assert.Empty(body.Data!);
    }

    [Fact]
    public async Task EndpointTimeseries_MissingRoute_Returns400()
    {
        using var client = _factory.CreateClientAsUser("admin-metrics-ep2", "admin");
        var from = Uri.EscapeDataString(DateTime.UtcNow.AddHours(-1).ToString("o"));
        var to = Uri.EscapeDataString(DateTime.UtcNow.ToString("o"));
        var resp = await client.GetAsync(
            $"/api/v1/admin/metrics/endpoint-timeseries?method=GET&from={from}&to={to}");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.EndpointTimeseries_ReturnsEmptyInMockMode|FullyQualifiedName~AdminMetricsControllerTests.BuildEndpointDimPrefix_MatchesAllStatusesForRoute|FullyQualifiedName~AdminMetricsControllerTests.EndpointTimeseries_MissingRoute_Returns400"`
Expected: FAIL — `BuildEndpointDimPrefix` and the `endpoint-timeseries` route don't exist (404 for the route, compile error for the helper).

- [ ] **Step 3: Add a prefix-match parameter to the query helpers**

In `AdminMetricsController.cs`, update both query helpers to accept an optional `dimensionKeyPrefix`. For `QueryMinuteTimeseriesAsync` change the signature and the match guard:

```csharp
    private async Task<List<TimeseriesPointDto>> QueryMinuteTimeseriesAsync(
        TableClient table,
        string category,
        string? dimensionKey,
        string? dimensionKeyPrefix,
        DateTime from,
        DateTime to,
        CancellationToken ct)
    {
```

Immediately after the existing `var dimKey = parts[1];` line inside that method, the existing exact-match guard stays and a prefix guard is added right below it:

```csharp
                if (dimensionKey is not null && !string.Equals(dimKey, dimensionKey, StringComparison.Ordinal))
                    continue;
                if (dimensionKeyPrefix is not null && !dimKey.StartsWith(dimensionKeyPrefix, StringComparison.Ordinal))
                    continue;
```

Apply the identical signature + guard change to `QueryHourTimeseriesAsync`.

Update the existing caller in `GetTimeseries` (lines 247-250) to pass `dimensionKeyPrefix: null`:

```csharp
        List<TimeseriesPointDto> points;
        if (useMinute)
            points = await QueryMinuteTimeseriesAsync(table, category, dimensionKey, null, fromUtc, toUtc, ct);
        else
            points = await QueryHourTimeseriesAsync(table, category, dimensionKey, null, fromUtc, toUtc, ct);
```

- [ ] **Step 4: Add the prefix helper and the new action**

Add the public helper next to `StripStatus`:

```csharp
    public static string BuildEndpointDimPrefix(string method, string route)
    {
        var encoded = route.TrimStart('/').Replace('/', '~');
        return $"backend|{method}|{encoded}|";
    }
```

Add the new action immediately after `GetEndpointStats`:

```csharp
    // ─────────────────────────────────────────────────────────────────────────
    // GET /admin/metrics/endpoint-timeseries
    // Query params: method, route, from (ISO), to (ISO), resolution=minute|hour
    // Returns count + percentile timeseries for one endpoint, summed across statuses.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("endpoint-timeseries")]
    public async Task<ActionResult<ApiResponse<List<TimeseriesPointDto>>>> GetEndpointTimeseries(
        [FromQuery] string method,
        [FromQuery] string route,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string resolution = "minute",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(method) || string.IsNullOrWhiteSpace(route))
            return BadRequest(ApiResponse<List<TimeseriesPointDto>>.ErrorResponse(
                "MISSING_PARAM", "method and route are required"));

        if (_tables is null)
            return Ok(ApiResponse<List<TimeseriesPointDto>>.SuccessResponse(new List<TimeseriesPointDto>()));

        var prefix = BuildEndpointDimPrefix(method, route);
        var useMinute = !string.Equals(resolution, "hour", StringComparison.OrdinalIgnoreCase);
        var table = _tables.GetTableClient(useMinute ? TableNames.MetricsMinute : TableNames.MetricsHour);
        await table.CreateIfNotExistsAsync(ct);

        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var toUtc   = DateTime.SpecifyKind(to,   DateTimeKind.Utc);

        var points = useMinute
            ? await QueryMinuteTimeseriesAsync(table, "request_timing", null, prefix, fromUtc, toUtc, ct)
            : await QueryHourTimeseriesAsync(table, "request_timing", null, prefix, fromUtc, toUtc, ct);

        return Ok(ApiResponse<List<TimeseriesPointDto>>.SuccessResponse(points));
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests"`
Expected: PASS — new endpoint tests plus all existing AdminMetrics tests (the `timeseries` exact-match tests still pass because the prefix arg is null).

- [ ] **Step 6: Run the full backend suite**

Run: `dotnet test Lovecraft.UnitTests`
Expected: PASS (no regressions across the suite).

- [ ] **Step 7: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): add endpoint-timeseries for per-endpoint drill-down"
```

---

## Task 6: Frontend `adminApi` — type, mock data, new method

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\adminApi.ts` (`EndpointStatDto` lines 326-335; `getEndpointStats` lines 1136-1167; add `getEndpointTimeseries`)

- [ ] **Step 1: Update the `EndpointStatDto` type**

Replace the interface (lines 326-335):

```typescript
export interface EndpointStatDto {
  routeKey: string;
  method: string;
  route: string;
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}
```

- [ ] **Step 2: Update `getEndpointStats` (mock data + drop `limit`)**

Replace the `getEndpointStats` method (lines 1136-1167) with:

```typescript
    async getEndpointStats(params: {
      from: string;
      to: string;
      resolution: 'minute' | 'hour';
    }): Promise<ApiResponse<EndpointStatDto[]>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: [
            { routeKey: 'GET|/api/v1/users',                           method: 'GET',  route: '/api/v1/users',                          count: 865, p50: 33, p95: 138, p99: 300 },
            { routeKey: 'POST|/api/v1/forum/topics/{topicId}/replies',  method: 'POST', route: '/api/v1/forum/topics/{topicId}/replies',  count: 312, p50: 89, p95: 280, p99: 490 },
            { routeKey: 'GET|/api/v1/events',                           method: 'GET',  route: '/api/v1/events',                          count: 289, p50: 41, p95: 160, p99: 280 },
            { routeKey: 'POST|/api/v1/chats/{id}/messages',            method: 'POST', route: '/api/v1/chats/{id}/messages',            count: 241, p50: 62, p95: 195, p99: 380 },
            { routeKey: 'GET|/api/v1/matching/likes/received',         method: 'GET',  route: '/api/v1/matching/likes/received',        count: 198, p50: 28, p95: 110, p99: 210 },
            { routeKey: 'POST|/api/v1/matching/likes',                 method: 'POST', route: '/api/v1/matching/likes',                 count: 174, p50: 55, p95: 220, p99: 410 },
            { routeKey: 'GET|/api/v1/forum/topics/{topicId}/replies',  method: 'GET',  route: '/api/v1/forum/topics/{topicId}/replies', count: 143, p50: 48, p95: 175, p99: 320 },
            { routeKey: 'GET|/api/v1/users/me',                        method: 'GET',  route: '/api/v1/users/me',                       count: 138, p50: 22, p95: 89,  p99: 160 },
            { routeKey: 'POST|/api/v1/auth/refresh',                   method: 'POST', route: '/api/v1/auth/refresh',                   count: 112, p50: 18, p95: 72,  p99: 130 },
          ] as EndpointStatDto[],
          timestamp: new Date().toISOString(),
        };
      }
      const q = new URLSearchParams({
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });
      return apiClient.get<EndpointStatDto[]>(`/api/v1/admin/metrics/endpoint-stats?${q}`);
    },

    async getEndpointTimeseries(params: {
      method: string;
      route: string;
      from: string;
      to: string;
      resolution: 'minute' | 'hour';
    }): Promise<ApiResponse<TimeseriesPointDto[]>> {
      if (!isApiMode()) {
        return { success: true, data: [] as TimeseriesPointDto[], timestamp: new Date().toISOString() };
      }
      const q = new URLSearchParams({
        method: params.method,
        route: params.route,
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });
      return apiClient.get<TimeseriesPointDto[]>(`/api/v1/admin/metrics/endpoint-timeseries?${q}`);
    },
```

- [ ] **Step 3: Type-check**

Run (from `D:\src\aloevera-harmony-meet`): `npx tsc --noEmit`
Expected: errors only in `RequestVolumeTable.tsx` / `AdminMetricsPage.tsx` (they still reference `statusCode` / old `getEndpointStats` shape) — those are fixed in Tasks 7 and 9. No errors inside `adminApi.ts` itself.

- [ ] **Step 4: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/services/api/adminApi.ts
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): reshape EndpointStatDto, add getEndpointTimeseries"
```

---

## Task 7: `RequestVolumeTable` — filter + selectable rows

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\RequestVolumeTable.tsx` (full rewrite)
- Test: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\__tests__\RequestVolumeTable.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `__tests__/RequestVolumeTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestVolumeTable } from '../RequestVolumeTable';
import type { EndpointStatDto } from '@/services/api/adminApi';

const eps: EndpointStatDto[] = [
  { routeKey: 'GET|/api/v1/users', method: 'GET', route: '/api/v1/users', count: 100, p50: 10, p95: 20, p99: 30 },
  { routeKey: 'POST|/api/v1/matching/likes', method: 'POST', route: '/api/v1/matching/likes', count: 50, p50: 15, p95: 25, p99: 35 },
];

describe('RequestVolumeTable', () => {
  it('renders endpoint rows', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    expect(screen.getByText('/api/v1/users')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('filters rows by search text', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText('Filter endpoints'), { target: { value: 'matching' } });
    expect(screen.queryByText('/api/v1/users')).not.toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('filters rows by toggling a method pill off', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'GET' }));
    expect(screen.queryByText('/api/v1/users')).not.toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('calls onSelect with the endpoint when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('/api/v1/users'));
    expect(onSelect).toHaveBeenCalledWith(eps[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `D:\src\aloevera-harmony-meet`): `npx vitest run src/admin/components/metrics/__tests__/RequestVolumeTable.test.tsx`
Expected: FAIL — component doesn't accept `selectedKey`/`onSelect`, has no filter input.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `RequestVolumeTable.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { EndpointStatDto } from '@/services/api/adminApi';

interface Props {
  endpoints: EndpointStatDto[];
  loading: boolean;
  selectedKey: string | null;
  onSelect: (ep: EndpointStatDto) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  POST:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PUT:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH:  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method.toUpperCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {method.toUpperCase()}
    </span>
  );
}

function fmt(ms: number | null) {
  return ms !== null ? `${Math.round(ms)}` : '—';
}

export function RequestVolumeTable({ endpoints, loading, selectedKey, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set(METHODS));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return endpoints.filter((ep) => {
      if (!activeMethods.has(ep.method.toUpperCase())) return false;
      if (!q) return true;
      return `${ep.method} ${ep.route}`.toLowerCase().includes(q);
    });
  }, [endpoints, search, activeMethods]);

  function toggleMethod(m: string) {
    setActiveMethods((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by route or method…"
          aria-label="Filter endpoints"
          className="flex-1 min-w-[160px] text-sm px-2 py-1 rounded border border-border bg-background"
        />
        <div className="flex gap-1">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              aria-pressed={activeMethods.has(m)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                activeMethods.has(m)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No matching endpoints.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 text-left pr-2">Method</th>
                <th className="text-left pr-2">Route</th>
                <th className="text-right pr-2">Count</th>
                <th className="text-right pr-2">p50 ms</th>
                <th className="text-right">p95 ms</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ep) => (
                <tr
                  key={ep.routeKey}
                  onClick={() => onSelect(ep)}
                  className={`border-t border-border cursor-pointer hover:bg-muted/50 ${
                    ep.routeKey === selectedKey ? 'bg-muted' : ''
                  }`}
                >
                  <td className="py-1 pr-2"><MethodBadge method={ep.method} /></td>
                  <td className="pr-2 font-mono text-xs break-all">{ep.route}</td>
                  <td className="text-right pr-2 tabular-nums">{ep.count.toLocaleString()}</td>
                  <td className="text-right pr-2 tabular-nums text-muted-foreground">{fmt(ep.p50)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{fmt(ep.p95)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/admin/components/metrics/__tests__/RequestVolumeTable.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/components/metrics/RequestVolumeTable.tsx src/admin/components/metrics/__tests__/RequestVolumeTable.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): add search/method filter + row selection to RequestVolumeTable"
```

---

## Task 8: `RequestCountChart` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\RequestCountChart.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\__tests__\RequestCountChart.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/RequestCountChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequestCountChart } from '../RequestCountChart';

describe('RequestCountChart', () => {
  it('shows an empty state when there are no points', () => {
    render(<RequestCountChart points={[]} />);
    expect(screen.getByText('No request data.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/admin/components/metrics/__tests__/RequestCountChart.test.tsx`
Expected: FAIL — `RequestCountChart` does not exist.

- [ ] **Step 3: Write the component**

Create `RequestCountChart.tsx`:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: TimeseriesPointDto[];
}

export function RequestCountChart({ points }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No request data.</div>;
  }

  const data = points.map((p) => ({ ts: p.ts, count: p.count }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip formatter={(v: number) => `${v} calls`} />
        <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/admin/components/metrics/__tests__/RequestCountChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/components/metrics/RequestCountChart.tsx src/admin/components/metrics/__tests__/RequestCountChart.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): add RequestCountChart for per-endpoint call volume"
```

---

## Task 9: `AdminMetricsPage` — wire the drill-down

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\admin\pages\AdminMetricsPage.tsx` (full rewrite)
- Test: `D:\src\aloevera-harmony-meet\src\admin\pages\__tests__\AdminMetricsPage.test.tsx` (modify)

- [ ] **Step 1: Update the test mock + add the drill-down test**

In `AdminMetricsPage.test.tsx`, replace the `getEndpointStats` mock line (currently `getEndpointStats: vi.fn().mockResolvedValue({ success: true, data: [] }),`) with both of these lines:

```tsx
      getEndpointStats: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { routeKey: 'GET|/api/v1/users', method: 'GET', route: '/api/v1/users', count: 100, p50: 10, p95: 20, p99: 30 },
          { routeKey: 'POST|/api/v1/matching/likes', method: 'POST', route: '/api/v1/matching/likes', count: 50, p50: 15, p95: 25, p99: 35 },
        ],
      }),
      getEndpointTimeseries: vi.fn().mockResolvedValue({ success: true, data: [] }),
```

Append this test inside the `describe('AdminMetricsPage', ...)` block:

```tsx
  it('drills into an endpoint when a row is clicked', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    renderPage();
    await waitFor(() => expect(screen.getByText('/api/v1/users')).toBeInTheDocument());

    fireEvent.click(screen.getByText('/api/v1/users'));

    await waitFor(() =>
      expect((adminApi as any).metrics.getEndpointTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', route: '/api/v1/users' }),
      ),
    );
    expect(screen.getByText('Calls over time')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx`
Expected: FAIL — page doesn't call `getEndpointTimeseries` and renders no "Calls over time" label.

- [ ] **Step 3: Rewrite the page**

Replace the entire contents of `AdminMetricsPage.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  type MetricsOverviewDto,
  type ContainerStatusDto,
  type TimeseriesPointDto,
  type BiTimeseriesDto,
  type EndpointStatDto,
} from '@/services/api/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricsOverviewTiles } from '@/admin/components/metrics/MetricsOverviewTiles';
import { ContainerStatusTable } from '@/admin/components/metrics/ContainerStatusTable';
import { UsersTimeChart } from '@/admin/components/metrics/UsersTimeChart';
import { RequestVolumeTable } from '@/admin/components/metrics/RequestVolumeTable';
import { LatencyChart } from '@/admin/components/metrics/LatencyChart';
import { RequestCountChart } from '@/admin/components/metrics/RequestCountChart';
import { BiEventsPanel } from '@/admin/components/metrics/BiEventsPanel';
import { MetricsToggleSheet } from '@/admin/components/metrics/MetricsToggleSheet';

type Range = '1h' | '24h' | '7d' | '30d';

function rangeMs(r: Range): number {
  switch (r) {
    case '1h':  return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d':  return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
  }
}

function resolutionFor(r: Range): 'minute' | 'hour' {
  return r === '1h' || r === '24h' ? 'minute' : 'hour';
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: Range[] = ['1h', '24h', '7d', '30d'];
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

export default function AdminMetricsPage() {
  const [overview, setOverview] = useState<MetricsOverviewDto | null>(null);
  const [containers, setContainers] = useState<ContainerStatusDto[]>([]);
  const [bi, setBi] = useState<BiTimeseriesDto | null>(null);
  const [endpointStats, setEndpointStats] = useState<EndpointStatDto[]>([]);
  const [selected, setSelected] = useState<EndpointStatDto | null>(null);
  const [endpointSeries, setEndpointSeries] = useState<TimeseriesPointDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('24h');
  const [toggleOpen, setToggleOpen] = useState(false);

  const rangeRef = useRef(range);
  rangeRef.current = range;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const fetchEndpointSeries = useCallback(async (ep: EndpointStatDto, currentRange: Range) => {
    const from = new Date(Date.now() - rangeMs(currentRange)).toISOString();
    const to = new Date().toISOString();
    const res = await adminApi.metrics.getEndpointTimeseries({
      method: ep.method,
      route: ep.route,
      from,
      to,
      resolution: resolutionFor(currentRange),
    });
    if (res.success && res.data) setEndpointSeries(res.data);
  }, []);

  const fetchAll = useCallback(async (currentRange: Range) => {
    const biRange: '24h' | '7d' | '30d' = currentRange === '1h' ? '24h' : currentRange;
    const from = new Date(Date.now() - rangeMs(currentRange)).toISOString();
    const to = new Date().toISOString();
    const resolution = resolutionFor(currentRange);

    const [ov, ct, biData, epStats] = await Promise.all([
      adminApi.metrics.getOverview(),
      adminApi.metrics.getContainers(),
      adminApi.metrics.getBi(biRange),
      adminApi.metrics.getEndpointStats({ from, to, resolution }),
    ]);

    if (ov.success && ov.data) setOverview(ov.data);
    if (ct.success && ct.data) setContainers(ct.data);
    if (biData.success && biData.data) setBi(biData.data);
    if (epStats.success && epStats.data) setEndpointStats(epStats.data);

    const sel = selectedRef.current;
    if (sel) await fetchEndpointSeries(sel, currentRange);

    setLoading(false);
  }, [fetchEndpointSeries]);

  // Fetch when range changes; reset any active drill-down selection
  useEffect(() => {
    setLoading(true);
    setSelected(null);
    setEndpointSeries([]);
    void fetchAll(range);
  }, [range, fetchAll]);

  // Auto-refresh every 30s, paused when tab is hidden
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void fetchAll(rangeRef.current);
      }
    };
    const id = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchAll]);

  const handleSelect = useCallback((ep: EndpointStatDto) => {
    setSelected(ep);
    setEndpointSeries([]);
    void fetchEndpointSeries(ep, rangeRef.current);
  }, [fetchEndpointSeries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Operational dashboard — refreshes every 30 s when visible.
          </p>
        </div>
        <Button variant="outline" onClick={() => setToggleOpen(true)}>Settings</Button>
        <MetricsToggleSheet open={toggleOpen} onOpenChange={setToggleOpen} />
      </div>

      {/* 1. Overview tiles */}
      <MetricsOverviewTiles data={overview} loading={loading} />

      {/* 2. Container status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Container status</CardTitle>
        </CardHeader>
        <CardContent>
          <ContainerStatusTable containers={containers} loading={loading} />
        </CardContent>
      </Card>

      {/* 3. Users time chart */}
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

      {/* 4. Request volume + per-endpoint drill-down */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Request volume &amp; latency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Endpoints by count</p>
              <RequestVolumeTable
                endpoints={endpointStats}
                loading={loading}
                selectedKey={selected?.routeKey ?? null}
                onSelect={handleSelect}
              />
            </div>
            <div>
              {selected ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-mono break-all">
                      <span className="font-semibold">{selected.method}</span> {selected.route}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSelected(null); setEndpointSeries([]); }}
                      aria-label="Clear endpoint selection"
                      className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Calls over time</p>
                  <RequestCountChart points={endpointSeries} />
                  <p className="text-xs text-muted-foreground mt-3 mb-1">Latency percentiles</p>
                  <LatencyChart points={endpointSeries} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground text-center px-4">
                  Select an endpoint to see its calls and latency over time.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. BI events */}
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

- [ ] **Step 4: Run the page test to verify it passes**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx`
Expected: PASS — all existing tests plus the new drill-down test.

- [ ] **Step 5: Type-check the whole frontend**

Run: `npx tsc --noEmit`
Expected: no errors (the `statusColor` removal and `getTimeseries` removal are now consistent across files).

- [ ] **Step 6: Run the full frontend suite**

Run: `npm run test:run`
Expected: PASS (no regressions).

- [ ] **Step 7: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/pages/AdminMetricsPage.tsx src/admin/pages/__tests__/AdminMetricsPage.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): per-endpoint drill-down replacing aggregated latency chart"
```

---

## Task 10: Documentation

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docs\MONITORING.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\MONITORING.md`

- [ ] **Step 1: Update the frontend MONITORING.md**

In `aloevera-harmony-meet/docs/MONITORING.md`, in the "Known follow-ups" section, replace the bullet:

```
- **No source toggle on the request-volume panel.** Dashboard always shows `request_timing` (backend perspective). `frontend_perf` data is collected but not surfaced.
```

with:

```
- **No source toggle on the request-volume panel.** Dashboard always shows `request_timing` (backend perspective). `frontend_perf` data is collected but not surfaced.
- **Per-endpoint drill-down (shipped 2026-05-27).** Resource IDs in request-timing/frontend-perf dimension keys are normalized to `{id}` via `MetricsRouteNormalizer` (backend), so the endpoint list is per-API not per-resource. The endpoint table has a search box + GET/POST/PUT/DELETE filter pills (client-side). Clicking a row replaces the right panel with that endpoint's call-count and p50/p95/p99 charts over time, fed by `GET /api/v1/admin/metrics/endpoint-timeseries?method=&route=&from=&to=&resolution=`. `endpoint-stats` now returns one row per `(method, route)` summed across status codes (no `statusCode` field; new `routeKey` identifier).
```

- [ ] **Step 2: Update the API endpoints table in the frontend MONITORING.md**

In the "API endpoints" table, add a row after the `/admin/metrics/timeseries` row:

```
| `GET` | `/api/v1/admin/metrics/endpoint-timeseries` | admin | Per-endpoint count+latency (`?method=&route=&from=&to=&resolution=`) |
```

- [ ] **Step 3: Update the backend MONITORING.md**

In `lovecraft/Lovecraft/docs/MONITORING.md`, in the "Endpoints" table, add after the `/admin/metrics/timeseries` row:

```
| `GET` | `/admin/metrics/endpoint-timeseries` | admin | Per-endpoint count+latency, summed across statuses (`?method=&route=&from=&to=&resolution=`) |
```

Then in the "Critical lesson learned: Azure PK/RK constraints" section, append a paragraph:

```
**Route normalization (2026-05-27):** `MetricsRouteNormalizer` (`Services/Metrics/`) is the single source for collapsing request paths and route templates into Azure-safe dimension segments — GUID/integer segments and `{id:constraint}` templates become `{id}`/`{name}`, joined with `~`. `RequestMetricsMiddleware` now reads the matched `RouteEndpoint.RoutePattern.RawText` (the previous `Metadata.GetMetadata<RouteEndpoint>()` call always returned null, silently falling back to the raw GUID path). `MetricsController` reuses the same helper for `frontend_perf` ingest so both sources share one shape.
```

- [ ] **Step 4: Commit both docs**

```bash
git -C "D:\src\aloevera-harmony-meet" add docs/MONITORING.md
git -C "D:\src\aloevera-harmony-meet" commit -m "docs(metrics): document route normalization + endpoint drill-down"
git -C "D:\src\lovecraft" add Lovecraft/docs/MONITORING.md
git -C "D:\src\lovecraft" commit -m "docs(metrics): document route normalization + endpoint-timeseries"
```

---

## Final verification

- [ ] **Backend full suite**

Run (from `D:\src\lovecraft\Lovecraft`): `dotnet test Lovecraft.UnitTests`
Expected: PASS (all classes, no regressions).

- [ ] **Frontend full suite + type-check**

Run (from `D:\src\aloevera-harmony-meet`): `npx tsc --noEmit && npm run test:run`
Expected: no type errors, all tests pass.

- [ ] **Manual smoke (optional, API mode)**

With the stack running in API mode and an admin JWT, open `/admin/metrics`: confirm the endpoint list shows `{id}`-normalized routes (no GUIDs), the search box + method pills filter rows, and clicking a row shows count + latency charts for that endpoint with a working ✕ clear.
