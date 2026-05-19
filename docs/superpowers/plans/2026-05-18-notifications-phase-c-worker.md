# Notifications — Phase C (Worker Scaffold) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `Lovecraft.NotificationsWorker` container — a separate hosted-service process (mirroring `Lovecraft.TelegramBot`) that drains `notificationsoutbox` rows, aggregates digests, and cleans up old data. Channel dispatchers (Telegram, Email) ship as **stubs** in Phase C — fleshed out in D and F. After C lands, the full pipeline works end-to-end with logging dispatchers; D and E add the real Telegram and Web Push delivery, F adds real email.

**Architecture:** New `Microsoft.NET.Sdk.Worker` project alongside `Lovecraft.TelegramBot`. Three `BackgroundService` loops: `DispatcherWorker` (10s tick) drains `OUTBOX_{channel}_PENDING` partitions whose `RowKey <= now`, calls per-channel `IDispatcher.DispatchAsync`, moves rows to `DONE_{date}` on success or back to `PENDING` with backoff on failure (`DEAD_{date}` after 5 attempts). `DigestWorker` (top-of-hour) aggregates Hourly + Daily rows per (user, channel) into digest models — stubs render the digest as a log entry in C. `JanitorWorker` (3am UTC daily) deletes `OUTBOX_*_DONE_*` / `*_DEAD_*` partitions older than 30 days and `notifications` rows older than 90 days. **The worker only runs in Azure mode** — `USE_AZURE_STORAGE=false` deployments don't need it.

**Tech Stack:** .NET 10 Worker SDK (`Microsoft.NET.Sdk.Worker`), `Microsoft.Extensions.Hosting`, `Azure.Data.Tables`, xUnit + Moq for tests.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Predecessors:**
- [`2026-05-17-notifications-phase-a-foundations.md`](./2026-05-17-notifications-phase-a-foundations.md) (backend foundations)
- [`2026-05-18-notifications-phase-b-in-app.md`](./2026-05-18-notifications-phase-b-in-app.md) (producer wiring + in-app UI)

**Scope decision (Phase C):**
- Worker scaffold + outbox processor + digest aggregator + janitor
- **Channel dispatchers are STUBS** — `StubTelegramDispatcher` and `StubEmailDispatcher` log `"would dispatch X to user Y"` and return success
- `EventReminderWorker` deferred to Phase G (bundled with admin broadcast)
- `WebPushDispatcher` is NOT in the worker — Web Push is in-process from the API in Phase E (fires-and-forgets via HTTP from `Lovecraft.Backend`)
- Mock-mode worker is not meaningful — backend runs in-process with no separate worker. Document clearly.

**Repos:**
- Backend: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)
- Frontend: `D:\src\aloevera-harmony-meet` (commits via `git -C 'D:\src\aloevera-harmony-meet'` — only docker-compose + docs)

**Branches:**
- Backend: `feat/notifications-phase-c`
- Frontend: `feat/notifications-phase-c` (only docker-compose update + docs)

**Test command:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Build: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`

---

## File map

### Backend new files (`D:\src\lovecraft\Lovecraft\`)

| File | Responsibility |
|---|---|
| `Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj` | Worker project (mirrors `Lovecraft.TelegramBot` shape) |
| `Lovecraft.NotificationsWorker\Program.cs` | Host builder, DI wiring, AddHostedService for 3 workers |
| `Lovecraft.NotificationsWorker\TableNames.cs` | 3 string constants (Notifications, NotificationsOutbox, NotificationPreferences) — duplicates the backend constants per Phase A spec |
| `Lovecraft.NotificationsWorker\Entities\NotificationEntity.cs` | Duplicate of backend's `NotificationEntity` |
| `Lovecraft.NotificationsWorker\Entities\NotificationOutboxEntity.cs` | Duplicate |
| `Lovecraft.NotificationsWorker\Entities\NotificationPreferencesEntity.cs` | Duplicate |
| `Lovecraft.NotificationsWorker\Workers\DispatcherWorker.cs` | `BackgroundService` with 10s tick; delegates to `IOutboxProcessor` |
| `Lovecraft.NotificationsWorker\Workers\DigestWorker.cs` | `BackgroundService` aligned to top-of-hour; delegates to `IDigestProcessor` |
| `Lovecraft.NotificationsWorker\Workers\JanitorWorker.cs` | `BackgroundService` daily at 3am UTC; delegates to `IOutboxJanitor` |
| `Lovecraft.NotificationsWorker\Services\IOutboxProcessor.cs` + `OutboxProcessor.cs` | Pure loop logic: scan PENDING for a channel, dispatch, move to DONE/DEAD/PENDING-with-backoff |
| `Lovecraft.NotificationsWorker\Services\IDigestProcessor.cs` + `DigestProcessor.cs` | Pure aggregation logic: bucket pending Hourly + Daily rows per (user, channel), produce digest model, mark delivered |
| `Lovecraft.NotificationsWorker\Services\IOutboxJanitor.cs` + `OutboxJanitor.cs` | Pure cleanup logic: delete old DONE/DEAD partitions; purge ancient notifications |
| `Lovecraft.NotificationsWorker\Dispatchers\ITelegramDispatcher.cs` | Interface |
| `Lovecraft.NotificationsWorker\Dispatchers\IEmailDispatcher.cs` | Interface |
| `Lovecraft.NotificationsWorker\Dispatchers\StubTelegramDispatcher.cs` | Logs "would dispatch", returns success |
| `Lovecraft.NotificationsWorker\Dispatchers\StubEmailDispatcher.cs` | Logs "would dispatch", returns success |
| `Lovecraft.NotificationsWorker\Models\NotificationModel.cs` | Lightweight DTO used internally by worker (built from entity reads) |
| `Lovecraft.NotificationsWorker\Models\DigestModel.cs` | Aggregated payload for the digest renderer |
| `Dockerfile.notifications-worker` | Build + runtime image (mirrors `Dockerfile.telegram-bot`) |

### Backend tests (`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\`)

| File | Tests |
|---|---|
| `NotificationsWorker\OutboxProcessorTests.cs` | 6+ tests: empty partition, dispatch success → DONE, dispatch failure → retry with backoff, 5-failure → DEAD, ignores not-yet-scheduled rows |
| `NotificationsWorker\DigestProcessorTests.cs` | 4+ tests: bucketing Hourly vs Daily, daily only fires on user's hour, empty group → no-op, single-row renders as non-digest |
| `NotificationsWorker\OutboxJanitorTests.cs` | 3 tests: deletes old DONE partitions, deletes old DEAD partitions, purges ancient notifications |
| `NotificationsWorker\StubDispatcherTests.cs` | 2 tests: stub returns success + logs once per dispatch |

### Backend modifications (`D:\src\lovecraft\Lovecraft\`)

| File | Change |
|---|---|
| `Lovecraft.slnx` | + `Lovecraft.NotificationsWorker` project |
| `Lovecraft.UnitTests\Lovecraft.UnitTests.csproj` | + ProjectReference to `Lovecraft.NotificationsWorker` |

### Frontend modifications (`D:\src\aloevera-harmony-meet\`)

| File | Change |
|---|---|
| `docker-compose.yml` | + `notifications-worker` service (mirrors `telegram-bot` block) |

### Docs

| File | Change |
|---|---|
| `lovecraft\Lovecraft\docs\NOTIFICATIONS.md` | Append Phase C section (worker arch, 3 loops, stub dispatchers) |
| `lovecraft\Lovecraft\docs\ARCHITECTURE.md` | Add `Lovecraft.NotificationsWorker` to project tree |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | One-line entry |
| `aloevera-harmony-meet\docs\ISSUES.md` | Update MCF.4 progress (Phases A+B+C shipped; D/E/F pending) |

---

## Task ordering

Tasks 0–1 set up the project + entity duplicates. Tasks 2–3 build the OutboxProcessor (core loop logic) + stub dispatchers. Task 4 wraps it in `DispatcherWorker`. Tasks 5–6 do the same for the digest path. Tasks 7–8 for janitor. Task 9 wires Program.cs DI. Task 10 adds the Dockerfile + compose service. Task 11 docs. Task 12 final verification.

---

## Task 0: Create feature branches

**Files:** none modified.

- [ ] **Step 1: Create backend branch**

```bash
git -C 'D:\src\lovecraft' checkout main
git -C 'D:\src\lovecraft' pull --ff-only
git -C 'D:\src\lovecraft' checkout -b feat/notifications-phase-c
```

- [ ] **Step 2: Create frontend branch**

```bash
git -C 'D:\src\aloevera-harmony-meet' checkout main
git -C 'D:\src\aloevera-harmony-meet' pull --ff-only
git -C 'D:\src\aloevera-harmony-meet' checkout -b feat/notifications-phase-c
```

No commit; branch setup only.

---

## Task 1: Create `Lovecraft.NotificationsWorker` project scaffold

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Program.cs` (minimal — full DI in Task 9)
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\TableNames.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Entities\NotificationEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Entities\NotificationOutboxEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Entities\NotificationPreferencesEntity.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.slnx`

- [ ] **Step 1: Write `Lovecraft.NotificationsWorker.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk.Worker">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Lovecraft.NotificationsWorker</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="10.0.0" />
    <PackageReference Include="Azure.Data.Tables" Version="12.10.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\Lovecraft.Common\Lovecraft.Common.csproj" />
  </ItemGroup>

