# Forum Topic Creation (MCF.2) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability for authenticated users to create new forum topics within a section, including a `POST /api/v1/forum/sections/{sectionId}/topics` endpoint, dual-mode frontend API method, modal form component, and full test coverage.

**Architecture:** Backend follows the existing IForumService decorator chain (Mock/Azure → Caching → Controller). The DTO is fixed (remove unused `SectionId`, add validation annotations). Frontend adds a Zod schema, an API service method, a `CreateTopicModal` component, and integrates it into `Talks.tsx` with a "New Topic" button and `onCreated` handler that updates local state and navigates to the new topic.

**Tech Stack:** .NET 10 + xUnit (backend), React 18 / TypeScript / Vitest / Zod / react-hook-form / shadcn/ui (frontend)

---

## Chunk 1: Backend

### Task 1: Fix CreateTopicRequestDto

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Forum\ForumDtos.cs`

- [ ] **Step 1: Read ForumDtos.cs**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Forum\ForumDtos.cs` and locate `CreateTopicRequestDto`.

- [ ] **Step 2: Replace `CreateTopicRequestDto` with the validated version**

Remove the `SectionId` property (it comes from the route, not the body) and add data annotation attributes. Make sure `using System.ComponentModel.DataAnnotations;` is present at the top of the file.

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

- [ ] **Step 3: Build Lovecraft.Common**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.Common
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Lovecraft.Common/DTOs/Forum/ForumDtos.cs
git commit -m "fix(forum): remove SectionId from CreateTopicRequestDto, add validation annotations"
```

---

### Task 2: Add CreateTopicAsync to IForumService

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs`

- [ ] **Step 1: Read IServices.cs**

Read the file and find `IForumService`.

- [ ] **Step 2: Add the method signature**

Add to `IForumService`:

```csharp
Task<ForumTopicDto> CreateTopicAsync(
    string sectionId,
    string authorId,
    string authorName,
    string title,
    string content);
```

`authorAvatar` is intentionally omitted — the JWT does not contain an avatar claim. The returned `ForumTopicDto.AuthorAvatar` will be `null`.

- [ ] **Step 3: Build to confirm expected compile errors**

```bash
dotnet build Lovecraft.Backend
```

Expected: Build errors from `MockForumService`, `AzureForumService`, and `CachingForumService` not implementing the new method — this is correct and confirms the interface change is in place.

- [ ] **Step 4: Commit**

```bash
git add Lovecraft.Backend/Services/IServices.cs
git commit -m "feat(forum): add CreateTopicAsync to IForumService"
```

---

### Task 3: Write failing backend unit tests

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\ForumTests.cs`

- [ ] **Step 1: Read MockDataStore to understand seed data**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.Common\MockData\MockDataStore.cs` (or wherever `MockDataStore` is defined). Note the exact section IDs, topic IDs, and initial values used to seed `ForumSections`, `ForumTopics`, and `ForumReplies`. You need at least:
- One valid `sectionId` (e.g. `"general"`)
- At least one pinned topic and one unpinned topic in that section (required for `GetTopics_ReturnsPinnedFirst`)
- At least one topic with replies seeded (or rely on `CreateReply` to create one)

**Also check:** Does `ForumTopicDto` have a `Content` field, or does it only exist on `ForumTopicDetail`? If `ForumTopicDto` has no `Content` property, remove the `Content = "..."` lines from the `Seed()` method and remove the `result.Title` check against content in `CreateTopic_AddsToSection_ReturnsTopic`.

- [ ] **Step 2: Read MatchingTests.cs for the test isolation pattern**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\MatchingTests.cs` lines 1–60 to confirm the `[Collection]` + `IDisposable` + `Dispose()` pattern used by other test classes.

- [ ] **Step 3: Create ForumTests.cs**

The `Dispose()` method must call `.Clear()` on all three collections and then re-invoke the seed method so each test starts from a clean, known state. The static seed method must mirror the original `MockDataStore` initializer exactly — replace the placeholder values below with the real section/topic data you found in Step 1.

```csharp
using Xunit;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Forum;
using Lovecraft.Common.MockData;

[Collection("ForumTests")]
public class ForumTests : IDisposable
{
    private static MockForumService CreateService() => new MockForumService();

    // Capture a valid section ID at class load time (before any Dispose clears the store)
    private static readonly string _sectionId =
        MockDataStore.ForumSections.First().Id;

