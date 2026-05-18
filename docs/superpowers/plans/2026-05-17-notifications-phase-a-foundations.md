# Notifications — Phase A (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundations for the notifications subsystem — 4 new Azure Tables, the canonical DTOs and enums, four new domain services (notifications, preferences, push subscriptions, presence tracker), one helper (`NotificationPolicy.ResolveChannels`), one dedup helper (`NotificationDeduper`), one in-process channel dispatcher (`InAppDispatcher`), the producer facade, and the user-facing `NotificationsController`. No producer call sites are wired yet — those land in Phase B. No frontend work — also Phase B.

**Architecture:** Producer writes one `notifications` row + N `notificationsoutbox` rows per (recipient, type). `NotificationPolicy.ResolveChannels(userId, type)` returns the channel list to enqueue based on per-user prefs + mute/snooze + channel availability. The in-process `InAppDispatcher` broadcasts `NotificationReceived` over the existing SignalR `ChatHub` for any currently-connected user. All four tables, all DTOs, and the API surface land in this phase so Phase B can focus on wiring producers and frontend.

**Tech Stack:** .NET 10 / ASP.NET Core / Azure Table Storage / SignalR / xUnit.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Repo:**
- Backend only this phase: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)

**Test command:**
- `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`

**Build command:**
- `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`

---

## File map

### New files (backend)

| File | Responsibility |
|---|---|
| `Lovecraft.Common\Enums\NotificationType.cs` | 9-value enum |
| `Lovecraft.Common\Enums\NotificationChannel.cs` | 4-value enum |
| `Lovecraft.Common\Enums\NotificationFrequency.cs` | 3-value enum |
| `Lovecraft.Common\DTOs\Notifications\NotificationDto.cs` | Canonical notification + payload child classes |
| `Lovecraft.Common\DTOs\Notifications\NotificationPreferencesDto.cs` | Matrix + frequency + mute/snooze + daily hour |
| `Lovecraft.Common\DTOs\Notifications\WebPushSubscriptionDto.cs` | Subscription + create-request shapes |
| `Lovecraft.Backend\Storage\Entities\NotificationEntity.cs` | `notifications` row |
| `Lovecraft.Backend\Storage\Entities\NotificationOutboxEntity.cs` | `notificationsoutbox` row |
| `Lovecraft.Backend\Storage\Entities\NotificationPreferencesEntity.cs` | `notificationpreferences` row |
| `Lovecraft.Backend\Storage\Entities\WebPushSubscriptionEntity.cs` | `webpushsubscriptions` row |
| `Lovecraft.Backend\Services\MockNotificationService.cs` | In-memory `INotificationService` |
| `Lovecraft.Backend\Services\MockNotificationPreferenceService.cs` | In-memory `INotificationPreferenceService` |
| `Lovecraft.Backend\Services\MockPushSubscriptionService.cs` | In-memory `IPushSubscriptionService` |
| `Lovecraft.Backend\Services\Azure\AzureNotificationService.cs` | Azure-backed `INotificationService` |
| `Lovecraft.Backend\Services\Azure\AzureNotificationPreferenceService.cs` | Azure-backed `INotificationPreferenceService` |
| `Lovecraft.Backend\Services\Azure\AzurePushSubscriptionService.cs` | Azure-backed `IPushSubscriptionService` |
| `Lovecraft.Backend\Services\Notifications\NotificationPolicy.cs` | `ResolveChannels` static helper |
| `Lovecraft.Backend\Services\Notifications\NotificationDeduper.cs` | 60s same-source-event window |
| `Lovecraft.Backend\Services\Notifications\IPresenceTracker.cs` + `PresenceTracker.cs` | SignalR group membership tracker (singleton) |
| `Lovecraft.Backend\Services\Notifications\IInAppDispatcher.cs` + `InAppDispatcher.cs` | Wraps `IHubContext<ChatHub>` for `NotificationReceived` |
| `Lovecraft.Backend\Services\Notifications\INotificationProducer.cs` + `NotificationProducer.cs` | Producer facade |
| `Lovecraft.Backend\Controllers\V1\NotificationsController.cs` | User-facing CRUD + preferences |
| `Lovecraft.UnitTests\NotificationPolicyTests.cs` | Pref resolution permutations |
| `Lovecraft.UnitTests\NotificationDeduperTests.cs` | 60s dedup window |
| `Lovecraft.UnitTests\NotificationPreferenceServiceTests.cs` | Mock + Azure prefs round-trip + defaults |
| `Lovecraft.UnitTests\NotificationServiceTests.cs` | Mock + Azure notification CRUD |
| `Lovecraft.UnitTests\PushSubscriptionServiceTests.cs` | Mock + Azure subscription CRUD |
| `Lovecraft.UnitTests\PresenceTrackerTests.cs` | Connect/disconnect/group join/leave/multiple-connections |
| `Lovecraft.UnitTests\NotificationProducerTests.cs` | Produce writes rows + calls in-app dispatcher |
| `Lovecraft.UnitTests\NotificationsControllerTests.cs` | Integration via `WebApplicationFactory<Program>` |
| `Lovecraft\docs\NOTIFICATIONS.md` | Backend reference doc (skeleton; expanded in later phases) |

### Modified files (backend)

| File | Change |
|---|---|
| `Lovecraft.Backend\Storage\TableNames.cs` | + `Notifications`, `NotificationsOutbox`, `NotificationPreferences`, `WebPushSubscriptions` |
| `Lovecraft.Backend\Services\IServices.cs` | + `INotificationService`, `INotificationPreferenceService`, `IPushSubscriptionService` |
| `Lovecraft.Backend\MockData\MockDataStore.cs` | + static dicts for notifications, prefs, subscriptions |
| `Lovecraft.Backend\Hubs\ChatHub.cs` | Wire `IPresenceTracker` into `OnConnectedAsync`, `OnDisconnectedAsync`, `JoinChat`, `JoinTopic`, `LeaveGroup` |
| `Lovecraft.Backend\Program.cs` | DI: register all new services per mode switch; map controller |
| `Lovecraft\docs\AZURE_STORAGE.md` | + 4 tables to schema |
| `Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | One-line entry under "Done since the original plan" |
| `Lovecraft\docs\ARCHITECTURE.md` | List notification services under Services tree |

---

## Task ordering

Tasks 1–3 are pure scaffolding (enums, DTOs, storage entities). Tasks 4–14 build the domain services bottom-up: helpers first (policy, dedup, presence), then services (prefs, notifications, subscriptions), then dispatcher, then producer. Tasks 15–16 add the controller. Task 17 wires DI. Task 18 docs. Task 19 final verification.

---

## Task 1: Add enums

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\Enums\NotificationType.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\Enums\NotificationChannel.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\Enums\NotificationFrequency.cs`

Pure shape; no tests needed.

- [ ] **Step 1: Write `NotificationType.cs`**

```csharp
namespace Lovecraft.Common.Enums;

public enum NotificationType
{
    LikeReceived,
    MatchCreated,
    MessageReceived,
    ForumReplyToThread,
    CommunityBroadcast,
    EventPublished,
    EventReminder,
    EventInviteReceived,
    RankUp,
}
```

- [ ] **Step 2: Write `NotificationChannel.cs`**

```csharp
namespace Lovecraft.Common.Enums;

public enum NotificationChannel
{
    InApp,
    Telegram,
    WebPush,
    Email,
}
```

- [ ] **Step 3: Write `NotificationFrequency.cs`**

```csharp
namespace Lovecraft.Common.Enums;

public enum NotificationFrequency
{
    Immediate,
    Hourly,
    Daily,
}
```

- [ ] **Step 4: Build**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Common/Enums/NotificationType.cs' 'Lovecraft/Lovecraft.Common/Enums/NotificationChannel.cs' 'Lovecraft/Lovecraft.Common/Enums/NotificationFrequency.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: add Type, Channel, Frequency enums"
```

---

## Task 2: Add DTOs

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\NotificationDto.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\NotificationPreferencesDto.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\WebPushSubscriptionDto.cs`

Pure shape; no tests needed.

- [ ] **Step 1: Write `NotificationDto.cs`**

```csharp
using Lovecraft.Common.Enums;

namespace Lovecraft.Common.DTOs.Notifications;

public class NotificationDto
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    /// <summary>User id of the actor (sender of like, message, reply etc.). Null for system notifications.</summary>
    public string? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorAvatar { get; set; }
    /// <summary>Type-specific payload, serialized as JSON. Shape varies per Type.</summary>
    public string PayloadJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
    public DateTime? DismissedAtUtc { get; set; }
    /// <summary>Set when this row was rolled into a digest send so the worker doesn't redeliver.</summary>
    public string? DigestGroupId { get; set; }
}

public class NotificationListResponseDto
{
    public List<NotificationDto> Items { get; set; } = new();
    public string? NextCursor { get; set; }
}

public class UnreadCountResponseDto
{
    public int Count { get; set; }
}
```

- [ ] **Step 2: Write `NotificationPreferencesDto.cs`**

```csharp
using Lovecraft.Common.Enums;

namespace Lovecraft.Common.DTOs.Notifications;

public class NotificationPreferencesDto
{
    /// <summary>Per-type, per-channel toggle. Key = NotificationType camelCase. Inner key = NotificationChannel camelCase.</summary>
    public Dictionary<string, Dictionary<string, bool>> Matrix { get; set; } = new();
    /// <summary>Per-channel frequency. Key = NotificationChannel camelCase.</summary>
    public Dictionary<string, NotificationFrequency> Frequency { get; set; } = new();
    /// <summary>UTC hour (0-23) at which daily digests dispatch. Default 9.</summary>
    public int DailyDigestHourUtc { get; set; } = 9;
    /// <summary>Master kill switch.</summary>
    public bool Mute { get; set; }
    /// <summary>If set and in the future, all outbound channels are suppressed (canonical rows still written).</summary>
    public DateTime? MutedUntilUtc { get; set; }
}
```

- [ ] **Step 3: Write `WebPushSubscriptionDto.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Notifications;

public class WebPushSubscriptionDto
{
    public string DeviceId { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
}

public class WebPushSubscriptionRequestDto
{
    public string? DeviceId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
}
```

- [ ] **Step 4: Build**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Common/DTOs/Notifications/'
git -C 'D:\src\lovecraft' commit -m "notifications: add Notification, Preferences, WebPushSubscription DTOs"
```

---

## Task 3: Add table names and storage entities

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\TableNames.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\NotificationEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\NotificationOutboxEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\NotificationPreferencesEntity.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\WebPushSubscriptionEntity.cs`

Pure shape; no tests.

- [ ] **Step 1: Add 4 table names to `TableNames.cs`**

In `TableNames.cs`, append after the existing `UserGoogleIndex` line:

```csharp
public static string Notifications          => Prefix + "notifications";
public static string NotificationsOutbox    => Prefix + "notificationsoutbox";
public static string NotificationPreferences => Prefix + "notificationpreferences";
public static string WebPushSubscriptions   => Prefix + "webpushsubscriptions";
```

- [ ] **Step 2: Write `NotificationEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

/// <summary>
/// Canonical notification record. PartitionKey = recipient userId,
/// RowKey = {invertedTicks}_{notificationId} so newest sort first.
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
    /// <summary>Natural key of the underlying event (messageId / replyId / likeId) used by NotificationDeduper.</summary>
    public string? SourceEventId { get; set; }

    public static string GetPartitionKey(string userId) => userId;
    public static string GetRowKey(string notificationId, DateTime createdAtUtc) =>
        $"{(DateTime.MaxValue.Ticks - createdAtUtc.Ticks):D19}_{notificationId}";
}
```

- [ ] **Step 3: Write `NotificationOutboxEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

/// <summary>
/// One row per (notification, channel) delivery attempt.
/// PartitionKey = OUTBOX_{channel}_PENDING while pending,
/// OUTBOX_{channel}_DONE_{yyyy-MM-dd} after success,
/// OUTBOX_{channel}_DEAD_{yyyy-MM-dd} after 5 failed attempts.
/// RowKey = {scheduledForUtc:yyyy-MM-ddTHH:mm:ss}_{notificationId} (lex = chronological).
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

- [ ] **Step 4: Write `NotificationPreferencesEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

/// <summary>PartitionKey = userId, RowKey = INDEX.</summary>
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

- [ ] **Step 5: Write `WebPushSubscriptionEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

/// <summary>PartitionKey = userId, RowKey = deviceId.</summary>
public class WebPushSubscriptionEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
}
```

- [ ] **Step 6: Build**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Storage/TableNames.cs' 'Lovecraft/Lovecraft.Backend/Storage/Entities/NotificationEntity.cs' 'Lovecraft/Lovecraft.Backend/Storage/Entities/NotificationOutboxEntity.cs' 'Lovecraft/Lovecraft.Backend/Storage/Entities/NotificationPreferencesEntity.cs' 'Lovecraft/Lovecraft.Backend/Storage/Entities/WebPushSubscriptionEntity.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: add 4 storage tables + entity classes"
```

---

## Task 4: `NotificationPolicy.ResolveChannels` static helper

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\NotificationPolicy.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationPolicyTests.cs`

Pure function over (prefs, type, channel availability) → list of channels to enqueue.

- [ ] **Step 1: Write the failing tests in `NotificationPolicyTests.cs`**

