# Container Metrics Over Time + CPU Utilization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-container drill-down to the admin metrics dashboard showing heap / working-set / threads / CPU% over time (avg line + min/max band), and collect a normalized CPU% metric + gauge time-series from all three .NET containers.

**Architecture:** All three .NET heartbeat workers compute CPU% from the delta of cumulative processor-seconds. The `backend` worker records gauges in-process via its `IMetricsCollector`; the `telegram-bot` and `notifications-worker` workers POST their gauge samples to a new `[RequireServiceToken]` ingest endpoint on the backend (reusing the backend's collector). A new admin endpoint returns per-container gauge time-series (avg/min/max from the stored `SumMs`/`Count`/`MinMs`/`MaxMs`, NOT the latency-tuned histogram percentiles). The frontend container-status table becomes an accordion: clicking a row expands a 2×2 grid of charts.

**Tech Stack:** .NET 10 / ASP.NET Core, Azure Table Storage, xUnit (backend + two worker projects); React 18 / TypeScript, recharts, Vitest + RTL (frontend).

**Spec:** [`docs/superpowers/specs/2026-05-28-container-metrics-timeseries-design.md`](../specs/2026-05-28-container-metrics-timeseries-design.md)

**Command working directories:** backend from `D:\src\lovecraft\Lovecraft` (`dotnet test Lovecraft.UnitTests`); frontend from `D:\src\aloevera-harmony-meet` (`npm run test:run`, `npx vitest run <file>`, `npx tsc -b`). Git: `git -C "D:\src\lovecraft"` / `git -C "D:\src\aloevera-harmony-meet"`. Do NOT push.

**Type-check note (frontend):** root `tsconfig.json` is a solution file — `tsc --noEmit` is a no-op; use `npx tsc -b`. Known PRE-EXISTING unrelated `tsc -b` errors exist on main (`Chats.tsx`, `Likes.tsx`, `Profile.tsx`, `Search.tsx`, `matchingApi.ts`, `webPush.test.ts`, `dual-location-picker.test.tsx`) — ignore them; only ensure files you touch are clean.

---

## File Structure

**Backend (`lovecraft/Lovecraft/`):**
- `Lovecraft.Backend/Services/Metrics/ContainerCpuMath.cs` *(new — pure CPU% helper)*
- `Lovecraft.Backend/Services/Metrics/ContainerStatusSnapshot.cs` *(+`CpuPercent`)*
- `Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs` *(CPU delta + record)*
- `Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs` *(+`CpuPercent`)*
- `Lovecraft.Backend/Controllers/V1/InternalController.cs` *(+`IMetricsCollector`, +ingest action, +`ContainerStatsIngestDto`)*
- `Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs` *(+`CpuPercent` on `ContainerStatusDto`; gauge DTOs + helper + `GetContainerTimeseries`)*
- `Lovecraft.TelegramBot/Storage/ContainerStatusEntity.cs` *(+`CpuPercent`)*, `Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs`, `Lovecraft.TelegramBot/ContainerMetricsReporter.cs` *(new)*, `Lovecraft.TelegramBot/Program.cs`
- `Lovecraft.NotificationsWorker/Entities/ContainerStatusEntity.cs` *(+`CpuPercent`)*, `Lovecraft.NotificationsWorker/Workers/ContainerHeartbeatWorker.cs`, `Lovecraft.NotificationsWorker/ContainerMetricsReporter.cs` *(new)*, `Lovecraft.NotificationsWorker/Program.cs`
- `Lovecraft.UnitTests/` — new + extended tests

**Frontend (`aloevera-harmony-meet/src/`):**
- `services/api/adminApi.ts`, `admin/components/metrics/GaugeBandChart.tsx` *(new)*, `admin/components/metrics/ContainerStatusTable.tsx`, `admin/pages/AdminMetricsPage.tsx`, plus tests under `__tests__/`.

**Docs:** `aloevera-harmony-meet/docs/MONITORING.md`, `lovecraft/Lovecraft/docs/MONITORING.md`.

---

## Task 1: `ContainerCpuMath.ComputeCpuPercent`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Metrics\ContainerCpuMath.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\ContainerCpuMathTests.cs`

- [ ] **Step 1: Write the failing test**

Create `ContainerCpuMathTests.cs`:

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class ContainerCpuMathTests
{
    [Fact]
    public void FirstSample_NoPrior_ReturnsNull()
    {
        // cpuPrev null → cannot compute a delta yet
        Assert.Null(ContainerCpuMath.ComputeCpuPercent(cpuNow: 10, cpuPrev: null, elapsedSeconds: 30, processorCount: 4));
    }

    [Fact]
    public void KnownDelta_ComputesNormalizedPercent()
    {
        // 6 cpu-seconds used over 30 wall-seconds on 4 cores => 6 / (30*4) * 100 = 5%
        var pct = ContainerCpuMath.ComputeCpuPercent(cpuNow: 16, cpuPrev: 10, elapsedSeconds: 30, processorCount: 4);
        Assert.NotNull(pct);
        Assert.Equal(5.0, pct!.Value, 3);
    }

    [Fact]
    public void OverUsedAllCores_ClampsTo100()
    {
        // 200 cpu-seconds over 30s on 4 cores = 166% → clamp 100
        Assert.Equal(100, ContainerCpuMath.ComputeCpuPercent(0 + 200, 0, 30, 4)!.Value, 3);
    }

    [Fact]
    public void NegativeDelta_ClampsTo0()
    {
        // counter went backwards (e.g. process restart) → clamp 0
        Assert.Equal(0, ContainerCpuMath.ComputeCpuPercent(5, 10, 30, 4)!.Value, 3);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void NonPositiveElapsed_ReturnsNull(double elapsed)
    {
        Assert.Null(ContainerCpuMath.ComputeCpuPercent(16, 10, elapsed, 4));
    }

    [Fact]
    public void ZeroProcessorCount_ReturnsNull()
    {
        Assert.Null(ContainerCpuMath.ComputeCpuPercent(16, 10, 30, 0));
    }
}
```

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerCpuMathTests"`
Expected: FAIL (compile error — `ContainerCpuMath` doesn't exist).

- [ ] **Step 3: Implement**

Create `ContainerCpuMath.cs`:

```csharp
namespace Lovecraft.Backend.Services.Metrics;

/// <summary>
/// Derives normalized CPU utilization (0–100% across all cores) from the delta of
/// cumulative processor-seconds between two heartbeat samples. Returns null when a
/// percentage cannot be computed (first sample, non-positive elapsed time, or no cores).
/// </summary>
public static class ContainerCpuMath
{
    public static double? ComputeCpuPercent(double cpuNow, double? cpuPrev, double elapsedSeconds, int processorCount)
    {
        if (cpuPrev is null) return null;
        if (elapsedSeconds <= 0) return null;
        if (processorCount <= 0) return null;

        var pct = (cpuNow - cpuPrev.Value) / (elapsedSeconds * processorCount) * 100.0;
        return Math.Clamp(pct, 0.0, 100.0);
    }
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerCpuMathTests"`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerCpuMath.cs Lovecraft/Lovecraft.UnitTests/ContainerCpuMathTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): add ContainerCpuMath.ComputeCpuPercent helper"
```

---

## Task 2: CpuPercent field + backend heartbeat worker records CPU

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Metrics\ContainerStatusSnapshot.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\ContainerStatusEntity.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Metrics\ContainerHeartbeatWorker.cs`

- [ ] **Step 1: Add `CpuPercent` to the snapshot record**

In `ContainerStatusSnapshot.cs`, add a parameter after `CpuSecondsTotal`:

```csharp
public sealed record ContainerStatusSnapshot(
    string Name,
    DateTime LastHeartbeatUtc,
    DateTime StartedAtUtc,
    string Version,
    long? GcHeapMb,
    long? WorkingSetMb,
    int? ThreadCount,
    double? CpuSecondsTotal,
    double? CpuPercent,
    long? RequestsServed,
    string? Note);
```

- [ ] **Step 2: Add `CpuPercent` to the entity**

In `Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs`, add after `CpuSecondsTotal`:

```csharp
    public double? CpuPercent { get; set; }
```

- [ ] **Step 3: Update `CaptureSnapshot` + worker loop to compute CPU**

In `ContainerHeartbeatWorker.cs`: `CaptureSnapshot` currently passes positional args to the record — add `CpuPercent: null` in the new slot (the static capture has no prior state). Then add instance CPU state + compute it in the loop. Replace the whole file with:

```csharp
using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class ContainerHeartbeatWorker : BackgroundService
{
    private readonly IMetricsCollector _collector;
    private readonly ILogger<ContainerHeartbeatWorker> _logger;
    private readonly string _containerName;
    private readonly string _version;
    private readonly DateTime _startedAtUtc = DateTime.UtcNow;
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(30);

    private double? _lastCpuSeconds;
    private DateTime? _lastSampleUtc;

    public ContainerHeartbeatWorker(IMetricsCollector collector, ILogger<ContainerHeartbeatWorker> logger,
                                    string containerName, string version)
    {
        _collector = collector;
        _logger = logger;
        _containerName = containerName;
        _version = version;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var snap = CaptureSnapshot(_containerName, _startedAtUtc, _version);

                var now = snap.LastHeartbeatUtc;
                var elapsed = _lastSampleUtc is null ? 0 : (now - _lastSampleUtc.Value).TotalSeconds;
                var cpuPercent = ContainerCpuMath.ComputeCpuPercent(
                    snap.CpuSecondsTotal ?? 0, _lastCpuSeconds, elapsed, Environment.ProcessorCount);
                _lastCpuSeconds = snap.CpuSecondsTotal;
                _lastSampleUtc = now;
                snap = snap with { CpuPercent = cpuPercent };

                await _collector.RecordContainerStatusAsync(snap, stoppingToken);
                _collector.RecordTiming("container_stats", $"{_containerName}|working_set_mb", snap.WorkingSetMb ?? 0);
                _collector.RecordTiming("container_stats", $"{_containerName}|gc_heap_mb", snap.GcHeapMb ?? 0);
                _collector.RecordTiming("container_stats", $"{_containerName}|thread_count", snap.ThreadCount ?? 0);
                if (cpuPercent is not null)
                    _collector.RecordTiming("container_stats", $"{_containerName}|cpu_percent", cpuPercent.Value);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Heartbeat failed for {Container}", _containerName); }
            await Task.Delay(TickInterval, stoppingToken);
        }
    }

    public static ContainerStatusSnapshot CaptureSnapshot(string name, DateTime startedAt, string version)
    {
        using var proc = Process.GetCurrentProcess();
        return new ContainerStatusSnapshot(
            Name: name,
            LastHeartbeatUtc: DateTime.UtcNow,
            StartedAtUtc: startedAt,
            Version: version,
            GcHeapMb: GC.GetTotalMemory(false) / (1024 * 1024),
            WorkingSetMb: proc.WorkingSet64 / (1024 * 1024),
            ThreadCount: proc.Threads.Count,
            CpuSecondsTotal: proc.TotalProcessorTime.TotalSeconds,
            CpuPercent: null,
            RequestsServed: null,
            Note: null);
    }
}
```

- [ ] **Step 4: Verify the existing snapshot test still compiles + the entity write path is intact**

The existing `ContainerHeartbeatWorkerTests.Snapshot_PopulatesProcessMetrics` still passes (it doesn't assert CpuPercent). Confirm the Azure entity-mapping for `RecordContainerStatusAsync` writes `CpuPercent` — check `AzureMetricsCollector.RecordContainerStatusAsync` (or wherever `ContainerStatusSnapshot` → `ContainerStatusEntity` mapping happens) and add `CpuPercent = snapshot.CpuPercent` to that mapping if the mapping is field-by-field.

Run: `grep -rn "ContainerStatusEntity" "D:\src\lovecraft\Lovecraft\Lovecraft.Backend"` to find the mapping site (likely in `AzureMetricsCollector.cs`). Add the `CpuPercent` assignment there.

- [ ] **Step 5: Build + run container tests**

Run: `dotnet build Lovecraft.Backend` then `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerHeartbeatWorkerTests"`
Expected: build clean; existing snapshot test passes.

- [ ] **Step 6: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerStatusSnapshot.cs Lovecraft/Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs Lovecraft/Lovecraft.Backend/Services/Metrics/AzureMetricsCollector.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): record CPU% from backend heartbeat worker"
```
(Include `AzureMetricsCollector.cs` only if Step 4 edited it.)

---

## Task 3: Internal container-stats ingest endpoint

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\InternalController.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\InternalControllerTests.cs`

- [ ] **Step 1: Write the failing tests**

Append to `InternalControllerTests.cs` (add `using Lovecraft.Backend.Controllers.V1;`, `using Lovecraft.Backend.Services.Metrics;`, `using Microsoft.AspNetCore.Mvc;`, `using System.Linq;` if not present):

```csharp
    [Fact]
    public void ContainerStats_RecordsOneTimingPerNonNullField()
    {
        var collector = new MockMetricsCollector();
        // users + prefs services are unused by this action; safe to pass null in a direct unit call.
        var ctrl = new InternalController(null!, null!, collector);

        var result = ctrl.ContainerStats(new ContainerStatsIngestDto
        {
            Container = "telegram-bot", GcHeapMb = 22, WorkingSetMb = 98, ThreadCount = 14, CpuPercent = 3.5
        });

        Assert.IsType<NoContentResult>(result);
        var rows = collector.Snapshot().Where(r => r.Category == "container_stats").ToList();
        Assert.Equal(4, rows.Count);
        Assert.Contains(rows, r => r.DimensionKey == "telegram-bot|gc_heap_mb");
        Assert.Contains(rows, r => r.DimensionKey == "telegram-bot|working_set_mb");
        Assert.Contains(rows, r => r.DimensionKey == "telegram-bot|thread_count");
        Assert.Contains(rows, r => r.DimensionKey == "telegram-bot|cpu_percent");
    }

    [Fact]
    public void ContainerStats_SkipsNullFields()
    {
        var collector = new MockMetricsCollector();
        var ctrl = new InternalController(null!, null!, collector);
        ctrl.ContainerStats(new ContainerStatsIngestDto { Container = "x", GcHeapMb = 10 });
        Assert.Single(collector.Snapshot().Where(r => r.Category == "container_stats"));
    }

    [Fact]
    public void ContainerStats_BlankContainer_Returns400()
    {
        var ctrl = new InternalController(null!, null!, new MockMetricsCollector());
        Assert.IsType<BadRequestResult>(ctrl.ContainerStats(new ContainerStatsIngestDto { Container = "" }));
    }
```

> If `MockMetricsCollector` gates recording on `CurrentFlags`, add `collector.UpdateFlags(MetricsEnabledFlags.AllEnabled);` after construction in each test. If `Snapshot()` row property names differ from `.Category`/`.DimensionKey`, match the actual shape (see `RequestMetricsMiddlewareTests` for the canonical usage).

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~InternalControllerTests.ContainerStats"`
Expected: FAIL (compile — `ContainerStatsIngestDto` and `ContainerStats` action don't exist; ctor has 2 params not 3).

- [ ] **Step 3: Implement the ingest action + DTO + ctor change**

In `InternalController.cs`: add `using Lovecraft.Backend.Services.Metrics;`, inject the collector, add the action + DTO:

```csharp
public class InternalController : ControllerBase
{
    private readonly IUserService _users;
    private readonly INotificationPreferenceService _prefs;
    private readonly IMetricsCollector _metrics;

    public InternalController(IUserService users, INotificationPreferenceService prefs, IMetricsCollector metrics)
    {
        _users = users;
        _prefs = prefs;
        _metrics = metrics;
    }

    // ... existing MuteType action unchanged ...

    [HttpPost("metrics/container-stats")]
    public IActionResult ContainerStats([FromBody] ContainerStatsIngestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Container)) return BadRequest();

        if (request.GcHeapMb is not null)
            _metrics.RecordTiming("container_stats", $"{request.Container}|gc_heap_mb", request.GcHeapMb.Value);
        if (request.WorkingSetMb is not null)
            _metrics.RecordTiming("container_stats", $"{request.Container}|working_set_mb", request.WorkingSetMb.Value);
        if (request.ThreadCount is not null)
            _metrics.RecordTiming("container_stats", $"{request.Container}|thread_count", request.ThreadCount.Value);
        if (request.CpuPercent is not null)
            _metrics.RecordTiming("container_stats", $"{request.Container}|cpu_percent", request.CpuPercent.Value);

        return NoContent();
    }
}

public sealed class ContainerStatsIngestDto
{
    public string Container { get; set; } = string.Empty;
    public long? GcHeapMb { get; set; }
    public long? WorkingSetMb { get; set; }
    public int? ThreadCount { get; set; }
    public double? CpuPercent { get; set; }
}
```

(Place `ContainerStatsIngestDto` at the bottom of the file, outside the controller class.)

- [ ] **Step 4: Run, verify PASS + full build (DI now needs 3-arg ctor — verify it resolves)**

Run: `dotnet build Lovecraft.Backend` then `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~InternalControllerTests"`
Expected: build clean (`IMetricsCollector` is already a registered singleton, so DI resolves the new ctor); all InternalController tests pass (new 3 + existing auth tests).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/InternalController.cs Lovecraft/Lovecraft.UnitTests/InternalControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): internal container-stats ingest endpoint for workers"
```

---

## Task 4: Gauge aggregation helper + `GaugeTimeseriesPointDto`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\AdminMetricsController.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AdminMetricsControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Append to `AdminMetricsControllerTests.cs`:

```csharp
    [Fact]
    public void AggregateGaugeSeries_ComputesAvgMinMaxPerBucket()
    {
        var t0 = new DateTime(2026, 5, 28, 10, 0, 0, DateTimeKind.Utc);
        var t1 = t0.AddMinutes(1);
        var rows = new List<(DateTime ts, long count, long? sumMs, long? minMs, long? maxMs)>
        {
            (t0, 2, 100, 40, 60),   // avg 50
            (t1, 0, 0, null, null),  // count 0 → avg null
            (t1, 4, 480, 100, 140),  // merges into t1: total count 4, sum 480 → avg 120
        };

        var points = AdminMetricsController.AggregateGaugeSeries(rows);

        Assert.Equal(2, points.Count);
        var p0 = points.Single(p => p.Ts == t0);
        Assert.Equal(50, p0.Avg!.Value, 3);
        Assert.Equal(40, p0.Min!.Value, 3);
        Assert.Equal(60, p0.Max!.Value, 3);
        var p1 = points.Single(p => p.Ts == t1);
        Assert.Equal(120, p1.Avg!.Value, 3);   // 480 / 4
        Assert.Equal(100, p1.Min!.Value, 3);
        Assert.Equal(140, p1.Max!.Value, 3);
    }
```

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.AggregateGaugeSeries_ComputesAvgMinMaxPerBucket"`
Expected: FAIL (compile — `GaugeTimeseriesPointDto` and `AggregateGaugeSeries` don't exist).

- [ ] **Step 3: Add the DTO + helper**

In `AdminMetricsController.cs`, add the DTO near the other DTOs at the top of the file:

```csharp
public sealed record GaugeTimeseriesPointDto(DateTime Ts, double? Avg, double? Min, double? Max);
```

Add the public static helper in the controller (next to `AggregateEndpointStats`):

```csharp
    /// <summary>
    /// Groups raw gauge rows by timestamp bucket, computing avg (Sum/Count), min, max.
    /// For gauges the histogram percentiles are meaningless (latency-tuned buckets), so we
    /// use the Sum/Count/Min/Max columns instead. Sorted chronologically.
    /// </summary>
    public static List<GaugeTimeseriesPointDto> AggregateGaugeSeries(
        IEnumerable<(DateTime ts, long count, long? sumMs, long? minMs, long? maxMs)> rows)
    {
        var byBucket = new Dictionary<DateTime, (long count, long sum, long? min, long? max)>();
        foreach (var (ts, count, sumMs, minMs, maxMs) in rows)
        {
            if (!byBucket.TryGetValue(ts, out var acc))
                acc = (0, 0, null, null);
            acc.count += count;
            acc.sum += sumMs ?? 0;
            if (minMs is not null) acc.min = acc.min is null ? minMs : Math.Min(acc.min.Value, minMs.Value);
            if (maxMs is not null) acc.max = acc.max is null ? maxMs : Math.Max(acc.max.Value, maxMs.Value);
            byBucket[ts] = acc;
        }

        return byBucket
            .OrderBy(kv => kv.Key)
            .Select(kv => new GaugeTimeseriesPointDto(
                Ts: kv.Key,
                Avg: kv.Value.count > 0 ? (double)kv.Value.sum / kv.Value.count : null,
                Min: kv.Value.min,
                Max: kv.Value.max))
            .ToList();
    }
```

- [ ] **Step 4: Run, verify PASS**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.AggregateGaugeSeries_ComputesAvgMinMaxPerBucket"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): gauge series aggregation (avg/min/max) helper"
```

---

## Task 5: `container-timeseries` endpoint + CpuPercent on containers DTO

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\AdminMetricsController.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AdminMetricsControllerTests.cs`

- [ ] **Step 1: Write the failing tests**

Append to `AdminMetricsControllerTests.cs`:

```csharp
    [Fact]
    public async Task ContainerTimeseries_ReturnsEmptyFourSeriesInMockMode()
    {
        using var client = _factory.CreateClientAsUser("admin-ct-1", "admin");
        var from = Uri.EscapeDataString(DateTime.UtcNow.AddHours(-2).ToString("o"));
        var to = Uri.EscapeDataString(DateTime.UtcNow.ToString("o"));
        var resp = await client.GetAsync(
            $"/api/v1/admin/metrics/container-timeseries?container=backend&from={from}&to={to}&resolution=minute");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<ContainerTimeseriesDto>>(JsonOpts);
        Assert.True(body!.Success);
        Assert.Empty(body.Data!.HeapMb);
        Assert.Empty(body.Data.WorkingSetMb);
        Assert.Empty(body.Data.ThreadCount);
        Assert.Empty(body.Data.CpuPercent);
    }

    [Fact]
    public async Task ContainerTimeseries_MissingContainer_Returns400()
    {
        using var client = _factory.CreateClientAsUser("admin-ct-2", "admin");
        var from = Uri.EscapeDataString(DateTime.UtcNow.AddHours(-1).ToString("o"));
        var to = Uri.EscapeDataString(DateTime.UtcNow.ToString("o"));
        var resp = await client.GetAsync(
            $"/api/v1/admin/metrics/container-timeseries?from={from}&to={to}");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
```

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests.ContainerTimeseries"`
Expected: FAIL (route 404 / `ContainerTimeseriesDto` missing).

- [ ] **Step 3: Add `CpuPercent` to `ContainerStatusDto` + populate it**

In `AdminMetricsController.cs`, the `ContainerStatusDto` record — add `double? CpuPercent` (place it after `ThreadCount`):

```csharp
public sealed record ContainerStatusDto(
    string Name,
    string Status,
    double? HeartbeatAgeSeconds,
    long? GcHeapMb,
    long? WorkingSetMb,
    int? ThreadCount,
    double? CpuPercent,
    string? Note,
    DateTime? StartedAtUtc,
    string? Version);
```

In `GetContainers`, add `CpuPercent: entity.CpuPercent,` to the `new ContainerStatusDto(...)` construction (in the new slot).

- [ ] **Step 4: Add `ContainerTimeseriesDto` + the endpoint**

Add the response DTO near the other DTOs:

```csharp
public sealed record ContainerTimeseriesDto(
    List<GaugeTimeseriesPointDto> HeapMb,
    List<GaugeTimeseriesPointDto> WorkingSetMb,
    List<GaugeTimeseriesPointDto> ThreadCount,
    List<GaugeTimeseriesPointDto> CpuPercent);
```

Add the action after `GetEndpointTimeseries`:

```csharp
    // ─────────────────────────────────────────────────────────────────────────
    // GET /admin/metrics/container-timeseries
    // Query params: container, from, to, resolution=minute|hour
    // Per-container gauge series (avg/min/max), summed across the dimension's rows.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("container-timeseries")]
    public async Task<ActionResult<ApiResponse<ContainerTimeseriesDto>>> GetContainerTimeseries(
        [FromQuery] string container,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string resolution = "minute",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(container))
            return BadRequest(ApiResponse<ContainerTimeseriesDto>.ErrorResponse("MISSING_PARAM", "container is required"));

        var empty = new ContainerTimeseriesDto(new(), new(), new(), new());
        if (_tables is null)
            return Ok(ApiResponse<ContainerTimeseriesDto>.SuccessResponse(empty));

        var useMinute = !string.Equals(resolution, "hour", StringComparison.OrdinalIgnoreCase);
        var table = _tables.GetTableClient(useMinute ? TableNames.MetricsMinute : TableNames.MetricsHour);
        await table.CreateIfNotExistsAsync(ct);

        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var toUtc   = DateTime.SpecifyKind(to,   DateTimeKind.Utc);

        async Task<List<GaugeTimeseriesPointDto>> SeriesAsync(string metric)
        {
            var dim = $"{container}|{metric}";
            var rows = await ScanGaugeRowsAsync(table, useMinute, dim, fromUtc, toUtc, ct);
            return AggregateGaugeSeries(rows);
        }

        var dto = new ContainerTimeseriesDto(
            HeapMb:       await SeriesAsync("gc_heap_mb"),
            WorkingSetMb: await SeriesAsync("working_set_mb"),
            ThreadCount:  await SeriesAsync("thread_count"),
            CpuPercent:   await SeriesAsync("cpu_percent"));

        return Ok(ApiResponse<ContainerTimeseriesDto>.SuccessResponse(dto));
    }

    // Scans container_stats rows for one dimension key, returning (ts, count, sumMs, minMs, maxMs) per bucket.
    private async Task<List<(DateTime ts, long count, long? sumMs, long? minMs, long? maxMs)>> ScanGaugeRowsAsync(
        TableClient table, bool useMinute, string dimensionKey, DateTime from, DateTime to, CancellationToken ct)
    {
        var rows = new List<(DateTime, long, long?, long?, long?)>();

        if (useMinute)
        {
            var cursor = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
            while (cursor <= to)
            {
                var pk = $"{cursor:yyyy-MM-dd'T'HH}_container_stats";
                await foreach (var e in table.QueryAsync<MetricMinuteEntity>(
                    filter: $"PartitionKey eq '{pk}'", cancellationToken: ct))
                {
                    var parts = e.RowKey.Split('_', 2);
                    if (parts.Length < 2 || parts[1] != dimensionKey || !int.TryParse(parts[0], out var min)) continue;
                    var ts = new DateTime(cursor.Year, cursor.Month, cursor.Day, cursor.Hour, min, 0, DateTimeKind.Utc);
                    if (ts < from || ts > to) continue;
                    rows.Add((ts, e.Count, e.SumMs, e.MinMs, e.MaxMs));
                }
                cursor = cursor.AddHours(1);
            }
        }
        else
        {
            var cursor = new DateTime(from.Year, from.Month, from.Day, 0, 0, 0, DateTimeKind.Utc);
            while (cursor <= to)
            {
                var pk = $"{cursor:yyyy-MM-dd}_container_stats";
                await foreach (var e in table.QueryAsync<MetricHourEntity>(
                    filter: $"PartitionKey eq '{pk}'", cancellationToken: ct))
                {
                    var parts = e.RowKey.Split('_', 2);
                    if (parts.Length < 2 || parts[1] != dimensionKey || !int.TryParse(parts[0], out var hr)) continue;
                    var ts = new DateTime(cursor.Year, cursor.Month, cursor.Day, hr, 0, 0, DateTimeKind.Utc);
                    if (ts < from || ts > to) continue;
                    rows.Add((ts, e.Count, e.SumMs, e.MinMs, e.MaxMs));
                }
                cursor = cursor.AddDays(1);
            }
        }

        return rows;
    }
```

> `MetricHourEntity` must expose `SumMs`/`MinMs`/`MaxMs` like `MetricMinuteEntity`. Confirm by reading `Lovecraft.Backend/Storage/Entities/MetricHourEntity.cs`; both are used here.

- [ ] **Step 5: Run, verify PASS + build**

Run: `dotnet build Lovecraft.Backend` then `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AdminMetricsControllerTests"`
Expected: build clean; new container-timeseries tests pass; all existing AdminMetrics tests still pass (note: any existing test constructing `ContainerStatusDto` positionally must be updated for the new `CpuPercent` slot — search the test file and fix if needed).

- [ ] **Step 6: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): container-timeseries endpoint + CpuPercent on containers DTO"
```

---

## Task 6: telegram-bot — CPU% + push gauges to backend

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\Storage\ContainerStatusEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\ContainerMetricsReporter.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\Workers\ContainerHeartbeatWorker.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\Program.cs`
- Test: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\TelegramBot\ContainerMetricsReporterTests.cs`

- [ ] **Step 1: Write the failing test (the reporter POSTs the right payload + header)**

Create `Lovecraft.UnitTests/TelegramBot/ContainerMetricsReporterTests.cs`:

```csharp
using System.Net;
using System.Text.Json;
using Lovecraft.TelegramBot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests.TelegramBot;

public class ContainerMetricsReporterTests
{
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? Request;
        public string? Body;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(HttpStatusCode.NoContent);
        }
    }

    [Fact]
    public async Task ReportAsync_PostsSamplesWithServiceToken()
    {
        var handler = new CapturingHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://backend:8080") };
        var reporter = new ContainerMetricsReporter(http, "tok-123", NullLogger<ContainerMetricsReporter>.Instance);

        await reporter.ReportAsync("telegram-bot", gcHeapMb: 22, workingSetMb: 98, threadCount: 14, cpuPercent: 3.5, default);

        Assert.NotNull(handler.Request);
        Assert.Equal(HttpMethod.Post, handler.Request!.Method);
        Assert.Equal("/api/v1/internal/metrics/container-stats", handler.Request.RequestUri!.AbsolutePath);
        Assert.True(handler.Request.Headers.TryGetValues("X-Service-Token", out var tok));
        Assert.Equal("tok-123", System.Linq.Enumerable.First(tok!));

        using var doc = JsonDocument.Parse(handler.Body!);
        Assert.Equal("telegram-bot", doc.RootElement.GetProperty("container").GetString());
        Assert.Equal(22, doc.RootElement.GetProperty("gcHeapMb").GetInt64());
        Assert.Equal(3.5, doc.RootElement.GetProperty("cpuPercent").GetDouble(), 3);
    }

    [Fact]
    public async Task ReportAsync_SwallowsHttpFailure()
    {
        var http = new HttpClient(new ThrowingHandler()) { BaseAddress = new Uri("http://backend:8080") };
        var reporter = new ContainerMetricsReporter(http, "tok", NullLogger<ContainerMetricsReporter>.Instance);
        // must not throw
        await reporter.ReportAsync("x", 1, 1, 1, 1, default);
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("boom");
    }
}
```

- [ ] **Step 2: Run, verify FAIL**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerMetricsReporterTests"`
Expected: FAIL (compile — `ContainerMetricsReporter` doesn't exist).

- [ ] **Step 3: Create the reporter**

Create `Lovecraft.TelegramBot/ContainerMetricsReporter.cs`:

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace Lovecraft.TelegramBot;

/// <summary>
/// Best-effort push of this container's gauge samples to the backend's internal
/// metrics ingest endpoint. Never throws — a dropped sample is acceptable for a gauge.
/// </summary>
public sealed class ContainerMetricsReporter
{
    private const string Endpoint = "/api/v1/internal/metrics/container-stats";
    private readonly HttpClient _http;
    private readonly string _serviceToken;
    private readonly ILogger<ContainerMetricsReporter> _logger;

    public ContainerMetricsReporter(HttpClient http, string serviceToken, ILogger<ContainerMetricsReporter> logger)
    {
        _http = http;
        _serviceToken = serviceToken;
        _logger = logger;
    }

    public async Task ReportAsync(string container, long? gcHeapMb, long? workingSetMb,
                                  int? threadCount, double? cpuPercent, CancellationToken ct)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, Endpoint);
            req.Headers.Add("X-Service-Token", _serviceToken);
            req.Content = JsonContent.Create(new { container, gcHeapMb, workingSetMb, threadCount, cpuPercent });
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Container metrics push for {Container} failed: {Status}", container, resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Container metrics push for {Container} threw", container);
        }
    }
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerMetricsReporterTests"`
Expected: PASS.

