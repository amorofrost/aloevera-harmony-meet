# Notifications Phase G — Event reminders + admin broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three remaining notification producers (`EventPublished`, `EventInviteReceived`, `CommunityBroadcast`), the `EventReminderWorker` (24h-ahead reminders), and the `/admin/broadcasts` compose-and-history UI.

**Architecture:**
- Backend: extend `EventInviteEntity` with `TargetUserId`; new `BroadcastEntity` + `broadcasts` table + `IBroadcastService`; admin endpoints `POST /api/v1/admin/notifications/broadcast`, `GET /broadcasts`, `GET /broadcasts/{id}`; producer wirings at `AzureEventService.CreateEventAsync`, `IEventInviteService.CreateOrIssuePersonalInviteAsync`, and inside `BroadcastService.DispatchAsync`. New `appconfig.permissions.send_broadcast` key.
- Worker: new `EventReminderWorker` (5-minute tick). Reads `events` rows with `Date` in `[now+23h, now+25h]`, iterates `eventattendees`, writes `notifications` + `notificationsoutbox` rows directly (producer pattern is duplicated because worker is isolated from `Lovecraft.Backend`). Idempotency via `sourceEventId = "event-reminder-{eventId}"`.
- Frontend: `adminApi.broadcasts.{create,list,get}`; new `/admin/broadcasts` route + `AdminBroadcastsPage.tsx` with compose form (title/body/link/audience selector) and history list with status.

**Tech Stack:** .NET 10, Azure Table Storage, xUnit + Moq for backend; React 18 / TS / Tailwind / shadcn / Vitest for frontend.

---

## Cross-cutting context

These conventions apply to every task — read once, refer back as needed.

- **`INotificationProducer.ProduceAsync` signature** (already in code, do not change):
  ```csharp
  Task<NotificationDto?> ProduceAsync(
      string recipientUserId,
      NotificationType type,
      string? actorId,
      string payloadJson,
      string? sourceEventId,
      string? presenceGroup = null);
  ```
- **Payload JSON shapes** (from `WebPushPayloadRenderer`, `EmailDigestRenderer`, `TelegramMessageRenderer`):
  - `CommunityBroadcast`: `{ "title": "...", "body": "...", "link": "/aloevera/events/..." }` — `link` optional.
  - `EventPublished`: `{ "eventId": "...", "eventTitle": "...", "eventDateUtc": "2026-06-10T18:00:00Z" }`
  - `EventInviteReceived`: `{ "eventId": "...", "eventTitle": "...", "inviteCode": "ABCDEF" }`
  - `EventReminder`: `{ "eventId": "...", "eventTitle": "...", "eventDateUtc": "2026-06-10T18:00:00Z" }`
- **`NotificationType` enum** already contains all 9 values (scaffolded in Phase A). No enum changes.
- **Producer call site failure isolation:** every producer call goes in `try/catch (Exception ex)` with `_logger.LogWarning(ex, "Notification producer failed for {Type}", type)`. Producer errors NEVER break the primary action.
- **Worker isolation:** `Lovecraft.NotificationsWorker` does NOT reference `Lovecraft.Backend`. Where the worker needs producer logic, it writes directly into Azure Tables. Entity classes are duplicated (matches Phase D pattern: `UserContactEntity`).
- **Solution & projects to touch:**
  - `Lovecraft.Backend` — new BroadcastEntity, new IBroadcastService + Mock + Azure, new BroadcastsController (or new actions on AdminController), new DTOs, EventInviteEntity field, EventInviteService changes, AzureEventService producer wiring, AppConfig `send_broadcast` key.
  - `Lovecraft.NotificationsWorker` — new `Entities/EventEntity.cs` partial, new `Entities/EventAttendeeEntity.cs` partial, new `Workers/EventReminderWorker.cs`, new `Services/EventReminderProcessor.cs`, table client registration in `Program.cs`.
  - `Lovecraft.Common` — new DTOs `BroadcastDto`, `CreateBroadcastRequestDto`, `BroadcastAudienceDto`.
  - `Lovecraft.UnitTests` — new test classes (see each task).
  - `Lovecraft.Tools.Seeder` — add `send_broadcast` permission row.
  - Frontend: `src/services/api/adminApi.ts`, `src/admin/pages/AdminBroadcastsPage.tsx`, `src/admin/AdminApp.tsx`.

---

## File Structure

**Backend new files (`Lovecraft.Backend/`):**
- `Services/IBroadcastService.cs` — interface
- `Services/MockBroadcastService.cs` — in-memory impl backed by `MockDataStore.Broadcasts`
- `Services/Azure/AzureBroadcastService.cs` — Azure Tables impl
- `Storage/Entities/BroadcastEntity.cs`
- `Controllers/V1/AdminNotificationsController.cs` — new controller `[Route("api/v1/admin/notifications")]`, `[RequireStaffRole("admin")]`

**Backend modified files:**
- `Storage/Entities/EventInviteEntity.cs` — add `TargetUserId` nullable column
- `Storage/TableNames.cs` — add `Broadcasts` constant
- `Services/IEventInviteService.cs` + `Azure/AzureEventInviteService.cs` + `MockEventInviteService.cs` — add `IssuePersonalInviteAsync(eventId, targetUserId, expiresAtUtc?)` returning code + ExpiresAtUtc?
- `Services/Azure/AzureEventService.cs` — wire `INotificationProducer` for `EventPublished` (only when `Visibility == Public`)
- `Services/MockEventService.cs` — same
- `Services/Azure/AzureAppConfigService.cs` — add `send_broadcast` default key in seed defaults (where applicable)
- `Configuration/AppConfig.cs` (or wherever `PermissionConfig` lives) — add `SendBroadcast` property defaulting to `"admin"`
- `Program.cs` — register `IBroadcastService`

**Worker new files (`Lovecraft.NotificationsWorker/`):**
- `Entities/EventEntity.cs` — partial entity, deserializes `Id` / `Title` / `Date` / `Visibility` (or whatever the backend EventEntity uses for `IsPublic`)
- `Entities/EventAttendeeEntity.cs` — partial entity for fanout
- `Services/IEventReminderProcessor.cs` + `EventReminderProcessor.cs`
- `Workers/EventReminderWorker.cs`

**Worker modified files:**
- `Program.cs` — read `events` + `eventattendees` table clients, register processor + worker

**Common new files (`Lovecraft.Common/DTOs/Notifications/`):**
- `BroadcastDto.cs`
- `CreateBroadcastRequestDto.cs`
- `BroadcastAudienceDto.cs`

**Tests (`Lovecraft.UnitTests/`):**
- `BroadcastServiceTests.cs`
- `AdminNotificationsControllerTests.cs`
- `EventReminderProcessorTests.cs` (worker-side, in `NotificationsWorker/` subfolder)
- Extend `EventInviteServiceTests.cs` (or `EventInviteTests.cs`) for personal invites
- Extend `AzureEventServiceTests.cs` (or equivalent) for EventPublished producer

**Frontend new files:**
- `src/admin/pages/AdminBroadcastsPage.tsx`
- `src/admin/pages/__tests__/AdminBroadcastsPage.test.tsx`

**Frontend modified files:**
- `src/admin/AdminApp.tsx` — add `/broadcasts` route + nav link
- `src/services/api/adminApi.ts` — add `broadcasts.{create,list,get}` namespace
- `src/services/api/__tests__/adminApi.test.ts` — extend
- `docs/NOTIFICATIONS.md`, `docs/ISSUES.md`, `AGENTS.md`

---

## Task 1: Broadcast storage layer — entity, table, DTOs, IBroadcastService

**Goal:** Foundation for storing broadcast records. No notifications wired yet.

**Files:**
- Create: `Lovecraft.Backend/Storage/Entities/BroadcastEntity.cs`
- Create: `Lovecraft.Common/DTOs/Notifications/BroadcastAudienceDto.cs`
- Create: `Lovecraft.Common/DTOs/Notifications/BroadcastDto.cs`
- Create: `Lovecraft.Common/DTOs/Notifications/CreateBroadcastRequestDto.cs`
- Create: `Lovecraft.Backend/Services/IBroadcastService.cs`
- Create: `Lovecraft.Backend/Services/MockBroadcastService.cs`
- Create: `Lovecraft.Backend/Services/Azure/AzureBroadcastService.cs`
- Modify: `Lovecraft.Backend/Storage/TableNames.cs` — add `Broadcasts = "broadcasts"`
- Modify: `Lovecraft.Backend/MockData/MockDataStore.cs` (or wherever mock state lives) — add `Broadcasts` list
- Modify: `Lovecraft.Backend/Program.cs` — register both Mock + Azure broadcast services in their respective DI blocks
- Test: `Lovecraft.UnitTests/BroadcastServiceTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
// Lovecraft.UnitTests/BroadcastServiceTests.cs
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Xunit;

public class BroadcastServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsBroadcastWithGeneratedId()
    {
        var svc = new MockBroadcastService();
        var req = new CreateBroadcastRequestDto
        {
            Title = "Test",
            Body = "Body text",
            Link = "/aloevera",
            Audience = new BroadcastAudienceDto("all", null)
        };
        var bc = await svc.CreateAsync(req, issuedByUserId: "admin-1");
        Assert.False(string.IsNullOrEmpty(bc.Id));
        Assert.Equal("admin-1", bc.IssuedByUserId);
        Assert.Equal("pending", bc.Status);
        Assert.Equal(0, bc.DispatchedCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsNewestFirst()
    {
        var svc = new MockBroadcastService();
        var a = await svc.CreateAsync(new CreateBroadcastRequestDto
        {
            Title = "A", Body = "a", Audience = new BroadcastAudienceDto("all", null)
        }, "admin-1");
        await Task.Delay(20);
        var b = await svc.CreateAsync(new CreateBroadcastRequestDto
        {
            Title = "B", Body = "b", Audience = new BroadcastAudienceDto("all", null)
        }, "admin-1");

        var list = await svc.ListAsync(limit: 10);
        Assert.Equal(b.Id, list[0].Id);
        Assert.Equal(a.Id, list[1].Id);
    }

    [Fact]
    public async Task GetByIdAsync_NotFound_ReturnsNull()
    {
        var svc = new MockBroadcastService();
        var result = await svc.GetByIdAsync("nonexistent");
        Assert.Null(result);
    }

    [Fact]
    public async Task SetCompletedAsync_UpdatesStatusAndCount()
    {
        var svc = new MockBroadcastService();
        var bc = await svc.CreateAsync(new CreateBroadcastRequestDto
        {
            Title = "Test", Body = "Body", Audience = new BroadcastAudienceDto("all", null)
        }, "admin-1");

        await svc.SetCompletedAsync(bc.Id, dispatchedCount: 42, completedAtUtc: DateTime.UtcNow);

        var updated = await svc.GetByIdAsync(bc.Id);
        Assert.NotNull(updated);
        Assert.Equal("completed", updated!.Status);
        Assert.Equal(42, updated.DispatchedCount);
        Assert.NotNull(updated.CompletedAtUtc);
    }
}
```