```csharp
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class NotificationPolicyTests
{
    private static NotificationPreferencesDto Defaults()
    {
        var prefs = new NotificationPreferencesDto();
        foreach (var type in Enum.GetNames<NotificationType>())
        {
            var key = char.ToLowerInvariant(type[0]) + type[1..];
            prefs.Matrix[key] = new Dictionary<string, bool>
            {
                { "inApp", true }, { "telegram", false }, { "webPush", false }, { "email", false }
            };
        }
        prefs.Frequency["inApp"]    = NotificationFrequency.Immediate;
        prefs.Frequency["telegram"] = NotificationFrequency.Immediate;
        prefs.Frequency["webPush"]  = NotificationFrequency.Immediate;
        prefs.Frequency["email"]    = NotificationFrequency.Daily;
        return prefs;
    }

    private static ChannelAvailability AllAvailable() => new()
    {
        TelegramLinked = true, EmailVerified = true, WebPushSubscribed = true,
    };

    [Fact]
    public void Default_prefs_returns_only_in_app_for_any_type()
    {
        var prefs = Defaults();
        var avail = AllAvailable();

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, avail);

        Assert.Single(result);
        Assert.Contains(NotificationChannel.InApp, result);
    }

    [Fact]
    public void Enabled_telegram_for_type_is_returned_when_available()
    {
        var prefs = Defaults();
        prefs.Matrix["likeReceived"]["telegram"] = true;

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, AllAvailable());

        Assert.Equal(2, result.Count);
        Assert.Contains(NotificationChannel.InApp, result);
        Assert.Contains(NotificationChannel.Telegram, result);
    }

    [Fact]
    public void Enabled_telegram_but_not_linked_skips_telegram()
    {
        var prefs = Defaults();
        prefs.Matrix["likeReceived"]["telegram"] = true;
        var avail = AllAvailable();
        avail.TelegramLinked = false;

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, avail);

        Assert.Single(result);
        Assert.Contains(NotificationChannel.InApp, result);
    }

    [Fact]
    public void Master_mute_returns_empty()
    {
        var prefs = Defaults();
        prefs.Matrix["likeReceived"]["telegram"] = true;
        prefs.Mute = true;

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, AllAvailable());

        Assert.Empty(result);
    }

    [Fact]
    public void Snooze_in_future_returns_empty()
    {
        var prefs = Defaults();
        prefs.MutedUntilUtc = DateTime.UtcNow.AddHours(1);

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, AllAvailable());

        Assert.Empty(result);
    }

    [Fact]
    public void Snooze_in_past_is_ignored()
    {
        var prefs = Defaults();
        prefs.MutedUntilUtc = DateTime.UtcNow.AddHours(-1);

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.LikeReceived, AllAvailable());

        Assert.Single(result);
        Assert.Contains(NotificationChannel.InApp, result);
    }

    [Fact]
    public void Web_push_returned_only_when_subscribed()
    {
        var prefs = Defaults();
        prefs.Matrix["messageReceived"]["webPush"] = true;
        var avail = AllAvailable();
        avail.WebPushSubscribed = false;

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.MessageReceived, avail);

        Assert.Single(result);
        Assert.DoesNotContain(NotificationChannel.WebPush, result);
    }

    [Fact]
    public void Email_returned_only_when_verified()
    {
        var prefs = Defaults();
        prefs.Matrix["matchCreated"]["email"] = true;
        var avail = AllAvailable();
        avail.EmailVerified = false;

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.MatchCreated, avail);

        Assert.Single(result);
        Assert.DoesNotContain(NotificationChannel.Email, result);
    }

    [Fact]
    public void Missing_type_key_falls_back_to_in_app_only()
    {
        var prefs = new NotificationPreferencesDto();   // empty matrix

        var result = NotificationPolicy.ResolveChannels(prefs, NotificationType.RankUp, AllAvailable());

        Assert.Single(result);
        Assert.Contains(NotificationChannel.InApp, result);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationPolicyTests"`
Expected: Compilation error — `NotificationPolicy` does not exist.

- [ ] **Step 3: Write `NotificationPolicy.cs`**

```csharp
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services.Notifications;

/// <summary>Snapshot of which channels a user has set up (link / verify / subscribe).</summary>
public class ChannelAvailability
{
    public bool TelegramLinked { get; set; }
    public bool EmailVerified { get; set; }
    public bool WebPushSubscribed { get; set; }
}

/// <summary>
/// Pure function: given user prefs, the notification type, and which channels the user
/// has set up, return the list of channels to write outbox rows for. In-app is the
/// inbox baseline — it stays on by default even when the matrix key is missing.
/// </summary>
public static class NotificationPolicy
{
    public static List<NotificationChannel> ResolveChannels(
        NotificationPreferencesDto prefs,
        NotificationType type,
        ChannelAvailability avail)
    {
        if (prefs.Mute) return new();
        if (prefs.MutedUntilUtc.HasValue && prefs.MutedUntilUtc.Value > DateTime.UtcNow) return new();

        var key = ChannelKey(type);
        var row = prefs.Matrix.TryGetValue(key, out var r) ? r : new Dictionary<string, bool>();

        var result = new List<NotificationChannel>();

        if (Enabled(row, "inApp", defaultValue: true))
            result.Add(NotificationChannel.InApp);

        if (Enabled(row, "telegram") && avail.TelegramLinked)
            result.Add(NotificationChannel.Telegram);

        if (Enabled(row, "webPush") && avail.WebPushSubscribed)
            result.Add(NotificationChannel.WebPush);

        if (Enabled(row, "email") && avail.EmailVerified)
            result.Add(NotificationChannel.Email);

        return result;
    }

    private static bool Enabled(Dictionary<string, bool> row, string channelKey, bool defaultValue = false)
        => row.TryGetValue(channelKey, out var v) ? v : defaultValue;

    private static string ChannelKey(NotificationType type)
    {
        var name = type.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationPolicyTests"`
Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/NotificationPolicy.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationPolicyTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: NotificationPolicy.ResolveChannels + tests"
```

---

## Task 5: `INotificationPreferenceService` + `MockNotificationPreferenceService`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockNotificationPreferenceService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\MockData\MockDataStore.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationPreferenceServiceTests.cs`

The service returns spec defaults when no row exists. Defaults: matrix entirely false except `inApp:true`; `inApp:immediate`, `telegram:immediate`, `webPush:immediate`, `email:daily`; `dailyDigestHourUtc:9`.

- [ ] **Step 1: Add `INotificationPreferenceService` to `IServices.cs`**

In `IServices.cs`, append after the last interface (`IForumService` block or wherever the last one ends):

```csharp
public interface INotificationPreferenceService
{
    Task<Lovecraft.Common.DTOs.Notifications.NotificationPreferencesDto> GetPreferencesAsync(string userId);
    Task<Lovecraft.Common.DTOs.Notifications.NotificationPreferencesDto> UpdatePreferencesAsync(
        string userId,
        Lovecraft.Common.DTOs.Notifications.NotificationPreferencesDto prefs);
}
```

(Add `using Lovecraft.Common.DTOs.Notifications;` at top of `IServices.cs` and shorten the type refs.)

- [ ] **Step 2: Add storage to `MockDataStore.cs`**

In `MockDataStore.cs`, add inside the class body:

```csharp
public static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Lovecraft.Common.DTOs.Notifications.NotificationPreferencesDto> NotificationPreferences = new();
public static readonly System.Collections.Concurrent.ConcurrentDictionary<string, List<Lovecraft.Common.DTOs.Notifications.NotificationDto>> Notifications = new();
public static readonly System.Collections.Concurrent.ConcurrentDictionary<(string UserId, string DeviceId), Lovecraft.Common.DTOs.Notifications.WebPushSubscriptionDto> PushSubscriptions = new();
```

- [ ] **Step 3: Write the failing tests**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class NotificationPreferenceServiceTests
{
    [Fact]
    public async Task Get_returns_defaults_when_no_row_exists()
    {
        MockDataStore.NotificationPreferences.Clear();
        var svc = new MockNotificationPreferenceService();

        var prefs = await svc.GetPreferencesAsync("user-new");

        // 9 types in matrix, each with 4 channels
        Assert.Equal(9, prefs.Matrix.Count);
        foreach (var kvp in prefs.Matrix)
        {
            Assert.True(kvp.Value["inApp"], $"inApp should default true for {kvp.Key}");
            Assert.False(kvp.Value["telegram"]);
            Assert.False(kvp.Value["webPush"]);
            Assert.False(kvp.Value["email"]);
        }
        Assert.Equal(NotificationFrequency.Immediate, prefs.Frequency["inApp"]);
        Assert.Equal(NotificationFrequency.Immediate, prefs.Frequency["telegram"]);
        Assert.Equal(NotificationFrequency.Immediate, prefs.Frequency["webPush"]);
        Assert.Equal(NotificationFrequency.Daily, prefs.Frequency["email"]);
        Assert.Equal(9, prefs.DailyDigestHourUtc);
        Assert.False(prefs.Mute);
        Assert.Null(prefs.MutedUntilUtc);
    }

    [Fact]
    public async Task Update_then_Get_round_trips()
    {
        MockDataStore.NotificationPreferences.Clear();
        var svc = new MockNotificationPreferenceService();

        var prefs = await svc.GetPreferencesAsync("user-1");
        prefs.Matrix["likeReceived"]["telegram"] = true;
        prefs.DailyDigestHourUtc = 20;

        await svc.UpdatePreferencesAsync("user-1", prefs);
        var loaded = await svc.GetPreferencesAsync("user-1");

        Assert.True(loaded.Matrix["likeReceived"]["telegram"]);
        Assert.Equal(20, loaded.DailyDigestHourUtc);
    }

    [Fact]
    public async Task Update_isolates_users()
    {
        MockDataStore.NotificationPreferences.Clear();
        var svc = new MockNotificationPreferenceService();

        var aPrefs = await svc.GetPreferencesAsync("user-a");
        aPrefs.Mute = true;
        await svc.UpdatePreferencesAsync("user-a", aPrefs);

        var bPrefs = await svc.GetPreferencesAsync("user-b");
        Assert.False(bPrefs.Mute);
    }
}
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationPreferenceServiceTests"`
Expected: Compilation error — `MockNotificationPreferenceService` does not exist.

- [ ] **Step 5: Write `MockNotificationPreferenceService.cs`**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services;

public class MockNotificationPreferenceService : INotificationPreferenceService
{
    public Task<NotificationPreferencesDto> GetPreferencesAsync(string userId)
    {
        if (MockDataStore.NotificationPreferences.TryGetValue(userId, out var existing))
            return Task.FromResult(Clone(existing));

        return Task.FromResult(BuildDefaults());
    }

    public Task<NotificationPreferencesDto> UpdatePreferencesAsync(string userId, NotificationPreferencesDto prefs)
    {
        MockDataStore.NotificationPreferences[userId] = Clone(prefs);
        return Task.FromResult(Clone(prefs));
    }

    public static NotificationPreferencesDto BuildDefaults()
    {
        var prefs = new NotificationPreferencesDto { DailyDigestHourUtc = 9 };
        foreach (var name in Enum.GetNames<NotificationType>())
        {
            var key = char.ToLowerInvariant(name[0]) + name[1..];
            prefs.Matrix[key] = new Dictionary<string, bool>
            {
                { "inApp",    true  },
                { "telegram", false },
                { "webPush",  false },
                { "email",    false },
            };
        }
        prefs.Frequency["inApp"]    = NotificationFrequency.Immediate;
        prefs.Frequency["telegram"] = NotificationFrequency.Immediate;
        prefs.Frequency["webPush"]  = NotificationFrequency.Immediate;
        prefs.Frequency["email"]    = NotificationFrequency.Daily;
        return prefs;
    }