- [ ] **Step 5: Add `CpuPercent` to the entity copy**

In `Lovecraft.TelegramBot/Storage/ContainerStatusEntity.cs`, add after `CpuSecondsTotal`:

```csharp
    public double? CpuPercent { get; set; }
```

- [ ] **Step 6: Wire CPU + push into the worker**

Replace `Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs` with:

```csharp
using System.Diagnostics;
using Azure.Data.Tables;
using Lovecraft.TelegramBot.Storage;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.TelegramBot.Workers;

public sealed class ContainerHeartbeatWorker : BackgroundService
{
    private readonly TableServiceClient _tables;
    private readonly ILogger<ContainerHeartbeatWorker> _logger;
    private readonly string _name;
    private readonly string _version;
    private readonly ContainerMetricsReporter? _reporter;
    private readonly DateTime _startedAt = DateTime.UtcNow;
    private bool _tableInit;
    private double? _lastCpuSeconds;
    private DateTime? _lastSampleUtc;

    public ContainerHeartbeatWorker(TableServiceClient tables, ILogger<ContainerHeartbeatWorker> logger,
                                    string name, ContainerMetricsReporter? reporter = null)
    {
        _tables = tables;
        _logger = logger;
        _name = name;
        _reporter = reporter;
        _version = typeof(ContainerHeartbeatWorker).Assembly.GetName().Version?.ToString() ?? "0.0.0";
    }

    // Pure CPU% helper duplicated from Lovecraft.Backend.Services.Metrics.ContainerCpuMath
    // (worker projects don't reference the backend). Keep in sync.
    private static double? ComputeCpuPercent(double cpuNow, double? cpuPrev, double elapsedSeconds, int cores)
    {
        if (cpuPrev is null || elapsedSeconds <= 0 || cores <= 0) return null;
        return Math.Clamp((cpuNow - cpuPrev.Value) / (elapsedSeconds * cores) * 100.0, 0.0, 100.0);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var table = _tables.GetTableClient("containerstatus");
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!_tableInit) { await table.CreateIfNotExistsAsync(ct); _tableInit = true; }
                using var proc = Process.GetCurrentProcess();
                var now = DateTime.UtcNow;
                var heap = GC.GetTotalMemory(false) / (1024 * 1024);
                var ws = proc.WorkingSet64 / (1024 * 1024);
                var threads = proc.Threads.Count;
                var cpuSeconds = proc.TotalProcessorTime.TotalSeconds;

                var elapsed = _lastSampleUtc is null ? 0 : (now - _lastSampleUtc.Value).TotalSeconds;
                var cpuPercent = ComputeCpuPercent(cpuSeconds, _lastCpuSeconds, elapsed, Environment.ProcessorCount);
                _lastCpuSeconds = cpuSeconds;
                _lastSampleUtc = now;

                var entity = new ContainerStatusEntity
                {
                    PartitionKey = "STATUS",
                    RowKey = _name,
                    LastHeartbeatUtc = now,
                    StartedAtUtc = _startedAt,
                    Version = _version,
                    WorkingSetMb = ws,
                    GcHeapMb = heap,
                    ThreadCount = threads,
                    CpuSecondsTotal = cpuSeconds,
                    CpuPercent = cpuPercent,
                };
                await table.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);

                if (_reporter is not null)
                    await _reporter.ReportAsync(_name, heap, ws, threads, cpuPercent, ct);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Heartbeat failed"); }
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }
}
```

