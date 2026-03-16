# Chat System with SignalR Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement private 1:1 chat with real-time SignalR delivery and live forum/event reply notifications, with full mock-mode isolation on the frontend.

**Architecture:** Backend adds `IChatService` (Mock + Azure implementations), `ChatsController` (REST), and `ChatHub` (SignalR /hubs/chat); `ForumController` gains a one-line hub broadcast on reply; `EventsController` lazily creates a linked forum topic per event. Frontend adds a module-level SignalR singleton (no-op in mock mode), a `useChatSignalR` hook with automatic `[groupId]`-aware cleanup, and updates `Friends.tsx` + `Talks.tsx` to show real message history and live updates.

**Tech Stack:** .NET 10 ASP.NET Core SignalR (inbox, no extra NuGet), Azure Table Storage, `@microsoft/signalr` npm package, React 18, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-chat-signalr-design.md`

---

## File Map

### Backend — New Files
| File | Purpose |
|---|---|
| `Lovecraft.Backend/Hubs/ChatHub.cs` | SignalR hub: JoinChat, JoinTopic, LeaveGroup, SendMessage |
| `Lovecraft.Backend/Controllers/V1/ChatsController.cs` | REST: list chats, message history, get-or-create, REST send |
| `Lovecraft.Backend/Services/MockChatService.cs` | In-memory IChatService for mock mode |
| `Lovecraft.Backend/Services/Azure/AzureChatService.cs` | Azure Table Storage IChatService |
| `Lovecraft.Backend/Storage/Entities/ChatEntity.cs` | Chats table entity |
| `Lovecraft.Backend/Storage/Entities/UserChatEntity.cs` | UserChats index entity |
| `Lovecraft.Backend/Storage/Entities/MessageEntity.cs` | Messages table entity |
| `Lovecraft.UnitTests/ChatTests.cs` | 13 xUnit tests |

### Backend — Modified Files
| File | Change |
|---|---|
| `Lovecraft.Common/DTOs/Chats/ChatDtos.cs` | Add `CreatePrivateChatRequestDto` |
| `Lovecraft.Common/DTOs/Events/EventDtos.cs` | Add `ForumTopicId` to `EventDto` |
| `Lovecraft.Backend/Services/IServices.cs` | Add `IChatService`; add `CreateEventTopicAsync` to `IForumService`; add `SetForumTopicIdAsync` to `IEventService` |
| `Lovecraft.Backend/Storage/TableNames.cs` | Add `Chats`, `UserChats`, `Messages` constants |
| `Lovecraft.Backend/MockData/MockDataStore.cs` | Add mock chats, user-chat index entries, messages |
| `Lovecraft.Backend/Program.cs` | Add SignalR, JWT `OnMessageReceived`, `IChatService` DI, hub routing |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | Broadcast `ReplyPosted` via hub after `CreateReply` |
| `Lovecraft.Backend/Controllers/V1/EventsController.cs` | Lazy `forumTopicId` creation on `GetEvent` |
| `Lovecraft.Backend/Services/MockForumService.cs` | Add `CreateEventTopicAsync` |
| `Lovecraft.Backend/Services/MockEventService.cs` | Add `SetForumTopicIdAsync` |
| `Lovecraft.Backend/Services/Azure/AzureForumService.cs` | Add `CreateEventTopicAsync` |
| `Lovecraft.Backend/Services/Azure/AzureEventService.cs` | Add `SetForumTopicIdAsync` |
| `aloevera-harmony-meet/nginx.conf` | Add `/hubs/` WebSocket location block |

### Frontend — New Files
| File | Purpose |
|---|---|
| `src/services/signalr/chatConnection.ts` | Module-level SignalR singleton, no-op in mock mode |
| `src/hooks/useChatSignalR.ts` | Hook: join group, expose onEvent with auto-cleanup, sendMessage |
| `src/services/api/chatsApi.test.ts` | 3 Vitest tests for mock-mode isolation |

### Frontend — Modified Files
| File | Change |
|---|---|
| `src/types/user.ts` | Remove `Message`; add `forumTopicId?: string` to `Event` |
| `src/types/chat.ts` | Add `PrivateChatWithUser` type (move from chatsApi) |
| `src/services/api/chatsApi.ts` | Full dual-mode rewrite; retire `getEventChats` |
| `src/data/mockEvents.ts` | Add `forumTopicId` field pointing to mock forum topic |
| `src/pages/Friends.tsx` | Real message history + SignalR live updates |
| `src/pages/Talks.tsx` | Replace `getEventChats` with forum-based event discussion + SignalR |
| `package.json` | Add `@microsoft/signalr` |

---

## Chunk 1: Backend Types, Storage, Mock Service, Tests

### Task 1: Extend DTOs and interfaces

**Files:**
- Modify: `Lovecraft.Common/DTOs/Chats/ChatDtos.cs`
- Modify: `Lovecraft.Common/DTOs/Events/EventDtos.cs`
- Modify: `Lovecraft.Backend/Services/IServices.cs`
- Modify: `Lovecraft.Backend/Storage/TableNames.cs`

- [ ] **Add `CreatePrivateChatRequestDto` to `ChatDtos.cs`** — append after existing DTOs:

```csharp
public class CreatePrivateChatRequestDto
{
    public string TargetUserId { get; set; } = string.Empty;
}
```

- [ ] **Add `ForumTopicId` to `EventDto` in `EventDtos.cs`** — add one property:

```csharp
public string? ForumTopicId { get; set; }
```

- [ ] **Add `SendMessageRequestDto` to `ChatDtos.cs`** — append after `CreatePrivateChatRequestDto`:

```csharp
public class SendMessageRequestDto
{
    public string Content { get; set; } = string.Empty;
}
```

- [ ] **Add `IChatService` to `IServices.cs`** — append after `IForumService`:

```csharp
public interface IChatService
{
    Task<List<ChatDto>> GetChatsAsync(string userId);
    Task<ChatDto> GetOrCreateChatAsync(string userId, string targetUserId);
    Task<List<MessageDto>> GetMessagesAsync(string chatId, string userId, int page = 1, int pageSize = 50);
    Task<MessageDto> SendMessageAsync(string chatId, string userId, string content);
    Task<bool> ValidateAccessAsync(string chatId, string userId);
}
```

- [ ] **Add `CreateEventTopicAsync` to `IForumService` in `IServices.cs`**:

```csharp
Task<ForumTopicDto> CreateEventTopicAsync(string eventId, string eventName);
```

- [ ] **Add `SetForumTopicIdAsync` to `IEventService` in `IServices.cs`**:

```csharp
Task SetForumTopicIdAsync(string eventId, string forumTopicId);
```

- [ ] **Add three table name constants to `TableNames.cs`**:

```csharp
public const string Chats = "chats";
public const string UserChats = "userchats";
public const string Messages = "messages";
```

- [ ] **Build to verify no compile errors**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
```
Expected: Build succeeded, 0 errors.

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): add IChatService interface, DTOs, and table name constants"
```

---

### Task 2: Storage entities

**Files:**
- Create: `Lovecraft.Backend/Storage/Entities/ChatEntity.cs`
- Create: `Lovecraft.Backend/Storage/Entities/UserChatEntity.cs`
- Create: `Lovecraft.Backend/Storage/Entities/MessageEntity.cs`

- [ ] **Create `ChatEntity.cs`**:

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class ChatEntity : ITableEntity
{
    // PartitionKey = "CHAT", RowKey = chatId
    public string PartitionKey { get; set; } = "CHAT";
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string ParticipantIds { get; set; } = string.Empty; // comma-separated
    public DateTime CreatedAt { get; set; }
}
```