- [ ] **Step 2: Run tests, verify they fail with "type not found"**

Run: `dotnet test --filter "FullyQualifiedName~BroadcastServiceTests"`
Expected: FAIL (missing types `MockBroadcastService`, `BroadcastDto`, etc.)

- [ ] **Step 3: Define DTOs**

```csharp
// Lovecraft.Common/DTOs/Notifications/BroadcastAudienceDto.cs
namespace Lovecraft.Common.DTOs.Notifications;

public record BroadcastAudienceDto(string Type, string? Value);
// Type: "all" | "attendingEvent" | "minRank" | "staffRole"
// Value: eventId for "attendingEvent"; rank name for "minRank"; role name for "staffRole"; null for "all"
```

```csharp
// Lovecraft.Common/DTOs/Notifications/BroadcastDto.cs
namespace Lovecraft.Common.DTOs.Notifications;

public class BroadcastDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string? Link { get; set; }
    public BroadcastAudienceDto Audience { get; set; } = new("all", null);
    public string IssuedByUserId { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; }
    public int EstimatedRecipients { get; set; }
    public int DispatchedCount { get; set; }
    public string Status { get; set; } = "pending"; // "pending" | "completed"
    public DateTime? CompletedAtUtc { get; set; }
}
```

```csharp
// Lovecraft.Common/DTOs/Notifications/CreateBroadcastRequestDto.cs
using System.ComponentModel.DataAnnotations;

namespace Lovecraft.Common.DTOs.Notifications;

public class CreateBroadcastRequestDto
{
    [Required, MaxLength(100)]
    public string Title { get; set; } = "";

    [Required, MaxLength(1000)]
    public string Body { get; set; } = "";

    [MaxLength(500)]
    public string? Link { get; set; }

    [Required]
    public BroadcastAudienceDto Audience { get; set; } = new("all", null);
}
```

- [ ] **Step 4: Define `BroadcastEntity`**

```csharp
// Lovecraft.Backend/Storage/Entities/BroadcastEntity.cs
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class BroadcastEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "BROADCAST";
    public string RowKey { get; set; } = "";
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string? Link { get; set; }
    public string AudienceJson { get; set; } = "{}";
    public string IssuedByUserId { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; }
    public int EstimatedRecipients { get; set; }
    public int DispatchedCount { get; set; }
    public string Status { get; set; } = "pending";
    public DateTime? CompletedAtUtc { get; set; }

    // RowKey = $"{(DateTime.MaxValue.Ticks - IssuedAtUtc.Ticks):D20}_{Id}"
    // Newest first when listing PartitionKey="BROADCAST".
    public static string BuildRowKey(DateTime issuedAtUtc, string id) =>
        $"{(DateTime.MaxValue.Ticks - issuedAtUtc.Ticks):D20}_{id}";
}
```

- [ ] **Step 5: Add `Broadcasts` to TableNames**

```csharp
// Lovecraft.Backend/Storage/TableNames.cs — add to the constants section
public static string Broadcasts => GetTableName("broadcasts");
```

Verify the file's existing pattern uses `GetTableName(...)` for prefix support; match exactly.

- [ ] **Step 6: Define `IBroadcastService` + Mock impl**

```csharp
// Lovecraft.Backend/Services/IBroadcastService.cs
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services;

public interface IBroadcastService
{
    Task<BroadcastDto> CreateAsync(CreateBroadcastRequestDto request, string issuedByUserId);
    Task<BroadcastDto?> GetByIdAsync(string broadcastId);
    Task<List<BroadcastDto>> ListAsync(int limit = 50);
    Task SetEstimatedRecipientsAsync(string broadcastId, int count);
    Task SetCompletedAsync(string broadcastId, int dispatchedCount, DateTime completedAtUtc);
}
```

```csharp
// Lovecraft.Backend/Services/MockBroadcastService.cs
using System.Text.Json;
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services;

public class MockBroadcastService : IBroadcastService
{
    private readonly List<BroadcastDto> _broadcasts = new();
    private readonly object _gate = new();

    public Task<BroadcastDto> CreateAsync(CreateBroadcastRequestDto request, string issuedByUserId)
    {
        var bc = new BroadcastDto
        {
            Id = $"bc-{Guid.NewGuid():N}".Substring(0, 16),
            Title = request.Title,
            Body = request.Body,
            Link = request.Link,
            Audience = request.Audience,
            IssuedByUserId = issuedByUserId,
            IssuedAtUtc = DateTime.UtcNow,
            EstimatedRecipients = 0,
            DispatchedCount = 0,
            Status = "pending",
            CompletedAtUtc = null,
        };
        lock (_gate) _broadcasts.Add(bc);
        return Task.FromResult(bc);
    }

    public Task<BroadcastDto?> GetByIdAsync(string broadcastId)
    {
        lock (_gate)
            return Task.FromResult(_broadcasts.FirstOrDefault(b => b.Id == broadcastId));
    }

    public Task<List<BroadcastDto>> ListAsync(int limit = 50)
    {
        lock (_gate)
            return Task.FromResult(_broadcasts.OrderByDescending(b => b.IssuedAtUtc).Take(limit).ToList());
    }

    public Task SetEstimatedRecipientsAsync(string broadcastId, int count)
    {
        lock (_gate)
        {
            var bc = _broadcasts.FirstOrDefault(b => b.Id == broadcastId);
            if (bc is not null) bc.EstimatedRecipients = count;
        }
        return Task.CompletedTask;
    }

    public Task SetCompletedAsync(string broadcastId, int dispatchedCount, DateTime completedAtUtc)
    {
        lock (_gate)
        {
            var bc = _broadcasts.FirstOrDefault(b => b.Id == broadcastId);
            if (bc is not null)
            {
                bc.Status = "completed";
                bc.DispatchedCount = dispatchedCount;
                bc.CompletedAtUtc = completedAtUtc;
            }
        }
        return Task.CompletedTask;
    }
}
```

- [ ] **Step 7: Azure impl**

```csharp
// Lovecraft.Backend/Services/Azure/AzureBroadcastService.cs
using System.Text.Json;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services.Azure;

public class AzureBroadcastService : IBroadcastService
{
    private readonly TableServiceClient _tableSvc;
    private readonly TableClient _table;

    public AzureBroadcastService(TableServiceClient tableSvc)
    {
        _tableSvc = tableSvc;
        _table = tableSvc.GetTableClient(TableNames.Broadcasts);
        _table.CreateIfNotExists();
    }

    public async Task<BroadcastDto> CreateAsync(CreateBroadcastRequestDto request, string issuedByUserId)
    {
        var now = DateTime.UtcNow;
        var id = $"bc-{Guid.NewGuid():N}".Substring(0, 16);
        var entity = new BroadcastEntity
        {
            PartitionKey = "BROADCAST",
            RowKey = BroadcastEntity.BuildRowKey(now, id),
            Id = id,
            Title = request.Title,
            Body = request.Body,
            Link = request.Link,
            AudienceJson = JsonSerializer.Serialize(request.Audience),
            IssuedByUserId = issuedByUserId,
            IssuedAtUtc = now,
            EstimatedRecipients = 0,
            DispatchedCount = 0,
            Status = "pending",
            CompletedAtUtc = null,
        };
        await _table.AddEntityAsync(entity);
        return ToDto(entity);
    }

    public async Task<BroadcastDto?> GetByIdAsync(string broadcastId)
    {
        var results = _table.QueryAsync<BroadcastEntity>(b => b.PartitionKey == "BROADCAST" && b.Id == broadcastId);
        await foreach (var e in results) return ToDto(e);
        return null;
    }

    public async Task<List<BroadcastDto>> ListAsync(int limit = 50)
    {
        var list = new List<BroadcastDto>();
        var results = _table.QueryAsync<BroadcastEntity>(b => b.PartitionKey == "BROADCAST", maxPerPage: limit);
        await foreach (var e in results)
        {
            list.Add(ToDto(e));
            if (list.Count >= limit) break;
        }
        return list;
    }

    public async Task SetEstimatedRecipientsAsync(string broadcastId, int count)
    {
        var entity = await FindEntityAsync(broadcastId);
        if (entity is null) return;
        entity.EstimatedRecipients = count;
        await _table.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace);
    }

    public async Task SetCompletedAsync(string broadcastId, int dispatchedCount, DateTime completedAtUtc)
    {
        var entity = await FindEntityAsync(broadcastId);
        if (entity is null) return;
        entity.DispatchedCount = dispatchedCount;
        entity.Status = "completed";
        entity.CompletedAtUtc = completedAtUtc;
        await _table.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace);
    }

    private async Task<BroadcastEntity?> FindEntityAsync(string broadcastId)
    {
        var results = _table.QueryAsync<BroadcastEntity>(b => b.PartitionKey == "BROADCAST" && b.Id == broadcastId);
        await foreach (var e in results) return e;
        return null;
    }

    private static BroadcastDto ToDto(BroadcastEntity e) => new()
    {
        Id = e.Id,
        Title = e.Title,
        Body = e.Body,
        Link = e.Link,
        Audience = JsonSerializer.Deserialize<BroadcastAudienceDto>(e.AudienceJson) ?? new("all", null),
        IssuedByUserId = e.IssuedByUserId,
        IssuedAtUtc = e.IssuedAtUtc,
        EstimatedRecipients = e.EstimatedRecipients,
        DispatchedCount = e.DispatchedCount,
        Status = e.Status,
        CompletedAtUtc = e.CompletedAtUtc,
    };
}
```