</Project>
```

(Verify `Azure.Data.Tables` version against what `Lovecraft.Backend.csproj` uses — match it. If different, update to match.)

- [ ] **Step 2: Write minimal `Program.cs`**

```csharp
var builder = Host.CreateApplicationBuilder(args);

// DI registrations happen in Task 9.
// For now, just enough to build and run as a no-op:

var host = builder.Build();
await host.RunAsync();
```

- [ ] **Step 3: Write `TableNames.cs`**

```csharp
namespace Lovecraft.NotificationsWorker;

/// <summary>
/// Worker-local copy of the notification-related table names.
/// Mirrors backend's `Lovecraft.Backend.Storage.TableNames` — keep in sync.
/// Respects the same `AZURE_TABLE_PREFIX` env var the backend uses.
/// </summary>
public static class TableNames
{
    public static string Prefix { get; set; } = Environment.GetEnvironmentVariable("AZURE_TABLE_PREFIX") ?? string.Empty;

    public static string Notifications           => Prefix + "notifications";
    public static string NotificationsOutbox     => Prefix + "notificationsoutbox";
    public static string NotificationPreferences => Prefix + "notificationpreferences";
}
```

- [ ] **Step 4: Duplicate `NotificationEntity.cs` into the worker project**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

/// <summary>
/// Mirror of Lovecraft.Backend.Storage.Entities.NotificationEntity.
/// Keep in sync — schema drift between projects causes silent runtime errors.
/// </summary>
public class NotificationEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string NotificationId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? ActorId { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
    public DateTime? DismissedAtUtc { get; set; }
    public string? DigestGroupId { get; set; }
    public string? SourceEventId { get; set; }
    public bool IsRead { get; set; }
    public bool IsDismissed { get; set; }

    public static string GetPartitionKey(string userId) => userId;
    public static string GetRowKey(string notificationId, DateTime createdAtUtc) =>
        $"{(DateTime.MaxValue.Ticks - createdAtUtc.Ticks):D19}_{notificationId}";
}
```

- [ ] **Step 5: Duplicate `NotificationOutboxEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

/// <summary>
/// Mirror of Lovecraft.Backend.Storage.Entities.NotificationOutboxEntity.
/// Keep in sync.
/// </summary>
public class NotificationOutboxEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string UserId { get; set; } = string.Empty;
    public string NotificationId { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public DateTime ScheduledForUtc { get; set; }
    public int Attempts { get; set; }
    public string? LastErrorMessage { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }

    public static string PendingPartition(string channel) => $"OUTBOX_{channel}_PENDING";
    public static string DonePartition(string channel, DateTime utc) =>
        $"OUTBOX_{channel}_DONE_{utc:yyyy-MM-dd}";
    public static string DeadPartition(string channel, DateTime utc) =>
        $"OUTBOX_{channel}_DEAD_{utc:yyyy-MM-dd}";
    public static string GetRowKey(DateTime scheduledForUtc, string notificationId) =>
        $"{scheduledForUtc:yyyy-MM-ddTHH:mm:ss}_{notificationId}";
}
```

- [ ] **Step 6: Duplicate `NotificationPreferencesEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

/// <summary>
/// Mirror of Lovecraft.Backend.Storage.Entities.NotificationPreferencesEntity.
/// Keep in sync.
/// </summary>
public class NotificationPreferencesEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = "INDEX";
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string MatrixJson { get; set; } = "{}";
    public string FrequencyJson { get; set; } = "{}";
    public int DailyDigestHourUtc { get; set; } = 9;
    public bool Mute { get; set; }
    public DateTime? MutedUntilUtc { get; set; }
}
```

- [ ] **Step 7: Add the project to the solution**

In `D:\src\lovecraft\Lovecraft\Lovecraft.slnx`, add the new project entry inside `<Solution>`:

```xml
<Project Path="Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj" />
```

- [ ] **Step 8: Build the solution**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: 5 projects build (Backend, Common, UnitTests, Tools.Seeder, TelegramBot, NotificationsWorker). All succeed.

- [ ] **Step 9: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/' 'Lovecraft/Lovecraft.slnx'
git -C 'D:\src\lovecraft' commit -m "notifications: scaffold Lovecraft.NotificationsWorker project + entity duplicates"
```

---

## Task 2: Channel dispatcher interfaces + stub implementations

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Dispatchers\ITelegramDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Dispatchers\IEmailDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Dispatchers\StubTelegramDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Dispatchers\StubEmailDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Models\NotificationModel.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\StubDispatcherTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj` (add project reference)

The dispatcher interface uses a `NotificationModel` (lightweight DTO) so the loop logic doesn't pass entities around. `DispatchAsync` returns a result enum: `Delivered`, `RetryableError`, `PermanentError`. Stubs always return `Delivered`.

- [ ] **Step 1: Add ProjectReference to UnitTests csproj**

In `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj`, inside the `<ItemGroup>` with other `<ProjectReference>` entries:

```xml
<ProjectReference Include="..\Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj" />
```

Verify by `dotnet build`.

- [ ] **Step 2: Write `Models/NotificationModel.cs`**

```csharp
namespace Lovecraft.NotificationsWorker.Models;

/// <summary>
/// Lightweight notification representation used by worker dispatchers.
/// Built from `NotificationEntity` reads.
/// </summary>
public record NotificationModel(
    string NotificationId,
    string UserId,
    string Type,
    string? ActorId,
    string PayloadJson,
    DateTime CreatedAtUtc);

public enum DispatchResult
{
    Delivered,
    RetryableError,
    PermanentError,
}
```

- [ ] **Step 3: Write `Dispatchers/ITelegramDispatcher.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;

namespace Lovecraft.NotificationsWorker.Dispatchers;

public interface ITelegramDispatcher
{
    Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct);
}
```

- [ ] **Step 4: Write `Dispatchers/IEmailDispatcher.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;

namespace Lovecraft.NotificationsWorker.Dispatchers;

public interface IEmailDispatcher
{
    Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct);
}
```

- [ ] **Step 5: Write failing tests**

`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\StubDispatcherTests.cs`:

```csharp
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class StubDispatcherTests
{
    private static NotificationModel SampleNotification() =>
        new("n1", "u1", "LikeReceived", "u2", "{}", DateTime.UtcNow);

    [Fact]
    public async Task StubTelegramDispatcher_returns_Delivered()
    {
        var dispatcher = new StubTelegramDispatcher(NullLogger<StubTelegramDispatcher>.Instance);
        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);
        Assert.Equal(DispatchResult.Delivered, result);
    }

    [Fact]
    public async Task StubEmailDispatcher_returns_Delivered()
    {
        var dispatcher = new StubEmailDispatcher(NullLogger<StubEmailDispatcher>.Instance);
        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);
        Assert.Equal(DispatchResult.Delivered, result);
    }
}
```

- [ ] **Step 6: Run tests, verify failure**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~StubDispatcherTests"
```
Expected: compile error — stubs don't exist.

- [ ] **Step 7: Write `StubTelegramDispatcher.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Dispatchers;

/// <summary>
/// Phase C stub. Logs the dispatch and returns Delivered.
/// Replace with real implementation in Phase D (Telegram.Bot SendMessage + inline keyboard).
/// </summary>
public class StubTelegramDispatcher : ITelegramDispatcher
{
    private readonly ILogger<StubTelegramDispatcher> _logger;

    public StubTelegramDispatcher(ILogger<StubTelegramDispatcher> logger)
    {
        _logger = logger;
    }

    public Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct)
    {
        _logger.LogInformation(
            "[STUB Telegram] would dispatch notification {NotificationId} ({Type}) to user {UserId}",
            notification.NotificationId, notification.Type, notification.UserId);
        return Task.FromResult(DispatchResult.Delivered);
    }
}
```

- [ ] **Step 8: Write `StubEmailDispatcher.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Dispatchers;

/// <summary>
/// Phase C stub. Logs the dispatch and returns Delivered.
/// Replace with real SendGrid digest renderer in Phase F.
/// </summary>
public class StubEmailDispatcher : IEmailDispatcher
{
    private readonly ILogger<StubEmailDispatcher> _logger;

