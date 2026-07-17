# Anonymous Likes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user send a normal or anonymous ("secret") like; the recipient sees anonymous likes only as a count and never the sender's identity while pending, but a mutual like still becomes a normal (revealed) match.

**Architecture:** Anonymity is a per-like boolean persisted on the like rows. The backend excludes pending anonymous likes from the recipient's received list and exposes their count via a new endpoint. The frontend deck offers explicit Like / Secret-like buttons; swipe-right uses the logged-in user's Settings default.

**Tech Stack:** Backend — .NET 10, Azure Table Storage, xUnit + Moq. Frontend — React 18 + TypeScript + Vite, Vitest.

## Global Constraints

- Two repos: backend `lovecraft/` (work under `Lovecraft/`), frontend `aloevera-harmony-meet/`. Each gets its own `feature/anonymous-likes` branch. The frontend branch already exists (holds the spec).
- Backend: all enums serialize camelCase; every endpoint returns `ApiResponse<T>`; run tests with `dotnet test` from `Lovecraft/`.
- Frontend: dual-mode services (`isApiMode()`), keep mock branch working; run tests with `npm run test:run`; all user-facing text via `t()` with ru + en keys.
- `CreateLikeAsync` gains `bool anonymous = false` (defaulted) so existing callers/tests keep compiling.
- Existing like rows lack `IsAnonymous`; Azure/JSON deserialization defaults it to `false` — no migration.

---

## BACKEND (repo: `lovecraft`, working dir `Lovecraft/`)

### Task 1: Add `IsAnonymous` to the like model + count DTO

**Files:**
- Modify: `Lovecraft.Backend/Storage/Entities/LikeEntity.cs`
- Modify: `Lovecraft.Common/DTOs/Matching/MatchingDtos.cs`

**Interfaces:**
- Produces: `LikeEntity.IsAnonymous : bool`, `LikeDto.IsAnonymous : bool`, `CreateLikeRequestDto.Anonymous : bool`, `AnonymousLikeCountDto { int Count }`.

- [ ] **Step 1: Add the field to `LikeEntity`**

In `LikeEntity.cs`, after the `IsMatch` property:

```csharp
    public bool IsMatch { get; set; }
    public bool IsAnonymous { get; set; }
```

- [ ] **Step 2: Add fields + count DTO to `MatchingDtos.cs`**

Add `IsAnonymous` to `LikeDto` (after `IsMatch`):

```csharp
    public bool IsMatch { get; set; }
    public bool IsAnonymous { get; set; }
```

Add `Anonymous` to `CreateLikeRequestDto`:

```csharp
public class CreateLikeRequestDto
{
    public string ToUserId { get; set; } = string.Empty;
    public bool Anonymous { get; set; }
}
```

Add a new DTO at the end of the file:

```csharp
public class AnonymousLikeCountDto
{
    public int Count { get; set; }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj`
Expected: build succeeds (additive change).

- [ ] **Step 4: Commit**

```bash
git checkout -b feature/anonymous-likes
git add Lovecraft.Backend/Storage/Entities/LikeEntity.cs Lovecraft.Common/DTOs/Matching/MatchingDtos.cs
git commit -m "feat(matching): add IsAnonymous to like model + AnonymousLikeCountDto"
```

---

### Task 2: `IMatchingService` + `MockMatchingService` anonymity behavior

**Files:**
- Modify: `Lovecraft.Backend/Services/IServices.cs:81-87` (IMatchingService)
- Modify: `Lovecraft.Backend/Services/MockMatchingService.cs`
- Test: `Lovecraft.UnitTests/MatchingTests.cs`

**Interfaces:**
- Consumes: `LikeDto.IsAnonymous`, `CreateLikeRequestDto.Anonymous` (Task 1).
- Produces: `IMatchingService.CreateLikeAsync(string, string, bool anonymous = false)`, `IMatchingService.GetAnonymousReceivedCountAsync(string userId) : Task<int>`.

- [ ] **Step 1: Update the interface**

In `IServices.cs`, replace the `IMatchingService` body:

```csharp
public interface IMatchingService
{
    Task<LikeResponseDto> CreateLikeAsync(string fromUserId, string toUserId, bool anonymous = false);
    Task<List<LikeDto>> GetSentLikesAsync(string userId);
    Task<List<LikeDto>> GetReceivedLikesAsync(string userId);
    Task<int> GetAnonymousReceivedCountAsync(string userId);
    Task<List<MatchDto>> GetMatchesAsync(string userId);
}
```