- [ ] **Step 7: Wire the reporter in Program.cs**

In `Lovecraft.TelegramBot/Program.cs`, the `serviceToken` + `backendUrl` are already read. Replace the `ContainerHeartbeatWorker` registration block (inside the `if (!string.IsNullOrEmpty(storageConnectionString))`) with one that passes a reporter when the token is present:

```csharp
        if (!string.IsNullOrEmpty(storageConnectionString))
        {
            builder.Services.AddSingleton(new TableServiceClient(storageConnectionString));
            builder.Services.AddHostedService(sp =>
            {
                ContainerMetricsReporter? reporter = null;
                if (!string.IsNullOrEmpty(serviceToken))
                {
                    var client = new HttpClient { BaseAddress = new Uri(backendUrl) };
                    reporter = new ContainerMetricsReporter(client, serviceToken,
                        sp.GetRequiredService<ILogger<ContainerMetricsReporter>>());
                }
                return new ContainerHeartbeatWorker(
                    sp.GetRequiredService<TableServiceClient>(),
                    sp.GetRequiredService<ILogger<ContainerHeartbeatWorker>>(),
                    "telegram-bot",
                    reporter);
            });
        }
```

- [ ] **Step 8: Build + test**

Run: `dotnet build Lovecraft.TelegramBot` then `dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ContainerMetricsReporterTests"`
Expected: build clean; reporter tests pass.