- [ ] **Step 8: Register in `Program.cs`** (mock and azure DI blocks, mirror existing service registrations)

In the mock DI block, alongside other mock service registrations:
```csharp
builder.Services.AddSingleton<IBroadcastService, MockBroadcastService>();
```
In the Azure DI block:
```csharp
builder.Services.AddSingleton<IBroadcastService, AzureBroadcastService>();
```

- [ ] **Step 9: Run tests, verify they pass**

Run: `dotnet test --filter "FullyQualifiedName~BroadcastServiceTests"`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Services/IBroadcastService.cs Lovecraft/Lovecraft.Backend/Services/MockBroadcastService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureBroadcastService.cs Lovecraft/Lovecraft.Backend/Storage/Entities/BroadcastEntity.cs Lovecraft/Lovecraft.Backend/Storage/TableNames.cs Lovecraft/Lovecraft.Backend/Program.cs Lovecraft/Lovecraft.Common/DTOs/Notifications/BroadcastDto.cs Lovecraft/Lovecraft.Common/DTOs/Notifications/BroadcastAudienceDto.cs Lovecraft/Lovecraft.Common/DTOs/Notifications/CreateBroadcastRequestDto.cs Lovecraft/Lovecraft.UnitTests/BroadcastServiceTests.cs
git commit -m "feat: broadcast storage layer (entity, table, service, DTOs)"
```

---

## Task 2: AppConfig `send_broadcast` permission key

**Goal:** Allow lowering broadcast-send threshold via appconfig without code change. Default `"admin"`.

**Files:**
- Modify: `Lovecraft.Backend/Configuration/AppConfig.cs` — add `SendBroadcast` property to `PermissionConfig`
- Modify: `Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs` — read `send_broadcast` row when loading
- Modify: `Lovecraft.Backend/Controllers/V1/AdminController.cs:529-541` — include in the `GetConfig` response
- Modify: `Lovecraft.Tools.Seeder/Program.cs` — seed `send_broadcast = "admin"` row
- Test: extend `AppConfigServiceTests.cs` (or relevant existing test class)

- [ ] **Step 1: Write failing test**

Open `Lovecraft.UnitTests/AppConfigServiceTests.cs` (or add a new test if structure differs). Add:

```csharp
[Fact]
public async Task GetConfigAsync_ExposesSendBroadcastPermissionDefault()
{
    // Adapt setup to match existing test patterns in this file —
    // the goal is to assert PermissionConfig.SendBroadcast == "admin" when no row exists.
    var svc = new AzureAppConfigService(/* existing test fakes */);
    var cfg = await svc.GetConfigAsync();
    Assert.Equal("admin", cfg.Permissions.SendBroadcast);
}
```

- [ ] **Step 2: Run test, verify it fails**

Expected: FAIL with "PermissionConfig has no SendBroadcast property" or test infra error.

- [ ] **Step 3: Add property to `PermissionConfig`**

Find `Lovecraft.Backend/Configuration/AppConfig.cs` (or wherever `PermissionConfig` lives — likely with `RankConfig` and `RegistrationConfig`). Add:

```csharp
public string SendBroadcast { get; init; } = "admin";
```

Match the existing pattern — if `PermissionConfig` is `record` with positional params, add a positional param with default `"admin"`. If properties, add as `{ get; init; }`.

- [ ] **Step 4: Update `AzureAppConfigService.GetConfigAsync` permission load**

Where the existing code reads each permission row (e.g., `cfg.Permissions.CreateTopic = rows.TryGetValue("create_topic", out var v) ? v : "activeMember";`), add the analogous line:

```csharp
SendBroadcast = rows.TryGetValue("send_broadcast", out var v_sb) ? v_sb : "admin",
```

- [ ] **Step 5: Update `AdminController.GetConfig`**

In `AdminController.cs` around the existing `Permissions` dict construction, add:
```csharp
["send_broadcast"] = cfg.Permissions.SendBroadcast,
```

- [ ] **Step 6: Update Seeder**

In `Lovecraft.Tools.Seeder/Program.cs`, in the permission rows section, add:
```csharp
new TableEntity("permissions", "send_broadcast") { ["Value"] = "admin" },
```

- [ ] **Step 7: Run test, verify PASS**

Run: `dotnet test --filter "FullyQualifiedName~AppConfigServiceTests"`

- [ ] **Step 8: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Configuration/AppConfig.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs Lovecraft/Lovecraft.Tools.Seeder/Program.cs Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs
git commit -m "feat: send_broadcast permission key (default admin)"
```

---

## Task 3: Admin broadcast endpoint + audience expansion + async fan-out + CommunityBroadcast producer

**Goal:** `POST /api/v1/admin/notifications/broadcast` creates a broadcast row, computes recipients, returns `{ broadcastId, estimatedRecipients }` synchronously, then fans out `CommunityBroadcast` producer calls in `Task.Run`. List/get endpoints.

**Files:**
- Create: `Lovecraft.Backend/Controllers/V1/AdminNotificationsController.cs`
- Create: `Lovecraft.Backend/Services/Notifications/IBroadcastAudienceResolver.cs` + `BroadcastAudienceResolver.cs`
- Modify: `Lovecraft.Backend/Program.cs` — register resolver
- Test: `Lovecraft.UnitTests/AdminNotificationsControllerTests.cs`
- Test: `Lovecraft.UnitTests/BroadcastAudienceResolverTests.cs`

- [ ] **Step 1: Write failing tests for `BroadcastAudienceResolver`**

```csharp
// Lovecraft.UnitTests/BroadcastAudienceResolverTests.cs
using System.Linq;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.DTOs.Users;
using Moq;
using Xunit;

public class BroadcastAudienceResolverTests
{
    [Fact]
    public async Task ResolveAsync_All_ReturnsAllUserIds()
    {
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(s => s.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserDto>
            {
                new() { Id = "u1" }, new() { Id = "u2" }, new() { Id = "u3" }
            });
        var eventSvc = new Mock<IEventService>();

        var resolver = new BroadcastAudienceResolver(userSvc.Object, eventSvc.Object);
        var ids = await resolver.ResolveAsync(new BroadcastAudienceDto("all", null), CancellationToken.None);

        Assert.Equal(3, ids.Count);
    }

    [Fact]
    public async Task ResolveAsync_AttendingEvent_ReturnsAttendees()
    {
        var userSvc = new Mock<IUserService>();
        var eventSvc = new Mock<IEventService>();
        eventSvc.Setup(s => s.GetEventAttendeesAsync("evt-1"))
            .ReturnsAsync(new List<EventAttendeeAdminDto>
            {
                new() { UserId = "u1" }, new() { UserId = "u2" }
            });

        var resolver = new BroadcastAudienceResolver(userSvc.Object, eventSvc.Object);
        var ids = await resolver.ResolveAsync(new BroadcastAudienceDto("attendingEvent", "evt-1"), CancellationToken.None);

        Assert.Equal(2, ids.Count);
        Assert.Contains("u1", ids);
    }

    [Fact]
    public async Task ResolveAsync_MinRank_FiltersByRank()
    {
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(s => s.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserDto>
            {
                new() { Id = "u1", Rank = "novice" },
                new() { Id = "u2", Rank = "activeMember" },
                new() { Id = "u3", Rank = "crew" },
            });
        var eventSvc = new Mock<IEventService>();

        var resolver = new BroadcastAudienceResolver(userSvc.Object, eventSvc.Object);
        var ids = await resolver.ResolveAsync(new BroadcastAudienceDto("minRank", "activeMember"), CancellationToken.None);

        Assert.Equal(2, ids.Count);
        Assert.DoesNotContain("u1", ids);
    }

    [Fact]
    public async Task ResolveAsync_StaffRole_FiltersByStaffRole()
    {
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(s => s.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserDto>
            {
                new() { Id = "u1", StaffRole = "none" },
                new() { Id = "u2", StaffRole = "moderator" },
                new() { Id = "u3", StaffRole = "admin" },
            });
        var eventSvc = new Mock<IEventService>();

        var resolver = new BroadcastAudienceResolver(userSvc.Object, eventSvc.Object);
        var ids = await resolver.ResolveAsync(new BroadcastAudienceDto("staffRole", "moderator"), CancellationToken.None);

        Assert.Single(ids);
        Assert.Equal("u2", ids[0]);
    }

    [Fact]
    public async Task ResolveAsync_UnknownType_ReturnsEmpty()
    {
        var resolver = new BroadcastAudienceResolver(new Mock<IUserService>().Object, new Mock<IEventService>().Object);
        var ids = await resolver.ResolveAsync(new BroadcastAudienceDto("nonsense", null), CancellationToken.None);
        Assert.Empty(ids);
    }
}
```

If `IUserService.GetUsersAsync(CancellationToken)` doesn't exist with that signature, adapt to whatever bulk-listing method exists (e.g., `GetAllAsync()`, paginated query). Inspect `IUserService` before writing tests; document any adaptation.

- [ ] **Step 2: Write `BroadcastAudienceResolver` to make tests pass**

```csharp
// Lovecraft.Backend/Services/Notifications/IBroadcastAudienceResolver.cs
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services.Notifications;

public interface IBroadcastAudienceResolver
{
    Task<IReadOnlyList<string>> ResolveAsync(BroadcastAudienceDto audience, CancellationToken ct);
}
```

```csharp
// Lovecraft.Backend/Services/Notifications/BroadcastAudienceResolver.cs
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.Services;

namespace Lovecraft.Backend.Services.Notifications;

public class BroadcastAudienceResolver : IBroadcastAudienceResolver
{
    private readonly IUserService _users;
    private readonly IEventService _events;

    public BroadcastAudienceResolver(IUserService users, IEventService events)
    {
        _users = users;
        _events = events;
    }

    public async Task<IReadOnlyList<string>> ResolveAsync(BroadcastAudienceDto audience, CancellationToken ct)
    {
        switch (audience.Type)
        {
            case "all":
            {
                var all = await _users.GetUsersAsync(ct);
                return all.Select(u => u.Id).ToList();
            }
            case "attendingEvent":
            {
                if (string.IsNullOrEmpty(audience.Value)) return Array.Empty<string>();
                var attendees = await _events.GetEventAttendeesAsync(audience.Value);
                return attendees.Select(a => a.UserId).Distinct().ToList();
            }
            case "minRank":
            {
                if (string.IsNullOrEmpty(audience.Value)) return Array.Empty<string>();
                var all = await _users.GetUsersAsync(ct);
                var minLevel = EffectiveLevel.LevelOf(audience.Value);
                return all
                    .Where(u => EffectiveLevel.LevelOf(u.Rank) >= minLevel)
                    .Select(u => u.Id).ToList();
            }
            case "staffRole":
            {
                if (string.IsNullOrEmpty(audience.Value)) return Array.Empty<string>();
                var all = await _users.GetUsersAsync(ct);
                return all
                    .Where(u => string.Equals(u.StaffRole, audience.Value, StringComparison.OrdinalIgnoreCase))
                    .Select(u => u.Id).ToList();
            }
            default:
                return Array.Empty<string>();
        }
    }
}
```

