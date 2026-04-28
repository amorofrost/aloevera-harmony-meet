# Infinite Scroll Pagination — Design Spec

**Date:** 2026-04-28  
**Scope:** Forum topics, forum replies, private chat messages  
**Repos:** `aloevera-harmony-meet` (frontend) + `lovecraft` (backend)

---

## Overview

Add efficient infinite-scroll pagination to three surfaces: chat messages, forum replies, and forum topics. Page sizes are stored in the `appconfig` Azure Table so they can be tuned without a rebuild.

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| UX pattern | Infinite scroll (IntersectionObserver) | Requested; feels native for all three surfaces |
| New-item behaviour while scrolled back | Badge + pending buffer | User holds position; flushes on tap or scroll to live edge |
| Messages / replies cursor | Azure row-key cursor (`RowKey > cursor`) | O(pageSize) per request; no full-partition scan |
| Topics pagination | Offset (`page` integer) | Topics per section are small and bounded; complex sort (pinned + UpdatedAt) requires in-memory sort regardless |
| Reply display order | **Newest first** (same as messages) | No schema change needed; `ForumReplies` already uses reversed ticks |
| Page sizes | `appconfig` Azure Table, `pagination` partition | Configurable at runtime |

---

## Section 1 — Data Layer

### `PagedResult<T>` (update)

**File:** `Lovecraft.Common/Models/ApiResponse.cs`

```csharp
public class PagedResult<T>
{
    public List<T> Items     { get; set; } = new();
    public int     PageSize  { get; set; }
    public bool    HasMore   { get; set; }
    public string? NextCursor { get; set; }  // row-key cursor; null for offset-based surfaces
    public int?    Total     { get; set; }   // filled when known (topics from sectionTopicCount, replies from topic.ReplyCount)
}
```

### `PaginationConfig` (new)

**File:** `Lovecraft.Backend/Services/IAppConfigService.cs` (add alongside `RankThresholds` / `PermissionConfig`)

```csharp
public class PaginationConfig
{
    public int MessagesInitial { get; set; } = 30;
    public int MessagesBatch   { get; set; } = 20;
    public int RepliesInitial  { get; set; } = 20;
    public int RepliesBatch    { get; set; } = 15;
    public int TopicsInitial   { get; set; } = 25;
    public int TopicsBatch     { get; set; } = 15;
}
```

Loaded from the `pagination` partition of the `appconfig` Azure Table. Falls back to the defaults above on missing or unparseable rows. `IAppConfigService` exposes `PaginationConfig Pagination { get; }`.

### `appconfig` table — new `pagination` partition

Six rows, one per config key. Seeder populates them. Row format matches existing `rank_thresholds` / `permissions` rows.

| PartitionKey | RowKey | Value |
|---|---|---|
| `pagination` | `messages_initial` | `30` |
| `pagination` | `messages_batch` | `20` |
| `pagination` | `replies_initial` | `20` |
| `pagination` | `replies_batch` | `15` |
| `pagination` | `topics_initial` | `25` |
| `pagination` | `topics_batch` | `15` |

### Azure query strategy

**Messages & replies** — cursor-based row-key range query:

- Both tables already use inverted/reversed tick RowKeys; newest items have the smallest RowKey.
- First page (no cursor): `QueryAsync` with `PartitionKey == pk`, take `pageSize + 1` rows. If `pageSize + 1` rows returned, `HasMore = true`; return only `pageSize` items. `NextCursor` = RowKey of the last (oldest) item returned.
- Subsequent pages: add filter `RowKey > cursor`, take `pageSize + 1` rows. Same `HasMore` logic.
- Result is returned in storage order (newest first). Client displays as-is.

**Forum topics** — in-memory offset:

- Query entire `section-{sectionId}` partition (bounded; a few hundred rows max).
- Sort: pinned first, then `UpdatedAt` descending.
- Apply `Skip((page-1) * pageSize).Take(pageSize + 1)` to get `HasMore`.
- `Total` = section's `TopicCount` (already stored on `ForumSectionEntity`).

