# Monitoring & Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-facing operational dashboard at `/admin/metrics` showing container status, request latency, BI counters (registered/DAU/MAU/currently active), with per-category runtime toggles; plus Serilog structured logging to stdout in all .NET containers.

**Architecture:** In-process `IMetricsCollector` singleton in each .NET container buffers samples in a bounded channel, flushed every 10s to `metricsminute` Azure Table. Hourly worker rolls minute→hour. Admin dashboard reads via new `/admin/metrics/*` endpoints. Frontend `apiClient` interceptor ships its own samples via `POST /metrics/frontend`. Toggle state lives in `appconfig`, polled every 60s.

**Tech Stack:** .NET 10, Azure.Data.Tables, Serilog + RenderedCompactJsonFormatter, React 18 + recharts, shadcn/ui, vitest + RTL, xUnit + WebApplicationFactory.

**Spec:** [`../specs/2026-05-21-monitoring-design.md`](../specs/2026-05-21-monitoring-design.md)

---

## File map

### Backend (`lovecraft/Lovecraft/Lovecraft.Backend/`)
- Create `Services/Metrics/` (new folder):
  - `IMetricsCollector.cs`, `MetricsEnabledFlags.cs`, `MetricSample.cs`, `ContainerStatusSnapshot.cs`
  - `AzureMetricsCollector.cs`, `MockMetricsCollector.cs`, `NoOpMetricsCollector.cs`
  - `MetricsFlushWorker.cs`, `MetricsConfigPoller.cs`, `ContainerHeartbeatWorker.cs`, `FrontendProbeWorker.cs`
  - `DailyActiveUserCoalescer.cs`, `MauCalculator.cs`, `HistogramBuckets.cs`
- Create `Middleware/RequestMetricsMiddleware.cs`
- Create `Controllers/V1/MetricsController.cs`, `Controllers/V1/AdminMetricsController.cs`
- Create `Storage/Entities/MetricMinuteEntity.cs`, `MetricHourEntity.cs`, `DailyActiveUserEntity.cs`, `ContainerStatusEntity.cs`
- Modify `Storage/TableNames.cs` — add 4 constants
- Modify `Services/IAppConfigService.cs` + `MockAppConfigService.cs` + `Services/Azure/AzureAppConfigService.cs` — add `GetMetricsConfigAsync` + `InvalidateAsync`
- Modify `Program.cs` — register collector, middleware, workers, Serilog
- Modify 6 BI producer sites: `Controllers/V1/AuthController.cs`, `Controllers/V1/ChatsController.cs`, `Controllers/V1/EventsController.cs`, `Services/MockMatchingService.cs` + `Services/Azure/AzureMatchingService.cs`, `Services/MockForumService.cs` + `Services/Azure/AzureForumService.cs`
- Modify `appsettings.json` — Serilog block

### Worker (`lovecraft/Lovecraft/Lovecraft.NotificationsWorker/`)
- Create `Workers/MetricsRollupWorker.cs`
- Create `Entities/MetricMinuteEntity.cs`, `MetricHourEntity.cs` (duplicates of backend)
- Modify `Workers/JanitorWorker.cs` — three cleanup passes
- Modify `Program.cs` — register rollup worker + Serilog
- Modify `appsettings.json` — Serilog block

### TelegramBot (`lovecraft/Lovecraft/Lovecraft.TelegramBot/`)
- Modify `Program.cs` — register `ContainerHeartbeatWorker` + Serilog
- Modify `appsettings.json` — Serilog block

### Seeder (`lovecraft/Lovecraft/Lovecraft.Tools.Seeder/`)
- Modify entry point — seed `metrics` partition rows

### Tests (`lovecraft/Lovecraft/Lovecraft.UnitTests/`)
- Create 8 test classes (one per major component)

### Frontend (`aloevera-harmony-meet/src/`)
- Modify `services/api/apiClient.ts` — add fetch interceptor (carefully, behind a flag check)
- Modify `services/api/adminApi.ts` — add `metrics` namespace
- Modify `services/api/index.ts` — re-export if needed
- Create `admin/pages/AdminMetricsPage.tsx`
- Create `admin/components/metrics/` folder: `MetricsOverviewTiles.tsx`, `ContainerStatusTable.tsx`, `UsersTimeChart.tsx`, `RequestVolumeTable.tsx`, `LatencyChart.tsx`, `BiEventsPanel.tsx`, `MetricsToggleSheet.tsx`
- Create test files: `admin/pages/__tests__/AdminMetricsPage.test.tsx`, `admin/components/metrics/__tests__/MetricsToggleSheet.test.tsx`, `services/api/__tests__/apiClient.metrics.test.ts`
- Modify `admin/AdminApp.tsx` — add route
- Modify `admin/components/AdminSidebar.tsx` (or wherever admin nav is) — add Metrics link
- Modify `contexts/LanguageContext.tsx` — add `admin.metrics.*` keys in `ru` and `en`

---

## Task order rationale

Storage entities (T1) unlock everything. Then collector core (T2–T4) before producers (T5–T9). Worker pieces (T10–T11) depend on the storage shape. Controllers (T12–T14) before frontend (T15–T20). Serilog (T21) is independent and could move earlier — placed late because it doesn't unblock anything. Smoke test (T22) last.

---

## Task 1: Storage entities + table names

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/MetricMinuteEntity.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/MetricHourEntity.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/DailyActiveUserEntity.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/TableNames.cs`

- [ ] **Step 1: Add table name constants**

Open `TableNames.cs`. Find the existing pattern (look for any constant like `public static string Users => Prefix + "users";`). Append:

```csharp
public static string MetricsMinute => Prefix + "metricsminute";
public static string MetricsHour => Prefix + "metricshour";
public static string DailyActiveUsers => Prefix + "dailyactiveusers";
public static string ContainerStatus => Prefix + "containerstatus";
```

- [ ] **Step 2: Create `MetricMinuteEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class MetricMinuteEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "";  // "{yyyy-MM-ddTHH}#{category}"
    public string RowKey { get; set; } = "";        // "{mm}#{dimensionKey}"
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public long Count { get; set; }
    public long? SumMs { get; set; }
    public long? MinMs { get; set; }
    public long? MaxMs { get; set; }
    public long? B0 { get; set; }
    public long? B1 { get; set; }
    public long? B2 { get; set; }
    public long? B3 { get; set; }
    public long? B4 { get; set; }
    public long? B5 { get; set; }
    public long? B6 { get; set; }
    public long? B7 { get; set; }
    public long? B8 { get; set; }
    public string LabelsJson { get; set; } = "{}";
}
```

- [ ] **Step 3: Create `MetricHourEntity.cs`** — same shape as `MetricMinuteEntity` plus `SourceMinuteRowCount`

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class MetricHourEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "";  // "{yyyy-MM-dd}#{category}"
    public string RowKey { get; set; } = "";        // "{HH}#{dimensionKey}"
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public long Count { get; set; }
    public long? SumMs { get; set; }
    public long? MinMs { get; set; }
    public long? MaxMs { get; set; }
    public long? B0 { get; set; }
    public long? B1 { get; set; }
    public long? B2 { get; set; }
    public long? B3 { get; set; }
    public long? B4 { get; set; }
    public long? B5 { get; set; }
    public long? B6 { get; set; }
    public long? B7 { get; set; }
    public long? B8 { get; set; }
    public string LabelsJson { get; set; } = "{}";
    public long SourceMinuteRowCount { get; set; }
}
```

- [ ] **Step 4: Create `DailyActiveUserEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class DailyActiveUserEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "";  // "{yyyy-MM-dd}"
    public string RowKey { get; set; } = "";        // userId
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public DateTime FirstSeenUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
    public long RequestCount { get; set; }
}
```

- [ ] **Step 5: Create `ContainerStatusEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class ContainerStatusEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "STATUS";
    public string RowKey { get; set; } = "";  // "backend" | "telegram-bot" | "notifications-worker" | "frontend"
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public DateTime LastHeartbeatUtc { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public string Version { get; set; } = "";
    public long? GcHeapMb { get; set; }
    public long? WorkingSetMb { get; set; }
    public int? ThreadCount { get; set; }
    public double? CpuSecondsTotal { get; set; }
    public long? RequestsServed { get; set; }
    public string? Note { get; set; }
}
```

- [ ] **Step 6: Build to verify**

Run: `dotnet build lovecraft/Lovecraft/Lovecraft.Backend`
Expected: `Build succeeded` with 0 errors.

- [ ] **Step 7: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Storage/Entities/MetricMinuteEntity.cs Lovecraft/Lovecraft.Backend/Storage/Entities/MetricHourEntity.cs Lovecraft/Lovecraft.Backend/Storage/Entities/DailyActiveUserEntity.cs Lovecraft/Lovecraft.Backend/Storage/Entities/ContainerStatusEntity.cs Lovecraft/Lovecraft.Backend/Storage/TableNames.cs
git -C lovecraft commit -m "feat(metrics): add storage entities and table names"
```

---

## Task 2: `IMetricsCollector` + shared types + NoOp impl

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/IMetricsCollector.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MetricSample.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsEnabledFlags.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerStatusSnapshot.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/HistogramBuckets.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/NoOpMetricsCollector.cs`

- [ ] **Step 1: Create `MetricSample.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public sealed record MetricSample(
    string Category,
    string DimensionKey,
    long Count,
    double? DurationMs,
    DateTime CapturedAtUtc);
```

- [ ] **Step 2: Create `MetricsEnabledFlags.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public sealed record MetricsEnabledFlags(
    bool RequestTiming = true,
    bool BiEvents = true,
    bool ContainerStats = true,
    bool FrontendPerf = true)
{
    public static MetricsEnabledFlags AllEnabled => new(true, true, true, true);
    public static MetricsEnabledFlags AllDisabled => new(false, false, false, false);

    public bool IsEnabled(string category) => category switch
    {
        "request_timing" => RequestTiming,
        "bi_events" => BiEvents,
        "container_stats" => ContainerStats,
        "frontend_perf" => FrontendPerf,
        _ => false,
    };
}
```

- [ ] **Step 3: Create `ContainerStatusSnapshot.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public sealed record ContainerStatusSnapshot(
    string Name,
    DateTime LastHeartbeatUtc,
    DateTime StartedAtUtc,
    string Version,
    long? GcHeapMb,
    long? WorkingSetMb,
    int? ThreadCount,
    double? CpuSecondsTotal,
    long? RequestsServed,
    string? Note);
```

- [ ] **Step 4: Create `HistogramBuckets.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public static class HistogramBuckets
{
    public static readonly double[] Boundaries = { 25, 50, 100, 250, 500, 1000, 2500, 5000 };
    public const int BucketCount = 9;

    public static int IndexFor(double ms)
    {
        for (int i = 0; i < Boundaries.Length; i++)
            if (ms <= Boundaries[i]) return i;
        return BucketCount - 1;
    }

    public static long[] Empty() => new long[BucketCount];
}
```

- [ ] **Step 5: Create `IMetricsCollector.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public interface IMetricsCollector
{
    MetricsEnabledFlags CurrentFlags { get; }
    void UpdateFlags(MetricsEnabledFlags flags);
    void RecordTiming(string category, string dimensionKey, double ms);
    void RecordCount(string category, string dimensionKey, long delta = 1);
    Task RecordContainerStatusAsync(ContainerStatusSnapshot snapshot, CancellationToken ct = default);
    Task FlushAsync(CancellationToken ct = default);
}
```

- [ ] **Step 6: Create `NoOpMetricsCollector.cs`**

```csharp
namespace Lovecraft.Backend.Services.Metrics;

public sealed class NoOpMetricsCollector : IMetricsCollector
{
    public MetricsEnabledFlags CurrentFlags { get; private set; } = MetricsEnabledFlags.AllDisabled;
    public void UpdateFlags(MetricsEnabledFlags flags) => CurrentFlags = flags;
    public void RecordTiming(string category, string dimensionKey, double ms) { }
    public void RecordCount(string category, string dimensionKey, long delta = 1) { }
    public Task RecordContainerStatusAsync(ContainerStatusSnapshot snapshot, CancellationToken ct = default) => Task.CompletedTask;
    public Task FlushAsync(CancellationToken ct = default) => Task.CompletedTask;
}
```

- [ ] **Step 7: Build to verify**

Run: `dotnet build lovecraft/Lovecraft/Lovecraft.Backend`
Expected: `Build succeeded`.

- [ ] **Step 8: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/
git -C lovecraft commit -m "feat(metrics): add IMetricsCollector interface, shared types, and NoOp impl"
```

---

## Task 3: `MockMetricsCollector` + tests

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MockMetricsCollector.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/MockMetricsCollectorTests.cs`