    public StubEmailDispatcher(ILogger<StubEmailDispatcher> logger)
    {
        _logger = logger;
    }

    public Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct)
    {
        _logger.LogInformation(
            "[STUB Email] would dispatch notification {NotificationId} ({Type}) to user {UserId}",
            notification.NotificationId, notification.Type, notification.UserId);
        return Task.FromResult(DispatchResult.Delivered);
    }
}
```

- [ ] **Step 9: Run tests, verify pass**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~StubDispatcherTests"
```
Expected: 2 tests pass.

- [ ] **Step 10: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/' 'Lovecraft/Lovecraft.NotificationsWorker/Models/' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/' 'Lovecraft/Lovecraft.UnitTests/Lovecraft.UnitTests.csproj'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: channel dispatcher interfaces + stub implementations"
```

---

## Task 3: `IOutboxProcessor` — loop logic with retry/backoff

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\IOutboxProcessor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\OutboxProcessor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\OutboxProcessorTests.cs`

The processor takes a channel name, scans `OUTBOX_{channel}_PENDING` for rows with `RowKey <= now`, loads each notification's full data, dispatches via the matching channel dispatcher, then:
- **Delivered**: delete from PENDING, insert into `OUTBOX_{channel}_DONE_{yyyy-MM-dd}` with `DeliveredAtUtc = now`
- **RetryableError**: bump `Attempts`, if >= 5 → move to `DEAD_{yyyy-MM-dd}`, else update `ScheduledForUtc = now + backoff(Attempts)` and re-insert into PENDING with new RowKey
- **PermanentError**: move to `DEAD_{yyyy-MM-dd}` immediately

Backoff schedule: `{ 30s, 2m, 10m, 1h, 6h }` keyed by `Attempts` (0-indexed).

- [ ] **Step 1: Write the failing tests**

`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\OutboxProcessorTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class OutboxProcessorTests
{
    private static NotificationOutboxEntity MakeRow(string channel, DateTime scheduledForUtc, int attempts = 0, string nid = "n1") =>
        new()
        {
            PartitionKey = NotificationOutboxEntity.PendingPartition(channel),
            RowKey = NotificationOutboxEntity.GetRowKey(scheduledForUtc, nid),
            NotificationId = nid,
            UserId = "u1",
            Channel = channel,
            Frequency = "Immediate",
            ScheduledForUtc = scheduledForUtc,
            Attempts = attempts,
            ETag = new ETag("etag"),
        };

    private static NotificationEntity MakeNotif(string nid = "n1") => new()
    {
        PartitionKey = NotificationEntity.GetPartitionKey("u1"),
        RowKey = "rk",
        NotificationId = nid,
        UserId = "u1",
        Type = "LikeReceived",
        PayloadJson = "{}",
        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-1),
    };

    private static (OutboxProcessor processor, Mock<TableClient> outbox, Mock<TableClient> notifs, Mock<ITelegramDispatcher> dispatcher)
        Build(DispatchResult dispatchResult)
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var dispatcher = new Mock<ITelegramDispatcher>();
        dispatcher.Setup(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dispatchResult);

        // Set up notification lookup
        var notifEntity = MakeNotif();
        var notifPage = Azure.Pageable<NotificationEntity>.FromPages(new[]
        {
            Azure.Page<NotificationEntity>.FromValues(new[] { notifEntity }, null, new Mock<Response>().Object),
        });
        notifs.Setup(t => t.Query<NotificationEntity>(It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(notifPage);

        var processor = new OutboxProcessor(
            outbox.Object, notifs.Object,
            dispatcher.Object, Mock.Of<IEmailDispatcher>(),
            NullLogger<OutboxProcessor>.Instance);

        return (processor, outbox, notifs, dispatcher);
    }

    [Fact]
    public async Task Empty_partition_does_nothing()
    {
        var (processor, outbox, _, dispatcher) = Build(DispatchResult.Delivered);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerable.Empty<NotificationOutboxEntity>().ToAsyncPageable());

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        dispatcher.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Successful_dispatch_moves_row_to_DONE_partition()
    {
        var now = DateTime.UtcNow;
        var (processor, outbox, _, dispatcher) = Build(DispatchResult.Delivered);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Telegram", now.AddMinutes(-1)) }.ToAsyncPageable());

        NotificationOutboxEntity? doneRow = null;
        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .Callback<NotificationOutboxEntity, CancellationToken>((e, _) => doneRow = e)
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        dispatcher.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.NotNull(doneRow);
        Assert.StartsWith("OUTBOX_Telegram_DONE_", doneRow!.PartitionKey);
        Assert.NotNull(doneRow.DeliveredAtUtc);
    }

    [Fact]
    public async Task Retryable_error_reschedules_with_backoff()
    {
        var now = DateTime.UtcNow;
        var (processor, outbox, _, _) = Build(DispatchResult.RetryableError);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Telegram", now.AddMinutes(-1), attempts: 0) }.ToAsyncPageable());

        NotificationOutboxEntity? rescheduledRow = null;
        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .Callback<NotificationOutboxEntity, CancellationToken>((e, _) => rescheduledRow = e)
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        Assert.NotNull(rescheduledRow);
        Assert.StartsWith("OUTBOX_Telegram_PENDING", rescheduledRow!.PartitionKey);
        Assert.Equal(1, rescheduledRow.Attempts);
        Assert.True(rescheduledRow.ScheduledForUtc >= now.AddSeconds(29) && rescheduledRow.ScheduledForUtc <= now.AddSeconds(31),
            $"Expected ~30s backoff, got {rescheduledRow.ScheduledForUtc - now}");
    }

    [Fact]
    public async Task After_5_retryable_failures_row_moves_to_DEAD()
    {
        var now = DateTime.UtcNow;
        var (processor, outbox, _, _) = Build(DispatchResult.RetryableError);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Telegram", now.AddMinutes(-1), attempts: 4) }.ToAsyncPageable());

        NotificationOutboxEntity? written = null;
        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .Callback<NotificationOutboxEntity, CancellationToken>((e, _) => written = e)
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        Assert.NotNull(written);
        Assert.StartsWith("OUTBOX_Telegram_DEAD_", written!.PartitionKey);
        Assert.Equal(5, written.Attempts);
    }

    [Fact]
    public async Task Permanent_error_moves_to_DEAD_immediately()
    {
        var now = DateTime.UtcNow;
        var (processor, outbox, _, _) = Build(DispatchResult.PermanentError);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Telegram", now.AddMinutes(-1), attempts: 0) }.ToAsyncPageable());

        NotificationOutboxEntity? written = null;
        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .Callback<NotificationOutboxEntity, CancellationToken>((e, _) => written = e)
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        Assert.NotNull(written);
        Assert.StartsWith("OUTBOX_Telegram_DEAD_", written!.PartitionKey);
    }

    [Fact]
    public async Task Future_scheduled_rows_are_not_processed_via_RowKey_filter()
    {
        // OData filter `RowKey le '{now}'` excludes future rows — verify the filter string is correctly formed.
        var (processor, outbox, _, dispatcher) = Build(DispatchResult.Delivered);
        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerable.Empty<NotificationOutboxEntity>().ToAsyncPageable());

        await processor.ProcessChannelAsync("Telegram", CancellationToken.None);

        outbox.Verify(t => t.QueryAsync<NotificationOutboxEntity>(
            It.Is<string>(f => f.Contains("RowKey le") || f.Contains("RowKey lt")),
            It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}

// Helper to convert an enumerable to AsyncPageable<T> for Moq:
internal static class AsyncPageableExtensions
{
    public static AsyncPageable<T> ToAsyncPageable<T>(this IEnumerable<T> items) where T : notnull
    {
        var page = Page<T>.FromValues(items.ToList(), null, new Mock<Response>().Object);
        return AsyncPageable<T>.FromPages(new[] { page });
    }
}
```

- [ ] **Step 2: Run tests, verify compile failure**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~OutboxProcessorTests"
```
Expected: compile error — `OutboxProcessor` and `IOutboxProcessor` don't exist.

- [ ] **Step 3: Write `IOutboxProcessor.cs`**

```csharp
namespace Lovecraft.NotificationsWorker.Services;

/// <summary>
/// Drains pending outbox rows for one channel, dispatches via the channel's dispatcher,
/// and moves rows to DONE/DEAD/PENDING-with-backoff based on dispatch result.
/// </summary>
public interface IOutboxProcessor
{
    Task ProcessChannelAsync(string channel, CancellationToken ct);
}
```

- [ ] **Step 4: Write `OutboxProcessor.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Services;

public class OutboxProcessor : IOutboxProcessor
{
    private static readonly TimeSpan[] Backoff =
    {
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(10),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
    };

    private const int MaxAttempts = 5;