    public void Dispose()
    {
        MockDataStore.ForumTopics.Clear();
        MockDataStore.ForumSections.Clear();
        MockDataStore.ForumReplies.Clear();
        Seed();
    }

    /// <summary>
    /// Mirror of the MockDataStore static initializer.
    /// Update the IDs and field values below to match what MockDataStore actually seeds.
    /// Ensure at least one IsPinned=true topic and one IsPinned=false topic exist
    /// in the section used by tests (_sectionId) so GetTopics_ReturnsPinnedFirst works.
    /// </summary>
    private static void Seed()
    {
        // ── Sections ──────────────────────────────────────────────────────────
        MockDataStore.ForumSections.Add(new ForumSectionDto
        {
            Id = "general",          // replace with actual value from MockDataStore
            Name = "Общие обсуждения",
            Description = "Общение на любые темы",
            TopicCount = 2,
            LastActivity = DateTime.UtcNow.AddHours(-2)
        });
        // Add any other sections that MockDataStore seeds

        // ── Topics ────────────────────────────────────────────────────────────
        MockDataStore.ForumTopics.Add(new ForumTopicDto
        {
            Id = "topic-pinned-1",   // replace with actual value
            SectionId = "general",
            Title = "Добро пожаловать!",
            Content = "Это закреплённая тема.",  // remove if ForumTopicDto has no Content field (see Step 1)
            AuthorId = "user1",
            AuthorName = "Moderator",
            IsPinned = true,
            IsLocked = false,
            ReplyCount = 5,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            LastActivity = DateTime.UtcNow.AddDays(-1)
        });
        MockDataStore.ForumTopics.Add(new ForumTopicDto
        {
            Id = "topic-1",          // replace with actual value
            SectionId = "general",
            Title = "Кто едет на концерт?",
            Content = "Обсуждаем поездку.",      // remove if ForumTopicDto has no Content field (see Step 1)
            AuthorId = "user2",
            AuthorName = "User2",
            IsPinned = false,
            IsLocked = false,
            ReplyCount = 3,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow.AddHours(-3),
            LastActivity = DateTime.UtcNow.AddHours(-3)
        });
        // Add any other topics that MockDataStore seeds

        // ── Replies ───────────────────────────────────────────────────────────
        // Add replies that MockDataStore seeds, if any
    }

    [Fact]
    public async Task CreateTopic_AddsToSection_ReturnsTopic()
    {
        var service = CreateService();

        var result = await service.CreateTopicAsync(
            _sectionId, "user1", "TestUser",
            "A valid topic title", "Valid content body that is long enough");

        Assert.NotNull(result);
        Assert.Equal("A valid topic title", result.Title);
        Assert.Equal(_sectionId, result.SectionId);
        Assert.False(result.IsPinned);
        Assert.False(result.IsLocked);
        Assert.Equal(0, result.ReplyCount);

        var topics = await service.GetTopicsAsync(_sectionId);
        Assert.Contains(topics, t => t.Id == result.Id);
    }

    [Fact]
    public async Task CreateTopic_IncrementsSectionTopicCount()
    {
        var service = CreateService();

        var sectionsBefore = await service.GetSectionsAsync();
        var before = sectionsBefore.First(s => s.Id == _sectionId).TopicCount;

        await service.CreateTopicAsync(
            _sectionId, "user1", "TestUser",
            "A valid topic title", "Valid content body that is long enough");

        var sectionsAfter = await service.GetSectionsAsync();
        var after = sectionsAfter.First(s => s.Id == _sectionId).TopicCount;

        Assert.Equal(before + 1, after);
    }

    [Fact]
    public async Task CreateTopic_UnknownSection_Throws()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.CreateTopicAsync(
                "no-such-section-id", "user1", "TestUser",
                "A valid topic title", "Valid content body that is long enough"));
    }

    [Fact]
    public async Task GetTopics_ReturnsPinnedFirst()
    {
        var service = CreateService();

        var topics = await service.GetTopicsAsync(_sectionId);

        // All pinned topics must appear before all unpinned topics
        bool seenUnpinned = false;
        foreach (var topic in topics)
        {
            if (!topic.IsPinned) seenUnpinned = true;
            if (seenUnpinned && topic.IsPinned)
                Assert.Fail($"Pinned topic '{topic.Title}' appeared after an unpinned topic");
        }
    }

    [Fact]
    public async Task CreateReply_IncrementsReplyCount()
    {
        var service = CreateService();

        var topics = await service.GetTopicsAsync(_sectionId);
        var topicId = topics.First().Id;
        var before = topics.First().ReplyCount;

        await service.CreateReplyAsync(
            topicId, "user1", "TestUser",
            "This is a reply with enough content to be valid");

        topics = await service.GetTopicsAsync(_sectionId);
        var after = topics.First(t => t.Id == topicId).ReplyCount;

        Assert.Equal(before + 1, after);
    }
}
```

- [ ] **Step 4: Build the test project to confirm it fails**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.UnitTests
```