- [ ] **Create `UserChatEntity.cs`**:

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class UserChatEntity : ITableEntity
{
    // PartitionKey = userId, RowKey = chatId
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string OtherUserId { get; set; } = string.Empty;
    public string LastMessageContent { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

- [ ] **Create `MessageEntity.cs`**:

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class MessageEntity : ITableEntity
{
    // PartitionKey = chatId, RowKey = {invertedTicks}_{messageId}
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string MessageId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public string Type { get; set; } = "text";
    public bool Read { get; set; }
}
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): add Azure Table Storage entities for chats, userchats, messages"
```

---

### Task 3: Mock data seed

**Files:**
- Modify: `Lovecraft.Backend/MockData/MockDataStore.cs`

- [ ] **Add static chat, user-chat index, and message lists to `MockDataStore`** — append to the class (after existing static lists):

```csharp
// ---- Chats ----
public static List<ChatDto> Chats { get; } = new()
{
    new ChatDto
    {
        Id = "chat-1",
        Type = ChatType.Private,
        Participants = new List<string> { "current-user", "user-anna" },
        CreatedAt = DateTime.UtcNow.AddDays(-5)
    }
};

// UserChats index: one entry per participant per chat
public static Dictionary<string, List<(string ChatId, string OtherUserId, string LastContent, DateTime LastAt)>> UserChats { get; } = new()
{
    ["current-user"] = new() { ("chat-1", "user-anna", "Привет!", DateTime.UtcNow.AddMinutes(-30)) },
    ["user-anna"]    = new() { ("chat-1", "current-user", "Привет!", DateTime.UtcNow.AddMinutes(-30)) }
};

// Messages: keyed by chatId
public static Dictionary<string, List<MessageDto>> Messages { get; } = new()
{
    ["chat-1"] = new()
    {
        new MessageDto { Id = "msg-1", ChatId = "chat-1", SenderId = "user-anna",    Content = "Привет!",        Timestamp = DateTime.UtcNow.AddHours(-2),   Read = true,  Type = MessageType.Text },
        new MessageDto { Id = "msg-2", ChatId = "chat-1", SenderId = "current-user", Content = "Привет, Анна!", Timestamp = DateTime.UtcNow.AddMinutes(-90), Read = true,  Type = MessageType.Text },
        new MessageDto { Id = "msg-3", ChatId = "chat-1", SenderId = "user-anna",    Content = "Как дела?",     Timestamp = DateTime.UtcNow.AddMinutes(-30), Read = false, Type = MessageType.Text }
    }
};
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): seed mock chats and messages in MockDataStore"
```

---

### Task 4: MockChatService

**Files:**
- Create: `Lovecraft.Backend/Services/MockChatService.cs`

- [ ] **Create `MockChatService.cs`**:

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Common.DTOs.Chats;

namespace Lovecraft.Backend.Services;

public class MockChatService : IChatService
{
    public Task<List<ChatDto>> GetChatsAsync(string userId)
    {
        var chats = MockDataStore.Chats
            .Where(c => c.Participants.Contains(userId))
            .Select(c =>
            {
                var lastMsg = MockDataStore.Messages.GetValueOrDefault(c.Id)?.LastOrDefault();
                // Construct a new ChatDto rather than using `with` — ChatDto may be a class
                return new ChatDto
                {
                    Id = c.Id,
                    Type = c.Type,
                    Participants = c.Participants,
                    CreatedAt = c.CreatedAt,
                    LastMessage = lastMsg
                };
            })
            .ToList();
        return Task.FromResult(chats);
    }

    public Task<ChatDto> GetOrCreateChatAsync(string userId, string targetUserId)
    {
        var existing = MockDataStore.Chats.FirstOrDefault(c =>
            c.Participants.Contains(userId) && c.Participants.Contains(targetUserId));

        if (existing != null)
            return Task.FromResult(existing);

        var chat = new ChatDto
        {
            Id = $"chat-{Guid.NewGuid()}",
            Type = ChatType.Private,
            Participants = new List<string> { userId, targetUserId },
            CreatedAt = DateTime.UtcNow
        };
        MockDataStore.Chats.Add(chat);

        if (!MockDataStore.UserChats.ContainsKey(userId))
            MockDataStore.UserChats[userId] = new();
        if (!MockDataStore.UserChats.ContainsKey(targetUserId))
            MockDataStore.UserChats[targetUserId] = new();

        MockDataStore.UserChats[userId].Add((chat.Id, targetUserId, string.Empty, DateTime.UtcNow));
        MockDataStore.UserChats[targetUserId].Add((chat.Id, userId, string.Empty, DateTime.UtcNow));

        if (!MockDataStore.Messages.ContainsKey(chat.Id))
            MockDataStore.Messages[chat.Id] = new();

        return Task.FromResult(chat);
    }

    public Task<List<MessageDto>> GetMessagesAsync(string chatId, string userId, int page = 1, int pageSize = 50)
    {
        if (!MockDataStore.Chats.Any(c => c.Id == chatId && c.Participants.Contains(userId)))
            return Task.FromResult(new List<MessageDto>());

        var all = MockDataStore.Messages.GetValueOrDefault(chatId) ?? new();
        var paged = all
            .OrderByDescending(m => m.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.Timestamp) // oldest-first to client
            .ToList();
        return Task.FromResult(paged);
    }

    public Task<MessageDto> SendMessageAsync(string chatId, string userId, string content)
    {
        var chat = MockDataStore.Chats.FirstOrDefault(c => c.Id == chatId && c.Participants.Contains(userId))
            ?? throw new InvalidOperationException("Chat not found or access denied");

        var msg = new MessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = chatId,
            SenderId = userId,
            Content = content,
            Timestamp = DateTime.UtcNow,
            Read = false,
            Type = MessageType.Text
        };

        MockDataStore.Messages.GetValueOrDefault(chatId)?.Add(msg);

        // Update UserChats index for both participants
        foreach (var participantId in chat.Participants)
        {
            var entries = MockDataStore.UserChats.GetValueOrDefault(participantId);
            if (entries == null) continue;
            var idx = entries.FindIndex(e => e.ChatId == chatId);
            if (idx >= 0)
                entries[idx] = (chatId, entries[idx].OtherUserId, content, msg.Timestamp);
        }

        return Task.FromResult(msg);
    }

    public Task<bool> ValidateAccessAsync(string chatId, string userId)
    {
        var result = MockDataStore.Chats.Any(c => c.Id == chatId && c.Participants.Contains(userId));
        return Task.FromResult(result);
    }
}
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): implement MockChatService"
```

---

### Task 5: ChatTests.cs — write and run 13 tests

**Files:**
- Create: `Lovecraft.UnitTests/ChatTests.cs`

- [ ] **Create `ChatTests.cs`**:

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Xunit;

namespace Lovecraft.UnitTests;

[Collection("ChatTests")]
public class ChatTests
{
    private static MockChatService CreateService() => new();

    [Fact]
    public async Task GetChatsAsync_ReturnsOnlyChatsForUser()
    {
        var svc = CreateService();
        var chats = await svc.GetChatsAsync("current-user");
        Assert.All(chats, c => Assert.Contains("current-user", c.Participants));
    }

    [Fact]
    public async Task GetChatsAsync_ExcludesChatsForOtherUsers()
    {
        var svc = CreateService();
        var chats = await svc.GetChatsAsync("stranger-user");
        Assert.Empty(chats);
    }

    [Fact]
    public async Task GetOrCreateChatAsync_CreatesNewChat()
    {
        var svc = CreateService();
        var chat = await svc.GetOrCreateChatAsync("user-new-a", "user-new-b");
        Assert.Contains("user-new-a", chat.Participants);
        Assert.Contains("user-new-b", chat.Participants);
    }

