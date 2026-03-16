# Chat System with SignalR — Design Spec

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Backend (.NET 10) + Frontend (React/TypeScript)

---

## 1. Overview

Implement a real-time chat system for AloeVera Harmony Meet covering private 1:1 chats (matched users) and live updates for forum/event topic discussions. Real-time delivery uses SignalR on the backend and the `@microsoft/signalr` client on the frontend.

**Mock mode compatibility is a hard requirement.** The frontend must work completely without SignalR or any backend dependency when `VITE_API_MODE=mock`.

---

## 2. System Boundaries

| Feature | System | Notes |
|---|---|---|
| Private chats (1:1, matched users) | New `IChatService` + `ChatHub` | New REST + SignalR |
| Event discussions | Existing `IForumService` + forum reply endpoints | Auto-created forum topic per event |
| Forum topic live updates | `ChatHub` side-effect broadcast | One extra line in `ForumController` |
| Forum reply persistence | Unchanged | Existing REST endpoints |

Event group discussions are **not** a separate chat system. They are forum topics auto-created when an event is created (or lazily on first access). The same `IForumService.CreateReplyAsync` handles persistence; the `ChatHub` broadcasts the `ReplyPosted` event to viewers.

---

## 3. Backend Architecture

### 3.1 New Service Interface

```csharp
// Lovecraft.Backend/Services/IServices.cs (addition)
public interface IChatService
{
    Task<List<ChatDto>> GetChatsAsync(string userId);
    Task<ChatDto> GetOrCreateChatAsync(string userId, string targetUserId);
    Task<List<MessageDto>> GetMessagesAsync(string chatId, string userId, int page = 1, int pageSize = 50);
    Task<MessageDto> SendMessageAsync(string chatId, string userId, string content);
    Task<bool> ValidateAccessAsync(string chatId, string userId);
}
```

### 3.2 REST Endpoints — `ChatsController`

All endpoints require `[Authorize]`.

```
GET  /api/v1/chats                          — list current user's chats (from UserChats index)
GET  /api/v1/chats/{id}/messages?page=1     — paginated message history (50 per page)
POST /api/v1/chats                          — get-or-create chat { targetUserId }
POST /api/v1/chats/{id}/messages            — REST send fallback { content }
```

`POST /api/v1/chats` is **idempotent**: returns the existing chat if one already exists between the two users, or creates and returns a new one.

### 3.3 SignalR Hub — `ChatHub`

**Endpoint**: `/hubs/chat`
**Authentication**: JWT bearer token (same middleware as REST controllers)

**Hub groups:**
- `chat-{chatId}` — both participants join when they connect and call `JoinChat(chatId)`
- `topic-{topicId}` — any client viewing a forum/event topic calls `JoinTopic(topicId)`

**Hub methods (client → server):**

```csharp
Task JoinChat(string chatId)    // validates access, adds to group
Task JoinTopic(string topicId)  // no access validation — topics are semi-public
Task LeaveGroup(string groupId) // client calls on unmount
Task SendMessage(string chatId, string content) // persists + broadcasts
```

**Server → client events:**
- `MessageReceived(MessageDto)` — broadcast to `chat-{chatId}` group
- `ReplyPosted(ForumReplyDto, string topicId)` — broadcast to `topic-{topicId}` group

**Forum extension** — one addition to `ForumController.CreateReply`:
```csharp
await _hubContext.Clients.Group($"topic-{topicId}").SendAsync("ReplyPosted", reply, topicId);
```

### 3.4 Azure Table Storage — 3 New Tables (15 → 18)

**`Chats` table** — canonical chat metadata
```
PartitionKey : "CHAT"
RowKey       : {chatId}
Properties   : ParticipantIds (comma-separated), Type, CreatedAt
```

**`UserChats` index table** — per-user fast lookup (same pattern as `LikesReceived`)
```
PartitionKey : {userId}
RowKey       : {chatId}
Properties   : OtherUserId, LastMessageContent, LastMessageAt, UnreadCount, UpdatedAt
```
Write amplification: each `SendMessageAsync` updates 2 `UserChats` rows (one per participant).
`GetChatsAsync(userId)` = single partition query on `UserChats` — no full table scan.