Expected: Build FAILED — multiple errors stating that `MockForumService`, `AzureForumService`, and `CachingForumService` do not implement `CreateTopicAsync`. This confirms the test file and interface change are correctly wired.

---

### Task 4: Implement MockForumService.CreateTopicAsync

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockForumService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureForumService.cs` (stub only)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Caching\CachingForumService.cs` (stub only)

- [ ] **Step 1: Read MockForumService.cs**

Read the file and note the pattern used by `CreateEventTopicAsync` — specifically how it builds a `ForumTopicDto`, appends it to `MockDataStore`, and what fields it sets.

- [ ] **Step 2: Add `CreateTopicAsync` to MockForumService**

```csharp
public Task<ForumTopicDto> CreateTopicAsync(
    string sectionId,
    string authorId,
    string authorName,
    string title,
    string content)
{
    var section = MockDataStore.ForumSections.FirstOrDefault(s => s.Id == sectionId)
        ?? throw new KeyNotFoundException($"Section '{sectionId}' not found");

    var now = DateTime.UtcNow;
    var topic = new ForumTopicDto
    {
        Id = Guid.NewGuid().ToString(),
        SectionId = sectionId,
        Title = title,
        Content = content,
        AuthorId = authorId,
        AuthorName = authorName,
        AuthorAvatar = null,
        IsPinned = false,
        IsLocked = false,
        ReplyCount = 0,
        CreatedAt = now,
        UpdatedAt = now,
        LastActivity = now
    };

    MockDataStore.ForumTopics.Add(topic);
    section.TopicCount++;

    return Task.FromResult(topic);
}
```

If `ForumTopicDto` has a `Preview` field (check the DTO definition), also set `Preview = content.Length > 100 ? content.Substring(0, 100) : content`.

- [ ] **Step 3: Add a compile-passing stub to AzureForumService**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureForumService.cs` and add:

```csharp
public Task<ForumTopicDto> CreateTopicAsync(
    string sectionId, string authorId, string authorName, string title, string content)
    => throw new NotImplementedException();
```

The real implementation follows in Task 5.

- [ ] **Step 4: Add a compile-passing passthrough stub to CachingForumService**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Caching\CachingForumService.cs` and add:

```csharp
public async Task<ForumTopicDto> CreateTopicAsync(
    string sectionId, string authorId, string authorName, string title, string content)
    => await _inner.CreateTopicAsync(sectionId, authorId, authorName, title, content);
```

Cache invalidation is added in Task 6.

- [ ] **Step 5: Run the ForumTests**

```bash
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~ForumTests"
```

Expected: All 5 tests pass. (Tests instantiate `MockForumService` directly via `CreateService()`, so the `AzureForumService` `NotImplementedException` stub and the `CachingForumService` passthrough are not exercised — all 5 tests run against `MockForumService` only.)

If `GetTopics_ReturnsPinnedFirst` fails because the seed data has no pinned topics, go back to Task 3 and add a pinned topic to the `Seed()` method.

- [ ] **Step 6: Commit stubs**

```bash
git add Lovecraft.Backend/Services/Azure/AzureForumService.cs \
        Lovecraft.Backend/Services/Caching/CachingForumService.cs
git commit -m "chore(forum): add compile-passing stubs for AzureForumService and CachingForumService"
```

- [ ] **Step 7: Commit MockForumService and tests**

```bash
git add Lovecraft.Backend/Services/MockForumService.cs \
        Lovecraft.UnitTests/ForumTests.cs
git commit -m "feat(forum): implement MockForumService.CreateTopicAsync; add ForumTests"
```

---