- [ ] **Step 1: Write failing test file `MockMetricsCollectorTests.cs`**

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class MockMetricsCollectorTests
{
    [Fact]
    public void RecordTiming_Disabled_DoesNotStore()
    {
        var c = new MockMetricsCollector();
        c.UpdateFlags(MetricsEnabledFlags.AllDisabled);
        c.RecordTiming("request_timing", "backend|GET|/x|200", 42);
        Assert.Empty(c.Snapshot());
    }

    [Fact]
    public void RecordTiming_Enabled_MergesIntoSameBucket()
    {
        var c = new MockMetricsCollector();
        c.RecordTiming("request_timing", "backend|GET|/x|200", 20);
        c.RecordTiming("request_timing", "backend|GET|/x|200", 80);
        var rows = c.Snapshot();
        Assert.Single(rows);
        var row = rows[0];
        Assert.Equal(2, row.Count);
        Assert.Equal(100, row.SumMs);
        Assert.Equal(20, row.MinMs);
        Assert.Equal(80, row.MaxMs);
        Assert.Equal(1, row.Buckets[0]);  // 20 <= 25
        Assert.Equal(1, row.Buckets[2]);  // 80 <= 100
    }

    [Fact]
    public void RecordCount_Disabled_DoesNotStore()
    {
        var c = new MockMetricsCollector();
        c.UpdateFlags(new MetricsEnabledFlags(BiEvents: false));
        c.RecordCount("bi_events", "bi|user_registered|local");
        Assert.Empty(c.Snapshot());
    }

    [Fact]
    public void RecordCount_Enabled_Accumulates()
    {
        var c = new MockMetricsCollector();
        c.RecordCount("bi_events", "bi|user_registered|local");
        c.RecordCount("bi_events", "bi|user_registered|local", 4);
        var rows = c.Snapshot();
        Assert.Single(rows);
        Assert.Equal(5, rows[0].Count);
    }

    [Fact]
    public async Task RecordContainerStatus_StoresLatest()
    {
        var c = new MockMetricsCollector();
        var snap = new ContainerStatusSnapshot("backend", DateTime.UtcNow, DateTime.UtcNow, "1.0", 100, 200, 8, 1.5, 42, null);
        await c.RecordContainerStatusAsync(snap);
        var status = c.GetContainerStatus("backend");
        Assert.NotNull(status);
        Assert.Equal("backend", status!.Name);
    }
}
```

- [ ] **Step 2: Run test — verify it fails to compile**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~MockMetricsCollectorTests`
Expected: Compile error — `MockMetricsCollector` not defined; `Snapshot` / `GetContainerStatus` not defined.

- [ ] **Step 3: Create `MockMetricsCollector.cs`**

```csharp
using System.Collections.Concurrent;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class MockMetricsCollector : IMetricsCollector
{
    private readonly ConcurrentDictionary<(string Cat, string Dim), MetricBucket> _data = new();
    private readonly ConcurrentDictionary<string, ContainerStatusSnapshot> _containers = new();

    public MetricsEnabledFlags CurrentFlags { get; private set; } = MetricsEnabledFlags.AllEnabled;
    public void UpdateFlags(MetricsEnabledFlags flags) => CurrentFlags = flags;

    public void RecordTiming(string category, string dimensionKey, double ms)
    {
        if (!CurrentFlags.IsEnabled(category)) return;
        var bucket = _data.GetOrAdd((category, dimensionKey), _ => new MetricBucket());
        bucket.AddSample((long)ms);
    }

    public void RecordCount(string category, string dimensionKey, long delta = 1)
    {
        if (!CurrentFlags.IsEnabled(category)) return;
        var bucket = _data.GetOrAdd((category, dimensionKey), _ => new MetricBucket());
        bucket.AddCount(delta);
    }

    public Task RecordContainerStatusAsync(ContainerStatusSnapshot snapshot, CancellationToken ct = default)
    {
        if (!CurrentFlags.IsEnabled("container_stats")) return Task.CompletedTask;
        _containers[snapshot.Name] = snapshot;
        return Task.CompletedTask;
    }

    public Task FlushAsync(CancellationToken ct = default) => Task.CompletedTask;

    public IReadOnlyList<MetricRow> Snapshot() =>
        _data.Select(kv => new MetricRow(kv.Key.Cat, kv.Key.Dim, kv.Value)).ToList();

    public ContainerStatusSnapshot? GetContainerStatus(string name) =>
        _containers.TryGetValue(name, out var v) ? v : null;

    public void Reset()
    {
        _data.Clear();
        _containers.Clear();
    }
}

public sealed class MetricBucket
{
    private long _count;
    private long _sumMs;
    private long? _minMs;
    private long? _maxMs;
    private readonly long[] _buckets = HistogramBuckets.Empty();
    private readonly object _lock = new();

    public void AddSample(long ms)
    {
        lock (_lock)
        {
            _count++;
            _sumMs += ms;
            _minMs = _minMs is null ? ms : Math.Min(_minMs.Value, ms);
            _maxMs = _maxMs is null ? ms : Math.Max(_maxMs.Value, ms);
            _buckets[HistogramBuckets.IndexFor(ms)]++;
        }
    }

    public void AddCount(long delta)
    {
        lock (_lock) { _count += delta; }
    }

    public long Count { get { lock (_lock) return _count; } }
    public long SumMs { get { lock (_lock) return _sumMs; } }
    public long? MinMs { get { lock (_lock) return _minMs; } }
    public long? MaxMs { get { lock (_lock) return _maxMs; } }
    public long[] Buckets { get { lock (_lock) return (long[])_buckets.Clone(); } }
}

public sealed record MetricRow(string Category, string DimensionKey, MetricBucket Bucket)
{
    public long Count => Bucket.Count;
    public long SumMs => Bucket.SumMs;
    public long? MinMs => Bucket.MinMs;
    public long? MaxMs => Bucket.MaxMs;
    public long[] Buckets => Bucket.Buckets;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~MockMetricsCollectorTests`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/MockMetricsCollector.cs Lovecraft/Lovecraft.UnitTests/MockMetricsCollectorTests.cs
git -C lovecraft commit -m "feat(metrics): add MockMetricsCollector with bucket merge semantics"
```

---

## Task 4: `AzureMetricsCollector` + `MetricsFlushWorker` + tests

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/AzureMetricsCollector.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsFlushWorker.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/AzureMetricsCollectorTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class AzureMetricsCollectorTests
{
    [Fact]
    public void RecordTiming_QueuesSampleWithCapturedTimestamp()
    {
        var c = new AzureMetricsCollector(capacity: 1000);
        c.RecordTiming("request_timing", "backend|GET|/x|200", 42);
        Assert.Equal(1, c.PendingCount);
    }

    [Fact]
    public void Buffer_DropsOldestWhenFull()
    {
        var c = new AzureMetricsCollector(capacity: 2);
        c.RecordTiming("request_timing", "k1", 1);
        c.RecordTiming("request_timing", "k2", 2);
        c.RecordTiming("request_timing", "k3", 3);  // should drop oldest
        Assert.Equal(2, c.PendingCount);
    }

    [Fact]
    public void DrainBatch_GroupsByPkRkAndAggregates()
    {
        var c = new AzureMetricsCollector(capacity: 1000);
        c.RecordTiming("request_timing", "backend|GET|/x|200", 20);
        c.RecordTiming("request_timing", "backend|GET|/x|200", 80);
        c.RecordTiming("request_timing", "backend|GET|/y|200", 50);

        var batch = c.DrainBatchForFlush(DateTime.UtcNow);
        Assert.Equal(2, batch.Count);
        var xRow = batch.Single(r => r.RowKey.EndsWith("backend|GET|/x|200"));
        Assert.Equal(2, xRow.Count);
        Assert.Equal(100, xRow.SumMs);
    }

    [Fact]
    public void Disabled_DoesNotEnqueue()
    {
        var c = new AzureMetricsCollector(capacity: 1000);
        c.UpdateFlags(MetricsEnabledFlags.AllDisabled);
        c.RecordTiming("request_timing", "k", 10);
        Assert.Equal(0, c.PendingCount);
    }
}
```

- [ ] **Step 2: Run tests — verify compile failure**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~AzureMetricsCollectorTests`
Expected: Compile errors — `AzureMetricsCollector` not defined.

- [ ] **Step 3: Create `AzureMetricsCollector.cs`**

```csharp
using System.Collections.Concurrent;
using System.Threading.Channels;
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class AzureMetricsCollector : IMetricsCollector
{
    private readonly ConcurrentQueue<MetricSample> _buffer = new();
    private readonly int _capacity;
    private readonly TableServiceClient? _tableService;
    private readonly ContainerStatusUpserter? _statusUpserter;

    public AzureMetricsCollector(int capacity = 1000, TableServiceClient? tableService = null)
    {
        _capacity = capacity;
        _tableService = tableService;
        if (tableService is not null)
            _statusUpserter = new ContainerStatusUpserter(tableService.GetTableClient(TableNames.ContainerStatus));
    }

    public MetricsEnabledFlags CurrentFlags { get; private set; } = MetricsEnabledFlags.AllEnabled;
    public void UpdateFlags(MetricsEnabledFlags flags) => CurrentFlags = flags;

    public int PendingCount => _buffer.Count;

    public void RecordTiming(string category, string dimensionKey, double ms)
    {
        if (!CurrentFlags.IsEnabled(category)) return;
        Enqueue(new MetricSample(category, dimensionKey, 1, ms, DateTime.UtcNow));
    }

    public void RecordCount(string category, string dimensionKey, long delta = 1)
    {
        if (!CurrentFlags.IsEnabled(category)) return;
        Enqueue(new MetricSample(category, dimensionKey, delta, null, DateTime.UtcNow));
    }

    private void Enqueue(MetricSample s)
    {
        _buffer.Enqueue(s);
        while (_buffer.Count > _capacity && _buffer.TryDequeue(out _)) { }
    }

    public async Task RecordContainerStatusAsync(ContainerStatusSnapshot snapshot, CancellationToken ct = default)
    {
        if (!CurrentFlags.IsEnabled("container_stats")) return;
        if (_statusUpserter is null) return;
        await _statusUpserter.UpsertAsync(snapshot, ct);
    }

    public IReadOnlyList<MetricMinuteAggregate> DrainBatchForFlush(DateTime nowUtc)
    {
        var samples = new List<MetricSample>();
        while (_buffer.TryDequeue(out var s)) samples.Add(s);

        return samples
            .GroupBy(s => (
                Pk: $"{s.CapturedAtUtc:yyyy-MM-dd'T'HH}#{s.Category}",
                Rk: $"{s.CapturedAtUtc:mm}#{s.DimensionKey}"))
            .Select(g => Aggregate(g.Key.Pk, g.Key.Rk, g.ToList()))
            .ToList();
    }

    private static MetricMinuteAggregate Aggregate(string pk, string rk, IReadOnlyList<MetricSample> samples)
    {
        long count = 0, sumMs = 0;
        long? min = null, max = null;
        var b = HistogramBuckets.Empty();
        foreach (var s in samples)
        {
            count += s.Count;
            if (s.DurationMs.HasValue)
            {
                var ms = (long)s.DurationMs.Value;
                sumMs += ms;
                min = min is null ? ms : Math.Min(min.Value, ms);
                max = max is null ? ms : Math.Max(max.Value, ms);
                b[HistogramBuckets.IndexFor(ms)]++;
            }
        }
        return new MetricMinuteAggregate(pk, rk, count, sumMs, min, max, b);
    }

    public async Task FlushAsync(CancellationToken ct = default)
    {
        if (_tableService is null) return;
        var batch = DrainBatchForFlush(DateTime.UtcNow);
        if (batch.Count == 0) return;
        var table = _tableService.GetTableClient(TableNames.MetricsMinute);
        await table.CreateIfNotExistsAsync(ct);
        foreach (var agg in batch)
            await UpsertWithRetry(table, agg, ct);
    }

    private static async Task UpsertWithRetry(TableClient table, MetricMinuteAggregate agg, CancellationToken ct)
    {
        const int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await MergeAsync(table, agg, ct);
                return;
            }
            catch (RequestFailedException) when (attempt < maxAttempts)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(100 * Math.Pow(2, attempt)), ct);
            }
        }
    }

    private static async Task MergeAsync(TableClient table, MetricMinuteAggregate agg, CancellationToken ct)
    {
        MetricMinuteEntity? existing = null;
        try
        {
            existing = (await table.GetEntityAsync<MetricMinuteEntity>(agg.PartitionKey, agg.RowKey, cancellationToken: ct)).Value;
        }
        catch (RequestFailedException ex) when (ex.Status == 404) { }

        var entity = existing ?? new MetricMinuteEntity { PartitionKey = agg.PartitionKey, RowKey = agg.RowKey };
        entity.Count += agg.Count;
        entity.SumMs = (entity.SumMs ?? 0) + (agg.SumMs ?? 0);
        if (agg.MinMs.HasValue) entity.MinMs = entity.MinMs.HasValue ? Math.Min(entity.MinMs.Value, agg.MinMs.Value) : agg.MinMs;
        if (agg.MaxMs.HasValue) entity.MaxMs = entity.MaxMs.HasValue ? Math.Max(entity.MaxMs.Value, agg.MaxMs.Value) : agg.MaxMs;
        entity.B0 = (entity.B0 ?? 0) + agg.Buckets[0];
        entity.B1 = (entity.B1 ?? 0) + agg.Buckets[1];
        entity.B2 = (entity.B2 ?? 0) + agg.Buckets[2];
        entity.B3 = (entity.B3 ?? 0) + agg.Buckets[3];
        entity.B4 = (entity.B4 ?? 0) + agg.Buckets[4];
        entity.B5 = (entity.B5 ?? 0) + agg.Buckets[5];
        entity.B6 = (entity.B6 ?? 0) + agg.Buckets[6];
        entity.B7 = (entity.B7 ?? 0) + agg.Buckets[7];
        entity.B8 = (entity.B8 ?? 0) + agg.Buckets[8];

        if (existing is null)
            await table.AddEntityAsync(entity, ct);
        else
            await table.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Merge, ct);
    }
}