- [ ] **Step 9: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.TelegramBot/Storage/ContainerStatusEntity.cs Lovecraft/Lovecraft.TelegramBot/ContainerMetricsReporter.cs Lovecraft/Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs Lovecraft/Lovecraft.TelegramBot/Program.cs Lovecraft/Lovecraft.UnitTests/TelegramBot/ContainerMetricsReporterTests.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): telegram-bot computes CPU% + pushes gauges to backend"
```

---

## Task 7: notifications-worker — CPU% + push gauges to backend

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Entities\ContainerStatusEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\ContainerMetricsReporter.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Workers\ContainerHeartbeatWorker.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Program.cs`

- [ ] **Step 1: Add `CpuPercent` to the entity copy**

In `Lovecraft.NotificationsWorker/Entities/ContainerStatusEntity.cs`, add after `CpuSecondsTotal`:

```csharp
    public double? CpuPercent { get; set; }
```

- [ ] **Step 2: Create the reporter (identical logic, NotificationsWorker namespace)**

Create `Lovecraft.NotificationsWorker/ContainerMetricsReporter.cs`:

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker;

/// <summary>
/// Best-effort push of this container's gauge samples to the backend's internal
/// metrics ingest endpoint. Never throws. Duplicated from the telegram-bot copy.
/// </summary>
public sealed class ContainerMetricsReporter
{
    private const string Endpoint = "/api/v1/internal/metrics/container-stats";
    private readonly HttpClient _http;
    private readonly string _serviceToken;
    private readonly ILogger<ContainerMetricsReporter> _logger;