    private static NotificationPreferencesDto Clone(NotificationPreferencesDto src)
    {
        var copy = new NotificationPreferencesDto
        {
            DailyDigestHourUtc = src.DailyDigestHourUtc,
            Mute = src.Mute,
            MutedUntilUtc = src.MutedUntilUtc,
        };
        foreach (var kvp in src.Matrix)
            copy.Matrix[kvp.Key] = new Dictionary<string, bool>(kvp.Value);
        foreach (var kvp in src.Frequency)
            copy.Frequency[kvp.Key] = kvp.Value;
        return copy;
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationPreferenceServiceTests"`
Expected: All 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/IServices.cs' 'Lovecraft/Lovecraft.Backend/Services/MockNotificationPreferenceService.cs' 'Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationPreferenceServiceTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: INotificationPreferenceService + mock + tests"
```

---

## Task 6: `AzureNotificationPreferenceService`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureNotificationPreferenceService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationPreferenceServiceTests.cs` (extend with Azurite-backed cases)

If Azurite is not part of CI, follow the existing pattern in `AzureUserServiceTests.cs` — use the `TableClient` mock approach with `Moq`. To stay consistent with the existing test style, this task wraps the Azure impl in a thin abstraction tested via `Moq` rather than spinning up Azurite.

- [ ] **Step 1: Add the failing Azure test (using `Moq`-mocked `TableClient`)**

Append to `NotificationPreferenceServiceTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Services.Azure;
using Lovecraft.Backend.Storage.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

public class AzureNotificationPreferenceServiceTests
{
    [Fact]
    public async Task Get_returns_defaults_when_row_missing()
    {
        var table = new Mock<TableClient>();
        table.Setup(t => t.GetEntityAsync<NotificationPreferencesEntity>(
                "user-1", "INDEX", It.IsAny<IEnumerable<string>>(), default))
            .ThrowsAsync(new RequestFailedException(404, "not found"));

        var svc = new AzureNotificationPreferenceService(table.Object, NullLogger<AzureNotificationPreferenceService>.Instance);

        var prefs = await svc.GetPreferencesAsync("user-1");

        Assert.True(prefs.Matrix["likeReceived"]["inApp"]);
        Assert.False(prefs.Matrix["likeReceived"]["telegram"]);
        Assert.Equal(9, prefs.DailyDigestHourUtc);
    }

    [Fact]
    public async Task Update_serializes_matrix_and_frequency()
    {
        var table = new Mock<TableClient>();
        NotificationPreferencesEntity? upserted = null;
        table.Setup(t => t.UpsertEntityAsync(
                It.IsAny<NotificationPreferencesEntity>(),
                It.IsAny<TableUpdateMode>(),
                default))
            .Callback<NotificationPreferencesEntity, TableUpdateMode, CancellationToken>((e, _, _) => upserted = e)
            .ReturnsAsync(new Mock<Response>().Object);

        var svc = new AzureNotificationPreferenceService(table.Object, NullLogger<AzureNotificationPreferenceService>.Instance);

        var prefs = MockNotificationPreferenceService.BuildDefaults();
        prefs.DailyDigestHourUtc = 18;
        prefs.Matrix["likeReceived"]["telegram"] = true;

        await svc.UpdatePreferencesAsync("user-2", prefs);

        Assert.NotNull(upserted);
        Assert.Equal("user-2", upserted!.PartitionKey);
        Assert.Equal("INDEX", upserted.RowKey);
        Assert.Equal(18, upserted.DailyDigestHourUtc);
        Assert.Contains("\"telegram\":true", upserted.MatrixJson);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureNotificationPreferenceServiceTests"`
Expected: Compilation error — `AzureNotificationPreferenceService` does not exist.

- [ ] **Step 3: Write `AzureNotificationPreferenceService.cs`**

```csharp
using System.Text.Json;
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Azure;

public class AzureNotificationPreferenceService : INotificationPreferenceService
{
    private readonly TableClient _table;
    private readonly ILogger<AzureNotificationPreferenceService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public AzureNotificationPreferenceService(TableClient table, ILogger<AzureNotificationPreferenceService> logger)
    {
        _table = table;
        _logger = logger;
    }

    public async Task<NotificationPreferencesDto> GetPreferencesAsync(string userId)
    {
        try
        {
            var entity = await _table.GetEntityAsync<NotificationPreferencesEntity>(userId, "INDEX");
            return FromEntity(entity.Value);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return MockNotificationPreferenceService.BuildDefaults();
        }
    }

    public async Task<NotificationPreferencesDto> UpdatePreferencesAsync(string userId, NotificationPreferencesDto prefs)
    {
        var entity = new NotificationPreferencesEntity
        {
            PartitionKey = userId,
            RowKey = "INDEX",
            MatrixJson = JsonSerializer.Serialize(prefs.Matrix, JsonOpts),
            FrequencyJson = JsonSerializer.Serialize(prefs.Frequency, JsonOpts),
            DailyDigestHourUtc = prefs.DailyDigestHourUtc,
            Mute = prefs.Mute,
            MutedUntilUtc = prefs.MutedUntilUtc,
        };
        await _table.UpsertEntityAsync(entity, TableUpdateMode.Replace);
        return prefs;
    }

    private static NotificationPreferencesDto FromEntity(NotificationPreferencesEntity e)
    {
        var dto = MockNotificationPreferenceService.BuildDefaults();
        try
        {
            var matrix = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, bool>>>(e.MatrixJson, JsonOpts);
            if (matrix is not null) dto.Matrix = matrix;
        }
        catch { /* fall back to defaults */ }
        try
        {
            var freq = JsonSerializer.Deserialize<Dictionary<string, NotificationFrequency>>(e.FrequencyJson, JsonOpts);
            if (freq is not null) dto.Frequency = freq;
        }
        catch { /* fall back to defaults */ }
        dto.DailyDigestHourUtc = e.DailyDigestHourUtc;
        dto.Mute = e.Mute;
        dto.MutedUntilUtc = e.MutedUntilUtc;
        return dto;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureNotificationPreferenceServiceTests"`
Expected: All 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureNotificationPreferenceService.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationPreferenceServiceTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: AzureNotificationPreferenceService + tests"
```

---

## Task 7: `INotificationService` + `MockNotificationService`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockNotificationService.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationServiceTests.cs`

CRUD on the `notifications` table + outbox rows. List paginated newest-first; mark-read / dismiss / mark-all-read; recent-for-dedup window helper.

- [ ] **Step 1: Add `INotificationService` to `IServices.cs`**

Append:

```csharp
public interface INotificationService
{
    Task<Lovecraft.Common.DTOs.Notifications.NotificationDto> CreateAsync(
        string userId, Lovecraft.Common.Enums.NotificationType type,
        string? actorId, string payloadJson, string? sourceEventId);
    Task EnqueueOutboxAsync(
        string userId, string notificationId, Lovecraft.Common.Enums.NotificationChannel channel,
        Lovecraft.Common.Enums.NotificationFrequency frequency, DateTime scheduledForUtc);
    Task<List<Lovecraft.Common.DTOs.Notifications.NotificationDto>> ListAsync(string userId, int limit, string? cursor);
    Task<int> UnreadCountAsync(string userId);
    Task<bool> MarkReadAsync(string userId, string notificationId);
    Task<int> MarkAllReadAsync(string userId);
    Task<bool> DismissAsync(string userId, string notificationId);
    /// <summary>Returns rows for this user created in the last `withinSeconds` that match the given (type, actor, sourceEventId).</summary>
    Task<List<Lovecraft.Common.DTOs.Notifications.NotificationDto>> RecentForDedupAsync(
        string userId, Lovecraft.Common.Enums.NotificationType type, string? actorId, string? sourceEventId, int withinSeconds);
}
```

- [ ] **Step 2: Write the failing tests**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class MockNotificationServiceTests
{
    public MockNotificationServiceTests() { MockDataStore.Notifications.Clear(); }

    [Fact]
    public async Task Create_returns_dto_with_assigned_id_and_now()
    {
        var svc = new MockNotificationService();
        var before = DateTime.UtcNow;

        var n = await svc.CreateAsync("u1", NotificationType.LikeReceived, "actor", "{}", "like-1");

        Assert.False(string.IsNullOrEmpty(n.Id));
        Assert.Equal("u1", n.UserId);
        Assert.Equal(NotificationType.LikeReceived, n.Type);
        Assert.True(n.CreatedAtUtc >= before);
        Assert.Null(n.ReadAtUtc);
    }

    [Fact]
    public async Task List_returns_newest_first()
    {
        var svc = new MockNotificationService();
        await svc.CreateAsync("u1", NotificationType.LikeReceived, null, "{}", "a");
        await Task.Delay(5);
        await svc.CreateAsync("u1", NotificationType.MatchCreated, null, "{}", "b");

        var list = await svc.ListAsync("u1", 10, null);

        Assert.Equal(2, list.Count);
        Assert.Equal(NotificationType.MatchCreated, list[0].Type);
        Assert.Equal(NotificationType.LikeReceived, list[1].Type);
    }

    [Fact]
    public async Task UnreadCount_counts_only_unread()
    {
        var svc = new MockNotificationService();
        var n1 = await svc.CreateAsync("u1", NotificationType.LikeReceived, null, "{}", "a");
        await svc.CreateAsync("u1", NotificationType.MatchCreated, null, "{}", "b");
        await svc.MarkReadAsync("u1", n1.Id);

        var count = await svc.UnreadCountAsync("u1");

        Assert.Equal(1, count);
    }

    [Fact]
    public async Task MarkAllRead_sets_all_unread()
    {
        var svc = new MockNotificationService();
        await svc.CreateAsync("u1", NotificationType.LikeReceived, null, "{}", "a");
        await svc.CreateAsync("u1", NotificationType.MatchCreated, null, "{}", "b");

        var updated = await svc.MarkAllReadAsync("u1");

        Assert.Equal(2, updated);
        Assert.Equal(0, await svc.UnreadCountAsync("u1"));
    }

    [Fact]
    public async Task Dismiss_hides_from_list()
    {
        var svc = new MockNotificationService();
        var n = await svc.CreateAsync("u1", NotificationType.LikeReceived, null, "{}", "a");

        await svc.DismissAsync("u1", n.Id);
        var list = await svc.ListAsync("u1", 10, null);

        Assert.Empty(list);
    }

    [Fact]
    public async Task RecentForDedup_finds_match_within_window()
    {
        var svc = new MockNotificationService();
        await svc.CreateAsync("u1", NotificationType.MessageReceived, "actor", "{}", "msg-1");

        var hits = await svc.RecentForDedupAsync("u1", NotificationType.MessageReceived, "actor", "msg-1", 60);

        Assert.Single(hits);
    }

    [Fact]
    public async Task RecentForDedup_ignores_different_sourceEventId()
    {
        var svc = new MockNotificationService();
        await svc.CreateAsync("u1", NotificationType.MessageReceived, "actor", "{}", "msg-1");

        var hits = await svc.RecentForDedupAsync("u1", NotificationType.MessageReceived, "actor", "msg-2", 60);

        Assert.Empty(hits);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~MockNotificationServiceTests"`
Expected: Compilation error — `MockNotificationService` does not exist.

- [ ] **Step 4: Write `MockNotificationService.cs`**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services;

public class MockNotificationService : INotificationService
{
    public Task<NotificationDto> CreateAsync(
        string userId, NotificationType type, string? actorId, string payloadJson, string? sourceEventId)
    {
        var dto = new NotificationDto
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Type = type,
            ActorId = actorId,
            PayloadJson = payloadJson ?? "{}",
            CreatedAtUtc = DateTime.UtcNow,
        };
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            list.Add(dto);
            // store SourceEventId in PayloadJson alongside the rest? No — use a parallel dict keyed by notification id.
            DedupKeys[dto.Id] = (type, actorId, sourceEventId);
        }
        return Task.FromResult(Clone(dto));
    }

    public Task EnqueueOutboxAsync(
        string userId, string notificationId, NotificationChannel channel,
        NotificationFrequency frequency, DateTime scheduledForUtc)
    {
        // Mock-mode outbox is a no-op for now (no worker in this phase).
        // Phase C wires the real outbox model. Keep the call so producer logic works.
        return Task.CompletedTask;
    }

    public Task<List<NotificationDto>> ListAsync(string userId, int limit, string? cursor)
    {
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            return Task.FromResult(list
                .Where(n => n.DismissedAtUtc is null)
                .OrderByDescending(n => n.CreatedAtUtc)
                .Take(limit)
                .Select(Clone)
                .ToList());
        }
    }

    public Task<int> UnreadCountAsync(string userId)
    {
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            return Task.FromResult(list.Count(n => n.ReadAtUtc is null && n.DismissedAtUtc is null));
        }
    }