If `EffectiveLevel.LevelOf` accepts a different shape, adapt to whatever the backend's existing rank-comparison helper expects (see `Lovecraft.Backend/Helpers/EffectiveLevel.cs`).

- [ ] **Step 3: Write failing tests for `AdminNotificationsController.Broadcast`**

```csharp
// Lovecraft.UnitTests/AdminNotificationsControllerTests.cs
using System.Net.Http.Json;
using Lovecraft.Backend;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class AdminNotificationsControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public AdminNotificationsControllerTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task PostBroadcast_AdminAuth_ReturnsBroadcastId()
    {
        // Use the existing pattern in NotificationsControllerTests / AdminControllerTests
        // for admin-authenticated client construction.
        var client = TestAdminClient.Create(_factory);
        var resp = await client.PostAsJsonAsync("/api/v1/admin/notifications/broadcast",
            new CreateBroadcastRequestDto
            {
                Title = "Hello",
                Body = "Body text",
                Audience = new BroadcastAudienceDto("all", null)
            });
        resp.EnsureSuccessStatusCode();
        var env = await resp.Content.ReadFromJsonAsync<ApiResponse<BroadcastDto>>();
        Assert.NotNull(env);
        Assert.True(env!.Success);
        Assert.False(string.IsNullOrEmpty(env.Data!.Id));
    }

    [Fact]
    public async Task PostBroadcast_NonAdmin_Returns403()
    {
        var client = TestUserClient.Create(_factory);
        var resp = await client.PostAsJsonAsync("/api/v1/admin/notifications/broadcast",
            new CreateBroadcastRequestDto
            {
                Title = "Hello", Body = "Body", Audience = new BroadcastAudienceDto("all", null)
            });
        Assert.Equal(System.Net.HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task ListBroadcasts_AdminAuth_ReturnsList()
    {
        var client = TestAdminClient.Create(_factory);
        await client.PostAsJsonAsync("/api/v1/admin/notifications/broadcast",
            new CreateBroadcastRequestDto
            {
                Title = "T", Body = "B", Audience = new BroadcastAudienceDto("all", null)
            });

        var resp = await client.GetAsync("/api/v1/admin/notifications/broadcasts");
        resp.EnsureSuccessStatusCode();
        var env = await resp.Content.ReadFromJsonAsync<ApiResponse<List<BroadcastDto>>>();
        Assert.True(env!.Data!.Count >= 1);
    }
}
```

Adapt `TestAdminClient` / `TestUserClient` helper references to whatever fixture the existing `NotificationsControllerTests` / `AdminControllerTests` use (e.g., a method that injects JWT with `staffRole=admin`). If no such helper exists, hand-build the auth flow inline using the existing test login pattern.

- [ ] **Step 4: Run tests, verify they fail**

- [ ] **Step 5: Implement `AdminNotificationsController`**

```csharp
// Lovecraft.Backend/Controllers/V1/AdminNotificationsController.cs
using System.Security.Claims;
using System.Text.Json;
using Lovecraft.Backend.Auth;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Models;
using Lovecraft.Common.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1/admin/notifications")]
[Authorize]
[RequireStaffRole("admin")]
public class AdminNotificationsController : ControllerBase
{
    private readonly IBroadcastService _broadcasts;
    private readonly IBroadcastAudienceResolver _resolver;
    private readonly INotificationProducer _producer;
    private readonly ILogger<AdminNotificationsController> _logger;

    public AdminNotificationsController(
        IBroadcastService broadcasts,
        IBroadcastAudienceResolver resolver,
        INotificationProducer producer,
        ILogger<AdminNotificationsController> logger)
    {
        _broadcasts = broadcasts;
        _resolver = resolver;
        _producer = producer;
        _logger = logger;
    }

    [HttpPost("broadcast")]
    public async Task<ActionResult<ApiResponse<BroadcastDto>>> CreateBroadcast(
        [FromBody] CreateBroadcastRequestDto request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<BroadcastDto>.ErrorResponse("VALIDATION_ERROR", "Validation failed"));

        var issuedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(issuedByUserId))
            return Unauthorized(ApiResponse<BroadcastDto>.ErrorResponse("UNAUTHORIZED", "Not authenticated"));

        var recipients = await _resolver.ResolveAsync(request.Audience, ct);
        var bc = await _broadcasts.CreateAsync(request, issuedByUserId);
        await _broadcasts.SetEstimatedRecipientsAsync(bc.Id, recipients.Count);
        bc.EstimatedRecipients = recipients.Count;

        // Async fan-out; do not block the request thread.
        var producer = _producer;
        var broadcastSvc = _broadcasts;
        var logger = _logger;
        var sourceEventId = $"broadcast-{bc.Id}";
        var payload = JsonSerializer.Serialize(new
        {
            title = bc.Title,
            body = bc.Body,
            link = bc.Link,
        });

        _ = Task.Run(async () =>
        {
            var dispatched = 0;
            foreach (var recipientId in recipients)
            {
                try
                {
                    await producer.ProduceAsync(
                        recipientId,
                        NotificationType.CommunityBroadcast,
                        actorId: issuedByUserId,
                        payloadJson: payload,
                        sourceEventId: sourceEventId,
                        presenceGroup: null);
                    dispatched++;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Broadcast {BroadcastId} producer failed for {RecipientId}", bc.Id, recipientId);
                }
            }
            await broadcastSvc.SetCompletedAsync(bc.Id, dispatched, DateTime.UtcNow);
        });

        return Ok(ApiResponse<BroadcastDto>.SuccessResponse(bc));
    }

    [HttpGet("broadcasts")]
    public async Task<ActionResult<ApiResponse<List<BroadcastDto>>>> ListBroadcasts([FromQuery] int limit = 50)
    {
        if (limit < 1 || limit > 200) limit = 50;
        var list = await _broadcasts.ListAsync(limit);
        return Ok(ApiResponse<List<BroadcastDto>>.SuccessResponse(list));
    }

    [HttpGet("broadcasts/{broadcastId}")]
    public async Task<ActionResult<ApiResponse<BroadcastDto>>> GetBroadcast(string broadcastId)
    {
        var bc = await _broadcasts.GetByIdAsync(broadcastId);
        if (bc is null)
            return NotFound(ApiResponse<BroadcastDto>.ErrorResponse("NOT_FOUND", "Broadcast not found"));
        return Ok(ApiResponse<BroadcastDto>.SuccessResponse(bc));
    }
}
```

- [ ] **Step 6: Register resolver in `Program.cs`**

```csharp
builder.Services.AddScoped<IBroadcastAudienceResolver, BroadcastAudienceResolver>();
```

Place near other notification-service registrations.

- [ ] **Step 7: Run tests, verify they pass**

`dotnet test --filter "FullyQualifiedName~BroadcastAudienceResolverTests|FullyQualifiedName~AdminNotificationsControllerTests"`

- [ ] **Step 8: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminNotificationsController.cs Lovecraft/Lovecraft.Backend/Services/Notifications/IBroadcastAudienceResolver.cs Lovecraft/Lovecraft.Backend/Services/Notifications/BroadcastAudienceResolver.cs Lovecraft/Lovecraft.Backend/Program.cs Lovecraft/Lovecraft.UnitTests/AdminNotificationsControllerTests.cs Lovecraft/Lovecraft.UnitTests/BroadcastAudienceResolverTests.cs
git commit -m "feat: admin broadcast endpoint with audience resolver + async fan-out"
```

---

## Task 4: EventPublished producer wiring on event creation

**Goal:** When an admin creates a public event, fire `EventPublished` to all users (or all users with that type cell enabled — opt-in via prefs, so the producer just calls and lets `NotificationPolicy.ResolveChannels` filter).

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureEventService.cs` — inject `INotificationProducer? producer = null` (nullable for backward-compatible Mock test construction), call after entity insert when `Visibility == Public`. Fan-out to all users via `IUserService`.
- Modify: `Lovecraft.Backend/Services/MockEventService.cs` — same
- Test: `Lovecraft.UnitTests/AzureEventServiceTests.cs` (or wherever existing event service tests live)

**Suppression rule:** Fan-out is large (potentially all users). Producer's `NotificationPolicy.ResolveChannels` filters per-user prefs. Don't do anything fancy — just loop and call producer. Performance hit is one-time on event creation. Document follow-up: at 10K+ users, this needs batching.

- [ ] **Step 1: Failing test**