- [ ] **Step 2: Write failing tests** in `MatchingTests.cs`

Add a helper that injects a mock producer, then the tests. Add near `CreateServices`:

```csharp
    private static (MockMatchingService matching, Mock<INotificationProducer> producer) CreateServicesWithProducer()
    {
        var chat = new MockChatService();
        var userSvc = new MockUserService(new MockAppConfigService());
        var producer = new Mock<INotificationProducer>();
        producer
            .Setup(p => p.ProduceAsync(It.IsAny<string>(), It.IsAny<NotificationType>(), It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync((NotificationDto?)null);
        var matching = new MockMatchingService(chat, userSvc, producer.Object);
        return (matching, producer);
    }
```

Add tests:

```csharp
    [Fact]
    public async Task CreateLike_Anonymous_PersistsFlag()
    {
        var (svc, _) = CreateServices();

        await svc.CreateLikeAsync("alice", "bob", anonymous: true);

        var stored = MockDataStore.Likes.Single(l => l.FromUserId == "alice" && l.ToUserId == "bob");
        Assert.True(stored.IsAnonymous);
    }

    [Fact]
    public async Task CreateLike_Anonymous_NotifiesWithNullActor()
    {
        var (svc, producer) = CreateServicesWithProducer();

        await svc.CreateLikeAsync("alice", "bob", anonymous: true);

        producer.Verify(p => p.ProduceAsync(
            "bob", NotificationType.LikeReceived, null, It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task CreateLike_Normal_NotifiesWithActor()
    {
        var (svc, producer) = CreateServicesWithProducer();

        await svc.CreateLikeAsync("alice", "bob");

        producer.Verify(p => p.ProduceAsync(
            "bob", NotificationType.LikeReceived, "alice", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task GetReceivedLikes_ExcludesAnonymous()
    {
        var (svc, _) = CreateServices();
        await svc.CreateLikeAsync("bob", "alice", anonymous: true);   // anonymous → hidden
        await svc.CreateLikeAsync("carol", "alice");                  // normal → shown

        var received = await svc.GetReceivedLikesAsync("alice");

        Assert.Single(received);
        Assert.Equal("carol", received[0].FromUserId);
    }

    [Fact]
    public async Task GetAnonymousReceivedCount_CountsPendingAnonymousOnly()
    {
        var (svc, _) = CreateServices();
        await svc.CreateLikeAsync("bob", "alice", anonymous: true);   // pending anonymous
        await svc.CreateLikeAsync("carol", "alice");                  // pending normal
        await svc.CreateLikeAsync("dave", "alice", anonymous: true);  // pending anonymous
        await svc.CreateLikeAsync("alice", "dave", anonymous: true);  // makes alice↔dave mutual → excluded

        var count = await svc.GetAnonymousReceivedCountAsync("alice");

        Assert.Equal(1, count); // only bob remains pending+anonymous
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `dotnet test --filter "FullyQualifiedName~MatchingTests"`
Expected: FAIL — `CreateLikeAsync` has no `anonymous` param yet / `GetAnonymousReceivedCountAsync` missing.

- [ ] **Step 4: Implement in `MockMatchingService.cs`**

Change the signature and persist the flag:

```csharp
    public async Task<LikeResponseDto> CreateLikeAsync(string fromUserId, string toUserId, bool anonymous = false)
    {
```

In the "Create new like" block, set the flag:

```csharp
        var like = new LikeDto
        {
            Id = Guid.NewGuid().ToString(),
            FromUserId = fromUserId,
            ToUserId = toUserId,
            CreatedAt = DateTime.UtcNow,
            IsMatch = false,
            IsAnonymous = anonymous
        };
```

Replace the non-mutual notification block (the part that reads `sender?.Settings?.AnonymousLikes`) with param-driven anonymity — delete the sender lookup:

```csharp
        // Non-mutual like: fire LikeReceived notification to recipient (skip self-action)
        if (_producer is not null && fromUserId != toUserId)
        {
            var payloadJson = JsonSerializer.Serialize(new
            {
                likeId = like.Id,
                anonymous,
            });
            await _producer.ProduceAsync(
                recipientUserId: toUserId,
                type: NotificationType.LikeReceived,
                actorId: anonymous ? null : fromUserId,
                payloadJson: payloadJson,
                sourceEventId: like.Id);
        }
```

Update `GetReceivedLikesAsync` to also exclude anonymous:

```csharp
        var likes = MockDataStore.Likes
            .Where(l => l.ToUserId == userId && !iLiked.Contains(l.FromUserId) && !l.IsAnonymous)
            .ToList();
        return Task.FromResult(likes);
```

Add the count method (place after `GetReceivedLikesAsync`):

```csharp
    public Task<int> GetAnonymousReceivedCountAsync(string userId)
    {
        var iLiked = MockDataStore.Likes
            .Where(l => l.FromUserId == userId)
            .Select(l => l.ToUserId)
            .ToHashSet();

        var count = MockDataStore.Likes
            .Count(l => l.ToUserId == userId && !iLiked.Contains(l.FromUserId) && l.IsAnonymous);
        return Task.FromResult(count);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test --filter "FullyQualifiedName~MatchingTests"`
Expected: PASS (all existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add Lovecraft.Backend/Services/IServices.cs Lovecraft.Backend/Services/MockMatchingService.cs Lovecraft.UnitTests/MatchingTests.cs
git commit -m "feat(matching): per-like anonymity in mock service + tests"
```

---

### Task 3: `AzureMatchingService` anonymity behavior

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureMatchingService.cs`

**Interfaces:**
- Consumes: `IMatchingService` (Task 2), `LikeEntity.IsAnonymous` (Task 1).
- Produces: same `IMatchingService` methods, Azure-backed.

> No dedicated Azure unit test harness exists for matching (the suite tests `MockMatchingService`). Verify by build + parity with Task 2 logic.

- [ ] **Step 1: Change signature + persist the flag on both rows**

Signature:

```csharp
    public async Task<LikeResponseDto> CreateLikeAsync(string fromUserId, string toUserId, bool anonymous = false)
    {
```

On the `likeEntity` (likes table) initializer, add `IsAnonymous = anonymous` after `IsMatch = isMutual`:

```csharp
        var likeEntity = new LikeEntity
        {
            PartitionKey = fromUserId,
            RowKey = toUserId,
            LikeId = likeId,
            FromUserId = fromUserId,
            ToUserId = toUserId,
            CreatedAt = now,
            IsMatch = isMutual,
            IsAnonymous = anonymous
        };
```

On the `likeReceivedEntity` (likesreceived mirror) initializer, add the same `IsAnonymous = anonymous` after `IsMatch = isMutual`.

- [ ] **Step 2: Replace the non-mutual notification block** (the `else` branch that fetches sender settings)

Delete the `GetUserByIdAsync` sender lookup and drive anonymity from the param:

```csharp
        else
        {
            // Non-mutual like: fire LikeReceived notification to recipient.
            // Anonymity comes from the request, not the sender's global setting.
            if (_producer is not null)
            {
                var payloadJson = JsonSerializer.Serialize(new
                {
                    likeId,
                    anonymous,
                });
                try
                {
                    await _producer.ProduceAsync(
                        recipientUserId: toUserId,
                        type: NotificationType.LikeReceived,
                        actorId: anonymous ? null : fromUserId,
                        payloadJson: payloadJson,
                        sourceEventId: likeId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to fire LikeReceived notification for {Recipient}", toUserId);
                }
            }
        }
```

- [ ] **Step 3: Exclude anonymous in `GetReceivedLikesAsync`**

Inside the `await foreach` over `_likesReceivedTable`, after the mutual-exclusion `continue`, add:

```csharp
            if (iLiked.Contains(entity.RowKey)) continue; // mutual → excluded
            if (entity.IsAnonymous) continue;             // anonymous → surfaced as count only
            results.Add(ToReceivedLikeDto(entity));
```

- [ ] **Step 4: Add `GetAnonymousReceivedCountAsync`** (place after `GetReceivedLikesAsync`)

```csharp
    public async Task<int> GetAnonymousReceivedCountAsync(string userId)
    {
        var iLiked = new HashSet<string>();
        await foreach (var e in _likesTable.QueryAsync<LikeEntity>(filter: $"PartitionKey eq '{userId}'"))
            iLiked.Add(e.RowKey);

        var count = 0;
        await foreach (var entity in _likesReceivedTable.QueryAsync<LikeEntity>(
            filter: $"PartitionKey eq '{userId}'"))
        {
            if (iLiked.Contains(entity.RowKey)) continue; // mutual → excluded
            if (entity.IsAnonymous) count++;
        }
        return count;
    }
```

- [ ] **Step 5: Carry `IsAnonymous` through the DTO mappers**

In `ToSentLikeDto` and `ToReceivedLikeDto`, add `IsAnonymous = entity.IsAnonymous,` to each returned `LikeDto`.

- [ ] **Step 6: Build + full backend test run**

Run: `dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj` then `dotnet test`
Expected: build succeeds; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add Lovecraft.Backend/Services/Azure/AzureMatchingService.cs
git commit -m "feat(matching): per-like anonymity in Azure service"
```

---

### Task 4: `MatchingController` — pass flag + count endpoint

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/MatchingController.cs`

**Interfaces:**
- Consumes: `CreateLikeRequestDto.Anonymous`, `IMatchingService.GetAnonymousReceivedCountAsync`, `AnonymousLikeCountDto`.
- Produces: `POST /api/v1/matching/likes` honoring `anonymous`; `GET /api/v1/matching/likes/received/anonymous-count`.

- [ ] **Step 1: Pass `anonymous` into the service** in `CreateLike`

```csharp
            var result = await _matchingService.CreateLikeAsync(currentUserId, request.ToUserId, request.Anonymous);
```

- [ ] **Step 2: Add the count endpoint** (after `GetReceivedLikes`). Add `using Lovecraft.Common.DTOs.Matching;` is already present.

```csharp
    /// <summary>
    /// Count of pending anonymous likes received by the current user
    /// </summary>
    [HttpGet("likes/received/anonymous-count")]
    public async Task<ActionResult<ApiResponse<AnonymousLikeCountDto>>> GetAnonymousReceivedCount()
    {
        var currentUserId = CurrentUserId;
        if (currentUserId == null) return Unauthorized();
        try
        {
            var count = await _matchingService.GetAnonymousReceivedCountAsync(currentUserId);
            return Ok(ApiResponse<AnonymousLikeCountDto>.SuccessResponse(new AnonymousLikeCountDto { Count = count }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting anonymous received count");
            return StatusCode(500, ApiResponse<AnonymousLikeCountDto>.ErrorResponse("INTERNAL_ERROR", "Failed to get anonymous like count"));
        }
    }
```

- [ ] **Step 3: Build + test**

Run: `dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj` && `dotnet test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add Lovecraft.Backend/Controllers/V1/MatchingController.cs
git commit -m "feat(matching): accept anonymous flag + anonymous-count endpoint"
```

---

## FRONTEND (repo: `aloevera-harmony-meet`, branch `feature/anonymous-likes`)

### Task 5: Types + `matchingApi` + service test

**Files:**
- Modify: `src/types/user.ts` (the `Like` interface)
- Modify: `src/services/api/matchingApi.ts`
- Test: `src/services/api/matchingApi.test.ts`

**Interfaces:**
- Produces: `matchingApi.sendLike(toUserId: string, anonymous?: boolean)`, `matchingApi.getAnonymousReceivedCount(): Promise<ApiResponse<number>>`, `Like.isAnonymous?: boolean`.

- [ ] **Step 1: Add `isAnonymous` to the `Like` type**

In `src/types/user.ts`, in the `Like` interface, add:

```typescript
  isAnonymous?: boolean;
```

- [ ] **Step 2: Write failing tests** in `matchingApi.test.ts`

Follow the file's existing mocking of `apiClient`. Add:

```typescript
  it('sendLike posts anonymous:true when requested (api mode)', async () => {
    setApiMode(true); // however the existing test toggles api mode
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: { isMatch: false }, timestamp: '' });

    await matchingApi.sendLike('u2', true);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/matching/likes', { toUserId: 'u2', anonymous: true });
  });

  it('sendLike defaults anonymous:false (api mode)', async () => {
    setApiMode(true);
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: { isMatch: false }, timestamp: '' });

    await matchingApi.sendLike('u2');

    expect(postSpy).toHaveBeenCalledWith('/api/v1/matching/likes', { toUserId: 'u2', anonymous: false });
  });

  it('getAnonymousReceivedCount maps the {count} envelope to a number (api mode)', async () => {
    setApiMode(true);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: { count: 3 }, timestamp: '' });

    const res = await matchingApi.getAnonymousReceivedCount();

    expect(res.success).toBe(true);
    expect(res.data).toBe(3);
  });