**Mock services** simulate cursor-based pagination: sort the in-memory list newest-first, find the item whose `id == cursor` (or start of list when cursor is absent), then take the next `pageSize + 1` items from that position. The cursor returned to the client is the `id` of the last item in the result.

---

## Section 2 — Backend API Changes

### `GET /api/v1/chats/{id}/messages`

```
Before: ?page=1              → ApiResponse<List<MessageDto>>
After:  ?cursor={rowKey}     → ApiResponse<PagedResult<MessageDto>>
```

- `cursor` absent = first page → use `PaginationConfig.MessagesInitial`.
- `cursor` present = subsequent page → use `PaginationConfig.MessagesBatch`.
- `pageSize` echoed back in `PagedResult.PageSize`.

### `GET /api/v1/forum/topics/{topicId}/replies`

```
Before: (no params)          → ApiResponse<List<ForumReplyDto>>
After:  ?cursor={rowKey}     → ApiResponse<PagedResult<ForumReplyDto>>
```

- Same cursor mechanics as messages (absent = initial, present = batch).
- `Total` filled from `topic.ReplyCount`.

### `GET /api/v1/forum/sections/{sectionId}/topics`

```
Before: (no params)                                → ApiResponse<List<ForumTopicDto>>
After:  ?page=1                                    → ApiResponse<PagedResult<ForumTopicDto>>
```

- Page 1 = first `TopicsInitial` topics after sort.
- `Total` filled from `section.TopicCount`.

### `GET /api/v1/forum/event-discussions/{eventId}/topics`

Same `?page=` treatment as section topics.

All endpoints continue returning the `ApiResponse<T>` envelope; `T` changes from `List<X>` to `PagedResult<X>`.

---

## Section 3 — Frontend Architecture

### New hook: `useInfiniteScroll`

**File:** `src/hooks/useInfiniteScroll.ts`

```typescript
interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

// Returns { sentinelRef }
// Uses IntersectionObserver; guards against double-fires while load is in-flight.
```

One sentinel `<div ref={sentinelRef} />` per surface, placed at the trigger point.

### State shape

**Messages & replies:**
```typescript
const [items, setItems]         = useState<T[]>([]);
const [cursor, setCursor]       = useState<string | null>(null);
const [hasMore, setHasMore]     = useState(true);
const [isLoadingMore, setLoading] = useState(false);
const [pendingCount, setPending] = useState(0);   // badge count
const isAtLiveEdge              = useRef(true);
```

**Topics:**
```typescript
const [topics, setTopics]       = useState<ForumTopicDto[]>([]);
const [page, setPage]           = useState(1);
const [hasMore, setHasMore]     = useState(true);
const [isLoadingMore, setLoading] = useState(false);
```

### Badge / live-edge behaviour

- A second `IntersectionObserver` watches a sentinel at the **live end** of the list (newest message end for chat; newest reply end for replies).
- `isAtLiveEdge` ref is `true` when that sentinel is visible.
- When a SignalR event arrives:
  - If `isAtLiveEdge === true` → append directly, no badge.
  - If `isAtLiveEdge === false` → increment `pendingCount`, hold item in a `pendingItems` ref.
- Badge tap / live-edge sentinel becoming visible → flush `pendingItems` into state, reset `pendingCount`.

### Scroll position preservation (chat only)

Before prepending older messages: record `scrollHeight`. After React re-render: `scrollTop += newScrollHeight - savedScrollHeight`. Prevents viewport jump on upward load.

### API service updates

| Service | Change |
|---|---|
| `chatsApi.getMessages(chatId, cursor?, isInitial?)` | Replaces `page` with `cursor?`; returns `PagedResult<MessageDto>` |
| `forumsApi.getReplies(topicId, cursor?)` | New cursor param; returns `PagedResult<ForumReplyDto>` |
| `forumsApi.getTopics(sectionId, page?)` | New page param; returns `PagedResult<ForumTopicDto>` |
| `forumsApi.getEventDiscussionTopics(eventId, page?)` | New page param; returns `PagedResult<ForumTopicDto>` |

---

## Section 4 — Per-Surface UI

### Chat messages (`Friends.tsx`)