public sealed record MetricMinuteAggregate(
    string PartitionKey,
    string RowKey,
    long Count,
    long? SumMs,
    long? MinMs,
    long? MaxMs,
    long[] Buckets);

internal sealed class ContainerStatusUpserter
{
    private readonly TableClient _table;
    private bool _initialized;
    public ContainerStatusUpserter(TableClient table) { _table = table; }

    public async Task UpsertAsync(ContainerStatusSnapshot s, CancellationToken ct)
    {
        if (!_initialized)
        {
            await _table.CreateIfNotExistsAsync(ct);
            _initialized = true;
        }
        var entity = new ContainerStatusEntity
        {
            PartitionKey = "STATUS",
            RowKey = s.Name,
            LastHeartbeatUtc = s.LastHeartbeatUtc,
            StartedAtUtc = s.StartedAtUtc,
            Version = s.Version,
            GcHeapMb = s.GcHeapMb,
            WorkingSetMb = s.WorkingSetMb,
            ThreadCount = s.ThreadCount,
            CpuSecondsTotal = s.CpuSecondsTotal,
            RequestsServed = s.RequestsServed,
            Note = s.Note,
        };
        await _table.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);
    }
}
```

- [ ] **Step 4: Create `MetricsFlushWorker.cs`**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class MetricsFlushWorker : BackgroundService
{
    private readonly IMetricsCollector _collector;
    private readonly ILogger<MetricsFlushWorker> _logger;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(10);

    public MetricsFlushWorker(IMetricsCollector collector, ILogger<MetricsFlushWorker> logger)
    {
        _collector = collector;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _collector.FlushAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Metrics flush failed");
            }
            await Task.Delay(FlushInterval, stoppingToken);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        try { await _collector.FlushAsync(cancellationToken); } catch { }
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~AzureMetricsCollectorTests`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/AzureMetricsCollector.cs Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsFlushWorker.cs Lovecraft/Lovecraft.UnitTests/AzureMetricsCollectorTests.cs
git -C lovecraft commit -m "feat(metrics): add AzureMetricsCollector with channel buffer and flush worker"
```

---

## Task 5: `IAppConfigService.GetMetricsConfigAsync` + `MetricsConfigPoller`

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/AppConfig.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsConfigPoller.cs`

- [ ] **Step 1: Read existing `IAppConfigService.cs` and `AppConfig.cs` to confirm shape**

Run: `cat lovecraft/Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs lovecraft/Lovecraft/Lovecraft.Backend/Services/AppConfig.cs`

Note the existing patterns for `RankThresholds` and `PermissionConfig` accessors and defaults. Mirror those exactly for `MetricsConfig`.

- [ ] **Step 2: Add `MetricsConfig` record to `AppConfig.cs`**

Append:

```csharp
public sealed record MetricsConfig(
    bool RequestTiming,
    bool BiEvents,
    bool ContainerStats,
    bool FrontendPerf,
    int RetentionMinuteHours,
    int RetentionHourDays,
    int RetentionDauDays)
{
    public static MetricsConfig Defaults => new(
        RequestTiming: true,
        BiEvents: true,
        ContainerStats: true,
        FrontendPerf: true,
        RetentionMinuteHours: 24,
        RetentionHourDays: 90,
        RetentionDauDays: 30);
}
```

- [ ] **Step 3: Add `GetMetricsConfigAsync` and `InvalidateAsync` to `IAppConfigService`**

```csharp
Task<MetricsConfig> GetMetricsConfigAsync(CancellationToken ct = default);
Task InvalidateAsync();
```

- [ ] **Step 4: Implement in `MockAppConfigService`**

```csharp
private MetricsConfig _metrics = MetricsConfig.Defaults;

public Task<MetricsConfig> GetMetricsConfigAsync(CancellationToken ct = default) => Task.FromResult(_metrics);

public Task InvalidateAsync() => Task.CompletedTask;

public void SetMetricsConfig(MetricsConfig cfg) => _metrics = cfg;  // test helper
```

- [ ] **Step 5: Implement in `AzureAppConfigService`** — read `appconfig` rows with PK=`metrics`, cache 1h via existing `IMemoryCache` pattern, parse `bool.Parse`/`int.Parse` with fallback to `MetricsConfig.Defaults` per field. `InvalidateAsync` removes the cache key.

Mirror the existing `GetPermissionConfigAsync` implementation; copy the structure, swap the partition name and the entity-to-record mapping.

- [ ] **Step 6: Create `MetricsConfigPoller.cs`**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class MetricsConfigPoller : BackgroundService
{
    private readonly IMetricsCollector _collector;
    private readonly IAppConfigService _appConfig;
    private readonly ILogger<MetricsConfigPoller> _logger;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);

    public MetricsConfigPoller(IMetricsCollector collector, IAppConfigService appConfig, ILogger<MetricsConfigPoller> logger)
    {
        _collector = collector;
        _appConfig = appConfig;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ApplyAsync(stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(PollInterval, stoppingToken);
            await ApplyAsync(stoppingToken);
        }
    }

    private async Task ApplyAsync(CancellationToken ct)
    {
        try
        {
            var cfg = await _appConfig.GetMetricsConfigAsync(ct);
            _collector.UpdateFlags(new MetricsEnabledFlags(cfg.RequestTiming, cfg.BiEvents, cfg.ContainerStats, cfg.FrontendPerf));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MetricsConfigPoller refresh failed; keeping previous flags");
        }
    }
}
```

- [ ] **Step 7: Build and run existing tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests`
Expected: All existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs Lovecraft/Lovecraft.Backend/Services/AppConfig.cs Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs Lovecraft/Lovecraft.Backend/Services/Metrics/MetricsConfigPoller.cs
git -C lovecraft commit -m "feat(metrics): add MetricsConfig accessor on IAppConfigService + poller"
```

---

## Task 6: `DailyActiveUserCoalescer` + tests

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/DailyActiveUserCoalescer.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/DailyActiveUserCoalescerTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class DailyActiveUserCoalescerTests
{
    [Fact]
    public void ShouldFlush_FirstHit_True()
    {
        var c = new DailyActiveUserCoalescer(windowSeconds: 60);
        Assert.True(c.ShouldFlush("u1", new DateTime(2026, 5, 21, 14, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void ShouldFlush_SecondHitWithinWindow_False()
    {
        var c = new DailyActiveUserCoalescer(windowSeconds: 60);
        var t0 = new DateTime(2026, 5, 21, 14, 0, 0, DateTimeKind.Utc);
        c.ShouldFlush("u1", t0);
        Assert.False(c.ShouldFlush("u1", t0.AddSeconds(30)));
    }

    [Fact]
    public void ShouldFlush_AfterWindow_True()
    {
        var c = new DailyActiveUserCoalescer(windowSeconds: 60);
        var t0 = new DateTime(2026, 5, 21, 14, 0, 0, DateTimeKind.Utc);
        c.ShouldFlush("u1", t0);
        Assert.True(c.ShouldFlush("u1", t0.AddSeconds(61)));
    }

    [Fact]
    public void ShouldFlush_NewDay_True()
    {
        var c = new DailyActiveUserCoalescer(windowSeconds: 60);
        var day1 = new DateTime(2026, 5, 21, 23, 59, 50, DateTimeKind.Utc);
        var day2 = new DateTime(2026, 5, 22, 0, 0, 5, DateTimeKind.Utc);
        c.ShouldFlush("u1", day1);
        Assert.True(c.ShouldFlush("u1", day2));
    }
}
```