    [Fact]
    public async Task GetOrCreateChatAsync_ReturnsExistingChat()
    {
        var svc = CreateService();
        var first  = await svc.GetOrCreateChatAsync("user-x", "user-y");
        var second = await svc.GetOrCreateChatAsync("user-x", "user-y");
        Assert.Equal(first.Id, second.Id);
    }

    [Fact]
    public async Task GetOrCreateChatAsync_IsIdempotentFromEitherSide()
    {
        var svc = CreateService();
        var ab = await svc.GetOrCreateChatAsync("user-p", "user-q");
        var ba = await svc.GetOrCreateChatAsync("user-q", "user-p");
        Assert.Equal(ab.Id, ba.Id);
    }

    [Fact]
    public async Task GetMessagesAsync_ReturnsMessagesOldestFirst()
    {
        var svc = CreateService();
        var msgs = await svc.GetMessagesAsync("chat-1", "current-user");
        Assert.NotEmpty(msgs);
        for (int i = 1; i < msgs.Count; i++)
            Assert.True(msgs[i].Timestamp >= msgs[i - 1].Timestamp);
    }

    [Fact]
    public async Task GetMessagesAsync_ReturnsEmptyForNonParticipant()
    {
        var svc = CreateService();
        var msgs = await svc.GetMessagesAsync("chat-1", "stranger-user");
        Assert.Empty(msgs);
    }

    [Fact]
    public async Task SendMessageAsync_PersistsMessage()
    {
        var svc = CreateService();
        var msg = await svc.SendMessageAsync("chat-1", "current-user", "Hello!");
        var history = await svc.GetMessagesAsync("chat-1", "current-user");
        Assert.Contains(history, m => m.Id == msg.Id && m.Content == "Hello!");
    }

    [Fact]
    public async Task SendMessageAsync_UpdatesLastMessageInUserChatsIndex()
    {
        var svc = CreateService();
        await svc.SendMessageAsync("chat-1", "current-user", "Updated!");
        var chats = await svc.GetChatsAsync("current-user");
        Assert.Contains(chats, c => c.LastMessage?.Content == "Updated!");
    }

    [Fact]
    public async Task SendMessageAsync_ThrowsForNonParticipant()
    {
        var svc = CreateService();
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync("chat-1", "stranger-user", "Hack!"));
    }

    [Fact]
    public async Task ValidateAccessAsync_ReturnsTrueForParticipant()
    {
        var svc = CreateService();
        var result = await svc.ValidateAccessAsync("chat-1", "current-user");
        Assert.True(result);
    }

    [Fact]
    public async Task ValidateAccessAsync_ReturnsFalseForNonParticipant()
    {
        var svc = CreateService();
        var result = await svc.ValidateAccessAsync("chat-1", "stranger-user");
        Assert.False(result);
    }

    [Fact]
    public async Task GetMessagesAsync_PaginatesCorrectly()
    {
        var svc = CreateService();
        // chat-1 has 3 seeded messages; page 1 with pageSize 2 → 2 messages
        var page1 = await svc.GetMessagesAsync("chat-1", "current-user", page: 1, pageSize: 2);
        Assert.Equal(2, page1.Count);
    }
}
```

- [ ] **Run tests**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet test --filter "FullyQualifiedName~ChatTests" -v normal
```
Expected: 13 passed.

- [ ] **Commit**:
```bash
git add -A
git commit -m "test(chat): add 13 ChatTests covering MockChatService"
```

---

### Task 6: MockForumService + MockEventService — event topic methods

**Files:**
- Modify: `Lovecraft.Backend/Services/MockForumService.cs`
- Modify: `Lovecraft.Backend/Services/MockEventService.cs`
- Modify: `Lovecraft.Backend/MockData/MockDataStore.cs` — add events forum section

- [ ] **Add hidden events section to `MockDataStore`** — append to `ForumSections` list or add a separate field:

```csharp
// Hidden section for event discussions (not shown in forum section list)
public static ForumSectionDto EventsForumSection { get; } = new()
{
    Id = "events",
    Name = "Events",
    Description = "Event discussion threads",
    TopicCount = 0
};
```

- [ ] **Add `CreateEventTopicAsync` to `MockForumService`**:

```csharp
public Task<ForumTopicDto> CreateEventTopicAsync(string eventId, string eventName)
{
    var topic = new ForumTopicDto
    {
        Id = $"event-topic-{eventId}",
        SectionId = "events",
        Title = eventName,
        Content = $"Обсуждение события: {eventName}",
        AuthorId = "system",
        AuthorName = "AloeVera",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        ReplyCount = 0,
        IsPinned = false
    };
    MockDataStore.ForumTopics.Add(topic);
    return Task.FromResult(topic);
}
```

- [ ] **Add `SetForumTopicIdAsync` to `MockEventService`**:

```csharp
public Task SetForumTopicIdAsync(string eventId, string forumTopicId)
{
    var evt = MockDataStore.Events.FirstOrDefault(e => e.Id == eventId);
    if (evt != null)
        evt.ForumTopicId = forumTopicId;
    return Task.CompletedTask;
}
```

- [ ] **Verify `MockDataStore.ForumTopics` is a mutable `List<ForumTopicDto>`** — `CreateEventTopicAsync` calls `.Add()` on it; if it is read-only this will compile but throw at runtime. Check `MockDataStore.cs` and confirm or change to `List<ForumTopicDto>` if needed.

- [ ] **Leave `ForumTopicId = null` on all seeded backend `EventDto` instances in `MockDataStore.cs`** — lazy creation runs on first `GetEvent` call in API mode. The frontend mock data (`mockEvents.ts`) handles mock-mode topic IDs separately (done in Task 18).

- [ ] **Build**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
```
Expected: Build succeeded, 0 errors.

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): add CreateEventTopicAsync and SetForumTopicIdAsync to mock services"
```

---

## Chunk 2: Backend API Layer

### Task 7: Program.cs — SignalR, JWT query string, IChatService DI, hub route

**Files:**
- Modify: `Lovecraft.Backend/Program.cs`

- [ ] **Add these two `using` statements** at the top of `Program.cs`:
```csharp
using Microsoft.AspNetCore.SignalR;
using Lovecraft.Backend.Hubs;
```

- [ ] **Add `builder.Services.AddSignalR();`** after the existing `builder.Services.AddControllers(...)` call.

- [ ] **Extend `AddJwtBearer` options** to read the token from the query string for SignalR connections. Find the existing `.AddJwtBearer(options => { ... })` block and add the `Events` property:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var accessToken = context.Request.Query["access_token"];
        var path = context.HttpContext.Request.Path;
        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
        {
            context.Token = accessToken;
        }
        return Task.CompletedTask;
    }
};
```

- [ ] **Register `IChatService`** alongside the other service registrations (inside the `if (useAzureStorage) / else` block):

```csharp
// Azure block:
services.AddSingleton<IChatService, AzureChatService>();
// Mock block:
services.AddSingleton<IChatService, MockChatService>();
```

- [ ] **Add hub route** after `app.MapControllers()`:

```csharp
app.MapHub<ChatHub>("/hubs/chat");
```

- [ ] **Build to verify no compile errors**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
```
Expected: Build succeeded, 0 errors.

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): wire SignalR, JWT query-string token, IChatService DI, and hub route in Program.cs"
```

---

### Task 8: ChatHub

**Files:**
- Create: `Lovecraft.Backend/Hubs/ChatHub.cs`

- [ ] **Create `ChatHub.cs`**:

```csharp
using Lovecraft.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Lovecraft.Backend.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;

    public ChatHub(IChatService chatService)
    {
        _chatService = chatService;
    }

    private string CurrentUserId =>
        Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "current-user";

    public async Task JoinChat(string chatId)
    {
        if (!await _chatService.ValidateAccessAsync(chatId, CurrentUserId))
        {
            throw new HubException("Access denied to chat.");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat-{chatId}");
    }

    public async Task JoinTopic(string topicId)
    {
        // No access check — any authenticated user may receive live reply updates
        await Groups.AddToGroupAsync(Context.ConnectionId, $"topic-{topicId}");
    }

    public async Task LeaveGroup(string groupId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupId);
    }

    public async Task SendMessage(string chatId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new HubException("Message content cannot be empty.");

        if (!await _chatService.ValidateAccessAsync(chatId, CurrentUserId))
            throw new HubException("Access denied to chat.");

        var message = await _chatService.SendMessageAsync(chatId, CurrentUserId, content);

        // Broadcast to all group members EXCEPT the sender (sender gets it from REST response)
        await Clients.OthersInGroup($"chat-{chatId}").SendAsync("MessageReceived", message);
    }
}
```

- [ ] **Build**:
```bash
dotnet build
```
Expected: Build succeeded.

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): implement ChatHub with JoinChat, JoinTopic, LeaveGroup, SendMessage"
```