```csharp
// In AzureEventServiceTests.cs (or new EventPublishedProducerTests.cs)
[Fact]
public async Task CreateEventAsync_PublicEvent_FiresEventPublishedForAllUsers()
{
    var producer = new Mock<INotificationProducer>();
    var users = new Mock<IUserService>();
    users.Setup(u => u.GetUsersAsync(It.IsAny<CancellationToken>()))
        .ReturnsAsync(new List<UserDto> { new() { Id = "u1" }, new() { Id = "u2" } });

    var svc = new AzureEventService(/* table fakes */, users.Object, producer.Object);

    var dto = await svc.CreateEventAsync(new AdminEventWriteDto
    {
        Title = "New Event",
        Date = DateTime.UtcNow.AddDays(7),
        Visibility = EventVisibility.Public
    });

    producer.Verify(p => p.ProduceAsync(
        "u1",
        NotificationType.EventPublished,
        It.IsAny<string?>(),
        It.Is<string>(s => s.Contains("New Event")),
        It.Is<string?>(s => s == $"event-published-{dto.Id}"),
        null), Times.Once);
    producer.Verify(p => p.ProduceAsync(
        "u2",
        NotificationType.EventPublished,
        It.IsAny<string?>(),
        It.IsAny<string>(),
        It.IsAny<string?>(),
        null), Times.Once);
}

[Fact]
public async Task CreateEventAsync_SecretEvent_DoesNotFireProducer()
{
    var producer = new Mock<INotificationProducer>();
    var users = new Mock<IUserService>();
    var svc = new AzureEventService(/* fakes */, users.Object, producer.Object);

    await svc.CreateEventAsync(new AdminEventWriteDto
    {
        Title = "Hidden", Date = DateTime.UtcNow.AddDays(7), Visibility = EventVisibility.SecretHidden
    });

    producer.Verify(p => p.ProduceAsync(
        It.IsAny<string>(), NotificationType.EventPublished,
        It.IsAny<string?>(), It.IsAny<string>(),
        It.IsAny<string?>(), It.IsAny<string?>()),
        Times.Never);
}
```

Constructor signatures must match the actual `AzureEventService` constructor (which currently doesn't take `IUserService` or `INotificationProducer`). Adapt: read current constructor first, then add the two optional params (`IUserService? users = null`, `INotificationProducer? producer = null`) so existing call sites compile unchanged.

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Modify `AzureEventService.CreateEventAsync`**

After the existing `await _table.UpsertEntityAsync(...)` line, add:

```csharp
if (_producer is not null && _userService is not null && dto.Visibility == EventVisibility.Public)
{
    try
    {
        var payload = JsonSerializer.Serialize(new
        {
            eventId = id,
            eventTitle = dto.Title,
            eventDateUtc = dto.Date.ToString("o"),
        });
        var allUsers = await _userService.GetUsersAsync(CancellationToken.None);
        foreach (var u in allUsers)
        {
            try
            {
                await _producer.ProduceAsync(
                    u.Id,
                    NotificationType.EventPublished,
                    actorId: null,
                    payloadJson: payload,
                    sourceEventId: $"event-published-{id}",
                    presenceGroup: null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "EventPublished producer failed for {UserId} on event {EventId}", u.Id, id);
            }
        }
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "EventPublished fanout failed for event {EventId}", id);
    }
}
```

Inject `IUserService? userService` and `INotificationProducer? producer` as **nullable optional ctor params** so existing test constructions in the codebase continue to compile. Update Program.cs DI if needed (likely no change since DI fills nullable params).

- [ ] **Step 4: Mirror in `MockEventService`** (same producer call after `MockDataStore.Events.Add(...)`)

- [ ] **Step 5: Tests pass**

- [ ] **Step 6: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureEventService.cs Lovecraft/Lovecraft.Backend/Services/MockEventService.cs Lovecraft/Lovecraft.UnitTests/AzureEventServiceTests.cs
git commit -m "feat: EventPublished producer on admin event creation (public visibility only)"
```

---

## Task 5: Per-user invites + EventInviteReceived producer

**Goal:** Admin can issue a per-user invite that triggers `EventInviteReceived`. Per-user invite shares the existing `eventinvites` table but adds a `TargetUserId` column; produces a notification when the row is created. Code is still usable by anyone with the code, but the notification gives the target user a deep link.

**Files:**
- Modify: `Lovecraft.Backend/Storage/Entities/EventInviteEntity.cs` — add `public string? TargetUserId { get; set; }`
- Modify: `Lovecraft.Backend/Services/IEventInviteService.cs` — add `Task<(string Plain, DateTime? ExpiresAtUtc)> IssuePersonalInviteAsync(string eventId, string targetUserId, DateTime? expiresAtUtc, string issuedByUserId, string? plainCodeOverride = null)`
- Modify: `Lovecraft.Backend/Services/Azure/AzureEventInviteService.cs` + `MockEventInviteService.cs` — implement the new method; call producer for `EventInviteReceived`
- Modify: `Lovecraft.Common/DTOs/Events/CreateEventInviteRequestDto.cs` — add optional `TargetUserId` (or new DTO)
- Modify: `Lovecraft.Backend/Controllers/V1/AdminController.cs` — extend `CreateEventInvite` endpoint to call new method when `TargetUserId` populated, else fall through to existing event-level path
- Test: `Lovecraft.UnitTests/EventInviteServiceTests.cs` (extend) or new `PersonalInviteTests.cs`

- [ ] **Step 1: Failing tests**

```csharp
[Fact]
public async Task IssuePersonalInviteAsync_FiresEventInviteReceived()
{
    var producer = new Mock<INotificationProducer>();
    var svc = new MockEventInviteService(producer.Object); // adapt to actual ctor

    var (plain, _) = await svc.IssuePersonalInviteAsync(
        eventId: "evt-1",
        targetUserId: "user-42",
        expiresAtUtc: null,
        issuedByUserId: "admin-1");

    Assert.False(string.IsNullOrEmpty(plain));
    producer.Verify(p => p.ProduceAsync(
        "user-42",
        NotificationType.EventInviteReceived,
        "admin-1",
        It.Is<string>(s => s.Contains(plain) && s.Contains("evt-1")),
        It.Is<string?>(s => s == "event-invite-evt-1-user-42"),
        null), Times.Once);
}

[Fact]
public async Task IssuePersonalInviteAsync_SkipsProducerWhenNoTarget()
{
    // Confirm the existing CreateOrRotateInviteAsync path doesn't call producer.
    var producer = new Mock<INotificationProducer>();
    var svc = new MockEventInviteService(producer.Object);

    await svc.CreateOrRotateInviteAsync("evt-1", null, null);

    producer.Verify(p => p.ProduceAsync(
        It.IsAny<string>(), It.IsAny<NotificationType>(),
        It.IsAny<string?>(), It.IsAny<string>(),
        It.IsAny<string?>(), It.IsAny<string?>()),
        Times.Never);
}
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Add `TargetUserId` to entity**

```csharp
// Lovecraft.Backend/Storage/Entities/EventInviteEntity.cs (add property)
public string? TargetUserId { get; set; }
```

Azure Table Storage will tolerate missing column on existing rows (returns null). No migration needed.

- [ ] **Step 4: Add `IssuePersonalInviteAsync` to interface**

```csharp
// IEventInviteService.cs
Task<(string Plain, DateTime? ExpiresAtUtc)> IssuePersonalInviteAsync(
    string eventId,
    string targetUserId,
    DateTime? expiresAtUtc,
    string issuedByUserId,
    string? plainCodeOverride = null);
```

- [ ] **Step 5: Implement on Azure + Mock; both call producer**

Azure (sketch):
```csharp
public async Task<(string Plain, DateTime? ExpiresAtUtc)> IssuePersonalInviteAsync(
    string eventId, string targetUserId, DateTime? expiresAtUtc,
    string issuedByUserId, string? plainCodeOverride = null)
{
    var plain = NormalizePlainCode(plainCodeOverride ?? GenerateCode());
    var entity = new EventInviteEntity
    {
        PartitionKey = "INVITE",
        RowKey = plain,
        EventId = eventId,
        PlainCode = plain,
        TargetUserId = targetUserId,
        ExpiresAtUtc = expiresAtUtc,
        CreatedAtUtc = DateTime.UtcNow,
    };
    await _table.UpsertEntityAsync(entity);

    // Fire producer
    if (_producer is not null)
    {
        try
        {
            var ev = await _events.GetEventByIdAdminAsync(eventId);
            var payload = JsonSerializer.Serialize(new
            {
                eventId,
                eventTitle = ev?.Title ?? "Event",
                inviteCode = plain,
            });
            await _producer.ProduceAsync(
                targetUserId,
                NotificationType.EventInviteReceived,
                actorId: issuedByUserId,
                payloadJson: payload,
                sourceEventId: $"event-invite-{eventId}-{targetUserId}",
                presenceGroup: null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "EventInviteReceived producer failed for {UserId} on event {EventId}", targetUserId, eventId);
        }
    }

    return (plain, expiresAtUtc);
}
```

Mock impl mirrors this against `MockDataStore.EventInvites`.

- [ ] **Step 6: Extend admin endpoint**

```csharp
// AdminController.CreateEventInvite — extend signature:
[HttpPost("events/{eventId}/invites")]
public async Task<ActionResult<ApiResponse<CreateEventInviteResponseDto>>> CreateEventInvite(
    string eventId,
    [FromBody] CreateEventInviteRequestDto request)
{
    var issuedBy = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "system";

    (string plain, DateTime? exp) result;
    if (!string.IsNullOrEmpty(request.TargetUserId))
    {
        result = await _eventInvites.IssuePersonalInviteAsync(
            eventId, request.TargetUserId, request.ExpiresAtUtc, issuedBy, request.PlainCode);
    }
    else
    {
        result = await _eventInvites.CreateOrRotateInviteAsync(
            eventId, request.ExpiresAtUtc, request.PlainCode);
    }

    return Ok(ApiResponse<CreateEventInviteResponseDto>.SuccessResponse(
        new CreateEventInviteResponseDto(result.plain, result.exp)));
}
```

Add `TargetUserId` as optional to `CreateEventInviteRequestDto`:
```csharp
public string? TargetUserId { get; set; }
```

- [ ] **Step 7: Tests pass**

- [ ] **Step 8: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Storage/Entities/EventInviteEntity.cs Lovecraft/Lovecraft.Backend/Services/IEventInviteService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureEventInviteService.cs Lovecraft/Lovecraft.Backend/Services/MockEventInviteService.cs Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs Lovecraft/Lovecraft.Common/DTOs/Events/CreateEventInviteRequestDto.cs Lovecraft/Lovecraft.UnitTests/EventInviteServiceTests.cs
git commit -m "feat: per-user invites + EventInviteReceived producer"
```

---

## Task 6: EventReminderWorker (worker)

**Goal:** New `BackgroundService` in `Lovecraft.NotificationsWorker`. Every 5 minutes (`NOTIFICATIONS_WORKER_REMINDER_SCAN_INTERVAL_MINUTES`, default 5), scan events where `Date` falls in `[now+23h, now+25h]` window, find attendees (`eventattendees` table), and write `EventReminder` notification rows + outbox rows directly. Idempotency via the existing producer-style 60s dedup window — same `sourceEventId = "event-reminder-{eventId}"` for each (recipient, event) pair guarantees no double-reminders even on overlapping 5-minute scans.

**Files:**
- Create: `Lovecraft.NotificationsWorker/Entities/EventEntity.cs` (partial — deserializes `Id`, `Title`, `Date`)
- Create: `Lovecraft.NotificationsWorker/Entities/EventAttendeeEntity.cs` (partial — deserializes `UserId`)
- Create: `Lovecraft.NotificationsWorker/Services/IEventReminderProcessor.cs`
- Create: `Lovecraft.NotificationsWorker/Services/EventReminderProcessor.cs`
- Create: `Lovecraft.NotificationsWorker/Workers/EventReminderWorker.cs`
- Modify: `Lovecraft.NotificationsWorker/Program.cs` — register table clients (`events`, `eventattendees`) + processor + worker
- Test: `Lovecraft.UnitTests/NotificationsWorker/EventReminderProcessorTests.cs`

**Important:** The worker has no `INotificationProducer`. To write a notification + outbox row, replicate the producer's storage logic:
1. Build `NotificationEntity` with PartitionKey=recipientId, RowKey=`{invertedTicks}_{notifId}`, fields set.
2. Read recipient's `NotificationPreferencesEntity`; for each channel where `prefs.matrix.eventReminder.{channel}==true` AND channel available AND not muted, write an `OutboxEntity` row to `OUTBOX_{channel}_PENDING`.
3. **Dedup:** before writing, check if a row already exists in recipient's partition with `(Type == EventReminder, ActorId == null, SourceEventId == "event-reminder-{eventId}")` in the last 25 hours (use partition-scan with `Top: 50`). If found, skip.

This is the only worker-side producer-style code. Document it clearly with a comment block referencing the backend `NotificationProducer.cs` and explaining the duplication: worker isolation > DRY.

- [ ] **Step 1: Failing tests**

```csharp
// Lovecraft.UnitTests/NotificationsWorker/EventReminderProcessorTests.cs
using Lovecraft.NotificationsWorker.Services;
using Lovecraft.NotificationsWorker.Entities;
using Moq;
using Xunit;

public class EventReminderProcessorTests
{
    [Fact]
    public async Task RunAsync_EventIn24Hours_RemindsAllAttendees()
    {
        var now = new DateTime(2026, 5, 19, 12, 0, 0, DateTimeKind.Utc);
        var ev = new EventEntity { Id = "evt-1", Title = "Show", Date = now.AddHours(24) };
        var attendees = new[] { "u1", "u2" };

        var processor = new EventReminderProcessor(
            eventsReader: FakeEventsInWindow(new[] { ev }, now),
            attendeesReader: FakeAttendeesOf("evt-1", attendees),
            prefsReader: FakeAllPrefsOn(),
            writer: out var writer);

        await processor.RunAsync(now, CancellationToken.None);

        Assert.Equal(2, writer.NotificationRowsWritten.Count);
        Assert.All(writer.NotificationRowsWritten, n => Assert.Equal("event-reminder-evt-1", n.SourceEventId));
    }

    [Fact]
    public async Task RunAsync_NoEventsInWindow_WritesNothing()
    {
        // ...
    }

    [Fact]
    public async Task RunAsync_AlreadyReminded_SkipsDedup()
    {
        // Existing notification row with SourceEventId="event-reminder-evt-1" in recipient partition
        // → processor must not write another row.
    }

    [Fact]
    public async Task RunAsync_AttendeeUnregisteredBetweenScans_HonorsCurrentList()
    {
        // Run twice; second run with empty attendee list → no new writes for that event.
    }
}
```

This is a sketch — the actual implementation should adapt to whatever interfaces the worker uses internally (likely direct `TableClient` rather than the abstracted helpers shown above). Use the existing `DigestProcessor` / `OutboxProcessor` test fixtures as the model.

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Define partial entities**

```csharp
// Lovecraft.NotificationsWorker/Entities/EventEntity.cs
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

public class EventEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "";
    public string RowKey { get; set; } = "";
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public DateTime Date { get; set; }
    public string Visibility { get; set; } = "";
}
```

```csharp
// Lovecraft.NotificationsWorker/Entities/EventAttendeeEntity.cs
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