### Task 5: Implement AzureForumService.CreateTopicAsync

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureForumService.cs`

- [ ] **Step 1: Read AzureForumService.cs**

Read the file and locate `CreateEventTopicAsync`. Note:
- How `TableClient` instances are obtained for `forumtopics`, `forumtopicindex`, and `forumsections`
- How `ForumTopicEntity.GetPartitionKey(sectionId)` is called
- How `ForumTopicIndexEntity` is constructed
- How `ToTopicDto(entity)` maps an entity to a DTO
- How `UpsertEntityAsync` is called

- [ ] **Step 2: Replace the `NotImplementedException` stub with the real implementation**

Follow the exact same patterns as `CreateEventTopicAsync`. The implementation must:
1. Verify the section exists (query `forumsections` with PK=`"FORUM"`, RK=`sectionId`) — throw `KeyNotFoundException` if not found
2. Insert a `ForumTopicEntity` into `forumtopics` (PK=`ForumTopicEntity.GetPartitionKey(sectionId)`, RK=`topicId`) with `IsPinned=false`, `IsLocked=false`, `ReplyCount=0`
3. Insert a `ForumTopicIndexEntity` into `forumtopicindex` (PK=`"TOPICINDEX"`, RK=`topicId`, `SectionId=sectionId`)
4. Increment `TopicCount` on the `ForumSectionEntity` via read-merge-upsert
5. Return `ToTopicDto(topicEntity)`

```csharp
public async Task<ForumTopicDto> CreateTopicAsync(
    string sectionId,
    string authorId,
    string authorName,
    string title,
    string content)
{
    // 1. Verify section exists
    Azure.Response<ForumSectionEntity> sectionResponse;
    try
    {
        sectionResponse = await _sectionsTable.GetEntityAsync<ForumSectionEntity>("FORUM", sectionId);
    }
    catch (Azure.RequestFailedException ex) when (ex.Status == 404)
    {
        throw new KeyNotFoundException($"Section '{sectionId}' not found");
    }
    var sectionEntity = sectionResponse.Value;

    // 2. Create and insert topic entity
    var topicId = Guid.NewGuid().ToString();
    var now = DateTime.UtcNow;
    var topicEntity = new ForumTopicEntity
    {
        PartitionKey = ForumTopicEntity.GetPartitionKey(sectionId),
        RowKey = topicId,
        SectionId = sectionId,
        Title = title,
        Content = content,
        AuthorId = authorId,
        AuthorName = authorName,
        AuthorAvatar = null,
        IsPinned = false,
        IsLocked = false,
        ReplyCount = 0,
        CreatedAt = now,
        UpdatedAt = now,
        LastActivity = now
    };
    await _topicsTable.UpsertEntityAsync(topicEntity);

    // 3. Insert topic index entity
    var indexEntity = new ForumTopicIndexEntity
    {
        PartitionKey = "TOPICINDEX",
        RowKey = topicId,
        SectionId = sectionId
    };
    await _topicIndexTable.UpsertEntityAsync(indexEntity);

    // 4. Increment section TopicCount (read-merge-upsert)
    sectionEntity.TopicCount++;
    await _sectionsTable.UpsertEntityAsync(sectionEntity);

    // 5. Return mapped DTO
    return ToTopicDto(topicEntity);
}
```

**Important:** Replace `_sectionsTable`, `_topicsTable`, `_topicIndexTable` with the actual field names used in the class. If `AzureForumService` uses a single `TableServiceClient` and creates `TableClient` instances inline, follow that same pattern exactly.

- [ ] **Step 3: Build the backend**

```bash
dotnet build Lovecraft.Backend
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Lovecraft.Backend/Services/Azure/AzureForumService.cs
git commit -m "feat(forum): implement AzureForumService.CreateTopicAsync"
```

---

### Task 6: Implement CachingForumService + fix ForumController

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Caching\CachingForumService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\ForumController.cs`

- [ ] **Step 1: Read CachingForumService.cs**

Read the file and note:
- The name of the `_inner` field
- The name of the `_cache` field
- The `TopicsKey(sectionId)` private helper method (returns `$"forum:topics:{sectionId}"`)
- The `SectionsKey` private helper (returns `"forum:sections"`)

- [ ] **Step 2: Replace the passthrough stub with cache-invalidating implementation**

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

- [ ] **Step 3: Read ForumController.cs**