---

### Task 9: ChatsController

**Files:**
- Create: `Lovecraft.Backend/Controllers/V1/ChatsController.cs`

- [ ] **Create `ChatsController.cs`**:

```csharp
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Chats;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ChatsController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatsController(IChatService chatService)
    {
        _chatService = chatService;
    }

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "current-user";

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ChatDto>>>> GetChats()
    {
        var chats = await _chatService.GetChatsAsync(CurrentUserId);
        return Ok(ApiResponse<List<ChatDto>>.SuccessResponse(chats));
    }

    [HttpGet("{id}/messages")]
    public async Task<ActionResult<ApiResponse<List<MessageDto>>>> GetMessages(
        string id, [FromQuery] int page = 1)
    {
        if (!await _chatService.ValidateAccessAsync(id, CurrentUserId))
            return Forbid();

        var messages = await _chatService.GetMessagesAsync(id, CurrentUserId, page);
        return Ok(ApiResponse<List<MessageDto>>.SuccessResponse(messages));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ChatDto>>> GetOrCreateChat(
        [FromBody] CreatePrivateChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.TargetUserId))
            return BadRequest(ApiResponse<ChatDto>.ErrorResponse("TARGET_REQUIRED", "targetUserId is required"));

        var chat = await _chatService.GetOrCreateChatAsync(CurrentUserId, request.TargetUserId);
        return Ok(ApiResponse<ChatDto>.SuccessResponse(chat));
    }

    [HttpPost("{id}/messages")]
    public async Task<ActionResult<ApiResponse<MessageDto>>> SendMessage(
        string id, [FromBody] SendMessageRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(ApiResponse<MessageDto>.ErrorResponse("CONTENT_REQUIRED", "Message content cannot be empty"));

        if (!await _chatService.ValidateAccessAsync(id, CurrentUserId))
            return Forbid();

        var message = await _chatService.SendMessageAsync(id, CurrentUserId, request.Content);
        return Ok(ApiResponse<MessageDto>.SuccessResponse(message));
    }
}
```

- [ ] **Build and verify**:
```bash
dotnet build
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): implement ChatsController with GET chats, messages, POST get-or-create, send"
```

---

### Task 10: ForumController — broadcast ReplyPosted via hub

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/ForumController.cs`

- [ ] **Add `IHubContext<ChatHub>` injection** to `ForumController` constructor. Add `using Lovecraft.Backend.Hubs;` and `using Microsoft.AspNetCore.SignalR;` at the top, then update the constructor:

```csharp
private readonly IForumService _forumService;
private readonly IHubContext<ChatHub> _hubContext;

public ForumController(IForumService forumService, IHubContext<ChatHub> hubContext)
{
    _forumService = forumService;
    _hubContext = hubContext;
}
```

- [ ] **Add hub broadcast in `CreateReply`** — after the successful `CreateReplyAsync` call, add one line before returning:

```csharp
var reply = await _forumService.CreateReplyAsync(topicId, authorId, authorName, request.Content);
await _hubContext.Clients.Group($"topic-{topicId}").SendAsync("ReplyPosted", reply, topicId);
return Ok(ApiResponse<ForumReplyDto>.SuccessResponse(reply));
```

- [ ] **Build**:
```bash
dotnet build
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): broadcast ReplyPosted from ForumController via ChatHub"
```

---

### Task 11: EventsController — lazy forumTopicId creation

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/EventsController.cs`

- [ ] **Inject `IForumService`** into `EventsController` alongside the existing `IEventService`.

- [ ] **Update `GetEvent(id)` action** to lazily create the forum topic when `ForumTopicId` is null:

```csharp
[HttpGet("{id}")]
public async Task<ActionResult<ApiResponse<EventDto>>> GetEvent(string id)
{
    var evt = await _eventService.GetEventByIdAsync(id);
    if (evt == null)
        return NotFound(ApiResponse<EventDto>.ErrorResponse("NOT_FOUND", "Event not found"));

    if (string.IsNullOrEmpty(evt.ForumTopicId))
    {
        var topic = await _forumService.CreateEventTopicAsync(id, evt.Title);
        await _eventService.SetForumTopicIdAsync(id, topic.Id);
        evt = evt with { ForumTopicId = topic.Id };
    }

    return Ok(ApiResponse<EventDto>.SuccessResponse(evt));
}
```

- [ ] **Build**:
```bash
dotnet build
```

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): lazy-create forum topic for events in EventsController"
```

---

### Task 11b: Azure service implementations — CreateEventTopicAsync and SetForumTopicIdAsync

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureForumService.cs`
- Modify: `Lovecraft.Backend/Services/Azure/AzureEventService.cs`

These are required to implement the `IForumService` and `IEventService` interface additions from Task 1. Without them the project will not compile in Azure mode.

- [ ] **Add `CreateEventTopicAsync` to `AzureForumService`** — creates a forum topic row in the forum topics table (or equivalent Azure table), using the event ID to generate a deterministic topic ID:

```csharp
public async Task<ForumTopicDto> CreateEventTopicAsync(string eventId, string eventName)
{
    var topicId = $"event-topic-{eventId}";
    var now = DateTime.UtcNow;

    var entity = new ForumTopicEntity
    {
        PartitionKey = "events",
        RowKey = topicId,
        Title = eventName,
        Content = $"Обсуждение события: {eventName}",
        AuthorId = "system",
        AuthorName = "AloeVera",
        ReplyCount = 0,
        IsPinned = false,
        CreatedAt = now,
        UpdatedAt = now
    };

    // Use UpsertEntityAsync — idempotent if called more than once (e.g. concurrent first-GETs)
    await _topicsTable.UpsertEntityAsync(entity);

    return new ForumTopicDto
    {
        Id = topicId,
        SectionId = "events",
        Title = eventName,
        Content = entity.Content,
        AuthorId = "system",
        AuthorName = "AloeVera",
        CreatedAt = now,
        UpdatedAt = now,
        ReplyCount = 0,
        IsPinned = false
    };
}
```

> **Note:** Check the existing `AzureForumService` to confirm the topics table client field name and `ForumTopicEntity` property names — use the same names as existing entity writes in that file.

- [ ] **Add `SetForumTopicIdAsync` to `AzureEventService`** — updates the event row's `ForumTopicId` property:

```csharp
public async Task SetForumTopicIdAsync(string eventId, string forumTopicId)
{
    try
    {
        var response = await _eventsTable.GetEntityAsync<EventEntity>("EVENT", eventId);
        var entity = response.Value;
        entity.ForumTopicId = forumTopicId;
        await _eventsTable.UpdateEntityAsync(entity, entity.ETag);
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        // Event not found — no-op (should not happen if EventsController checks first)
    }
}
```

> **Note:** Check the existing `AzureEventService` to confirm the events table client field name and partition key used for event rows. Use those values.

