# Design Spec: Forum Topic Creation (MCF.2)

**Date**: 2026-03-16
**Status**: Approved
**Scope**: Add the ability for authenticated users to create new forum topics within a section. Covers backend endpoint, both service implementations, cache invalidation, frontend modal form, API service method, validation schema, unit tests, and documentation updates.

---

## Problem

Users can only reply to existing forum topics. There is no UI, no `forumsApi.createTopic()` method, and no backend endpoint for creating new topics. The entire forum is seeded-only content. `CreateTopicRequestDto` exists in `ForumDtos.cs` but is unused.

Additionally, `ForumController` currently hardcodes `"current-user"` as the author ID instead of extracting it from the JWT — this must be fixed as part of this work.

---

## Solution

Add `POST /api/v1/forum/sections/{sectionId}/topics` to the backend, implement it in both `MockForumService` and `AzureForumService`, invalidate the relevant cache entries, and add a bottom-sheet modal in `Talks.tsx` that opens when the user taps a "New Topic" button within a section view.

---

## API

### Endpoint

```
POST /api/v1/forum/sections/{sectionId}/topics
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "string",
  "content": "string"
}
```

**Response** (`200 OK`): consistent with all other existing endpoints in the project which return `Ok()` for mutations.
```json
{
  "success": true,
  "data": { /* ForumTopicDto */ },
  "error": null,
  "timestamp": "..."
}
```

**Error responses**:
- `400 Bad Request` — validation failure (title/content missing or out of range)
- `401 Unauthorized` — no valid JWT
- `404 Not Found` — `sectionId` does not exist

### Validation (server-side, applied to `CreateTopicRequestDto`)

| Field | Rule |
|---|---|
| `Title` | Required, 5–100 characters |
| `Content` | Required, 10–5000 characters |

**Changes to `CreateTopicRequestDto`** in `ForumDtos.cs`:
1. **Remove** the `SectionId` property — `sectionId` comes from the route parameter, not the body
2. **Add** data annotation attributes so `ModelState` validation works:

```csharp
public class CreateTopicRequestDto
{
    [Required]
    [StringLength(100, MinimumLength = 5)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(5000, MinimumLength = 10)]
    public string Content { get; set; } = string.Empty;
}
```

---

## Backend

### `IForumService` — new method

```csharp
Task<ForumTopicDto> CreateTopicAsync(
    string sectionId,
    string authorId,
    string authorName,
    string title,
    string content);
```

`authorAvatar` is omitted — the JWT does not contain an avatar claim and `CreateReplyAsync` follows the same pattern (no avatar parameter). The returned `ForumTopicDto.AuthorAvatar` will be `null`.

### `MockForumService.CreateTopicAsync`

1. Look up the section in `MockDataStore.ForumSections` — throw `KeyNotFoundException` if not found
2. Generate a new GUID topic ID
3. Build a `ForumTopicDto` with `IsPinned = false`, `IsLocked = false`, `ReplyCount = 0`, `CreatedAt = UpdatedAt = DateTime.UtcNow`
4. Append to `MockDataStore.ForumTopics`
5. Increment the section's `TopicCount`
6. Return the new `ForumTopicDto`

### `AzureForumService.CreateTopicAsync`

1. Verify section exists by querying `forumsections` (PK=`"FORUM"`, RK=`sectionId`) — throw `KeyNotFoundException` if not found (controller catches and returns 404)
2. Insert `ForumTopicEntity` into `forumtopics` (PK=`section-{sectionId}`, RK=`topicId`) with `IsPinned = false`, `IsLocked = false`, `ReplyCount = 0`
3. Insert `ForumTopicIndexEntity` into `forumtopicindex` (PK=`"TOPICINDEX"`, RK=`topicId`, SectionId=`sectionId`) — same pattern as `CreateEventTopicAsync`
4. Increment `TopicCount` on the `ForumSectionEntity` via read-merge-upsert
5. Return the mapped `ForumTopicDto`

### `CachingForumService.CreateTopicAsync`

Delegates to inner service, then invalidates using the existing private key helpers:
- `TopicsKey(sectionId)` → `$"forum:topics:{sectionId}"` — topic list for the section is stale
- `SectionsKey` → `"forum:sections"` — the sections list caches `TopicCount`; invalidate so the updated count is served on next request

