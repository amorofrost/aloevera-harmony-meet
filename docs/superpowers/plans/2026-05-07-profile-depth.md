# Profile Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the profile-depth bundle (B1 multi-photo, B2 prompts, B4 common-ground) end-to-end across both repos, with TDD on every behavioural unit.

**Architecture:** One new `PromptsJson` column on `UserEntity`; the existing `PUT /api/v1/users/{id}` (which takes a full `UserDto`) gains a new `Prompts` field. Frontend gets a tap-zone `<PhotoCarousel>`, a prompts editor + photo grid in Settings, a localised prompts catalogue, and a pure-function `commonGround(viewer, target)` helper. No new endpoints, no new tables, no SignalR changes.

**Tech Stack:** .NET 10 / Azure Table Storage / xUnit (backend); React 18 / TypeScript / Vite / shadcn/ui / `@dnd-kit/sortable` / Vitest + RTL (frontend).

**Spec:** `aloevera-harmony-meet/docs/superpowers/specs/2026-05-07-profile-depth-design.md`

**Repo paths used in this plan:**
- Backend repo root: `D:\src\lovecraft`
- Frontend repo root: `D:\src\aloevera-harmony-meet`
- Tests for backend live flat in `Lovecraft/Lovecraft.UnitTests/<TestClass>.cs` (no nested `Controllers/` or `Services/` folders).

---

## Task 1: Backend — `PromptAnswerDto` and `UserDto.Prompts`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Users\UserDto.cs`

- [ ] **Step 1: Add `PromptAnswerDto` and `Prompts` field to `UserDto`**

In `UserDto.cs`, add this record at the bottom of the file (alongside `AloeVeraSongDto`):

```csharp
public class PromptAnswerDto
{
    public string PromptId { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
}
```

In the `UserDto` class body, add this property right after `InstagramHandle`:

```csharp
    /// <summary>Up to 3 prompt answers chosen from the curated prompt catalogue.</summary>
    public List<PromptAnswerDto>? Prompts { get; set; }
```

- [ ] **Step 2: Build to verify compile**

Run from `D:\src\lovecraft\Lovecraft`:
```
dotnet build Lovecraft.Common
```
Expected: `Build succeeded`. (If anyone re-uses the old shape, the compiler tells us now.)

- [ ] **Step 3: Commit**

From `D:\src\lovecraft`:
```
git add Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs
git commit -m "feat(users): add PromptAnswerDto and UserDto.Prompts"
```

---

## Task 2: Backend — `KnownPromptIds` constant set

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Constants\PromptIds.cs`

- [ ] **Step 1: Create the file**

```csharp
namespace Lovecraft.Backend.Constants;

/// <summary>
/// Ordered list of valid prompt IDs. Must mirror src/data/prompts.ts in the
/// frontend repo. Adding/removing an ID requires a coordinated release.
/// </summary>
public static class PromptIds
{
    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        "aloevera_first",
        "aloevera_song",
        "concert_memory",
        "looking_for",
        "weekend",
        "road_trip",
        "playlist",
        "instrument",
        "unpopular_opinion",
        "dream_setlist",
        "first_date",
        "dealbreaker",
    };
}
```

- [ ] **Step 2: Build**
```
dotnet build Lovecraft.Backend
```
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**
```
git add Lovecraft/Lovecraft.Backend/Constants/PromptIds.cs
git commit -m "feat(users): add KnownPromptIds constant set"
```

---

## Task 3: Backend — `UserEntity.PromptsJson` column

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\UserEntity.cs`

- [ ] **Step 1: Add the column**

After the existing `ImagesJson` line (around line 22), insert:

```csharp
    public string PromptsJson { get; set; } = "[]";
```

- [ ] **Step 2: Build**
```
dotnet build Lovecraft.Backend
```
Expected: `Build succeeded`. Existing rows in Azure default this column to absent on read; Azure SDK populates the C# default `"[]"`.

- [ ] **Step 3: Commit**
```
git add Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs
git commit -m "feat(users): add PromptsJson column to UserEntity"
```

---

## Task 4: Backend (TDD) — `AzureUserService` round-trip for prompts

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AzureUserServiceTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs`

- [ ] **Step 1: Write the failing test**

In `AzureUserServiceTests.cs`, add a new test method (find an open spot near other update-related tests):

```csharp
[Fact]
public async Task UpdateUserAsync_RoundTripsPromptsThroughPromptsJson()
{
    // Arrange — construct an in-memory UserEntity, mock TableClient, etc., per existing test patterns in this file.
    var userId = "test-prompts-roundtrip";
    var entity = NewSeedEntity(userId); // helper already in the test file
    SetupTableClientForGetAndUpdate(entity);

    var dto = ToFullDto(entity);
    dto.Prompts = new List<PromptAnswerDto>
    {
        new() { PromptId = "aloevera_song", Answer = "Hometown" },
        new() { PromptId = "looking_for",   Answer = "Someone who travels for shows" },
    };

    // Act
    var result = await _service.UpdateUserAsync(userId, dto);

    // Assert — entity was written with serialised PromptsJson
    Assert.Contains("aloevera_song", entity.PromptsJson);
    Assert.Contains("Hometown", entity.PromptsJson);
    // Assert — DTO returned by ToDto deserialised back to the same shape
    Assert.NotNull(result.Prompts);
    Assert.Equal(2, result.Prompts.Count);
    Assert.Equal("aloevera_song", result.Prompts[0].PromptId);
    Assert.Equal("Hometown", result.Prompts[0].Answer);
}
```

If `NewSeedEntity` / `SetupTableClientForGetAndUpdate` / `ToFullDto` helpers don't yet exist in this file under those exact names, copy the closest pattern from the file (e.g. an existing `UpdateUserAsync_*` test).

- [ ] **Step 2: Run test, verify it fails**
```
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~UpdateUserAsync_RoundTripsPromptsThroughPromptsJson"
```
Expected: FAIL — `Prompts` is null in the returned DTO because no code populates `PromptsJson` or reads it.

- [ ] **Step 3: Wire `PromptsJson` write in `UpdateUserAsync`**

In `AzureUserService.cs`, find `UpdateUserAsync` (around line 69). After the existing `entity.ImagesJson = JsonSerializer.Serialize(...)` line, add:

```csharp
            entity.PromptsJson = JsonSerializer.Serialize(dto.Prompts ?? new List<PromptAnswerDto>());
```

- [ ] **Step 4: Wire `PromptsJson` read in `ToDto`**

In `AzureUserService.cs`, find the `ToDto` static method (around line 187). After the existing `Images` deserialise block (lines 199–201), insert:

```csharp
        List<PromptAnswerDto> prompts;
        try { prompts = JsonSerializer.Deserialize<List<PromptAnswerDto>>(entity.PromptsJson) ?? new List<PromptAnswerDto>(); }
        catch { prompts = new List<PromptAnswerDto>(); }
```

Then in the `return new UserDto { ... }` initialiser, add this line (near `Images = images,`):

```csharp
            Prompts = prompts.Count > 0 ? prompts : null,
```

(Keep the DTO field `null` rather than empty list for legacy users — matches the frontend's optional-chaining pattern.)

- [ ] **Step 5: Run test, verify it passes**
```
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~UpdateUserAsync_RoundTripsPromptsThroughPromptsJson"
```
Expected: PASS.

- [ ] **Step 6: Run the full backend test suite**
```
dotnet test Lovecraft.UnitTests
```
Expected: All tests pass (existing 264+ plus the new one).

- [ ] **Step 7: Commit**
```
git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.UnitTests/AzureUserServiceTests.cs
git commit -m "feat(users): round-trip prompts via PromptsJson column"
```

---

## Task 5: Backend — `MockUserService` mirrors the round-trip

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs`

This is a parallel of Task 4 against the in-memory mock. The `MockUserService` keeps users as `UserDto` directly, so the change is just propagating `Prompts` in the update path.

- [ ] **Step 1: Locate the update path**

Open `MockUserService.cs`. Find `UpdateUserAsync(string userId, UserDto dto)` (search for `public async Task<UserDto> UpdateUserAsync`).