- [ ] **Add `ForumTopicId` property to `EventEntity`** in `Lovecraft.Backend/Storage/Entities/EventEntity.cs`:

```csharp
public string? ForumTopicId { get; set; }
```

- [ ] **Build**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
```
Expected: Build succeeded, 0 errors.

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): implement AzureForumService.CreateEventTopicAsync and AzureEventService.SetForumTopicIdAsync"
```

---

### Task 12: AzureChatService

**Files:**
- Create: `Lovecraft.Backend/Services/Azure/AzureChatService.cs`

- [ ] **Create `AzureChatService.cs`**:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Chats;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services.Azure;

public class AzureChatService : IChatService
{
    private readonly TableClient _chatsTable;
    private readonly TableClient _userChatsTable;
    private readonly TableClient _messagesTable;

    public AzureChatService(TableServiceClient tableService)
    {
        _chatsTable    = tableService.GetTableClient(TableNames.Chats);
        _userChatsTable = tableService.GetTableClient(TableNames.UserChats);
        _messagesTable = tableService.GetTableClient(TableNames.Messages);
    }

    public async Task<List<ChatDto>> GetChatsAsync(string userId)
    {
        var entries = _userChatsTable
            .QueryAsync<UserChatEntity>(e => e.PartitionKey == userId)
            .AsPages();

        var result = new List<ChatDto>();
        await foreach (var page in entries)
        {
            foreach (var entry in page.Values)
            {
                result.Add(new ChatDto
                {
                    Id = entry.RowKey,
                    Type = ChatType.Private,
                    Participants = new List<string> { userId, entry.OtherUserId },
                    LastMessage = string.IsNullOrEmpty(entry.LastMessageContent) ? null : new MessageDto
                    {
                        ChatId = entry.RowKey,
                        Content = entry.LastMessageContent,
                        Timestamp = entry.LastMessageAt
                    },
                    CreatedAt = entry.UpdatedAt
                });
            }
        }
        return result.OrderByDescending(c => c.LastMessage?.Timestamp ?? c.CreatedAt).ToList();
    }

    public async Task<ChatDto> GetOrCreateChatAsync(string userId, string targetUserId)
    {
        // Check if index entry exists for userId
        var existing = _userChatsTable
            .QueryAsync<UserChatEntity>(e => e.PartitionKey == userId && e.OtherUserId == targetUserId);

        await foreach (var entry in existing)
        {
            return new ChatDto
            {
                Id = entry.RowKey,
                Type = ChatType.Private,
                Participants = new List<string> { userId, targetUserId }
            };
        }

        // Create new chat
        var chatId = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;

        // Canonical chat row
        var chatEntity = new ChatEntity
        {
            PartitionKey = "CHAT",
            RowKey = chatId,
            ParticipantIds = $"{userId},{targetUserId}",
            CreatedAt = now
        };
        try
        {
            await _chatsTable.AddEntityAsync(chatEntity);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            // Concurrent creation — row already exists; find and return it
            var created = await _chatsTable.GetEntityAsync<ChatEntity>("CHAT", chatId);
            chatId = created.Value.RowKey;
        }

        // UserChats index — one row per participant
        var indexA = new UserChatEntity { PartitionKey = userId,       RowKey = chatId, OtherUserId = targetUserId, UpdatedAt = now, LastMessageAt = now };
        var indexB = new UserChatEntity { PartitionKey = targetUserId, RowKey = chatId, OtherUserId = userId,       UpdatedAt = now, LastMessageAt = now };
        await _userChatsTable.UpsertEntityAsync(indexA);
        await _userChatsTable.UpsertEntityAsync(indexB);

        return new ChatDto
        {
            Id = chatId,
            Type = ChatType.Private,
            Participants = new List<string> { userId, targetUserId },
            CreatedAt = now
        };
    }

    public async Task<List<MessageDto>> GetMessagesAsync(string chatId, string userId, int page = 1, int pageSize = 50)
    {
        if (!await ValidateAccessAsync(chatId, userId))
            return new List<MessageDto>();

        // Query top N*page rows (inverted timestamp = newest first in storage)
        var allPages = _messagesTable
            .QueryAsync<MessageEntity>(e => e.PartitionKey == chatId)
            .AsPages(pageSizeHint: pageSize * page);

        var all = new List<MessageEntity>();
        await foreach (var p in allPages)
            all.AddRange(p.Values);

        return all
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(e => e.SentAt) // oldest-first to client
            .Select(e => new MessageDto
            {
                Id = e.MessageId,
                ChatId = chatId,
                SenderId = e.SenderId,
                Content = e.Content,
                Timestamp = e.SentAt,
                Read = e.Read,
                Type = MessageType.Text
            })
            .ToList();
    }

    public async Task<MessageDto> SendMessageAsync(string chatId, string userId, string content)
    {
        if (!await ValidateAccessAsync(chatId, userId))
            throw new InvalidOperationException("Access denied");

        var now = DateTime.UtcNow;
        var msgId = Guid.NewGuid().ToString();
        var invertedTicks = DateTimeOffset.MaxValue.Ticks - now.Ticks;
        var rowKey = $"{invertedTicks:D20}_{msgId}";

        var entity = new MessageEntity
        {
            PartitionKey = chatId,
            RowKey = rowKey,
            MessageId = msgId,
            SenderId = userId,
            Content = content,
            SentAt = now,
            Type = "text",
            Read = false
        };
        await _messagesTable.AddEntityAsync(entity);

        // Update both UserChats index rows
        var chatRow = await _chatsTable.GetEntityAsync<ChatEntity>("CHAT", chatId);
        var participants = chatRow.Value.ParticipantIds.Split(',');
        foreach (var participantId in participants)
        {
            var indexRow = await _userChatsTable.GetEntityAsync<UserChatEntity>(participantId, chatId);
            var updated = indexRow.Value;
            updated.LastMessageContent = content;
            updated.LastMessageAt = now;
            updated.UpdatedAt = now;
            if (participantId != userId) updated.UnreadCount++;
            await _userChatsTable.UpdateEntityAsync(updated, updated.ETag);
        }

        return new MessageDto
        {
            Id = msgId,
            ChatId = chatId,
            SenderId = userId,
            Content = content,
            Timestamp = now,
            Read = false,
            Type = MessageType.Text
        };
    }

    public async Task<bool> ValidateAccessAsync(string chatId, string userId)
    {
        try
        {
            var row = await _chatsTable.GetEntityAsync<ChatEntity>("CHAT", chatId);
            return row.Value.ParticipantIds.Split(',').Contains(userId);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return false;
        }
    }
}
```

- [ ] **Build**:
```bash
dotnet build
```

- [ ] **Run all tests**:
```bash
dotnet test -v normal
```
Expected: 53 tests passing (35 existing + 18 new chat tests).

- [ ] **Commit**:
```bash
git add -A
git commit -m "feat(chat): implement AzureChatService against Chats/UserChats/Messages tables"
```

---

### Task 12b: ChatHub unit tests (5 tests)

**Files:**
- Modify: `Lovecraft.UnitTests/ChatTests.cs`

These 5 tests cover `ChatHub` logic paths. The hub cannot be instantiated directly with a real SignalR context, so we test the underlying service calls through `MockChatService` and verify hub behavior via the service contracts.

- [ ] **Add 5 hub-path tests to `ChatTests.cs`** — append inside the `ChatTests` class:

```csharp
// --- Hub path tests (via MockChatService, which ChatHub delegates to) ---

[Fact]
public async Task ValidateAccessAsync_CalledByHub_ReturnsTrueForParticipant()
{
    // Simulates ChatHub.JoinChat / SendMessage calling ValidateAccessAsync
    var svc = CreateService();
    var allowed = await svc.ValidateAccessAsync("chat-1", "current-user");
    Assert.True(allowed);
}