Read `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\ForumController.cs` in full. Note:
- The `_forumService` field name
- The `_logger` field name (if present)
- The exact pattern of `Ok(ApiResponse<T>.SuccessResponse(...))` and `StatusCode(500, ApiResponse<T>.ErrorResponse(...))`
- The `CreateReply` action and the hardcoded `"current-user"` line

- [ ] **Step 4: Add the `CreateTopic` action**

Add after `GetTopics` or alongside other write actions. Ensure `using System.Security.Claims;` is present at the top.

```csharp
[HttpPost("sections/{sectionId}/topics")]
public async Task<IActionResult> CreateTopic(
    string sectionId, [FromBody] CreateTopicRequestDto request)
{
    if (!ModelState.IsValid)
        return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse(
            "VALIDATION_ERROR", "Validation failed"));

    var authorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var authorName = User.FindFirst(ClaimTypes.Name)?.Value;

    try
    {
        var result = await _forumService.CreateTopicAsync(
            sectionId, authorId!, authorName!, request.Title, request.Content);
        return Ok(ApiResponse<ForumTopicDto>.SuccessResponse(result));
    }
    catch (KeyNotFoundException)
    {
        return NotFound(ApiResponse<ForumTopicDto>.ErrorResponse(
            "NOT_FOUND", "Section not found"));
    }
    catch (Exception ex)
    {
        // Only include the next line if the controller has a _logger field (check Step 3):
        _logger.LogError(ex, "Error creating topic in section {SectionId}", sectionId);
        return StatusCode(500, ApiResponse<ForumTopicDto>.ErrorResponse(
            "INTERNAL_ERROR", "An error occurred while creating the topic"));
    }
}
```

If the controller does not have a `_logger` field (you checked this in Step 3), remove the `_logger.LogError(...)` line entirely and keep only the `StatusCode(500, ...)` return.

- [ ] **Step 5: Fix the hardcoded `"current-user"` in `CreateReply`**

Find the line(s) in `CreateReply` that set `currentUserId` and `currentUserName` (or similar) to hardcoded strings. Replace with JWT claim extraction:

```csharp
var authorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
var authorName = User.FindFirst(ClaimTypes.Name)?.Value;
```

Update the `CreateReplyAsync` call to pass these variables instead of the hardcoded values.

- [ ] **Step 5a: Verify no `"current-user"` literal remains**

```bash
grep -n "current-user" Lovecraft.Backend/Controllers/V1/ForumController.cs
```

Expected: no output (zero matches). If any match appears, the fix is incomplete.

- [ ] **Step 6: Build the full solution**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Run all backend tests**

```bash
dotnet test Lovecraft.UnitTests
```

Expected: All tests pass (35 pre-existing + 5 new = 40 total).

- [ ] **Step 8: Commit**

```bash
git add Lovecraft.Backend/Services/Caching/CachingForumService.cs \
        Lovecraft.Backend/Controllers/V1/ForumController.cs
git commit -m "feat(forum): add CreateTopic endpoint; fix hardcoded author in CreateReply; cache invalidation"
```

---

## Chunk 2: Frontend

