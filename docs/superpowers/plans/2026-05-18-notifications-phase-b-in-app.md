# Notifications — Phase B (In-app + Producers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `INotificationProducer.ProduceAsync` into the four high-volume interpersonal trigger paths (likes, matches, messages, forum replies) and ship the full in-app notification UI — bell + dropdown + dedicated page + Settings preferences panel — so users see notifications in real time. Other channels (Telegram, Web Push, email) remain no-ops because matrix defaults are off; users opt them on in later phases.

**Architecture:** Producers fire from controller / service code paths after the originating action has been persisted. The producer writes a `notifications` row, resolves channels via prefs, fires in-app via SignalR `NotificationReceived`, and enqueues outbox rows for other channels (no consumer yet). Frontend listens to `NotificationReceived` on the existing `chatConnection` singleton, updates a Zustand store, surfaces unread count in the bell badge.

**Tech Stack:** .NET 10 / ASP.NET Core / SignalR / xUnit / React 18 + TypeScript / Vite / shadcn/ui / Zustand (new dep) / Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Predecessor:** [`docs/superpowers/plans/2026-05-17-notifications-phase-a-foundations.md`](./2026-05-17-notifications-phase-a-foundations.md) (foundations merged 2026-05-18 in backend commit `4dc5daf`)

**Phase B scope decision:** Wires 4 producers (LikeReceived, MatchCreated, MessageReceived, ForumReplyToThread). The remaining 5 producer types live in later phases:
- `EventPublished` + `EventInviteReceived` + `CommunityBroadcast` → Phase G (admin broadcast + invite extension)
- `EventReminder` → Phase G (worker scheduler)
- `RankUp` → Phase H (rank delta hook)

**Repos:**
- Backend: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)
- Frontend: `D:\src\aloevera-harmony-meet` (commits via `git -C 'D:\src\aloevera-harmony-meet'`)

**Branches:**
- Backend: `feat/notifications-phase-b` (create from `main` at the start)
- Frontend: `feat/notifications-phase-b` (create from `main` at the start)

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Frontend (from `D:\src\aloevera-harmony-meet`): `npm run test:run` (single-run) or `npx vitest run <path>` (targeted)

---

## File map

### Backend (`D:\src\lovecraft\Lovecraft\`)

| File | Change |
|---|---|
| `Lovecraft.Backend\Services\MockMatchingService.cs` | + ctor param `INotificationProducer?`; call producer on like (non-mutual) and match (mutual, both users) |
| `Lovecraft.Backend\Services\Azure\AzureMatchingService.cs` | same |
| `Lovecraft.Backend\Controllers\V1\ChatsController.cs` | + ctor param `INotificationProducer`; call producer for each non-sender chat participant after persisting message |
| `Lovecraft.Backend\Services\MockForumService.cs` | + ctor param `INotificationProducer?`; call producer for each non-author thread participant on reply |
| `Lovecraft.Backend\Services\Azure\AzureForumService.cs` | same |
| `Lovecraft.Backend\Services\Caching\CachingForumService.cs` | wraps the new ctor param (passes through to inner; no producer interaction in the cache layer) |
| `Lovecraft.UnitTests\MatchingTests.cs` | + 4 tests for producer firing on like / match / self-action / anonymous-like |
| `Lovecraft.UnitTests\ChatTests.cs` | + 3 tests for producer firing on message / self-message-suppression / in-chat-suppression |
| `Lovecraft.UnitTests\ForumTests.cs` | + 3 tests for producer firing on reply / self-reply-suppression / thread-participant-fanout |

### Frontend (`D:\src\aloevera-harmony-meet\`)