```

> Match `setApiMode`/import style to whatever `matchingApi.test.ts` already uses (it already tests api-mode branches). If the file toggles mode via `vi.mock('./apiClient', ...)`, reuse that mechanism instead of `setApiMode`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- matchingApi`
Expected: FAIL — `sendLike` ignores the 2nd arg / `getAnonymousReceivedCount` undefined.

- [ ] **Step 4: Implement in `matchingApi.ts`**

Replace `sendLike`:

```typescript
  async sendLike(toUserId: string, anonymous = false): Promise<ApiResponse<{ isMatch: boolean }>> {
    if (isApiMode()) {
      return apiClient.post<{ isMatch: boolean }>('/api/v1/matching/likes', { toUserId, anonymous });
    }
    return mockSuccess({ isMatch: false });
  },
```

Add `getAnonymousReceivedCount` (after `getReceivedLikes`):

```typescript
  async getAnonymousReceivedCount(): Promise<ApiResponse<number>> {
    if (isApiMode()) {
      const res = await apiClient.get<{ count: number }>('/api/v1/matching/likes/received/anonymous-count');
      return { ...res, data: res.success && res.data ? res.data.count : 0 };
    }
    return mockSuccess(0);
  },
```

In `getSentLikes` and `getReceivedLikes`, add `isAnonymous: dto.isAnonymous ?? false,` to the constructed `Like` objects so the flag flows to the UI.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- matchingApi`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/user.ts src/services/api/matchingApi.ts src/services/api/matchingApi.test.ts
git commit -m "feat(matching): sendLike anonymous flag + anonymous-count service"
```