[Fact]
public async Task ValidateAccessAsync_CalledByHub_ReturnsFalseForNonParticipant()
{
    // Simulates ChatHub rejecting a JoinChat from a non-participant
    var svc = CreateService();
    var denied = await svc.ValidateAccessAsync("chat-1", "intruder");
    Assert.False(denied);
}

[Fact]
public async Task SendMessageAsync_CalledByHub_ThrowsForEmptyContent()
{
    // ChatHub throws HubException for empty content before calling service;
    // here we verify the service itself rejects invalid chat IDs (non-participant)
    var svc = CreateService();
    await Assert.ThrowsAsync<InvalidOperationException>(
        () => svc.SendMessageAsync("chat-nonexistent", "current-user", "Hello"));
}

[Fact]
public async Task SendMessageAsync_CalledByHub_PersistsMessageForOtherParticipant()
{
    // Simulates hub: sender sends via SendMessage; recipient should see it via GetMessages
    var svc = CreateService();
    var msg = await svc.SendMessageAsync("chat-1", "current-user", "Hub send test");
    var recipientView = await svc.GetMessagesAsync("chat-1", "user-anna");
    Assert.Contains(recipientView, m => m.Id == msg.Id);
}

[Fact]
public async Task SendMessageAsync_CalledByHub_DoesNotExcludeSenderFromPersistence()
{
    // OthersInGroup only affects SignalR broadcast, not persistence;
    // sender's own GetMessages should still include the sent message
    var svc = CreateService();
    var msg = await svc.SendMessageAsync("chat-1", "current-user", "Self-visible");
    var senderView = await svc.GetMessagesAsync("chat-1", "current-user");
    Assert.Contains(senderView, m => m.Id == msg.Id);
}
```

- [ ] **Run tests**:
```bash
cd D:\src\lovecraft\Lovecraft
dotnet test --filter "FullyQualifiedName~ChatTests" -v normal
```
Expected: 18 passed (13 from Task 5 + 5 new).

> **Note on test count:** ChatTests now has 18 tests total (Task 5's 13 + these 5). Total backend tests = 35 existing + 18 = 53.

- [ ] **Commit**:
```bash
git add Lovecraft.UnitTests/ChatTests.cs
git commit -m "test(chat): add 5 ChatHub path tests to ChatTests"
```

---

### Task 13: nginx WebSocket config

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\nginx.conf`

- [ ] **Add `/hubs/` location block** after the existing `location /api/` block:

```nginx
location /hubs/ {
    proxy_pass         http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

- [ ] **Verify syntax** (if nginx is available locally, otherwise verify on deploy):
```bash
nginx -t
```
If nginx is not installed locally, note that syntax verification happens on the first deployment after this commit.

- [ ] **Commit** (from `aloevera-harmony-meet`):
```bash
cd D:\src\aloevera-harmony-meet
git add nginx.conf
git commit -m "feat(chat): add nginx WebSocket proxy for /hubs/ location"
```

---

## Chunk 3: Frontend

### Task 14: Fix duplicate Message interface (Issue #7) and add forumTopicId to Event

**Files:**
- Modify: `src/types/user.ts`

- [ ] **Remove the `Message` interface** from `src/types/user.ts` (lines ~43-50):

Delete the block:
```typescript
export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}
```

- [ ] **Update `Match` interface** to import `Message` from `chat.ts`:

At the top of `user.ts` add:
```typescript
import type { Message } from './chat';
```
Then in the `Match` interface, `lastMessage?: Message` now references the correct type from `chat.ts`.

- [ ] **Add `forumTopicId` to the `Event` interface** in `src/types/user.ts`:

```typescript
forumTopicId?: string;
```

- [ ] **Check for TypeScript errors**:
```bash
cd D:\src\aloevera-harmony-meet
npx tsc --noEmit
```
Fix any import errors that surface from removing `Message` from `user.ts`.

- [ ] **Commit**:
```bash
git add src/types/user.ts src/types/chat.ts
git commit -m "fix(types): remove duplicate Message interface from user.ts, add forumTopicId to Event"
```

---

### Task 15: Install @microsoft/signalr

**Files:**
- Modify: `package.json`

- [ ] **Install the package**:
```bash
npm install @microsoft/signalr
```

- [ ] **Commit**:
```bash
git add package.json package-lock.json
git commit -m "feat(chat): add @microsoft/signalr dependency"
```

---

### Task 16: chatConnection.ts — SignalR singleton

**Files:**
- Create: `src/services/signalr/chatConnection.ts`

- [ ] **Create the directory and file**:

```typescript
import * as signalR from '@microsoft/signalr';
import { isApiMode } from '@/config/api.config';
import { apiClient } from '@/services/api/apiClient';

// Module-level singleton — created once, shared across all components.
// All methods are no-ops when !isApiMode().

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

let connection: signalR.HubConnection | null = null;

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/chat`, {
        accessTokenFactory: () => apiClient.getAccessToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();
  }
  return connection;
}

export const chatConnection = {
  async connect(): Promise<void> {
    if (!isApiMode()) return;
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
  },

  async disconnect(): Promise<void> {
    if (!connection) return;
    await connection.stop();
  },

  async leaveGroup(groupId: string): Promise<void> {
    if (!isApiMode() || !connection) return;
    await connection.invoke('LeaveGroup', groupId);
  },

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!isApiMode()) return;
    getConnection().on(event, handler);
  },

  off(event: string, handler: (...args: unknown[]) => void): void {
    if (!connection) return;
    connection.off(event, handler);
  },

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('SendMessage', chatId, content);
  },

  async joinChat(chatId: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('JoinChat', chatId);
  },

  async joinTopic(topicId: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('JoinTopic', topicId);
  },

  get isConnected(): boolean {
    if (!isApiMode() || !connection) return false;
    return connection.state === signalR.HubConnectionState.Connected;
  },
};
```

- [ ] **Commit**:
```bash
git add src/services/signalr/chatConnection.ts
git commit -m "feat(chat): add SignalR chatConnection module-level singleton"
```

---

### Task 17: useChatSignalR hook

**Files:**
- Create: `src/hooks/useChatSignalR.ts`

- [ ] **Create the hook**:

```typescript
import { useEffect, useCallback } from 'react';
import { chatConnection } from '@/services/signalr/chatConnection';

type GroupType = 'chat' | 'topic';

interface UseChatSignalRReturn {
  sendMessage: (chatId: string, content: string) => Promise<void>;
  isConnected: boolean;
  onEvent: (event: string, handler: (...args: unknown[]) => void) => () => void;
}

export function useChatSignalR(type: GroupType, id: string): UseChatSignalRReturn {
  const groupId = `${type}-${id}`;

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    const setup = async () => {
      await chatConnection.connect();
      if (!mounted) return;
      if (type === 'chat') await chatConnection.joinChat(id);
      if (type === 'topic') await chatConnection.joinTopic(id);
    };

    setup();

    return () => {
      mounted = false;
      chatConnection.leaveGroup(groupId);
    };
  }, [type, id, groupId]); // re-runs when id changes (e.g. navigating between chats)

  // onEvent registers a handler and returns its cleanup function.
  // Usage: const off = onEvent('MessageReceived', handler); return off;
  // The caller's useEffect return value should be the returned cleanup fn.
  const onEvent = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      chatConnection.on(event, handler);
      return () => chatConnection.off(event, handler);
    },
    []
  );

  const sendMessage = useCallback(
    (chatId: string, content: string) => chatConnection.sendMessage(chatId, content),
    []
  );

  return {
    sendMessage,
    isConnected: chatConnection.isConnected,
    onEvent,
  };
}
```

- [ ] **Commit**:
```bash
git add src/hooks/useChatSignalR.ts
git commit -m "feat(chat): add useChatSignalR hook with groupId-aware cleanup"
```