| File | Change |
|---|---|
| `package.json` | + `zustand` dep |
| `src\types\notification.ts` | new — types mirroring backend DTOs |
| `src\services\api\notificationsApi.ts` | new — list, unreadCount, markRead, markAllRead, dismiss, getPreferences, updatePreferences |
| `src\services\api\pushApi.ts` | new — subscribe, unsubscribe (no consumer yet; the API is ready) |
| `src\services\api\index.ts` | re-export `notificationsApi`, `pushApi` |
| `src\services\signalr\chatConnection.ts` | document existing `on('NotificationReceived', ...)` works — `on/off` already generic; no code change needed |
| `src\hooks\useNotificationSignalR.ts` | new — wires `NotificationReceived` events into the store |
| `src\stores\notificationStore.ts` | new — Zustand store with `items`, `unreadCount`, actions |
| `src\components\notifications\NotificationBell.tsx` | new — header bell with unread badge |
| `src\components\notifications\NotificationDropdown.tsx` | new — popover/sheet body |
| `src\components\notifications\NotificationItem.tsx` | new — per-row render (icon + title + relative time + click handler) |
| `src\components\notifications\notificationIcons.tsx` | new — type→icon mapping |
| `src\components\settings\NotificationPreferences.tsx` | new — accordion section: master mute/snooze + 4 channel blocks |
| `src\components\settings\index.ts` (or wherever existing settings sections live) | new export if needed |
| `src\pages\Notifications.tsx` | new — `/notifications` route page |
| `src\pages\SettingsPage.tsx` | + render `<NotificationPreferences />` in a new accordion section |
| `src\pages\Friends.tsx` | + render `<NotificationBell />` in the header (existing sticky header) |
| `src\pages\Talks.tsx` | same |
| `src\pages\AloeVera.tsx` | same |
| `src\App.tsx` | + `/notifications` route wrapped in `<ProtectedRoute>` |
| `src\contexts\LanguageContext.tsx` | + ~25 new translation keys (`notifications.*`) in both `ru` and `en` |
| `src\lib\notificationFormatting.ts` | new — `formatNotificationTitle(n)`, `formatNotificationLink(n)`, `relativeTime(date)` helpers |
| `src\types\notification.ts` test | new — type checks (Vitest doesn't compile-time check; minimal coverage) |
| `src\services\api\__tests__\notificationsApi.test.ts` | new — mock + API mode round-trips |
| `src\stores\__tests__\notificationStore.test.ts` | new — store reducers |
| `src\components\notifications\__tests__\NotificationBell.test.tsx` | new — badge counts (0/1/9/10), dropdown render |
| `src\components\settings\__tests__\NotificationPreferences.test.tsx` | new — matrix render, channel-unavailable greyed state, daily hour shown/hidden |
| `src\hooks\__tests__\useNotificationSignalR.test.tsx` | new — incoming event updates store |
| `src\lib\__tests__\notificationFormatting.test.ts` | new |

### Docs

| File | Change |
|---|---|
| `lovecraft\Lovecraft\docs\NOTIFICATIONS.md` | append Phase B section: producer call sites + payload shapes |
| `aloevera-harmony-meet\docs\FEATURES.md` | new section "Notifications" |
| `aloevera-harmony-meet\docs\API_INTEGRATION.md` | append notes on `notificationsApi`, `pushApi`, `useNotificationSignalR`, store |
| `aloevera-harmony-meet\AGENTS.md` | append: Zustand pattern (TD.3 first concrete adoption), notification producer convention |
| `aloevera-harmony-meet\docs\ISSUES.md` | update MCF.4 status to "partial — Phase A + B shipped; Telegram/WebPush/Email in C–F" |

---

## Task ordering

Backend producer wiring first (Tasks 1–4) so the trigger paths emit notifications. Then frontend foundations (Tasks 5–10): types, services, store, hook. Then UI pieces (Tasks 11–17): bell, dropdown, dedicated page, prefs panel, header mounts, route. Then docs + final verification (18–19).

Each phase lands incrementally on `feat/notifications-phase-b` branches. After all tasks complete, merge backend and frontend branches to their respective `main`s.

---

## Task 0: Create feature branches

**Files:** none modified.

- [ ] **Step 1: Create backend branch**

```bash
git -C 'D:\src\lovecraft' checkout main
git -C 'D:\src\lovecraft' pull --ff-only
git -C 'D:\src\lovecraft' checkout -b feat/notifications-phase-b
```

- [ ] **Step 2: Create frontend branch**

```bash
git -C 'D:\src\aloevera-harmony-meet' checkout main
git -C 'D:\src\aloevera-harmony-meet' pull --ff-only
git -C 'D:\src\aloevera-harmony-meet' checkout -b feat/notifications-phase-b
```

No commit; this is just branch setup.

---

## Task 1: Wire `LikeReceived` and `MatchCreated` producers in `MatchingService`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs` (no change — `IMatchingService` already exists)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockMatchingService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureMatchingService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\MatchingTests.cs` (add 4 tests)

Producer constructor injection: add `INotificationProducer? producer` (nullable for backward-compatible test construction; nullable means "don't fire notifications" — tests without producer still pass). In production DI it's always wired.

For non-mutual like: write `LikeReceived` notification to recipient (`toUserId`). Honor anonymous-likes via `fromUser.Settings.AnonymousLikes` — if true, pass `actorId=null` and payload `{ "likeId":"...", "anonymous": true }`; else `actorId=fromUserId` and payload `{ "likeId":"...", "anonymous": false }`.

For mutual like (match): write `MatchCreated` notification to BOTH users. For user A's notification, actorId = user B's id. For user B's, actorId = A's. SourceEventId = stable string like `"match-{minId}-{maxId}"` (lex-sort) so both sides have the same id and dedup is consistent.

- [ ] **Step 1: Add failing tests in `MatchingTests.cs`**

Append a new test class section. Tests will use Moq for `INotificationProducer`. Existing test infrastructure uses `MockMatchingService` directly.

```csharp
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;

public class MatchingNotificationTests
{
    public MatchingNotificationTests()
    {
        MockDataStore.Likes.Clear();
        MockDataStore.LikesReceived.Clear();
        MockDataStore.Matches.Clear();
    }

    private static MockMatchingService BuildService(Mock<INotificationProducer> producer)
    {
        // MockMatchingService dependencies — match existing test pattern.
        // If MockMatchingService doesn't currently take an IChatService for the auto-create-chat path, look at how MatchingTests.cs constructs it now and add the producer param matching that.
        var chatService = new MockChatService();
        return new MockMatchingService(chatService, producer.Object);
    }

    [Fact]
    public async Task Non_mutual_like_fires_LikeReceived_to_recipient()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        await svc.CreateLikeAsync("u-from", "u-to");

        producer.Verify(p => p.ProduceAsync(
            "u-to", NotificationType.LikeReceived,
            "u-from", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Mutual_like_fires_MatchCreated_to_both_users()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);
        await svc.CreateLikeAsync("u-a", "u-b");        // first like — fires LikeReceived to u-b
        producer.Invocations.Clear();

        await svc.CreateLikeAsync("u-b", "u-a");        // mutual — should fire MatchCreated to both

        producer.Verify(p => p.ProduceAsync(
            "u-a", NotificationType.MatchCreated, "u-b",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
        producer.Verify(p => p.ProduceAsync(
            "u-b", NotificationType.MatchCreated, "u-a",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Anonymous_like_uses_null_actorId_and_anonymous_true_in_payload()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        // Seed sender with AnonymousLikes=true via mock user data
        var sender = MockDataStore.Users.First();
        sender.Settings.AnonymousLikes = true;
        await svc.CreateLikeAsync(sender.Id, "u-target");

        producer.Verify(p => p.ProduceAsync(
            "u-target",
            NotificationType.LikeReceived,
            (string?)null,                                       // actorId omitted
            It.Is<string>(s => s.Contains("\"anonymous\":true")),
            It.IsAny<string>(),
            It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Self_action_not_attempted_at_producer_layer()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        // Self-like: the matching service may already reject this at controller; if it goes through,
        // the producer's self-action skip handles it. Either way: producer should never write a row
        // for self-action. We verify the producer is either not called, or called with same recipient/actor
        // (which the producer will internally suppress — verified in NotificationProducerTests).
        // For this test, we assert producer.ProduceAsync is NOT called with (recipient == actor).
        await svc.CreateLikeAsync("u-self", "u-self");

        producer.Verify(p => p.ProduceAsync(
            It.Is<string>(rid => rid == "u-self"),
            It.IsAny<NotificationType>(),
            It.Is<string?>(aid => aid == "u-self"),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string?>()), Times.Never);
    }
}
```

**Note:** the `INotificationProducer.ProduceAsync` signature from Phase A is:
```csharp
Task<NotificationDto?> ProduceAsync(
    string recipientUserId,
    NotificationType type,
    string? actorId,
    string payloadJson,
    string? sourceEventId,
    string? presenceGroup = null);
```

So `It.IsAny<string?>()` for the optional `presenceGroup` and `sourceEventId` slots.

- [ ] **Step 2: Run tests to verify they fail**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~MatchingNotificationTests"
```
Expected: compilation error — `MockMatchingService` constructor doesn't take `INotificationProducer`.

- [ ] **Step 3: Update `IMatchingService` impls to accept and use the producer**

In `MockMatchingService.cs`:

```csharp
// Field + constructor:
private readonly INotificationProducer? _producer;

public MockMatchingService(IChatService chatService, INotificationProducer? producer = null)
{
    _chatService = chatService;
    _producer = producer;
}
```

After the existing like persistence code (where the like has been written to `MockDataStore.Likes` / `MockDataStore.LikesReceived`), and before/after the existing chat-auto-create code, add:

```csharp
// Non-mutual: fire LikeReceived to recipient
if (_producer is not null)
{
    var sender = MockDataStore.Users.FirstOrDefault(u => u.Id == fromUserId);
    var anonymous = sender?.Settings?.AnonymousLikes ?? false;
    var payloadJson = JsonSerializer.Serialize(new
    {
        likeId = likeRowKey,    // or whatever stable like-id you derive — see existing code
        anonymous,
    });
    await _producer.ProduceAsync(
        recipientUserId: toUserId,
        type: NotificationType.LikeReceived,
        actorId: anonymous ? null : fromUserId,
        payloadJson: payloadJson,
        sourceEventId: likeRowKey);
}

// On mutual: fire MatchCreated to both
if (isMutual && _producer is not null)
{
    var lex = string.CompareOrdinal(fromUserId, toUserId) < 0
        ? (fromUserId, toUserId)
        : (toUserId, fromUserId);
    var matchSourceId = $"match-{lex.Item1}-{lex.Item2}";
    var matchPayload = JsonSerializer.Serialize(new { matchId = matchSourceId });

    await _producer.ProduceAsync(toUserId, NotificationType.MatchCreated, fromUserId, matchPayload, matchSourceId);
    await _producer.ProduceAsync(fromUserId, NotificationType.MatchCreated, toUserId, matchPayload, matchSourceId);
}
```

Add `using System.Text.Json;`, `using Lovecraft.Backend.Services.Notifications;`, `using Lovecraft.Common.Enums;` at the top.

Do the same in `AzureMatchingService.cs` — constructor + producer field, then the analogous calls after the Azure persistence paths. Read the file first to identify where the like-row write happens and where the mutual check fires.

- [ ] **Step 4: Update DI registration in `Program.cs` to pass the producer**

Read `Program.cs`. Find the existing `IMatchingService` registration (likely a `AddSingleton<IMatchingService, MockMatchingService>()` or factory). Convert to a factory lambda that resolves `INotificationProducer`:

```csharp
// Mock branch:
builder.Services.AddSingleton<IMatchingService>(sp =>
    new MockMatchingService(
        sp.GetRequiredService<IChatService>(),
        sp.GetRequiredService<INotificationProducer>()));

// Azure branch (mirror):
builder.Services.AddSingleton<IMatchingService>(sp =>
    new AzureMatchingService(
        // ... existing args ...,
        sp.GetRequiredService<INotificationProducer>()));
```

Adjust to match whatever existing constructor signatures look like (`AzureMatchingService` probably takes 2 `TableClient`s plus the chat service).

- [ ] **Step 5: Run tests**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: 4 new tests pass; previous 343 tests still pass; total 347.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/MockMatchingService.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureMatchingService.cs' 'Lovecraft/Lovecraft.Backend/Program.cs' 'Lovecraft/Lovecraft.UnitTests/MatchingTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: wire LikeReceived + MatchCreated producers in MatchingService"
```

---

## Task 2: Wire `MessageReceived` producer in `ChatsController.SendMessage`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\ChatsController.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\ChatTests.cs` (add 3 tests)

After the existing REST send-message path (controller persists via `IChatService.SendMessageAsync` then broadcasts via `IHubContext`), loop over chat participants. For each non-sender, fire `MessageReceived` notification. The producer's `DerivePresenceGroup` extracts `chat-{chatId}` from the payload and applies the existing in-chat suppression rule — we don't need to check presence manually.

Payload: `{ "chatId": "...", "messageId": "...", "preview": <first 80 chars> }`. SourceEventId: messageId.

- [ ] **Step 1: Add failing tests in `ChatTests.cs`**

Append a new test class or extend an existing controller test class:

```csharp
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.Enums;
using Moq;

public class ChatNotificationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public ChatNotificationTests(WebApplicationFactory<Program> factory) { _factory = factory; }

    [Fact]
    public async Task SendMessage_fires_producer_for_each_other_participant()
    {
        var producer = new Mock<INotificationProducer>();
        var factory = _factory.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddSingleton<INotificationProducer>(producer.Object)));
        var client = factory.CreateClientAsUser("u-sender");

        // Create chat between u-sender and u-other (use existing test helper or POST /api/v1/chats)
        var chatResp = await client.PostAsJsonAsync("/api/v1/chats", new { targetUserId = "u-other" });
        chatResp.EnsureSuccessStatusCode();
        var chatId = (await chatResp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>())
            .GetProperty("data").GetProperty("id").GetString();

        producer.Invocations.Clear();
        var sendResp = await client.PostAsJsonAsync($"/api/v1/chats/{chatId}/messages",
            new { content = "hello there" });
        sendResp.EnsureSuccessStatusCode();

        producer.Verify(p => p.ProduceAsync(
            "u-other",
            NotificationType.MessageReceived,
            "u-sender",
            It.Is<string>(s => s.Contains("\"chatId\"") && s.Contains("\"preview\":\"hello there\"")),
            It.IsAny<string>(),
            It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task SendMessage_does_not_fire_for_sender()
    {
        var producer = new Mock<INotificationProducer>();
        var factory = _factory.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddSingleton<INotificationProducer>(producer.Object)));
        var client = factory.CreateClientAsUser("u-sender");
        var chatResp = await client.PostAsJsonAsync("/api/v1/chats", new { targetUserId = "u-other" });
        var chatId = (await chatResp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>())
            .GetProperty("data").GetProperty("id").GetString();

        producer.Invocations.Clear();
        await client.PostAsJsonAsync($"/api/v1/chats/{chatId}/messages", new { content = "hi" });

        producer.Verify(p => p.ProduceAsync(
            "u-sender", It.IsAny<NotificationType>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task SendMessage_preview_truncated_to_80_chars()
    {
        var producer = new Mock<INotificationProducer>();
        var factory = _factory.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddSingleton<INotificationProducer>(producer.Object)));
        var client = factory.CreateClientAsUser("u-sender");
        var chatResp = await client.PostAsJsonAsync("/api/v1/chats", new { targetUserId = "u-other" });
        var chatId = (await chatResp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>())
            .GetProperty("data").GetProperty("id").GetString();

        var longContent = new string('x', 200);
        await client.PostAsJsonAsync($"/api/v1/chats/{chatId}/messages", new { content = longContent });

        producer.Verify(p => p.ProduceAsync(
            "u-other", NotificationType.MessageReceived, It.IsAny<string?>(),
            It.Is<string>(s =>
                s.Contains("\"preview\":\"" + new string('x', 80) + "\"") ||
                s.Contains("\"preview\":\"" + new string('x', 80) + "…\"")),  // either truncation marker style is fine
            It.IsAny<string>(),
            It.IsAny<string?>()), Times.Once);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~ChatNotificationTests"
```
Expected: 3 fail — producer is not yet wired into `ChatsController.SendMessage`.

- [ ] **Step 3: Wire producer in `ChatsController.cs`**

Read the existing `ChatsController.SendMessage` action. It currently: validates access, calls `IChatService.SendMessageAsync`, then broadcasts via `IHubContext<ChatHub>`.

Add `INotificationProducer producer` to the controller's constructor. After the broadcast call (so the canonical message persists first, then the broadcast fires, then notifications), add:

```csharp
// Fetch chat participants — already cached in IChatService
var chat = await _chatService.GetChatAsync(chatId);
if (chat is not null)
{
    var senderId = UserId;
    var preview = request.Content.Length > 80
        ? request.Content.Substring(0, 80) + "…"
        : request.Content;
    var payloadJson = JsonSerializer.Serialize(new
    {
        chatId,
        messageId = sentMessage.Id,
        preview,
    });

    foreach (var participantId in chat.ParticipantIds)
    {
        if (participantId == senderId) continue;
        // fire-and-forget; producer handles its own errors
        await _producer.ProduceAsync(
            recipientUserId: participantId,
            type: NotificationType.MessageReceived,
            actorId: senderId,
            payloadJson: payloadJson,
            sourceEventId: sentMessage.Id);
    }
}
```

`sentMessage` is the returned DTO from `_chatService.SendMessageAsync` — adjust the variable name to match what the existing code calls it.

Add `using System.Text.Json;`, `using Lovecraft.Backend.Services.Notifications;`, `using Lovecraft.Common.Enums;` at the top.

- [ ] **Step 4: Run tests**

Expected: 3 new tests pass; previous tests still pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Controllers/V1/ChatsController.cs' 'Lovecraft/Lovecraft.UnitTests/ChatTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: wire MessageReceived producer in ChatsController.SendMessage"
```

---

## Task 3: Wire `ForumReplyToThread` producer in `ForumService.CreateReplyAsync`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockForumService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureForumService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Caching\CachingForumService.cs` (pass-through constructor change)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Program.cs` (factory lambdas)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\ForumTests.cs` (add 3 tests)

`CreateReplyAsync(topicId, authorId, authorName, content, imageUrls?)` returns the new reply. After persisting, fire `ForumReplyToThread` to every distinct user who has participated in the thread (topic author + prior reply authors), excluding the new reply's author.

Payload: `{ "topicId": "...", "replyId": "..." }`. SourceEventId: replyId.

- [ ] **Step 1: Add failing tests in `ForumTests.cs`**

```csharp
public class ForumNotificationTests
{
    public ForumNotificationTests() { MockDataStore.ForumReplies.Clear(); }  // adjust to actual mock store field

    private static MockForumService BuildService(Mock<INotificationProducer> producer) =>
        new MockForumService(producer.Object);    // adjust ctor args to match existing

    [Fact]
    public async Task Reply_fires_ForumReplyToThread_to_topic_author()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        // Seed a topic authored by u-author
        var topic = await svc.CreateTopicAsync("general", "u-author", "Author", "Title", "Body", noviceVisible: true, noviceCanReply: true);

        await svc.CreateReplyAsync(topic.Id, "u-replier", "Replier", "Reply content", null);

        producer.Verify(p => p.ProduceAsync(
            "u-author", NotificationType.ForumReplyToThread, "u-replier",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Reply_fans_out_to_all_prior_participants_except_self()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        var topic = await svc.CreateTopicAsync("general", "u-author", "Author", "T", "B", true, true);
        await svc.CreateReplyAsync(topic.Id, "u-p1", "P1", "first reply", null);
        await svc.CreateReplyAsync(topic.Id, "u-p2", "P2", "second reply", null);
        producer.Invocations.Clear();

        await svc.CreateReplyAsync(topic.Id, "u-p1", "P1", "third reply by p1", null);

        // p1 is the new replier — should not get notified of own reply
        // u-author, u-p2 should each get one
        producer.Verify(p => p.ProduceAsync(
            "u-author", NotificationType.ForumReplyToThread, "u-p1",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
        producer.Verify(p => p.ProduceAsync(
            "u-p2", NotificationType.ForumReplyToThread, "u-p1",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
        producer.Verify(p => p.ProduceAsync(
            "u-p1", It.IsAny<NotificationType>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Reply_dedups_repeat_participants()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildService(producer);

        var topic = await svc.CreateTopicAsync("general", "u-author", "Author", "T", "B", true, true);
        await svc.CreateReplyAsync(topic.Id, "u-p1", "P1", "first", null);
        await svc.CreateReplyAsync(topic.Id, "u-p1", "P1", "second", null);   // p1 replies twice
        producer.Invocations.Clear();

        await svc.CreateReplyAsync(topic.Id, "u-other", "Other", "from other", null);

        // u-author + u-p1 each get exactly one notification — not two for p1's pair of prior replies
        producer.Verify(p => p.ProduceAsync(
            "u-author", NotificationType.ForumReplyToThread, "u-other",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
        producer.Verify(p => p.ProduceAsync(
            "u-p1", NotificationType.ForumReplyToThread, "u-other",
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: compile errors / runtime nulls — producer not wired yet.

- [ ] **Step 3: Update `MockForumService.CreateReplyAsync` to wire producer**

Constructor:
```csharp
private readonly INotificationProducer? _producer;
public MockForumService(INotificationProducer? producer = null)
{
    _producer = producer;
}
```

In `CreateReplyAsync`, after writing the reply, collect distinct participant ids (topic author + reply authors) excluding the new reply's author. Loop and fire producer:

```csharp
if (_producer is not null)
{
    var topic = await GetTopicByIdAsync(topicId);
    if (topic is not null)
    {
        var participants = new HashSet<string>();
        participants.Add(topic.AuthorId);
        foreach (var r in GetRepliesAsyncInternal(topicId))
            participants.Add(r.AuthorId);
        participants.Remove(authorId);              // don't notify self

        var payloadJson = JsonSerializer.Serialize(new
        {
            topicId,
            replyId = newReply.Id,
        });
        foreach (var participantId in participants)
        {
            await _producer.ProduceAsync(
                recipientUserId: participantId,
                type: NotificationType.ForumReplyToThread,
                actorId: authorId,
                payloadJson: payloadJson,
                sourceEventId: newReply.Id);
        }
    }
}
```

(`GetRepliesAsyncInternal` — use whatever existing method returns the replies for the topic; the actual name in the codebase may differ. Read the file first.)

- [ ] **Step 4: Update `AzureForumService.CreateReplyAsync`**

Mirror Step 3 — constructor + producer field + analogous logic. Azure version queries the `forumreplies` table partition for participants.

- [ ] **Step 5: Update `CachingForumService` to pass-through the new constructor param**

`CachingForumService` wraps another `IForumService`. It doesn't interact with the producer directly — the inner service does. Just update the ctor to accept the inner reference (no producer at the cache layer).

If `CachingForumService` already takes `IForumService inner` only, no change needed beyond verifying it still compiles.

- [ ] **Step 6: Update DI in `Program.cs`**

```csharp
// Mock branch:
builder.Services.AddSingleton<IForumService>(sp =>
    new CachingForumService(
        new MockForumService(sp.GetRequiredService<INotificationProducer>()),
        sp.GetRequiredService<IMemoryCache>()));

// Azure branch (mirror):
builder.Services.AddSingleton<IForumService>(sp =>
    new CachingForumService(
        new AzureForumService(
            /* existing args */,
            sp.GetRequiredService<INotificationProducer>()),
        sp.GetRequiredService<IMemoryCache>()));
```

Adjust the inner constructor args to match existing.

- [ ] **Step 7: Run tests**

Expected: 3 new tests pass; previous tests still pass.

- [ ] **Step 8: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/MockForumService.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs' 'Lovecraft/Lovecraft.Backend/Services/Caching/CachingForumService.cs' 'Lovecraft/Lovecraft.Backend/Program.cs' 'Lovecraft/Lovecraft.UnitTests/ForumTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: wire ForumReplyToThread producer (thread-participant fanout)"
```

---

## Task 4: Backend verification

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: 343 (Phase A) + 4 (Task 1) + 3 (Task 2) + 3 (Task 3) = 353 tests, all passing.

- [ ] **Step 2: Smoke-test in API mock mode (optional)**

```
dotnet run --project 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj'
```

In another shell:
- Log in as `test@example.com` / `Test123!@#`, capture token
- POST a like to another user
- GET `/api/v1/notifications` — should see one row for that like (provided you logged in as the recipient — easier: use two users)

Stop the backend (Ctrl+C).

- [ ] **Step 3: No commit needed — verification only.**

---

## Task 5: Frontend types and notification API service

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\types\notification.ts`
- Create: `D:\src\aloevera-harmony-meet\src\services\api\notificationsApi.ts`
- Create: `D:\src\aloevera-harmony-meet\src\services\api\pushApi.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\index.ts`
- Create: `D:\src\aloevera-harmony-meet\src\services\api\__tests__\notificationsApi.test.ts`

- [ ] **Step 1: Write `src/types/notification.ts`**

```typescript
export type NotificationType =
  | 'likeReceived'
  | 'matchCreated'
  | 'messageReceived'
  | 'forumReplyToThread'
  | 'communityBroadcast'
  | 'eventPublished'
  | 'eventReminder'
  | 'eventInviteReceived'
  | 'rankUp';

export type NotificationChannel = 'inApp' | 'telegram' | 'webPush' | 'email';

export type NotificationFrequency = 'immediate' | 'hourly' | 'daily';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  payloadJson: string;
  createdAtUtc: string;          // ISO 8601
  readAtUtc?: string | null;
  dismissedAtUtc?: string | null;
  digestGroupId?: string | null;
}