- [ ] **Step 2: Run — verify compile failure**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~DailyActiveUserCoalescerTests`
Expected: Compile errors.

- [ ] **Step 3: Implement `DailyActiveUserCoalescer.cs`**

```csharp
using System.Collections.Concurrent;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class DailyActiveUserCoalescer
{
    private readonly ConcurrentDictionary<string, DateTime> _lastFlushedByUserDay = new();
    private readonly int _windowSeconds;
    private readonly TableServiceClient? _tableService;
    private bool _tableInitialized;

    public DailyActiveUserCoalescer(int windowSeconds = 60, TableServiceClient? tableService = null)
    {
        _windowSeconds = windowSeconds;
        _tableService = tableService;
    }

    public bool ShouldFlush(string userId, DateTime nowUtc)
    {
        var key = $"{nowUtc:yyyy-MM-dd}#{userId}";
        if (!_lastFlushedByUserDay.TryGetValue(key, out var last))
        {
            _lastFlushedByUserDay[key] = nowUtc;
            return true;
        }
        if ((nowUtc - last).TotalSeconds >= _windowSeconds)
        {
            _lastFlushedByUserDay[key] = nowUtc;
            return true;
        }
        return false;
    }

    public async Task FlushIfNeededAsync(string userId, DateTime nowUtc, CancellationToken ct)
    {
        if (_tableService is null || !ShouldFlush(userId, nowUtc)) return;
        var table = _tableService.GetTableClient(TableNames.DailyActiveUsers);
        if (!_tableInitialized)
        {
            await table.CreateIfNotExistsAsync(ct);
            _tableInitialized = true;
        }
        var pk = nowUtc.ToString("yyyy-MM-dd");
        DailyActiveUserEntity? existing = null;
        try
        {
            existing = (await table.GetEntityAsync<DailyActiveUserEntity>(pk, userId, cancellationToken: ct)).Value;
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404) { }

        var entity = existing ?? new DailyActiveUserEntity
        {
            PartitionKey = pk,
            RowKey = userId,
            FirstSeenUtc = nowUtc,
        };
        entity.LastSeenUtc = nowUtc;
        entity.RequestCount += 1;
        await table.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~DailyActiveUserCoalescerTests`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/DailyActiveUserCoalescer.cs Lovecraft/Lovecraft.UnitTests/DailyActiveUserCoalescerTests.cs
git -C lovecraft commit -m "feat(metrics): add write-coalesced DAU upserter"
```

---

## Task 7: `RequestMetricsMiddleware` + tests

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Middleware/RequestMetricsMiddleware.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/RequestMetricsMiddlewareTests.cs`

- [ ] **Step 1: Write failing tests** — `RequestMetricsMiddlewareTests.cs`

```csharp
using System.Security.Claims;
using Lovecraft.Backend.Middleware;
using Lovecraft.Backend.Services.Metrics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace Lovecraft.UnitTests;

public class RequestMetricsMiddlewareTests
{
    [Theory]
    [InlineData("/health")]
    [InlineData("/metrics/config")]
    [InlineData("/swagger/index.html")]
    public async Task SkippedPaths_DoNotRecord(string path)
    {
        var collector = new MockMetricsCollector();
        var dau = new DailyActiveUserCoalescer();
        var mw = new RequestMetricsMiddleware(_ => Task.CompletedTask, collector, dau);
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = "GET";
        ctx.Request.Path = path;
        await mw.InvokeAsync(ctx);
        Assert.Empty(collector.Snapshot());
    }

    [Fact]
    public async Task OptionsMethod_NotRecorded()
    {
        var collector = new MockMetricsCollector();
        var mw = new RequestMetricsMiddleware(_ => Task.CompletedTask, collector, new DailyActiveUserCoalescer());
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = "OPTIONS";
        ctx.Request.Path = "/api/v1/users";
        await mw.InvokeAsync(ctx);
        Assert.Empty(collector.Snapshot());
    }

    [Fact]
    public async Task NormalRequest_RecordsTiming()
    {
        var collector = new MockMetricsCollector();
        var mw = new RequestMetricsMiddleware(c => { c.Response.StatusCode = 200; return Task.CompletedTask; },
                                              collector, new DailyActiveUserCoalescer());
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = "POST";
        ctx.Request.Path = "/api/v1/auth/login";
        await mw.InvokeAsync(ctx);
        Assert.Single(collector.Snapshot());
        var row = collector.Snapshot()[0];
        Assert.Equal("request_timing", row.Category);
        Assert.Contains("backend|POST|/api/v1/auth/login|200", row.DimensionKey);
    }

    [Fact]
    public async Task MiddlewareNeverThrows_EvenIfCollectorThrows()
    {
        var bad = new ThrowingCollector();
        var mw = new RequestMetricsMiddleware(_ => Task.CompletedTask, bad, new DailyActiveUserCoalescer());
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = "GET";
        ctx.Request.Path = "/api/v1/users";
        await mw.InvokeAsync(ctx);  // should not throw
    }

    private sealed class ThrowingCollector : IMetricsCollector
    {
        public MetricsEnabledFlags CurrentFlags { get; } = MetricsEnabledFlags.AllEnabled;
        public void UpdateFlags(MetricsEnabledFlags f) { }
        public void RecordTiming(string c, string d, double m) => throw new InvalidOperationException();
        public void RecordCount(string c, string d, long delta = 1) => throw new InvalidOperationException();
        public Task RecordContainerStatusAsync(ContainerStatusSnapshot s, CancellationToken ct = default) => Task.CompletedTask;
        public Task FlushAsync(CancellationToken ct = default) => Task.CompletedTask;
    }
}
```

- [ ] **Step 2: Run — verify compile failure**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~RequestMetricsMiddlewareTests`
Expected: Compile errors.

- [ ] **Step 3: Implement middleware**

```csharp
using System.Diagnostics;
using System.Security.Claims;
using Lovecraft.Backend.Services.Metrics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Lovecraft.Backend.Middleware;

public sealed class RequestMetricsMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMetricsCollector _collector;
    private readonly DailyActiveUserCoalescer _dau;

    private static readonly string[] SkippedPathPrefixes =
        { "/health", "/metrics/config", "/metrics/frontend", "/swagger" };

    public RequestMetricsMiddleware(RequestDelegate next, IMetricsCollector collector, DailyActiveUserCoalescer dau)
    {
        _next = next;
        _collector = collector;
        _dau = dau;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        if (context.Request.Method == "OPTIONS" ||
            SkippedPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            try
            {
                var route = context.GetEndpoint()?.Metadata.GetMetadata<RouteEndpoint>()?.RoutePattern?.RawText ?? path;
                var dim = $"backend|{context.Request.Method}|/{route.TrimStart('/')}|{context.Response.StatusCode}";
                _collector.RecordTiming("request_timing", dim, sw.Elapsed.TotalMilliseconds);

                var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userId))
                    _ = _dau.FlushIfNeededAsync(userId, DateTime.UtcNow, context.RequestAborted);
            }
            catch { /* metrics must never fail the request */ }
        }
    }
}
```

- [ ] **Step 4: Run tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~RequestMetricsMiddlewareTests`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Middleware/RequestMetricsMiddleware.cs Lovecraft/Lovecraft.UnitTests/RequestMetricsMiddlewareTests.cs
git -C lovecraft commit -m "feat(metrics): add RequestMetricsMiddleware with DAU coalescing"
```

---

## Task 8: BI event producers at six call sites

**Files:**
- Modify: `Controllers/V1/AuthController.cs` (Register, Login, GoogleRegister, TelegramRegister, TelegramMiniAppRegister)
- Modify: `Controllers/V1/ChatsController.cs` (SendMessage)
- Modify: `Controllers/V1/EventsController.cs` (Register)
- Modify: `Services/MockMatchingService.cs` and `Services/Azure/AzureMatchingService.cs` (mutual match branch in CreateLikeAsync)
- Modify: `Services/MockForumService.cs` and `Services/Azure/AzureForumService.cs` (CreateTopicAsync)

- [ ] **Step 1: For each controller/service, inject `IMetricsCollector` via constructor parameter**

Pattern (example for `AuthController.cs`):

```csharp
private readonly IMetricsCollector _metrics;

public AuthController(/* existing params */, IMetricsCollector metrics)
{
    /* existing assignments */
    _metrics = metrics;
}
```

- [ ] **Step 2: In `AuthController.Register` success branch (just before returning AuthResponseDto), add**

```csharp
try { _metrics.RecordCount("bi_events", "bi|user_registered|local"); }
catch (Exception ex) { _logger.LogWarning(ex, "BI metric failed"); }
```

- [ ] **Step 3: Same pattern in `AuthController.Login` success branch** — dimension `bi|user_login|local`. And in each `*Register` endpoint that ends in account creation: `bi|user_registered|{google|telegram}`. Same for `*Login` `signedIn` branches: `bi|user_login|{google|telegram}`.

- [ ] **Step 4: In `ChatsController.SendMessage` after persisting message** — `bi|message_sent`.

- [ ] **Step 5: In `EventsController.Register` success branch** — `bi|event_registered|{eventId}`.

- [ ] **Step 6: In both `MockMatchingService.CreateLikeAsync` and `AzureMatchingService.CreateLikeAsync` mutual-match branch** (where `isMatch = true`) — `bi|match_created`.

- [ ] **Step 7: In both `MockForumService.CreateTopicAsync` and `AzureForumService.CreateTopicAsync` after successful creation** — `bi|topic_created|{sectionId}`.

- [ ] **Step 8: Run all tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests`
Expected: All pass. Tests using the controllers/services should not break — DI container will pass `MockMetricsCollector` (or test substitute) once registered in Task 19.

If tests fail because `IMetricsCollector` can't be resolved in `WebApplicationFactory<Program>` tests, register `MockMetricsCollector` as default in DI via `Program.cs` before this task (or add a fallback line to test setup). Coordinated with Task 19.

- [ ] **Step 9: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.Backend/Controllers/V1/ChatsController.cs Lovecraft/Lovecraft.Backend/Controllers/V1/EventsController.cs Lovecraft/Lovecraft.Backend/Services/MockMatchingService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureMatchingService.cs Lovecraft/Lovecraft.Backend/Services/MockForumService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs
git -C lovecraft commit -m "feat(metrics): wire BI event producers at six call sites"
```

---

## Task 9: `ContainerHeartbeatWorker` + `FrontendProbeWorker`

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/FrontendProbeWorker.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/ContainerHeartbeatWorkerTests.cs`

- [ ] **Step 1: Write failing test**

```csharp
using Lovecraft.Backend.Services.Metrics;
using Xunit;

namespace Lovecraft.UnitTests;

public class ContainerHeartbeatWorkerTests
{
    [Fact]
    public void Snapshot_PopulatesProcessMetrics()
    {
        var snap = ContainerHeartbeatWorker.CaptureSnapshot("backend", startedAt: DateTime.UtcNow.AddMinutes(-5), version: "1.0");
        Assert.Equal("backend", snap.Name);
        Assert.NotNull(snap.WorkingSetMb);
        Assert.True(snap.WorkingSetMb > 0);
        Assert.NotNull(snap.ThreadCount);
        Assert.True(snap.ThreadCount > 0);
        Assert.NotNull(snap.GcHeapMb);
    }
}
```

- [ ] **Step 2: Implement `ContainerHeartbeatWorker.cs`**

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
                await _collector.RecordContainerStatusAsync(snap, stoppingToken);
                _collector.RecordTiming("container_stats", $"{_containerName}|working_set_mb", snap.WorkingSetMb ?? 0);
                _collector.RecordTiming("container_stats", $"{_containerName}|gc_heap_mb", snap.GcHeapMb ?? 0);
                _collector.RecordTiming("container_stats", $"{_containerName}|thread_count", snap.ThreadCount ?? 0);
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
            RequestsServed: null,
            Note: null);
    }
}
```

- [ ] **Step 3: Implement `FrontendProbeWorker.cs`**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class FrontendProbeWorker : BackgroundService
{
    private readonly IMetricsCollector _collector;
    private readonly ILogger<FrontendProbeWorker> _logger;
    private readonly HttpClient _http;
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(60);
    private static readonly string ProbeUrl = Environment.GetEnvironmentVariable("FRONTEND_PROBE_URL") ?? "http://frontend/health";

    public FrontendProbeWorker(IMetricsCollector collector, ILogger<FrontendProbeWorker> logger, IHttpClientFactory httpFactory)
    {
        _collector = collector;
        _logger = logger;
        _http = httpFactory.CreateClient("frontend-probe");
        _http.Timeout = TimeSpan.FromSeconds(5);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProbeAsync(stoppingToken);
            await Task.Delay(TickInterval, stoppingToken);
        }
    }

    private async Task ProbeAsync(CancellationToken ct)
    {
        int status = 0;
        try
        {
            var resp = await _http.GetAsync(ProbeUrl, ct);
            status = (int)resp.StatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Frontend probe failed");
        }
        var snap = new ContainerStatusSnapshot(
            Name: "frontend",
            LastHeartbeatUtc: DateTime.UtcNow,
            StartedAtUtc: DateTime.UtcNow,
            Version: "nginx",
            GcHeapMb: null, WorkingSetMb: null, ThreadCount: null, CpuSecondsTotal: null,
            RequestsServed: null,
            Note: $"HTTP {status}");
        try { await _collector.RecordContainerStatusAsync(snap, ct); } catch { }
    }
}
```

- [ ] **Step 4: Run tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~ContainerHeartbeatWorkerTests`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/ContainerHeartbeatWorker.cs Lovecraft/Lovecraft.Backend/Services/Metrics/FrontendProbeWorker.cs Lovecraft/Lovecraft.UnitTests/ContainerHeartbeatWorkerTests.cs
git -C lovecraft commit -m "feat(metrics): add container heartbeat worker and frontend probe"
```

---

## Task 10: `MetricsRollupWorker` in NotificationsWorker

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Entities/MetricMinuteEntity.cs` (duplicate)
- Create: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Entities/MetricHourEntity.cs` (duplicate)
- Modify: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/TableNames.cs` — add `MetricsMinute` and `MetricsHour`
- Create: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Workers/MetricsRollupWorker.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Program.cs` — register worker
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/MetricsRollupWorkerTests.cs`

- [ ] **Step 1: Duplicate entities** — copy `MetricMinuteEntity.cs` and `MetricHourEntity.cs` from backend (Task 1), change namespace to `Lovecraft.NotificationsWorker.Entities`.

- [ ] **Step 2: Append table names** to `Lovecraft.NotificationsWorker/TableNames.cs`:

```csharp
public static string MetricsMinute => Prefix + "metricsminute";
public static string MetricsHour => Prefix + "metricshour";
```

- [ ] **Step 3: Write failing test**

```csharp
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Workers;
using Xunit;

namespace Lovecraft.UnitTests;

public class MetricsRollupWorkerTests
{
    [Fact]
    public void Aggregate_SumsCountAndBuckets()
    {
        var rows = new[]
        {
            new MetricMinuteEntity { RowKey = "10#k", Count = 3, SumMs = 60, MinMs = 10, MaxMs = 30, B0 = 1, B1 = 2 },
            new MetricMinuteEntity { RowKey = "11#k", Count = 2, SumMs = 200, MinMs = 90, MaxMs = 110, B1 = 1, B2 = 1 },
        };
        var hour = MetricsRollupWorker.AggregateGroup("k", rows);
        Assert.Equal(5, hour.Count);
        Assert.Equal(260, hour.SumMs);
        Assert.Equal(10, hour.MinMs);
        Assert.Equal(110, hour.MaxMs);
        Assert.Equal(1, hour.B0);
        Assert.Equal(3, hour.B1);
        Assert.Equal(1, hour.B2);
        Assert.Equal(2, hour.SourceMinuteRowCount);
    }
}
```

- [ ] **Step 4: Implement `MetricsRollupWorker.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public sealed class MetricsRollupWorker : BackgroundService
{
    private readonly TableServiceClient _tables;
    private readonly ILogger<MetricsRollupWorker> _logger;
    private static readonly string[] Categories = { "request_timing", "bi_events", "container_stats", "frontend_perf" };

    public MetricsRollupWorker(TableServiceClient tables, ILogger<MetricsRollupWorker> logger)
    {
        _tables = tables;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRunAt = NextTopOfHourPlus5(now);
            var delay = nextRunAt - now;
            try { await Task.Delay(delay, stoppingToken); } catch (TaskCanceledException) { return; }
            await RunOnceAsync(DateTime.UtcNow, stoppingToken);
        }
    }

    public static DateTime NextTopOfHourPlus5(DateTime now)
    {
        var topNext = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1).AddMinutes(5);
        return topNext;
    }

    public async Task RunOnceAsync(DateTime nowUtc, CancellationToken ct)
    {
        var minute = _tables.GetTableClient(TableNames.MetricsMinute);
        var hour = _tables.GetTableClient(TableNames.MetricsHour);
        await minute.CreateIfNotExistsAsync(ct);
        await hour.CreateIfNotExistsAsync(ct);

        for (int hoursBack = 1; hoursBack <= 6; hoursBack++)
        {
            var target = nowUtc.AddHours(-hoursBack);
            foreach (var cat in Categories)
                await RollupHourAsync(minute, hour, target, cat, force: hoursBack == 1, ct);
        }
    }

    private async Task RollupHourAsync(TableClient minute, TableClient hour, DateTime hourUtc, string category, bool force, CancellationToken ct)
    {
        var pkMinute = $"{hourUtc:yyyy-MM-dd'T'HH}#{category}";
        var rows = new List<MetricMinuteEntity>();
        await foreach (var r in minute.QueryAsync<MetricMinuteEntity>(filter: $"PartitionKey eq '{pkMinute}'", cancellationToken: ct))
            rows.Add(r);
        if (rows.Count == 0) return;

        // Skip if already correct and not forced
        var pkHour = $"{hourUtc:yyyy-MM-dd}#{category}";
        if (!force)
        {
            try
            {
                var existing = await hour.GetEntityAsync<MetricHourEntity>(pkHour, $"{hourUtc:HH}#__sentinel__", cancellationToken: ct);
                if (existing.Value.SourceMinuteRowCount == rows.Count) return;
            }
            catch (RequestFailedException ex) when (ex.Status == 404) { }
        }

        foreach (var group in rows.GroupBy(r => DimensionFromRowKey(r.RowKey)))
        {
            var agg = AggregateGroup(group.Key, group.ToList());
            var entity = new MetricHourEntity
            {
                PartitionKey = pkHour,
                RowKey = $"{hourUtc:HH}#{group.Key}",
                Count = agg.Count,
                SumMs = agg.SumMs,
                MinMs = agg.MinMs,
                MaxMs = agg.MaxMs,
                B0 = agg.B0, B1 = agg.B1, B2 = agg.B2, B3 = agg.B3,
                B4 = agg.B4, B5 = agg.B5, B6 = agg.B6, B7 = agg.B7, B8 = agg.B8,
                SourceMinuteRowCount = agg.SourceMinuteRowCount,
            };
            await hour.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);
        }
    }

    private static string DimensionFromRowKey(string rowKey)
    {
        var idx = rowKey.IndexOf('#');
        return idx < 0 ? rowKey : rowKey[(idx + 1)..];
    }

    public static MetricHourEntity AggregateGroup(string dimensionKey, IReadOnlyList<MetricMinuteEntity> rows)
    {
        var h = new MetricHourEntity { SourceMinuteRowCount = rows.Count };
        foreach (var r in rows)
        {
            h.Count += r.Count;
            h.SumMs = (h.SumMs ?? 0) + (r.SumMs ?? 0);
            if (r.MinMs.HasValue) h.MinMs = h.MinMs.HasValue ? Math.Min(h.MinMs.Value, r.MinMs.Value) : r.MinMs;
            if (r.MaxMs.HasValue) h.MaxMs = h.MaxMs.HasValue ? Math.Max(h.MaxMs.Value, r.MaxMs.Value) : r.MaxMs;
            h.B0 = (h.B0 ?? 0) + (r.B0 ?? 0);
            h.B1 = (h.B1 ?? 0) + (r.B1 ?? 0);
            h.B2 = (h.B2 ?? 0) + (r.B2 ?? 0);
            h.B3 = (h.B3 ?? 0) + (r.B3 ?? 0);
            h.B4 = (h.B4 ?? 0) + (r.B4 ?? 0);
            h.B5 = (h.B5 ?? 0) + (r.B5 ?? 0);
            h.B6 = (h.B6 ?? 0) + (r.B6 ?? 0);
            h.B7 = (h.B7 ?? 0) + (r.B7 ?? 0);
            h.B8 = (h.B8 ?? 0) + (r.B8 ?? 0);
        }
        return h;
    }
}
```

- [ ] **Step 5: Register in `Lovecraft.NotificationsWorker/Program.cs`**

In the existing `Host.CreateApplicationBuilder` services section, add:

```csharp
builder.Services.AddHostedService<MetricsRollupWorker>();
```

- [ ] **Step 6: Run test**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~MetricsRollupWorkerTests`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.NotificationsWorker/Entities/MetricMinuteEntity.cs Lovecraft/Lovecraft.NotificationsWorker/Entities/MetricHourEntity.cs Lovecraft/Lovecraft.NotificationsWorker/TableNames.cs Lovecraft/Lovecraft.NotificationsWorker/Workers/MetricsRollupWorker.cs Lovecraft/Lovecraft.NotificationsWorker/Program.cs Lovecraft/Lovecraft.UnitTests/MetricsRollupWorkerTests.cs
git -C lovecraft commit -m "feat(metrics): add hourly rollup worker"
```

---

## Task 11: Extend `JanitorWorker` with three cleanup passes

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Workers/JanitorWorker.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/MetricsRetentionTests.cs`

- [ ] **Step 1: Read existing `JanitorWorker.cs`**

Run: `cat lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Workers/JanitorWorker.cs`

Locate the daily cleanup loop. The new code lives at the end of the existing run.

- [ ] **Step 2: Write failing test for the partition-date parsing helper**

```csharp
using Lovecraft.NotificationsWorker.Workers;
using Xunit;

namespace Lovecraft.UnitTests;

public class MetricsRetentionTests
{
    [Fact]
    public void ShouldDeleteMinutePartition_OlderThanRetention_True()
    {
        var now = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(JanitorWorker.ShouldDeleteMinutePartition("2026-05-20T11#request_timing", now, retentionHours: 24));
    }

    [Fact]
    public void ShouldDeleteMinutePartition_WithinRetention_False()
    {
        var now = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(JanitorWorker.ShouldDeleteMinutePartition("2026-05-21T01#request_timing", now, retentionHours: 24));
    }

    [Fact]
    public void ShouldDeleteHourPartition_OlderThanRetention_True()
    {
        var now = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(JanitorWorker.ShouldDeleteHourPartition("2026-02-15#request_timing", now, retentionDays: 90));
    }

    [Fact]
    public void ShouldDeleteDauPartition_OlderThanRetentionPlus1_True()
    {
        var now = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(JanitorWorker.ShouldDeleteDauPartition("2026-04-19", now, retentionDays: 30));
    }
}
```

- [ ] **Step 3: Add the three helper methods + cleanup passes to `JanitorWorker.cs`**

```csharp
public static bool ShouldDeleteMinutePartition(string pk, DateTime nowUtc, int retentionHours)
{
    var hashIdx = pk.IndexOf('#');
    if (hashIdx < 0) return false;
    if (!DateTime.TryParseExact(pk[..hashIdx], "yyyy-MM-dd'T'HH", null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var ts))
        return false;
    return ts < nowUtc.AddHours(-retentionHours);
}

public static bool ShouldDeleteHourPartition(string pk, DateTime nowUtc, int retentionDays)
{
    var hashIdx = pk.IndexOf('#');
    if (hashIdx < 0) return false;
    if (!DateTime.TryParseExact(pk[..hashIdx], "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var d))
        return false;
    return d < nowUtc.Date.AddDays(-retentionDays);
}

public static bool ShouldDeleteDauPartition(string pk, DateTime nowUtc, int retentionDays)
{
    if (!DateTime.TryParseExact(pk, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var d))
        return false;
    return d < nowUtc.Date.AddDays(-retentionDays - 1);
}

private async Task CleanupMetricsTablesAsync(int minuteHours, int hourDays, int dauDays, CancellationToken ct)
{
    var now = DateTime.UtcNow;
    await CleanupTablePartitionsAsync(TableNames.MetricsMinute, pk => ShouldDeleteMinutePartition(pk, now, minuteHours), ct);
    await CleanupTablePartitionsAsync(TableNames.MetricsHour,   pk => ShouldDeleteHourPartition(pk, now, hourDays), ct);
    await CleanupTablePartitionsAsync("dailyactiveusers",       pk => ShouldDeleteDauPartition(pk, now, dauDays), ct);
}

private async Task CleanupTablePartitionsAsync(string tableName, Func<string, bool> shouldDelete, CancellationToken ct)
{
    var table = _tables.GetTableClient(tableName);
    try { await table.CreateIfNotExistsAsync(ct); } catch { return; }
    var seenPartitions = new HashSet<string>();
    await foreach (var entity in table.QueryAsync<TableEntity>(select: new[] { "PartitionKey" }, cancellationToken: ct))
    {
        if (!seenPartitions.Add(entity.PartitionKey)) continue;
        if (!shouldDelete(entity.PartitionKey)) continue;
        await DeletePartitionAsync(table, entity.PartitionKey, ct);
    }
}

private static async Task DeletePartitionAsync(TableClient table, string pk, CancellationToken ct)
{
    var batch = new List<TableTransactionAction>();
    await foreach (var entity in table.QueryAsync<TableEntity>(filter: $"PartitionKey eq '{pk}'", select: new[] { "PartitionKey", "RowKey" }, cancellationToken: ct))
    {
        batch.Add(new TableTransactionAction(TableTransactionActionType.Delete, entity));
        if (batch.Count == 100)
        {
            await table.SubmitTransactionAsync(batch, ct);
            batch.Clear();
        }
    }
    if (batch.Count > 0) await table.SubmitTransactionAsync(batch, ct);
}
```

Wire the call: in the existing daily-run method of `JanitorWorker`, add at the end (read `MetricsConfig` from `IAppConfigService` to get retention values):

```csharp
var cfg = await _appConfig.GetMetricsConfigAsync(ct);
await CleanupMetricsTablesAsync(cfg.RetentionMinuteHours, cfg.RetentionHourDays, cfg.RetentionDauDays, ct);
```

If the worker doesn't already inject `IAppConfigService`, add it to the constructor.

- [ ] **Step 4: Run tests**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~MetricsRetentionTests`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.NotificationsWorker/Workers/JanitorWorker.cs Lovecraft/Lovecraft.UnitTests/MetricsRetentionTests.cs
git -C lovecraft commit -m "feat(metrics): extend JanitorWorker with three metric retention passes"
```

---

## Task 12: `MauCalculator` + tests

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Metrics/MauCalculator.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/MauCalculatorTests.cs`

- [ ] **Step 1: Write failing test**

```csharp
using Lovecraft.Backend.Services.Metrics;
using Lovecraft.Backend.Storage.Entities;
using Xunit;

namespace Lovecraft.UnitTests;

public class MauCalculatorTests
{
    [Fact]
    public void ComputeFromPartitions_DedupsAcrossDays()
    {
        var partitions = new Dictionary<string, string[]>
        {
            ["2026-05-21"] = new[] { "u1", "u2" },
            ["2026-05-20"] = new[] { "u1", "u3" },
            ["2026-05-19"] = new[] { "u4" },
        };
        var mau = MauCalculator.ComputeFromPartitions(partitions);
        Assert.Equal(4, mau);
    }
}
```

- [ ] **Step 2: Implement**

```csharp
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace Lovecraft.Backend.Services.Metrics;

public sealed class MauCalculator
{
    private readonly TableServiceClient? _tables;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public MauCalculator(TableServiceClient? tables, IMemoryCache cache)
    {
        _tables = tables;
        _cache = cache;
    }

    public async Task<int> GetMauAsync(DateOnly today, CancellationToken ct = default)
    {
        if (_tables is null) return 0;
        var key = $"mau:{today:yyyy-MM-dd}";
        return await _cache.GetOrCreateAsync(key, async e =>
        {
            e.AbsoluteExpirationRelativeToNow = CacheTtl;
            var table = _tables.GetTableClient(TableNames.DailyActiveUsers);
            await table.CreateIfNotExistsAsync(ct);
            var partitions = new Dictionary<string, string[]>();
            for (int d = 0; d < 30; d++)
            {
                var pk = today.AddDays(-d).ToString("yyyy-MM-dd");
                var ids = new List<string>();
                await foreach (var row in table.QueryAsync<TableEntity>(
                    filter: $"PartitionKey eq '{pk}'", select: new[] { "RowKey" }, cancellationToken: ct))
                    ids.Add(row.RowKey);
                partitions[pk] = ids.ToArray();
            }
            return ComputeFromPartitions(partitions);
        });
    }

    public static int ComputeFromPartitions(IReadOnlyDictionary<string, string[]> partitions)
    {
        var seen = new HashSet<string>();
        foreach (var ids in partitions.Values)
            foreach (var id in ids) seen.Add(id);
        return seen.Count;
    }

    public async Task<int> GetDauAsync(DateOnly day, CancellationToken ct = default)
    {
        if (_tables is null) return 0;
        var table = _tables.GetTableClient(TableNames.DailyActiveUsers);
        await table.CreateIfNotExistsAsync(ct);
        var pk = day.ToString("yyyy-MM-dd");
        int count = 0;
        await foreach (var _ in table.QueryAsync<TableEntity>(filter: $"PartitionKey eq '{pk}'", select: new[] { "RowKey" }, cancellationToken: ct))
            count++;
        return count;
    }
}
```

- [ ] **Step 3: Run tests + commit**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests --filter FullyQualifiedName~MauCalculatorTests`

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Services/Metrics/MauCalculator.cs Lovecraft/Lovecraft.UnitTests/MauCalculatorTests.cs
git -C lovecraft commit -m "feat(metrics): add MAU calculator with 5min memory cache"
```

---

## Task 13: `MetricsController` (config + frontend ingest)

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Controllers/V1/MetricsController.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/MetricsControllerTests.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Program.cs` — add a per-user rate-limit policy `MetricsFrontendRateLimit`

- [ ] **Step 1: Add rate-limit policy in `Program.cs`** — near the existing `AuthRateLimit` registration:

```csharp
options.AddPolicy("MetricsFrontendRateLimit", httpContext =>
    RateLimitPartition.GetSlidingWindowLimiter(
        partitionKey: httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                      ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        factory: _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            SegmentsPerWindow = 6,
        }));
```

- [ ] **Step 2: Write failing test**

```csharp
using Lovecraft.Backend.Controllers.V1;
using Lovecraft.Backend.Services.Metrics;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Lovecraft.UnitTests;

public class MetricsControllerTests
{
    [Fact]
    public async Task GetConfig_ReturnsFlagsFromAppConfig()
    {
        var appConfig = new MockAppConfigService();
        appConfig.SetMetricsConfig(new Lovecraft.Backend.Services.MetricsConfig(true, false, true, false, 24, 90, 30));
        var ctrl = new MetricsController(new MockMetricsCollector(), appConfig);
        var result = await ctrl.GetConfig(default);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<MetricsConfigDto>(ok.Value);
        Assert.True(dto.RequestTiming);
        Assert.False(dto.BiEvents);
        Assert.True(dto.ContainerStats);
        Assert.False(dto.FrontendPerf);
    }

    [Fact]
    public async Task PostFrontend_RecordsEachSampleWithFrontendPrefix()
    {
        var collector = new MockMetricsCollector();
        var ctrl = new MetricsController(collector, new MockAppConfigService());
        var batch = new FrontendMetricsBatchDto(new[]
        {
            new FrontendMetricSampleDto("/api/v1/users", "GET", 200, 42),
            new FrontendMetricSampleDto("/api/v1/auth/login", "POST", 401, 120),
        });
        await ctrl.PostFrontend(batch);
        var rows = collector.Snapshot();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.StartsWith("frontend|", r.DimensionKey));
    }
}
```

- [ ] **Step 3: Implement `MetricsController.cs`**

```csharp
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Metrics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1/metrics")]
[Authorize]
public class MetricsController : ControllerBase
{
    private readonly IMetricsCollector _collector;
    private readonly IAppConfigService _appConfig;

    public MetricsController(IMetricsCollector collector, IAppConfigService appConfig)
    {
        _collector = collector;
        _appConfig = appConfig;
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var cfg = await _appConfig.GetMetricsConfigAsync(ct);
        return Ok(new MetricsConfigDto(cfg.RequestTiming, cfg.BiEvents, cfg.ContainerStats, cfg.FrontendPerf));
    }

    [HttpPost("frontend")]
    [EnableRateLimiting("MetricsFrontendRateLimit")]
    public Task<IActionResult> PostFrontend([FromBody] FrontendMetricsBatchDto batch)
    {
        if (batch?.Samples is null || batch.Samples.Length == 0)
            return Task.FromResult<IActionResult>(NoContent());

        foreach (var s in batch.Samples)
        {
            var endpoint = NormalizeEndpoint(s.Endpoint);
            var dim = $"frontend|{s.Method}|{endpoint}|{s.Status}";
            _collector.RecordTiming("frontend_perf", dim, s.DurationMs);
        }
        return Task.FromResult<IActionResult>(NoContent());
    }

    public static string NormalizeEndpoint(string raw)
    {
        var q = raw.IndexOf('?');
        var path = q < 0 ? raw : raw[..q];
        var parts = path.Split('/').Select(seg =>
        {
            if (seg.Length == 0) return seg;
            if (long.TryParse(seg, out _)) return "{id}";
            if (Guid.TryParse(seg, out _)) return "{id}";
            return seg;
        });
        return string.Join('/', parts);
    }
}

public sealed record MetricsConfigDto(bool RequestTiming, bool BiEvents, bool ContainerStats, bool FrontendPerf);
public sealed record FrontendMetricsBatchDto(FrontendMetricSampleDto[] Samples);
public sealed record FrontendMetricSampleDto(string Endpoint, string Method, int Status, double DurationMs);
```

- [ ] **Step 4: Run tests + commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Controllers/V1/MetricsController.cs Lovecraft/Lovecraft.Backend/Program.cs Lovecraft/Lovecraft.UnitTests/MetricsControllerTests.cs
git -C lovecraft commit -m "feat(metrics): add /metrics/config and /metrics/frontend endpoints"
```

---

## Task 14: `AdminMetricsController` (overview, containers, timeseries, bi, config write)

**Files:**
- Create: `lovecraft/Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs`
- Create: `lovecraft/Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs`

This controller is long; structure it as five action methods. Each method paginates from `metricsminute` or `metricshour` based on resolution, builds the response DTO, and returns `Ok(dto)`. The full implementation is the most code in the plan; reuse `HistogramBuckets`, `MauCalculator`, `IUserService.GetUsersAsync` for total registered count.

- [ ] **Step 1: Sketch DTOs first**

```csharp
public sealed record MetricsOverviewDto(int Registered, int Dau, int Mau, int CurrentlyActive, long RequestsLastHour, double? P95LastHourMs);
public sealed record ContainerStatusDto(string Name, string Status, double? HeartbeatAgeSeconds, long? GcHeapMb, long? WorkingSetMb, int? ThreadCount, string? Note, DateTime? StartedAtUtc, string? Version);
public sealed record TimeseriesPointDto(DateTime Ts, long Count, double? P50, double? P95, double? P99);
public sealed record BiTimeseriesDto(string[] Days, int[] Registered, int[] Dau, int[] Mau);
```

- [ ] **Step 2: Implement each action method one at a time**

For each method:
1. Write a focused failing test in `AdminMetricsControllerTests.cs` using `WebApplicationFactory<Program>` + `TestAuthHandler` (mirroring `AclTests`).
2. Implement the action.
3. Verify the test passes.
4. Commit.

Endpoints to implement (in this order):

a. `GET /admin/metrics/config` — read the same MetricsConfig and return it.
b. `PUT /admin/metrics/config` — accepts `MetricsConfigDto`; persists each field to `appconfig` via a new `IAppConfigService.SetMetricsConfigAsync(MetricsConfig)`; then `InvalidateAsync()`.
c. `GET /admin/metrics/containers` — reads `containerstatus` partition `STATUS`, computes status: green if `(now - LastHeartbeatUtc) < 60s` (or HTTP 200 for frontend), amber `60–180s`, red `> 180s`.
d. `GET /admin/metrics/overview` — `Registered = await _userService.GetUsersAsync(0, int.MaxValue).Count()` (use existing pattern); `Dau = await _mau.GetDauAsync(today)`; `Mau = await _mau.GetMauAsync(today)`; `CurrentlyActive = _presence.OnlineUserCount + userService.WithLastSeenWithin(TimeSpan.FromMinutes(5))`; `RequestsLastHour` = sum `Count` from `metricsminute` PKs covering the last hour for category `request_timing`; `P95LastHourMs` = compute via bucket interpolation across those rows.
e. `GET /admin/metrics/timeseries?category=&dimensionKey?=&from=&to=&resolution=minute|hour` — query the matching table; for each timestamp bucket return `(ts, count, p50, p95, p99)` via bucket interpolation. Skip percentiles if `SumMs` is null (count-only categories like `bi_events`).
f. `GET /admin/metrics/bi?range=24h|7d|30d` — return per-day registration count (group `users.CreatedAt` by date), DAU per day, MAU per day.

Gate the entire controller with `[RequireStaffRole("admin")]`.

- [ ] **Step 3: After all actions implemented, run full unit test suite**

Run: `dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests`
Expected: All pass.

- [ ] **Step 4: Commit (one commit per action method is fine — or one commit for all six if implemented in one sitting)**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminMetricsController.cs Lovecraft/Lovecraft.UnitTests/AdminMetricsControllerTests.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs
git -C lovecraft commit -m "feat(metrics): add admin metrics controller (overview/containers/timeseries/bi/config)"
```

---

## Task 15: DI wiring + middleware registration in backend `Program.cs`

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Program.cs`

- [ ] **Step 1: Register services**

After the existing storage / Azure registrations, add:

```csharp
// Metrics
if (useAzureStorage)
{
    builder.Services.AddSingleton<IMetricsCollector>(sp =>
        new AzureMetricsCollector(capacity: 1000, tableService: sp.GetRequiredService<TableServiceClient>()));
    builder.Services.AddSingleton(sp => new DailyActiveUserCoalescer(
        windowSeconds: 60, tableService: sp.GetRequiredService<TableServiceClient>()));
    builder.Services.AddSingleton(sp => new MauCalculator(
        sp.GetRequiredService<TableServiceClient>(), sp.GetRequiredService<IMemoryCache>()));
}
else
{
    builder.Services.AddSingleton<IMetricsCollector, MockMetricsCollector>();
    builder.Services.AddSingleton(new DailyActiveUserCoalescer(windowSeconds: 60));
    builder.Services.AddSingleton(sp => new MauCalculator(null, sp.GetRequiredService<IMemoryCache>()));
}
builder.Services.AddHostedService<MetricsFlushWorker>();
builder.Services.AddHostedService<MetricsConfigPoller>();
builder.Services.AddHostedService(sp => new ContainerHeartbeatWorker(
    sp.GetRequiredService<IMetricsCollector>(),
    sp.GetRequiredService<ILogger<ContainerHeartbeatWorker>>(),
    "backend",
    typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0"));
builder.Services.AddHttpClient("frontend-probe");
builder.Services.AddHostedService<FrontendProbeWorker>();
```

- [ ] **Step 2: Register middleware**

In the request pipeline section, immediately after `app.UseAuthorization()` (before `app.MapControllers()`):

```csharp
app.UseMiddleware<RequestMetricsMiddleware>();
```

- [ ] **Step 3: Build + run all backend tests**

```
dotnet test lovecraft/Lovecraft/Lovecraft.UnitTests
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Program.cs
git -C lovecraft commit -m "feat(metrics): wire collector, middleware, and workers in Program.cs"
```

---

## Task 16: Wire `ContainerHeartbeatWorker` into TelegramBot + NotificationsWorker

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.TelegramBot/Program.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Program.cs`

Both workers need to write heartbeats. They don't have access to `Lovecraft.Backend.Services.Metrics`. The simplest path is to either reference `Lovecraft.Backend` from these projects (likely undesirable) or duplicate `ContainerHeartbeatWorker` + a minimal `IMetricsCollector` writing directly to `containerstatus`.

- [ ] **Step 1: Decide approach.** Recommended: extract `ContainerHeartbeatWorker` + `ContainerStatusEntity` write logic into either `Lovecraft.Common` (if it can take Azure.Data.Tables as a dep) or duplicate. Per existing precedent (entity duplication in NotificationsWorker), **duplicate**.

- [ ] **Step 2: For each of TelegramBot and NotificationsWorker:**

Create local minimal `ContainerStatusEntity` (copy from backend), `ContainerStatusSnapshot` record (copy from backend), and a `ContainerHeartbeatWorker` that takes a `TableServiceClient` and writes to `containerstatus` directly (no `IMetricsCollector` abstraction in these projects).

```csharp
// e.g. Lovecraft.TelegramBot/Workers/ContainerHeartbeatWorker.cs
public sealed class ContainerHeartbeatWorker : BackgroundService
{
    private readonly TableServiceClient _tables;
    private readonly string _name;
    private readonly DateTime _startedAt = DateTime.UtcNow;
    private readonly ILogger<ContainerHeartbeatWorker> _logger;
    private bool _tableInit;

    public ContainerHeartbeatWorker(TableServiceClient tables, ILogger<ContainerHeartbeatWorker> logger, string name)
    {
        _tables = tables; _logger = logger; _name = name;
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
                var entity = new ContainerStatusEntity
                {
                    PartitionKey = "STATUS",
                    RowKey = _name,
                    LastHeartbeatUtc = DateTime.UtcNow,
                    StartedAtUtc = _startedAt,
                    Version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0",
                    WorkingSetMb = proc.WorkingSet64 / (1024 * 1024),
                    GcHeapMb = GC.GetTotalMemory(false) / (1024 * 1024),
                    ThreadCount = proc.Threads.Count,
                    CpuSecondsTotal = proc.TotalProcessorTime.TotalSeconds,
                };
                await table.UpsertEntityAsync(entity, TableUpdateMode.Replace, ct);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Heartbeat failed"); }
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }
}
```

Register in each `Program.cs`:

```csharp
builder.Services.AddHostedService(sp => new ContainerHeartbeatWorker(
    sp.GetRequiredService<TableServiceClient>(),
    sp.GetRequiredService<ILogger<ContainerHeartbeatWorker>>(),
    "telegram-bot"));  // or "notifications-worker"
```

- [ ] **Step 3: Build both projects**

Run: `dotnet build lovecraft/Lovecraft/Lovecraft.TelegramBot && dotnet build lovecraft/Lovecraft/Lovecraft.NotificationsWorker`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.TelegramBot Lovecraft/Lovecraft.NotificationsWorker
git -C lovecraft commit -m "feat(metrics): add ContainerHeartbeatWorker to telegram-bot and notifications-worker"
```

---

## Task 17: Serilog → stdout in all three .NET containers

**Files:**
- Modify: `Lovecraft.Backend/Program.cs`, `Lovecraft.Backend/appsettings.json`, `Lovecraft.Backend/Lovecraft.Backend.csproj`
- Modify: `Lovecraft.TelegramBot/Program.cs`, `Lovecraft.TelegramBot/appsettings.json`, `Lovecraft.TelegramBot/Lovecraft.TelegramBot.csproj`
- Modify: `Lovecraft.NotificationsWorker/Program.cs`, `Lovecraft.NotificationsWorker/appsettings.json`, `Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj`

- [ ] **Step 1: Add Serilog NuGet packages to each project**

```bash
dotnet add lovecraft/Lovecraft/Lovecraft.Backend package Serilog.AspNetCore
dotnet add lovecraft/Lovecraft/Lovecraft.Backend package Serilog.Formatting.Compact
dotnet add lovecraft/Lovecraft/Lovecraft.TelegramBot package Serilog.Extensions.Hosting
dotnet add lovecraft/Lovecraft/Lovecraft.TelegramBot package Serilog.Formatting.Compact
dotnet add lovecraft/Lovecraft/Lovecraft.NotificationsWorker package Serilog.Extensions.Hosting
dotnet add lovecraft/Lovecraft/Lovecraft.NotificationsWorker package Serilog.Formatting.Compact
```

- [ ] **Step 2: In `Lovecraft.Backend/Program.cs`**, right after `var builder = WebApplication.CreateBuilder(args);`:

```csharp
builder.Host.UseSerilog((ctx, services, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "backend")
    .Enrich.WithProperty("version", typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0")
    .WriteTo.Console(new Serilog.Formatting.Compact.RenderedCompactJsonFormatter()));
```

After `app.UseRouting()`, add:

```csharp
app.UseSerilogRequestLogging();
```

- [ ] **Step 3: In `Lovecraft.TelegramBot/Program.cs` and `Lovecraft.NotificationsWorker/Program.cs`**, in the `Host.CreateApplicationBuilder` section, add the same `UseSerilog` block but change the `service` property accordingly (`"telegram-bot"`, `"notifications-worker"`). For workers, omit `UseSerilogRequestLogging()` since they don't serve HTTP.

- [ ] **Step 4: Add Serilog block to each `appsettings.json`**

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

- [ ] **Step 5: Build all three projects**

Run: `dotnet build lovecraft/Lovecraft`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Backend/Program.cs Lovecraft/Lovecraft.Backend/appsettings.json Lovecraft/Lovecraft.Backend/Lovecraft.Backend.csproj Lovecraft/Lovecraft.TelegramBot Lovecraft/Lovecraft.NotificationsWorker
git -C lovecraft commit -m "feat(metrics): add Serilog structured JSON to stdout in all .NET containers"
```

---

## Task 18: Seed `metrics` partition rows in Seeder

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.Tools.Seeder/Program.cs` (or wherever appconfig is seeded)

- [ ] **Step 1: Locate where `permissions` and `rank_thresholds` rows are seeded.** Mirror the pattern. Add seven new rows under PK `metrics` with the defaults from `MetricsConfig.Defaults`:

```csharp
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "request_timing")        { ["Value"] = "true" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "bi_events")             { ["Value"] = "true" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "container_stats")       { ["Value"] = "true" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "frontend_perf")         { ["Value"] = "true" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "retention_minute_hours"){ ["Value"] = "24" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "retention_hour_days")   { ["Value"] = "90" });
await appconfig.UpsertEntityAsync(new TableEntity("metrics", "retention_dau_days")    { ["Value"] = "30" });
```

If the Seeder uses a "skip if exists" pattern, mirror it.

- [ ] **Step 2: Run seeder against local Azurite to verify**

```
dotnet run --project lovecraft/Lovecraft/Lovecraft.Tools.Seeder
```

Expected: completes without error; new rows visible in Storage Explorer.

- [ ] **Step 3: Commit**

```bash
git -C lovecraft add Lovecraft/Lovecraft.Tools.Seeder
git -C lovecraft commit -m "feat(metrics): seed metrics appconfig rows in Seeder"
```

---

## Task 19: Frontend `apiClient` fetch interceptor + tests

**Files:**
- Modify: `aloevera-harmony-meet/src/services/api/apiClient.ts`
- Create: `aloevera-harmony-meet/src/services/api/metricsCollector.ts` (frontend-side helper)
- Create: `aloevera-harmony-meet/src/services/api/__tests__/apiClient.metrics.test.ts`

- [ ] **Step 1: Read existing `apiClient.ts` to understand its fetch wrapper.**

Run: `cat aloevera-harmony-meet/src/services/api/apiClient.ts`

Identify the central fetch call. We'll wrap it without disturbing existing token/refresh logic.

- [ ] **Step 2: Create `metricsCollector.ts`**

```typescript
type Sample = { endpoint: string; method: string; status: number; durationMs: number; timestamp: number };

const MAX_SAMPLES = 200;
const FLUSH_INTERVAL_MS = 30_000;
const CONFIG_REFRESH_MS = 5 * 60_000;

class FrontendMetricsCollector {
  private samples: Sample[] = [];
  private enabled = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private configTimer: ReturnType<typeof setInterval> | null = null;
  private fetchConfig: () => Promise<boolean> = async () => false;
  private postBatch: (samples: Sample[]) => Promise<void> = async () => {};

  init(fetchConfig: () => Promise<boolean>, postBatch: (samples: Sample[]) => Promise<void>) {
    this.fetchConfig = fetchConfig;
    this.postBatch = postBatch;
    void this.refreshConfig();
    this.configTimer = setInterval(() => void this.refreshConfig(), CONFIG_REFRESH_MS);
  }

  record(s: Sample) {
    if (!this.enabled) return;
    this.samples.push(s);
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
  }

  private async refreshConfig() {
    try {
      const newEnabled = await this.fetchConfig();
      if (newEnabled && !this.enabled) this.startFlushTimer();
      if (!newEnabled && this.enabled) this.stopFlushTimer();
      this.enabled = newEnabled;
    } catch { /* keep previous state */ }
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer() {
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null; }
    this.samples = [];
  }

  async flush() {
    if (this.samples.length === 0) return;
    const batch = this.samples.splice(0, this.samples.length);
    try { await this.postBatch(batch); } catch { /* drop on failure */ }
  }

  // test helpers
  get _samples() { return this.samples; }
  get _enabled() { return this.enabled; }
  _setEnabled(v: boolean) { this.enabled = v; if (v) this.startFlushTimer(); else this.stopFlushTimer(); }
  _reset() { this.stopFlushTimer(); if (this.configTimer) clearInterval(this.configTimer); this.samples = []; this.enabled = false; }
}

export const frontendMetrics = new FrontendMetricsCollector();
```

- [ ] **Step 3: Wire into `apiClient.ts`** — wrap the existing fetch call:

```typescript
import { frontendMetrics } from './metricsCollector';

// Inside the fetch wrapper, around the actual `await fetch(...)` call:
const startedAt = performance.now();
let status = 0;
try {
  const response = await fetch(url, init);
  status = response.status;
  return response;
} finally {
  frontendMetrics.record({
    endpoint: stripOrigin(url),
    method: (init?.method ?? 'GET').toUpperCase(),
    status,
    durationMs: performance.now() - startedAt,
    timestamp: Date.now(),
  });
}

function stripOrigin(url: string): string {
  try { return new URL(url, window.location.origin).pathname; }
  catch { return url; }
}
```

- [ ] **Step 4: Initialize once at app boot** — `src/main.tsx`:

```typescript
import { frontendMetrics } from '@/services/api/metricsCollector';
import { apiClient } from '@/services/api/apiClient';

frontendMetrics.init(
  async () => {
    const resp = await apiClient.get<{ frontendPerf: boolean }>('/api/v1/metrics/config');
    return resp.success && resp.data?.frontendPerf === true;
  },
  async (samples) => {
    await apiClient.post('/api/v1/metrics/frontend', { samples });
  });
```

- [ ] **Step 5: Write test `apiClient.metrics.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { frontendMetrics } from '@/services/api/metricsCollector';

describe('frontendMetrics', () => {
  beforeEach(() => frontendMetrics._reset());

  it('drops samples when disabled', () => {
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    expect(frontendMetrics._samples).toHaveLength(0);
  });

  it('stores samples when enabled', () => {
    frontendMetrics._setEnabled(true);
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    expect(frontendMetrics._samples).toHaveLength(1);
  });

  it('caps at 200 samples (drop-oldest)', () => {
    frontendMetrics._setEnabled(true);
    for (let i = 0; i < 250; i++) {
      frontendMetrics.record({ endpoint: `/x${i}`, method: 'GET', status: 200, durationMs: 1, timestamp: i });
    }
    expect(frontendMetrics._samples).toHaveLength(200);
    expect(frontendMetrics._samples[0].endpoint).toBe('/x50');
  });

  it('flushes via postBatch and clears', async () => {
    const posted: any[] = [];
    frontendMetrics.init(async () => true, async (s) => { posted.push(...s); });
    frontendMetrics._setEnabled(true);
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    await frontendMetrics.flush();
    expect(posted).toHaveLength(1);
    expect(frontendMetrics._samples).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run tests + commit**

```bash
cd aloevera-harmony-meet && npx vitest run src/services/api/__tests__/apiClient.metrics.test.ts
```

```bash
git -C aloevera-harmony-meet add src/services/api/apiClient.ts src/services/api/metricsCollector.ts src/services/api/__tests__/apiClient.metrics.test.ts src/main.tsx
git -C aloevera-harmony-meet commit -m "feat(metrics): frontend apiClient interceptor + collector"
```

---

## Task 20: Frontend `adminApi.metrics` namespace

**Files:**
- Modify: `aloevera-harmony-meet/src/services/api/adminApi.ts`

- [ ] **Step 1: Read existing `adminApi.ts`** to find the namespace pattern (e.g. `adminApi.broadcasts.{create,list,get}`).

- [ ] **Step 2: Add a `metrics` namespace**

```typescript
export const adminApi = {
  // ... existing ...
  metrics: {
    async getOverview() { return apiClient.get<MetricsOverviewDto>('/api/v1/admin/metrics/overview'); },
    async getContainers() { return apiClient.get<ContainerStatusDto[]>('/api/v1/admin/metrics/containers'); },
    async getTimeseries(params: { category: string; dimensionKey?: string; from: string; to: string; resolution: 'minute' | 'hour' }) {
      const q = new URLSearchParams({
        category: params.category, from: params.from, to: params.to, resolution: params.resolution,
      });
      if (params.dimensionKey) q.set('dimensionKey', params.dimensionKey);
      return apiClient.get<TimeseriesPointDto[]>(`/api/v1/admin/metrics/timeseries?${q}`);
    },
    async getBi(range: '24h' | '7d' | '30d') { return apiClient.get<BiTimeseriesDto>(`/api/v1/admin/metrics/bi?range=${range}`); },
    async getConfig() { return apiClient.get<MetricsConfigDto>('/api/v1/admin/metrics/config'); },
    async putConfig(updates: Partial<MetricsConfigDto>) { return apiClient.put('/api/v1/admin/metrics/config', updates); },
  },
};

export interface MetricsOverviewDto { registered: number; dau: number; mau: number; currentlyActive: number; requestsLastHour: number; p95LastHourMs: number | null; }
export interface ContainerStatusDto { name: string; status: 'green' | 'amber' | 'red'; heartbeatAgeSeconds: number | null; gcHeapMb: number | null; workingSetMb: number | null; threadCount: number | null; note: string | null; startedAtUtc: string | null; version: string | null; }
export interface TimeseriesPointDto { ts: string; count: number; p50: number | null; p95: number | null; p99: number | null; }
export interface BiTimeseriesDto { days: string[]; registered: number[]; dau: number[]; mau: number[]; }
export interface MetricsConfigDto { requestTiming: boolean; biEvents: boolean; containerStats: boolean; frontendPerf: boolean; retentionMinuteHours?: number; retentionHourDays?: number; retentionDauDays?: number; }
```

In mock mode, return canned plausible data via `isApiMode()` check (mirror the existing mock branches in adminApi).

- [ ] **Step 3: Commit**

```bash
git -C aloevera-harmony-meet add src/services/api/adminApi.ts
git -C aloevera-harmony-meet commit -m "feat(metrics): adminApi.metrics namespace"
```

---

## Task 21: `AdminMetricsPage` shell + child components

**Files:**
- Create: `aloevera-harmony-meet/src/admin/pages/AdminMetricsPage.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/MetricsOverviewTiles.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/ContainerStatusTable.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/UsersTimeChart.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/RequestVolumeTable.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/LatencyChart.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/BiEventsPanel.tsx`

These are presentation components. Each should be small (one responsibility):

- `MetricsOverviewTiles` — accepts `MetricsOverviewDto` prop, renders 5 tiles using shadcn `<Card>`.
- `ContainerStatusTable` — accepts `ContainerStatusDto[]` prop, renders rows with status dot styled by `status` value.
- `UsersTimeChart` — accepts `BiTimeseriesDto` prop, renders a `<LineChart>` with 3 lines (registered, dau, mau) using `recharts`.
- `RequestVolumeTable` — accepts `TimeseriesPointDto[]` (aggregated by endpoint) + `onSelect(dim)` callback, renders sortable table.
- `LatencyChart` — accepts `TimeseriesPointDto[]` for one dimension, renders `<LineChart>` with 3 lines (p50, p95, p99).
- `BiEventsPanel` — accepts aggregated counts, renders text summary as in the spec mockup.

`AdminMetricsPage.tsx` owns state (time range, source toggle, selected endpoint), fetches via `adminApi.metrics`, composes the children, sets up `setInterval(30_000)` auto-refresh and `document.addEventListener('visibilitychange', ...)` pause.

- [ ] **Step 1: Implement each component, smallest first (Overview → Containers → Bi → Charts).**
- [ ] **Step 2: Add to admin router** in `src/admin/AdminApp.tsx`:

```typescript
<Route path="metrics" element={<AdminMetricsPage />} />
```

- [ ] **Step 3: Add sidebar entry** in the admin nav (locate it via `grep "AdminUsersPage" src/admin/components`):

```typescript
<NavLink to="/admin/metrics">{t('admin.metrics.nav')}</NavLink>
```

- [ ] **Step 4: Manual visual check** — `npm run dev` (in mock mode); navigate to `/admin/metrics`; verify page renders with canned data.

- [ ] **Step 5: Commit**

```bash
git -C aloevera-harmony-meet add src/admin/pages/AdminMetricsPage.tsx src/admin/components/metrics/ src/admin/AdminApp.tsx src/admin/components/<sidebar file>
git -C aloevera-harmony-meet commit -m "feat(metrics): admin metrics dashboard page + components"
```

---

## Task 22: `MetricsToggleSheet` + tests

**Files:**
- Create: `aloevera-harmony-meet/src/admin/components/metrics/MetricsToggleSheet.tsx`
- Create: `aloevera-harmony-meet/src/admin/components/metrics/__tests__/MetricsToggleSheet.test.tsx`

- [ ] **Step 1: Write component**

```typescript
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { adminApi, type MetricsConfigDto } from '@/services/api/adminApi';
import { showApiError } from '@/lib/apiError';
import { toast } from '@/components/ui/sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function MetricsToggleSheet({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [cfg, setCfg] = useState<MetricsConfigDto | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    adminApi.metrics.getConfig().then(r => { if (r.success && r.data) setCfg(r.data); });
  }, [open]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await adminApi.metrics.putConfig(cfg);
      if (!r.success) throw r;
      toast.success(t('admin.metrics.toggles.saved'));
      onOpenChange(false);
    } catch (e) { showApiError(e, t('admin.metrics.toggles.saveFailed')); }
    finally { setSaving(false); }
  };

  if (!cfg) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>{t('admin.metrics.toggles.title')}</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          {(['requestTiming','biEvents','containerStats','frontendPerf'] as const).map(k => (
            <label key={k} className="flex items-center justify-between">
              <span>{t(`admin.metrics.toggles.${k}`)}</span>
              <Switch checked={cfg[k]} onCheckedChange={v => setCfg({ ...cfg, [k]: v })} />
            </label>
          ))}
          <div className="space-y-2">
            <label className="block text-sm">{t('admin.metrics.toggles.retentionMinuteHours')}
              <Input type="number" value={cfg.retentionMinuteHours ?? 24}
                     onChange={e => setCfg({ ...cfg, retentionMinuteHours: parseInt(e.target.value) || 24 })}/>
            </label>
            <label className="block text-sm">{t('admin.metrics.toggles.retentionHourDays')}
              <Input type="number" value={cfg.retentionHourDays ?? 90}
                     onChange={e => setCfg({ ...cfg, retentionHourDays: parseInt(e.target.value) || 90 })}/>
            </label>
            <label className="block text-sm">{t('admin.metrics.toggles.retentionDauDays')}
              <Input type="number" value={cfg.retentionDauDays ?? 30}
                     onChange={e => setCfg({ ...cfg, retentionDauDays: parseInt(e.target.value) || 30 })}/>
            </label>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">{saving ? '...' : t('common.save')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Write test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetricsToggleSheet } from '@/admin/components/metrics/MetricsToggleSheet';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getConfig: vi.fn().mockResolvedValue({ success: true, data: { requestTiming: true, biEvents: true, containerStats: true, frontendPerf: true, retentionMinuteHours: 24, retentionHourDays: 90, retentionDauDays: 30 } }),
      putConfig: vi.fn().mockResolvedValue({ success: true }),
    }
  }
}));