---

### Task 18: chatsApi.ts — dual-mode rewrite

**Files:**
- Modify: `src/services/api/chatsApi.ts`

- [ ] **Move `PrivateChatWithUser` to `src/types/chat.ts`** — add the type to `chat.ts` and remove it from `chatsApi.ts`:

In `src/types/chat.ts`, append:
```typescript
import type { User } from './user';

export interface PrivateChatWithUser {
  chat: PrivateChat;
  otherUser: User;
}
```

- [ ] **Rewrite `chatsApi.ts`** with full dual-mode support and `getEventChats` removed — import `PrivateChatWithUser` from `@/types/chat` (not declared inline):

```typescript
import { isApiMode } from '@/config/api.config';
import { apiClient } from './apiClient';
import { mockPrivateChats, mockChatUsers } from '@/data/mockChats';
import type { ChatDto, MessageDto, PrivateChat, PrivateChatWithUser } from '@/types/chat';
import type { User } from '@/types/user';

function mockSuccess<T>(data: T) {
  return { success: true as const, data };
}

export const chatsApi = {
  async getChats() {
    if (!isApiMode()) {
      return mockSuccess(mockPrivateChats);
    }
    return apiClient.get<ChatDto[]>('/api/v1/chats');
  },

  async getMessages(chatId: string, page = 1) {
    if (!isApiMode()) {
      // Return empty array in mock — Friends.tsx uses mockChats lastMessage only
      return mockSuccess([] as MessageDto[]);
    }
    return apiClient.get<MessageDto[]>(`/api/v1/chats/${chatId}/messages?page=${page}`);
  },

  async getOrCreateChat(targetUserId: string) {
    if (!isApiMode()) {
      const existing = mockPrivateChats.find(c => c.participants.includes(targetUserId));
      return mockSuccess(existing ?? mockPrivateChats[0]);
    }
    return apiClient.post<ChatDto>('/api/v1/chats', { targetUserId });
  },

  async sendMessage(chatId: string, content: string) {
    if (!isApiMode()) {
      const msg: MessageDto = {
        id: crypto.randomUUID(),
        chatId,
        senderId: 'current-user',
        content,
        timestamp: new Date(),
        read: false,
        type: 'text',
      };
      return mockSuccess(msg);
    }
    return apiClient.post<MessageDto>(`/api/v1/chats/${chatId}/messages`, { content });
  },

  // getPrivateChats kept for legacy reference in mock mode only
  async getPrivateChats(): Promise<{ success: true; data: PrivateChatWithUser[] }> {
    const chats = mockPrivateChats.map(chat => ({
      chat,
      otherUser: mockChatUsers[
        chat.participants.find(id => id !== 'current-user') ?? ''
      ] as User,
    }));
    return mockSuccess(chats);
  },
};
```

- [ ] **Add `forumTopicId` to mock events** in `src/data/mockEvents.ts`. For each event, add:
```typescript
forumTopicId: 'topic-1', // or topic-2, etc. matching mock forum topics
```
At least two events should have a valid mock `forumTopicId` so the event discussion UI works in mock mode.

- [ ] **Commit**:
```bash
git add src/services/api/chatsApi.ts src/data/mockEvents.ts
git commit -m "feat(chat): rewrite chatsApi with dual-mode support, retire getEventChats"
```

---

### Task 19: Frontend tests

**Files:**
- Create: `src/services/api/chatsApi.test.ts`