---

### Task 6: i18n keys

**Files:**
- Modify: `src/contexts/LanguageContext.tsx`

**Interfaces:**
- Produces translation keys: `search.like`, `search.secretLike`, `likes.secretAdmirers`, `likes.sentSecretBadge`, `settings.anonymousLikes`, `settings.anonymousLikesHelp`.

- [ ] **Step 1: Add keys to the `ru` object**

```typescript
    'search.like': 'Лайк',
    'search.secretLike': 'Тайный лайк',
    'likes.secretAdmirers': 'Вас тайно лайкнули: {count}',
    'likes.sentSecretBadge': 'тайный',
    'settings.anonymousLikes': 'Тайные лайки',
    'settings.anonymousLikesHelp': 'Свайп вправо будет отправлять тайный лайк. Под карточкой всегда можно выбрать вручную.',
```

- [ ] **Step 2: Add the same keys to the `en` object**

```typescript
    'search.like': 'Like',
    'search.secretLike': 'Secret like',
    'likes.secretAdmirers': '{count} people liked you secretly',
    'likes.sentSecretBadge': 'secret',
    'settings.anonymousLikes': 'Secret likes',
    'settings.anonymousLikesHelp': 'Swipe right will send a secret like. You can still choose per profile under the card.',
```

- [ ] **Step 3: Verify the `{count}` interpolation is supported**