```csharp
public async Task<ForumTopicDto> CreateTopicAsync(
    string sectionId, string authorId, string authorName, string title, string content)
{
    var result = await _inner.CreateTopicAsync(sectionId, authorId, authorName, title, content);
    _cache.Remove(TopicsKey(sectionId));
    _cache.Remove(SectionsKey);
    return result;
}
```

### `ForumController` — new action

```csharp
[HttpPost("sections/{sectionId}/topics")]
public async Task<IActionResult> CreateTopic(string sectionId, [FromBody] CreateTopicRequestDto request)
```

- Validate `ModelState` — return `BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("VALIDATION_ERROR", "Validation failed"))` if invalid
- Extract `authorId` via `User.FindFirst(ClaimTypes.NameIdentifier)?.Value`
- Extract `authorName` via `User.FindFirst(ClaimTypes.Name)?.Value`
- Call `_forumService.CreateTopicAsync(sectionId, authorId, authorName, request.Title, request.Content)`
- Catch `KeyNotFoundException` → return `NotFound(ApiResponse<ForumTopicDto>.ErrorResponse("NOT_FOUND", "Section not found"))`
- Return `Ok(ApiResponse<ForumTopicDto>.SuccessResponse(result))`

**Also fix** the hardcoded `"current-user"` author ID in the existing `CreateReply` action — replace with the same `User.FindFirst(ClaimTypes.NameIdentifier)?.Value` pattern.

---

## Frontend

### `src/lib/validators.ts` — new schema

```typescript
export const createTopicSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100, 'Title is too long'),
  content: z.string().trim().min(10, 'Content must be at least 10 characters').max(5000, 'Content is too long'),
});
export type CreateTopicFormData = z.infer<typeof createTopicSchema>;
```

### `src/services/api/forumsApi.ts` — new method

```typescript
async createTopic(sectionId: string, title: string, content: string): Promise<ApiResponse<ForumTopicDetail>>
```

Returns `ForumTopicDetail` (not `ForumTopic`) because `TopicDetail.tsx` renders from a `ForumTopicDetail` object — it needs `content`, `authorId`, `replies`, and timestamps that `ForumTopic` does not carry.

- **Mock mode**:
  1. Build a `ForumTopicDetail` stub with a random ID, `content`, `authorId: 'current-user'`, `authorName: 'Вы'` (matching the existing `createReply` mock pattern), empty `replies` array, and current timestamps
  2. Push a `ForumTopic` stub into `mockForumSections.find(s => s.id === sectionId)!.topics` — required fields: `id`, `sectionId`, `title`, `authorName: 'Вы'`, `replyCount: 0`, `lastActivity: new Date()`, `isPinned: false`, `preview: content.substring(0, 100)`
  3. Increment the matching section's `topicCount`
  4. Store the `ForumTopicDetail` stub in `mockTopicDetails[newId]` (the same record used by `getTopic`) so a subsequent `getTopic(id)` call in mock mode resolves correctly
  5. Return wrapped in `ApiResponse`

- **API mode**: `POST /api/v1/forum/sections/{sectionId}/topics` with `{ title, content }` body; use the existing `mapTopicDetailFromApi(dto, [])` helper (already defined in `forumsApi.ts` at line 21) to map the `ForumTopicDto` response to `ForumTopicDetail` with an empty replies array

### `src/components/forum/CreateTopicModal.tsx` — new component

A shadcn `Dialog` component containing:
- **Title field**: text input, wired to `useForm<CreateTopicFormData>({ resolver: zodResolver(createTopicSchema) })`
- **Content field**: `<textarea>`, same form
- **Cancel button**: closes modal, calls `form.reset()`
- **Post Topic button**: submits; disabled + shows spinner during request; calls `showApiError` on failure; calls `onCreated(topic)` on success

Props:
```typescript
interface CreateTopicModalProps {
  sectionId: string;
  sectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (topic: ForumTopicDetail) => void;
}
```

### `src/pages/Talks.tsx` — changes

1. **"+ New Topic" button** — rendered in the section topic list header (next to section title), visible only when a section is selected. Controlled by a `useState<boolean>` (`createModalOpen`).