    public Task<bool> MarkReadAsync(string userId, string notificationId)
    {
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            var n = list.FirstOrDefault(x => x.Id == notificationId);
            if (n is null) return Task.FromResult(false);
            n.ReadAtUtc ??= DateTime.UtcNow;
            return Task.FromResult(true);
        }
    }

    public Task<int> MarkAllReadAsync(string userId)
    {
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            var updated = 0;
            foreach (var n in list.Where(n => n.ReadAtUtc is null))
            {
                n.ReadAtUtc = DateTime.UtcNow;
                updated++;
            }
            return Task.FromResult(updated);
        }
    }

    public Task<bool> DismissAsync(string userId, string notificationId)
    {
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            var n = list.FirstOrDefault(x => x.Id == notificationId);
            if (n is null) return Task.FromResult(false);
            n.DismissedAtUtc ??= DateTime.UtcNow;
            return Task.FromResult(true);
        }
    }

    public Task<List<NotificationDto>> RecentForDedupAsync(
        string userId, NotificationType type, string? actorId, string? sourceEventId, int withinSeconds)
    {
        var cutoff = DateTime.UtcNow.AddSeconds(-withinSeconds);
        var list = MockDataStore.Notifications.GetOrAdd(userId, _ => new());
        lock (list)
        {
            return Task.FromResult(list
                .Where(n => n.CreatedAtUtc >= cutoff)
                .Where(n => DedupKeys.TryGetValue(n.Id, out var key)
                            && key.Type == type
                            && key.ActorId == actorId
                            && key.SourceEventId == sourceEventId)
                .Select(Clone)
                .ToList());
        }
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<
        string, (NotificationType Type, string? ActorId, string? SourceEventId)> DedupKeys = new();

    private static NotificationDto Clone(NotificationDto src) => new()
    {
        Id = src.Id,
        UserId = src.UserId,
        Type = src.Type,
        ActorId = src.ActorId,
        ActorName = src.ActorName,
        ActorAvatar = src.ActorAvatar,
        PayloadJson = src.PayloadJson,
        CreatedAtUtc = src.CreatedAtUtc,
        ReadAtUtc = src.ReadAtUtc,
        DismissedAtUtc = src.DismissedAtUtc,
        DigestGroupId = src.DigestGroupId,
    };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~MockNotificationServiceTests"`
Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/IServices.cs' 'Lovecraft/Lovecraft.Backend/Services/MockNotificationService.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationServiceTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: INotificationService + mock + tests"
```

---

## Task 8: `AzureNotificationService`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureNotificationService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationServiceTests.cs`

Same surface as mock; backed by two `TableClient` instances (`notifications` + `notificationsoutbox`). Pagination uses `RowKey > cursor` partition query. Mark-read / dismiss are point upserts.

- [ ] **Step 1: Add failing Azure tests**

Append to `NotificationServiceTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Services.Azure;
using Lovecraft.Backend.Storage.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

public class AzureNotificationServiceTests
{
    private static Mock<TableClient> EmptyTable() => new();

    [Fact]
    public async Task Create_writes_row_with_inverted_ticks_rowkey()
    {
        var notifs = EmptyTable();
        var outbox = EmptyTable();
        NotificationEntity? written = null;
        notifs.Setup(t => t.AddEntityAsync(It.IsAny<NotificationEntity>(), default))
            .Callback<NotificationEntity, CancellationToken>((e, _) => written = e)
            .ReturnsAsync(new Mock<Response>().Object);

        var svc = new AzureNotificationService(notifs.Object, outbox.Object,
            NullLogger<AzureNotificationService>.Instance);

        var n = await svc.CreateAsync("u1", NotificationType.LikeReceived, "actor", "{}", "src-1");

        Assert.NotNull(written);
        Assert.Equal("u1", written!.PartitionKey);
        Assert.StartsWith(string.Empty, written.RowKey); // 19-digit inverted ticks + "_" + id
        Assert.Equal(20 + n.Id.Length, written.RowKey.Length);
        Assert.Equal("src-1", written.SourceEventId);
    }

    [Fact]
    public async Task EnqueueOutbox_writes_to_pending_partition()
    {
        var notifs = EmptyTable();
        var outbox = EmptyTable();
        NotificationOutboxEntity? written = null;
        outbox.Setup(t => t.AddEntityAsync(It.IsAny<NotificationOutboxEntity>(), default))
            .Callback<NotificationOutboxEntity, CancellationToken>((e, _) => written = e)
            .ReturnsAsync(new Mock<Response>().Object);

        var svc = new AzureNotificationService(notifs.Object, outbox.Object,
            NullLogger<AzureNotificationService>.Instance);

        await svc.EnqueueOutboxAsync("u1", "nid-1",
            NotificationChannel.Telegram, NotificationFrequency.Immediate, DateTime.UtcNow);

        Assert.NotNull(written);
        Assert.Equal("OUTBOX_Telegram_PENDING", written!.PartitionKey);
        Assert.Equal("u1", written.UserId);
        Assert.Equal("nid-1", written.NotificationId);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureNotificationServiceTests"`
Expected: Compilation error — `AzureNotificationService` does not exist.

- [ ] **Step 3: Write `AzureNotificationService.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Azure;

public class AzureNotificationService : INotificationService
{
    private readonly TableClient _notifications;
    private readonly TableClient _outbox;
    private readonly ILogger<AzureNotificationService> _logger;

    public AzureNotificationService(TableClient notifications, TableClient outbox, ILogger<AzureNotificationService> logger)
    {
        _notifications = notifications;
        _outbox = outbox;
        _logger = logger;
    }

    public async Task<NotificationDto> CreateAsync(
        string userId, NotificationType type, string? actorId, string payloadJson, string? sourceEventId)
    {
        var id = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        var entity = new NotificationEntity
        {
            PartitionKey = NotificationEntity.GetPartitionKey(userId),
            RowKey = NotificationEntity.GetRowKey(id, now),
            NotificationId = id,
            UserId = userId,
            Type = type.ToString(),
            ActorId = actorId,
            PayloadJson = payloadJson ?? "{}",
            CreatedAtUtc = now,
            SourceEventId = sourceEventId,
        };
        await _notifications.AddEntityAsync(entity);
        return ToDto(entity);
    }

    public async Task EnqueueOutboxAsync(
        string userId, string notificationId, NotificationChannel channel,
        NotificationFrequency frequency, DateTime scheduledForUtc)
    {
        var entity = new NotificationOutboxEntity
        {
            PartitionKey = NotificationOutboxEntity.PendingPartition(channel.ToString()),
            RowKey = NotificationOutboxEntity.GetRowKey(scheduledForUtc, notificationId),
            UserId = userId,
            NotificationId = notificationId,
            Channel = channel.ToString(),
            Frequency = frequency.ToString(),
            ScheduledForUtc = scheduledForUtc,
        };
        await _outbox.AddEntityAsync(entity);
    }

    public async Task<List<NotificationDto>> ListAsync(string userId, int limit, string? cursor)
    {
        var filter = $"PartitionKey eq '{userId}' and (DismissedAtUtc eq null or DismissedAtUtc eq '')";
        if (!string.IsNullOrEmpty(cursor))
            filter += $" and RowKey gt '{cursor.Replace("'", "''")}'";

        var results = new List<NotificationDto>();
        await foreach (var page in _notifications.QueryAsync<NotificationEntity>(filter, maxPerPage: limit).AsPages())
        {
            results.AddRange(page.Values.Select(ToDto));
            if (results.Count >= limit) break;
        }
        return results.Take(limit).ToList();
    }

    public async Task<int> UnreadCountAsync(string userId)
    {
        var filter = $"PartitionKey eq '{userId}' and ReadAtUtc eq null and (DismissedAtUtc eq null or DismissedAtUtc eq '')";
        var count = 0;
        await foreach (var _ in _notifications.QueryAsync<NotificationEntity>(filter, select: new[] { "RowKey" }))
            count++;
        return count;
    }

    public async Task<bool> MarkReadAsync(string userId, string notificationId)
    {
        var entity = await FindByIdAsync(userId, notificationId);
        if (entity is null) return false;
        if (entity.ReadAtUtc.HasValue) return true;
        entity.ReadAtUtc = DateTime.UtcNow;
        await _notifications.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace);
        return true;
    }

    public async Task<int> MarkAllReadAsync(string userId)
    {
        var filter = $"PartitionKey eq '{userId}' and ReadAtUtc eq null and (DismissedAtUtc eq null or DismissedAtUtc eq '')";
        var updated = 0;
        var now = DateTime.UtcNow;
        await foreach (var entity in _notifications.QueryAsync<NotificationEntity>(filter))
        {
            entity.ReadAtUtc = now;
            try
            {
                await _notifications.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace);
                updated++;
            }
            catch (RequestFailedException ex) when (ex.Status == 412)
            {
                _logger.LogInformation("ETag conflict marking read for {NotificationId} (skipping)", entity.NotificationId);
            }
        }
        return updated;
    }

    public async Task<bool> DismissAsync(string userId, string notificationId)
    {
        var entity = await FindByIdAsync(userId, notificationId);
        if (entity is null) return false;
        if (entity.DismissedAtUtc.HasValue) return true;
        entity.DismissedAtUtc = DateTime.UtcNow;
        await _notifications.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace);
        return true;
    }

    public async Task<List<NotificationDto>> RecentForDedupAsync(
        string userId, NotificationType type, string? actorId, string? sourceEventId, int withinSeconds)
    {
        var since = DateTime.UtcNow.AddSeconds(-withinSeconds);
        var filter = $"PartitionKey eq '{userId}' and CreatedAtUtc ge datetime'{since:O}'";
        var hits = new List<NotificationDto>();
        await foreach (var e in _notifications.QueryAsync<NotificationEntity>(filter))
        {
            if (e.Type != type.ToString()) continue;
            if (e.ActorId != actorId) continue;
            if (e.SourceEventId != sourceEventId) continue;
            hits.Add(ToDto(e));
        }
        return hits;
    }

    private async Task<NotificationEntity?> FindByIdAsync(string userId, string notificationId)
    {
        var filter = $"PartitionKey eq '{userId}' and NotificationId eq '{notificationId}'";
        await foreach (var e in _notifications.QueryAsync<NotificationEntity>(filter, maxPerPage: 1))
            return e;
        return null;
    }

    private static NotificationDto ToDto(NotificationEntity e) => new()
    {
        Id = e.NotificationId,
        UserId = e.UserId,
        Type = Enum.Parse<NotificationType>(e.Type),
        ActorId = e.ActorId,
        PayloadJson = e.PayloadJson,
        CreatedAtUtc = e.CreatedAtUtc,
        ReadAtUtc = e.ReadAtUtc,
        DismissedAtUtc = e.DismissedAtUtc,
        DigestGroupId = e.DigestGroupId,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureNotificationServiceTests"`
Expected: All 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureNotificationService.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationServiceTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: AzureNotificationService + tests"
```

---

## Task 9: `NotificationDeduper`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\NotificationDeduper.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationDeduperTests.cs`

Thin wrapper around `INotificationService.RecentForDedupAsync` with the 60s window baked in. Producer calls `await deduper.IsDuplicateAsync(...)` before enqueueing.

- [ ] **Step 1: Write the failing tests**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class NotificationDeduperTests
{
    public NotificationDeduperTests() { MockDataStore.Notifications.Clear(); }

    [Fact]
    public async Task First_call_is_not_duplicate()
    {
        var svc = new MockNotificationService();
        var deduper = new NotificationDeduper(svc);

        var isDup = await deduper.IsDuplicateAsync("u1", NotificationType.MessageReceived, "actor", "msg-1");

        Assert.False(isDup);
    }

    [Fact]
    public async Task Second_call_within_window_is_duplicate()
    {
        var svc = new MockNotificationService();
        var deduper = new NotificationDeduper(svc);
        await svc.CreateAsync("u1", NotificationType.MessageReceived, "actor", "{}", "msg-1");

        var isDup = await deduper.IsDuplicateAsync("u1", NotificationType.MessageReceived, "actor", "msg-1");

        Assert.True(isDup);
    }

    [Fact]
    public async Task Different_source_event_is_not_duplicate()
    {
        var svc = new MockNotificationService();
        var deduper = new NotificationDeduper(svc);
        await svc.CreateAsync("u1", NotificationType.MessageReceived, "actor", "{}", "msg-1");

        var isDup = await deduper.IsDuplicateAsync("u1", NotificationType.MessageReceived, "actor", "msg-2");

        Assert.False(isDup);
    }

    [Fact]
    public async Task Null_source_event_skips_dedup()
    {
        var svc = new MockNotificationService();
        var deduper = new NotificationDeduper(svc);
        await svc.CreateAsync("u1", NotificationType.MatchCreated, "actor", "{}", null);

        // Two MatchCreated with no source event id — caller is responsible for at-most-once;
        // deduper should not block.
        var isDup = await deduper.IsDuplicateAsync("u1", NotificationType.MatchCreated, "actor", null);

        Assert.False(isDup);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationDeduperTests"`
Expected: Compilation error — `NotificationDeduper` does not exist.

- [ ] **Step 3: Write `NotificationDeduper.cs`**

```csharp
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services.Notifications;

/// <summary>
/// 60-second same-source-event window. Producer must pass a stable `sourceEventId`
/// (messageId / likeId / replyId etc.) for dedup to apply. A null sourceEventId
/// always returns false — caller is expected to be at-most-once by construction.
/// </summary>
public class NotificationDeduper
{
    private const int WindowSeconds = 60;
    private readonly INotificationService _notifications;

    public NotificationDeduper(INotificationService notifications)
    {
        _notifications = notifications;
    }

    public async Task<bool> IsDuplicateAsync(string userId, NotificationType type, string? actorId, string? sourceEventId)
    {
        if (sourceEventId is null) return false;
        var hits = await _notifications.RecentForDedupAsync(userId, type, actorId, sourceEventId, WindowSeconds);
        return hits.Count > 0;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationDeduperTests"`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/NotificationDeduper.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationDeduperTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: NotificationDeduper (60s same-source window) + tests"
```

---

## Task 10: `IPushSubscriptionService` + Mock + Azure

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockPushSubscriptionService.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzurePushSubscriptionService.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\PushSubscriptionServiceTests.cs`

Table-only feature in Phase A — no consumer wired yet. Subscribe / list / delete / count.

- [ ] **Step 1: Add `IPushSubscriptionService` to `IServices.cs`**

```csharp
public interface IPushSubscriptionService
{
    Task<Lovecraft.Common.DTOs.Notifications.WebPushSubscriptionDto> SubscribeAsync(
        string userId, Lovecraft.Common.DTOs.Notifications.WebPushSubscriptionRequestDto request);
    Task<List<Lovecraft.Common.DTOs.Notifications.WebPushSubscriptionDto>> ListAsync(string userId);
    Task<int> CountAsync(string userId);
    Task<bool> UnsubscribeAsync(string userId, string deviceId);
}
```

- [ ] **Step 2: Write the failing tests**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Azure;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests;

public class MockPushSubscriptionServiceTests
{
    public MockPushSubscriptionServiceTests() { MockDataStore.PushSubscriptions.Clear(); }

    [Fact]
    public async Task Subscribe_assigns_deviceId_when_missing()
    {
        var svc = new MockPushSubscriptionService();
        var sub = await svc.SubscribeAsync("u1", new WebPushSubscriptionRequestDto
        {
            Endpoint = "https://push.example/abc", P256dh = "p", Auth = "a", UserAgent = "Test"
        });

        Assert.False(string.IsNullOrEmpty(sub.DeviceId));
        Assert.Equal("https://push.example/abc", sub.Endpoint);
    }

    [Fact]
    public async Task Subscribe_with_existing_deviceId_updates_LastSeen()
    {
        var svc = new MockPushSubscriptionService();
        var first = await svc.SubscribeAsync("u1", new WebPushSubscriptionRequestDto
        {
            DeviceId = "fixed", Endpoint = "https://push.example/v1", P256dh = "p", Auth = "a", UserAgent = "v1"
        });
        await Task.Delay(10);
        var second = await svc.SubscribeAsync("u1", new WebPushSubscriptionRequestDto
        {
            DeviceId = "fixed", Endpoint = "https://push.example/v2", P256dh = "p", Auth = "a", UserAgent = "v2"
        });

        Assert.Equal("fixed", second.DeviceId);
        Assert.Equal("https://push.example/v2", second.Endpoint);
        Assert.True(second.LastSeenAtUtc > first.LastSeenAtUtc);
        Assert.Equal(1, await svc.CountAsync("u1"));
    }

    [Fact]
    public async Task List_returns_only_user_rows()
    {
        var svc = new MockPushSubscriptionService();
        await svc.SubscribeAsync("u1", new WebPushSubscriptionRequestDto { Endpoint = "1", P256dh = "p", Auth = "a", UserAgent = "" });
        await svc.SubscribeAsync("u2", new WebPushSubscriptionRequestDto { Endpoint = "2", P256dh = "p", Auth = "a", UserAgent = "" });

        var list = await svc.ListAsync("u1");
        Assert.Single(list);
    }

    [Fact]
    public async Task Unsubscribe_returns_true_when_present_false_otherwise()
    {
        var svc = new MockPushSubscriptionService();
        var sub = await svc.SubscribeAsync("u1", new WebPushSubscriptionRequestDto
        {
            DeviceId = "d1", Endpoint = "x", P256dh = "p", Auth = "a", UserAgent = ""
        });

        Assert.True(await svc.UnsubscribeAsync("u1", sub.DeviceId));
        Assert.False(await svc.UnsubscribeAsync("u1", sub.DeviceId));
        Assert.Equal(0, await svc.CountAsync("u1"));
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~MockPushSubscriptionServiceTests"`
Expected: Compilation error — `MockPushSubscriptionService` does not exist.

- [ ] **Step 4: Write `MockPushSubscriptionService.cs`**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services;

public class MockPushSubscriptionService : IPushSubscriptionService
{
    public Task<WebPushSubscriptionDto> SubscribeAsync(string userId, WebPushSubscriptionRequestDto request)
    {
        var deviceId = string.IsNullOrEmpty(request.DeviceId) ? Guid.NewGuid().ToString("N") : request.DeviceId;
        var now = DateTime.UtcNow;
        var dto = new WebPushSubscriptionDto
        {
            DeviceId = deviceId,
            Endpoint = request.Endpoint,
            P256dh = request.P256dh,
            Auth = request.Auth,
            UserAgent = request.UserAgent,
            CreatedAtUtc = MockDataStore.PushSubscriptions.TryGetValue((userId, deviceId), out var existing)
                ? existing.CreatedAtUtc : now,
            LastSeenAtUtc = now,
        };
        MockDataStore.PushSubscriptions[(userId, deviceId)] = dto;
        return Task.FromResult(dto);
    }

    public Task<List<WebPushSubscriptionDto>> ListAsync(string userId) =>
        Task.FromResult(MockDataStore.PushSubscriptions
            .Where(kv => kv.Key.UserId == userId)
            .Select(kv => kv.Value)
            .ToList());

    public Task<int> CountAsync(string userId) =>
        Task.FromResult(MockDataStore.PushSubscriptions.Count(kv => kv.Key.UserId == userId));

    public Task<bool> UnsubscribeAsync(string userId, string deviceId) =>
        Task.FromResult(MockDataStore.PushSubscriptions.TryRemove((userId, deviceId), out _));
}
```

- [ ] **Step 5: Write `AzurePushSubscriptionService.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Azure;

public class AzurePushSubscriptionService : IPushSubscriptionService
{
    private readonly TableClient _table;
    private readonly ILogger<AzurePushSubscriptionService> _logger;

    public AzurePushSubscriptionService(TableClient table, ILogger<AzurePushSubscriptionService> logger)
    {
        _table = table;
        _logger = logger;
    }

    public async Task<WebPushSubscriptionDto> SubscribeAsync(string userId, WebPushSubscriptionRequestDto request)
    {
        var deviceId = string.IsNullOrEmpty(request.DeviceId) ? Guid.NewGuid().ToString("N") : request.DeviceId;
        var now = DateTime.UtcNow;
        DateTime createdAt = now;
        try
        {
            var existing = await _table.GetEntityAsync<WebPushSubscriptionEntity>(userId, deviceId);
            createdAt = existing.Value.CreatedAtUtc;
        }
        catch (RequestFailedException ex) when (ex.Status == 404) { /* new */ }

        var entity = new WebPushSubscriptionEntity
        {
            PartitionKey = userId,
            RowKey = deviceId,
            Endpoint = request.Endpoint,
            P256dh = request.P256dh,
            Auth = request.Auth,
            UserAgent = request.UserAgent,
            CreatedAtUtc = createdAt,
            LastSeenAtUtc = now,
        };
        await _table.UpsertEntityAsync(entity, TableUpdateMode.Replace);
        return ToDto(entity);
    }

    public async Task<List<WebPushSubscriptionDto>> ListAsync(string userId)
    {
        var list = new List<WebPushSubscriptionDto>();
        await foreach (var e in _table.QueryAsync<WebPushSubscriptionEntity>($"PartitionKey eq '{userId}'"))
            list.Add(ToDto(e));
        return list;
    }

    public async Task<int> CountAsync(string userId)
    {
        var count = 0;
        await foreach (var _ in _table.QueryAsync<WebPushSubscriptionEntity>($"PartitionKey eq '{userId}'", select: new[] { "RowKey" }))
            count++;
        return count;
    }

    public async Task<bool> UnsubscribeAsync(string userId, string deviceId)
    {
        try
        {
            await _table.DeleteEntityAsync(userId, deviceId);
            return true;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return false;
        }
    }

    private static WebPushSubscriptionDto ToDto(WebPushSubscriptionEntity e) => new()
    {
        DeviceId = e.RowKey,
        Endpoint = e.Endpoint,
        P256dh = e.P256dh,
        Auth = e.Auth,
        UserAgent = e.UserAgent,
        CreatedAtUtc = e.CreatedAtUtc,
        LastSeenAtUtc = e.LastSeenAtUtc,
    };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~MockPushSubscriptionServiceTests"`
Expected: All 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/IServices.cs' 'Lovecraft/Lovecraft.Backend/Services/MockPushSubscriptionService.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzurePushSubscriptionService.cs' 'Lovecraft/Lovecraft.UnitTests/PushSubscriptionServiceTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: IPushSubscriptionService + mock + Azure + tests"
```

---

## Task 11: `IPresenceTracker` singleton

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\IPresenceTracker.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\PresenceTracker.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\PresenceTrackerTests.cs`

Tracks "which users are currently in which SignalR groups" so the producer can suppress `MessageReceived` notifications when the recipient is already in `chat-{id}`. In-memory `ConcurrentDictionary<groupName, ConcurrentDictionary<userId, int>>` with reference counting (a user can have 2 tabs in the same chat).

- [ ] **Step 1: Write the failing tests**

```csharp
using Lovecraft.Backend.Services.Notifications;
using Xunit;

namespace Lovecraft.UnitTests;

public class PresenceTrackerTests
{
    [Fact]
    public void Initially_empty()
    {
        var t = new PresenceTracker();
        Assert.False(t.IsInGroup("chat-1", "u1"));
    }

    [Fact]
    public void Join_makes_user_present_in_group()
    {
        var t = new PresenceTracker();
        t.Join("chat-1", "u1");
        Assert.True(t.IsInGroup("chat-1", "u1"));
    }

    [Fact]
    public void Leave_removes_user_when_refcount_drops_to_zero()
    {
        var t = new PresenceTracker();
        t.Join("chat-1", "u1");
        t.Leave("chat-1", "u1");
        Assert.False(t.IsInGroup("chat-1", "u1"));
    }

    [Fact]
    public void Two_tabs_keep_user_present_until_both_leave()
    {
        var t = new PresenceTracker();
        t.Join("chat-1", "u1");
        t.Join("chat-1", "u1");
        t.Leave("chat-1", "u1");
        Assert.True(t.IsInGroup("chat-1", "u1"));
        t.Leave("chat-1", "u1");
        Assert.False(t.IsInGroup("chat-1", "u1"));
    }

    [Fact]
    public void Leave_unknown_user_is_noop()
    {
        var t = new PresenceTracker();
        t.Leave("chat-1", "ghost");
        Assert.False(t.IsInGroup("chat-1", "ghost"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~PresenceTrackerTests"`
Expected: Compilation error — `PresenceTracker` does not exist.

- [ ] **Step 3: Write `IPresenceTracker.cs` and `PresenceTracker.cs`**

```csharp
namespace Lovecraft.Backend.Services.Notifications;

public interface IPresenceTracker
{
    void Join(string groupName, string userId);
    void Leave(string groupName, string userId);
    bool IsInGroup(string groupName, string userId);
}
```

```csharp
using System.Collections.Concurrent;

namespace Lovecraft.Backend.Services.Notifications;

/// <summary>
/// Tracks SignalR group membership in-memory with refcounting per (group, user).
/// One user can have multiple connections to the same group (multiple tabs);
/// they're only considered absent when all connections leave.
/// Registered as singleton so ChatHub + producers share state.
/// </summary>
public class PresenceTracker : IPresenceTracker
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, int>> _groups = new();

    public void Join(string groupName, string userId)
    {
        var users = _groups.GetOrAdd(groupName, _ => new ConcurrentDictionary<string, int>());
        users.AddOrUpdate(userId, 1, (_, count) => count + 1);
    }

    public void Leave(string groupName, string userId)
    {
        if (!_groups.TryGetValue(groupName, out var users)) return;
        users.AddOrUpdate(userId, 0, (_, count) => Math.Max(0, count - 1));
        if (users.TryGetValue(userId, out var c) && c == 0)
            users.TryRemove(userId, out _);
    }

    public bool IsInGroup(string groupName, string userId)
        => _groups.TryGetValue(groupName, out var users)
           && users.TryGetValue(userId, out var c)
           && c > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~PresenceTrackerTests"`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/IPresenceTracker.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/PresenceTracker.cs' 'Lovecraft/Lovecraft.UnitTests/PresenceTrackerTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: IPresenceTracker singleton with refcounted group membership + tests"
```

---

## Task 12: Wire `PresenceTracker` into `ChatHub`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Hubs\ChatHub.cs`

Inject `IPresenceTracker`; call `Join` on every `JoinChat` / `JoinTopic`; call `Leave` on `LeaveGroup`; on `OnDisconnectedAsync`, drop the connection from every group it was in.

The hub doesn't natively track per-connection group membership — Microsoft's group manager doesn't expose enumeration. Track it ourselves per-connection: a `ConcurrentDictionary<string connectionId, HashSet<string groupName>>` on the hub class (static so it survives across hub instances per app).

- [ ] **Step 1: Read current `ChatHub.cs`**

Use the Read tool to view `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Hubs\ChatHub.cs` before editing — confirm method names, look for existing `OnConnectedAsync`/`OnDisconnectedAsync` overrides.

- [ ] **Step 2: Modify `ChatHub.cs`**

Add (or extend) using directives:
```csharp
using System.Collections.Concurrent;
using Lovecraft.Backend.Services.Notifications;
```

Inside the `ChatHub` class, add:
```csharp
private static readonly ConcurrentDictionary<string, HashSet<string>> ConnectionGroups = new();
private readonly IPresenceTracker _presence;
```

Update the constructor (or add one if absent) to accept `IPresenceTracker`. Existing dependencies stay; insert `_presence = presence`.

Wrap `JoinChat`, `JoinTopic`, `LeaveGroup` (existing methods — keep their original behavior) so they also call presence:

```csharp
public override async Task OnConnectedAsync()
{
    ConnectionGroups[Context.ConnectionId] = new HashSet<string>();
    await base.OnConnectedAsync();
}

public override async Task OnDisconnectedAsync(Exception? exception)
{
    if (ConnectionGroups.TryRemove(Context.ConnectionId, out var groups))
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
            foreach (var g in groups) _presence.Leave(g, userId);
    }
    await base.OnDisconnectedAsync(exception);
}

public new async Task JoinChat(string chatId)
{
    var group = $"chat-{chatId}";
    await Groups.AddToGroupAsync(Context.ConnectionId, group);
    var userId = Context.UserIdentifier;
    if (!string.IsNullOrEmpty(userId))
    {
        _presence.Join(group, userId);
        ConnectionGroups.GetOrAdd(Context.ConnectionId, _ => new()).Add(group);
    }
}

public new async Task JoinTopic(string topicId)
{
    var group = $"topic-{topicId}";
    await Groups.AddToGroupAsync(Context.ConnectionId, group);
    var userId = Context.UserIdentifier;
    if (!string.IsNullOrEmpty(userId))
    {
        _presence.Join(group, userId);
        ConnectionGroups.GetOrAdd(Context.ConnectionId, _ => new()).Add(group);
    }
}

public new async Task LeaveGroup(string groupName)
{
    await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    var userId = Context.UserIdentifier;
    if (!string.IsNullOrEmpty(userId))
    {
        _presence.Leave(groupName, userId);
        if (ConnectionGroups.TryGetValue(Context.ConnectionId, out var gs)) gs.Remove(groupName);
    }
}
```

If the existing `ChatHub` already has these methods (likely), do not add `new` — replace the bodies to call into the original logic and add presence calls. Adjust to match. Goal: every existing call site continues to work, presence is updated as a side effect.

- [ ] **Step 3: Build**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded. Any constructor-resolution errors mean DI isn't wired yet — that's Task 17.

- [ ] **Step 4: Verify the rest of the test suite still passes**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
Expected: All previously-passing tests still pass. ChatTests must still pass — they should not depend on presence behavior.

If `ChatTests` fail because they construct `ChatHub` without `IPresenceTracker`, update those construction sites to pass `new PresenceTracker()` (or `Mock.Of<IPresenceTracker>()`).

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Hubs/ChatHub.cs' 'Lovecraft/Lovecraft.UnitTests/ChatTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: ChatHub updates IPresenceTracker on join/leave/disconnect"
```

(If `ChatTests.cs` wasn't modified, drop it from the `git add` line.)

---

## Task 13: `IInAppDispatcher` + `InAppDispatcher`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\IInAppDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\InAppDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\InAppDispatcherTests.cs`

Thin wrapper around `IHubContext<ChatHub>` for the `NotificationReceived` server-to-client event. Producer calls `await _inApp.DispatchAsync(userId, dto)`.

- [ ] **Step 1: Write the failing test**

```csharp
using Lovecraft.Backend.Hubs;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.AspNetCore.SignalR;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests;

public class InAppDispatcherTests
{
    [Fact]
    public async Task DispatchAsync_sends_NotificationReceived_to_user_group()
    {
        var clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubClients>();
        clients.Setup(c => c.User("u1")).Returns(clientProxy.Object);
        var hub = new Mock<IHubContext<ChatHub>>();
        hub.Setup(h => h.Clients).Returns(clients.Object);

        var dispatcher = new InAppDispatcher(hub.Object);
        var dto = new NotificationDto { Id = "n1", UserId = "u1", Type = NotificationType.LikeReceived };

        await dispatcher.DispatchAsync("u1", dto);

        clientProxy.Verify(c => c.SendCoreAsync(
            "NotificationReceived",
            It.Is<object[]>(args => args.Length == 1 && args[0] == dto),
            default), Times.Once);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~InAppDispatcherTests"`
Expected: Compilation error — `InAppDispatcher` does not exist.

- [ ] **Step 3: Write `IInAppDispatcher.cs`**

```csharp
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services.Notifications;

public interface IInAppDispatcher
{
    Task DispatchAsync(string userId, NotificationDto notification);
}
```

- [ ] **Step 4: Write `InAppDispatcher.cs`**

```csharp
using Lovecraft.Backend.Hubs;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace Lovecraft.Backend.Services.Notifications;

public class InAppDispatcher : IInAppDispatcher
{
    private readonly IHubContext<ChatHub> _hub;
    public InAppDispatcher(IHubContext<ChatHub> hub) => _hub = hub;

    public Task DispatchAsync(string userId, NotificationDto notification)
        => _hub.Clients.User(userId).SendAsync("NotificationReceived", notification);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~InAppDispatcherTests"`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/IInAppDispatcher.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/InAppDispatcher.cs' 'Lovecraft/Lovecraft.UnitTests/InAppDispatcherTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: InAppDispatcher wraps IHubContext for NotificationReceived"
```

---

## Task 14: `INotificationProducer` + `NotificationProducer`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs` (add `GetNotificationContactStatusAsync` to `IUserService`)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs` (impl)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs` (impl)
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\INotificationProducer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\NotificationProducer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationProducerTests.cs`

The facade producer-side code calls. Responsibilities: self-action skip, dedup check, in-chat suppression for `MessageReceived`, channel resolution + outbox enqueue, in-process in-app dispatch.

User channel availability (`TelegramLinked`, `EmailVerified`) lives on `UserEntity` but is **not** currently exposed via `UserDto` — and shouldn't be (it's auth-method internal). To avoid leaking auth state into the public profile DTO, this task adds a new `IUserService` method that returns only the two booleans needed for notification routing.

- [ ] **Step 1: Add `GetNotificationContactStatusAsync` to `IUserService`**

In `IServices.cs`, append to the `IUserService` interface body:

```csharp
Task<(bool TelegramLinked, bool EmailVerified)> GetNotificationContactStatusAsync(string userId);
```

- [ ] **Step 2: Implement on `MockUserService`**

In `MockUserService.cs`, add the method:

```csharp
public Task<(bool TelegramLinked, bool EmailVerified)> GetNotificationContactStatusAsync(string userId)
{
    // MockDataStore stores UserDto, not the auth state — read from MockAuthService's
    // store. If users in mock mode have no Telegram or unverified email, return (false, false).
    var user = MockDataStore.Users.FirstOrDefault(u => u.Id == userId);
    if (user is null) return Task.FromResult((false, false));

    var telegramLinked = MockDataStore.UserAuthMethods.TryGetValue(userId, out var methods)
                        && methods.Contains("telegram");
    var emailVerified = MockDataStore.EmailVerified.Contains(userId);
    return Task.FromResult((telegramLinked, emailVerified));
}
```

**Where do these flags live in mock mode today?** Read `Lovecraft.Backend/Services/MockAuthService.cs` to see how `AuthMethodsJson` and `EmailVerified` are tracked — usually as fields on the mock user records. Re-use those existing structures rather than introducing parallel state.

Concrete recipe (likely shape after reading MockAuthService):
```csharp
public Task<(bool TelegramLinked, bool EmailVerified)> GetNotificationContactStatusAsync(string userId)
{
    var user = MockDataStore.Users.FirstOrDefault(u => u.Id == userId);
    if (user is null) return Task.FromResult((false, false));

    // If MockAuthService stores auth methods on the mock user record (most likely),
    // read them directly. Otherwise, reach into whatever in-memory dict it owns.
    var telegramLinked = MockDataStore.AuthMethodsByUserId.TryGetValue(userId, out var methods)
                        && methods.Contains("telegram");
    var emailVerified = MockDataStore.EmailVerifiedUserIds.Contains(userId);
    return Task.FromResult((telegramLinked, emailVerified));
}
```

If the named collections don't exist, add them to `MockDataStore` (use `ConcurrentDictionary<string, HashSet<string>>` for the methods map and `ConcurrentDictionary<string, byte>` as a thread-safe set for the verified ids):

```csharp
public static readonly System.Collections.Concurrent.ConcurrentDictionary<string, HashSet<string>> AuthMethodsByUserId = new();
public static readonly System.Collections.Concurrent.ConcurrentDictionary<string, byte> EmailVerifiedUserIds = new();
```

(Then `EmailVerifiedUserIds.ContainsKey(userId)` for set semantics.) Have `MockAuthService.RegisterAsync` / `VerifyEmailAsync` populate these — small edits, one or two new lines each.

For the producer tests: they construct a `Mock<IUserService>` and stub `GetNotificationContactStatusAsync` directly — so the test path doesn't touch `MockDataStore`.

- [ ] **Step 3: Implement on `AzureUserService`**

In `AzureUserService.cs`, add the method. The entity is already cached in `UserCache`; read from there:

```csharp
public Task<(bool TelegramLinked, bool EmailVerified)> GetNotificationContactStatusAsync(string userId)
{
    var entity = _cache.Get(userId);
    if (entity is null) return Task.FromResult((false, false));
    return Task.FromResult((
        TelegramLinked: !string.IsNullOrEmpty(entity.TelegramUserId),
        EmailVerified:  entity.EmailVerified
    ));
}
```

- [ ] **Step 4: Build to verify the new interface method compiles in all implementations**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded.

- [ ] **Step 5: Write the failing producer tests**

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.DTOs.Users;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests;

public class NotificationProducerTests
{
    public NotificationProducerTests()
    {
        MockDataStore.Notifications.Clear();
        MockDataStore.NotificationPreferences.Clear();
        MockDataStore.PushSubscriptions.Clear();
    }

    private static (NotificationProducer Producer, MockNotificationService Notifs, Mock<IInAppDispatcher> InApp)
        BuildProducer(NotificationPreferencesDto? prefs = null, IPresenceTracker? presence = null)
    {
        var notifs = new MockNotificationService();
        var prefSvc = new MockNotificationPreferenceService();
        if (prefs is not null) prefSvc.UpdatePreferencesAsync("u-recipient", prefs).GetAwaiter().GetResult();
        var pushSvc = new MockPushSubscriptionService();
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(s => s.GetNotificationContactStatusAsync("u-recipient"))
            .ReturnsAsync((false, false));   // (TelegramLinked, EmailVerified) — overridden per-test via Setup chaining
        var inApp = new Mock<IInAppDispatcher>();
        var deduper = new NotificationDeduper(notifs);
        var producer = new NotificationProducer(
            notifs, prefSvc, pushSvc, userSvc.Object, inApp.Object,
            presence ?? new PresenceTracker(), deduper,
            NullLogger<NotificationProducer>.Instance);
        return (producer, notifs, inApp);
    }

    [Fact]
    public async Task Produce_writes_notification_row()
    {
        var (producer, notifs, _) = BuildProducer();

        var n = await producer.ProduceAsync("u-recipient", NotificationType.LikeReceived,
            actorId: "u-actor", payloadJson: "{}", sourceEventId: "like-1");

        Assert.NotNull(n);
        var list = await notifs.ListAsync("u-recipient", 10, null);
        Assert.Single(list);
    }

    [Fact]
    public async Task Self_action_is_skipped()
    {
        var (producer, notifs, _) = BuildProducer();

        var n = await producer.ProduceAsync("u-recipient", NotificationType.LikeReceived,
            actorId: "u-recipient", payloadJson: "{}", sourceEventId: "like-2");

        Assert.Null(n);
        Assert.Empty(await notifs.ListAsync("u-recipient", 10, null));
    }

    [Fact]
    public async Task Duplicate_within_window_is_skipped()
    {
        var (producer, notifs, _) = BuildProducer();
        await producer.ProduceAsync("u-recipient", NotificationType.MessageReceived,
            "actor", "{}", "msg-1");

        var second = await producer.ProduceAsync("u-recipient", NotificationType.MessageReceived,
            "actor", "{}", "msg-1");

        Assert.Null(second);
        Assert.Single(await notifs.ListAsync("u-recipient", 10, null));
    }

    [Fact]
    public async Task MessageReceived_skipped_when_recipient_present_in_chat()
    {
        var presence = new PresenceTracker();
        presence.Join("chat-1", "u-recipient");
        var (producer, notifs, inApp) = BuildProducer(presence: presence);

        var payload = System.Text.Json.JsonSerializer.Serialize(new { chatId = "1", messageId = "m1" });
        var n = await producer.ProduceAsync("u-recipient", NotificationType.MessageReceived,
            actorId: "actor", payloadJson: payload, sourceEventId: "m1");

        Assert.Null(n);
        Assert.Empty(await notifs.ListAsync("u-recipient", 10, null));
        inApp.Verify(d => d.DispatchAsync(It.IsAny<string>(), It.IsAny<NotificationDto>()), Times.Never);
    }

    [Fact]
    public async Task InApp_dispatcher_called_when_channels_include_in_app()
    {
        var (producer, _, inApp) = BuildProducer();

        var n = await producer.ProduceAsync("u-recipient", NotificationType.LikeReceived,
            "actor", "{}", "like-3");

        Assert.NotNull(n);
        inApp.Verify(d => d.DispatchAsync("u-recipient",
            It.Is<NotificationDto>(x => x.Id == n!.Id)), Times.Once);
    }
}
```

(`UserDto` here uses fields that may not match the real one — fix the field names to match `UserDto.TelegramUserId` etc. when you read the actual DTO. The test illustrates intent.)

- [ ] **Step 6: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationProducerTests"`
Expected: Compilation error — `NotificationProducer` does not exist.

- [ ] **Step 7: Write `INotificationProducer.cs`**

```csharp
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services.Notifications;

public interface INotificationProducer
{
    /// <summary>
    /// Produce a notification. Returns the written DTO, or null if suppressed
    /// (self-action, dedup hit, master mute, in-chat suppression, etc.).
    /// </summary>
    Task<NotificationDto?> ProduceAsync(
        string recipientUserId,
        NotificationType type,
        string? actorId,
        string payloadJson,
        string? sourceEventId,
        string? presenceGroup = null);
}
```

- [ ] **Step 8: Write `NotificationProducer.cs`**

```csharp
using System.Text.Json;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Notifications;

public class NotificationProducer : INotificationProducer
{
    private readonly INotificationService _notifications;
    private readonly INotificationPreferenceService _prefs;
    private readonly IPushSubscriptionService _push;
    private readonly IUserService _users;
    private readonly IInAppDispatcher _inApp;
    private readonly IPresenceTracker _presence;
    private readonly NotificationDeduper _deduper;
    private readonly ILogger<NotificationProducer> _logger;

    public NotificationProducer(
        INotificationService notifications,
        INotificationPreferenceService prefs,
        IPushSubscriptionService push,
        IUserService users,
        IInAppDispatcher inApp,
        IPresenceTracker presence,
        NotificationDeduper deduper,
        ILogger<NotificationProducer> logger)
    {
        _notifications = notifications;
        _prefs = prefs;
        _push = push;
        _users = users;
        _inApp = inApp;
        _presence = presence;
        _deduper = deduper;
        _logger = logger;
    }

    public async Task<NotificationDto?> ProduceAsync(
        string recipientUserId, NotificationType type, string? actorId,
        string payloadJson, string? sourceEventId, string? presenceGroup = null)
    {
        // 1. Self-action skip
        if (actorId == recipientUserId) return null;

        // 2. In-chat / in-topic suppression
        if (presenceGroup is not null && actorId is not null
            && _presence.IsInGroup(presenceGroup, recipientUserId))
            return null;

        // 3. Dedup window
        if (await _deduper.IsDuplicateAsync(recipientUserId, type, actorId, sourceEventId))
            return null;

        // 4. Channel resolution
        var prefs = await _prefs.GetPreferencesAsync(recipientUserId);
        var avail = await BuildAvailabilityAsync(recipientUserId);
        var channels = NotificationPolicy.ResolveChannels(prefs, type, avail);

        // 5. Write canonical row (always, even if no channels — bell is the inbox)
        var dto = await _notifications.CreateAsync(recipientUserId, type, actorId, payloadJson, sourceEventId);

        // 6. Enqueue outbox per channel and dispatch in-process channels
        var now = DateTime.UtcNow;
        foreach (var channel in channels)
        {
            var frequencyKey = char.ToLowerInvariant(channel.ToString()[0]) + channel.ToString()[1..];
            var frequency = prefs.Frequency.TryGetValue(frequencyKey, out var f) ? f : NotificationFrequency.Immediate;
            var scheduledFor = ScheduleFor(now, frequency, prefs.DailyDigestHourUtc);

            try
            {
                await _notifications.EnqueueOutboxAsync(recipientUserId, dto.Id, channel, frequency, scheduledFor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to enqueue outbox row for {Channel}/{NotificationId}",
                    channel, dto.Id);
                // continue — canonical row is the durable record
            }

            if (channel == NotificationChannel.InApp)
            {
                try { await _inApp.DispatchAsync(recipientUserId, dto); }
                catch (Exception ex) { _logger.LogWarning(ex, "InApp dispatch failed for {NotificationId}", dto.Id); }
            }
            // Other channels are dispatched by the worker (Phase C+).
        }

        return dto;
    }

    private async Task<ChannelAvailability> BuildAvailabilityAsync(string userId)
    {
        var status = await _users.GetNotificationContactStatusAsync(userId);
        var subCount = await _push.CountAsync(userId);
        return new ChannelAvailability
        {
            TelegramLinked    = status.TelegramLinked,
            EmailVerified     = status.EmailVerified,
            WebPushSubscribed = subCount > 0,
        };
    }

    private static DateTime ScheduleFor(DateTime now, NotificationFrequency frequency, int dailyHourUtc) => frequency switch
    {
        NotificationFrequency.Hourly => new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1),
        NotificationFrequency.Daily  => NextDailySlot(now, dailyHourUtc),
        _ => now,
    };

    private static DateTime NextDailySlot(DateTime now, int hourUtc)
    {
        var today = new DateTime(now.Year, now.Month, now.Day, hourUtc, 0, 0, DateTimeKind.Utc);
        return today > now ? today : today.AddDays(1);
    }
}
```

- [ ] **Step 9: Run producer tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationProducerTests"`
Expected: All 5 tests pass.

- [ ] **Step 10: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/INotificationProducer.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/NotificationProducer.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationProducerTests.cs' 'Lovecraft/Lovecraft.Backend/Services/IServices.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs' 'Lovecraft/Lovecraft.Backend/Services/MockUserService.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: NotificationProducer facade (suppression + dedup + dispatch) + tests"
```

---

## Task 15: `NotificationsController` — list / mutate / push

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\NotificationsController.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsControllerTests.cs`

Endpoints in this task:
- `GET /api/v1/notifications?cursor=&limit=20`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/mark-all-read`
- `DELETE /api/v1/notifications/{id}`
- `POST /api/v1/push/subscribe`
- `DELETE /api/v1/push/subscribe/{deviceId}`

(Push GET vapid-public-key + preferences endpoints land in Task 16.)

All `[Authorize]`. User id comes from `User.FindFirst(ClaimTypes.NameIdentifier)?.Value` (same pattern as other controllers — verify by reading `ChatsController.cs`).

- [ ] **Step 1: Write the failing controller tests**

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Lovecraft.UnitTests;

public class NotificationsControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public NotificationsControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        MockDataStore.Notifications.Clear();
        MockDataStore.PushSubscriptions.Clear();
    }

    private async Task<HttpClient> AuthedClientAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "test@example.com", password = "Test123!@#" });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var token = body.GetProperty("data").GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task GET_list_returns_empty_for_new_user()
    {
        var client = await AuthedClientAsync();
        var resp = await client.GetAsync("/api/v1/notifications?limit=20");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal(0, body.GetProperty("data").GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task GET_unread_count_returns_zero_for_new_user()
    {
        var client = await AuthedClientAsync();
        var resp = await client.GetAsync("/api/v1/notifications/unread-count");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(0, body.GetProperty("data").GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task POST_subscribe_then_DELETE_round_trip()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/v1/push/subscribe", new WebPushSubscriptionRequestDto
        {
            Endpoint = "https://push.example/test",
            P256dh = "p", Auth = "a", UserAgent = "Test"
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var deviceId = body.GetProperty("data").GetProperty("deviceId").GetString()!;

        var del = await client.DeleteAsync($"/api/v1/push/subscribe/{deviceId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
    }

    [Fact]
    public async Task Unauthorized_when_no_token()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/v1/notifications");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationsControllerTests"`
Expected: 404 for all endpoints (controller not registered yet).

- [ ] **Step 3: Read `ChatsController.cs` to confirm conventions**

Use Read on `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\ChatsController.cs` to confirm:
- `[ApiController]`, `[Route("api/v1/...")]`, `[Authorize]`
- How user id is extracted from the JWT
- How `ApiResponse<T>` is returned

- [ ] **Step 4: Write `NotificationsController.cs`**

```csharp
using System.Security.Claims;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly IPushSubscriptionService _push;

    public NotificationsController(INotificationService notifications, IPushSubscriptionService push)
    {
        _notifications = notifications;
        _push = push;
    }

    private string UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? throw new InvalidOperationException("Authenticated user missing nameid claim");

    [HttpGet("notifications")]
    public async Task<ActionResult<ApiResponse<NotificationListResponseDto>>> List(
        [FromQuery] string? cursor = null, [FromQuery] int limit = 20)
    {
        if (limit < 1 || limit > 100) limit = 20;
        var items = await _notifications.ListAsync(UserId, limit, cursor);
        return Ok(ApiResponse<NotificationListResponseDto>.Ok(new NotificationListResponseDto
        {
            Items = items,
            NextCursor = items.Count == limit ? items[^1].Id : null
        }));
    }

    [HttpGet("notifications/unread-count")]
    public async Task<ActionResult<ApiResponse<UnreadCountResponseDto>>> UnreadCount()
    {
        var count = await _notifications.UnreadCountAsync(UserId);
        return Ok(ApiResponse<UnreadCountResponseDto>.Ok(new UnreadCountResponseDto { Count = count }));
    }

    [HttpPost("notifications/{id}/read")]
    public async Task<IActionResult> MarkRead(string id)
    {
        var ok = await _notifications.MarkReadAsync(UserId, id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("notifications/mark-all-read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllRead()
    {
        var updated = await _notifications.MarkAllReadAsync(UserId);
        return Ok(ApiResponse<object>.Ok(new { updated }));
    }

    [HttpDelete("notifications/{id}")]
    public async Task<IActionResult> Dismiss(string id)
    {
        var ok = await _notifications.DismissAsync(UserId, id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("push/subscribe")]
    public async Task<ActionResult<ApiResponse<WebPushSubscriptionDto>>> Subscribe(
        [FromBody] WebPushSubscriptionRequestDto request)
    {
        if (string.IsNullOrEmpty(request.Endpoint) || string.IsNullOrEmpty(request.P256dh) || string.IsNullOrEmpty(request.Auth))
            return BadRequest(ApiResponse<WebPushSubscriptionDto>.Fail("INVALID_REQUEST", "Missing required fields"));
        var sub = await _push.SubscribeAsync(UserId, request);
        return Ok(ApiResponse<WebPushSubscriptionDto>.Ok(sub));
    }

    [HttpDelete("push/subscribe/{deviceId}")]
    public async Task<IActionResult> Unsubscribe(string deviceId)
    {
        var ok = await _push.UnsubscribeAsync(UserId, deviceId);
        return ok ? NoContent() : NotFound();
    }
}
```

If `ApiResponse<T>` uses different factory names (e.g. `Success` / `Error` instead of `Ok` / `Fail`), match the existing helpers — read `Lovecraft.Common\Models\ApiResponse.cs` to confirm.

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationsControllerTests"`
Expected: All 4 tests pass. Tests will fail with 503 / DI errors until Task 17 wires services. To enable this task's tests to pass in isolation, register the mock services now (one-line additions in `Program.cs`):

```csharp
builder.Services.AddSingleton<INotificationService, MockNotificationService>();
builder.Services.AddSingleton<IPushSubscriptionService, MockPushSubscriptionService>();
```

(Task 17 makes this mode-aware; for now the singleton mock registrations let the test suite stand on its own.)

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Controllers/V1/NotificationsController.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsControllerTests.cs' 'Lovecraft/Lovecraft.Backend/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: NotificationsController (list/mutate/push subscribe) + tests"
```

---

## Task 16: `NotificationsController` — preferences

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\NotificationsController.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsControllerTests.cs`

Adds:
- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`

with validator: all 9 type keys present; all 4 channel keys per type; `matrix[*].inApp == true` (enforced); `frequency.inApp == "immediate"`; `frequency.webPush == "immediate"`; `dailyDigestHourUtc ∈ [0, 23]`; `mutedUntilUtc` either null or in the future.

- [ ] **Step 1: Add failing preferences tests**

Append to `NotificationsControllerTests.cs`:

```csharp
[Fact]
public async Task GET_preferences_returns_defaults_for_new_user()
{
    var client = await AuthedClientAsync();
    var resp = await client.GetAsync("/api/v1/notifications/preferences");
    resp.EnsureSuccessStatusCode();
    var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var matrix = body.GetProperty("data").GetProperty("matrix");
    Assert.True(matrix.GetProperty("likeReceived").GetProperty("inApp").GetBoolean());
    Assert.False(matrix.GetProperty("likeReceived").GetProperty("telegram").GetBoolean());
    Assert.Equal(9, body.GetProperty("data").GetProperty("dailyDigestHourUtc").GetInt32());
}

[Fact]
public async Task PUT_preferences_round_trips()
{
    var client = await AuthedClientAsync();

    var get = await client.GetAsync("/api/v1/notifications/preferences");
    var prefs = await get.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var payload = System.Text.Json.JsonNode.Parse(prefs.GetProperty("data").GetRawText())!.AsObject();
    payload["dailyDigestHourUtc"] = 18;

    var put = await client.PutAsJsonAsync("/api/v1/notifications/preferences", payload);
    put.EnsureSuccessStatusCode();

    var get2 = await client.GetAsync("/api/v1/notifications/preferences");
    var body = await get2.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    Assert.Equal(18, body.GetProperty("data").GetProperty("dailyDigestHourUtc").GetInt32());
}

[Fact]
public async Task PUT_preferences_rejects_invalid_hour()
{
    var client = await AuthedClientAsync();
    var get = await client.GetAsync("/api/v1/notifications/preferences");
    var prefs = await get.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var payload = System.Text.Json.JsonNode.Parse(prefs.GetProperty("data").GetRawText())!.AsObject();
    payload["dailyDigestHourUtc"] = 99;

    var put = await client.PutAsJsonAsync("/api/v1/notifications/preferences", payload);
    Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
}

[Fact]
public async Task PUT_preferences_forces_in_app_true_and_immediate()
{
    var client = await AuthedClientAsync();
    var get = await client.GetAsync("/api/v1/notifications/preferences");
    var prefs = await get.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    var payload = System.Text.Json.JsonNode.Parse(prefs.GetProperty("data").GetRawText())!.AsObject();
    // user tries to turn off inApp for a type — should be normalized back to true
    payload["matrix"]!["likeReceived"]!["inApp"] = false;

    var put = await client.PutAsJsonAsync("/api/v1/notifications/preferences", payload);
    put.EnsureSuccessStatusCode();

    var get2 = await client.GetAsync("/api/v1/notifications/preferences");
    var body = await get2.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    Assert.True(body.GetProperty("data").GetProperty("matrix")
        .GetProperty("likeReceived").GetProperty("inApp").GetBoolean());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationsControllerTests"`
Expected: 4 new tests fail with 404 / 405.

- [ ] **Step 3: Add prefs endpoints + validator**

Inject `INotificationPreferenceService` into the controller; add a field + constructor parameter. Add the two endpoints:

```csharp
[HttpGet("notifications/preferences")]
public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> GetPrefs()
{
    var prefs = await _preferenceService.GetPreferencesAsync(UserId);
    return Ok(ApiResponse<NotificationPreferencesDto>.Ok(prefs));
}

[HttpPut("notifications/preferences")]
public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> UpdatePrefs(
    [FromBody] NotificationPreferencesDto prefs)
{
    var error = ValidateAndNormalize(prefs);
    if (error is not null)
        return BadRequest(ApiResponse<NotificationPreferencesDto>.Fail("INVALID_PREFERENCES", error));
    var saved = await _preferenceService.UpdatePreferencesAsync(UserId, prefs);
    return Ok(ApiResponse<NotificationPreferencesDto>.Ok(saved));
}

private static string? ValidateAndNormalize(NotificationPreferencesDto prefs)
{
    if (prefs.DailyDigestHourUtc is < 0 or > 23)
        return "dailyDigestHourUtc must be 0-23";
    if (prefs.MutedUntilUtc.HasValue && prefs.MutedUntilUtc.Value <= DateTime.UtcNow)
        return "mutedUntilUtc must be in the future";

    foreach (var typeName in Enum.GetNames<NotificationType>())
    {
        var key = char.ToLowerInvariant(typeName[0]) + typeName[1..];
        if (!prefs.Matrix.TryGetValue(key, out var row))
        {
            row = new Dictionary<string, bool>();
            prefs.Matrix[key] = row;
        }
        row["inApp"]    = true;                              // forced
        if (!row.ContainsKey("telegram")) row["telegram"] = false;
        if (!row.ContainsKey("webPush"))  row["webPush"]  = false;
        if (!row.ContainsKey("email"))    row["email"]    = false;
    }

    prefs.Frequency["inApp"]    = NotificationFrequency.Immediate;
    prefs.Frequency["webPush"]  = NotificationFrequency.Immediate;
    if (!prefs.Frequency.ContainsKey("telegram"))
        prefs.Frequency["telegram"] = NotificationFrequency.Immediate;
    if (!prefs.Frequency.ContainsKey("email"))
        prefs.Frequency["email"] = NotificationFrequency.Daily;

    return null;
}
```

Add `using Lovecraft.Common.Enums;` at the top.

- [ ] **Step 4: Register `INotificationPreferenceService` in `Program.cs` so the controller resolves**

```csharp
builder.Services.AddSingleton<INotificationPreferenceService, MockNotificationPreferenceService>();
```

(Made mode-aware in Task 17.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~NotificationsControllerTests"`
Expected: All 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Controllers/V1/NotificationsController.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsControllerTests.cs' 'Lovecraft/Lovecraft.Backend/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: GET/PUT preferences endpoints with validator + tests"
```

---

## Task 17: DI wiring in `Program.cs`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Program.cs`

Replace the singleton mock registrations from Tasks 15–16 with mode-aware registrations (mirror the existing `USE_AZURE_STORAGE` switch pattern used for users / events etc.). Also register `IInAppDispatcher`, `IPresenceTracker`, `NotificationDeduper`, and `INotificationProducer`.

- [ ] **Step 1: Read `Program.cs` and find the existing storage-mode switch block**

Use Read on `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Program.cs`. Locate the block that registers `IUserService` / `IEventService` etc., conditionally on `USE_AZURE_STORAGE`.

- [ ] **Step 2: Add notification service registrations next to the existing ones**

For `useAzureStorage == false` (mock branch):
```csharp
builder.Services.AddSingleton<INotificationService, MockNotificationService>();
builder.Services.AddSingleton<INotificationPreferenceService, MockNotificationPreferenceService>();
builder.Services.AddSingleton<IPushSubscriptionService, MockPushSubscriptionService>();
```

For `useAzureStorage == true` (Azure branch) — need three new `TableClient` instances. Mirror the existing pattern:
```csharp
var serviceClient = new TableServiceClient(connectionString);
var notificationsTable = serviceClient.GetTableClient(TableNames.Notifications);
notificationsTable.CreateIfNotExists();
var outboxTable = serviceClient.GetTableClient(TableNames.NotificationsOutbox);
outboxTable.CreateIfNotExists();
var prefsTable = serviceClient.GetTableClient(TableNames.NotificationPreferences);
prefsTable.CreateIfNotExists();
var pushTable = serviceClient.GetTableClient(TableNames.WebPushSubscriptions);
pushTable.CreateIfNotExists();

builder.Services.AddSingleton<INotificationService>(sp =>
    new AzureNotificationService(notificationsTable, outboxTable,
        sp.GetRequiredService<ILogger<AzureNotificationService>>()));
builder.Services.AddSingleton<INotificationPreferenceService>(sp =>
    new AzureNotificationPreferenceService(prefsTable,
        sp.GetRequiredService<ILogger<AzureNotificationPreferenceService>>()));
builder.Services.AddSingleton<IPushSubscriptionService>(sp =>
    new AzurePushSubscriptionService(pushTable,
        sp.GetRequiredService<ILogger<AzurePushSubscriptionService>>()));
```

- [ ] **Step 3: Register shared notification infra (mode-agnostic)**

Outside the `if (useAzureStorage)` block:
```csharp
builder.Services.AddSingleton<IPresenceTracker, PresenceTracker>();
builder.Services.AddSingleton<IInAppDispatcher, InAppDispatcher>();
builder.Services.AddSingleton<NotificationDeduper>();
builder.Services.AddSingleton<INotificationProducer, NotificationProducer>();
```

Add `using Lovecraft.Backend.Services.Notifications;` at the top.

- [ ] **Step 4: Build and run the full test suite**

Run:
```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: Build succeeded. All notification tests + all previously passing tests pass.

- [ ] **Step 5: Smoke-test the API manually (optional)**

If you have a local backend running (`dotnet run --project Lovecraft.Backend` with `USE_AZURE_STORAGE=false`), log in as `test@example.com` / `Test123!@#`, capture the token, and exercise:
```
curl http://localhost:5000/api/v1/notifications -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/notifications/preferences -H "Authorization: Bearer $TOKEN"
```
Expected: 200 OK with `success: true`.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: DI wiring for both mock and Azure modes"
```

---

## Task 18: Documentation

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\docs\NOTIFICATIONS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\AZURE_STORAGE.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\ARCHITECTURE.md`

- [ ] **Step 1: Write `NOTIFICATIONS.md` skeleton**

```markdown
# Notifications (backend)

**Last updated:** 2026-05-17
**Phase:** A (Foundations) shipped. Phases B–H pending — see spec.

## Architecture

Two-process split: producers in the API process write `notifications` + `notificationsoutbox`
rows when triggers fire. A separate `Lovecraft.NotificationsWorker` (Phase C+) drains the
outbox for Telegram and email; in-app and Web Push are dispatched directly from the API.

## Phase A scope (this phase)

- 4 Azure Tables: `notifications`, `notificationsoutbox`, `notificationpreferences`,
  `webpushsubscriptions`
- Enums: `NotificationType` (9 values), `NotificationChannel` (4), `NotificationFrequency` (3)
- Services: `INotificationService`, `INotificationPreferenceService`, `IPushSubscriptionService`
- Helpers: `NotificationPolicy.ResolveChannels`, `NotificationDeduper`, `IPresenceTracker`
- `IInAppDispatcher` (wraps `IHubContext<ChatHub>` for `NotificationReceived`)
- `INotificationProducer` facade — not yet wired to any call site (Phase B)
- `NotificationsController` — list/read/dismiss/preferences/push-subscribe endpoints

## What Phase A does NOT include

- Producer call-site wiring (Phase B)
- Frontend bell UI / settings (Phase B)
- Worker process (Phase C)
- Telegram delivery (Phase D)
- Web Push delivery (Phase E)
- Email digests (Phase F)
- Event reminders + admin broadcast (Phase G)
- Rank-up notifications (Phase H)

See [`aloevera-harmony-meet/docs/superpowers/specs/2026-05-17-notifications-design.md`](../../../aloevera-harmony-meet/docs/superpowers/specs/2026-05-17-notifications-design.md).

## API endpoints (Phase A)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/notifications?cursor=&limit=20` | Paginated list (newest first) |
| GET | `/api/v1/notifications/unread-count` | `{ count: int }` |
| POST | `/api/v1/notifications/{id}/read` | Mark one read |
| POST | `/api/v1/notifications/mark-all-read` | Bulk mark |
| DELETE | `/api/v1/notifications/{id}` | Dismiss |
| GET | `/api/v1/notifications/preferences` | Get prefs (returns defaults if none stored) |
| PUT | `/api/v1/notifications/preferences` | Replace prefs (validator forces `inApp=true` per type, `inApp`+`webPush` frequency=immediate) |
| POST | `/api/v1/push/subscribe` | Register a Web Push subscription (no consumer wired yet — Phase E) |
| DELETE | `/api/v1/push/subscribe/{deviceId}` | Unsubscribe one device |

All require `Authorization: Bearer <token>`.

## Default preferences

All channels off except in-app. In-app frequency is immediate. Telegram/Web Push frequency
defaults to immediate; email defaults to daily. `DailyDigestHourUtc` defaults to 9.
```

- [ ] **Step 2: Append the 4 new tables to `AZURE_STORAGE.md`**

In the "Tables (23)" section heading, change to "Tables (27)". Append a new "Notifications" subsection after the existing "Store, blog, app config" section:

```markdown
### Notifications

#### `notifications`
PK `userId` (recipient) · RK `{invertedTicks}_{notificationId}`

Canonical record. Fields: `Type`, `ActorId?`, `PayloadJson`, `CreatedAtUtc`, `ReadAtUtc?`,
`DismissedAtUtc?`, `DigestGroupId?`, `SourceEventId?` (used by `NotificationDeduper`).

#### `notificationsoutbox`
PK partition naming: `OUTBOX_{channel}_PENDING` while pending; `OUTBOX_{channel}_DONE_{yyyy-MM-dd}`
after success; `OUTBOX_{channel}_DEAD_{yyyy-MM-dd}` after 5 failed attempts.
RK `{scheduledForUtc:yyyy-MM-ddTHH:mm:ss}_{notificationId}` (lex = chronological).

#### `notificationpreferences`
PK `userId` · RK `INDEX`. Fields: `MatrixJson`, `FrequencyJson`, `DailyDigestHourUtc`,
`Mute`, `MutedUntilUtc?`. Defaults loaded by `MockNotificationPreferenceService.BuildDefaults`.

#### `webpushsubscriptions`
PK `userId` · RK `deviceId`. Fields: `Endpoint`, `P256dh`, `Auth`, `UserAgent`,
`CreatedAtUtc`, `LastSeenAtUtc`. No consumer wired until Phase E.
```

- [ ] **Step 3: Add one line under "Done since the original plan" in `IMPLEMENTATION_SUMMARY.md`**

```markdown
- ✅ Notifications Phase A: 4 Azure Tables, DTOs/enums, services (notifications, preferences,
  push subscriptions), helpers (NotificationPolicy, NotificationDeduper, IPresenceTracker),
  InAppDispatcher, NotificationProducer facade, NotificationsController endpoints. No
  producer call sites wired yet — Phase B.
```

- [ ] **Step 4: List notification services in `ARCHITECTURE.md` services tree**

In the "Services" block of the architecture diagram or the project-structure listing,
append:

```
INotificationService
INotificationPreferenceService
IPushSubscriptionService
INotificationProducer + NotificationPolicy + NotificationDeduper + IPresenceTracker + IInAppDispatcher
```

(Adjust to fit the actual layout — read the file first.)

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md' 'Lovecraft/docs/AZURE_STORAGE.md' 'Lovecraft/docs/IMPLEMENTATION_SUMMARY.md' 'Lovecraft/docs/ARCHITECTURE.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase A reference + table schema"
```

---

## Task 19: Final verification

**Files:** none modified.

- [ ] **Step 1: Build the whole solution**

Run: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`
Expected: Build succeeded. 0 warnings related to notifications.

- [ ] **Step 2: Run the full test suite**

Run: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
Expected: All tests pass. Notification-related test count (`NotificationPolicyTests` + `NotificationDeduperTests` + `NotificationPreferenceServiceTests` + `MockNotificationServiceTests` + `AzureNotificationServiceTests` + `MockPushSubscriptionServiceTests` + `PresenceTrackerTests` + `InAppDispatcherTests` + `NotificationProducerTests` + `NotificationsControllerTests`) is roughly 40+ tests.

- [ ] **Step 3: Smoke-test the API in mock mode**

Run: `dotnet run --project 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj'`

In another shell:
```bash
curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}' \
  | jq -r '.data.accessToken' > token.txt
TOKEN=$(cat token.txt)

curl -s http://localhost:5000/api/v1/notifications -H "Authorization: Bearer $TOKEN" | jq
curl -s http://localhost:5000/api/v1/notifications/unread-count -H "Authorization: Bearer $TOKEN" | jq
curl -s http://localhost:5000/api/v1/notifications/preferences -H "Authorization: Bearer $TOKEN" | jq
```

Expected: All return `{"success": true, ...}`. Preferences shows defaults (all channels off except inApp).

Stop the backend (`Ctrl+C`).

- [ ] **Step 4: Verify no uncommitted changes**

Run: `git -C 'D:\src\lovecraft' status`
Expected: `nothing to commit, working tree clean` (or just untracked files unrelated to this phase).

- [ ] **Step 5: Final summary commit (optional)**

If you want a marker commit for the phase boundary, do:
```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase A complete"
```

---

## After Phase A

When this phase is merged to `main`, return to the brainstorming/plans cycle and write the
Phase B plan from the spec. Phase B will:

1. Wire `INotificationProducer.ProduceAsync` into each of the 9 call sites
   (`MatchingService.CreateLikeAsync`, `ChatsController.SendMessage`, `ForumService.CreateReplyAsync`,
   `EventsController.CreateEvent`, `AdminController.IssueInvite` (extended), `AzureUserService.IncrementCounterAsync`,
   `AdminController.Broadcast`).
2. Build the frontend: types + `notificationsApi` + bell + dropdown + `/notifications` page +
   `NotificationPreferences` section in Settings + `useNotificationSignalR` hook.