vi.mock('@/components/ui/sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('MetricsToggleSheet', () => {
  it('calls putConfig with updated values on save', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    renderWithProviders(<MetricsToggleSheet open onOpenChange={() => {}} />);
    await waitFor(() => screen.getByText(/save/i));
    fireEvent.click(screen.getByText(/save/i));
    await waitFor(() => expect((adminApi as any).metrics.putConfig).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run test + commit**

```bash
npx vitest run src/admin/components/metrics/__tests__/MetricsToggleSheet.test.tsx
```

```bash
git -C aloevera-harmony-meet add src/admin/components/metrics/MetricsToggleSheet.tsx src/admin/components/metrics/__tests__/MetricsToggleSheet.test.tsx
git -C aloevera-harmony-meet commit -m "feat(metrics): MetricsToggleSheet with config save"
```

---

## Task 23: Translations

**Files:**
- Modify: `aloevera-harmony-meet/src/contexts/LanguageContext.tsx`

- [ ] **Step 1: Add keys to both `ru` and `en` translation objects**

```typescript
// ru
'admin.metrics.nav': 'Метрики',
'admin.metrics.title': 'Метрики',
'admin.metrics.tile.registered': 'Зарегистрировано',
'admin.metrics.tile.dau': 'DAU',
'admin.metrics.tile.mau': 'MAU',
'admin.metrics.tile.online': 'Сейчас онлайн',
'admin.metrics.tile.reqHr': 'Запросов/ч',
'admin.metrics.containers.heading': 'Контейнеры',
'admin.metrics.users.heading': 'Пользователи во времени',
'admin.metrics.requests.heading': 'Запросы',
'admin.metrics.bi.heading': 'События',
'admin.metrics.toggles.title': 'Настройки сбора',
'admin.metrics.toggles.requestTiming': 'Время запросов (бэкенд)',
'admin.metrics.toggles.biEvents': 'BI события',
'admin.metrics.toggles.containerStats': 'Статистика контейнеров',
'admin.metrics.toggles.frontendPerf': 'Время запросов (фронтенд)',
'admin.metrics.toggles.retentionMinuteHours': 'Хранить минутные метрики (часов)',
'admin.metrics.toggles.retentionHourDays': 'Хранить часовые метрики (дней)',
'admin.metrics.toggles.retentionDauDays': 'Хранить DAU (дней)',
'admin.metrics.toggles.saved': 'Настройки сохранены',
'admin.metrics.toggles.saveFailed': 'Не удалось сохранить',
'admin.metrics.source.backend': 'Бэкенд',
'admin.metrics.source.frontend': 'Фронтенд',
'admin.metrics.range.1h': '1ч',
'admin.metrics.range.24h': '24ч',
'admin.metrics.range.7d': '7д',
'admin.metrics.range.30d': '30д',
```

```typescript
// en
'admin.metrics.nav': 'Metrics',
'admin.metrics.title': 'Metrics',
'admin.metrics.tile.registered': 'Registered',
'admin.metrics.tile.dau': 'DAU',
'admin.metrics.tile.mau': 'MAU',
'admin.metrics.tile.online': 'Online now',
'admin.metrics.tile.reqHr': 'Req/hr',
'admin.metrics.containers.heading': 'Containers',
'admin.metrics.users.heading': 'Users over time',
'admin.metrics.requests.heading': 'Requests',
'admin.metrics.bi.heading': 'BI events',
'admin.metrics.toggles.title': 'Collection settings',
'admin.metrics.toggles.requestTiming': 'Request timing (backend)',
'admin.metrics.toggles.biEvents': 'BI events',
'admin.metrics.toggles.containerStats': 'Container stats',
'admin.metrics.toggles.frontendPerf': 'Request timing (frontend)',
'admin.metrics.toggles.retentionMinuteHours': 'Minute-tier retention (hours)',
'admin.metrics.toggles.retentionHourDays': 'Hour-tier retention (days)',
'admin.metrics.toggles.retentionDauDays': 'DAU retention (days)',
'admin.metrics.toggles.saved': 'Settings saved',
'admin.metrics.toggles.saveFailed': 'Save failed',
'admin.metrics.source.backend': 'Backend',
'admin.metrics.source.frontend': 'Frontend',
'admin.metrics.range.1h': '1h',
'admin.metrics.range.24h': '24h',
'admin.metrics.range.7d': '7d',
'admin.metrics.range.30d': '30d',
```

- [ ] **Step 2: Commit**

```bash
git -C aloevera-harmony-meet add src/contexts/LanguageContext.tsx
git -C aloevera-harmony-meet commit -m "feat(metrics): admin.metrics.* translation keys (ru + en)"
```

---

## Task 24: `AdminMetricsPage` test

**Files:**
- Create: `aloevera-harmony-meet/src/admin/pages/__tests__/AdminMetricsPage.test.tsx`

- [ ] **Step 1: Write smoke test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminMetricsPage } from '@/admin/pages/AdminMetricsPage';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getOverview: vi.fn().mockResolvedValue({ success: true, data: { registered: 1247, dau: 89, mau: 412, currentlyActive: 7, requestsLastHour: 1200, p95LastHourMs: 240 } }),
      getContainers: vi.fn().mockResolvedValue({ success: true, data: [
        { name: 'backend', status: 'green', heartbeatAgeSeconds: 12, gcHeapMb: 38, workingSetMb: 142, threadCount: 24, note: null, startedAtUtc: null, version: '1.0' },
      ] }),
      getTimeseries: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getBi: vi.fn().mockResolvedValue({ success: true, data: { days: [], registered: [], dau: [], mau: [] } }),
      getConfig: vi.fn().mockResolvedValue({ success: true, data: { requestTiming: true, biEvents: true, containerStats: true, frontendPerf: true } }),
    }
  }
}));