2. **`onCreated` handler**:
   - Receives the `ForumTopicDetail` returned by `createTopic`
   - Updates local `forumSections` state: finds the active section and prepends a `ForumTopic` stub with `{ id: topic.id, sectionId, title: topic.title, authorName: topic.authorName, replyCount: 0, lastActivity: topic.createdAt, isPinned: false, preview: topic.content.substring(0, 100) }` to its `topics` array
   - Sets `selectedTopic` to `topic.id` — **`selectedTopic` is `string | null`**, not an object; this triggers `TopicDetail.tsx` to load via its own `useEffect`
   - Closes the modal
   - `TopicDetail.tsx` calls `forumsApi.getTopic(topicId)` in its `useEffect` — in API mode this is a server round-trip (fine); in mock mode it resolves from `mockTopicDetails` which was populated by the `createTopic` mock path above

**Note**: `selectedTopic` in `Talks.tsx` is `string | null` (a topic ID), not an object. The handler sets `selectedTopic = newTopic.id`, not the object itself.

---

## Testing

### Backend — `Lovecraft.UnitTests/ForumTests.cs` (new file)

Uses `[Collection("ForumTests")]` to serialise tests. Test isolation uses `IDisposable`: `Dispose()` calls `.Clear()` on `MockDataStore.ForumTopics`, `MockDataStore.ForumSections`, and `MockDataStore.ForumReplies`, then re-populates each from a private static seed method that mirrors the original `MockDataStore` initialiser data. **No setter changes are needed on `MockDataStore`** — `.Clear()` + re-add works on the existing get-only `List<T>` properties.

| Test | Assertion |
|---|---|
| `CreateTopic_AddsToSection_ReturnsTopic` | Topic appears in `GetTopicsAsync(sectionId)` result |
| `CreateTopic_IncrementsSectionTopicCount` | Section `TopicCount` increases by 1 |
| `CreateTopic_UnknownSection_Throws` | `KeyNotFoundException` thrown for invalid sectionId |
| `GetTopics_ReturnsPinnedFirst` | Pinned topics appear before unpinned in result |
| `CreateReply_IncrementsReplyCount` | `ReplyCount` on the topic increases after `CreateReplyAsync` |

### Frontend — `src/lib/__tests__/validators.test.ts` (extend existing file)

| Test | Assertion |
|---|---|
| Valid title + content passes | `createTopicSchema.safeParse` succeeds |
| Title shorter than 5 chars fails | Error message: "Title must be at least 5 characters" |
| Title longer than 100 chars fails | Error message: "Title is too long" |
| Content shorter than 10 chars fails | Error message: "Content must be at least 10 characters" |
| Whitespace-only title fails | Trim check causes min-length failure |
| Whitespace-only content fails | Trim check causes min-length failure |

---

## File Changelist

### Backend (`D:\src\lovecraft\Lovecraft\`)

| File | Change |
|---|---|
| `Lovecraft.Common/DTOs/Forum/ForumDtos.cs` | Remove `SectionId` from `CreateTopicRequestDto`; add `[Required]` + `[StringLength]` annotations |
| `Lovecraft.Backend/Services/IServices.cs` | Add `CreateTopicAsync` to `IForumService` |
| `Lovecraft.Backend/Services/MockForumService.cs` | Implement `CreateTopicAsync` |
| `Lovecraft.Backend/Services/Azure/AzureForumService.cs` | Implement `CreateTopicAsync` |
| `Lovecraft.Backend/Services/Caching/CachingForumService.cs` | Implement `CreateTopicAsync` with cache invalidation |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | Add `CreateTopic` action; fix hardcoded `"current-user"` author ID in `CreateReply` action |
| `Lovecraft.UnitTests/ForumTests.cs` | New file — 5 tests |
| `docs/IMPLEMENTATION_SUMMARY.md` | Add new endpoint; tick forum topic creation |

### Frontend (`D:\src\aloevera-harmony-meet\`)

| File | Change |
|---|---|
| `src/lib/validators.ts` | Add `createTopicSchema` and `CreateTopicFormData` type |
| `src/services/api/forumsApi.ts` | Add `createTopic(sectionId, title, content)` |
| `src/components/forum/CreateTopicModal.tsx` | New component |
| `src/pages/Talks.tsx` | Add "New Topic" button + modal state + `onCreated` handler |
| `src/lib/__tests__/validators.test.ts` | Add 6 `createTopicSchema` tests |

---

## Out of Scope

- Topic editing or deletion
- Topic pinning/locking (admin feature, MCF.16)
- Rich text formatting (MCF.11)
- Image attachments (MCF.3)
- Optimistic UI updates beyond the local section state update described above