export interface NotificationListResponse {
  items: Notification[];
  nextCursor?: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export type NotificationMatrix = Record<NotificationType, Record<NotificationChannel, boolean>>;
export type NotificationFrequencyMap = Record<NotificationChannel, NotificationFrequency>;

export interface NotificationPreferences {
  matrix: NotificationMatrix;
  frequency: NotificationFrequencyMap;
  dailyDigestHourUtc: number;
  mute: boolean;
  mutedUntilUtc?: string | null;
}

export interface WebPushSubscription {
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  createdAtUtc: string;
  lastSeenAtUtc: string;
}

export interface WebPushSubscriptionRequest {
  deviceId?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}
```

- [ ] **Step 2: Write `src/services/api/notificationsApi.ts`**

Follow the same dual-mode pattern as `eventsApi.ts` etc. — `isApiMode()` check returns mock data, else real HTTP.

```typescript
import { apiClient } from './apiClient';
import { isApiMode } from '@/config/api.config';
import type {
  Notification, NotificationListResponse, UnreadCountResponse,
  NotificationPreferences,
} from '@/types/notification';

const mockNotifications: Notification[] = [];          // mock mode: empty by default

function buildDefaultPrefs(): NotificationPreferences {
  const types: Notification['type'][] = [
    'likeReceived', 'matchCreated', 'messageReceived', 'forumReplyToThread',
    'communityBroadcast', 'eventPublished', 'eventReminder', 'eventInviteReceived', 'rankUp',
  ];
  const matrix = Object.fromEntries(types.map(t => [t, {
    inApp: true, telegram: false, webPush: false, email: false,
  }])) as NotificationPreferences['matrix'];
  return {
    matrix,
    frequency: { inApp: 'immediate', telegram: 'immediate', webPush: 'immediate', email: 'daily' },
    dailyDigestHourUtc: 9,
    mute: false,
    mutedUntilUtc: null,
  };
}

let mockPrefs: NotificationPreferences = buildDefaultPrefs();

export const notificationsApi = {
  async list(cursor?: string, limit = 20) {
    if (!isApiMode()) {
      return { success: true, data: { items: mockNotifications.slice(0, limit), nextCursor: null } as NotificationListResponse };
    }
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    qs.set('limit', String(limit));
    return apiClient.get<NotificationListResponse>(`/api/v1/notifications?${qs}`);
  },

  async unreadCount() {
    if (!isApiMode()) return { success: true, data: { count: 0 } as UnreadCountResponse };
    return apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  },

  async markRead(id: string) {
    if (!isApiMode()) {
      const n = mockNotifications.find(x => x.id === id);
      if (n) n.readAtUtc = new Date().toISOString();
      return { success: true };
    }
    return apiClient.post(`/api/v1/notifications/${id}/read`);
  },

  async markAllRead() {
    if (!isApiMode()) {
      const now = new Date().toISOString();
      mockNotifications.forEach(n => { if (!n.readAtUtc) n.readAtUtc = now; });
      return { success: true, data: { updated: mockNotifications.length } };
    }
    return apiClient.post('/api/v1/notifications/mark-all-read');
  },

  async dismiss(id: string) {
    if (!isApiMode()) {
      const n = mockNotifications.find(x => x.id === id);
      if (n) n.dismissedAtUtc = new Date().toISOString();
      return { success: true };
    }
    return apiClient.delete(`/api/v1/notifications/${id}`);
  },

  async getPreferences() {
    if (!isApiMode()) return { success: true, data: { ...mockPrefs } };
    return apiClient.get<NotificationPreferences>('/api/v1/notifications/preferences');
  },

  async updatePreferences(prefs: NotificationPreferences) {
    if (!isApiMode()) { mockPrefs = { ...prefs }; return { success: true, data: { ...mockPrefs } }; }
    return apiClient.put<NotificationPreferences>('/api/v1/notifications/preferences', prefs);
  },
};
```

- [ ] **Step 3: Write `src/services/api/pushApi.ts`**

```typescript
import { apiClient } from './apiClient';
import { isApiMode } from '@/config/api.config';
import type { WebPushSubscription, WebPushSubscriptionRequest } from '@/types/notification';

export const pushApi = {
  async getVapidPublicKey() {
    if (!isApiMode()) return { success: true, data: { publicKey: '' } };
    return apiClient.get<{ publicKey: string }>('/api/v1/push/vapid-public-key');
  },

  async subscribe(req: WebPushSubscriptionRequest) {
    if (!isApiMode()) return { success: true, data: { ...req, deviceId: req.deviceId ?? crypto.randomUUID(), createdAtUtc: new Date().toISOString(), lastSeenAtUtc: new Date().toISOString() } as WebPushSubscription };
    return apiClient.post<WebPushSubscription>('/api/v1/push/subscribe', req);
  },

  async unsubscribe(deviceId: string) {
    if (!isApiMode()) return { success: true };
    return apiClient.delete(`/api/v1/push/subscribe/${deviceId}`);
  },
};
```

Note: `GET /api/v1/push/vapid-public-key` was listed in the spec but NOT in Phase A's controller — Phase E creates it. Return empty in Phase B; UI uses this only to detect "Web Push configured" — empty = "not configured yet".

- [ ] **Step 4: Update `src/services/api/index.ts`**

Add the two exports:
```typescript
export { notificationsApi } from './notificationsApi';
export { pushApi } from './pushApi';
```

- [ ] **Step 5: Write the failing tests**

`src/services/api/__tests__/notificationsApi.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationsApi } from '../notificationsApi';

