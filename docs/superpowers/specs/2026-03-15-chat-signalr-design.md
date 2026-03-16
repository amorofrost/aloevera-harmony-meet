# Chat System with SignalR — Design Spec

**Date**: 2026-03-15
**Status**: Approved (v2 — post spec-review fixes)
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
| Event discussions | Existing `IForumService` + forum reply endpoints | Forum topic auto-created per event |
| Forum topic live updates | `ChatHub` side-effect broadcast | One extra line in `ForumController` |
| Forum reply persistence | Unchanged | Existing REST endpoints |

Event group discussions are **not** a separate chat system. They are forum topics linked to each event via a `ForumTopicId` field on the event. The same `IForumService.CreateReplyAsync` handles persistence; `ChatHub` broadcasts the `ReplyPosted` event to viewers.

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
GET  /api/v1/chats/{id}/messages?page=1     — paginated message history (50 per page, oldest-first)
POST /api/v1/chats                          — get-or-create chat { targetUserId }
POST /api/v1/chats/{id}/messages            — REST send fallback { content }
```

**`POST /api/v1/chats` request body:**
```json
{ "targetUserId": "string" }
```
This is a **new, simpler DTO** — `CreatePrivateChatRequestDto` with a single `TargetUserId` property. The existing `CreateChatRequestDto` (with `Type`, `Name`, `ParticipantIds`, `EventId`) is retained in `Lovecraft.Common` for potential future group chat use but is not used by this endpoint.

`POST /api/v1/chats` is **idempotent**: returns the existing chat if one already exists between the two users, or creates and returns a new one.

**Message ordering:** `GET /api/v1/chats/{id}/messages` returns messages oldest-first (ascending by timestamp) after the server re-reverses the inverted-timestamp storage order. The frontend paginates backward with `page` — page 1 = most recent 50, page 2 = the 50 before that. The client prepends older pages to the top of the message list.

### 3.3 SignalR Hub — `ChatHub`

**Endpoint**: `/hubs/chat`

**Authorization:** Hub class decorated with `[Authorize]`. JWT token is read from the query string parameter `access_token` during SignalR negotiation (standard ASP.NET Core SignalR pattern — see section 3.5 for `Program.cs` config).

**Hub groups:**
- `chat-{chatId}` — both participants join when they call `JoinChat(chatId)`
- `topic-{topicId}` — any client viewing a forum/event topic calls `JoinTopic(topicId)`

**Hub methods (client → server):**

```csharp
Task JoinChat(string chatId)    // validates access via IChatService.ValidateAccessAsync; rejects if not participant
Task JoinTopic(string topicId)  // no access validation — any authenticated user may join
Task LeaveGroup(string groupId) // client calls on component unmount
Task SendMessage(string chatId, string content) // validates, persists, broadcasts
```

**Server → client events:**
- `MessageReceived(MessageDto)` — broadcast to `chat-{chatId}` group **excluding the caller** (`Clients.OthersInGroup`) to avoid sender duplicates; caller gets the message from the REST response
- `ReplyPosted(ForumReplyDto, string topicId)` — broadcast to `topic-{topicId}` group (from `ForumController`, not the hub)

**Forum extension** — one addition to `ForumController.CreateReply`:
```csharp
await _hubContext.Clients.Group($"topic-{topicId}").SendAsync("ReplyPosted", reply, topicId);
```

### 3.4 Event Discussion — `forumTopicId` Provisioning

Each event needs a linked forum topic for its discussion. This is managed via a `ForumTopicId` field added to `EventEntity` and `EventDto`.

**Who creates the topic:** Lazily, in `EventsController.GetEvent(id)`. On the first `GET /api/v1/events/{id}` call where `event.ForumTopicId` is null:
1. `IForumService.CreateEventTopicAsync(eventId, eventName)` creates a topic in a reserved forum section (`sectionId = "events"`)
2. `IEventService.SetForumTopicIdAsync(eventId, topicId)` persists the link on the event
3. The returned `EventDto` includes the newly set `ForumTopicId`

Subsequent calls return the already-linked `ForumTopicId` with no creation overhead.

**`EventDto` change:**
```csharp
public string? ForumTopicId { get; set; }  // null until first event detail fetch
```

**Frontend `Event` type change:**
```typescript
forumTopicId?: string  // added to Event interface in src/types/user.ts
```

**Frontend null handling in `Talks.tsx`:** if `event.forumTopicId` is null (event was never opened in detail view), call `eventsApi.getEvent(eventId)` to trigger lazy creation, then use the returned `forumTopicId`. Show a loading spinner during this step.

**New forum section for events:** a seeded `ForumSection` with `id = "events"`, `name = "Events"`, not shown in the regular forum section list (filtered by a flag or excluded by the forum sections query). This keeps event discussions out of the forum's public section list.

### 3.5 Azure Table Storage — 3 New Tables (15 → 18)

**`Chats` table** — canonical chat metadata

```
PartitionKey : "CHAT"
RowKey       : {chatId}
Properties   : ParticipantIds (comma-separated), CreatedAt
```

> **Trade-off note:** `PartitionKey = "CHAT"` places all chat metadata in one partition, which limits throughput to ~2,000 RPS on this partition. This is acceptable for the current project scale (small user base). The `UserChats` index handles all read-heavy listing. The `Chats` table is only queried for single-chat lookups (`GetOrCreateChatAsync`), not for list operations. If scale becomes a concern, re-partitioning by `{firstUserId}` is a future migration path.

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
RowKey       : {invertedTicks}_{messageId (GUID)}
Properties   : SenderId, Content, Timestamp, Type, Read
```