**`Messages` table** — message stream per chat
```
PartitionKey : {chatId}
RowKey       : {invertedTimestamp}_{messageId}   (inverted = DateTimeOffset.MaxValue.Ticks - message.Ticks)
Properties   : SenderId, Content, Timestamp, Type, Read
```
Inverted timestamp means Azure's lexicographic sort naturally returns newest messages first.

### 3.5 Implementations

**`MockChatService`** — in-memory, seeded from `MockDataStore`. Used when `USE_AZURE_STORAGE=false`. No SignalR calls (hub is not wired to mock service in tests).

**`AzureChatService`** — Azure Table Storage, used when `USE_AZURE_STORAGE=true`. Reads/writes all three tables above.

**`Program.cs`** additions:
```csharp
builder.Services.AddSignalR();
// DI registration (same pattern as other services):
if (useAzureStorage)
    builder.Services.AddScoped<IChatService, AzureChatService>();
else
    builder.Services.AddScoped<IChatService, MockChatService>();
// ...
app.MapHub<ChatHub>("/hubs/chat");
```

### 3.6 NuGet Package

`Microsoft.AspNetCore.SignalR` is included in the ASP.NET Core 10 framework — no additional NuGet package needed.

---

## 4. Frontend Architecture

### 4.1 Fix Duplicate `Message` Interface (Issue #7)

Remove `Message` from `src/types/user.ts`. Update `Match` interface to import `Message` from `chat.ts`. Single source of truth before building on top of it.

### 4.2 `chatsApi.ts` — Dual-Mode Update

Follows the identical pattern as `eventsApi.ts`, `forumsApi.ts`, etc.

```typescript
// Mock branch — unchanged, returns existing mock data
// API branch — calls real endpoints:
getChats()                          → GET /api/v1/chats
getMessages(chatId, page)           → GET /api/v1/chats/{id}/messages?page={page}
getOrCreateChat(targetUserId)       → POST /api/v1/chats
sendMessage(chatId, content)        → POST /api/v1/chats/{id}/messages
```

### 4.3 SignalR Connection Singleton — `src/services/signalr/chatConnection.ts`

Module-level singleton, consistent with `apiClient.ts` pattern. Components never need to check `isApiMode()` themselves — the connection object handles it transparently.

```typescript
interface ChatConnection {
  connect(): Promise<void>       // no-op if !isApiMode()
  disconnect(): Promise<void>
  joinGroup(groupId: string): Promise<void>
  leaveGroup(groupId: string): Promise<void>
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
  sendMessage(chatId: string, content: string): Promise<void>
  readonly isConnected: boolean  // always false in mock mode
}
```

Connection URL: `${VITE_API_BASE_URL}/hubs/chat` with JWT bearer token from `apiClient.getAccessToken()`.

Reconnection: uses SignalR client's built-in automatic reconnect (`withAutomaticReconnect()`).

### 4.4 `useChatSignalR(groupId: string)` Hook

Thin wrapper over `chatConnection`. Lives in `src/hooks/useChatSignalR.ts`.

```typescript
function useChatSignalR(groupId: string): {
  sendMessage: (chatId: string, content: string) => Promise<void>
  isConnected: boolean
}
```

- Calls `chatConnection.connect()` on first mount (idempotent — singleton connects once)
- Calls `joinGroup(groupId)` on mount, `leaveGroup(groupId)` on unmount
- In mock mode: `sendMessage` is a no-op, `isConnected` is `false`
- Event subscriptions (`on`/`off`) are managed per-component at the call site

### 4.5 `Friends.tsx` — Private Chat Updates

- On opening a chat: call `chatsApi.getOrCreateChat(targetUserId)` to get/create the chat, then `chatsApi.getMessages(chatId)` to load history
- Replace single mock `lastMessage` display with full scrollable message list
- `useChatSignalR("chat-{chatId}")` — subscribe to `MessageReceived`, append to local message list
- Send: `chatsApi.sendMessage(chatId, content)` via REST; sender appends the returned `MessageDto` locally (no round-trip wait for SignalR echo)
- Pagination: "load more" button fetches `page + 1`