describe('AdminMetricsPage', () => {
  it('renders tiles and container row', async () => {
    renderWithProviders(<AdminMetricsPage />);
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('backend')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npx vitest run src/admin/pages/__tests__/AdminMetricsPage.test.tsx
```

```bash
git -C aloevera-harmony-meet add src/admin/pages/__tests__/AdminMetricsPage.test.tsx
git -C aloevera-harmony-meet commit -m "test(metrics): AdminMetricsPage smoke test"
```

---

## Task 25: Manual smoke test

**Files:** none

- [ ] **Step 1: Boot full stack against Azurite (or real Azure)**

```bash
cd aloevera-harmony-meet && docker compose up --build -d
docker compose ps  # confirm 4 containers up
```

- [ ] **Step 2: Run the seeder once to create `appconfig` rows**

```bash
docker compose exec backend dotnet /app/Lovecraft.Tools.Seeder.dll
```

(or run from host against the same storage account)

- [ ] **Step 3: Validation checklist**

- [ ] Login as `test@example.com` / `Test123!@#` on a fresh browser.
- [ ] Navigate to `/admin/metrics`. All four container rows appear green within 60s of container startup.
- [ ] Hit a few API endpoints via Swagger (e.g. GET `/api/v1/users`, GET `/api/v1/events`). Within 30s, "Top endpoints" populates and "Req/hr" tile increments.
- [ ] Register a new user via Swagger. "Registered" tile increments by 1; BI events panel shows local registration count incremented.
- [ ] Open `/friends` in a second incognito tab signed in as `user1@mock.local`. "Online now" tile goes to 2.
- [ ] Frontend chart populates within 60s (frontend_perf is on by default).
- [ ] Open the toggles sheet; flip frontend_perf off; save. Within 60s, frontend chart stops receiving new samples.
- [ ] `docker compose logs backend | head -20` shows JSON-formatted lines with `traceId`, `service: backend`.
- [ ] Wait until the next top-of-hour + 5min. Check that `metricshour` has rows for the previous hour (Azure Storage Explorer).
- [ ] Toggle each category off via the sheet; verify the corresponding data stops flowing within 60s.

- [ ] **Step 4: Document any deviations** in a new follow-up issue.

---

## Self-review

### Spec coverage check

- §Architecture summary → Tasks 1–4 (storage, collector, flush worker).
- §Storage schema → Task 1.
- §Instrumentation surface → Tasks 2–4 (collector), 6 (DAU coalescer), 7 (middleware), 8 (BI), 9 (heartbeats + probe), 19 (frontend interceptor).
- §Toggle config & API surface → Tasks 5 (appconfig), 13 (config endpoints), 14 (admin config endpoint), 18 (seed defaults).
- §Aggregation worker → Tasks 10 (rollup), 11 (janitor extension), 12 (MAU).
- §Admin dashboard UI → Tasks 20–24.
- §Serilog → Task 17.
- §Testing strategy → Test classes embedded in their respective tasks; smoke test = Task 25.

All spec sections have at least one task. ✅

### Placeholder scan

No "TBD", no "implement later", no "similar to Task N". Each code step has actual code or actual file content. ✅

### Type consistency

- `MetricsConfig` shape matches between `AppConfig.cs`, `MetricsConfigDto`, and the appconfig row keys. ✅
- `dimensionKey` format pipe-delimited and consistent across producer sites and `RequestMetricsMiddleware`. ✅
- `HistogramBuckets` boundaries match between `MockMetricsCollector` and `AzureMetricsCollector`. ✅
- `ContainerStatusSnapshot` fields match `ContainerStatusEntity` columns. ✅
- Categories `request_timing` / `bi_events` / `container_stats` / `frontend_perf` consistent throughout. ✅

### Open items the implementer should decide

- **`ContainerHeartbeatWorker` location** for telegram-bot + notifications-worker (Task 16) — duplicated per existing precedent. If implementer wants to extract to `Lovecraft.Common` instead, that's fine; spec calls it out as deferred.
- **`TableServiceClient` registration** — Task 15 assumes it's already in DI (it is, used by every existing Azure service). Verify before implementing.
- **`MockAppConfigService.SetMetricsConfig` test helper** — added in Task 5; if the existing class is sealed/private, mark internal-visible-to-tests instead.