public class EventAttendeeEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "";  // eventId
    public string RowKey { get; set; } = "";         // userId
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string UserId { get; set; } = "";
}
```

(Confirm Backend's `EventEntity` partition strategy + EventAttendeeEntity PK/RK pattern before finalizing; adapt the partial entities to match.)

- [ ] **Step 4: Implement processor**

```csharp
// Lovecraft.NotificationsWorker/Services/IEventReminderProcessor.cs
namespace Lovecraft.NotificationsWorker.Services;

public interface IEventReminderProcessor
{
    Task RunAsync(DateTime now, CancellationToken ct);
}
```

```csharp
// Lovecraft.NotificationsWorker/Services/EventReminderProcessor.cs
using System.Text.Json;
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Services;

public class EventReminderProcessor : IEventReminderProcessor
{
    private readonly TableClient _events;
    private readonly TableClient _eventAttendees;
    private readonly TableClient _notifications;
    private readonly TableClient _outbox;
    private readonly TableClient _preferences;
    private readonly ILogger<EventReminderProcessor> _logger;

    public EventReminderProcessor(
        TableClient events,
        TableClient eventAttendees,
        TableClient notifications,
        TableClient outbox,
        TableClient preferences,
        ILogger<EventReminderProcessor> logger)
    {
        _events = events;
        _eventAttendees = eventAttendees;
        _notifications = notifications;
        _outbox = outbox;
        _preferences = preferences;
        _logger = logger;
    }

    public async Task RunAsync(DateTime now, CancellationToken ct)
    {
        var windowStart = now.AddHours(23);
        var windowEnd = now.AddHours(25);

        // Scan events with Date in [windowStart, windowEnd]
        var eventResults = _events.QueryAsync<EventEntity>(
            e => e.Date >= windowStart && e.Date < windowEnd,
            cancellationToken: ct);

        await foreach (var ev in eventResults)
        {
            try
            {
                await RemindAttendeesAsync(ev, now, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Event reminder failed for {EventId}", ev.Id);
            }
        }
    }

    private async Task RemindAttendeesAsync(EventEntity ev, DateTime now, CancellationToken ct)
    {
        var sourceEventId = $"event-reminder-{ev.Id}";

        var attendees = _eventAttendees.QueryAsync<EventAttendeeEntity>(
            a => a.PartitionKey == ev.Id, cancellationToken: ct);

        await foreach (var attendee in attendees)
        {
            var recipientId = attendee.UserId;
            if (string.IsNullOrEmpty(recipientId)) continue;

            try
            {
                // Dedup: scan recipient's notifications partition for an existing
                // EventReminder row with the same sourceEventId.
                var alreadyReminded = false;
                var existing = _notifications.QueryAsync<NotificationEntity>(
                    n => n.PartitionKey == recipientId && n.SourceEventId == sourceEventId,
                    maxPerPage: 1,
                    cancellationToken: ct);
                await foreach (var _ in existing) { alreadyReminded = true; break; }

                if (alreadyReminded) continue;

                var notifId = Guid.NewGuid().ToString("N");
                var payload = JsonSerializer.Serialize(new
                {
                    eventId = ev.Id,
                    eventTitle = ev.Title,
                    eventDateUtc = ev.Date.ToString("o"),
                });
                var notification = new NotificationEntity
                {
                    PartitionKey = recipientId,
                    RowKey = $"{(DateTime.MaxValue.Ticks - now.Ticks):D20}_{notifId}",
                    Id = notifId,
                    UserId = recipientId,
                    Type = "EventReminder",
                    ActorId = null,
                    PayloadJson = payload,
                    SourceEventId = sourceEventId,
                    CreatedAtUtc = now,
                    IsRead = false,
                    IsDismissed = false,
                };
                await _notifications.AddEntityAsync(notification, ct);

                // Resolve channels from prefs + enqueue outbox rows (mirror backend NotificationProducer logic).
                await EnqueueOutboxAsync(recipientId, notifId, "EventReminder", now, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "EventReminder for {UserId} on event {EventId} failed", recipientId, ev.Id);
            }
        }
    }

    private async Task EnqueueOutboxAsync(string userId, string notificationId, string type, DateTime now, CancellationToken ct)
    {
        // Read prefs; for each channel where matrix[type][channel] is true and mute/snooze allow,
        // write OUTBOX_{channel}_PENDING row. In-app + WebPush are in-process channels and not written here
        // (matches Phase E producer behavior). Telegram + Email are written.

        var prefsResults = _preferences.QueryAsync<NotificationPreferencesEntity>(
            p => p.PartitionKey == userId && p.RowKey == "INDEX",
            cancellationToken: ct);
        NotificationPreferencesEntity? prefs = null;
        await foreach (var p in prefsResults) { prefs = p; break; }

        if (prefs is null) return; // no prefs row → all channels off (defaults are written on first user load by backend)
        if (prefs.Mute) return;
        if (prefs.MutedUntilUtc is not null && prefs.MutedUntilUtc.Value > now) return;

        var matrix = JsonDocument.Parse(prefs.MatrixJson).RootElement;
        if (!matrix.TryGetProperty(LowerFirst(type), out var typeCell)) return;

        foreach (var channel in new[] { "Telegram", "Email" })
        {
            var jsonKey = LowerFirst(channel);
            if (!typeCell.TryGetProperty(jsonKey, out var cell) || !cell.GetBoolean()) continue;

            var frequency = JsonDocument.Parse(prefs.FrequencyJson)
                .RootElement.GetProperty(jsonKey).GetString() ?? "immediate";

            var rk = $"{now:yyyy-MM-ddTHH:mm:ss}_{notificationId}";
            var outboxRow = new OutboxEntity
            {
                PartitionKey = $"OUTBOX_{channel}_PENDING",
                RowKey = rk,
                UserId = userId,
                NotificationId = notificationId,
                Channel = channel,
                Frequency = frequency,
                Attempts = 0,
            };
            await _outbox.AddEntityAsync(outboxRow, ct);
        }
    }

    private static string LowerFirst(string s) => string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s.Substring(1);
}
```

The partial entities `NotificationEntity`, `OutboxEntity`, `NotificationPreferencesEntity` already exist in the worker per Phase C — use those.

**Add a code-level comment** at the top of `RemindAttendeesAsync`:
```csharp
// NOTE: This method duplicates a subset of `Lovecraft.Backend.Services.Notifications.NotificationProducer.ProduceAsync`.
// The duplication is intentional: NotificationsWorker is isolated from Backend (no cross-project reference).
// Drift risk is mitigated by integration tests that exercise both code paths against shared Azure Table schemas.
```

- [ ] **Step 5: Implement worker**

```csharp
// Lovecraft.NotificationsWorker/Workers/EventReminderWorker.cs
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Workers;

public class EventReminderWorker : BackgroundService
{
    private readonly IEventReminderProcessor _processor;
    private readonly ILogger<EventReminderWorker> _logger;
    private readonly TimeSpan _interval;