`invertedTicks = DateTimeOffset.MaxValue.Ticks - message.Timestamp.Ticks`

Azure Table Storage returns rows in ascending RowKey order within a partition. Inverted ticks means the most recent messages sort first in storage. The API layer **re-reverses** before returning (oldest-first to the client), so page 1 = query top 50 from storage = most recent 50, returned to client in ascending time order.

`messageId` is a GUID — the combined `{invertedTicks}_{guid}` RowKey is collision-proof even for sub-millisecond concurrent sends.

### 3.6 Implementations

**`MockChatService`** — in-memory, seeded from `MockDataStore`. Registered as **`AddSingleton`** (same as all other mock services) to preserve in-memory state across requests. No SignalR calls.

**`AzureChatService`** — Azure Table Storage, registered as **`AddSingleton`**. Reads/writes all three tables. `GetOrCreateChatAsync` uses Azure Table Storage conditional insert (ETag `*` on insert fails if row already exists) to handle concurrent chat creation — whichever insert wins, both callers receive the same existing chat.

### 3.7 `Program.cs` Additions

```csharp
// SignalR
builder.Services.AddSignalR();

// IChatService registration (same pattern as other services)
if (useAzureStorage)
    builder.Services.AddSingleton<IChatService, AzureChatService>();
else
    builder.Services.AddSingleton<IChatService, MockChatService>();

// JWT: read token from query string for SignalR connections
builder.Services.AddAuthentication(...)
    .AddJwtBearer(options => {
        // existing options ...
        options.Events = new JwtBearerEvents {
            OnMessageReceived = context => {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs")) {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// CORS: extend existing policy to cover SignalR hub path
// (AllowedOrigins already includes production frontend origin — verify in appsettings)

// Hub routing (after app.UseAuthorization())
app.MapHub<ChatHub>("/hubs/chat");
```

### 3.8 nginx Configuration Update

The production nginx config requires a new location block for WebSocket upgrade (without this, SignalR falls back to long-polling and ultimately fails):

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

This must be added to `nginx.conf` in `aloevera-harmony-meet/` alongside the existing `/api/` and `/swagger` location blocks.

---

## 4. Frontend Architecture

### 4.1 Fix Duplicate `Message` Interface (Issue #7 — prerequisite)

Remove `Message` from `src/types/user.ts`. Update `Match` interface to import `Message` from `chat.ts`. Done before any chat feature work.