vi.mock('@/config/api.config', () => ({ isApiMode: () => false }));

describe('notificationsApi (mock mode)', () => {
  it('list returns empty by default', async () => {
    const result = await notificationsApi.list();
    expect(result.success).toBe(true);
    expect(result.data?.items).toEqual([]);
    expect(result.data?.nextCursor).toBeNull();
  });

  it('unreadCount returns zero by default', async () => {
    const result = await notificationsApi.unreadCount();
    expect(result.data?.count).toBe(0);
  });

  it('getPreferences returns default matrix with inApp=true for every type', async () => {
    const result = await notificationsApi.getPreferences();
    expect(result.success).toBe(true);
    const prefs = result.data!;
    expect(prefs.matrix.likeReceived.inApp).toBe(true);
    expect(prefs.matrix.likeReceived.telegram).toBe(false);
    expect(prefs.dailyDigestHourUtc).toBe(9);
    expect(prefs.frequency.email).toBe('daily');
    expect(prefs.frequency.inApp).toBe('immediate');
  });

  it('updatePreferences round-trips', async () => {
    const result = await notificationsApi.getPreferences();
    const prefs = result.data!;
    prefs.matrix.likeReceived.telegram = true;
    prefs.dailyDigestHourUtc = 18;
    await notificationsApi.updatePreferences(prefs);
    const result2 = await notificationsApi.getPreferences();
    expect(result2.data?.matrix.likeReceived.telegram).toBe(true);
    expect(result2.data?.dailyDigestHourUtc).toBe(18);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

```
npx vitest run 'src/services/api/__tests__/notificationsApi.test.ts'
```
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/types/notification.ts' 'src/services/api/notificationsApi.ts' 'src/services/api/pushApi.ts' 'src/services/api/index.ts' 'src/services/api/__tests__/notificationsApi.test.ts'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: types + notificationsApi + pushApi services"
```

---

## Task 6: Add Zustand store

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\package.json` (add zustand dep)
- Create: `D:\src\aloevera-harmony-meet\src\stores\notificationStore.ts`
- Create: `D:\src\aloevera-harmony-meet\src\stores\__tests__\notificationStore.test.ts`

`AGENTS.md` notes that adding new deps without discussion is discouraged. Zustand is the project's already-planned global-state direction (TD.3 explicitly mentions it as the recommendation). Adding it here is consistent.

- [ ] **Step 1: Install zustand**

```bash
cd 'D:\src\aloevera-harmony-meet'
npm install zustand
```

Verify `package.json` now has `"zustand": "^4.5.x"` (or whatever installs) in `dependencies`.

- [ ] **Step 2: Write the failing tests**

`src/stores/__tests__/notificationStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../notificationStore';
import type { Notification } from '@/types/notification';

const makeNotif = (id: string, read = false): Notification => ({
  id, userId: 'me', type: 'likeReceived', payloadJson: '{}',
  createdAtUtc: new Date().toISOString(),
  readAtUtc: read ? new Date().toISOString() : null,
});

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0 });
  });

  it('addNotification prepends and bumps unread count when unread', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n2'));
    const s = useNotificationStore.getState();
    expect(s.items.length).toBe(2);
    expect(s.items[0].id).toBe('n2');          // newest first
    expect(s.unreadCount).toBe(2);
  });

  it('addNotification dedupes by id', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    expect(useNotificationStore.getState().items.length).toBe(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('markRead sets readAtUtc and decrements unreadCount', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().markRead('n1');
    const s = useNotificationStore.getState();
    expect(s.items[0].readAtUtc).toBeTruthy();
    expect(s.unreadCount).toBe(0);
  });

  it('markRead is idempotent', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1', true));
    useNotificationStore.getState().markRead('n1');
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('markAllRead zeroes unreadCount', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n2'));
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('dismiss removes from items', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().dismiss('n1');
    expect(useNotificationStore.getState().items.length).toBe(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('setUnreadCount overrides count from server', () => {
    useNotificationStore.getState().setUnreadCount(7);
    expect(useNotificationStore.getState().unreadCount).toBe(7);
  });

  it('setItems replaces list', () => {
    useNotificationStore.getState().setItems([makeNotif('a'), makeNotif('b', true)]);
    const s = useNotificationStore.getState();
    expect(s.items.length).toBe(2);
    expect(s.unreadCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

```
npx vitest run 'src/stores/__tests__/notificationStore.test.ts'
```
Expected: import fails — store doesn't exist.

- [ ] **Step 4: Write the store**

`src/stores/notificationStore.ts`:

```typescript
import { create } from 'zustand';
import type { Notification } from '@/types/notification';

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  setUnreadCount: (count: number) => void;
  setItems: (items: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  addNotification: (n) => set((state) => {
    if (state.items.some(x => x.id === n.id)) return state;
    const isUnread = !n.readAtUtc;
    return {
      items: [n, ...state.items].slice(0, 50),               // cap at 50 for memory
      unreadCount: state.unreadCount + (isUnread ? 1 : 0),
    };
  }),
  markRead: (id) => set((state) => {
    const target = state.items.find(n => n.id === id);
    if (!target || target.readAtUtc) return state;
    return {
      items: state.items.map(n => n.id === id ? { ...n, readAtUtc: new Date().toISOString() } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    };
  }),
  markAllRead: () => set((state) => ({
    items: state.items.map(n => n.readAtUtc ? n : { ...n, readAtUtc: new Date().toISOString() }),
    unreadCount: 0,
  })),
  dismiss: (id) => set((state) => {
    const target = state.items.find(n => n.id === id);
    const wasUnread = target && !target.readAtUtc;
    return {
      items: state.items.filter(n => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
    };
  }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setItems: (items) => set({
    items,
    unreadCount: items.filter(n => !n.readAtUtc && !n.dismissedAtUtc).length,
  }),
}));
```

- [ ] **Step 5: Run tests**

Expected: 8/8 pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'package.json' 'package-lock.json' 'src/stores/notificationStore.ts' 'src/stores/__tests__/notificationStore.test.ts'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: zustand store with add/markRead/dismiss + tests"
```

(Add `bun.lockb`/`bun.lock` to the `git add` if bun is the active package manager — check whichever lockfile changed.)

---

## Task 7: SignalR `NotificationReceived` hook

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\hooks\useNotificationSignalR.ts`
- Create: `D:\src\aloevera-harmony-meet\src\hooks\__tests__\useNotificationSignalR.test.tsx`

`chatConnection` already has a generic `on/off` API from Phase A. This hook subscribes once and pipes events into the store.

- [ ] **Step 1: Write the failing test**

`src/hooks/__tests__/useNotificationSignalR.test.tsx`:

```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotificationSignalR } from '../useNotificationSignalR';
import { useNotificationStore } from '@/stores/notificationStore';

const onHandlers: Record<string, ((data: unknown) => void)[]> = {};

vi.mock('@/services/signalr/chatConnection', () => ({
  chatConnection: {
    on: (event: string, cb: (data: unknown) => void) => {
      onHandlers[event] ??= [];
      onHandlers[event].push(cb);
      return () => {
        onHandlers[event] = onHandlers[event].filter(h => h !== cb);
      };
    },
    off: () => {},
  },
}));

describe('useNotificationSignalR', () => {
  beforeEach(() => {
    Object.keys(onHandlers).forEach(k => onHandlers[k] = []);
    useNotificationStore.setState({ items: [], unreadCount: 0 });
  });

  it('incoming NotificationReceived adds to store', () => {
    renderHook(() => useNotificationSignalR());

    const handlers = onHandlers['NotificationReceived'] ?? [];
    expect(handlers.length).toBe(1);

    handlers[0]!({
      id: 'n1', userId: 'me', type: 'likeReceived',
      payloadJson: '{}', createdAtUtc: new Date().toISOString(),
    });

    const s = useNotificationStore.getState();
    expect(s.items.length).toBe(1);
    expect(s.unreadCount).toBe(1);
  });

  it('cleanup unsubscribes', () => {
    const { unmount } = renderHook(() => useNotificationSignalR());
    expect(onHandlers['NotificationReceived'].length).toBe(1);
    unmount();
    expect(onHandlers['NotificationReceived'].length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run 'src/hooks/__tests__/useNotificationSignalR.test.tsx'
```
Expected: import error.

- [ ] **Step 3: Write the hook**

`src/hooks/useNotificationSignalR.ts`:

```typescript
import { useEffect } from 'react';
import { chatConnection } from '@/services/signalr/chatConnection';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types/notification';

/**
 * Subscribes to `NotificationReceived` on the SignalR hub and pipes events into the store.
 * Mount once at the top of the authenticated tree (e.g. inside ProtectedRoute children).
 */
export function useNotificationSignalR() {
  const addNotification = useNotificationStore(s => s.addNotification);

  useEffect(() => {
    return chatConnection.on('NotificationReceived', (data: unknown) => {
      addNotification(data as Notification);
    });
  }, [addNotification]);
}
```

`chatConnection.on` returns a cleanup function in Phase A's contract. If it doesn't (verify by reading `src/services/signalr/chatConnection.ts`), wrap appropriately — possibly call `chatConnection.off('NotificationReceived', handler)` in cleanup.

- [ ] **Step 4: Run tests**

Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/hooks/useNotificationSignalR.ts' 'src/hooks/__tests__/useNotificationSignalR.test.tsx'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: useNotificationSignalR hook pipes events to store"
```

---

## Task 8: Notification formatting helpers

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\lib\notificationFormatting.ts`
- Create: `D:\src\aloevera-harmony-meet\src\lib\__tests__\notificationFormatting.test.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\contexts\LanguageContext.tsx` (+ ~25 translation keys)

`formatNotificationTitle(n, t)` returns the one-line title for a notification (e.g. "Anna liked you", "New message from Anna").
`formatNotificationLink(n)` returns the navigation target (e.g. `/talks` for forum replies, `/friends?userId=…` for likes, etc.).
`relativeTime(date)` is a small wrapper around `formatDistanceToNow` from `date-fns`.

- [ ] **Step 1: Add translation keys to `LanguageContext.tsx`**

Read the file. Append these keys to both `ru` and `en` blocks (use natural Russian translations for `ru`):

| Key | English | Russian |
|---|---|---|
| `notifications.bell` | `Notifications` | `Уведомления` |
| `notifications.markAllRead` | `Mark all as read` | `Отметить все прочитанными` |
| `notifications.seeAll` | `See all` | `Все уведомления` |
| `notifications.empty` | `No notifications yet` | `Уведомлений пока нет` |
| `notifications.unread` | `Unread` | `Непрочитанные` |
| `notifications.all` | `All` | `Все` |
| `notifications.dismiss` | `Dismiss` | `Скрыть` |
| `notifications.title.likeReceived` | `{actor} liked you` | `{actor} лайкнул(а) вас` |
| `notifications.title.likeReceivedAnonymous` | `Someone liked you` | `Кто-то лайкнул вас` |
| `notifications.title.matchCreated` | `New match with {actor}` | `Взаимная симпатия с {actor}` |
| `notifications.title.messageReceived` | `{actor}: {preview}` | `{actor}: {preview}` |
| `notifications.title.forumReply` | `{actor} replied in a thread` | `{actor} ответил(а) в обсуждении` |
| `notifications.title.communityBroadcast` | `{title}` | `{title}` |
| `notifications.title.eventPublished` | `New event: {title}` | `Новое событие: {title}` |
| `notifications.title.eventReminder` | `Event tomorrow: {title}` | `Завтра: {title}` |
| `notifications.title.eventInvite` | `You're invited: {title}` | `Вас пригласили: {title}` |
| `notifications.title.rankUp` | `You're now {rank}!` | `Новый ранг: {rank}!` |
| `notifications.settings.title` | `Notifications` | `Уведомления` |
| `notifications.settings.pauseAll` | `Pause all notifications` | `Отключить все уведомления` |
| `notifications.settings.snoozeFor` | `Snooze for` | `Тишина на` |
| `notifications.settings.snoozeNever` | `Never` | `Не активна` |
| `notifications.settings.snooze1h` | `1 hour` | `1 час` |
| `notifications.settings.snooze4h` | `4 hours` | `4 часа` |
| `notifications.settings.snooze24h` | `24 hours` | `24 часа` |
| `notifications.settings.dailyHour` | `Daily digest hour (UTC)` | `Ежедневная рассылка (UTC)` |
| `notifications.settings.channel.inApp` | `In-app` | `В приложении` |
| `notifications.settings.channel.telegram` | `Telegram` | `Telegram` |
| `notifications.settings.channel.webPush` | `Browser push` | `Уведомления браузера` |
| `notifications.settings.channel.email` | `Email` | `Email` |
| `notifications.settings.frequency.immediate` | `Immediate` | `Сразу` |
| `notifications.settings.frequency.hourly` | `Hourly digest` | `Раз в час` |
| `notifications.settings.frequency.daily` | `Daily digest` | `Раз в день` |
| `notifications.settings.unavailable.telegram` | `Link your Telegram account to enable` | `Привяжите Telegram, чтобы включить` |
| `notifications.settings.unavailable.webPush` | `Enable on this device` | `Включить на этом устройстве` |
| `notifications.settings.unavailable.email` | `Verify your email to enable` | `Подтвердите email, чтобы включить` |

- [ ] **Step 2: Write the failing tests**

`src/lib/__tests__/notificationFormatting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatNotificationTitle, formatNotificationLink } from '../notificationFormatting';
import type { Notification } from '@/types/notification';

const t = (key: string, params?: Record<string, string>) => {
  let s = key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
  return s;
};

const baseNotif = (overrides: Partial<Notification>): Notification => ({
  id: 'n', userId: 'me', type: 'likeReceived', payloadJson: '{}',
  createdAtUtc: new Date().toISOString(),
  ...overrides,
});

describe('formatNotificationTitle', () => {
  it('like received with actor name', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'likeReceived', actorName: 'Anna',
      payloadJson: JSON.stringify({ anonymous: false }),
    }), t);
    expect(title).toContain('Anna');
    expect(title).toContain('liked');
  });

  it('anonymous like omits name', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'likeReceived', actorName: null,
      payloadJson: JSON.stringify({ anonymous: true }),
    }), t);
    expect(title).toContain('Someone');
  });

  it('message with preview', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'messageReceived', actorName: 'Anna',
      payloadJson: JSON.stringify({ chatId: 'c1', messageId: 'm1', preview: 'hello' }),
    }), t);
    expect(title).toContain('Anna');
    expect(title).toContain('hello');
  });
});

describe('formatNotificationLink', () => {
  it('message links to /talks (for now — chats UI lives there)', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'messageReceived',
      payloadJson: JSON.stringify({ chatId: 'c1' }),
    }))).toBe('/talks?chat=c1');
  });

  it('like links to /friends with userId', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'likeReceived', actorId: 'u-actor',
      payloadJson: JSON.stringify({ anonymous: false }),
    }))).toBe('/friends?userId=u-actor');
  });

  it('anonymous like links to /friends (no userId)', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'likeReceived', actorId: null,
      payloadJson: JSON.stringify({ anonymous: true }),
    }))).toBe('/friends');
  });

  it('forum reply links to topic via /talks', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'forumReplyToThread',
      payloadJson: JSON.stringify({ topicId: 't1', replyId: 'r1' }),
    }))).toBe('/talks?topic=t1');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run 'src/lib/__tests__/notificationFormatting.test.ts'
```
Expected: import error.

- [ ] **Step 4: Write the helpers**

`src/lib/notificationFormatting.ts`:

```typescript
import type { Notification } from '@/types/notification';

type TFunc = (key: string, params?: Record<string, string>) => string;

export function formatNotificationTitle(n: Notification, t: TFunc): string {
  const actor = n.actorName ?? '';
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(n.payloadJson); } catch { /* keep empty */ }

  switch (n.type) {
    case 'likeReceived':
      return payload.anonymous
        ? t('notifications.title.likeReceivedAnonymous')
        : t('notifications.title.likeReceived', { actor });
    case 'matchCreated':
      return t('notifications.title.matchCreated', { actor });
    case 'messageReceived':
      return t('notifications.title.messageReceived', {
        actor,
        preview: String(payload.preview ?? ''),
      });
    case 'forumReplyToThread':
      return t('notifications.title.forumReply', { actor });
    case 'communityBroadcast':
      return t('notifications.title.communityBroadcast', { title: String(payload.title ?? '') });
    case 'eventPublished':
      return t('notifications.title.eventPublished', { title: String(payload.eventTitle ?? '') });
    case 'eventReminder':
      return t('notifications.title.eventReminder', { title: String(payload.eventTitle ?? '') });
    case 'eventInviteReceived':
      return t('notifications.title.eventInvite', { title: String(payload.eventTitle ?? '') });
    case 'rankUp':
      return t('notifications.title.rankUp', { rank: String(payload.newRank ?? '') });
    default:
      return n.type;
  }
}

export function formatNotificationLink(n: Notification): string {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(n.payloadJson); } catch { /* keep empty */ }

  switch (n.type) {
    case 'likeReceived':
    case 'matchCreated':
      return n.actorId ? `/friends?userId=${n.actorId}` : '/friends';
    case 'messageReceived':
      return `/talks?chat=${payload.chatId ?? ''}`;
    case 'forumReplyToThread':
      return `/talks?topic=${payload.topicId ?? ''}`;
    case 'eventPublished':
    case 'eventReminder':
    case 'eventInviteReceived':
      return payload.eventId ? `/aloevera/events/${payload.eventId}` : '/aloevera';
    case 'communityBroadcast':
      return typeof payload.link === 'string' ? payload.link : '/aloevera';
    case 'rankUp':
      return '/settings';
    default:
      return '/friends';
  }
}
```

- [ ] **Step 5: Run tests**

Expected: 7/7 pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/lib/notificationFormatting.ts' 'src/lib/__tests__/notificationFormatting.test.ts' 'src/contexts/LanguageContext.tsx'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: formatting helpers + i18n keys"
```

---

## Task 9: `<NotificationBell>` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\notifications\notificationIcons.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\notifications\NotificationItem.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\notifications\NotificationDropdown.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\notifications\NotificationBell.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\notifications\__tests__\NotificationBell.test.tsx`

The bell renders an icon + unread badge. Click opens a `Popover` (desktop) or `Sheet` (mobile) showing 10 most recent notifications. Live-updates via the store.

- [ ] **Step 1: Write `notificationIcons.tsx`**

```typescript
import { Heart, Users, MessageSquare, MessageCircle, Megaphone, Calendar, Bell, Star, Award } from 'lucide-react';
import type { NotificationType } from '@/types/notification';
import type { LucideIcon } from 'lucide-react';

export const notificationIcons: Record<NotificationType, LucideIcon> = {
  likeReceived: Heart,
  matchCreated: Users,
  messageReceived: MessageSquare,
  forumReplyToThread: MessageCircle,
  communityBroadcast: Megaphone,
  eventPublished: Calendar,
  eventReminder: Bell,
  eventInviteReceived: Star,
  rankUp: Award,
};
```

- [ ] **Step 2: Write `NotificationItem.tsx`**

```typescript
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { formatNotificationTitle, formatNotificationLink } from '@/lib/notificationFormatting';
import { notificationIcons } from './notificationIcons';
import type { Notification } from '@/types/notification';

interface NotificationItemProps {
  notification: Notification;
  onClickHandled?: () => void;
}

export function NotificationItem({ notification, onClickHandled }: NotificationItemProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const markRead = useNotificationStore((s) => s.markRead);
  const Icon = notificationIcons[notification.type];
  const title = formatNotificationTitle(notification, t);
  const link = formatNotificationLink(notification);
  const isUnread = !notification.readAtUtc;

  const handleClick = async () => {
    if (isUnread) {
      markRead(notification.id);
      await notificationsApi.markRead(notification.id);
    }
    onClickHandled?.();
    navigate(link);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left flex gap-3 p-3 hover:bg-accent transition-colors',
        isUnread && 'bg-accent/40'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAtUtc), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
    </button>
  );
}
```

- [ ] **Step 3: Write `NotificationDropdown.tsx`**

```typescript
import { Link } from 'react-router-dom';
import { useNotificationStore } from '@/stores/notificationStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { notificationsApi } from '@/services/api';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface NotificationDropdownProps {
  onItemClick?: () => void;
}

export function NotificationDropdown({ onItemClick }: NotificationDropdownProps) {
  const { t } = useLanguage();
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const handleMarkAllRead = async () => {
    markAllRead();
    await notificationsApi.markAllRead();
  };

  const visible = items.slice(0, 10);

  return (
    <div className="w-80 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{t('notifications.bell')}</h3>
        <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs h-auto p-1">
          {t('notifications.markAllRead')}
        </Button>
      </div>
      {visible.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {t('notifications.empty')}
        </div>
      ) : (
        <div className="divide-y">
          {visible.map((n) => (
            <NotificationItem key={n.id} notification={n} onClickHandled={onItemClick} />
          ))}
        </div>
      )}
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link to="/notifications" onClick={onItemClick}>{t('notifications.seeAll')}</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `NotificationBell.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setItems = useNotificationStore((s) => s.setItems);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // Hydrate store on mount
  useEffect(() => {
    notificationsApi.list().then(r => { if (r.success && r.data) setItems(r.data.items); });
    notificationsApi.unreadCount().then(r => { if (r.success && r.data) setUnreadCount(r.data.count); });
  }, [setItems, setUnreadCount]);

  const badge = (
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{badge}</SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-96 p-0">
          <NotificationDropdown onItemClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-80">
        <NotificationDropdown onItemClick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 5: Write the bell tests**

`src/components/notifications/__tests__/NotificationBell.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationBell } from '../NotificationBell';
import { useNotificationStore } from '@/stores/notificationStore';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/services/api', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: { items: [], nextCursor: null } }),
    unreadCount: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
    markAllRead: vi.fn().mockResolvedValue({ success: true }),
    markRead: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

describe('NotificationBell', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0 });
  });

  it('renders bell with no badge when unread=0', () => {
    renderWithProviders(<NotificationBell />);
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.queryByText(/^[0-9+]+$/)).not.toBeInTheDocument();
  });

  it('renders badge with count', () => {
    useNotificationStore.setState({ unreadCount: 3 });
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps badge at 9+', () => {
    useNotificationStore.setState({ unreadCount: 42 });
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('clicking opens dropdown showing empty state', async () => {
    renderWithProviders(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(screen.getByText(/notifications.empty/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests**

```
npx vitest run 'src/components/notifications/__tests__/NotificationBell.test.tsx'
```
Expected: 4/4 pass.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/components/notifications/'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: NotificationBell + Dropdown + Item components"
```

---

## Task 10: Mount the bell in headers + add `/notifications` route

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Friends.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Talks.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\AloeVera.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\SettingsPage.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\App.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\pages\Notifications.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\components\ProtectedRoute.tsx` (call `useNotificationSignalR` at the auth-gated tree root)

- [ ] **Step 1: Add the SignalR subscription to ProtectedRoute**

`ProtectedRoute.tsx` is the natural mount point — it wraps every authenticated page. Add `useNotificationSignalR()` inside its rendered tree (not the guard logic itself; the user must be auth'd first).

Find the place where `ProtectedRoute` renders `{children}` (after the auth check passes). Add a wrapper component or call the hook inline:

```typescript
import { useNotificationSignalR } from '@/hooks/useNotificationSignalR';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  useNotificationSignalR();
  return <>{children}</>;
}

// In ProtectedRoute render, after auth passes:
return <ProtectedContent>{children}</ProtectedContent>;
```

(Adjust to match the actual `ProtectedRoute` structure — read the file first.)

- [ ] **Step 2: Add `<NotificationBell />` to four page headers**

Locate the sticky header `<div className="sticky top-0 ...">` in each of `Friends.tsx`, `Talks.tsx`, `AloeVera.tsx`, `SettingsPage.tsx`. Add `<NotificationBell />` at the right side of that header. Example placement:

```tsx
import { NotificationBell } from '@/components/notifications/NotificationBell';

// Inside the header:
<div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
  <div className="flex items-center justify-between p-4">
    <h1 className="text-xl font-bold">{t('friends.title')}</h1>
    <NotificationBell />
  </div>
  {/* existing tab bar etc. */}
</div>
```

The exact wrapping of the existing header varies per page — adapt to fit the existing layout without breaking visual hierarchy.

- [ ] **Step 3: Create `Notifications.tsx` page**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import BottomNavigation from '@/components/ui/bottom-navigation';
import type { Notification } from '@/types/notification';

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const items = useNotificationStore((s) => s.items);
  const setItems = useNotificationStore((s) => s.setItems);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    notificationsApi.list(undefined, 50).then((r) => {
      if (r.success && r.data) setItems(r.data.items as Notification[]);
      setIsLoading(false);
    });
  }, [setItems]);

  const visible = filter === 'unread' ? items.filter((n) => !n.readAtUtc) : items;

  const handleMarkAllRead = async () => {
    markAllRead();
    await notificationsApi.markAllRead();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">{t('notifications.bell')}</h1>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            {t('notifications.markAllRead')}
          </Button>
        </div>
        <div className="flex gap-2 px-4 pb-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            {t('notifications.all')}
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            {t('notifications.unread')}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground p-8">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">{t('notifications.empty')}</div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {visible.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
```

- [ ] **Step 4: Add `/notifications` route in `App.tsx`**

```tsx
import Notifications from '@/pages/Notifications';

// Inside <Routes>:
<Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
```

- [ ] **Step 5: Run frontend tests + build**

```
cd 'D:\src\aloevera-harmony-meet'
npm run test:run
npm run build
```
Expected: all tests pass; build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/components/ProtectedRoute.tsx' 'src/pages/Friends.tsx' 'src/pages/Talks.tsx' 'src/pages/AloeVera.tsx' 'src/pages/SettingsPage.tsx' 'src/pages/Notifications.tsx' 'src/App.tsx'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: mount bell in 4 page headers + /notifications route"
```

---

## Task 11: `<NotificationPreferences>` settings section

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\settings\NotificationPreferences.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\settings\__tests__\NotificationPreferences.test.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\SettingsPage.tsx`

The section is an accordion. Master mute toggle + snooze dropdown at the top. Four channel blocks (in-app, Telegram, browser push, email) — each with a header chip showing availability, a frequency selector (only for Telegram and email — in-app and webPush are locked to immediate), and a grid of 9 type toggles. Daily digest hour picker visible only when any channel uses daily frequency. Save button at the bottom commits to the API.

- [ ] **Step 1: Write the failing tests**

`src/components/settings/__tests__/NotificationPreferences.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPreferences } from '../NotificationPreferences';
import { renderWithProviders } from '@/test/utils';
import type { NotificationPreferences as Prefs } from '@/types/notification';

const defaultPrefs: Prefs = {
  matrix: {
    likeReceived: { inApp: true, telegram: false, webPush: false, email: false },
    matchCreated: { inApp: true, telegram: false, webPush: false, email: false },
    messageReceived: { inApp: true, telegram: false, webPush: false, email: false },
    forumReplyToThread: { inApp: true, telegram: false, webPush: false, email: false },
    communityBroadcast: { inApp: true, telegram: false, webPush: false, email: false },
    eventPublished: { inApp: true, telegram: false, webPush: false, email: false },
    eventReminder: { inApp: true, telegram: false, webPush: false, email: false },
    eventInviteReceived: { inApp: true, telegram: false, webPush: false, email: false },
    rankUp: { inApp: true, telegram: false, webPush: false, email: false },
  },
  frequency: { inApp: 'immediate', telegram: 'immediate', webPush: 'immediate', email: 'daily' },
  dailyDigestHourUtc: 9,
  mute: false,
  mutedUntilUtc: null,
};

const mockUpdate = vi.fn();
vi.mock('@/services/api', () => ({
  notificationsApi: {
    getPreferences: vi.fn().mockResolvedValue({ success: true, data: defaultPrefs }),
    updatePreferences: (...args: unknown[]) => mockUpdate(...args).then(() => ({ success: true, data: args[0] })),
  },
}));

describe('NotificationPreferences', () => {
  beforeEach(() => mockUpdate.mockClear().mockResolvedValue({ success: true }));

  it('renders four channel blocks', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={false} emailVerified={false} />);
    expect(await screen.findByText(/notifications.settings.channel.inApp/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.webPush/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.email/i)).toBeInTheDocument();
  });

  it('greys out telegram when not linked', async () => {
    const { container } = renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={true} emailVerified={true} />);
    await screen.findByText(/notifications.settings.channel.telegram/i);
    expect(container.querySelector('[data-channel="telegram"][data-disabled="true"]')).toBeInTheDocument();
  });

  it('shows daily digest hour picker when email frequency is daily', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} pushSubscribed={true} emailVerified={true} />);
    expect(await screen.findByText(/notifications.settings.dailyHour/i)).toBeInTheDocument();
  });

  it('save calls updatePreferences with current matrix', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} pushSubscribed={true} emailVerified={true} />);
    await screen.findByText(/notifications.settings.channel.inApp/i);
    const save = screen.getByRole('button', { name: /save/i });
    await userEvent.click(save);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```
npx vitest run 'src/components/settings/__tests__/NotificationPreferences.test.tsx'
```
Expected: import error.

- [ ] **Step 3: Write the component**

`src/components/settings/NotificationPreferences.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { notificationsApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';
import type {
  NotificationPreferences as Prefs,
  NotificationType,
  NotificationChannel,
  NotificationFrequency,
} from '@/types/notification';

interface Props {
  telegramLinked: boolean;
  pushSubscribed: boolean;
  emailVerified: boolean;
}

const TYPES: NotificationType[] = [
  'likeReceived', 'matchCreated', 'messageReceived', 'forumReplyToThread',
  'communityBroadcast', 'eventPublished', 'eventReminder', 'eventInviteReceived', 'rankUp',
];

const CHANNELS: NotificationChannel[] = ['inApp', 'telegram', 'webPush', 'email'];

const LOCKED_IMMEDIATE: NotificationChannel[] = ['inApp', 'webPush'];

export function NotificationPreferences({ telegramLinked, pushSubscribed, emailVerified }: Props) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationsApi.getPreferences().then((r) => {
      if (r.success && r.data) setPrefs(r.data);
    });
  }, []);

  if (!prefs) return <div>Loading…</div>;

  const channelAvailable: Record<NotificationChannel, boolean> = {
    inApp: true,
    telegram: telegramLinked,
    webPush: pushSubscribed,
    email: emailVerified,
  };

  const handleMatrixToggle = (type: NotificationType, channel: NotificationChannel) => {
    if (channel === 'inApp') return;     // in-app is locked on
    setPrefs({
      ...prefs,
      matrix: {
        ...prefs.matrix,
        [type]: { ...prefs.matrix[type], [channel]: !prefs.matrix[type][channel] },
      },
    });
  };

  const handleFrequencyChange = (channel: NotificationChannel, frequency: NotificationFrequency) => {
    setPrefs({ ...prefs, frequency: { ...prefs.frequency, [channel]: frequency } });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsApi.updatePreferences(prefs);
      toast.success('Preferences saved');
    } catch (err) {
      showApiError(err, 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const anyDaily = Object.values(prefs.frequency).includes('daily');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="mute-all">{t('notifications.settings.pauseAll')}</Label>
        <Switch
          id="mute-all"
          checked={prefs.mute}
          onCheckedChange={(v) => setPrefs({ ...prefs, mute: v })}
        />
      </div>

      {CHANNELS.map((channel) => (
        <div
          key={channel}
          data-channel={channel}
          data-disabled={!channelAvailable[channel]}
          className={cn('border rounded-lg p-4 space-y-3', !channelAvailable[channel] && 'opacity-50 pointer-events-none')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t(`notifications.settings.channel.${channel}`)}</h3>
            {!LOCKED_IMMEDIATE.includes(channel) && (
              <Select
                value={prefs.frequency[channel]}
                onValueChange={(v) => handleFrequencyChange(channel, v as NotificationFrequency)}
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">{t('notifications.settings.frequency.immediate')}</SelectItem>
                  <SelectItem value="hourly">{t('notifications.settings.frequency.hourly')}</SelectItem>
                  <SelectItem value="daily">{t('notifications.settings.frequency.daily')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            {TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between">
                <Label className="text-sm">{t(`notifications.title.${type === 'forumReplyToThread' ? 'forumReply' : type === 'eventInviteReceived' ? 'eventInvite' : type}`, { actor: '', preview: '', title: '', rank: '' })}</Label>
                <Switch
                  checked={prefs.matrix[type][channel]}
                  disabled={channel === 'inApp'}
                  onCheckedChange={() => handleMatrixToggle(type, channel)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {anyDaily && (
        <div className="flex items-center justify-between">
          <Label>{t('notifications.settings.dailyHour')}</Label>
          <Select
            value={String(prefs.dailyDigestHourUtc)}
            onValueChange={(v) => setPrefs({ ...prefs, dailyDigestHourUtc: Number(v) })}
          >
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>{i.toString().padStart(2, '0')}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">Save</Button>
    </div>
  );
}
```

- [ ] **Step 4: Mount in `SettingsPage.tsx`**

Find the existing accordion or sections layout. Add a new section labeled `t('notifications.settings.title')` rendering `<NotificationPreferences telegramLinked={...} pushSubscribed={...} emailVerified={...} />`.

For Phase B, derive props from the current user fetched in `useCurrentUser()`:
- `telegramLinked` = `!!user?.telegramUserId` (UserDto exposes it once Phase A's IUserService.GetNotificationContactStatusAsync flows through, but the public UserDto may not have it — see Note below)
- `pushSubscribed` = await `pushApi.subscribe`/list? For Phase B, since no push consumer exists, pass `false` always
- `emailVerified` = derive from current user; if `UserDto` doesn't expose it, pass `true` for Phase B (email channel toggles enabled visually; backend validator enforces the rest)

**Note on `UserDto` exposure:** Phase A intentionally did NOT add `TelegramLinked`/`EmailVerified` to `UserDto` — that state lives behind `IUserService.GetNotificationContactStatusAsync`. The frontend doesn't have a direct endpoint for that. For Phase B, the simplest path is: add a new `GET /api/v1/notifications/availability` endpoint returning `{ telegramLinked, emailVerified, webPushSubscribed }` — small backend addition. Alternatively, defer until Phase D when Telegram is wired (and the availability of the channel is meaningful). For Phase B, default to `false`/`false`/`false` and have the UI grey out all three non-in-app channels with CTAs.

**Recommended:** add the availability endpoint now (it's small) so the UI is responsive.

- [ ] **Step 5: Add availability endpoint (backend)**

In `NotificationsController.cs`, add:

```csharp
[HttpGet("notifications/availability")]
public async Task<ActionResult<ApiResponse<NotificationAvailabilityDto>>> GetAvailability()
{
    var status = await _userService.GetNotificationContactStatusAsync(UserId);
    var subCount = await _push.CountAsync(UserId);
    return Ok(ApiResponse<NotificationAvailabilityDto>.SuccessResponse(new NotificationAvailabilityDto
    {
        TelegramLinked = status.TelegramLinked,
        EmailVerified = status.EmailVerified,
        WebPushSubscribed = subCount > 0,
    }));
}
```

Inject `IUserService userService` into the controller (constructor). Create the DTO in `Lovecraft.Common.DTOs.Notifications.NotificationAvailabilityDto`:

```csharp
public class NotificationAvailabilityDto
{
    public bool TelegramLinked { get; set; }
    public bool EmailVerified { get; set; }
    public bool WebPushSubscribed { get; set; }
}
```

Add `getAvailability` to `notificationsApi` in `src/services/api/notificationsApi.ts`:

```typescript
// Add to types/notification.ts:
export interface NotificationAvailability {
  telegramLinked: boolean;
  emailVerified: boolean;
  webPushSubscribed: boolean;
}

// Add to notificationsApi:
async getAvailability() {
  if (!isApiMode()) {
    return { success: true, data: { telegramLinked: false, emailVerified: false, webPushSubscribed: false } as NotificationAvailability };
  }
  return apiClient.get<NotificationAvailability>('/api/v1/notifications/availability');
},
```

Frontend usage in `SettingsPage.tsx`:
```typescript
const [availability, setAvailability] = useState({ telegramLinked: false, emailVerified: false, webPushSubscribed: false });
useEffect(() => {
  notificationsApi.getAvailability().then(r => { if (r.success && r.data) setAvailability(r.data); });
}, []);

// Then:
<NotificationPreferences {...availability} pushSubscribed={availability.webPushSubscribed} />
```

- [ ] **Step 6: Run tests + build**

```
cd 'D:\src\aloevera-harmony-meet'
npm run test:run
npm run build

cd 'D:\src\lovecraft\Lovecraft'
dotnet build
dotnet test
```

Expected: all tests pass on both sides.

- [ ] **Step 7: Commit (split per repo)**

Backend:
```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Common/DTOs/Notifications/' 'Lovecraft/Lovecraft.Backend/Controllers/V1/NotificationsController.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: GET /notifications/availability endpoint"
```

Frontend:
```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/components/settings/' 'src/pages/SettingsPage.tsx' 'src/services/api/notificationsApi.ts' 'src/types/notification.ts'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: NotificationPreferences settings section + availability hookup"
```

---

## Task 12: Docs

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\NOTIFICATIONS.md` (append Phase B section)
- Modify: `D:\src\aloevera-harmony-meet\docs\FEATURES.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\API_INTEGRATION.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md` (update MCF.4 status)

- [ ] **Step 1: Append Phase B section to backend `NOTIFICATIONS.md`**

```markdown
## Phase B — shipped 2026-MM-DD

**Producer wiring** in 4 trigger sites:
- `MatchingService.CreateLikeAsync` (mock + Azure) — `LikeReceived` (non-mutual; honors `Settings.AnonymousLikes`); `MatchCreated` (mutual; fires to both users with stable `match-{lex}-{lex}` sourceEventId)
- `ChatsController.SendMessage` — `MessageReceived` for each non-sender chat participant; payload includes 80-char preview; `DerivePresenceGroup` auto-extracts `chat-{id}` for in-chat suppression
- `ForumService.CreateReplyAsync` (mock + Azure) — `ForumReplyToThread` to distinct thread participants (topic author + prior reply authors, deduped, minus self)

**New endpoint:** `GET /api/v1/notifications/availability` → `{ telegramLinked, emailVerified, webPushSubscribed }` for the frontend preferences UI.

**Frontend in-app** (in `aloevera-harmony-meet`):
- SignalR `NotificationReceived` event piped via `useNotificationSignalR` into a Zustand store
- `<NotificationBell>` mounted in 4 page headers (Friends, Talks, AloeVera, Settings)
- `/notifications` dedicated page with All/Unread filter
- `<NotificationPreferences>` accordion in Settings (matrix toggle + per-channel frequency + daily-hour picker + master mute)

**Still in mock-only / no-op for now:** Telegram dispatch (Phase D), Web Push dispatch (Phase E), Email digests (Phase F).

**Not yet wired:** `EventPublished`, `EventInviteReceived`, `CommunityBroadcast`, `EventReminder`, `RankUp` producers — Phases G/H.
```

- [ ] **Step 2: Add notifications section to frontend `FEATURES.md`**

Append section 10 covering notifications: bell, dropdown, /notifications page, preferences UI, default opt-in posture.

- [ ] **Step 3: Append to `API_INTEGRATION.md`**

Note the new `notificationsApi`, `pushApi`, `useNotificationSignalR`, `useNotificationStore`. Mention the dual-mode (mock returns empty, API hits real backend).

- [ ] **Step 4: Update `AGENTS.md`**

Add bullet under "State Management":
- Zustand: first concrete adoption (TD.3 progress). Used for notification store at `src/stores/notificationStore.ts`. Pattern: `useXxxStore` exported as a hook; selector functions (`s => s.unreadCount`) for re-render minimization.

Add bullet under "Component Patterns":
- Notification rendering: `formatNotificationTitle(n, t)` for the one-line text, `formatNotificationLink(n)` for the click target. Both in `src/lib/notificationFormatting.ts`. Add new notification types here when introducing them.

- [ ] **Step 5: Update `ISSUES.md`**

Change MCF.4's status header from "🟠 MCF.4. Notification System" to a partial line:
- "🟠 MCF.4. Notification System (partial — Phase A + B shipped; Telegram in C–F)"
- In the Resolution block, add "Phase A (foundations) and B (in-app + producers + UI) shipped 2026-05-18 and 2026-MM-DD respectively. Phases C–H pending."

- [ ] **Step 6: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase B summary"

git -C 'D:\src\aloevera-harmony-meet' add 'docs/FEATURES.md' 'docs/API_INTEGRATION.md' 'AGENTS.md' 'docs/ISSUES.md'
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase B (in-app + producers)"
```

---

## Task 13: Final verification

**Files:** none modified.

- [ ] **Step 1: Build backend + run full test suite**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --nologo
```
Expected: build clean; tests 353+ pass (343 Phase A + ~10 new from B).

- [ ] **Step 2: Build frontend + run tests**

```
cd 'D:\src\aloevera-harmony-meet'
npm run test:run
npm run build
```
Expected: all tests pass; build succeeds.

- [ ] **Step 3: End-to-end smoke test**

Start the backend (`dotnet run --project 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj'`) and the frontend (`npm run dev` from `D:\src\aloevera-harmony-meet`) in two shells.

- Open `http://localhost:8080`, log in as `test@example.com` / `Test123!@#`
- Open a second browser (incognito), log in as one of `user1@mock.local`–`user4@mock.local` (password `Seed123!@#`)
- From user1's browser, like `test@example.com`
- In test@example's tab, the bell should immediately show a `1` badge (via SignalR)
- Click the bell — see the LikeReceived row, click it → navigate to `/friends?userId=user1-mock-id`
- Send a like from `test@example.com` back to user1 → mutual; both browsers should get a MatchCreated notification
- Send a chat message between them → MessageReceived fires on the recipient unless they have the chat open (in-chat suppression)
- Reply on a forum topic the other user authored → ForumReplyToThread fires

Kill both processes.

- [ ] **Step 4: Marker commit on each repo**

```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase B complete"
git -C 'D:\src\aloevera-harmony-meet' commit --allow-empty -m "notifications: phase B complete"
```

---

## After Phase B

Merge both `feat/notifications-phase-b` branches to their respective `main`s, push.

Then move to Phase C (worker container scaffold) per the spec. The worker isn't required for in-app to function (which is what Phase B achieved); it's the prerequisite for Phases D–G.