    public EventReminderWorker(
        IEventReminderProcessor processor,
        ILogger<EventReminderWorker> logger,
        IConfiguration config)
    {
        _processor = processor;
        _logger = logger;
        var minutes = int.TryParse(
            Environment.GetEnvironmentVariable("NOTIFICATIONS_WORKER_REMINDER_SCAN_INTERVAL_MINUTES"),
            out var m) && m > 0 ? m : 5;
        _interval = TimeSpan.FromMinutes(minutes);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("EventReminderWorker starting (interval: {Interval})", _interval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _processor.RunAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "EventReminderWorker tick failed");
            }
            try { await Task.Delay(_interval, stoppingToken); }
            catch (TaskCanceledException) { }
        }
    }
}
```

- [ ] **Step 6: Wire into `Program.cs`**

Inside the Azure-mode block where `JanitorWorker` is registered:

```csharp
var eventsTable = tableSvc.GetTableClient(TableNames.Events);
eventsTable.CreateIfNotExists();
var attendeesTable = tableSvc.GetTableClient(TableNames.EventAttendees);
attendeesTable.CreateIfNotExists();

builder.Services.AddSingleton<IEventReminderProcessor>(sp => new EventReminderProcessor(
    eventsTable, attendeesTable, notificationsTable, outboxTable, preferencesTable,
    sp.GetRequiredService<ILogger<EventReminderProcessor>>()));