    private readonly TableClient _outbox;
    private readonly TableClient _notifications;
    private readonly ITelegramDispatcher _telegram;
    private readonly IEmailDispatcher _email;
    private readonly ILogger<OutboxProcessor> _logger;

    public OutboxProcessor(
        TableClient outbox,
        TableClient notifications,
        ITelegramDispatcher telegram,
        IEmailDispatcher email,
        ILogger<OutboxProcessor> logger)
    {
        _outbox = outbox;
        _notifications = notifications;
        _telegram = telegram;
        _email = email;
        _logger = logger;
    }

    public async Task ProcessChannelAsync(string channel, CancellationToken ct)
    {
        var pendingPartition = NotificationOutboxEntity.PendingPartition(channel);
        var now = DateTime.UtcNow;
        var rowKeyCeiling = $"{now:yyyy-MM-ddTHH:mm:ss}_~";    // "~" sorts after all digit/hex chars

        var filter = $"PartitionKey eq '{pendingPartition}' and RowKey le '{rowKeyCeiling}'";

        await foreach (var row in _outbox.QueryAsync<NotificationOutboxEntity>(filter).WithCancellation(ct))
        {
            // Frequency=Hourly/Daily rows are handled by DigestWorker. The DispatcherWorker only processes Immediate rows.
            if (row.Frequency != "Immediate") continue;

            try
            {
                var notification = await LoadNotificationAsync(row.UserId, row.NotificationId, ct);
                if (notification is null)
                {
                    _logger.LogWarning("Outbox row references unknown notification {NotificationId}; marking as PermanentError",
                        row.NotificationId);
                    await MoveToDeadAsync(row, "Notification not found", ct);
                    continue;
                }

                var result = channel switch
                {
                    "Telegram" => await _telegram.DispatchAsync(notification, ct),
                    "Email" => await _email.DispatchAsync(notification, ct),
                    _ => DispatchResult.PermanentError,
                };

                switch (result)
                {
                    case DispatchResult.Delivered:
                        await MoveToDoneAsync(row, ct);
                        break;
                    case DispatchResult.RetryableError:
                        await RescheduleAsync(row, ct);
                        break;
                    case DispatchResult.PermanentError:
                        await MoveToDeadAsync(row, "PermanentError from dispatcher", ct);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing outbox row {RowKey}", row.RowKey);
                try { await RescheduleAsync(row, ct); } catch { /* swallow — leaving row in PENDING with old RowKey is fine for next tick */ }
            }
        }
    }

    private async Task<NotificationModel?> LoadNotificationAsync(string userId, string notificationId, CancellationToken ct)
    {
        var filter = $"PartitionKey eq '{userId}' and NotificationId eq '{notificationId}'";
        await foreach (var entity in _notifications.QueryAsync<NotificationEntity>(filter, maxPerPage: 1).WithCancellation(ct))
        {
            return new NotificationModel(
                entity.NotificationId, entity.UserId, entity.Type,
                entity.ActorId, entity.PayloadJson, entity.CreatedAtUtc);
        }
        return null;
    }

    private async Task MoveToDoneAsync(NotificationOutboxEntity row, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var doneEntity = new NotificationOutboxEntity
        {
            PartitionKey = NotificationOutboxEntity.DonePartition(row.Channel, now),
            RowKey = row.RowKey,
            UserId = row.UserId,
            NotificationId = row.NotificationId,
            Channel = row.Channel,
            Frequency = row.Frequency,
            ScheduledForUtc = row.ScheduledForUtc,
            Attempts = row.Attempts,
            DeliveredAtUtc = now,
        };
        await _outbox.AddEntityAsync(doneEntity, ct);
        await _outbox.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
    }

    private async Task MoveToDeadAsync(NotificationOutboxEntity row, string error, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var deadEntity = new NotificationOutboxEntity
        {
            PartitionKey = NotificationOutboxEntity.DeadPartition(row.Channel, now),
            RowKey = row.RowKey,
            UserId = row.UserId,
            NotificationId = row.NotificationId,
            Channel = row.Channel,
            Frequency = row.Frequency,
            ScheduledForUtc = row.ScheduledForUtc,
            Attempts = row.Attempts,
            LastErrorMessage = error,
        };
        await _outbox.AddEntityAsync(deadEntity, ct);
        await _outbox.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
    }

    private async Task RescheduleAsync(NotificationOutboxEntity row, CancellationToken ct)
    {
        var newAttempts = row.Attempts + 1;
        if (newAttempts >= MaxAttempts)
        {
            row.Attempts = newAttempts;
            await MoveToDeadAsync(row, $"Exceeded {MaxAttempts} attempts", ct);
            return;
        }

        var backoffIdx = Math.Min(newAttempts - 1, Backoff.Length - 1);   // attempts 1..N use Backoff[0..N-1]
        var rescheduledFor = DateTime.UtcNow + Backoff[backoffIdx];

        var rescheduled = new NotificationOutboxEntity
        {
            PartitionKey = row.PartitionKey,    // still PENDING
            RowKey = NotificationOutboxEntity.GetRowKey(rescheduledFor, row.NotificationId),
            UserId = row.UserId,
            NotificationId = row.NotificationId,
            Channel = row.Channel,
            Frequency = row.Frequency,
            ScheduledForUtc = rescheduledFor,
            Attempts = newAttempts,
            LastErrorMessage = "Retryable error — backoff scheduled",
        };
        await _outbox.AddEntityAsync(rescheduled, ct);
        await _outbox.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
    }
}
```

- [ ] **Step 5: Run tests, verify pass**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~OutboxProcessorTests"
```
Expected: 6 tests pass.

If `Pageable<T>.FromPages` / `Page<T>.FromValues` API surface differs from the test's usage, adapt the test helper. The exact method names may vary by Azure SDK version — match what the existing `AzureNotificationServiceTests` uses (or read the Azure SDK reference docs for the version pinned in `Lovecraft.Backend.csproj`).

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Services/' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/OutboxProcessorTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: IOutboxProcessor with retry/backoff/dead-letter + tests"
```

---

## Task 4: `DispatcherWorker` BackgroundService

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Workers\DispatcherWorker.cs`

10-second tick. For each channel (`"Telegram"`, `"Email"`), call `IOutboxProcessor.ProcessChannelAsync`.

No tests for the BackgroundService wrapper itself — the loop logic is tested via `OutboxProcessorTests`. The worker is a thin scheduling layer.

- [ ] **Step 1: Write `DispatcherWorker.cs`**

```csharp
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public class DispatcherWorker : BackgroundService
{
    private static readonly string[] Channels = { "Telegram", "Email" };
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(10);

    private readonly IOutboxProcessor _processor;
    private readonly ILogger<DispatcherWorker> _logger;

    public DispatcherWorker(IOutboxProcessor processor, ILogger<DispatcherWorker> logger)
    {
        _processor = processor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DispatcherWorker starting; tick interval {Interval}s", TickInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            foreach (var channel in Channels)
            {
                try
                {
                    await _processor.ProcessChannelAsync(channel, stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "DispatcherWorker channel {Channel} failed; will retry next tick", channel);
                }
            }

            try { await Task.Delay(TickInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        _logger.LogInformation("DispatcherWorker stopped");
    }
}
```

- [ ] **Step 2: Build**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Workers/DispatcherWorker.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: DispatcherWorker BackgroundService (10s tick)"
```

---

## Task 5: `IDigestProcessor` — hourly + daily aggregation

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Models\DigestModel.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\IDigestProcessor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\DigestProcessor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\DigestProcessorTests.cs`

The digest processor runs at top-of-hour. For each channel `Telegram` and `Email` (NOT InApp or WebPush — they're validated to be Immediate-only):
1. Scan `OUTBOX_{channel}_PENDING` for rows where `Frequency == "Hourly"` (always) OR `Frequency == "Daily"` AND `now.Hour == prefs.DailyDigestHourUtc` for that user.
2. Group rows by `userId`.
3. For each user with pending rows:
   - Build a `DigestModel` containing the user id + a list of `NotificationModel`s
   - Assign a shared `DigestGroupId` (GUID); update each `notifications` row with that group id
   - Dispatch via the stub channel dispatcher (logs in Phase C)
   - Move all member outbox rows to `DONE`

For Phase C, the dispatch is a stub log — no real rendering. The aggregation correctness is what we're testing.

- [ ] **Step 1: Write `Models/DigestModel.cs`**

```csharp
namespace Lovecraft.NotificationsWorker.Models;

public record DigestModel(string UserId, IReadOnlyList<NotificationModel> Members);
```

- [ ] **Step 2: Write the failing tests**

`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\DigestProcessorTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class DigestProcessorTests
{
    private static NotificationOutboxEntity MakeRow(string channel, string userId, string nid, string frequency = "Hourly") =>
        new()
        {
            PartitionKey = NotificationOutboxEntity.PendingPartition(channel),
            RowKey = NotificationOutboxEntity.GetRowKey(DateTime.UtcNow.AddMinutes(-1), nid),
            NotificationId = nid,
            UserId = userId,
            Channel = channel,
            Frequency = frequency,
            ScheduledForUtc = DateTime.UtcNow.AddMinutes(-1),
            ETag = new ETag("e"),
        };

    private static NotificationPreferencesEntity MakePrefs(string userId, int dailyHourUtc = 9) => new()
    {
        PartitionKey = userId,
        RowKey = "INDEX",
        DailyDigestHourUtc = dailyHourUtc,
    };

    [Fact]
    public async Task Hourly_rows_dispatched_every_hour()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var prefs = new Mock<TableClient>();
        var telegram = new Mock<ITelegramDispatcher>();
        telegram.Setup(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(DispatchResult.Delivered);

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Telegram", "u1", "n1", "Hourly") }.ToAsyncPageable());

        // Notifications lookup — one entity per LoadAsync
        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { new NotificationEntity { NotificationId = "n1", UserId = "u1", Type = "LikeReceived", PayloadJson = "{}", CreatedAtUtc = DateTime.UtcNow } }.ToAsyncPageable());

        // Preferences lookup
        prefs.Setup(t => t.GetEntityAsync<NotificationPreferencesEntity>(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Response.FromValue(MakePrefs("u1"), new Mock<Response>().Object));

        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        var processor = new DigestProcessor(outbox.Object, notifs.Object, prefs.Object,
            telegram.Object, Mock.Of<IEmailDispatcher>(), NullLogger<DigestProcessor>.Instance);

        await processor.ProcessAsync(new DateTime(2026, 5, 18, 14, 0, 0, DateTimeKind.Utc), CancellationToken.None);

        telegram.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Daily_rows_dispatched_only_on_user_hour()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var prefs = new Mock<TableClient>();
        var email = new Mock<IEmailDispatcher>();
        email.Setup(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(DispatchResult.Delivered);

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { MakeRow("Email", "u1", "n1", "Daily") }.ToAsyncPageable());

        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { new NotificationEntity { NotificationId = "n1", UserId = "u1", Type = "LikeReceived", PayloadJson = "{}", CreatedAtUtc = DateTime.UtcNow } }.ToAsyncPageable());

        prefs.Setup(t => t.GetEntityAsync<NotificationPreferencesEntity>(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Response.FromValue(MakePrefs("u1", dailyHourUtc: 9), new Mock<Response>().Object));

        var processor = new DigestProcessor(outbox.Object, notifs.Object, prefs.Object,
            Mock.Of<ITelegramDispatcher>(), email.Object, NullLogger<DigestProcessor>.Instance);

        // At 8 UTC → no dispatch
        await processor.ProcessAsync(new DateTime(2026, 5, 18, 8, 0, 0, DateTimeKind.Utc), CancellationToken.None);
        email.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Never);

        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        // At 9 UTC → dispatch
        await processor.ProcessAsync(new DateTime(2026, 5, 18, 9, 0, 0, DateTimeKind.Utc), CancellationToken.None);
        email.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Multiple_rows_per_user_grouped_into_one_dispatch()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var prefs = new Mock<TableClient>();
        var telegram = new Mock<ITelegramDispatcher>();
        telegram.Setup(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(DispatchResult.Delivered);

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[]
            {
                MakeRow("Telegram", "u1", "n1", "Hourly"),
                MakeRow("Telegram", "u1", "n2", "Hourly"),
                MakeRow("Telegram", "u1", "n3", "Hourly"),
            }.ToAsyncPageable());

        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns<string, int?, IEnumerable<string>, CancellationToken>((filter, _, _, _) =>
            {
                // Return a notif matching the requested id (extract from filter)
                var nid = filter.Split("NotificationId eq '")[1].TrimEnd('\'');
                return new[] { new NotificationEntity { NotificationId = nid, UserId = "u1", Type = "LikeReceived", PayloadJson = "{}", CreatedAtUtc = DateTime.UtcNow } }.ToAsyncPageable();
            });

        prefs.Setup(t => t.GetEntityAsync<NotificationPreferencesEntity>(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Response.FromValue(MakePrefs("u1"), new Mock<Response>().Object));

        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        var processor = new DigestProcessor(outbox.Object, notifs.Object, prefs.Object,
            telegram.Object, Mock.Of<IEmailDispatcher>(), NullLogger<DigestProcessor>.Instance);

        await processor.ProcessAsync(new DateTime(2026, 5, 18, 14, 0, 0, DateTimeKind.Utc), CancellationToken.None);

        // One dispatch per user, even with 3 pending rows
        telegram.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Empty_partition_does_nothing()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var prefs = new Mock<TableClient>();
        var telegram = new Mock<ITelegramDispatcher>();

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(Array.Empty<NotificationOutboxEntity>().ToAsyncPageable());

        var processor = new DigestProcessor(outbox.Object, notifs.Object, prefs.Object,
            telegram.Object, Mock.Of<IEmailDispatcher>(), NullLogger<DigestProcessor>.Instance);

        await processor.ProcessAsync(DateTime.UtcNow, CancellationToken.None);

        telegram.Verify(d => d.DispatchAsync(It.IsAny<NotificationModel>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

- [ ] **Step 3: Run tests, verify fail**

Expected: compile error.

- [ ] **Step 4: Write `IDigestProcessor.cs` + `DigestProcessor.cs`**

`IDigestProcessor.cs`:
```csharp
namespace Lovecraft.NotificationsWorker.Services;

public interface IDigestProcessor
{
    /// <summary>
    /// Aggregates and dispatches Hourly + Daily outbox rows.
    /// `now` is taken as a parameter so tests can pin the wall clock.
    /// </summary>
    Task ProcessAsync(DateTime now, CancellationToken ct);
}
```

`DigestProcessor.cs`:
```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Services;

public class DigestProcessor : IDigestProcessor
{
    private static readonly string[] DigestChannels = { "Telegram", "Email" };

    private readonly TableClient _outbox;
    private readonly TableClient _notifications;
    private readonly TableClient _preferences;
    private readonly ITelegramDispatcher _telegram;
    private readonly IEmailDispatcher _email;
    private readonly ILogger<DigestProcessor> _logger;

    public DigestProcessor(
        TableClient outbox,
        TableClient notifications,
        TableClient preferences,
        ITelegramDispatcher telegram,
        IEmailDispatcher email,
        ILogger<DigestProcessor> logger)
    {
        _outbox = outbox;
        _notifications = notifications;
        _preferences = preferences;
        _telegram = telegram;
        _email = email;
        _logger = logger;
    }

    public async Task ProcessAsync(DateTime now, CancellationToken ct)
    {
        foreach (var channel in DigestChannels)
        {
            var pendingPartition = NotificationOutboxEntity.PendingPartition(channel);
            var filter = $"PartitionKey eq '{pendingPartition}'";

            // Group rows by userId
            var byUser = new Dictionary<string, List<NotificationOutboxEntity>>();
            await foreach (var row in _outbox.QueryAsync<NotificationOutboxEntity>(filter).WithCancellation(ct))
            {
                if (row.Frequency != "Hourly" && row.Frequency != "Daily") continue;
                if (!byUser.TryGetValue(row.UserId, out var list))
                {
                    list = new List<NotificationOutboxEntity>();
                    byUser[row.UserId] = list;
                }
                list.Add(row);
            }

            foreach (var (userId, rows) in byUser)
            {
                // For Daily rows, check user's DailyDigestHourUtc
                int dailyHour = 9;
                try
                {
                    var prefsResp = await _preferences.GetEntityAsync<NotificationPreferencesEntity>(userId, "INDEX", cancellationToken: ct);
                    dailyHour = prefsResp.Value.DailyDigestHourUtc;
                }
                catch (RequestFailedException ex) when (ex.Status == 404) { /* defaults */ }

                var eligible = rows.Where(r =>
                    r.Frequency == "Hourly" ||
                    (r.Frequency == "Daily" && now.Hour == dailyHour)).ToList();

                if (eligible.Count == 0) continue;

                // Load each notification
                var members = new List<NotificationModel>();
                foreach (var row in eligible)
                {
                    var notif = await LoadNotificationAsync(row.UserId, row.NotificationId, ct);
                    if (notif is not null) members.Add(notif);
                }

                if (members.Count == 0) continue;

                var digest = new DigestModel(userId, members);

                // Dispatch (stub in Phase C — logs, returns Delivered)
                var first = members[0];
                var result = channel switch
                {
                    "Telegram" => await _telegram.DispatchAsync(first, ct),    // stub ignores rest
                    "Email" => await _email.DispatchAsync(first, ct),
                    _ => DispatchResult.PermanentError,
                };

                if (result == DispatchResult.Delivered)
                {
                    foreach (var row in eligible)
                    {
                        var now2 = DateTime.UtcNow;
                        var doneRow = new NotificationOutboxEntity
                        {
                            PartitionKey = NotificationOutboxEntity.DonePartition(row.Channel, now2),
                            RowKey = row.RowKey,
                            UserId = row.UserId,
                            NotificationId = row.NotificationId,
                            Channel = row.Channel,
                            Frequency = row.Frequency,
                            ScheduledForUtc = row.ScheduledForUtc,
                            Attempts = row.Attempts,
                            DeliveredAtUtc = now2,
                        };
                        await _outbox.AddEntityAsync(doneRow, ct);
                        await _outbox.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
                    }
                }
                else
                {
                    _logger.LogWarning("Digest dispatch for user {UserId} channel {Channel} returned {Result}; rows remain pending",
                        userId, channel, result);
                }
            }
        }
    }

    private async Task<NotificationModel?> LoadNotificationAsync(string userId, string notificationId, CancellationToken ct)
    {
        var filter = $"PartitionKey eq '{userId}' and NotificationId eq '{notificationId}'";
        await foreach (var entity in _notifications.QueryAsync<NotificationEntity>(filter, maxPerPage: 1).WithCancellation(ct))
        {
            return new NotificationModel(
                entity.NotificationId, entity.UserId, entity.Type,
                entity.ActorId, entity.PayloadJson, entity.CreatedAtUtc);
        }
        return null;
    }
}
```

**Note:** The Phase C digest dispatch passes only the **first** member to the stub dispatcher — that's all the stub needs to log. Phase F replaces the stub with a real `EmailDispatcher` that takes the full `DigestModel` and renders all members. The interface may need to expand in Phase F (e.g. a separate `DispatchDigestAsync(DigestModel)` method), but for Phase C the single-member call is sufficient.

- [ ] **Step 5: Run tests, verify pass**

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Models/DigestModel.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Services/IDigestProcessor.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Services/DigestProcessor.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/DigestProcessorTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: IDigestProcessor (hourly + daily aggregation) + tests"
```

---

## Task 6: `DigestWorker` BackgroundService

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Workers\DigestWorker.cs`

Aligned to top-of-hour: on startup, compute `delay = nextHour - now`, then `Task.Delay(delay)`, then call processor and loop hourly.

- [ ] **Step 1: Write `DigestWorker.cs`**

```csharp
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public class DigestWorker : BackgroundService
{
    private static readonly TimeSpan HourInterval = TimeSpan.FromHours(1);

    private readonly IDigestProcessor _processor;
    private readonly ILogger<DigestWorker> _logger;

    public DigestWorker(IDigestProcessor processor, ILogger<DigestWorker> logger)
    {
        _processor = processor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Sleep until top of next hour
        var now = DateTime.UtcNow;
        var nextHour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1);
        var initialDelay = nextHour - now;
        _logger.LogInformation("DigestWorker starting; first tick at {NextHour} (in {Delay})", nextHour, initialDelay);

        try { await Task.Delay(initialDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _processor.ProcessAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DigestWorker tick failed; will retry next hour");
            }

            try { await Task.Delay(HourInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        _logger.LogInformation("DigestWorker stopped");
    }
}
```

- [ ] **Step 2: Build + commit**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Workers/DigestWorker.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: DigestWorker BackgroundService (top-of-hour ticks)"
```

---

## Task 7: `IOutboxJanitor` — cleanup old partitions

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\IOutboxJanitor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\OutboxJanitor.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\OutboxJanitorTests.cs`

The janitor cleans up:
- Outbox rows in `OUTBOX_*_DONE_{date}` and `OUTBOX_*_DEAD_{date}` partitions older than **30 days**
- Notifications rows older than **90 days** (PartitionKey is userId — we can't enumerate without scanning all users, so we scan with a filter on `CreatedAtUtc lt <cutoff>`)

For Phase C, the janitor takes the wall clock as a parameter for test pinning.

- [ ] **Step 1: Write the failing tests**

`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\OutboxJanitorTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class OutboxJanitorTests
{
    [Fact]
    public async Task Deletes_outbox_rows_in_partitions_older_than_30_days()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var now = new DateTime(2026, 5, 18, 3, 0, 0, DateTimeKind.Utc);
        var oldDate = now.AddDays(-31);
        var oldRow = new NotificationOutboxEntity
        {
            PartitionKey = NotificationOutboxEntity.DonePartition("Telegram", oldDate),
            RowKey = "rk",
            ETag = new ETag("e"),
            Channel = "Telegram",
        };

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { oldRow }.ToAsyncPageable());
        outbox.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(Array.Empty<NotificationEntity>().ToAsyncPageable());

        var janitor = new OutboxJanitor(outbox.Object, notifs.Object, NullLogger<OutboxJanitor>.Instance);
        await janitor.RunAsync(now, CancellationToken.None);

        outbox.Verify(t => t.DeleteEntityAsync(
            oldRow.PartitionKey, oldRow.RowKey, It.IsAny<ETag>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Deletes_notification_rows_older_than_90_days()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var now = new DateTime(2026, 5, 18, 3, 0, 0, DateTimeKind.Utc);
        var oldNotif = new NotificationEntity
        {
            PartitionKey = "u1",
            RowKey = "rk",
            ETag = new ETag("e"),
            CreatedAtUtc = now.AddDays(-91),
        };

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(Array.Empty<NotificationOutboxEntity>().ToAsyncPageable());

        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { oldNotif }.ToAsyncPageable());
        notifs.Setup(t => t.DeleteEntityAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Mock<Response>().Object);

        var janitor = new OutboxJanitor(outbox.Object, notifs.Object, NullLogger<OutboxJanitor>.Instance);
        await janitor.RunAsync(now, CancellationToken.None);

        notifs.Verify(t => t.DeleteEntityAsync(
            oldNotif.PartitionKey, oldNotif.RowKey, It.IsAny<ETag>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Does_not_delete_recent_rows()
    {
        var outbox = new Mock<TableClient>();
        var notifs = new Mock<TableClient>();
        var now = new DateTime(2026, 5, 18, 3, 0, 0, DateTimeKind.Utc);
        var recentRow = new NotificationOutboxEntity
        {
            PartitionKey = NotificationOutboxEntity.DonePartition("Telegram", now.AddDays(-5)),
            RowKey = "rk",
            ETag = new ETag("e"),
        };

        outbox.Setup(t => t.QueryAsync<NotificationOutboxEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(new[] { recentRow }.ToAsyncPageable());
        notifs.Setup(t => t.QueryAsync<NotificationEntity>(
                It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .Returns(Array.Empty<NotificationEntity>().ToAsyncPageable());

        var janitor = new OutboxJanitor(outbox.Object, notifs.Object, NullLogger<OutboxJanitor>.Instance);
        await janitor.RunAsync(now, CancellationToken.None);

        outbox.Verify(t => t.DeleteEntityAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ETag>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Write `IOutboxJanitor.cs` + `OutboxJanitor.cs`**

`IOutboxJanitor.cs`:
```csharp
namespace Lovecraft.NotificationsWorker.Services;

public interface IOutboxJanitor
{
    Task RunAsync(DateTime now, CancellationToken ct);
}
```

`OutboxJanitor.cs`:
```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Services;

public class OutboxJanitor : IOutboxJanitor
{
    private const int OutboxRetentionDays = 30;
    private const int NotificationRetentionDays = 90;

    private readonly TableClient _outbox;
    private readonly TableClient _notifications;
    private readonly ILogger<OutboxJanitor> _logger;

    public OutboxJanitor(TableClient outbox, TableClient notifications, ILogger<OutboxJanitor> logger)
    {
        _outbox = outbox;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task RunAsync(DateTime now, CancellationToken ct)
    {
        await CleanOutboxAsync(now, ct);
        await CleanNotificationsAsync(now, ct);
    }

    private async Task CleanOutboxAsync(DateTime now, CancellationToken ct)
    {
        // Scan all DONE_/DEAD_ partitions; check PartitionKey for embedded date suffix.
        // We can't query by partition prefix in OData, so we filter client-side after fetching the partition list — costly but rare (once/day).
        var cutoff = now.AddDays(-OutboxRetentionDays);

        var filter = "PartitionKey ge 'OUTBOX_' and PartitionKey lt 'OUTBOX`'";    // 'OUTBOX_' through next char before `
        var count = 0;
        await foreach (var row in _outbox.QueryAsync<NotificationOutboxEntity>(filter).WithCancellation(ct))
        {
            // PartitionKey format: OUTBOX_{channel}_{status}_{yyyy-MM-dd}
            // Status: PENDING | DONE | DEAD — skip PENDING (active queue), check DONE/DEAD
            if (row.PartitionKey.Contains("_PENDING")) continue;
            var lastUnderscore = row.PartitionKey.LastIndexOf('_');
            if (lastUnderscore < 0) continue;
            var datePart = row.PartitionKey.Substring(lastUnderscore + 1);
            if (!DateTime.TryParse(datePart, out var partitionDate)) continue;
            if (partitionDate >= cutoff) continue;

            try
            {
                await _outbox.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
                count++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete old outbox row {PK}/{RK}", row.PartitionKey, row.RowKey);
            }
        }
        _logger.LogInformation("OutboxJanitor: deleted {Count} old outbox rows (cutoff {Cutoff})", count, cutoff);
    }

    private async Task CleanNotificationsAsync(DateTime now, CancellationToken ct)
    {
        var cutoff = now.AddDays(-NotificationRetentionDays);
        var filter = $"CreatedAtUtc lt datetime'{cutoff:O}'";
        var count = 0;
        await foreach (var row in _notifications.QueryAsync<NotificationEntity>(filter).WithCancellation(ct))
        {
            try
            {
                await _notifications.DeleteEntityAsync(row.PartitionKey, row.RowKey, row.ETag, ct);
                count++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete old notification row {PK}/{RK}", row.PartitionKey, row.RowKey);
            }
        }
        _logger.LogInformation("OutboxJanitor: deleted {Count} old notifications (cutoff {Cutoff})", count, cutoff);
    }
}
```

- [ ] **Step 4: Run tests, verify pass**

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Services/IOutboxJanitor.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Services/OutboxJanitor.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/OutboxJanitorTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: IOutboxJanitor + tests"
```

---

## Task 8: `JanitorWorker` BackgroundService

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Workers\JanitorWorker.cs`

Runs daily at 3:00 UTC. On startup, compute `delay = next3am - now`, then sleep, then run janitor every 24h.

- [ ] **Step 1: Write `JanitorWorker.cs`**

```csharp
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public class JanitorWorker : BackgroundService
{
    private static readonly TimeSpan DayInterval = TimeSpan.FromHours(24);
    private const int ScheduledHourUtc = 3;

    private readonly IOutboxJanitor _janitor;
    private readonly ILogger<JanitorWorker> _logger;

    public JanitorWorker(IOutboxJanitor janitor, ILogger<JanitorWorker> logger)
    {
        _janitor = janitor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var now = DateTime.UtcNow;
        var nextRun = new DateTime(now.Year, now.Month, now.Day, ScheduledHourUtc, 0, 0, DateTimeKind.Utc);
        if (nextRun <= now) nextRun = nextRun.AddDays(1);
        var initialDelay = nextRun - now;
        _logger.LogInformation("JanitorWorker starting; first run at {Next} (in {Delay})", nextRun, initialDelay);

        try { await Task.Delay(initialDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _janitor.RunAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JanitorWorker run failed");
            }

            try { await Task.Delay(DayInterval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Workers/JanitorWorker.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: JanitorWorker BackgroundService (daily 3am UTC)"
```

---

## Task 9: `Program.cs` DI wiring

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Program.cs`

Read `AZURE_STORAGE_CONNECTION_STRING` from env. If missing, log a fatal and exit (worker can't run without Azure). Create three `TableClient`s (notifications, notificationsoutbox, notificationpreferences). Register processors, dispatchers (stubs), and the three `BackgroundService`s.

- [ ] **Step 1: Rewrite `Program.cs`**

```csharp
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Services;
using Lovecraft.NotificationsWorker.Workers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddLogging(b => b.AddSimpleConsole(o => { o.TimestampFormat = "yyyy-MM-dd HH:mm:ss "; o.IncludeScopes = false; }));

var connectionString = Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
if (string.IsNullOrEmpty(connectionString))
{
    Console.Error.WriteLine("AZURE_STORAGE_CONNECTION_STRING is not set; notifications worker cannot start.");
    return;
}

var useAzure = Environment.GetEnvironmentVariable("USE_AZURE_STORAGE")?.Equals("true", StringComparison.OrdinalIgnoreCase) ?? false;
if (!useAzure)
{
    Console.Error.WriteLine("USE_AZURE_STORAGE != true; notifications worker only runs in Azure mode. Exiting.");
    return;
}

var serviceClient = new TableServiceClient(connectionString);
var notificationsTable = serviceClient.GetTableClient(TableNames.Notifications);
var outboxTable = serviceClient.GetTableClient(TableNames.NotificationsOutbox);
var preferencesTable = serviceClient.GetTableClient(TableNames.NotificationPreferences);

// Tables are created by the backend on startup — worker assumes they exist.
// Defensive: CreateIfNotExists is idempotent.
notificationsTable.CreateIfNotExists();
outboxTable.CreateIfNotExists();
preferencesTable.CreateIfNotExists();

// Register table clients as named-by-type singletons. Since multiple TableClients share the same type,
// register as factory-resolved by parameter name in each service constructor:
builder.Services.AddSingleton(notificationsTable);
// outbox + preferences are accessed via the processors that take them explicitly:

builder.Services.AddSingleton<ITelegramDispatcher, StubTelegramDispatcher>();
builder.Services.AddSingleton<IEmailDispatcher, StubEmailDispatcher>();

builder.Services.AddSingleton<IOutboxProcessor>(sp =>
    new OutboxProcessor(
        outboxTable, notificationsTable,
        sp.GetRequiredService<ITelegramDispatcher>(),
        sp.GetRequiredService<IEmailDispatcher>(),
        sp.GetRequiredService<ILogger<OutboxProcessor>>()));

builder.Services.AddSingleton<IDigestProcessor>(sp =>
    new DigestProcessor(
        outboxTable, notificationsTable, preferencesTable,
        sp.GetRequiredService<ITelegramDispatcher>(),
        sp.GetRequiredService<IEmailDispatcher>(),
        sp.GetRequiredService<ILogger<DigestProcessor>>()));

builder.Services.AddSingleton<IOutboxJanitor>(sp =>
    new OutboxJanitor(outboxTable, notificationsTable, sp.GetRequiredService<ILogger<OutboxJanitor>>()));

builder.Services.AddHostedService<DispatcherWorker>();
builder.Services.AddHostedService<DigestWorker>();
builder.Services.AddHostedService<JanitorWorker>();

var host = builder.Build();
await host.RunAsync();
```

- [ ] **Step 2: Build**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: build succeeds.

- [ ] **Step 3: Run full test suite**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: 354 (Phase B) + 15 (Phase C tests: 2 stub + 6 outbox + 4 digest + 3 janitor) = ~369. Some count may differ slightly; verify all green.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: DI wiring + 3 hosted services"
```

---

## Task 10: Dockerfile + docker-compose service entry

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Dockerfile.notifications-worker`
- Modify: `D:\src\aloevera-harmony-meet\docker-compose.yml`

- [ ] **Step 1: Write `Dockerfile.notifications-worker`**

```dockerfile
# Notifications outbox worker (Worker)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj", "Lovecraft.NotificationsWorker/"]
COPY ["Lovecraft.Common/Lovecraft.Common.csproj", "Lovecraft.Common/"]
RUN dotnet restore "Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj"

COPY . .
WORKDIR "/src/Lovecraft.NotificationsWorker"
RUN dotnet publish "Lovecraft.NotificationsWorker.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV DOTNET_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Lovecraft.NotificationsWorker.dll"]
```

- [ ] **Step 2: Add `notifications-worker` service to `docker-compose.yml`**

In `D:\src\aloevera-harmony-meet\docker-compose.yml`, insert after the `telegram-bot:` service block, before the `frontend:` block:

```yaml
  # Notifications outbox worker (no inbound port; reads/writes Azure Tables)
  notifications-worker:
    build:
      context: ../lovecraft/Lovecraft
      dockerfile: Dockerfile.notifications-worker
    container_name: aloevera-notifications-worker
    env_file:
      - ../lovecraft/Lovecraft/.env
    networks:
      - aloevera-network
    restart: unless-stopped
```

- [ ] **Step 3: Verify the Dockerfile builds (locally — does not require pushing)**

```bash
docker build -f 'D:\src\lovecraft\Lovecraft\Dockerfile.notifications-worker' -t lovecraft-notifications-worker:test 'D:\src\lovecraft\Lovecraft'
```
Expected: image builds without errors. The build context is `D:\src\lovecraft\Lovecraft` (so Common csproj is on the path).

If Docker isn't available locally, skip — the CI / production build will catch errors. Note this in the commit message if you skip.

- [ ] **Step 4: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Dockerfile.notifications-worker'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: add Dockerfile"

git -C 'D:\src\aloevera-harmony-meet' add 'docker-compose.yml'
git -C 'D:\src\aloevera-harmony-meet' commit -m "compose: add notifications-worker service"
```

---

## Task 11: Documentation

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\NOTIFICATIONS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\ARCHITECTURE.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md`

- [ ] **Step 1: Append Phase C section to backend `NOTIFICATIONS.md`**

```markdown
## Phase C — shipped 2026-MM-DD

**Worker container:** new `Lovecraft.NotificationsWorker` project alongside `Lovecraft.TelegramBot`. Runs three `BackgroundService` loops:

- **DispatcherWorker** (10s tick): drains `OUTBOX_{channel}_PENDING` rows whose `RowKey <= now` and `Frequency = Immediate`. Dispatches via `ITelegramDispatcher` or `IEmailDispatcher` (stubs in Phase C — log + return Delivered). Moves rows to `OUTBOX_{channel}_DONE_{date}` on success, `*_DEAD_{date}` after 5 retryable failures or 1 permanent failure. Retry backoff `{ 30s, 2m, 10m, 1h, 6h }`.
- **DigestWorker** (top-of-hour): aggregates `Frequency in (Hourly, Daily)` rows per user × channel. Daily rows are only dispatched when `now.Hour == user.DailyDigestHourUtc`. One dispatch per (user, channel) group regardless of member count.
- **JanitorWorker** (3am UTC daily): deletes `OUTBOX_*_DONE_*` / `*_DEAD_*` partitions older than 30 days; deletes `notifications` rows older than 90 days.

**Stub dispatchers:** `StubTelegramDispatcher` and `StubEmailDispatcher` log `"would dispatch X to user Y"` and return success. Replaced by real implementations in Phase D (Telegram.Bot SendMessage + inline keyboard) and Phase F (SendGrid digest renderer + signed unsubscribe links).

**Web Push is NOT in the worker** — it's dispatched in-process from `Lovecraft.Backend` (Phase E adds the dispatcher and VAPID config; outbox rows for `webPush` are written but the worker ignores them per channel filtering).

**Mock mode:** worker only runs when `USE_AZURE_STORAGE=true`. Local dev with `USE_AZURE_STORAGE=false` skips the worker entirely (backend runs in-process with all mock storage).

**Entity duplication:** `NotificationEntity`, `NotificationOutboxEntity`, `NotificationPreferencesEntity` are duplicated under `Lovecraft.NotificationsWorker/Entities/`. Keep in sync with `Lovecraft.Backend/Storage/Entities/`. Helpers like `PendingPartition()`, `DonePartition()`, `DeadPartition()`, `GetRowKey()` are duplicated.

**Outbox lifecycle illustrated:**
```
[producer writes]                [worker drains]
PENDING (Immediate, ready) ───►  DONE_{date}      (success)
                          ───►  DEAD_{date}      (5 retryable / 1 permanent)
                          ───►  PENDING (rescheduled, attempts+1)  (retryable)

[digest worker, top of hour]
PENDING (Hourly)        ───►  DONE_{date}        (aggregated, one dispatch per (user, channel))
PENDING (Daily)         ───►  DONE_{date}        (only when now.Hour == prefs.DailyDigestHourUtc)
```

**Required env vars (worker container):**
```
USE_AZURE_STORAGE=true
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_TABLE_PREFIX=                  # optional; mirrors backend's prefix
```
(No JWT, no SendGrid, no Telegram bot token in Phase C — stubs require nothing. Phases D and F add their respective configs.)
```

- [ ] **Step 2: Update `ARCHITECTURE.md`**

Add `Lovecraft.NotificationsWorker/` to the project structure tree:

```
├── Lovecraft.NotificationsWorker/    # Outbox dispatcher + digest aggregator + janitor (Phase C+)
│   ├── Dispatchers/                  # ITelegramDispatcher, IEmailDispatcher (stubs in C; real in D/F)
│   ├── Entities/                     # Duplicate of notification entities (sync with Backend)
│   ├── Models/                       # NotificationModel, DigestModel
│   ├── Services/                     # OutboxProcessor, DigestProcessor, OutboxJanitor
│   └── Workers/                      # DispatcherWorker, DigestWorker, JanitorWorker (BackgroundServices)
```

- [ ] **Step 3: Add one line to `IMPLEMENTATION_SUMMARY.md`**

Under "Done since the original plan", append:

```
- ✅ Notifications Phase C: Lovecraft.NotificationsWorker container with DispatcherWorker (10s), DigestWorker (top-of-hour), JanitorWorker (3am UTC). Channel dispatchers are stubs (log + Delivered). Phase D adds real Telegram; Phase F adds real email.
```

- [ ] **Step 4: Update `ISSUES.md`**

In MCF.4's Resolution block, append:

```
Phase C (worker scaffold) shipped 2026-MM-DD. DispatcherWorker / DigestWorker / JanitorWorker land with stub dispatchers; Phases D/E/F add Telegram, Web Push, Email respectively.
```

- [ ] **Step 5: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md' 'Lovecraft/docs/ARCHITECTURE.md' 'Lovecraft/docs/IMPLEMENTATION_SUMMARY.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase C (worker scaffold)"

git -C 'D:\src\aloevera-harmony-meet' add 'docs/ISSUES.md'
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase C status (MCF.4)"
```

---

## Task 12: Final verification

**Files:** none modified.

- [ ] **Step 1: Build the whole backend solution**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: 6 projects build (added NotificationsWorker). 0 errors.

- [ ] **Step 2: Run the full test suite**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --nologo
```
Expected: 354 (B) + ~15 (C) tests pass.

- [ ] **Step 3: Smoke-test the worker startup (optional)**

If you have an Azure storage connection string available:
```
$env:USE_AZURE_STORAGE='true'
$env:AZURE_STORAGE_CONNECTION_STRING='<conn>'
dotnet run --project 'D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj'
```
Expected: console output shows `DispatcherWorker starting`, `DigestWorker starting`, `JanitorWorker starting`. No errors. Ctrl+C to stop.

If no Azure connection is available, skip.

- [ ] **Step 4: Verify git state on both repos**

```
git -C 'D:\src\lovecraft' status                 # clean
git -C 'D:\src\lovecraft' log --oneline main..HEAD
git -C 'D:\src\aloevera-harmony-meet' status     # clean
git -C 'D:\src\aloevera-harmony-meet' log --oneline main..HEAD
```

- [ ] **Step 5: Marker commits (optional)**

```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase C complete"
git -C 'D:\src\aloevera-harmony-meet' commit --allow-empty -m "notifications: phase C complete"
```

---

## Known issue carried over from Phase A/B

Phase A's `NotificationProducer.ProduceAsync` enqueues outbox rows for **every** resolved channel — including `InApp` and (future) `WebPush`. These channels are dispatched **in-process** from the API server, but their outbox rows stay in `OUTBOX_{InApp|WebPush}_PENDING` forever because:
- DispatcherWorker only scans `Telegram` and `Email` partitions
- JanitorWorker only cleans `DONE_` / `DEAD_` partitions (never `PENDING`)

This isn't a correctness bug — nothing reads those PENDING rows — but they accumulate over time. Two follow-up options:
1. **Producer skips outbox for in-process channels** — `NotificationProducer` only calls `EnqueueOutboxAsync` for `Telegram`/`Email`. Cleanest. Touches `Lovecraft.Backend`, not the worker.
2. **In-process dispatch path marks outbox as immediately delivered** — extra writes per in-app/web-push notification. Worse.

**Recommended:** Track as a Phase D follow-up (when WebPush adds another orphaning channel). For Phase C, leave as-is — the worker is correct; this is a Phase A/B leak. Flag in docs but don't fix in C.

---

## After Phase C

Phase C produces a working worker that processes the outbox end-to-end — but channel dispatchers are stubs. To send real notifications:

- **Phase D**: Replace `StubTelegramDispatcher` with `TelegramDispatcher` (uses `Telegram.Bot` SDK; inline keyboard with "Open in app" + "Mute these"; callback handler in `Lovecraft.TelegramBot` to update prefs).
- **Phase E**: Add `WebPushDispatcher` in `Lovecraft.Backend` (fires-and-forgets via VAPID); `GET /api/v1/push/vapid-public-key` endpoint; service worker `sw.js` in the frontend.
- **Phase F**: Replace `StubEmailDispatcher` with `EmailDispatcher` (calls `IEmailService.SendNotificationDigestAsync`); digest renderer; signed unsubscribe link endpoint.
- **Phase G**: `EventReminderWorker` (scans events for 24h-ahead); `POST /admin/notifications/broadcast`; `broadcasts` table; `EventPublished` / `EventInviteReceived` producers; admin UI.
- **Phase H**: `RankUp` producer in `IncrementCounterAsync`.

Plans for each will land progressively, one phase per merge cycle.