```
┌──────────────────────────────┐
│  [sentinel: load older]      │  ← top; fires when scrolled into view
│  ·· loading spinner ··       │
├──────────────────────────────┤
│  oldest loaded message       │
│  ...                         │
│  newest loaded message       │
├──────────────────────────────┤
│  [↓ 3 new messages]  badge   │  ← visible when pendingCount > 0
│  [live-edge sentinel]        │
│  message input               │
└──────────────────────────────┘
```

- Scroll direction: **upward** to load older.
- Existing `loadOlderMessages` handler replaced by `useInfiniteScroll`.
- `useChatSignalR` feed unchanged; routing to pending buffer vs direct append handled by `isAtLiveEdge`.

### Forum replies (`TopicDetail.tsx`)

```
┌──────────────────────────────┐
│  [live-edge sentinel]        │
│  [↑ 2 new replies]  badge    │  ← visible when pendingCount > 0
│  newest reply                │
│  ...                         │
│  oldest loaded reply         │
├──────────────────────────────┤
│  ·· loading spinner ··       │
│  [sentinel: load older]      │  ← bottom; fires when user scrolls past oldest reply
└──────────────────────────────┘
│  reply input box             │
```

- Scroll direction: **downward** to load older (newest reply pinned to top).
- "Showing X of Y replies" using `PagedResult.total`.

### Forum topics (`Talks.tsx`)

```
┌──────────────────────────────┐
│  📌 pinned topic             │
│  📌 pinned topic             │
│  topic                       │
│  ...                         │
│  last topic on page          │
├──────────────────────────────┤
│  ·· loading spinner ··       │
│  [sentinel: load more]       │  ← bottom
└──────────────────────────────┘
```

- No badge needed; topics have no real-time feed.
- "X topics" in section header using `PagedResult.total`.
- Same layout for event discussion topics.

### Loading states (all surfaces)

| State | Behaviour |
|---|---|
| Initial load | Full-area skeleton (existing pattern) |
| Loading more | Small spinner at sentinel position |
| All loaded | Sentinel removed from DOM (`hasMore = false`) |
| Error | `showApiError` toast; `hasMore` unchanged (retry on next scroll) |

---

## Files Changed

### Backend (`lovecraft`)

| File | Change |
|---|---|
| `Lovecraft.Common/Models/ApiResponse.cs` | Add `NextCursor?` and `Total?` to `PagedResult<T>` |
| `Lovecraft.Backend/Services/IAppConfigService.cs` | Add `PaginationConfig` class; add `Pagination` property to interface |
| `Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs` | Load `pagination` partition; populate `PaginationConfig` |
| `Lovecraft.Backend/Services/MockChatService.cs` | Cursor-based pagination from in-memory list |
| `Lovecraft.Backend/Services/Azure/AzureChatService.cs` | Replace in-memory skip/take with `RowKey > cursor` range query |
| `Lovecraft.Backend/Services/MockForumService.cs` | Cursor pagination for replies; offset pagination for topics |
| `Lovecraft.Backend/Services/Azure/AzureForumService.cs` | `RowKey > cursor` for replies; offset for topics |
| `Lovecraft.Backend/Controllers/V1/ChatsController.cs` | `?cursor=` param; return `PagedResult<MessageDto>` |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | `?cursor=` for replies; `?page=` for topics; return `PagedResult<T>` |
| `Lovecraft.Tools.Seeder/Program.cs` | Seed `pagination` partition in `appconfig` table |

### Frontend (`aloevera-harmony-meet`)

| File | Change |
|---|---|
| `src/types/` | Add `PagedResult<T>` TypeScript type |
| `src/hooks/useInfiniteScroll.ts` | New hook (IntersectionObserver-based) |
| `src/services/api/chatsApi.ts` | `cursor` + `isInitial` params; typed return |
| `src/services/api/forumsApi.ts` | `cursor` / `page` params; typed returns |
| `src/pages/Friends.tsx` | Infinite scroll upward for messages; live-edge sentinel; badge |
| `src/components/forum/TopicDetail.tsx` | Infinite scroll downward for replies; live-edge sentinel; badge |
| `src/pages/Talks.tsx` | Infinite scroll downward for topics and event discussions |