Confirm `t()` replaces `{count}` (the notification titles already use `{actor}` interpolation — same mechanism). If `t` takes a params object, call sites will use `t('likes.secretAdmirers', { count })`.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/LanguageContext.tsx
git commit -m "feat(i18n): anonymous likes strings (ru/en)"
```

---

### Task 7: Friends deck — 4 buttons + swipe-right default

**Files:**
- Modify: `src/pages/Friends.tsx`

**Interfaces:**
- Consumes: `matchingApi.sendLike(id, anonymous)` (Task 5), `viewer` from `useCurrentUser()` (already in file, `src/pages/Friends.tsx:63`), i18n keys (Task 6).
- Produces: `renderUserDeckCard(target, onPass, onLike, onSecretLike)` — a 4-arg deck renderer.

- [ ] **Step 1: Add `Lock` to the lucide import** at the top of `Friends.tsx` (append to the existing `lucide-react` import list): `Lock`.

- [ ] **Step 2: Update `handleLike` + add `handleSecretLike`** (near `src/pages/Friends.tsx:373`)

```tsx
  const handleLike = async () => {
    if (currentUser) {
      await matchingApi.sendLike(currentUser.id, viewer?.settings.anonymousLikes ?? false);
    }
    nextUser();
  };
  const handleSecretLike = async () => {
    if (currentUser) {
      await matchingApi.sendLike(currentUser.id, true);
    }
    nextUser();
  };