- [ ] **Step 2: Propagate `Prompts`**

Inside the method, find where it copies `dto.Images` (or similar fields) onto the stored mock user. Add:

```csharp
existing.Prompts = dto.Prompts;
```

(Field name on the stored mock object should match the same `Prompts` shape. If MockUserService stores raw `UserDto` instances, it is literally one assignment.)

- [ ] **Step 3: Quick sanity test**

Add to `Lovecraft.UnitTests/ServiceTests.cs` (existing file with mock service tests):

```csharp
[Fact]
public async Task MockUserService_UpdateUser_RoundTripsPrompts()
{
    var svc = new MockUserService(new MockDataStore(/* … as existing tests construct it */));
    var userId = "test-user-001"; // pre-seeded mock id (verify by reading existing tests)
    var current = await svc.GetUserByIdAsync(userId);
    Assert.NotNull(current);
    current!.Prompts = new List<PromptAnswerDto>
    {
        new() { PromptId = "looking_for", Answer = "Tour buddies" },
    };
    var updated = await svc.UpdateUserAsync(userId, current);
    Assert.NotNull(updated.Prompts);
    Assert.Single(updated.Prompts);
    Assert.Equal("Tour buddies", updated.Prompts[0].Answer);
}
```

(Adjust the constructor call to match the existing test patterns in `ServiceTests.cs` — this skill plan can't predict the exact constructor signature without reading the file; the executor should mirror an adjacent test in the same file.)

- [ ] **Step 4: Run tests**
```
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~MockUserService_UpdateUser_RoundTripsPrompts"
```
Expected: PASS.

- [ ] **Step 5: Run full suite**
```
dotnet test Lovecraft.UnitTests
```
Expected: All tests pass.

- [ ] **Step 6: Commit**
```
git add Lovecraft/Lovecraft.Backend/Services/MockUserService.cs Lovecraft/Lovecraft.UnitTests/ServiceTests.cs
git commit -m "feat(users): MockUserService round-trips prompts"
```

---

## Task 6: Backend (TDD) — `UsersController.UpdateUser` validates prompts and image cap

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\UsersControllerUpdateTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\UsersController.cs`

The controller currently does only `HtmlGuard` checks on `Name`, `Location`, `Bio` (lines 90–95) and then calls `_userService.UpdateUserAsync(id, user)`. We add new checks for prompts and image cap.

- [ ] **Step 1: Write failing tests**

Create `UsersControllerUpdateTests.cs`. Use `WebApplicationFactory<Program>` + the existing `TestAuthHandler` pattern from `AclTests.cs` (read that file first to copy the auth-injection pattern, since it's already used in the test suite).

```csharp
using System.Net;
using System.Net.Http.Json;
using Lovecraft.Common.DTOs.Users;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Lovecraft.UnitTests;

public class UsersControllerUpdateTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private const string UserId = "test-user-001"; // pre-seeded mock user

    public UsersControllerUpdateTests(WebApplicationFactory<Program> factory)
    {
        // Match the auth-injection pattern from AclTests.cs to create a client
        // authenticated as UserId. (Copy the helper here or extract it shared.)
        _client = CreateAuthedClient(factory, UserId);
    }

    private static HttpClient CreateAuthedClient(WebApplicationFactory<Program> factory, string userId)
    {
        // Mirror AclTests.cs CreateAuthedClient implementation exactly.
        throw new NotImplementedException("Mirror AclTests.CreateAuthedClient");
    }

    private static UserDto BaseValidDto() => new()
    {
        Id = UserId,
        Name = "Test",
        Age = 25,
        Bio = "Hi",
        Location = "Moscow",
    };

    [Fact]
    public async Task UpdateUser_RejectsMoreThanThreePrompts()
    {
        var dto = BaseValidDto();
        dto.Prompts = Enumerable.Range(0, 4)
            .Select(i => new PromptAnswerDto { PromptId = "looking_for", Answer = $"a{i}" })
            .ToList();
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("PROMPTS_TOO_MANY", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_RejectsUnknownPromptId()
    {
        var dto = BaseValidDto();
        dto.Prompts = new List<PromptAnswerDto>
        {
            new() { PromptId = "totally_invented", Answer = "hello" },
        };
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("UNKNOWN_PROMPT_ID", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_RejectsDuplicatePromptId()
    {
        var dto = BaseValidDto();
        dto.Prompts = new List<PromptAnswerDto>
        {
            new() { PromptId = "looking_for", Answer = "a" },
            new() { PromptId = "looking_for", Answer = "b" },
        };
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("DUPLICATE_PROMPT_ID", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_RejectsAnswerOver200Chars()
    {
        var dto = BaseValidDto();
        dto.Prompts = new List<PromptAnswerDto>
        {
            new() { PromptId = "looking_for", Answer = new string('a', 201) },
        };
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("PROMPT_ANSWER_TOO_LONG", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_RejectsHtmlInAnswer()
    {
        var dto = BaseValidDto();
        dto.Prompts = new List<PromptAnswerDto>
        {
            new() { PromptId = "looking_for", Answer = "<b>hi</b>" },
        };
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("HTML_NOT_ALLOWED", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_RejectsMoreThanSixImages()
    {
        var dto = BaseValidDto();
        dto.Images = Enumerable.Range(0, 7).Select(i => $"https://example.com/{i}.jpg").ToList();
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.Equal("IMAGES_TOO_MANY", body!.Error?.Code);
    }

    [Fact]
    public async Task UpdateUser_AcceptsValidPromptsAndImages()
    {
        var dto = BaseValidDto();
        dto.Prompts = new List<PromptAnswerDto>
        {
            new() { PromptId = "looking_for", Answer = "Tour buddies" },
        };
        dto.Images = new List<string> { "https://example.com/1.jpg" };
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
        Assert.True(body!.Success);
        Assert.NotNull(body.Data!.Prompts);
        Assert.Single(body.Data.Prompts);
    }

    [Fact]
    public async Task UpdateUser_AcceptsNullPrompts()
    {
        var dto = BaseValidDto();
        dto.Prompts = null;
        var resp = await _client.PutAsJsonAsync($"/api/v1/users/{UserId}", dto);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**
```
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~UsersControllerUpdateTests"
```
Expected: All 8 fail (200 OK / no validation in place yet).

- [ ] **Step 3: Implement controller validation**

In `UsersController.cs`, in `UpdateUser` (line 88), insert this block after the existing three `HtmlGuard` checks (after line 95) and before the `try` block:

```csharp
        if (user.Prompts is { } prompts)
        {
            if (prompts.Count > 3)
                return BadRequest(ApiResponse<UserDto>.ErrorResponse("PROMPTS_TOO_MANY", "At most 3 prompts allowed"));

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var p in prompts)
            {
                if (!Constants.PromptIds.All.Contains(p.PromptId))
                    return BadRequest(ApiResponse<UserDto>.ErrorResponse("UNKNOWN_PROMPT_ID", $"Prompt id '{p.PromptId}' is not in the catalogue"));
                if (!seen.Add(p.PromptId))
                    return BadRequest(ApiResponse<UserDto>.ErrorResponse("DUPLICATE_PROMPT_ID", "A prompt id appears more than once"));
                if ((p.Answer ?? string.Empty).Length > 200)
                    return BadRequest(ApiResponse<UserDto>.ErrorResponse("PROMPT_ANSWER_TOO_LONG", "Prompt answer must be 200 characters or less"));
                if (HtmlGuard.ContainsHtml(p.Answer))
                    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in prompt answers"));
            }
        }

        if (user.Images is { Count: > 6 })
            return BadRequest(ApiResponse<UserDto>.ErrorResponse("IMAGES_TOO_MANY", "At most 6 images allowed"));
```

(Make sure `using Lovecraft.Backend.Constants;` is at the top of the file, or qualify as `Lovecraft.Backend.Constants.PromptIds.All` in line.)

- [ ] **Step 4: Run tests, verify they pass**
```
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~UsersControllerUpdateTests"
```
Expected: All 8 pass.

- [ ] **Step 5: Run full backend suite**
```
dotnet test Lovecraft.UnitTests
```
Expected: All tests pass.

- [ ] **Step 6: Commit**
```
git add Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs Lovecraft/Lovecraft.UnitTests/UsersControllerUpdateTests.cs
git commit -m "feat(users): validate prompts and image cap on PUT /users/{id}"
```

---

## Task 7: Frontend — `User.prompts` type and `PromptAnswer`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\types\user.ts`

- [ ] **Step 1: Add the type and field**

In `user.ts`, add (next to other type aliases like `UserRank`):

```ts
export interface PromptAnswer {
  promptId: string;
  answer: string;
}
```

In the `User` interface, after `instagramHandle?: string;`, add:

```ts
  prompts?: PromptAnswer[];
```

- [ ] **Step 2: Verify TypeScript compiles**

From `D:\src\aloevera-harmony-meet`:
```
npx tsc --noEmit
```
Expected: No new errors. (Existing TS warnings unchanged — strict mode is loose per AGENTS.md.)

- [ ] **Step 3: Commit**
```
git add src/types/user.ts
git commit -m "feat(users): add PromptAnswer type and User.prompts"
```

---

## Task 8: Frontend (TDD) — Zod `promptsSchema` and validators

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\lib\validators.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `validators.test.ts`:

```ts
import { promptsSchema } from '../validators';

describe('promptsSchema', () => {
  const ok = (p: unknown) => promptsSchema.safeParse(p).success;
  const fail = (p: unknown) => !promptsSchema.safeParse(p).success;

  it('accepts empty array', () => expect(ok([])).toBe(true));
  it('accepts up to 3 unique entries', () =>
    expect(ok([
      { promptId: 'looking_for', answer: 'a' },
      { promptId: 'weekend',     answer: 'b' },
      { promptId: 'playlist',    answer: 'c' },
    ])).toBe(true));
  it('rejects 4 entries', () =>
    expect(fail([
      { promptId: 'looking_for', answer: 'a' },
      { promptId: 'weekend',     answer: 'b' },
      { promptId: 'playlist',    answer: 'c' },
      { promptId: 'first_date',  answer: 'd' },
    ])).toBe(true));
  it('rejects duplicate promptId', () =>
    expect(fail([
      { promptId: 'looking_for', answer: 'a' },
      { promptId: 'looking_for', answer: 'b' },
    ])).toBe(true));
  it('rejects answer > 200 chars', () =>
    expect(fail([
      { promptId: 'looking_for', answer: 'x'.repeat(201) },
    ])).toBe(true));
  it('rejects HTML in answer', () =>
    expect(fail([
      { promptId: 'looking_for', answer: '<b>hi</b>' },
    ])).toBe(true));
  it('rejects unknown promptId', () =>
    expect(fail([
      { promptId: 'totally_invented', answer: 'a' },
    ])).toBe(true));
});
```

- [ ] **Step 2: Run tests, verify they fail**
```
npx vitest run src/lib/__tests__/validators.test.ts
```
Expected: All 7 new tests fail (`promptsSchema` doesn't exist yet).

- [ ] **Step 3: Implement `promptsSchema`**

In `validators.ts`, add (importing from prompts catalogue — Task 9 creates it, so for now hardcode the IDs and we'll wire to the catalogue in a moment):

```ts
import { PROMPT_IDS } from '@/data/prompts';

const HTML_RE = /<[a-z!\/][\s\S]*?>/i;

export const promptsSchema = z.array(
  z.object({
    promptId: z.string().refine(id => (PROMPT_IDS as readonly string[]).includes(id), {
      message: 'Unknown prompt id',
    }),
    answer: z.string()
      .max(200, 'Answer must be 200 characters or less')
      .refine(s => !HTML_RE.test(s), 'HTML is not allowed'),
  })
).max(3, 'At most 3 prompts allowed').refine(
  arr => new Set(arr.map(a => a.promptId)).size === arr.length,
  'Duplicate prompt id',
);

export type PromptsSchema = z.infer<typeof promptsSchema>;
```

- [ ] **Step 4: Tests still fail because `@/data/prompts` doesn't exist** — proceed to Task 9 first, then return.

(The plan order interleaves: do Task 9, then re-run Step 5 below.)

- [ ] **Step 5: After Task 9, run tests**
```
npx vitest run src/lib/__tests__/validators.test.ts
```
Expected: All tests pass.

- [ ] **Step 6: Commit**
```
git add src/lib/validators.ts src/lib/__tests__/validators.test.ts
git commit -m "feat(validators): add promptsSchema with cap, dup, length, and HTML checks"
```

---

## Task 9: Frontend (TDD) — Prompts catalogue

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\data\prompts.ts`
- Create: `D:\src\aloevera-harmony-meet\src\data\__tests__\prompts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/data/__tests__/prompts.test.ts`:

```ts
import { PROMPT_CATALOG, PROMPT_IDS, getPromptText } from '@/data/prompts';

describe('PROMPT_CATALOG', () => {
  it('has 12 entries', () => {
    expect(PROMPT_CATALOG).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = PROMPT_CATALOG.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty ru and en text on every entry', () => {
    for (const p of PROMPT_CATALOG) {
      expect(p.ru.length).toBeGreaterThan(0);
      expect(p.en.length).toBeGreaterThan(0);
      expect(p.ru.length).toBeLessThanOrEqual(80);
      expect(p.en.length).toBeLessThanOrEqual(80);
    }
  });

  it('PROMPT_IDS mirrors PROMPT_CATALOG ids', () => {
    expect(PROMPT_IDS).toEqual(PROMPT_CATALOG.map(p => p.id));
  });

  it('getPromptText returns ru text for known id and ru lang', () => {
    expect(getPromptText('looking_for', 'ru')).toBe(
      PROMPT_CATALOG.find(p => p.id === 'looking_for')!.ru
    );
  });

  it('getPromptText returns null for unknown id', () => {
    expect(getPromptText('totally_invented', 'ru')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**
```
npx vitest run src/data/__tests__/prompts.test.ts
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create the catalogue**

Create `src/data/prompts.ts`:

```ts
export interface PromptCatalogEntry {
  id: string;
  ru: string;
  en: string;
}

export const PROMPT_CATALOG: readonly PromptCatalogEntry[] = [
  { id: 'aloevera_first',    ru: 'Моё первое знакомство с AloeVera…',     en: 'How I first found AloeVera…' },
  { id: 'aloevera_song',     ru: 'Любимая песня AloeVera и почему',       en: 'Favorite AloeVera song and why' },
  { id: 'concert_memory',    ru: 'Лучший момент с концерта AloeVera',     en: 'Best AloeVera concert memory' },
  { id: 'looking_for',       ru: 'Что я ищу здесь',                        en: "What I'm looking for here" },
  { id: 'weekend',           ru: 'Идеальные выходные — это…',             en: 'A perfect weekend looks like…' },
  { id: 'road_trip',         ru: 'На концерт AloeVera поеду…',             en: "I'd travel this far for an AloeVera show…" },
  { id: 'playlist',          ru: 'Кроме AloeVera я слушаю…',              en: 'Besides AloeVera I listen to…' },
  { id: 'instrument',        ru: 'Если бы я был в группе, играл бы на…',  en: "If I were in a band, I'd play…" },
  { id: 'unpopular_opinion', ru: 'Непопулярное мнение об AloeVera',        en: 'Unpopular AloeVera opinion' },
  { id: 'dream_setlist',     ru: 'Сетлист моей мечты',                     en: 'My dream AloeVera setlist' },
  { id: 'first_date',        ru: 'Идея для первого свидания',              en: 'First-date idea' },
  { id: 'dealbreaker',       ru: 'Меня точно не зацепит…',                 en: "Won't work for me…" },
] as const;

export const PROMPT_IDS: readonly string[] = PROMPT_CATALOG.map(p => p.id);

export function getPromptText(id: string, lang: 'ru' | 'en'): string | null {
  const entry = PROMPT_CATALOG.find(p => p.id === id);
  return entry ? entry[lang] : null;
}
```

- [ ] **Step 4: Run tests, verify they pass**
```
npx vitest run src/data/__tests__/prompts.test.ts
```
Expected: All 6 pass.

- [ ] **Step 5: Run validators tests (Task 8 Step 5)**
```
npx vitest run src/lib/__tests__/validators.test.ts
```
Expected: All `promptsSchema` tests now pass.

- [ ] **Step 6: Commit**
```
git add src/data/prompts.ts src/data/__tests__/prompts.test.ts
git commit -m "feat(data): add curated prompts catalogue (12 fan-flavoured prompts)"
```

---

## Task 10: Frontend — `usersApi.updateUser` carries prompts and images

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\usersApi.ts`

The wire shape already matches `UserDto` (the codebase pattern is "PUT the whole user back"). We just need to ensure `prompts` and `images` flow through both directions.

- [ ] **Step 1: Inspect current `updateUser` and `mapUserFromApi`**

Read `src/services/api/usersApi.ts`. Confirm:
- `updateUser(id, user)` already serialises the full user.
- `mapUserFromApi(dto)` already maps `images` (look for `images: dto.Images ?? []` or similar).

- [ ] **Step 2: Map `prompts`**

In `mapUserFromApi`, add a line that mirrors how `images` is mapped:

```ts
prompts: dto.Prompts ?? undefined,
```

(Camel-vs-Pascal: backend serialises `Prompts`. Confirm by checking how the existing `Images` field arrives at the frontend — match that exact casing convention.)

- [ ] **Step 3: Confirm `updateUser` transmits prompts**

If `updateUser` is doing a generic `apiClient.put('/api/v1/users/{id}', user)` with the User passed in, the new `prompts` field flows automatically. No change needed.

If there's a mapping function that builds the request body field-by-field, add `Prompts: user.prompts ?? null`.

- [ ] **Step 4: Build**
```
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**
```
git add src/services/api/usersApi.ts
git commit -m "feat(api): carry prompts through usersApi.updateUser and mapUserFromApi"
```

---

## Task 11: Frontend (TDD) — `commonGround` helper

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\lib\commonGround.ts`
- Create: `D:\src\aloevera-harmony-meet\src\lib\__tests__\commonGround.test.ts`

- [ ] **Step 1: Define the spike — does `User.eventsAttended` include upcoming events?**

Read `src/services/api/usersApi.ts` `mapUserFromApi`: how does it populate `eventsAttended`? Trace back to the backend: `UsersController.GetUser` calls `_eventService.GetEventsAttendedByUserAsync(id)`. Open `Lovecraft.Backend/Services/Azure/AzureEventService.cs`, find `GetEventsAttendedByUserAsync`. **Inspect**: does it filter by date, or return all events the user is in `Attendees` for?

- [ ] **Step 2: Lock the decision**

If `GetEventsAttendedByUserAsync` returns events regardless of date (likely), then `User.eventsAttended` already contains both past and upcoming. The `sharedUpcomingEvent` signal is feasible.

If it returns only past events (filter by `event.Date < now`), drop `sharedUpcomingEvent` from v1: remove that case from the helper, the test, the i18n keys, and the `<CommonGroundLine>` rendering.

Document the decision at the top of `commonGround.ts` as a comment.

- [ ] **Step 3: Write failing tests**

Create `src/lib/__tests__/commonGround.test.ts`:

```ts
import { commonGround } from '../commonGround';
import type { User, Event } from '@/types/user';

const baseUser = (id: string, overrides: Partial<User> = {}): User => ({
  id, name: id, age: 25, bio: '', location: '',
  gender: 'prefer-not-to-say', profileImage: '', images: [],
  lastSeen: new Date(), isOnline: false,
  preferences: { ageRange: [18, 65], maxDistance: 50, showMe: 'everyone' },
  settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  rank: 'novice', staffRole: 'none',
  ...overrides,
});

const event = (id: string, daysFromNow: number, title = id): Event => ({
  id, title, description: '', imageUrl: '',
  date: new Date(Date.now() + daysFromNow * 86400_000),
  location: '', attendees: [], category: 'concert', organizer: '',
});

describe('commonGround', () => {
  it('returns [] for self', () => {
    const u = baseUser('a');
    expect(commonGround(u, u)).toEqual([]);
  });

  it('returns sharedEventOne for one shared past event', () => {
    const evt = event('e1', -10);
    const a = baseUser('a', { eventsAttended: [evt] });
    const b = baseUser('b', { eventsAttended: [evt] });
    const r = commonGround(a, b);
    expect(r[0].kind).toBe('sharedEventOne');
  });

  it('returns sharedEventsMany when 2+ shared past events', () => {
    const events = [event('e1', -10), event('e2', -20)];
    const a = baseUser('a', { eventsAttended: events });
    const b = baseUser('b', { eventsAttended: events });
    const r = commonGround(a, b);
    expect(r[0]).toEqual({ kind: 'sharedEventsMany', count: 2 });
  });

  it('returns sharedRank for matching aloeCrew', () => {
    const a = baseUser('a', { rank: 'aloeCrew' });
    const b = baseUser('b', { rank: 'aloeCrew' });
    expect(commonGround(a, b)[0]).toEqual({ kind: 'sharedRank', rank: 'aloeCrew' });
  });

  it('does NOT return sharedRank for matching novice', () => {
    const a = baseUser('a', { rank: 'novice' });
    const b = baseUser('b', { rank: 'novice' });
    expect(commonGround(a, b).find(s => s.kind === 'sharedRank')).toBeUndefined();
  });

  it('returns sharedCity for case-insensitive location match', () => {
    const a = baseUser('a', { location: ' Moscow ' });
    const b = baseUser('b', { location: 'moscow' });
    expect(commonGround(a, b).some(s => s.kind === 'sharedCity')).toBe(true);
  });

  it('does NOT return sharedCity for empty location', () => {
    const a = baseUser('a', { location: '' });
    const b = baseUser('b', { location: '' });
    expect(commonGround(a, b).find(s => s.kind === 'sharedCity')).toBeUndefined();
  });

  it('orders signals: events > rank > city', () => {
    const evt = event('e1', -5);
    const a = baseUser('a', {
      eventsAttended: [evt], rank: 'aloeCrew', location: 'Moscow'
    });
    const b = baseUser('b', {
      eventsAttended: [evt], rank: 'aloeCrew', location: 'Moscow'
    });
    const r = commonGround(a, b);
    expect(r[0].kind).toBe('sharedEventOne');
    expect(r[1].kind).toBe('sharedRank');
    expect(r[2].kind).toBe('sharedCity');
  });

  it('returns [] when nothing matches', () => {
    const a = baseUser('a', { location: 'Moscow', rank: 'novice' });
    const b = baseUser('b', { location: 'Berlin', rank: 'novice' });
    expect(commonGround(a, b)).toEqual([]);
  });

  it('tolerates missing eventsAttended', () => {
    const a = baseUser('a');
    const b = baseUser('b', { location: 'X', rank: 'aloeCrew' });
    const aWithCity = { ...a, location: 'X', rank: 'aloeCrew' as const };
    expect(commonGround(aWithCity, b).length).toBeGreaterThan(0);
  });
});
```

If the spike (Step 2) confirms upcoming events flow through, also add this test:

```ts
  it('returns sharedUpcomingEvent for shared future event', () => {
    const evt = event('e-future', 30, 'AloeFest 2027');
    const a = baseUser('a', { eventsAttended: [evt] });
    const b = baseUser('b', { eventsAttended: [evt] });
    expect(commonGround(a, b).some(s => s.kind === 'sharedUpcomingEvent')).toBe(true);
  });
```

- [ ] **Step 4: Run tests, verify they fail**
```
npx vitest run src/lib/__tests__/commonGround.test.ts
```
Expected: All fail (module missing).

- [ ] **Step 5: Implement the helper**

Create `src/lib/commonGround.ts`:

```ts
import type { User, Event } from '@/types/user';

export type CommonGroundSignal =
  | { kind: 'sharedEventsMany'; count: number }
  | { kind: 'sharedEventOne'; event: Event }
  | { kind: 'sharedUpcomingEvent'; event: Event }
  | { kind: 'sharedRank'; rank: 'aloeCrew' | 'friendOfAloe' }
  | { kind: 'sharedCity'; city: string };

export function commonGround(viewer: User, target: User): CommonGroundSignal[] {
  if (viewer.id === target.id) return [];

  const out: CommonGroundSignal[] = [];
  const now = Date.now();

  const viewerEvents = viewer.eventsAttended ?? [];
  const targetEventIds = new Set((target.eventsAttended ?? []).map(e => e.id));
  const shared = viewerEvents.filter(e => targetEventIds.has(e.id));

  const sharedPast = shared.filter(e => e.date.getTime() < now);
  const sharedUpcoming = shared.filter(e => e.date.getTime() >= now);

  if (sharedPast.length >= 2) {
    out.push({ kind: 'sharedEventsMany', count: sharedPast.length });
  } else if (sharedPast.length === 1) {
    out.push({ kind: 'sharedEventOne', event: sharedPast[0] });
  }

  if (sharedUpcoming.length > 0) {
    out.push({ kind: 'sharedUpcomingEvent', event: sharedUpcoming[0] });
  }

  if (
    viewer.rank === target.rank &&
    (viewer.rank === 'aloeCrew' || viewer.rank === 'friendOfAloe')
  ) {
    out.push({ kind: 'sharedRank', rank: viewer.rank });
  }

  const vCity = viewer.location.trim().toLowerCase();
  const tCity = target.location.trim().toLowerCase();
  if (vCity && tCity && vCity === tCity) {
    out.push({ kind: 'sharedCity', city: viewer.location.trim() });
  }

  return out;
}
```

If Step 2 dropped the `sharedUpcomingEvent` signal, omit the corresponding `if (sharedUpcoming.length > 0)` block and the type-union member.

- [ ] **Step 6: Run tests, verify they pass**
```
npx vitest run src/lib/__tests__/commonGround.test.ts
```
Expected: All pass.

- [ ] **Step 7: Commit**
```
git add src/lib/commonGround.ts src/lib/__tests__/commonGround.test.ts
git commit -m "feat(profile): commonGround helper computes shared events/rank/city signals"
```

---

## Task 12: Frontend — install `@dnd-kit/core` and `@dnd-kit/sortable`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\package.json`
- Modify: `D:\src\aloevera-harmony-meet\bun.lock` (or `package-lock.json` — match the lockfile that's tracked)

- [ ] **Step 1: Install**

From `D:\src\aloevera-harmony-meet`:
```
bun add @dnd-kit/core @dnd-kit/sortable
```

(If the project uses npm instead — check by inspecting which lockfile is committed: `bun.lock` or `package-lock.json` — substitute `npm install --save @dnd-kit/core @dnd-kit/sortable`.)

- [ ] **Step 2: Verify install**
```
bun pm ls @dnd-kit/core @dnd-kit/sortable
```
Expected: both packages listed at recent versions.

- [ ] **Step 3: Commit**
```
git add package.json bun.lock
git commit -m "chore(deps): add @dnd-kit/core and @dnd-kit/sortable for photo grid reorder"
```

---

## Task 13: Frontend (TDD) — `<PhotoCarousel>` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\photo-carousel.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\__tests__\photo-carousel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/__tests__/photo-carousel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoCarousel } from '../photo-carousel';

describe('<PhotoCarousel>', () => {
  it('renders nothing when images is empty', () => {
    const { container } = render(<PhotoCarousel images={[]} mode="deck" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single image without dots when only one image', () => {
    render(<PhotoCarousel images={['/a.jpg']} mode="deck" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
    expect(screen.queryByTestId('photo-carousel-dots')).toBeNull();
  });

  it('shows dots when more than one image', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const dots = screen.getByTestId('photo-carousel-dots');
    expect(dots.children).toHaveLength(2);
  });

  it('advances on right-half tap (deck mode)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerUp(right, { clientX: 200 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/b.jpg');
  });

  it('rewinds on left-half tap (deck mode)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg', '/c.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    const left  = screen.getByTestId('photo-carousel-tap-left');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerUp(right, { clientX: 200 });
    fireEvent.pointerDown(left, { clientX: 50 });
    fireEvent.pointerUp(left, { clientX: 50 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
  });

  it('does not advance if pointer moved more than 10px (treats as drag)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerMove(right, { clientX: 250 });
    fireEvent.pointerUp(right, { clientX: 250 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
  });

  it('renders arrows in detail mode', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="detail" />);
    expect(screen.getByLabelText(/previous/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next/i)).toBeInTheDocument();
    expect(screen.queryByTestId('photo-carousel-tap-right')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**
```
npx vitest run src/components/ui/__tests__/photo-carousel.test.tsx
```
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the component**

Create `src/components/ui/photo-carousel.tsx`:

```tsx
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAP_THRESHOLD_PX = 10;

interface PhotoCarouselProps {
  images: string[];
  mode: 'deck' | 'detail';
  className?: string;
}

export function PhotoCarousel({ images, mode, className }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const downX = useRef<number | null>(null);

  if (images.length === 0) return null;

  const safeIndex = Math.min(index, images.length - 1);
  const next = () => setIndex(i => Math.min(i + 1, images.length - 1));
  const prev = () => setIndex(i => Math.max(i - 1, 0));

  const handlePointerDown = (e: React.PointerEvent) => { downX.current = e.clientX; };
  const handleTap = (advance: () => void) => (e: React.PointerEvent) => {
    if (downX.current === null) return;
    const moved = Math.abs(e.clientX - downX.current);
    downX.current = null;
    if (moved <= TAP_THRESHOLD_PX) advance();
  };

  return (
    <div className={cn('relative w-full h-full', className)}>
      <img
        src={images[safeIndex]}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      {images.length > 1 && (
        <div
          data-testid="photo-carousel-dots"
          className="absolute top-2 left-2 right-2 flex gap-1 pointer-events-none"
        >
          {images.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-opacity',
                i === safeIndex ? 'bg-white opacity-90' : 'bg-white opacity-40'
              )}
            />
          ))}
        </div>
      )}

      {mode === 'deck' && images.length > 1 && (
        <>
          <div
            data-testid="photo-carousel-tap-left"
            className="absolute inset-y-0 left-0 w-1/2 z-10"
            onPointerDown={handlePointerDown}
            onPointerUp={handleTap(prev)}
          />
          <div
            data-testid="photo-carousel-tap-right"
            className="absolute inset-y-0 right-0 w-1/2 z-10"
            onPointerDown={handlePointerDown}
            onPointerUp={handleTap(next)}
          />
        </>
      )}

      {mode === 'detail' && images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
            disabled={safeIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
            disabled={safeIndex === images.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**
```
npx vitest run src/components/ui/__tests__/photo-carousel.test.tsx
```
Expected: All 7 pass.

- [ ] **Step 5: Commit**
```
git add src/components/ui/photo-carousel.tsx src/components/ui/__tests__/photo-carousel.test.tsx
git commit -m "feat(ui): PhotoCarousel — tap-zone deck mode + arrows detail mode"
```

---

## Task 14: Frontend (TDD) — `<PromptCard>` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\profile\PromptCard.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\profile\__tests__\PromptCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { PromptCard } from '../PromptCard';
import { LanguageContext } from '@/contexts/LanguageContext';

const wrap = (ui: React.ReactNode, lang: 'ru' | 'en' = 'ru') => render(
  <LanguageContext.Provider value={{
    language: lang, setLanguage: () => {}, t: (k: string) => k,
  } as any}>{ui}</LanguageContext.Provider>
);

describe('<PromptCard>', () => {
  it('renders question text and answer', () => {
    wrap(<PromptCard prompt={{ promptId: 'looking_for', answer: 'Tour buddies' }} />);
    expect(screen.getByText('Что я ищу здесь')).toBeInTheDocument();
    expect(screen.getByText('Tour buddies')).toBeInTheDocument();
  });

  it('renders nothing for unknown promptId', () => {
    const { container } = wrap(
      <PromptCard prompt={{ promptId: 'totally_invented', answer: 'x' }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('uses en text when language is en', () => {
    wrap(<PromptCard prompt={{ promptId: 'looking_for', answer: 'x' }} />, 'en');
    expect(screen.getByText("What I'm looking for here")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**
```
npx vitest run src/components/profile/__tests__/PromptCard.test.tsx
```
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the component**

Create `src/components/profile/PromptCard.tsx`:

```tsx
import { useLanguage } from '@/contexts/LanguageContext';
import { getPromptText } from '@/data/prompts';
import type { PromptAnswer } from '@/types/user';
import { Card } from '@/components/ui/card';

interface PromptCardProps {
  prompt: PromptAnswer;
  className?: string;
}

export function PromptCard({ prompt, className }: PromptCardProps) {
  const { language } = useLanguage();
  const question = getPromptText(prompt.promptId, language);
  if (!question) return null;

  return (
    <Card className={className}>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          {question}
        </p>
        <p className="text-sm">{prompt.answer}</p>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**
```
npx vitest run src/components/profile/__tests__/PromptCard.test.tsx
```
Expected: All 3 pass.

- [ ] **Step 5: Commit**
```
git add src/components/profile/PromptCard.tsx src/components/profile/__tests__/PromptCard.test.tsx
git commit -m "feat(profile): PromptCard renders question + answer with i18n"
```

---

## Task 15: Frontend — `<CommonGroundLine>` and `<CommonGroundSection>`

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\profile\CommonGroundLine.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\profile\CommonGroundSection.tsx`

These are thin presentational components — the helper is unit-tested already, no separate component tests needed.

- [ ] **Step 1: Add i18n keys** (will be wired in Task 18; for now, hard-code Russian fallbacks via `t(key) ?? fallback` pattern).

- [ ] **Step 2: Create `CommonGroundLine.tsx`**

```tsx
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CommonGroundSignal } from '@/lib/commonGround';

interface CommonGroundLineProps {
  signal: CommonGroundSignal;
  className?: string;
}

export function CommonGroundLine({ signal, className }: CommonGroundLineProps) {
  const { t } = useLanguage();
  let text = '';
  switch (signal.kind) {
    case 'sharedEventsMany':
      text = t('commonGround.sharedEventsMany').replace('{count}', String(signal.count));
      break;
    case 'sharedEventOne':
      text = t('commonGround.sharedEventOne').replace('{event}', signal.event.title);
      break;
    case 'sharedUpcomingEvent':
      text = t('commonGround.sharedUpcomingEvent').replace('{event}', signal.event.title);
      break;
    case 'sharedRank':
      text = t(`commonGround.sharedRank.${signal.rank}`);
      break;
    case 'sharedCity':
      text = t('commonGround.sharedCity').replace('{city}', signal.city);
      break;
  }
  return (
    <div className={`flex items-center gap-1 text-xs opacity-95 ${className ?? ''}`}>
      <Sparkles className="w-3 h-3" />
      <span>{text}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `CommonGroundSection.tsx`**

```tsx
import type { CommonGroundSignal } from '@/lib/commonGround';
import { CommonGroundLine } from './CommonGroundLine';
import { useLanguage } from '@/contexts/LanguageContext';

interface CommonGroundSectionProps {
  signals: CommonGroundSignal[];
}

export function CommonGroundSection({ signals }: CommonGroundSectionProps) {
  const { t } = useLanguage();
  if (signals.length === 0) return null;
  const top = signals.slice(0, 3);
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">{t('commonGround.title')}</h3>
      <div className="space-y-1">
        {top.map((s, i) => <CommonGroundLine key={i} signal={s} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build**
```
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**
```
git add src/components/profile/CommonGroundLine.tsx src/components/profile/CommonGroundSection.tsx
git commit -m "feat(profile): CommonGroundLine + CommonGroundSection render derived signals"
```

---

## Task 16: Frontend — `<PhotoGrid>` component for Settings (drag-reorder)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\settings\PhotoGrid.tsx`

This is a presentational component with one piece of behaviour (drag reorder). We rely on `@dnd-kit/sortable`'s well-tested behaviour and don't unit-test the drag interaction (jsdom doesn't simulate drag well). The component is exercised in Task 20 manual testing.

- [ ] **Step 1: Implement**

```tsx
import { useRef } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadImage } from '@/services/api/imagesApi';
import { showApiError } from '@/lib/apiError';
import { useLanguage } from '@/contexts/LanguageContext';

interface PhotoGridProps {
  images: string[];
  maxPhotos: number;
  onChange: (next: string[]) => void;
}

interface SortableTileProps {
  url: string;
  onDelete: () => void;
}

function SortableTile({ url, onDelete }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-square rounded-lg overflow-hidden border touch-none ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
      {...listeners}
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center"
        aria-label="Delete photo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function PhotoGrid({ images, maxPhotos, onChange }: PhotoGridProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.indexOf(String(active.id));
    const newIndex = images.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  const handleFile = async (file: File) => {
    if (images.length >= maxPhotos) return;
    try {
      const { url } = await uploadImage(file);
      onChange([...images, url]);
    } catch (err) {
      showApiError(err, t('settings.photos.uploadFailed'));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-2">
          {images.map((url) => (
            <SortableTile
              key={url}
              url={url}
              onDelete={() => onChange(images.filter(u => u !== url))}
            />
          ))}
          {images.length < maxPhotos && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary"
              aria-label={t('settings.photos.add')}
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Build**
```
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**
```
git add src/components/settings/PhotoGrid.tsx
git commit -m "feat(settings): PhotoGrid with @dnd-kit drag-reorder + upload + delete"
```

---

## Task 17: Frontend — `<PromptsEditor>` for Settings

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\settings\PromptsEditor.tsx`

Form uses `react-hook-form` + `zodResolver(promptsSchema)` per the existing pattern (`src/lib/validators.ts`).

- [ ] **Step 1: Implement**

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { PROMPT_CATALOG } from '@/data/prompts';
import { promptsSchema, type PromptsSchema } from '@/lib/validators';
import type { PromptAnswer } from '@/types/user';

interface PromptsEditorProps {
  initial: PromptAnswer[];
  onSave: (prompts: PromptAnswer[]) => Promise<void>;
}

export function PromptsEditor({ initial, onSave }: PromptsEditorProps) {
  const { language, t } = useLanguage();
  const form = useForm<{ prompts: PromptsSchema }>({
    resolver: zodResolver(promptsSchema.transform(p => ({ prompts: p })) as any) as any,
    defaultValues: {
      prompts: [
        ...initial,
        ...Array(Math.max(0, 3 - initial.length)).fill({ promptId: '', answer: '' }),
      ].slice(0, 3),
    },
  });

  const watched = form.watch('prompts');

  const submit = form.handleSubmit(async ({ prompts }) => {
    const cleaned = prompts.filter(p => p.promptId && p.answer.trim().length > 0);
    await onSave(cleaned);
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {[0, 1, 2].map(i => {
        const usedElsewhere = new Set(watched.filter((_, j) => j !== i).map(p => p.promptId).filter(Boolean));
        const available = PROMPT_CATALOG.filter(p => !usedElsewhere.has(p.id));
        return (
          <div key={i} className="space-y-2 border rounded-md p-3">
            <Controller
              control={form.control}
              name={`prompts.${i}.promptId`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t('settings.prompts.placeholder')} /></SelectTrigger>
                  <SelectContent>
                    {available.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p[language]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Textarea
              {...form.register(`prompts.${i}.answer`)}
              maxLength={200}
              placeholder={t('settings.prompts.answerPlaceholder')}
            />
            <div className="text-xs text-muted-foreground">
              {watched[i]?.answer?.length ?? 0}/200
            </div>
            {form.formState.errors.prompts?.[i]?.answer && (
              <p className="text-xs text-destructive">
                {form.formState.errors.prompts[i]!.answer!.message}
              </p>
            )}
          </div>
        );
      })}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t('settings.prompts.save')}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Build**
```
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**
```
git add src/components/settings/PromptsEditor.tsx
git commit -m "feat(settings): PromptsEditor with 3-slot RHF + Zod form"
```

---

## Task 18: Frontend — i18n keys (ru + en)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\contexts\LanguageContext.tsx`

- [ ] **Step 1: Add keys to both `ru` and `en` translation objects**

Find the `ru = {` and `en = {` blocks and add:

```ts
// commonGround
'commonGround.title':                  'Общее' / 'In common',
'commonGround.sharedEventsMany':       'Вы оба были на {count} концертах AloeVera' / "You've both been to {count} AloeVera shows",
'commonGround.sharedEventOne':         'Вы оба были на {event}' / "You've both been to {event}",
'commonGround.sharedUpcomingEvent':    'Оба идут на {event}' / 'Both attending {event}',
'commonGround.sharedRank.aloeCrew':    'Оба — Aloe Crew' / 'Both Aloe Crew',
'commonGround.sharedRank.friendOfAloe':'Оба — Friend of Aloe' / 'Both Friend of Aloe',
'commonGround.sharedCity':             'Оба из {city}' / 'Both from {city}',

// settings.photos
'settings.photos.title':         'Фотографии' / 'Photos',
'settings.photos.add':           'Добавить фото' / 'Add photo',
'settings.photos.delete':        'Удалить' / 'Delete',
'settings.photos.dragHint':      'Перетащите, чтобы изменить порядок' / 'Drag to reorder',
'settings.photos.save':          'Сохранить' / 'Save',
'settings.photos.saveSuccess':   'Фото сохранены' / 'Photos saved',
'settings.photos.saveFailed':    'Не удалось сохранить фото' / 'Could not save photos',
'settings.photos.uploadFailed':  'Не удалось загрузить фото' / 'Could not upload photo',

// settings.prompts
'settings.prompts.title':              'Подсказки' / 'Prompts',
'settings.prompts.placeholder':        'Выберите вопрос' / 'Pick a prompt',
'settings.prompts.answerPlaceholder':  'Ваш ответ' / 'Your answer',
'settings.prompts.save':               'Сохранить' / 'Save',
'settings.prompts.saveSuccess':        'Подсказки сохранены' / 'Prompts saved',
'settings.prompts.saveFailed':         'Не удалось сохранить подсказки' / 'Could not save prompts',
```

(The format above shows ru/en side-by-side; the actual edit splits them across both objects in the file.)

If `sharedUpcomingEvent` was dropped in Task 11 Step 2, omit that key from both objects.

- [ ] **Step 2: Build**
```
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**
```
git add src/contexts/LanguageContext.tsx
git commit -m "i18n: add commonGround and settings.{photos,prompts} keys"
```

---

## Task 19: Frontend — Wire `<PhotoCarousel>`, `<CommonGroundLine>`, `<PromptCard>` into `Friends.tsx`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Friends.tsx`

- [ ] **Step 1: Add imports**

At the top of `Friends.tsx`:

```ts
import { PhotoCarousel } from '@/components/ui/photo-carousel';
import { CommonGroundLine } from '@/components/profile/CommonGroundLine';
import { CommonGroundSection } from '@/components/profile/CommonGroundSection';
import { PromptCard } from '@/components/profile/PromptCard';
import { commonGround } from '@/lib/commonGround';
import { useCurrentUser } from '@/hooks/useCurrentUser';
```

- [ ] **Step 2: Load the viewer (current user) once**

Inside the `Friends` component, near the top:

```tsx
const { user: viewer } = useCurrentUser();
```

- [ ] **Step 3: Compose photo array helper**

Anywhere in the file (helper, not inside component):

```ts
function composePhotos(user: { profileImage: string; images: string[] }): string[] {
  const set = new Set<string>();
  const out: string[] = [];
  if (user.profileImage) { set.add(user.profileImage); out.push(user.profileImage); }
  for (const u of user.images ?? []) {
    if (u && !set.has(u)) { set.add(u); out.push(u); }
  }
  return out.slice(0, 6);
}
```

- [ ] **Step 4: Replace the deck-card hero `<div style={backgroundImage}>` with `<PhotoCarousel>`**

In the search-tab `currentUser` render (around line 446–488), replace:

```tsx
<div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${currentUser.profileImage})` }}>
  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
    {/* existing content */}
  </div>
</div>
```

with:

```tsx
<PhotoCarousel images={composePhotos(currentUser)} mode="deck" className="absolute inset-0" />
<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70 pointer-events-none" />
<div className="absolute bottom-0 left-0 right-0 p-6 text-white">
  {/* existing content; see step 5 for additions */}
</div>
```

- [ ] **Step 5: Inject common-ground line + first prompt below the events row in the deck card**

Inside the existing bottom block (after the `eventsAttended` map, before the closing `</div>`), add:

```tsx
{viewer && (() => {
  const signals = commonGround(viewer, currentUser);
  return signals.length > 0 ? <CommonGroundLine signal={signals[0]} className="mt-2" /> : null;
})()}
{currentUser.prompts && currentUser.prompts.length > 0 && (
  <PromptCard prompt={currentUser.prompts[0]} className="mt-3 bg-black/30 border-white/20" />
)}
```

- [ ] **Step 6: Repeat for the `viewingUser` detail branch (lines ~332–398)**

Replace the same `bg-cover` div with `<PhotoCarousel images={composePhotos(viewingUser)} mode="detail" />` (the detail-mode arrows are visible). Below the existing bottom-of-card content, add a new section *outside* the gradient overlay (inside the surrounding card or just after it):

```tsx
{viewer && (
  <CommonGroundSection signals={commonGround(viewer, viewingUser)} />
)}
{viewingUser.prompts && viewingUser.prompts.length > 0 && (
  <div className="mt-4 space-y-2">
    {viewingUser.prompts.map((p, i) => <PromptCard key={i} prompt={p} />)}
  </div>
)}
```

- [ ] **Step 7: Visual check**

Run the dev server:
```
bun run dev
```
Open http://localhost:8080/friends. Confirm:
- Card shows tap-zone navigation between profile photos.
- Common-ground line appears under bio/events for users where the helper finds a match.
- A prompt card appears under common-ground for users with prompts.
- Pass/like still works (horizontal swipe + buttons).

(If `useCurrentUser` is not yet imported correctly or is the wrong hook name, double-check by reading `src/hooks/useCurrentUser.ts` first.)

- [ ] **Step 8: Run unit tests**
```
npx vitest run
```
Expected: All pass.

- [ ] **Step 9: Commit**
```
git add src/pages/Friends.tsx
git commit -m "feat(friends): photo carousel + common ground + first prompt on cards"
```

---

## Task 20: Frontend — Wire Photos and Prompts sub-sections into `SettingsPage.tsx`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\SettingsPage.tsx`

- [ ] **Step 1: Read the current SettingsPage structure**

Open `SettingsPage.tsx`. Note:
- How it loads the current user (probably `useCurrentUser`).
- How it dispatches updates (probably `usersApi.updateUser`).
- Where the existing profile-edit block sits — that's where we'll insert two new sections beneath.

- [ ] **Step 2: Add imports**

```ts
import { PhotoGrid } from '@/components/settings/PhotoGrid';
import { PromptsEditor } from '@/components/settings/PromptsEditor';
import { usersApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';
import { toast } from '@/components/ui/sonner';
import type { PromptAnswer } from '@/types/user';
```

- [ ] **Step 3: Photos sub-section**

After the existing profile-edit block, insert:

```tsx
{user && (
  <section className="mt-6">
    <h2 className="text-lg font-semibold mb-2">{t('settings.photos.title')}</h2>
    <p className="text-xs text-muted-foreground mb-3">{t('settings.photos.dragHint')}</p>
    <PhotoGridSettingsBlock user={user} />
  </section>
)}
```

Define `PhotoGridSettingsBlock` (locally inside the file or extract):

```tsx
function PhotoGridSettingsBlock({ user }: { user: User }) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<string[]>(() => {
    const seed = [user.profileImage, ...(user.images ?? [])].filter(Boolean);
    return Array.from(new Set(seed)).slice(0, 6);
  });

  const save = async () => {
    try {
      await usersApi.updateUser(user.id, { ...user, profileImage: photos[0] ?? '', images: photos });
      toast.success(t('settings.photos.saveSuccess'));
    } catch (err) {
      showApiError(err, t('settings.photos.saveFailed'));
    }
  };

  return (
    <>
      <PhotoGrid images={photos} maxPhotos={6} onChange={setPhotos} />
      <Button onClick={save} className="mt-3">{t('settings.photos.save')}</Button>
    </>
  );
}
```

- [ ] **Step 4: Prompts sub-section**

After the photos section:

```tsx
{user && (
  <section className="mt-6">
    <h2 className="text-lg font-semibold mb-3">{t('settings.prompts.title')}</h2>
    <PromptsEditor
      initial={user.prompts ?? []}
      onSave={async (prompts) => {
        try {
          await usersApi.updateUser(user.id, { ...user, prompts });
          toast.success(t('settings.prompts.saveSuccess'));
        } catch (err) {
          showApiError(err, t('settings.prompts.saveFailed'));
        }
      }}
    />
  </section>
)}
```

- [ ] **Step 5: Build & dev test**
```
npx tsc --noEmit
bun run dev
```
Open http://localhost:8080/settings. Confirm:
- Photo grid renders with the user's existing photos.
- "+" tile opens file picker; uploaded photo appears.
- Drag-reorder works; "Save" persists order.
- Prompts editor: 3 slots; second `<Select>` excludes the first slot's choice; counter turns red at 200; save toast appears.

- [ ] **Step 6: Run unit tests**
```
npx vitest run
```
Expected: All pass.

- [ ] **Step 7: Commit**
```
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): add Photos and Prompts sub-sections wired to usersApi"
```

---

## Task 21: Frontend — Mock data updates (so mock mode exercises the new UI)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockUsers.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockProfiles.ts`

- [ ] **Step 1: Add prompts and 2–3 photos to a couple of mock users**

In `mockUsers.ts` (and mirror in `mockProfiles.ts` if relevant — read the file structure first), pick 2–3 mock users and extend them:

```ts
{
  // existing fields…
  images: ['https://images.unsplash.com/photo-1500000000001/?w=600',
          'https://images.unsplash.com/photo-1500000000002/?w=600'],
  prompts: [
    { promptId: 'aloevera_song',  answer: 'Hometown — её играют каждый раз бис' },
    { promptId: 'looking_for',    answer: 'Тех, кто поедет на следующий тур' },
  ],
}
```

Use real existing Unsplash URLs that are already in the mock data — don't invent new IDs.

- [ ] **Step 2: Visual check in mock mode**
```
bun run dev
```
With `VITE_API_MODE=mock` (default), open `/friends`. Confirm photo carousel shows 2–3 photos for the seeded users and prompts render.

- [ ] **Step 3: Commit**
```
git add src/data/mockUsers.ts src/data/mockProfiles.ts
git commit -m "chore(mock): seed mock users with 2-3 photos and 2 prompts each"
```

---

## Task 22: End-to-end manual verification

- [ ] **Step 1: Build production bundle**
```
bun run build
```
Expected: `dist/` produced with no warnings.

- [ ] **Step 2: Start full stack locally (API mode)**

Run the backend in one terminal (from `D:\src\lovecraft\Lovecraft`):
```
dotnet run --project Lovecraft.Backend
```

Run the frontend in another (from `D:\src\aloevera-harmony-meet`):
```
VITE_API_MODE=api bun run dev
```

- [ ] **Step 3: Profile-photos flow**

1. Log in as `test@example.com` / `Test123!@#`.
2. Navigate to Settings.
3. Upload a photo → appears in grid.
4. Upload a second photo → appears in slot 2.
5. Drag photo 2 to slot 1 → order swaps.
6. Click Save → success toast.
7. Refresh → photos persist in same order.

- [ ] **Step 4: Prompts flow**

1. Settings → Prompts: pick "Что я ищу здесь" in slot 1, type "Tour buddies".
2. Slot 2: pick a different prompt, type something. Slot 3: leave empty.
3. Save → success toast.
4. Refresh → prompts persist.
5. Try to type 201 chars → blocked at 200.
6. Type `<b>x</b>` → save → backend rejects with `HTML_NOT_ALLOWED` (toast).

- [ ] **Step 5: Friends deck flow**

1. Navigate to Friends.
2. On a user with multiple photos: tap right half → next photo. Tap left half → previous photo. Horizontal swipe → pass/like (no photo change).
3. On a user with prompts: prompt card visible under bio.
4. On a user that shares your city: common-ground line shows "Оба из <city>".

- [ ] **Step 6: Profile detail flow**

1. From Friends, click into a user's profile detail.
2. Confirm carousel arrows work. Confirm common-ground section + all prompts visible.

- [ ] **Step 7: Mobile viewport**

Open Chrome DevTools, set device to iPhone 14 (390×844). Repeat Step 5. Confirm tap zones don't fight the swipe gesture (tap shouldn't ever trigger pass/like, swipe shouldn't ever flip photos).

- [ ] **Step 8: Both test suites green**

Backend:
```
cd D:\src\lovecraft\Lovecraft && dotnet test Lovecraft.UnitTests
```
Expected: all pass.

Frontend:
```
cd D:\src\aloevera-harmony-meet && npx vitest run
```
Expected: all pass.

- [ ] **Step 9: Document follow-ups**

If anything wasn't right (e.g. `sharedUpcomingEvent` decision flipped, mock mode revealed a layout quirk, etc.), note it and either fix in a follow-up commit or open an issue in `docs/ISSUES.md`.

---

## Self-review

**Spec coverage:** Walked the spec.

- B1 multi-photo deck card → Tasks 13, 19, 21.
- B1 photo upload/reorder in Settings → Tasks 12, 16, 20.
- B2 prompts data model → Tasks 1, 3, 4, 5.
- B2 prompts catalogue → Task 9.
- B2 prompts validation → Tasks 6, 8.
- B2 prompts editor in Settings → Tasks 17, 20.
- B2 prompts on profile detail + first-prompt on deck → Tasks 14, 19.
- B4 common-ground helper → Task 11.
- B4 common-ground UI → Tasks 15, 18, 19.
- API surface (extended `PUT /users/{id}`) → Tasks 6, 10.
- Tests (backend + frontend) — every behavioural task is TDD with explicit failing-then-passing steps.
- Manual verification → Task 22.

No spec section without a corresponding task.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate handling" left. Two soft references: Task 5 says "adjust constructor call to match adjacent test" (legit — test infra varies; the executor reads the file) and Task 11 has a 5-min spike to confirm whether `eventsAttended` includes future events (legit — locked decision rule, no ambiguity). Task 6 test file references `CreateAuthedClient` from `AclTests.cs` — flagged for the executor to mirror.

**Type consistency:**
- Backend: `PromptAnswerDto.PromptId`/`Answer` consistent in DTO, controller, services, tests, and constants.
- Frontend: `PromptAnswer.promptId`/`answer` consistent across `types/user.ts`, `validators.ts`, `prompts.ts` (catalogue uses `id`/`ru`/`en`, distinct from `PromptAnswer`), `commonGround.ts`, all components.
- `commonGround` returns `CommonGroundSignal[]`; `<CommonGroundLine>` accepts a single `signal`; `<CommonGroundSection>` accepts `signals[]`. Consistent.
- `<PhotoCarousel>` props `images: string[]; mode: 'deck' | 'detail'` consistent across implementation, tests, and call sites.
- Field name on `User`: `prompts?: PromptAnswer[]` everywhere on the frontend; `Prompts` on `UserDto` everywhere on the backend.

No issues found.