### 4.2 `chatsApi.ts` — Dual-Mode Update + `getEventChats()` Retirement

**`getEventChats()` is removed.** Event discussions are now served via `forumsApi` (topic + replies). The `GroupChat` type remains in `chat.ts` for reference but is no longer used in `Talks.tsx`.

New methods follow the identical dual-mode pattern as `eventsApi.ts`:

```
// Mock branch — returns existing mock private chats from mockChats.ts
// API branch:
getChats()                                   → GET /api/v1/chats
getMessages(chatId: string, page: number)    → GET /api/v1/chats/{id}/messages?page={page}
getOrCreateChat(targetUserId: string)        → POST /api/v1/chats { targetUserId }
sendMessage(chatId: string, content: string) → POST /api/v1/chats/{id}/messages { content }
```

### 4.3 SignalR Connection Singleton — `src/services/signalr/chatConnection.ts`

Module-level singleton, consistent with `apiClient.ts` pattern. All methods are no-ops when `!isApiMode()`. Components never check `isApiMode()` themselves.

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

Connection URL: `${VITE_API_BASE_URL}/hubs/chat?access_token={token}` using `apiClient.getAccessToken()` (already a public method — no change needed).

Reconnection: SignalR client's built-in `withAutomaticReconnect()`.

### 4.4 `useChatSignalR(groupId: string)` Hook

Lives in `src/hooks/useChatSignalR.ts`. Exposes `on`/`off` wrappers with **automatic cleanup on unmount** via `useEffect` return — components never call `chatConnection.on/off` directly.

```typescript
function useChatSignalR(groupId: string): {
  sendMessage: (chatId: string, content: string) => Promise<void>
  isConnected: boolean
  onEvent: (event: string, handler: (...args: any[]) => void) => void
  // onEvent registers the handler AND schedules off() cleanup on unmount
}
```

The hook's internal `useEffect` has `[groupId]` in its dependency array, so `joinGroup`, `leaveGroup`, and all handler cleanups re-run whenever `groupId` changes (e.g. navigating from one chat to another). This prevents stale handlers accumulating on the module-level singleton across group changes.

Usage pattern:
```typescript
const { sendMessage, isConnected, onEvent } = useChatSignalR(`chat-${chatId}`);
useEffect(() => {
  onEvent('MessageReceived', (msg: MessageDto) => setMessages(prev => [...prev, msg]));
}, [chatId]); // re-registers handler when chatId changes
```

The `onEvent` call registers via `chatConnection.on(event, handler)` and the hook's `useEffect` cleanup calls `chatConnection.off(event, handler)` on unmount or on `groupId` change. No handler leaks on the singleton.

### 4.5 `Friends.tsx` — Private Chat Updates

- On opening a chat: call `chatsApi.getOrCreateChat(targetUserId)` → get chatId → `chatsApi.getMessages(chatId, 1)` for initial history
- Full scrollable message list replaces single `lastMessage` display
- `useChatSignalR("chat-{chatId}")` → `onEvent('MessageReceived', ...)` appends incoming messages
- Send: `chatsApi.sendMessage(chatId, content)` via REST; sender appends returned `MessageDto` locally (hub broadcasts to `OthersInGroup` only — no duplicate)
- "Load older" button fetches `page + 1`, prepends to message list

### 4.6 `Talks.tsx` — Event Discussion Updates (state model replacement)

**Replaces `getEventChats()` entirely.** New flow:

1. Event list renders from existing `eventsApi.getEvents()` (unchanged)
2. On selecting an event for discussion:
   - Call `eventsApi.getEvent(eventId)` to get `forumTopicId` (triggers lazy creation if null)
   - Show loading spinner during this fetch
   - Once `forumTopicId` is available, call `forumsApi.getTopic(topicId)` + `forumsApi.getReplies(topicId)` — same endpoints used by `TopicDetail.tsx`
3. Replies rendered using the same reply list UI pattern as `TopicDetail.tsx` (reuse or extract component)
4. Send reply: existing `forumsApi.createReply(topicId, content)` — no change to sending
5. `useChatSignalR("topic-{topicId}")` → `onEvent('ReplyPosted', ...)` appends new replies live