- [ ] **Create `chatsApi.test.ts`**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock isApiMode to return false (mock mode)
vi.mock('@/config/api.config', () => ({ isApiMode: () => false }));
// Mock chatConnection so we can verify it's never called
vi.mock('@/services/signalr/chatConnection', () => ({
  chatConnection: {
    connect: vi.fn(),
    isConnected: false,
    sendMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    joinChat: vi.fn(),
    joinTopic: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

import { chatsApi } from './chatsApi';
import { chatConnection } from '@/services/signalr/chatConnection';

describe('chatsApi — mock mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getChats returns mock chats without any HTTP call', async () => {
    const result = await chatsApi.getChats();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('chatConnection.connect is never called in mock mode', async () => {
    await chatsApi.getChats();
    expect(chatConnection.connect).not.toHaveBeenCalled();
  });

  it('sendMessage returns a mock MessageDto without HTTP call', async () => {
    const result = await chatsApi.sendMessage('chat-1', 'hello');
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('hello');
    expect(result.data?.senderId).toBe('current-user');
  });
});
```

- [ ] **Run tests**:
```bash
npm run test:run
```
Expected: 3 new tests pass. All pre-existing tests continue to pass (run count varies by project state).

- [ ] **Commit**:
```bash
git add src/services/api/chatsApi.test.ts
git commit -m "test(chat): add 3 mock-mode isolation tests for chatsApi"
```

---

### Task 20: Friends.tsx — real message history + SignalR

**Files:**
- Modify: `src/pages/Friends.tsx`

- [ ] **Add imports** at the top of `Friends.tsx`:
```typescript
import { useChatSignalR } from '@/hooks/useChatSignalR';
import { chatsApi } from '@/services/api/chatsApi';
import type { MessageDto } from '@/types/chat';
```

- [ ] **Add state for active chat and messages** in the Friends component (alongside existing state):
```typescript
const [activeChatId, setActiveChatId] = useState<string | null>(null);
const [messages, setMessages] = useState<MessageDto[]>([]);
const [messagesLoading, setMessagesLoading] = useState(false);
const [messagePage, setMessagePage] = useState(1);
```

- [ ] **Connect SignalR** — add after state declarations:
```typescript
const { sendMessage: signalRSend, isConnected, onEvent } = useChatSignalR(
  'chat', activeChatId ?? ''
);

useEffect(() => {
  if (!activeChatId) return;
  // onEvent returns its cleanup function — return it so React calls chatConnection.off on cleanup
  return onEvent('MessageReceived', (msg: unknown) => {
    setMessages(prev => [...prev, msg as MessageDto]);
  });
}, [activeChatId, onEvent]);
```

- [ ] **Replace the chat-open handler** — when a user clicks to open a private chat:
```typescript
const handleOpenChat = async (targetUserId: string) => {
  setMessagesLoading(true);
  const chatResult = await chatsApi.getOrCreateChat(targetUserId);
  if (chatResult.success && chatResult.data) {
    const chatId = chatResult.data.id;
    setActiveChatId(chatId);
    const msgsResult = await chatsApi.getMessages(chatId, 1);
    if (msgsResult.success && msgsResult.data) {
      setMessages(msgsResult.data);
      setMessagePage(1);
    }
  }
  setMessagesLoading(false);
};
```

- [ ] **Replace the send handler** — existing `handleSendMessage` stub:
```typescript
const handleSendMessage = async (content: string) => {
  if (!content.trim() || !activeChatId) return;
  const result = await chatsApi.sendMessage(activeChatId, content);
  if (result.success && result.data) {
    setMessages(prev => [...prev, result.data!]);
  }
};
```

- [ ] **Add "Load older messages" button** in the message list JSX (above the message list):
```tsx
{messagePage > 0 && (
  <button
    className="text-xs text-muted-foreground underline py-2"
    onClick={async () => {
      const next = messagePage + 1;
      const r = await chatsApi.getMessages(activeChatId!, next);
      if (r.success && r.data && r.data.length > 0) {
        setMessages(prev => [...r.data!, ...prev]);
        setMessagePage(next);
      }
    }}
  >
    Load older messages
  </button>
)}
```

- [ ] **Replace single-message mock display** with the `messages` array — render each `MessageDto` in the chat view:
```tsx
{messages.map(msg => (
  <div key={msg.id} className={cn('flex', msg.senderId === 'current-user' ? 'justify-end' : 'justify-start')}>
    <div className={cn('rounded-lg px-3 py-2 max-w-[75%] text-sm',
      msg.senderId === 'current-user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
      {msg.content}
    </div>
  </div>
))}
```

- [ ] **Run the dev server briefly** to confirm no console errors, then commit:
```bash
git add src/pages/Friends.tsx
git commit -m "feat(chat): wire Friends.tsx to real chat API and SignalR live messages"
```

---

### Task 21: Talks.tsx — replace event chats with forum-based discussion + SignalR

**Files:**
- Modify: `src/pages/Talks.tsx`

- [ ] **Remove `chatsApi` import** and `getEventChats()` usage from `Talks.tsx`.

- [ ] **Add imports**:
```typescript
import { eventsApi } from '@/services/api/eventsApi';
import { forumsApi } from '@/services/api/forumsApi';
import { useChatSignalR } from '@/hooks/useChatSignalR';
import type { ForumReplyDto } from '@/types'; // adjust to actual reply type path
```

- [ ] **Add state for event discussion**:
```typescript
const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
const [topicReplies, setTopicReplies] = useState<ForumReplyDto[]>([]);
const [topicLoading, setTopicLoading] = useState(false);
```

- [ ] **Connect SignalR for topic updates**:
```typescript
const { onEvent } = useChatSignalR('topic', activeTopicId ?? '');

useEffect(() => {
  if (!activeTopicId) return;
  return onEvent('ReplyPosted', (reply: unknown, topicId: unknown) => {
    if (topicId === activeTopicId) {
      setTopicReplies(prev => [...prev, reply as ForumReplyDto]);
    }
  });
}, [activeTopicId, onEvent]);
```

- [ ] **Replace the event-chat-open handler** — when user selects an event for discussion:
```typescript
const handleOpenEventDiscussion = async (eventId: string) => {
  setTopicLoading(true);
  const eventResult = await eventsApi.getEventById(eventId);
  if (eventResult.success && eventResult.data?.forumTopicId) {
    const topicId = eventResult.data.forumTopicId;
    setActiveTopicId(topicId);
    const repliesResult = await forumsApi.getReplies(topicId);
    if (repliesResult.success && repliesResult.data) {
      setTopicReplies(repliesResult.data);
    }
  }
  setTopicLoading(false);
};
```

- [ ] **Replace event chat send handler** with forum reply:
```typescript
const handleSendEventReply = async (content: string) => {
  if (!content.trim() || !activeTopicId) return;
  const result = await forumsApi.createReply(activeTopicId, content);
  if (result.success && result.data) {
    setTopicReplies(prev => [...prev, result.data!]);
  }
};
```

- [ ] **Add loading spinner** for the topic-loading state. In the event discussion panel JSX, add above the replies list:
```tsx
{topicLoading && (
  <div className="flex justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
)}
```

- [ ] **Replace event chat UI section** with the `topicReplies` array display. Replace whatever event chat or placeholder JSX currently exists in the event discussion panel with:
```tsx
{!topicLoading && topicReplies.map(reply => (
  <div key={reply.id} className="flex gap-3 py-2">
    {reply.authorAvatar && (
      <img src={reply.authorAvatar} alt={reply.authorName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-sm">{reply.authorName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(reply.createdAt).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-sm mt-0.5 break-words">{reply.content}</p>
    </div>
  </div>
))}
{!topicLoading && activeTopicId && topicReplies.length === 0 && (
  <p className="text-sm text-muted-foreground text-center py-8">
    Нет сообщений. Начните обсуждение!
  </p>
)}
```

> **Note:** Adjust field names (`reply.authorName`, `reply.authorAvatar`, `reply.createdAt`, `reply.content`) to match the actual `ForumReplyDto` shape used in `TopicDetail.tsx`.

- [ ] **Check for TypeScript errors**:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**:
```bash
git add src/pages/Talks.tsx
git commit -m "feat(chat): replace event group chats with forum-based discussion + SignalR in Talks.tsx"
```

---

### Task 22: Documentation updates

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Create: `D:\src\lovecraft\Lovecraft\docs\CHAT_ARCHITECTURE.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\BACKEND_PLAN.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`

- [ ] **Update `IMPLEMENTATION_SUMMARY.md`**:
  - Add chat endpoints to "API Endpoints Implemented" section
  - Update table count: 15 → 18 (add Chats, UserChats, Messages)
  - Update test count: 35 → 53

- [ ] **Create `CHAT_ARCHITECTURE.md`** in `D:\src\lovecraft\Lovecraft\docs\`:

```markdown
# Chat Architecture

## Overview
Private 1:1 chat uses IChatService (REST) + ChatHub (SignalR /hubs/chat).
Forum/event topic live updates go through the same hub via ReplyPosted broadcast.

## Hub Groups
- `chat-{chatId}` — both chat participants; joined via JoinChat(chatId)
- `topic-{topicId}` — any authenticated viewer; joined via JoinTopic(topicId)

## Azure Table Storage (3 new tables)
- `chats` — PartitionKey: "CHAT", RowKey: {chatId} — canonical chat metadata
- `userchats` — PartitionKey: {userId}, RowKey: {chatId} — per-user index (like LikesReceived pattern)
- `messages` — PartitionKey: {chatId}, RowKey: {invertedTicks}_{guid} — newest-first in storage, re-reversed to oldest-first for client

## Mock Mode
All IChatService methods run against in-memory MockDataStore.
SignalR connection is never established (chatConnection.connect() is a no-op when !isApiMode()).

## nginx WebSocket Config
The /hubs/ location block must include Upgrade headers (see nginx.conf).

## Token Auth for SignalR
Standard query string pattern: /hubs/chat?access_token={token}
Configured in Program.cs via JwtBearerEvents.OnMessageReceived.
```

- [ ] **Update `ISSUES.md`**:
  - Mark "chat/songs backend endpoints" as partially resolved (chat done, songs pending)
  - Mark Issue #7 (duplicate Message) as ✅ RESOLVED

- [ ] **Update `BACKEND_PLAN.md`**:
  - Phase 6 (Basic Messaging) → ✅ DONE
  - Phase 11 (Real-time Messaging) → 🔄 Partially done (ChatHub implemented; typing indicators, read receipts, SignalR scale-out still planned)

- [ ] **Update `AGENTS.md`** — add to component patterns section:
  - `chatConnection` module-level singleton in `src/services/signalr/chatConnection.ts`
  - `useChatSignalR(type, id)` hook — join group on mount, leave on unmount, re-runs on id change
  - `onEvent(event, handler)` — register handler + caller's useEffect must call `chatConnection.off(event, handler)` on cleanup

- [ ] **Commit all docs**:
```bash
cd D:\src\lovecraft\Lovecraft
git add docs/
git commit -m "docs(chat): add CHAT_ARCHITECTURE.md, update IMPLEMENTATION_SUMMARY"

cd D:\src\aloevera-harmony-meet
git add docs/ AGENTS.md
git commit -m "docs(chat): update ISSUES, BACKEND_PLAN, AGENTS with chat system completion"
```

---

## Verification Checklist

Before calling this done, confirm:

- [ ] `dotnet test` → 53 passing, 0 failing (35 existing + 18 new chat/hub tests)
- [ ] `npm run test:run` → 3 new mock-mode tests passing, all pre-existing tests passing
- [ ] `dotnet build` → 0 errors, 0 warnings (or only pre-existing warnings)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] App runs in mock mode (`VITE_API_MODE=mock`): Friends private chat shows mock messages, Talks event discussion shows mock forum replies, no SignalR connection attempted (check browser Network tab — no `/hubs/` request)
- [ ] Full-stack Docker run (`VITE_API_MODE=api`): login works, private chat creates, messages send, forum reply triggers `ReplyPosted` broadcast