```

(Swipe-right maps to `onLike`, so the swipe path now follows the user's setting default via `handleLike`.)

- [ ] **Step 3: Extend `renderUserDeckCard`** signature (at `src/pages/Friends.tsx:930`)

```tsx
  const renderUserDeckCard = (target: User, onPass: () => void, onLike: () => void, onSecretLike: () => void) => (
```

- [ ] **Step 4: Replace the button row** (`src/pages/Friends.tsx:1047-1059`) with four buttons

```tsx
      <div className="flex justify-center items-center gap-4 mt-6">
        <Button size="lg" variant="outline" onClick={onPass} aria-label={t('search.pass')} className="rounded-full w-14 h-14 btn-pass"><X className="w-7 h-7" /></Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setShowDeckDetails(v => !v)}
          aria-label={showDeckDetails ? t('search.lessInfo') : t('search.moreInfo')}
          className="rounded-full w-11 h-11"
        >
          {showDeckDetails ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </Button>
        <Button size="lg" onClick={onLike} aria-label={t('search.like')} className="rounded-full w-14 h-14 btn-like"><Heart className="w-7 h-7" /></Button>
        <Button size="lg" onClick={onSecretLike} aria-label={t('search.secretLike')} className="rounded-full w-14 h-14 btn-like relative">
          <Heart className="w-7 h-7" />
          <Lock className="w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5" />
        </Button>
      </div>
```

> `t('search.pass')` may already exist; if not, reuse an existing skip label or add `search.pass` alongside Task 6 keys.

- [ ] **Step 5: Update the deck call site** (`src/pages/Friends.tsx:1169`)

```tsx
                {renderUserDeckCard(currentUser, handlePass, handleLike, handleSecretLike)}
```

- [ ] **Step 6: Update the single-profile (`?userId=`) call site** (`src/pages/Friends.tsx:1080`)

```tsx
          {renderUserDeckCard(
            viewingUser,
            () => navigate(-1),
            async () => {
              await matchingApi.sendLike(viewingUser.id, viewer?.settings.anonymousLikes ?? false);
              navigate(-1);
            },
            async () => {
              await matchingApi.sendLike(viewingUser.id, true);
              navigate(-1);
            }
          )}
```

- [ ] **Step 7: Verify build + lint**

Run: `npm run build` (typecheck) and `npm run lint`
Expected: no type errors; four buttons wired.

- [ ] **Step 8: Manual check** (mock mode `npm run dev`): the search deck shows Skip / Details / Like / Secret-like; all four are clickable and advance the deck.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat(friends): explicit like + secret-like deck buttons; swipe-right follows settings"
```

---

### Task 8: Friends Likes tab — anonymous count card + sent badge

**Files:**
- Modify: `src/pages/Friends.tsx`

**Interfaces:**
- Consumes: `matchingApi.getAnonymousReceivedCount()` (Task 5), i18n keys (Task 6).

- [ ] **Step 1: Add state** near the likes state (`src/pages/Friends.tsx:78-80`)

```tsx
  const [anonymousReceivedCount, setAnonymousReceivedCount] = useState(0);
```

- [ ] **Step 2: Fetch it alongside the other likes data.** In the `Promise.all` block (around `src/pages/Friends.tsx:177-182`), add the call and set state:

```tsx
      const [matchesRes, sentRes, receivedRes, anonCountRes] = await Promise.all([
        matchingApi.getMatches(),
        matchingApi.getSentLikes(),
        matchingApi.getReceivedLikes(),
        matchingApi.getAnonymousReceivedCount(),
      ]);
      if (matchesRes.success && matchesRes.data) setMatches(matchesRes.data);
      // ...existing sent/received setters...
      if (anonCountRes.success && typeof anonCountRes.data === 'number') setAnonymousReceivedCount(anonCountRes.data);
```

(Preserve the existing `sentRes`/`receivedRes` handling; only add the 4th promise + its setter.)

- [ ] **Step 3: Render the summary card** at the top of the Received sub-tab (`src/pages/Friends.tsx:1194`, inside `<TabsContent value="received">`, before the `receivedLikes.map`)

```tsx
              <TabsContent value="received" className="mt-4">
                {anonymousReceivedCount > 0 && (
                  <Card className="profile-card mb-4">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Lock className="w-6 h-6 text-primary shrink-0" />
                      <p className="text-sm font-medium">{t('likes.secretAdmirers', { count: anonymousReceivedCount })}</p>
                    </CardContent>
                  </Card>
                )}
                {receivedLikes.map((like) => (
```

> `Card`/`CardContent` are already imported in `Friends.tsx` (used by `UserCard`). `Lock` was added in Task 7.

- [ ] **Step 4: Add the "secret" badge to Sent items** (`src/pages/Friends.tsx:1190`)

Change the Sent `UserCard` subtitle to append the badge when anonymous:

```tsx
                {sentLikes.map((like) => (
                  <UserCard key={like.id} user={like.toUser}
                    subtitle={`${`Лайк отправлен ${formatDateShort(like.createdAt)}`}${like.isAnonymous ? ` · ${t('likes.sentSecretBadge')}` : ''}`} />
                ))}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Manual check** (mock mode): Received tab renders the count card only when count > 0; Sent tab shows the "secret" suffix on anonymous likes (mock data may show 0/none — that's acceptable in mock mode).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat(friends): secret-admirer count card + sent secret badge"
```

---

### Task 9: Settings toggle — enable + persist

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `usersApi.updateUser(id, updates)` (already used at `src/pages/SettingsPage.tsx:96`), i18n keys (Task 6).

- [ ] **Step 1: Add an immediate-persist handler** near the other handlers in `SettingsPage.tsx`

```tsx
  const handleToggleAnonymousLikes = async (checked: boolean) => {
    const next = { ...user, settings: { ...user.settings, anonymousLikes: checked } };
    setUser(next);
    const res = await usersApi.updateUser(user.id, next);
    if (!res.success) {
      setUser(user); // revert on failure
      showApiError(res, 'Failed to update setting');
    }
  };
```

> Confirm `showApiError` is imported in `SettingsPage.tsx`; if not, add `import { showApiError } from '@/lib/apiError';`.

- [ ] **Step 2: Enable + wire the Switch** (`src/pages/SettingsPage.tsx:407`)

Replace the disabled anonymous-likes Switch and its label with an enabled, wired version:

```tsx
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <p className="text-sm font-medium">{t('settings.anonymousLikes')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.anonymousLikesHelp')}</p>
                    </div>
                    <Switch
                      checked={user.settings.anonymousLikes}
                      onCheckedChange={handleToggleAnonymousLikes}
                    />
                  </div>
```

> Keep it consistent with the surrounding markup — reuse the existing row wrapper/label pattern from the neighboring `profileVisibility`/`notifications` rows; only this row becomes enabled. `profileVisibility` and `notifications` stay disabled.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Manual check** (API mode, or mock): toggling the switch flips immediately; in API mode a reload preserves it (persisted via `PUT /users/{id}` → `SettingsJson`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): enable + persist anonymous-likes default toggle"
```

---

## Final verification

- [ ] Backend: `cd Lovecraft && dotnet test` → all green.
- [ ] Frontend: `npm run test:run` and `npm run build` → all green.
- [ ] End-to-end (API mode, `VITE_API_MODE=api`): with Settings toggle OFF, swipe right → recipient's notification shows the sender; Secret-like button → recipient gets a "someone liked you" notification with no name and the Received tab count increments; a mutual like on a previously-anonymous like appears as a revealed match for both. (Use the `verify` skill for this pass.)
- [ ] Update `docs/ISSUES.md` MCF.8 status to reflect anonymous likes shipped.

## Self-review notes (author)

- **Spec coverage:** data model (T1), notification anonymity from per-like flag (T2/T3), received exclusion + count (T2/T3/T4), 4 buttons + swipe default (T7), count card + sent badge (T8), settings enable/persist (T9), i18n (T6), tests (T2, T5). All spec sections mapped.
- **Type consistency:** `CreateLikeAsync(..., bool anonymous = false)`, `GetAnonymousReceivedCountAsync : Task<int>`, `AnonymousLikeCountDto { int Count }`, `sendLike(id, anonymous=false)`, `getAnonymousReceivedCount(): Promise<ApiResponse<number>>`, `Like.isAnonymous?`, `renderUserDeckCard(target,onPass,onLike,onSecretLike)` — used consistently across tasks.
- **Assumption flagged for executor:** `matchingApi.test.ts` mode-toggling mechanism and `SettingsPage.tsx` settings-row markup should be matched to the files' existing patterns rather than the illustrative snippets above.