In mock mode: event discussion tab renders using mock event data + mock forum data; no SignalR; `forumTopicId` is set to a mock topic id in `mockEvents.ts`.

---

## 5. Data Flow — Private Chat Message

```
User types message → hits Send
    ↓
chatsApi.sendMessage(chatId, content)   [REST POST /api/v1/chats/{id}/messages]
    ↓
ChatsController → IChatService.SendMessageAsync()
    ├── Writes MessageEntity to Messages table
    ├── Updates both UserChats rows (sender + recipient LastMessage*)
    └── ChatHub broadcasts MessageReceived(dto) to "chat-{chatId}" OthersInGroup
    ↓
REST returns MessageDto → sender appends to local list immediately
Recipient's useChatSignalR MessageReceived handler → appends to their list
```

## 6. Data Flow — Forum/Event Reply with Live Update

```
User posts reply → forumsApi.createReply(topicId, content)   [REST POST — unchanged]
    ↓
ForumController → IForumService.CreateReplyAsync()   [unchanged]
    + IHubContext<ChatHub>.Clients.Group($"topic-{topicId}").SendAsync("ReplyPosted", reply, topicId)
    ↓
REST returns ForumReplyDto → poster appends locally
Other viewers' useChatSignalR ReplyPosted handler → appends to their list
```

---

## 7. Testing

### Backend — `ChatTests.cs` (13 new tests, 35 → 48 total)

**`MockChatService` tests (8):**
1. `GetChatsAsync` returns only chats where userId is a participant
2. `GetOrCreateChatAsync` creates a new chat between two users
3. `GetOrCreateChatAsync` returns existing chat if one already exists (idempotent)
4. `GetOrCreateChatAsync` called concurrently by both users returns same chatId to both
5. `GetMessagesAsync` returns messages oldest-first for a valid participant
6. `GetMessagesAsync` returns empty for non-participant (access denied)
7. `SendMessageAsync` persists message and updates `LastMessage` on both `UserChats` rows
8. `ValidateAccessAsync` returns `true` for participant, `false` for non-participant

**`ChatHub` tests (5):**
1. `SendMessage` calls `IChatService.SendMessageAsync` and broadcasts to group excluding caller
2. `SendMessage` rejects when `ValidateAccessAsync` returns false
3. `JoinTopic` adds caller to `topic-{topicId}` group without access check
4. Connection without valid JWT is rejected (401)
5. `SendMessage` with empty/whitespace content returns validation error

### Frontend — `chatsApi.test.ts` (3 new tests)

1. Mock mode returns mock private chats without any HTTP call
2. `chatConnection.connect()` is never called when `isApiMode()` is false
3. `useChatSignalR` returns `isConnected: false` and no-op `sendMessage` in mock mode

---

## 8. Documentation Updates

| File | Change |
|---|---|
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | Add chat endpoints, `ChatHub`, 3 new tables, 48 tests |
| `lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md` | New: hub design, group naming, storage schema, nginx config, mock vs Azure |
| `aloevera-harmony-meet/nginx.conf` | Add `/hubs/` location block for WebSocket upgrade |
| `aloevera-harmony-meet/docs/ISSUES.md` | Mark chat backend + Issue #7 as resolved |
| `aloevera-harmony-meet/docs/BACKEND_PLAN.md` | Phase 6 → ✅ DONE, Phase 11 → partially done |
| `aloevera-harmony-meet/AGENTS.md` | Add `chatConnection` singleton, `useChatSignalR` hook, `onEvent` cleanup pattern |

---

## 9. Out of Scope

- Songs backend endpoints (separate task)
- Group DMs (non-event, non-forum group chats)
- Typing indicators
- Read receipts (beyond the `Read` boolean stored per message)
- Image messages (`MessageType.Image`) — text content only
- Push notifications
- Message deletion or editing
- OAuth / Telegram auth
- SignalR scale-out (Redis backplane) — single instance only