    public ContainerMetricsReporter(HttpClient http, string serviceToken, ILogger<ContainerMetricsReporter> logger)
    {
        _http = http;
        _serviceToken = serviceToken;
        _logger = logger;
    }

    public async Task ReportAsync(string container, long? gcHeapMb, long? workingSetMb,
                                  int? threadCount, double? cpuPercent, CancellationToken ct)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, Endpoint);
            req.Headers.Add("X-Service-Token", _serviceToken);
            req.Content = JsonContent.Create(new { container, gcHeapMb, workingSetMb, threadCount, cpuPercent });
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Container metrics push for {Container} failed: {Status}", container, resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Container metrics push for {Container} threw", container);
        }
    }
}
```

- [ ] **Step 3: Wire CPU + push into the worker**

Replace `Lovecraft.NotificationsWorker/Workers/ContainerHeartbeatWorker.cs` with:

```csharp
using System.Diagnostics;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public sealed class ContainerHeartbeatWorker : BackgroundService
{
    private readonly TableServiceClient _tables;
    private readonly ILogger<ContainerHeartbeatWorker> _logger;
    private readonly string _name;
    private readonly string _version;
    private readonly ContainerMetricsReporter? _reporter;
    private readonly DateTime _startedAt = DateTime.UtcNow;
    private bool _tableInit;
    private double? _lastCpuSeconds;
    private DateTime? _lastSampleUtc;

    public ContainerHeartbeatWorker(TableServiceClient tables, ILogger<ContainerHeartbeatWorker> logger,
                                    string name, ContainerMetricsReporter? reporter = null)
    {
        _tables = tables;
        _logger = logger;
        _name = name;
        _reporter = reporter;
        _version = typeof(ContainerHeartbeatWorker).Assembly.GetName().Version?.ToString() ?? "0.0.0";
    }

    // Pure CPU% helper duplicated from Lovecraft.Backend.Services.Metrics.ContainerCpuMath. Keep in sync.
    private static double? ComputeCpuPercent(double cpuNow, double? cpuPrev, double elapsedSeconds, int cores)
    {
        if (cpuPrev is null || elapsedSeconds <= 0 || cores <= 0) return null;
        return Math.Clamp((cpuNow - cpuPrev.Value) / (elapsedSeconds * cores) * 100.0, 0.0, 100.0);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var table = _tables.GetTableClient(TableNames.ContainerStatus);
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!_tableInit) { await table.CreateIfNotExistsAsync(ct); _tableInit = true; }
                using var proc = Process.GetCurrentProcess();
                var now = DateTime.UtcNow;
                var heap = GC.GetTotalMemory(false) / (1024 * 1024);
                var ws = proc.WorkingSet64 / (1024 * 1024);
                var threads = proc.Threads.Count;
                var cpuSeconds = proc.TotalProcessorTime.TotalSeconds;

                var elapsed = _lastSampleUtc is null ? 0 : (now - _lastSampleUtc.Value).TotalSeconds;
                var cpuPercent = ComputeCpuPercent(cpuSeconds, _lastCpuSeconds, elapsed, Environment.ProcessorCount);
                _lastCpuSeconds = cpuSeconds;
                _lastSampleUtc = now;

                var entity = new ContainerStatusEntity
                {
                    PartitionKey = "STATUS",
                    RowKey = _name,
                    LastHeartbeatUtc = now,
                    StartedAtUtc = _startedAt,
                    Version = _version,
                    WorkingSetMb = ws,
                    GcHeapMb = heap,
                    ThreadCount = threads,
                    CpuSecondsTotal = cpuSeconds,
                    CpuPercent = cpuPercent,
                };
                await table.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);

                if (_reporter is not null)
                    await _reporter.ReportAsync(_name, heap, ws, threads, cpuPercent, ct);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Heartbeat failed"); }
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }
}
```

- [ ] **Step 4: Wire token/url/HttpClient + reporter in Program.cs**

In `Lovecraft.NotificationsWorker/Program.cs`, replace the existing `ContainerHeartbeatWorker` registration (the `builder.Services.AddHostedService(sp => new ContainerHeartbeatWorker(...))` block near the end) with one that reads the service token + backend URL and passes a reporter:

```csharp
        var serviceToken = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_TOKEN");
        var backendUrl = Environment.GetEnvironmentVariable("BACKEND_INTERNAL_URL") ?? "http://backend:8080";
        builder.Services.AddHostedService(sp =>
        {
            ContainerMetricsReporter? reporter = null;
            if (!string.IsNullOrEmpty(serviceToken))
            {
                var client = new HttpClient { BaseAddress = new Uri(backendUrl) };
                reporter = new ContainerMetricsReporter(client, serviceToken,
                    sp.GetRequiredService<ILogger<ContainerMetricsReporter>>());
            }
            return new ContainerHeartbeatWorker(
                sp.GetRequiredService<TableServiceClient>(),
                sp.GetRequiredService<ILogger<ContainerHeartbeatWorker>>(),
                "notifications-worker",
                reporter);
        });