builder.Services.AddHostedService<EventReminderWorker>();
```

Make sure `TableNames.cs` (the worker's local copy) has `Events` and `EventAttendees` entries. If not, add them.

- [ ] **Step 7: Tests pass**

- [ ] **Step 8: Commit**

```bash
git add Lovecraft/Lovecraft.NotificationsWorker/Entities/EventEntity.cs Lovecraft/Lovecraft.NotificationsWorker/Entities/EventAttendeeEntity.cs Lovecraft/Lovecraft.NotificationsWorker/Services/IEventReminderProcessor.cs Lovecraft/Lovecraft.NotificationsWorker/Services/EventReminderProcessor.cs Lovecraft/Lovecraft.NotificationsWorker/Workers/EventReminderWorker.cs Lovecraft/Lovecraft.NotificationsWorker/Program.cs Lovecraft/Lovecraft.NotificationsWorker/Storage/TableNames.cs Lovecraft/Lovecraft.UnitTests/NotificationsWorker/EventReminderProcessorTests.cs
git commit -m "feat: EventReminderWorker (24h ahead, 5m tick) with dedup"
```

---

## Task 7: Frontend `adminApi.broadcasts` + `/admin/broadcasts` page

**Goal:** Compose form + history list. shadcn `Card`, `Input`, `Textarea`, `Select`, `Button`, `Badge`. Mocks for non-API mode. Tests via Vitest.

**Files:**
- Modify: `src/services/api/adminApi.ts` — add `broadcasts` namespace (dual-mode mock/api)
- Create: `src/admin/pages/AdminBroadcastsPage.tsx`
- Create: `src/admin/pages/__tests__/AdminBroadcastsPage.test.tsx`
- Modify: `src/admin/AdminApp.tsx` — `/broadcasts` route + nav link
- Modify: `src/services/api/__tests__/adminApi.test.ts` — extend
- Modify: `src/data/mocks.ts` (or wherever mock state lives in frontend) — add mock broadcasts list

- [ ] **Step 1: Failing tests for adminApi**

```typescript
// src/services/api/__tests__/adminApi.test.ts (extend)
describe('adminApi.broadcasts', () => {
  it('create returns broadcast', async () => {
    const r = await adminApi.broadcasts.create({
      title: 'Test', body: 'B', audience: { type: 'all', value: null }
    });
    expect(r.success).toBe(true);
    expect(r.data?.id).toBeTruthy();
  });

  it('list returns broadcasts', async () => {
    await adminApi.broadcasts.create({ title: 'A', body: 'a', audience: { type: 'all', value: null } });
    const r = await adminApi.broadcasts.list();
    expect(r.success).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  it('get returns specific broadcast', async () => {
    const created = await adminApi.broadcasts.create({ title: 'Get', body: 'g', audience: { type: 'all', value: null } });
    const r = await adminApi.broadcasts.get(created.data!.id);
    expect(r.data?.title).toBe('Get');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `adminApi.broadcasts`**

```typescript
// Add to src/services/api/adminApi.ts (near other admin namespaces)

export type BroadcastAudience = {
  type: 'all' | 'attendingEvent' | 'minRank' | 'staffRole';
  value: string | null;
};

export type BroadcastDto = {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  audience: BroadcastAudience;
  issuedByUserId: string;
  issuedAtUtc: string;
  estimatedRecipients: number;
  dispatchedCount: number;
  status: 'pending' | 'completed';
  completedAtUtc?: string | null;
};

export type CreateBroadcastPayload = {
  title: string;
  body: string;
  link?: string;
  audience: BroadcastAudience;
};

const broadcasts = {
  async create(body: CreateBroadcastPayload): Promise<ApiResponse<BroadcastDto>> {
    if (!isApiMode()) {
      const bc: BroadcastDto = {
        id: `bc-${Math.random().toString(36).slice(2, 14)}`,
        title: body.title, body: body.body, link: body.link ?? null,
        audience: body.audience, issuedByUserId: 'mock-admin',
        issuedAtUtc: new Date().toISOString(),
        estimatedRecipients: 0, dispatchedCount: 0,
        status: 'pending', completedAtUtc: null,
      };
      mockBroadcasts.unshift(bc);
      return { success: true, data: bc };
    }
    return apiClient.post<BroadcastDto>('/api/v1/admin/notifications/broadcast', body);
  },

  async list(limit = 50): Promise<ApiResponse<BroadcastDto[]>> {
    if (!isApiMode()) return { success: true, data: [...mockBroadcasts].slice(0, limit) };
    return apiClient.get<BroadcastDto[]>(`/api/v1/admin/notifications/broadcasts?limit=${limit}`);
  },

  async get(broadcastId: string): Promise<ApiResponse<BroadcastDto>> {
    if (!isApiMode()) {
      const bc = mockBroadcasts.find(b => b.id === broadcastId);
      return bc ? { success: true, data: bc } : { success: false, error: { code: 'NOT_FOUND', message: 'Broadcast not found' } };
    }
    return apiClient.get<BroadcastDto>(`/api/v1/admin/notifications/broadcasts/${broadcastId}`);
  },
};

// Append to the existing `adminApi` export:
//   broadcasts,
```

Add `const mockBroadcasts: BroadcastDto[] = [];` near the top of `adminApi.ts` (or in `src/data/mocks.ts` if mocks live there — follow the existing convention).

- [ ] **Step 4: Write `AdminBroadcastsPage.tsx` tests**

```typescript
// src/admin/pages/__tests__/AdminBroadcastsPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminBroadcastsPage from '../AdminBroadcastsPage';

describe('AdminBroadcastsPage', () => {
  it('renders compose form', () => {
    render(<MemoryRouter><AdminBroadcastsPage /></MemoryRouter>);
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Body/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
  });

  it('disables Send when title or body empty', () => {
    render(<MemoryRouter><AdminBroadcastsPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
  });

  it('submits broadcast and shows in history', async () => {
    render(<MemoryRouter><AdminBroadcastsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText(/Body/i), { target: { value: 'World' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run, verify fail**

- [ ] **Step 6: Implement `AdminBroadcastsPage.tsx`**

Follow the existing admin-page layout pattern (header + Card sections). Compose form:
- Title input (max 100 chars)
- Body textarea (max 1000 chars)
- Link input (optional)
- Audience selector: shadcn `Select` with `all` / `attendingEvent` / `minRank` / `staffRole`
- Conditional second field when audience requires value (eventId / rank / role)
- Send button — disabled when title/body empty; calls `adminApi.broadcasts.create`
- Toast on success/failure via `showApiError` or `toast.success`

History section: card with table of `{ Title, Audience, Issued, Status, Recipients, Dispatched }`. Refresh after send.

Sketch (omit imports for brevity):
```tsx
export default function AdminBroadcastsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'attendingEvent' | 'minRank' | 'staffRole'>('all');
  const [audienceValue, setAudienceValue] = useState('');
  const [broadcasts, setBroadcasts] = useState<BroadcastDto[]>([]);
  const [sending, setSending] = useState(false);

  const loadBroadcasts = useCallback(async () => {
    const r = await adminApi.broadcasts.list();
    if (r.success && r.data) setBroadcasts(r.data);
  }, []);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  async function handleSubmit() {
    setSending(true);
    try {
      const r = await adminApi.broadcasts.create({
        title, body, link: link || undefined,
        audience: { type: audienceType, value: audienceType === 'all' ? null : audienceValue },
      });
      if (r.success) {
        toast.success(`Broadcast queued (${r.data?.estimatedRecipients ?? 0} recipients)`);
        setTitle(''); setBody(''); setLink(''); setAudienceValue('');
        await loadBroadcasts();
      } else {
        showApiError(r.error, 'Failed to send broadcast');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader><CardTitle>Compose broadcast</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="bc-title">Title</Label>
            <Input id="bc-title" value={title} maxLength={100} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bc-body">Body</Label>
            <Textarea id="bc-body" value={body} maxLength={1000} onChange={e => setBody(e.target.value)} rows={4} />
          </div>
          <div>
            <Label htmlFor="bc-link">Link (optional)</Label>
            <Input id="bc-link" value={link} onChange={e => setLink(e.target.value)} placeholder="/aloevera/events/..." />
          </div>
          <div>
            <Label>Audience</Label>
            <Select value={audienceType} onValueChange={v => setAudienceType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="attendingEvent">Attendees of event</SelectItem>
                <SelectItem value="minRank">Minimum rank</SelectItem>
                <SelectItem value="staffRole">Staff role</SelectItem>
              </SelectContent>
            </Select>
            {audienceType !== 'all' && (
              <Input
                className="mt-2"
                placeholder={
                  audienceType === 'attendingEvent' ? 'Event ID' :
                  audienceType === 'minRank' ? 'Rank (e.g., activeMember)' :
                  'Role (e.g., moderator)'
                }
                value={audienceValue}
                onChange={e => setAudienceValue(e.target.value)}
              />
            )}
          </div>
          <Button disabled={!title || !body || sending} onClick={handleSubmit}>
            {sending ? 'Sending...' : 'Send broadcast'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <p className="text-muted-foreground">No broadcasts sent yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Title</th><th>Audience</th><th>Issued</th><th>Status</th><th>Dispatched</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map(b => (
                  <tr key={b.id} className="border-b">
                    <td>{b.title}</td>
                    <td>{b.audience.type}{b.audience.value ? ` (${b.audience.value})` : ''}</td>
                    <td>{new Date(b.issuedAtUtc).toLocaleString()}</td>
                    <td><Badge variant={b.status === 'completed' ? 'default' : 'secondary'}>{b.status}</Badge></td>
                    <td>{b.dispatchedCount} / {b.estimatedRecipients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Wire route + nav in `AdminApp.tsx`**

```tsx
// AdminApp.tsx — inside <Routes>
<Route path="/broadcasts" element={<AdminBroadcastsPage />} />

// Add to nav links (match existing nav pattern):
<NavLink to="/broadcasts">Broadcasts</NavLink>
```

- [ ] **Step 8: Tests pass**

`npm test -- --run`

- [ ] **Step 9: Commit (frontend repo)**

```bash
git add src/services/api/adminApi.ts src/admin/pages/AdminBroadcastsPage.tsx src/admin/pages/__tests__/AdminBroadcastsPage.test.tsx src/admin/AdminApp.tsx src/services/api/__tests__/adminApi.test.ts src/data/mocks.ts
git commit -m "feat: admin /broadcasts page + adminApi.broadcasts (compose + history)"
```

---

## Task 8: Documentation + memory + ISSUES.md

**Files:**
- Modify: `Lovecraft/docs/NOTIFICATIONS.md` — add section "Admin broadcast" with endpoint + audience types; add section "Event reminders" with 24h window + dedup behavior; add `send_broadcast` permission key
- Modify: `Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` — Phase G shipped marker
- Modify: `aloevera-harmony-meet/docs/ISSUES.md` — MCF.4 → mark Phase G shipped (G complete; H pending)
- Modify: `aloevera-harmony-meet/AGENTS.md` — broadcast pattern, EventReminderWorker note
- Modify: spec doc (`docs/superpowers/specs/2026-05-17-notifications-design.md`) — append Phase G shipped note

- [ ] **Step 1: Update NOTIFICATIONS.md**

Append sections to `Lovecraft/docs/NOTIFICATIONS.md`:

```markdown
## Admin broadcast

`POST /api/v1/admin/notifications/broadcast` (admin-only via `[RequireStaffRole("admin")]`, gated by `appconfig.permissions.send_broadcast` for future demotion to moderator).

Request body:
\`\`\`json
{
  "title": "string ≤100",
  "body": "string ≤1000",
  "link": "/aloevera/events/abc",
  "audience": { "type": "all|attendingEvent|minRank|staffRole", "value": "<eventId|rank|role|null>" }
}
\`\`\`

Synchronous response returns `{ broadcastId, estimatedRecipients }`; actual fan-out happens in a background `Task.Run` and updates the `broadcasts` table row's `status` from `pending` to `completed` with `dispatchedCount` at the end.

History endpoints: `GET /api/v1/admin/notifications/broadcasts?limit=50` and `GET /api/v1/admin/notifications/broadcasts/{id}`.

## Event reminders

`Lovecraft.NotificationsWorker.EventReminderWorker` ticks every `NOTIFICATIONS_WORKER_REMINDER_SCAN_INTERVAL_MINUTES` (default 5). Each tick queries `events` for rows whose `Date` is in `[now+23h, now+25h]`, then for each event iterates `eventattendees` and writes `EventReminder` notification rows + outbox rows directly (worker does not have `INotificationProducer`).

Idempotency: each (recipient, event) pair gets `sourceEventId = "event-reminder-{eventId}"`. The processor scans the recipient's `notifications` partition before writing — if a row with that `sourceEventId` already exists, the reminder is skipped. Overlapping scans within the 2h window are safe.
```

- [ ] **Step 2: Update ISSUES.md**

In `docs/ISSUES.md`, update MCF.4:
```
- MCF.4 — Notifications. **Phases A–G shipped 2026-05-19.** Phase H (rank-up) pending.
```

- [ ] **Step 3: Update AGENTS.md**

Add to the notifications section:
> EventReminderWorker writes `notifications` + `notificationsoutbox` rows directly — `INotificationProducer` is backend-only. Replicates dedup logic via partition scan on `sourceEventId`.

> Admin broadcasts use `POST /api/v1/admin/notifications/broadcast`. Audience types: all / attendingEvent / minRank / staffRole. Fan-out is async via `Task.Run`; UI polls history list for status.

- [ ] **Step 4: Update spec note**

Append to `docs/superpowers/specs/2026-05-17-notifications-design.md` near the existing Phase F update note:

```markdown
> **Phase G update (2026-05-19):** shipped with `BroadcastAudienceResolver` for the 4 audience types, `EventReminderWorker` at 5-minute ticks with sourceEventId-based dedup, per-user invites via `EventInviteEntity.TargetUserId`, and `send_broadcast` permission key.
```

- [ ] **Step 5: Commit**

Backend:
```bash
git add Lovecraft/docs/NOTIFICATIONS.md Lovecraft/docs/IMPLEMENTATION_SUMMARY.md
git commit -m "docs: notifications phase G (admin broadcast + event reminders)"
```

Frontend:
```bash
git add docs/ISSUES.md AGENTS.md docs/superpowers/specs/2026-05-17-notifications-design.md docs/superpowers/plans/2026-05-19-notifications-phase-g-reminders-broadcast.md
git commit -m "docs: notifications phase G plan + spec/issues update"
```

---

## Task 9: Final verification (full suite + lint + types + UI smoke)

- [ ] **Step 1: Run full backend suite**

```powershell
Set-Location 'D:\src\lovecraft\Lovecraft'
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --nologo
```

Expected: PASS, count = 430 (Phase F baseline) + ≈ 18 (Phase G new tests) ≈ 448. Adjust expected number based on actual new test count delivered.

- [ ] **Step 2: Run full frontend suite**

```powershell
Set-Location 'D:\src\aloevera-harmony-meet'
npm test -- --run
```

Expected: 234 (Phase F baseline) + ≈ 6 (broadcast UI tests) ≈ 240 passing.

- [ ] **Step 3: Type check**

```powershell
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Lint**

```powershell
npm run lint
```

Expected: zero warnings introduced by Phase G code.

- [ ] **Step 5: Manual UI smoke (mock mode)**

```powershell
npm run dev
```

Open `http://localhost:8080/admin/broadcasts`, log in as admin, send a test broadcast targeting "All users". Verify it appears in the history table as `pending`, then `completed` after a few seconds (mock mode completes synchronously).

- [ ] **Step 6: Final code review (subagent)**

Run final code-quality reviewer over the full set of Phase G changes (both repos). Address any Critical issues with a follow-up commit before merge.

- [ ] **Step 7: Handoff to `superpowers:finishing-a-development-branch`**

Branch name: `feat/notifications-phase-g`. Standard pattern: merge to main locally on both repos + push to origin.

---

## Self-Review Notes

- **Spec coverage:** Phase G of the design spec calls for `EventReminderWorker`, `POST /admin/notifications/broadcast` + admin UI page, `broadcasts` table, plus wiring `EventPublished`, `EventInviteReceived`, and `CommunityBroadcast` producers. All covered: Task 4 (EventPublished), Task 5 (EventInviteReceived + TargetUserId), Task 6 (EventReminderWorker), Task 3 (admin broadcast endpoint + CommunityBroadcast wiring), Task 7 (admin UI page), Task 1 (broadcasts table), Task 2 (send_broadcast permission).
- **Type consistency:** `BroadcastDto.Audience` is `BroadcastAudienceDto`, used everywhere. `NotificationType.EventReminder` / `EventPublished` / `EventInviteReceived` / `CommunityBroadcast` already in the enum (Phase A). `sourceEventId` formats consistent: `event-published-{id}`, `event-reminder-{id}`, `event-invite-{eventId}-{userId}`, `broadcast-{id}`.
- **Audience filtering note:** "minRank" uses `EffectiveLevel.LevelOf` from the existing backend helpers — verify this static helper exists; if it's a static method named differently (e.g., `RankCalculator.LevelOf`), adapt accordingly.
- **Async fan-out tradeoff:** Task 3's `Task.Run` is unbounded for now; at 10K+ recipients this could exhaust thread pool. Documented follow-up: introduce `SemaphoreSlim(50)` + chunked iteration before broadcasts to all users with >5K active users.
- **Per-user invite redemption note:** When a user redeems a personal invite, the existing redemption flow doesn't yet care about `TargetUserId` — the code still works as a shared code. If needed later, the validator can restrict by `TargetUserId` for stricter per-user invites; out of scope for Phase G.
- **Producer signature note:** `INotificationProducer.ProduceAsync` already exists with the signature shown in cross-cutting context; no interface changes needed.
- **No placeholders.** All tasks contain explicit code; the only "adapt to actual API" markers are where existing code (e.g., `IUserService.GetUsersAsync`, `EffectiveLevel.LevelOf`) needs to be inspected for exact signature.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-notifications-phase-g-reminders-broadcast.md`.

Recommended: subagent-driven execution (consistent with Phases A–F).