### 4.6 `Talks.tsx` — Event Discussion Updates

- Each event exposes a `forumTopicId` field (set when event is created or on first access)
- Event discussion tab calls `forumsApi.getTopic(event.forumTopicId)` and `forumsApi.getReplies(topicId)` — **same endpoints already used by `TopicDetail.tsx`**
- Sending a reply: existing `forumsApi.createReply(topicId, content)` — no change
- `useChatSignalR("topic-{topicId}")` — subscribe to `ReplyPosted`, append new reply to local list
- In mock mode: tab renders using existing mock forum data; no SignalR

---

## 5. Data Flow — Private Chat Message

```
User types message → hits Send
    ↓
chatsApi.sendMessage(chatId, content)   [REST POST]
    ↓
ChatsController → IChatService.SendMessageAsync()
    ↓ (parallel)
    ├── Writes to Messages table
    ├── Updates both UserChats rows (sender + recipient lastMessage)
    └── ChatHub broadcasts MessageReceived(dto) to "chat-{chatId}" group
    ↓
REST returns MessageDto → sender appends to local list immediately
Recipient's useChatSignalR onMessageReceived → appends to their list
```

## 6. Data Flow — Forum/Event Reply with Live Update

```
User posts reply → forumsApi.createReply(topicId, content)   [REST POST — unchanged]
    ↓
ForumController → IForumService.CreateReplyAsync()  [unchanged]
    + IHubContext<ChatHub>.SendAsync("ReplyPosted", reply, topicId)  [one new line]
    ↓
REST returns ForumReplyDto → poster appends locally
Other viewers' useChatSignalR onReplyPosted → appends to their list
```

---

## 7. Testing

### Backend — `ChatTests.cs` (13 new tests, 35 → 48 total)

**`MockChatService` tests (8):**
1. `GetChatsAsync` returns only chats where userId is a participant
2. `GetOrCreateChatAsync` creates a new chat between two users
3. `GetOrCreateChatAsync` returns existing chat if already exists (idempotent)
4. `GetMessagesAsync` returns messages for a valid participant
5. `GetMessagesAsync` returns empty/error for non-participant
6. `SendMessageAsync` persists message and updates `lastMessage` on both `UserChats` rows
7. `ValidateAccessAsync` returns `true` for participant, `false` for non-participant
8. `SendMessageAsync` to non-existent chat returns error response

**`ChatHub` tests (5):**
1. `SendMessage` calls `IChatService.SendMessageAsync` and broadcasts to group
2. `SendMessage` rejects when user is not a participant (`ValidateAccessAsync` returns false)
3. `JoinTopic` adds caller to `topic-{topicId}` group
4. Connection without valid JWT is rejected (401)
5. `SendMessage` with empty/whitespace content returns validation error

### Frontend — `chatsApi.test.ts` (3 new tests)

1. Mock mode returns mock chats without any HTTP call
2. `chatConnection.connect()` is never called in mock mode
3. `useChatSignalR` returns `isConnected: false` and no-op `sendMessage` in mock mode

---

## 8. Documentation Updates

| File | Change |
|---|---|
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | Add chat endpoints, `ChatHub`, 3 new tables, 48 tests |
| `lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md` | New file: hub design, group naming, storage schema, mock vs Azure |
| `aloevera-harmony-meet/docs/ISSUES.md` | Mark chat backend as resolved; mark Issue #7 as resolved |
| `aloevera-harmony-meet/docs/BACKEND_PLAN.md` | Phase 6 → ✅ DONE, Phase 11 → partially done |
| `aloevera-harmony-meet/AGENTS.md` | Add `chatConnection` singleton pattern, `useChatSignalR` hook |

---

## 9. Out of Scope

- Songs backend endpoints (separate task)
- Group DMs (non-event group chats)
- Typing indicators
- Read receipts beyond basic `read` boolean
- Image messages (`MessageType.Image`) — content only for now
- Push notifications
- Message deletion or editing
- OAuth / Telegram auth