```

(The `using Lovecraft.NotificationsWorker;` for `ContainerMetricsReporter` and `using Microsoft.Extensions.Logging;` should already be present or add them.)

- [ ] **Step 5: Build + full backend suite**

Run: `dotnet build Lovecraft.NotificationsWorker` then `dotnet test Lovecraft.UnitTests`
Expected: build clean; the FULL suite passes (this is the last backend task — confirm no regressions across all projects).

- [ ] **Step 6: Commit**

```bash
git -C "D:\src\lovecraft" add Lovecraft/Lovecraft.NotificationsWorker/Entities/ContainerStatusEntity.cs Lovecraft/Lovecraft.NotificationsWorker/ContainerMetricsReporter.cs Lovecraft/Lovecraft.NotificationsWorker/Workers/ContainerHeartbeatWorker.cs Lovecraft/Lovecraft.NotificationsWorker/Program.cs
git -C "D:\src\lovecraft" commit -m "feat(metrics): notifications-worker computes CPU% + pushes gauges to backend"
```

---

## Task 8: Frontend adminApi — types + `getContainerTimeseries`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\adminApi.ts`

- [ ] **Step 1: Add `cpuPercent` to `ContainerStatusDto`**

In the `ContainerStatusDto` interface, add after `threadCount`:

```typescript
  cpuPercent: number | null;
```

- [ ] **Step 2: Add gauge timeseries types**

Add near the other metrics types:

```typescript
export interface GaugeTimeseriesPointDto {
  ts: string;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface ContainerTimeseriesDto {
  heapMb: GaugeTimeseriesPointDto[];
  workingSetMb: GaugeTimeseriesPointDto[];
  threadCount: GaugeTimeseriesPointDto[];
  cpuPercent: GaugeTimeseriesPointDto[];
}
```

- [ ] **Step 3: Add `getContainerTimeseries` to the `metrics` namespace**

Add after `getEndpointTimeseries`:

```typescript
    async getContainerTimeseries(params: {
      container: string;
      from: string;
      to: string;
      resolution: 'minute' | 'hour';
    }): Promise<ApiResponse<ContainerTimeseriesDto>> {
      if (!isApiMode()) {
        const sample = (base: number): GaugeTimeseriesPointDto[] =>
          Array.from({ length: 6 }, (_, i) => ({
            ts: new Date(Date.now() - (5 - i) * 60_000).toISOString(),
            avg: base + i,
            min: base + i - 2,
            max: base + i + 3,
          }));
        return {
          success: true,
          data: {
            heapMb: sample(40),
            workingSetMb: sample(140),
            threadCount: sample(22),
            cpuPercent: sample(5),
          } as ContainerTimeseriesDto,
          timestamp: new Date().toISOString(),
        };
      }
      const q = new URLSearchParams({
        container: params.container,
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });
      return apiClient.get<ContainerTimeseriesDto>(`/api/v1/admin/metrics/container-timeseries?${q}`);
    },
```

- [ ] **Step 4: Type-check**

Run (from `D:\src\aloevera-harmony-meet`): `npx tsc -b`
Expected: errors only in `ContainerStatusTable.tsx` if it positionally relies on the DTO (it accesses fields by name, so likely none) and the known pre-existing unrelated files. No errors inside `adminApi.ts`. Report which files error.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/services/api/adminApi.ts
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): add cpuPercent + container-timeseries types/method to adminApi"
```

---

## Task 9: `GaugeBandChart` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\GaugeBandChart.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\__tests__\GaugeBandChart.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/GaugeBandChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GaugeBandChart } from '../GaugeBandChart';

describe('GaugeBandChart', () => {
  it('shows an empty state when there are no points', () => {
    render(<GaugeBandChart points={[]} />);
    expect(screen.getByText('No data.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/components/metrics/__tests__/GaugeBandChart.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Create the component**

Create `GaugeBandChart.tsx`:

```tsx
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { GaugeTimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: GaugeTimeseriesPointDto[];
  unit?: string;
}

export function GaugeBandChart({ points, unit }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No data.</div>;
  }

  // Recharts stacks Areas: render the min as a transparent base, then (max - min) as the band.
  const data = points.map((p) => ({
    ts: p.ts,
    avg: p.avg ?? 0,
    bandBase: p.min ?? 0,
    bandSpan: (p.max ?? 0) - (p.min ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} unit={unit} />
        <Tooltip formatter={(v: number) => (unit ? `${Math.round(v)} ${unit}` : `${Math.round(v)}`)} />
        <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="none" />
        <Area type="monotone" dataKey="bandSpan" stackId="band" stroke="none" fill="#8884d8" fillOpacity={0.15} />
        <Line type="monotone" dataKey="avg" stroke="#8884d8" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/admin/components/metrics/__tests__/GaugeBandChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/components/metrics/GaugeBandChart.tsx src/admin/components/metrics/__tests__/GaugeBandChart.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): add GaugeBandChart (avg line + min/max band)"
```

---

## Task 10: `ContainerStatusTable` — CPU column + accordion drill-down

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\ContainerStatusTable.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\components\metrics\__tests__\ContainerStatusTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/ContainerStatusTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContainerStatusTable } from '../ContainerStatusTable';
import type { ContainerStatusDto } from '@/services/api/adminApi';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    (<div style={{ width: 400, height: 160 }}>{children}</div>) };
});

const containers: ContainerStatusDto[] = [
  { name: 'backend', status: 'green', heartbeatAgeSeconds: 12, gcHeapMb: 38, workingSetMb: 142,
    threadCount: 24, cpuPercent: 5, note: null, startedAtUtc: null, version: '1.0' },
];

const emptySeries = { heapMb: [], workingSetMb: [], threadCount: [], cpuPercent: [] };

describe('ContainerStatusTable', () => {
  it('renders a CPU % column value', () => {
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer={null} onToggle={() => {}} series={null} seriesLoading={false} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onToggle with the container name when a row is clicked', () => {
    const onToggle = vi.fn();
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer={null} onToggle={onToggle} series={null} seriesLoading={false} />);
    fireEvent.click(screen.getByText('backend'));
    expect(onToggle).toHaveBeenCalledWith('backend');
  });

  it('renders the chart grid when the row is expanded', () => {
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer="backend" onToggle={() => {}} series={emptySeries} seriesLoading={false} />);
    expect(screen.getByText('Heap MB')).toBeInTheDocument();
    expect(screen.getByText('CPU %')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/components/metrics/__tests__/ContainerStatusTable.test.tsx`
Expected: FAIL (props `expandedContainer`/`onToggle`/`series`/`seriesLoading` don't exist; no CPU column; no chart grid).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `ContainerStatusTable.tsx` with:

```tsx
import type { ContainerStatusDto, ContainerTimeseriesDto } from '@/services/api/adminApi';
import { GaugeBandChart } from './GaugeBandChart';

interface Props {
  containers: ContainerStatusDto[];
  loading: boolean;
  expandedContainer: string | null;
  onToggle: (name: string) => void;
  series: ContainerTimeseriesDto | null;
  seriesLoading: boolean;
}

function dotColor(status: string) {
  if (status === 'green') return 'bg-green-500';
  if (status === 'amber') return 'bg-amber-500';
  return 'bg-red-500';
}

export function ContainerStatusTable({
  containers, loading, expandedContainer, onToggle, series, seriesLoading,
}: Props) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (containers.length === 0) {
    return <div className="text-sm text-muted-foreground">No container data.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-2 pr-4">Name</th>
          <th className="pr-4">Status</th>
          <th className="pr-4">Last seen</th>
          <th className="pr-4">Heap MB</th>
          <th className="pr-4">WS MB</th>
          <th className="pr-4">Threads</th>
          <th>CPU %</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => {
          const expanded = c.name === expandedContainer;
          return [
            <tr
              key={c.name}
              onClick={() => onToggle(c.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(c.name); }
              }}
              tabIndex={0}
              aria-expanded={expanded}
              className={`border-t border-border cursor-pointer hover:bg-muted/50 ${expanded ? 'bg-muted' : ''}`}
            >
              <td className="py-2 pr-4 font-medium">
                <span className="inline-block mr-1 text-muted-foreground">{expanded ? '▾' : '▸'}</span>
                {c.name}
              </td>
              <td className="pr-4">
                <span className={`inline-block w-2 h-2 rounded-full ${dotColor(c.status)} mr-2`} />
                {c.note ?? c.status}
              </td>
              <td className="pr-4">
                {c.heartbeatAgeSeconds !== null ? `${Math.round(c.heartbeatAgeSeconds)}s ago` : '—'}
              </td>
              <td className="pr-4">{c.gcHeapMb ?? '—'}</td>
              <td className="pr-4">{c.workingSetMb ?? '—'}</td>
              <td className="pr-4">{c.threadCount ?? '—'}</td>
              <td>{c.cpuPercent !== null ? Math.round(c.cpuPercent) : '—'}</td>
            </tr>,
            expanded ? (
              <tr key={`${c.name}-detail`} className="border-t border-border bg-muted/30">
                <td colSpan={7} className="p-3">
                  {seriesLoading && !series ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Heap MB</p>
                        <GaugeBandChart points={series?.heapMb ?? []} unit="MB" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Working set MB</p>
                        <GaugeBandChart points={series?.workingSetMb ?? []} unit="MB" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Threads</p>
                        <GaugeBandChart points={series?.threadCount ?? []} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">CPU %</p>
                        <GaugeBandChart points={series?.cpuPercent ?? []} unit="%" />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run, verify PASS + type-check**

Run: `npx vitest run src/admin/components/metrics/__tests__/ContainerStatusTable.test.tsx`
Expected: PASS (3 tests). Then `npx tsc -b` — confirm `ContainerStatusTable.tsx` clean (ignore known pre-existing unrelated errors).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/components/metrics/ContainerStatusTable.tsx src/admin/components/metrics/__tests__/ContainerStatusTable.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): CPU column + accordion chart drill-down in ContainerStatusTable"
```

---

## Task 11: `AdminMetricsPage` — wire container drill-down state

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\admin\pages\AdminMetricsPage.tsx`
- Test: `D:\src\aloevera-harmony-meet\src\admin\pages\__tests__\AdminMetricsPage.test.tsx`

- [ ] **Step 1: Update the test mock + add a drill-down test**

In `AdminMetricsPage.test.tsx`, add to the `vi.mock('@/services/api/adminApi', ...)` metrics block:

```tsx
      getContainerTimeseries: vi.fn().mockResolvedValue({
        success: true,
        data: { heapMb: [], workingSetMb: [], threadCount: [], cpuPercent: [] },
      }),
```

Ensure the `getContainers` mock includes `cpuPercent` on its rows (add `cpuPercent: 5,` to the `backend` row and `cpuPercent: null,` to the `frontend` row).

Append this test inside the `describe` block:

```tsx
  it('expands a container row and fetches its timeseries', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    renderPage();
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument());

    fireEvent.click(screen.getByText('backend'));

    await waitFor(() =>
      expect((adminApi as any).metrics.getContainerTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ container: 'backend' }),
      ),
    );
  });
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx`
Expected: FAIL (page passes no expand props to `ContainerStatusTable`; `getContainerTimeseries` not called).

- [ ] **Step 3: Wire the state into the page**

In `AdminMetricsPage.tsx`:

(a) Add imports/type: ensure `ContainerTimeseriesDto` is imported from adminApi.

(b) Add state + refs near the other state:

```tsx
  const [expandedContainer, setExpandedContainer] = useState<string | null>(null);
  const [containerSeries, setContainerSeries] = useState<ContainerTimeseriesDto | null>(null);
  const [containerSeriesLoading, setContainerSeriesLoading] = useState(false);
  const expandedContainerRef = useRef(expandedContainer);
  expandedContainerRef.current = expandedContainer;
