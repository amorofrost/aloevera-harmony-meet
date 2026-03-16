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

**Response** (`200 OK`):
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

---

## Backend

### `IForumService` — new method

```csharp
Task<ForumTopicDto> CreateTopicAsync(
    string sectionId,
    string authorId,
    string authorName,
    string? authorAvatar,
    string title,
    string content);
```

### `MockForumService.CreateTopicAsync`

1. Look up the section in `MockDataStore.Sections` — throw `KeyNotFoundException` if not found
2. Generate a new GUID topic ID
3. Build a `ForumTopicDto` with `IsPinned = false`, `IsLocked = false`, `ReplyCount = 0`, `CreatedAt = UpdatedAt = DateTime.UtcNow`
4. Append to `MockDataStore.Topics`
5. Increment the section's `TopicCount`
6. Return the new `ForumTopicDto`

### `AzureForumService.CreateTopicAsync`

1. Verify section exists by querying `forumsections` (PK=`"FORUM"`, RK=`sectionId`) — return 404 if not found
2. Insert `ForumTopicEntity` into `forumtopics` (PK=`section-{sectionId}`, RK=`topicId`)
3. Insert `ForumTopicIndexEntity` into `forumtopicindex` (PK=`"TOPICINDEX"`, RK=`topicId`, SectionId=`sectionId`) — same pattern as `CreateEventTopicAsync`
4. Increment `TopicCount` on the `ForumSectionEntity` via read-merge-upsert
5. Return the mapped `ForumTopicDto`

### `CachingForumService.CreateTopicAsync`

Delegates to inner service, then invalidates:
- `$"topics:{sectionId}"` — topic list for the section is stale
- `$"section:{sectionId}"` — section's `TopicCount` has changed

### `ForumController` — new action

```csharp
[HttpPost("sections/{sectionId}/topics")]
public async Task<IActionResult> CreateTopic(string sectionId, [FromBody] CreateTopicRequestDto request)
```

- Extracts `authorId` via `User.FindFirst(ClaimTypes.NameIdentifier)?.Value`
- Extracts `authorName` via `User.FindFirst(ClaimTypes.Name)?.Value`
- Extracts `authorAvatar` via `User.FindFirst("avatar")?.Value` (nullable)
- Returns `ApiResponse<ForumTopicDto>` on success
- Returns `BadRequest` if `ModelState` is invalid

**Also fix** the hardcoded `"current-user"` author ID in the existing `CreateReply` action — replace with the same JWT claim extraction.

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
async createTopic(sectionId: string, title: string, content: string): Promise<ApiResponse<ForumTopic>>
```

- **Mock mode**: generates a stub `ForumTopic` with a random ID, current timestamp, current user's name; appends to the in-memory mock topic list for the section; returns wrapped in `ApiResponse`
- **API mode**: `POST /api/v1/forum/sections/{sectionId}/topics` with `{ title, content }` body

### `src/components/forum/CreateTopicModal.tsx` — new component

A shadcn `Dialog` component containing:
- **Title field**: text input, wired to `react-hook-form` + `zodResolver(createTopicSchema)`
- **Content field**: `<textarea>`, same form
- **Cancel button**: closes modal, resets form
- **Post Topic button**: submits; shows loading state during request; calls `showApiError` on failure; calls `onCreated(topic)` callback on success

Props:
```typescript
interface CreateTopicModalProps {
  sectionId: string;
  sectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (topic: ForumTopic) => void;
}
```

### `src/pages/Talks.tsx` — two changes

1. **"+ New Topic" button** — rendered in the section topic list header (next to section title), visible only when a section is selected. Uses `useState<boolean>` to control modal open state.
2. **`onCreated` handler** — receives the new topic, navigates into it (sets `selectedTopic` state to the returned topic), closes the modal. The new topic appears immediately without a page reload.

---

## Testing

### Backend — `Lovecraft.UnitTests/ForumTests.cs` (new file)

Uses `[Collection("ForumTests")]` to serialise tests and `IDisposable` to reset `MockDataStore.Topics` and section `TopicCount` before/after each test.

| Test | Assertion |
|---|---|
| `CreateTopic_AddsToSection_ReturnsTopic` | Topic appears in `GetTopicsAsync(sectionId)` result |
| `CreateTopic_IncrementsSectionTopicCount` | Section `TopicCount` increases by 1 |
| `CreateTopic_UnknownSection_Throws` | `KeyNotFoundException` thrown for invalid sectionId |
| `GetTopics_ReturnsPinnedFirst` | Pinned topics appear before unpinned in result |
| `CreateReply_IncrementsReplyCount` | `ReplyCount` on the topic increases after `CreateReplyAsync` |

### Frontend — `src/lib/validators.test.ts` (extend existing file)

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
| `Lovecraft.Backend/Services/IServices.cs` | Add `CreateTopicAsync` to `IForumService` |
| `Lovecraft.Backend/Services/MockForumService.cs` | Implement `CreateTopicAsync`; fix hardcoded `"current-user"` in `CreateReplyAsync` |
| `Lovecraft.Backend/Services/Azure/AzureForumService.cs` | Implement `CreateTopicAsync` |
| `Lovecraft.Backend/Services/Caching/CachingForumService.cs` | Implement `CreateTopicAsync` with cache invalidation |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | Add `CreateTopic` action; fix hardcoded author ID in `CreateReply` |
| `Lovecraft.UnitTests/ForumTests.cs` | New file — 5 tests |
| `docs/IMPLEMENTATION_SUMMARY.md` | Add new endpoint; tick forum topic creation |

### Frontend (`D:\src\aloevera-harmony-meet\`)

| File | Change |
|---|---|
| `src/lib/validators.ts` | Add `createTopicSchema` and `CreateTopicFormData` type |
| `src/services/api/forumsApi.ts` | Add `createTopic(sectionId, title, content)` |
| `src/components/forum/CreateTopicModal.tsx` | New component |
| `src/pages/Talks.tsx` | Add "New Topic" button + modal state + `onCreated` handler |
| `src/lib/validators.test.ts` | Add 6 `createTopicSchema` tests |

---

## Out of Scope

- Topic editing or deletion
- Topic pinning/locking (admin feature, MCF.16)
- Rich text formatting (MCF.11)
- Image attachments (MCF.3)
- Optimistic UI updates (topic list refreshes after navigation to the new topic)