### Task 7: Add createTopicSchema and tests

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\lib\validators.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`

- [ ] **Step 1: Write the failing tests first**

Read `src/lib/__tests__/validators.test.ts` to see the existing test structure. Then make two edits:

**1a** — Add the import to the existing import section at the top of the file (alongside the existing imports, not after the existing `describe` blocks):

```typescript
import { createTopicSchema } from '../validators';
```

**1b** — Append the new `describe` block after the last existing test block:

```typescript
describe('createTopicSchema', () => {
  it('passes with valid title and content', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid topic title',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(true);
  });

  it('fails when title is shorter than 5 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'Hi',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Title must be at least 5 characters');
  });

  it('fails when title is longer than 100 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'A'.repeat(101),
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Title is too long');
  });

  it('fails when content is shorter than 10 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid title',
      content: 'Short',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Content must be at least 10 characters');
  });

  it('fails when title is whitespace only', () => {
    const result = createTopicSchema.safeParse({
      title: '     ',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
  });

  it('fails when content is whitespace only', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid title',
      content: '          ',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd D:\src\aloevera-harmony-meet
npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: Tests fail with an import error — `createTopicSchema` is not exported from `validators.ts`.

- [ ] **Step 3: Read validators.ts and add the schema**

Read `src/lib/validators.ts` to see the existing schemas and the `z` import. Add after the last schema:

```typescript
export const createTopicSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100, 'Title is too long'),
  content: z.string().trim().min(10, 'Content must be at least 10 characters').max(5000, 'Content is too long'),
});
export type CreateTopicFormData = z.infer<typeof createTopicSchema>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: All tests pass (existing + 6 new `createTopicSchema` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators.ts src/lib/__tests__/validators.test.ts
git commit -m "feat(forum): add createTopicSchema validator and 6 tests"
```

---

### Task 8: Add forumsApi.createTopic

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\forumsApi.ts`

- [ ] **Step 1: Read forumsApi.ts and the ForumTopic type definition**

Read `src/services/api/forumsApi.ts` in full. Note:
- The `mockForumSections` import (from `@/data/mockForumData` or similar)
- The `mockTopicDetails` import (mutable `Record<string, ForumTopicDetail>`)
- The `mapTopicDetailFromApi(dto, replies)` helper at line ~21
- The `createReply` mock pattern (uses `authorName: 'Вы'`, `authorId: 'current-user'`)
- The `ForumTopic` and `ForumTopicDetail` type imports — note where `ForumTopic` is defined
- The `ApiResponse` type structure
- How API mode calls use `apiClient.post<ApiResponse<ForumTopicDto>>(...)` and map the response

Then read the `ForumTopic` interface definition (in `@/types/forum` or wherever it is defined) to confirm **all required fields**. The `topicStub` in Step 2 must satisfy every required field. Common ones: `id`, `sectionId`, `title`, `authorName`, `replyCount`, `lastActivity`, `isPinned`, `preview`. If additional fields are required (e.g., `authorId`), include them.

Also note the `mockSuccess` helper: every other mock path in `forumsApi.ts` uses `return mockSuccess(data)` instead of constructing `{ success: true, data, ... }` manually. The Step 2 code uses this helper. Confirm it is defined/imported in the file.

Note: `apiClient` throws on non-2xx responses (Axios default), so the `catch` block in the modal covers all server error cases.

- [ ] **Step 2: Add the `createTopic` method**

Add after the `createReply` method. Adjust imports at the top if `ForumTopic` or any other type is not already imported.

```typescript
async createTopic(
  sectionId: string,
  title: string,
  content: string
): Promise<ApiResponse<ForumTopicDetail>> {
  if (!isApiMode()) {
    const newId = `topic-${Date.now()}`;
    const now = new Date();

    const topicDetail: ForumTopicDetail = {
      id: newId,
      sectionId,
      title,
      content,
      authorId: 'current-user',
      authorName: 'Вы',
      authorAvatar: undefined,
      isPinned: false,
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      replies: [],
    };

    const topicStub: ForumTopic = {
      id: newId,
      sectionId,
      title,
      authorName: 'Вы',
      replyCount: 0,
      lastActivity: now,
      isPinned: false,
      preview: content.substring(0, 100),
    };

    const section = mockForumSections.find(s => s.id === sectionId);
    if (section) {
      section.topics.push(topicStub);
      section.topicCount++;
    }

    mockTopicDetails[newId] = topicDetail;

    return mockSuccess(topicDetail);
  }

  const response = await apiClient.post<ApiResponse<ForumTopicDto>>(
    `/api/v1/forum/sections/${sectionId}/topics`,
    { title, content }
  );
  return {
    ...response.data,
    data: response.data.data ? mapTopicDetailFromApi(response.data.data, []) : null,
  };
},
```

If `mockTopicDetails` is imported as a `const` from a module, it can be mutated by index assignment (`mockTopicDetails[newId] = ...`) because objects imported by reference are mutable even when declared `const`. If `mockTopicDetails` is declared with `Object.freeze`, you'll need to check the mock data file.

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are type errors on `ForumTopic` fields (e.g., `authorId` is required but not in the stub), check the `ForumTopic` interface in the types file and adjust accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/services/api/forumsApi.ts
git commit -m "feat(forum): add forumsApi.createTopic (mock + api modes)"
```

---

### Task 9: Create CreateTopicModal.tsx

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\forum\CreateTopicModal.tsx`

- [ ] **Step 1: Check existing forum components for import patterns**

Read `src/components/forum/TopicDetail.tsx` to verify:
- The import path for shadcn/ui `Dialog`, `Button`, `Input`, `Label` (typically `@/components/ui/dialog`, etc.)
- Where `ForumTopicDetail` type is imported from
- How `showApiError` is imported
- How `useLanguage` is imported and used (for `t()` function)

Also read an existing page component (e.g., `src/pages/Talks.tsx`) to see the exact `useLanguage` import path and `const { t } = useLanguage()` usage pattern.

- [ ] **Step 2: Create the component**

Per project convention, all user-facing strings must be wrapped with `t()` from `useLanguage()`. The example below uses the key format established by the project — check existing translation files (look in `src/contexts/LanguageContext.tsx` or a translations file) to find the key format, then add any new keys for this component. If a matching key doesn't exist, add it following the existing pattern.

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTopicSchema, type CreateTopicFormData } from '@/lib/validators';
import { forumsApi } from '@/services/api/forumsApi';
import { showApiError } from '@/lib/apiError';
import { useLanguage } from '@/contexts/LanguageContext';  // adjust path if needed
import type { ForumTopicDetail } from '@/types/forum';     // adjust path if needed

interface CreateTopicModalProps {
  sectionId: string;
  sectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (topic: ForumTopicDetail) => void;
}

export function CreateTopicModal({
  sectionId,
  sectionName,
  open,
  onOpenChange,
  onCreated,
}: CreateTopicModalProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateTopicFormData>({
    resolver: zodResolver(createTopicSchema),
    defaultValues: { title: '', content: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const response = await forumsApi.createTopic(sectionId, data.title, data.content);
      if (response.success && response.data) {
        form.reset();
        onCreated(response.data);
      }
    } catch (err) {
      showApiError(err, 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forum.createTopic.titlePrefix')} «{sectionName}»</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="topic-title">{t('forum.createTopic.titleLabel')}</Label>
            <Input
              id="topic-title"
              placeholder={t('forum.createTopic.titlePlaceholder')}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="topic-content">{t('forum.createTopic.contentLabel')}</Label>
            <textarea
              id="topic-content"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('forum.createTopic.contentPlaceholder')}
              {...form.register('content')}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('forum.createTopic.posting') : t('forum.createTopic.post')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Adjust the `ForumTopicDetail` and `useLanguage` import paths to match where they are actually defined in this project (check what `TopicDetail.tsx` and other pages use).

- [ ] **Step 2a: Add translation keys**

Read `src/contexts/LanguageContext.tsx` (or wherever the translation dictionaries live) to see the key structure for both Russian (`ru`) and English (`en`) translations. Add the keys used above in the component. If the key format differs from `forum.createTopic.*` (e.g., it's a flat namespace), adjust both the component strings and the dictionary additions to match the existing pattern.

The keys needed (Russian / English):
- `forum.createTopic.titlePrefix` → `'Новая тема в'` / `'New Topic in'` (rendered as `{t('forum.createTopic.titlePrefix')} «{sectionName}»`)
- `forum.createTopic.titleLabel` → `'Заголовок'` / `'Title'`
- `forum.createTopic.titlePlaceholder` → `'Заголовок темы...'` / `'Topic title...'`
- `forum.createTopic.contentLabel` → `'Содержание'` / `'Content'`
- `forum.createTopic.contentPlaceholder` → `'Напишите ваш пост...'` / `'Write your post...'`
- `forum.createTopic.posting` → `'Публикация...'` / `'Posting...'`
- `forum.createTopic.post` → `'Опубликовать'` / `'Post Topic'`
- `common.cancel` → check if this key already exists; if so reuse it; if not, add `'Отмена'` / `'Cancel'`

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/forum/CreateTopicModal.tsx src/contexts/LanguageContext.tsx
git commit -m "feat(forum): add CreateTopicModal component and translation keys"
```

---

### Task 10: Wire CreateTopicModal into Talks.tsx

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Talks.tsx`

- [ ] **Step 1: Read Talks.tsx**

Read the full file. Note:
- All `useState` declarations (lines ~18–35)
- The `currentSection` derived value
- The JSX structure around lines 200–270: where the section topic list header renders (section title, back button, topics list)
- Where `setSelectedTopic(topic.id)` is called
- Where `setForumSections` is defined (is it `useState` or does it come from somewhere else?)
- The `ForumTopicDetail` import (if already imported)

- [ ] **Step 2: Add `createModalOpen` state**

Add near the other `useState` calls:

```typescript
const [createModalOpen, setCreateModalOpen] = useState(false);
```

- [ ] **Step 3: Add the import for CreateTopicModal**

Add at the top with the other component imports:

```typescript
import { CreateTopicModal } from '@/components/forum/CreateTopicModal';
```

Also add the `ForumTopicDetail` type import if not already present. Check where `ForumTopicDetail` is imported in `forumsApi.ts` and use the same path.

- [ ] **Step 4: Add the `handleTopicCreated` callback**

Add inside the component body before the `return`:

```typescript
const handleTopicCreated = (topic: ForumTopicDetail) => {
  setForumSections(prev =>
    prev.map(section => {
      if (section.id !== selectedSection) return section;
      return {
        ...section,
        topicCount: section.topicCount + 1,
        topics: [
          {
            id: topic.id,
            sectionId: selectedSection!,
            title: topic.title,
            authorName: topic.authorName,
            replyCount: 0,
            lastActivity: topic.createdAt,
            isPinned: false,
            preview: topic.content.substring(0, 100),
          },
          ...section.topics,
        ],
      };
    })
  );
  setSelectedTopic(topic.id);
  setCreateModalOpen(false);
};
```

If `ForumTopic` fields differ (e.g., `authorId` is required), adjust the stub to match the interface. Check `ForumTopic` type definition.

- [ ] **Step 5: Add the "New Topic" button in the section topic list header**

Find the JSX element that renders the row with the section name and the back button (around lines 206–215). This is the header shown when a section is selected but no topic is open. Add a "+ Новая тема" button on the right side of that row.

The button must only be visible when `selectedSection` is set and `selectedTopic` is null. Verify the header row is already guarded by that condition in the surrounding JSX. If the header renders regardless, wrap the button in an explicit conditional. Use `t()` for the label, consistent with the i18n convention:

```tsx
{selectedSection && !selectedTopic && (
  <button
    onClick={() => setCreateModalOpen(true)}
    className="text-xs px-3 py-1.5 rounded bg-[var(--aloe-gold)] text-black font-semibold hover:opacity-90 transition-opacity"
  >
    {t('forum.newTopic')}
  </button>
)}
```

Add the translation key `forum.newTopic` → `'+ Новая тема'` / `'+ New Topic'` to the language dictionaries (same file updated in Task 9 Step 2a).

Place the wrapped button inside the existing flex row so it appears on the right side, opposite the back button.

- [ ] **Step 6: Render the CreateTopicModal**

Add the modal component near the bottom of the JSX (just before or after any other modals/dialogs in the file):

```tsx
{selectedSection && (
  <CreateTopicModal
    sectionId={selectedSection}
    sectionName={currentSection?.name ?? ''}
    open={createModalOpen}
    onOpenChange={setCreateModalOpen}
    onCreated={handleTopicCreated}
  />
)}
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors. Common issues to watch for:
- `ForumTopicDetail` type not imported → add import
- `topic.createdAt` typed as `string` in API mode but `Date` in mock mode → if the type is `Date | string`, cast to `Date` or use `new Date(topic.createdAt)`
- `section.topicCount` vs `section.TopicCount` — match the exact field name from the `ForumSection` type

- [ ] **Step 8: Run all frontend tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Talks.tsx src/contexts/LanguageContext.tsx
git commit -m "feat(forum): wire CreateTopicModal into Talks.tsx; New Topic button + onCreated handler"
```

---

## Chunk 3: Documentation

### Task 11: Update IMPLEMENTATION_SUMMARY.md

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`

- [ ] **Step 1: Read the file**

Read `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` to understand the current structure (endpoint tables, status markers, in-progress/completed lists).

- [ ] **Step 2: Add the new endpoint and mark MCF.2 complete**

Find the Forum endpoints table and add the new row:

```
| POST /api/v1/forum/sections/{sectionId}/topics | Create topic in section | ✅ |
```

Find wherever forum topic creation appears in a "not yet implemented" or "in progress" section and move it to completed / add a checkmark.

Also note the fix: `ForumController.CreateReply` no longer hardcodes `"current-user"` — update any relevant notes about that.

- [ ] **Step 3: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add docs/IMPLEMENTATION_SUMMARY.md
git commit -m "docs: record forum topic creation (MCF.2) as complete in IMPLEMENTATION_SUMMARY"
```