```

(c) Add a fetch helper (mirrors `fetchEndpointSeries`, with the same stale-response guard):

```tsx
  const fetchContainerSeries = useCallback(async (container: string, currentRange: Range) => {
    const from = new Date(Date.now() - rangeMs(currentRange)).toISOString();
    const to = new Date().toISOString();
    setContainerSeriesLoading(true);
    const res = await adminApi.metrics.getContainerTimeseries({
      container, from, to, resolution: resolutionFor(currentRange),
    });
    if (res.success && res.data && expandedContainerRef.current === container) {
      setContainerSeries(res.data);
    }
    setContainerSeriesLoading(false);
  }, []);
```

(d) In `fetchAll`, after the existing selected-endpoint refresh, also refresh the expanded container if one is open:

```tsx
    const openContainer = expandedContainerRef.current;
    if (openContainer) await fetchContainerSeries(openContainer, currentRange);
```
Add `fetchContainerSeries` to the `fetchAll` `useCallback` dependency array.

(e) In the range-change `useEffect`, reset the container drill-down too:

```tsx
    setExpandedContainer(null);
    setContainerSeries(null);
```

(f) Add the toggle handler:

```tsx
  const handleContainerToggle = useCallback((name: string) => {
    setExpandedContainer((prev) => {
      if (prev === name) { setContainerSeries(null); return null; }
      setContainerSeries(null);
      void fetchContainerSeries(name, rangeRef.current);
      return name;
    });
  }, [fetchContainerSeries]);
```

(g) Update the `<ContainerStatusTable .../>` usage to pass the new props:

```tsx
          <ContainerStatusTable
            containers={containers}
            loading={loading}
            expandedContainer={expandedContainer}
            onToggle={handleContainerToggle}
            series={containerSeries}
            seriesLoading={containerSeriesLoading}
          />
```

- [ ] **Step 4: Run, verify PASS + type-check + full suite**

Run: `npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx` (passes), then `npx tsc -b` (AdminMetricsPage.tsx clean; ignore known pre-existing), then `npm run test:run` (full suite, no regressions).

- [ ] **Step 5: Commit**

```bash
git -C "D:\src\aloevera-harmony-meet" add src/admin/pages/AdminMetricsPage.tsx src/admin/pages/__tests__/AdminMetricsPage.test.tsx
git -C "D:\src\aloevera-harmony-meet" commit -m "feat(metrics): wire container drill-down state into AdminMetricsPage"
```

---

## Task 12: Documentation

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docs\MONITORING.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\MONITORING.md`

- [ ] **Step 1: Frontend MONITORING.md**

(a) In the "API endpoints" table, after the `endpoint-timeseries` row, add:

```
| `GET` | `/api/v1/admin/metrics/container-timeseries` | admin | Per-container gauge series avg/min/max (`?container=&from=&to=&resolution=`) |
```

(b) In the "What gets collected" `container_stats` row, append `, cpu_percent` to the dimension-key list, and add a bullet under "Known follow-ups":

```
- **Container drill-down + CPU (shipped 2026-05-28).** A normalized CPU% (0–100% of all cores, derived from Δprocessor-seconds) is collected by all three .NET containers; the two worker containers POST heap/WS/threads/CPU samples to the backend's `POST /api/v1/internal/metrics/container-stats` (service-token) so all accumulate history (starting at deploy; `frontend` has none). Clicking a container row in the status table expands a 2×2 chart grid (avg line + min/max band) fed by `container-timeseries`. Gauge charts use Sum/Count/Min/Max, NOT the latency-tuned histogram percentiles.
```

- [ ] **Step 2: Backend MONITORING.md**

(a) In the "Endpoints" table, after `endpoint-timeseries`, add:

```
| `GET` | `/admin/metrics/container-timeseries` | admin | Per-container gauge series avg/min/max (`?container=&from=&to=&resolution=`) |
```

(b) Append a paragraph to the "Critical lesson learned: Azure PK/RK constraints" section (or the route-normalization paragraph block):

```
**Container CPU + worker time-series (2026-05-28):** All three .NET heartbeat workers derive a normalized CPU% (0–100% of all cores) from Δ`TotalProcessorTime` and record `container_stats {container}|cpu_percent`. Only `backend` records `container_stats` in-process; `telegram-bot` and `notifications-worker` POST their samples to `POST /api/v1/internal/metrics/container-stats` (`[RequireServiceToken]`), which forwards to the shared collector — preserving worker-process isolation. The `container-timeseries` admin endpoint reads `SumMs/Count/MinMs/MaxMs` (avg/min/max), NOT histogram percentiles, because the buckets are latency-tuned and meaningless for MB/threads/% gauges.
```

- [ ] **Step 3: Commit both**

```bash
git -C "D:\src\aloevera-harmony-meet" add docs/MONITORING.md
git -C "D:\src\aloevera-harmony-meet" commit -m "docs(metrics): document container drill-down + CPU metric"
git -C "D:\src\lovecraft" add Lovecraft/docs/MONITORING.md
git -C "D:\src\lovecraft" commit -m "docs(metrics): document container CPU + worker time-series ingest"
```

---

## Final verification

- [ ] **Backend full suite** — from `D:\src\lovecraft\Lovecraft`: `dotnet test Lovecraft.UnitTests` → all pass. Also `dotnet build Lovecraft.TelegramBot` + `dotnet build Lovecraft.NotificationsWorker` build clean.
- [ ] **Frontend** — from `D:\src\aloevera-harmony-meet`: `npx tsc -b` (only known pre-existing unrelated errors) + `npm run test:run` (all pass).
- [ ] **Manual smoke (optional, API mode):** open `/admin/metrics`, confirm a CPU % column; click a container row → 2×2 chart grid expands; click again → collapses; switching range collapses the drill-down. `frontend` row → empty charts.
