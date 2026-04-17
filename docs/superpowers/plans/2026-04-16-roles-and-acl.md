# Roles & ACL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-16-roles-and-acl-design.md`

**Goal:** Layer two systems on top of the existing user model — auto-computed user ranks (novice → aloeCrew) driven by activity counters and configurable thresholds in a new `appconfig` Azure table, and manually-assigned staff roles (none/moderator/admin) — with full ACL enforcement in the forum endpoints and user-facing badges + gating in the frontend.

**Architecture:** Backend gains a new `appconfig` table read through a cached `IAppConfigService` singleton, a pair of pure static helpers (`RankCalculator`, `EffectiveLevel`), counter hooks in Forum/Matching/Event services, three new admin-only endpoints, and ACL enforcement in existing forum write paths. Frontend gains new types, translation keys, a `<UserBadges />` component placed at four sites, and gating UI in Talks/TopicDetail/CreateTopicModal. Staff role is carried as a JWT claim so authorization checks are zero-DB-hit; token refresh (≤15 min) is the staleness ceiling.

**Tech Stack:** .NET 10 (C# 13), Azure Table Storage, `IMemoryCache`, xUnit 2.9 + Moq 4.20, SignalR (unchanged), React 18 + TypeScript + Vite + shadcn/ui + Tailwind, `react-hook-form`, Zod, Vitest + React Testing Library, `LanguageContext` (custom i18n).

---

## Spec Coverage Map

| Spec section | Tasks |
|---|---|
| `UserEntity` new fields | P1-T1 |
| `UserDto` / `ForumReplyDto` new fields | P3-T4, P5-T3 |
| `ForumSectionEntity` / `ForumTopicEntity` new fields | P1-T2 |
| `CreateTopicRequestDto` new optional fields | P5-T2 |
| New `appconfig` table + partitions | P1-T3, P1-T4, P7-T1 |
| `IAppConfigService` + Mock + Azure | P2-T1, P2-T2, P2-T3, P2-T4 |
| `RankCalculator` | P3-T2 |
| `EffectiveLevel` | P3-T1 |
| New endpoints (`PUT /users/{id}/role`, `PUT /users/{id}/rank-override`, `GET /admin/config`) | P6-T2, P6-T3, P6-T4 |
| Modified endpoints (forum sections/topics/replies) | P5-T4 through P5-T8 |
| Error codes (`INSUFFICIENT_RANK`, `ADMIN_REQUIRED`, `MODERATOR_REQUIRED`) | P6-T1, P5-T4..T8 |
| Counter increment hooks | P4-T1 through P4-T3 |
| Permission matrix enforcement | P5-T4..T8, P6-T2..T4 |
| `<UserBadges />` component | P9-T1 |
| `<UserBadges />` usage (4 sites) | P10-T1..T4 |
| Gated forum UI | P11-T1..T3 |
| Translation keys | P8-T5 |
| Seeder updates | P7-T1, P7-T2, P7-T4 |
| `MockDataStore` updates | P7-T3 |
| `RankCalculatorTests` | P3-T2 |
| `AclTests` | P5-T4..T8, P6-T2..T4 |
| Documentation updates | P12-T1..T5 |

---

## File Structure

### Backend — files created

| Path | Purpose |
|---|---|
| `Lovecraft/Lovecraft.Backend/Storage/Entities/AppConfigEntity.cs` | Table row: PK = partition name (`rank_thresholds` \| `permissions`), RK = config key, `Value` string |
| `Lovecraft/Lovecraft.Backend/Services/AppConfig.cs` | `AppConfig`, `RankThresholds`, `PermissionConfig` records + default values |
| `Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs` | Interface |
| `Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs` | Mock impl — hardcoded defaults |
| `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs` | Azure impl with 1-hour `IMemoryCache` |
| `Lovecraft/Lovecraft.Backend/Helpers/EffectiveLevel.cs` | Static level map + `For()` + `Parse()` |
| `Lovecraft/Lovecraft.Backend/Helpers/RankCalculator.cs` | Static rank computation |
| `Lovecraft/Lovecraft.Backend/Auth/RequireStaffRoleAttribute.cs` | Action filter enforcing admin/moderator |
| `Lovecraft/Lovecraft.Backend/Auth/RequirePermissionAttribute.cs` | Action filter enforcing `permissions.*` key |
| `Lovecraft/Lovecraft.Backend/Auth/AuthorizationErrors.cs` | Shared error codes + helper to serialize them |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs` | `GET /admin/config` |
| `Lovecraft/Lovecraft.Common/Enums/UserRank.cs` | `UserRank` enum |
| `Lovecraft/Lovecraft.Common/Enums/StaffRole.cs` | `StaffRole` enum |
| `Lovecraft/Lovecraft.Common/DTOs/Admin/AdminDtos.cs` | `AppConfigDto`, `AssignRoleRequestDto`, `SetRankOverrideRequestDto`, `UpdateTopicRequestDto` |
| `Lovecraft/Lovecraft.UnitTests/EffectiveLevelTests.cs` | Unit tests |
| `Lovecraft/Lovecraft.UnitTests/RankCalculatorTests.cs` | Unit tests |
| `Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs` | Unit tests for Mock + Azure service |
| `Lovecraft/Lovecraft.UnitTests/AclTests.cs` | ACL enforcement tests |
| `Lovecraft/Lovecraft.UnitTests/AdminEndpointTests.cs` | Admin controller integration-ish tests |

### Backend — files modified

| Path | Change |
|---|---|
| `Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs` | Add `ReplyCount`, `LikesReceived`, `EventsAttended`, `MatchCount`, `StaffRole`, `RankOverride` |
| `Lovecraft/Lovecraft.Backend/Storage/Entities/ForumSectionEntity.cs` | Add `MinRank` |
| `Lovecraft/Lovecraft.Backend/Storage/Entities/ForumTopicEntity.cs` | Add `MinRank`, `NoviceVisible`, `NoviceCanReply` |
| `Lovecraft/Lovecraft.Backend/Storage/TableNames.cs` | Add `AppConfig` name |
| `Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs` | Add `Rank`, `StaffRole` |
| `Lovecraft/Lovecraft.Common/DTOs/Forum/ForumDtos.cs` | Extend `ForumSectionDto`, `ForumTopicDto`, `ForumReplyDto`, `CreateTopicRequestDto` |
| `Lovecraft/Lovecraft.Backend/Services/IServices.cs` | `IUserService.IncrementCounterAsync`, `IUserService.SetStaffRoleAsync`, `IUserService.SetRankOverrideAsync`; `IForumService` update-topic + delete ops |
| `Lovecraft/Lovecraft.Backend/Services/MockUserService.cs` | Implement new methods, compute rank in responses |
| `Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs` | Same as mock |
| `Lovecraft/Lovecraft.Backend/Services/MockForumService.cs` | Counter hook, MinRank/noviceVisible/noviceCanReply support, topic update, delete ops |
| `Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs` | Same |
| `Lovecraft/Lovecraft.Backend/Services/Caching/CachingForumService.cs` | Pass-through new methods + invalidate on changes |
| `Lovecraft/Lovecraft.Backend/Services/MockMatchingService.cs` | Counter hooks on like + match |
| `Lovecraft/Lovecraft.Backend/Services/Azure/AzureMatchingService.cs` | Same |
| `Lovecraft/Lovecraft.Backend/Services/MockEventService.cs` | Counter hook on register |
| `Lovecraft/Lovecraft.Backend/Services/Azure/AzureEventService.cs` | Same |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs` | Admin-only `PUT {id}/role`, `PUT {id}/rank-override` |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs` | Enforce create-topic permission, section/topic MinRank, noviceVisible, noviceCanReply, new `PUT topics/{id}` |
| `Lovecraft/Lovecraft.Backend/Auth/IJwtService.cs` + `JwtService.cs` | Add `StaffRole` custom claim to issued tokens |
| `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs` / `Azure/AzureAuthService.cs` | Pass `StaffRole` into `JwtService` when issuing |
| `Lovecraft/Lovecraft.Backend/Program.cs` | DI registration for `IAppConfigService` and its Azure table client |
| `Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs` | Seed activity counters + staff roles on test users |
| `Lovecraft/Lovecraft.Tools.Seeder/Program.cs` | Add `appconfig` to `allTables`, seed both partitions, seed user activity counters + staff role, seed forum section MinRank |

### Frontend — files created

| Path | Purpose |
|---|---|
| `src/types/forum.ts` | Shared `ForumSection`/`ForumTopic`/`ForumReply` types with rank/role fields |
| `src/components/ui/user-badges.tsx` | `<UserBadges />` |
| `src/components/ui/__tests__/user-badges.test.tsx` | Component tests |
| `src/services/api/adminApi.ts` | `adminApi.getConfig`, `assignRole`, `setRankOverride` |
| `src/hooks/useCurrentUser.tsx` | Memoized profile load with new `rank` / `staffRole` fields |
| `src/lib/acl.ts` | `effectiveLevel()`, `meetsRank()`, `meetsLevel()` helpers mirroring backend |
| `src/lib/__tests__/acl.test.ts` | Unit tests |

### Frontend — files modified

| Path | Change |
|---|---|
| `src/types/user.ts` | Add `UserRank`, `StaffRole`, extend `User` |
| `src/services/api/usersApi.ts` | `mapUserFromApi` passes `rank`/`staffRole` |
| `src/services/api/forumsApi.ts` | Surface `minRank`, `noviceVisible`, `noviceCanReply`, `authorRank`, `authorStaffRole` |
| `src/contexts/LanguageContext.tsx` | Add `rank.*`, `staffRole.*`, `forum.lockedSection`, `forum.replyRestricted`, `forum.noviceVisible`, `forum.noviceCanReply` keys |
| `src/components/forum/TopicDetail.tsx` | Render `<UserBadges />` on OP + each reply; hide reply form when `noviceCanReply=false` and user is novice |
| `src/components/forum/CreateTopicModal.tsx` | Two toggles: `noviceVisible`, `noviceCanReply` |
| `src/pages/Talks.tsx` | Lock-icon sections + gated toast |
| `src/pages/Friends.tsx` | `<UserBadges />` in swipe card + chat list |
| `src/pages/SettingsPage.tsx` | `<UserBadges />` under display name |
| `src/data/mockForumData.ts` | Add `minRank`, `noviceVisible`, `noviceCanReply`, `authorRank`, `authorStaffRole` to mock data |

### Documentation

| Path | Change |
|---|---|
| `docs/ISSUES.md` | Mark MCF.12 partially resolved; update active count |
| `docs/FEATURES.md` | Add section 9: Roles & Ranks |
| `docs/ARCHITECTURE.md` | Add ACL to layers; mention `RankCalculator` + `IAppConfigService` |
| `AGENTS.md` | Add `<UserBadges />` to component patterns; add `UserRank`/`StaffRole` to types; note `appconfig` |
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | Add new endpoints, new table, new unit test count |

---

## Implementation Note on JWT StaffRole Claim

The spec calls for admin-only endpoints but doesn't specify whether `StaffRole` should be carried in the JWT. **We put it in the JWT as a custom claim (`staffRole`).** Tradeoffs:

- ✅ Zero DB hits per authorization check — critical because every forum reply lookup would otherwise require a user read
- ✅ Existing refresh flow (15 min access-token TTL) naturally limits staleness
- ❌ Role assignment does not immediately kick an active user; they keep old privileges until the next refresh (worst case 15 min)

The `[RequireStaffRole]` filter and ACL code therefore reads `User.FindFirst("staffRole")?.Value` — not the database. The 15-minute staleness is acceptable for MVP; an admin panel spec may later add a forced-logout endpoint.

---

## Phase Summary & Checkpoints

| # | Phase | Checkpoint behavior |
|---|---|---|
| 1 | Backend Foundation (Entities & Storage) | Build green, tests pass. No behavior change. |
| 2 | `IAppConfigService` | Service resolves defaults + mock values. Still unused. |
| 3 | `EffectiveLevel` + `RankCalculator` + `UserDto` rank exposure | `/users/me` starts returning `rank: "novice"` / `staffRole: "none"` for everyone. |
| 4 | Counter hooks + activity seeding | New likes/replies/events tick counters. Mock users in Phase 3+ now return non-novice ranks. |
| 5 | Forum ACL enforcement | Forum write paths enforce rank/permission. `AclTests` pass. Novice cannot create topic unless `permissions.create_topic=novice`. |
| 6 | Admin endpoints + role/permission filters | `PUT /users/{id}/role`, `PUT /users/{id}/rank-override`, `GET /admin/config` available and admin-gated. |
| 7 | Seeder + mock data parity | Fresh seeder run creates `appconfig` table with defaults, promotes Anna/Dmitry/Elena/Maria to matching ranks. |
| 8 | Frontend types + API mapping + translations | Frontend can read `rank`/`staffRole` off user objects; keys are in `LanguageContext`. No UI yet. |
| 9 | `<UserBadges />` component | Component + tests. Not used anywhere yet. |
| 10 | Badge placement | Badges appear in TopicDetail, Friends swipe+chat, SettingsPage. |
| 11 | Frontend gating UI | Talks locks sections, TopicDetail hides reply form, CreateTopicModal has toggles. |
| 12 | Documentation | Docs reflect shipped behavior. |

Each task follows TDD: **write failing test → run, see it fail → implement → run, see it pass → commit**. Exceptions (mechanical DTO extensions, seeder additions, docs) skip the test steps and are noted explicitly.

---

# Phase 1 — Backend Foundation (Entities & Storage)

## P1-T1: Add activity counters, staff role, rank override to `UserEntity`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs`

Mechanical field addition — no test.

- [ ] **Step 1: Add the new fields**

Open `UserEntity.cs` and add these properties immediately below `FavoriteSongJson`:

```csharp
public int ReplyCount { get; set; }
public int LikesReceived { get; set; }
public int EventsAttended { get; set; }
public int MatchCount { get; set; }
public string StaffRole { get; set; } = "none";
public string? RankOverride { get; set; }
```

Azure Table Storage is flexible — existing rows without these columns still deserialize (ints default to 0, string defaults apply). No migration required.

- [ ] **Step 2: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs
git -C D:/src/lovecraft commit -m "feat(acl): add activity counters, staff role, rank override to UserEntity"
```

---

## P1-T2: Add `MinRank` to `ForumSectionEntity` and gating fields to `ForumTopicEntity`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Storage/Entities/ForumSectionEntity.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Storage/Entities/ForumTopicEntity.cs`

- [ ] **Step 1: Add `MinRank` to `ForumSectionEntity`**

Add after `OrderIndex`:

```csharp
public string MinRank { get; set; } = "novice";
```

- [ ] **Step 2: Add three fields to `ForumTopicEntity`**

Add after `UpdatedAt`:

```csharp
public string MinRank { get; set; } = "novice";
public bool? NoviceVisible { get; set; }
public bool? NoviceCanReply { get; set; }
```

Nullable booleans allow backward compatibility with existing rows; the service resolves `null → true` at read time (spec §ForumTopicEntity).

- [ ] **Step 3: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Storage/Entities/ForumSectionEntity.cs Lovecraft/Lovecraft.Backend/Storage/Entities/ForumTopicEntity.cs
git -C D:/src/lovecraft commit -m "feat(acl): add MinRank to forum section and novice-visibility fields to forum topic"
```

---

## P1-T3: Add `appconfig` to `TableNames`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Storage/TableNames.cs`

- [ ] **Step 1: Add one line**

Add inside `public static class TableNames`, right after `Messages`:

```csharp
public static string AppConfig       => Prefix + "appconfig";
```

- [ ] **Step 2: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: builds.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Storage/TableNames.cs
git -C D:/src/lovecraft commit -m "feat(acl): add appconfig table name"
```

---

## P1-T4: Create `AppConfigEntity` and `UserRank` / `StaffRole` enums

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Storage/Entities/AppConfigEntity.cs`
- Create: `Lovecraft/Lovecraft.Common/Enums/UserRank.cs`
- Create: `Lovecraft/Lovecraft.Common/Enums/StaffRole.cs`

- [ ] **Step 1: Write `AppConfigEntity`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public class AppConfigEntity : ITableEntity
{
    // PK = partition name ("rank_thresholds" | "permissions")
    // RK = config key (e.g. "active_replies", "create_topic")
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Value { get; set; } = string.Empty;

    public const string PartitionRankThresholds = "rank_thresholds";
    public const string PartitionPermissions = "permissions";
}
```

- [ ] **Step 2: Write `UserRank`**

```csharp
namespace Lovecraft.Common.Enums;

public enum UserRank
{
    Novice,
    ActiveMember,
    FriendOfAloe,
    AloeCrew
}
```

- [ ] **Step 3: Write `StaffRole`**

```csharp
namespace Lovecraft.Common.Enums;

public enum StaffRole
{
    None,
    Moderator,
    Admin
}
```

- [ ] **Step 4: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: builds.

The JSON serializer already has `JsonStringEnumConverter` with camelCase policy registered in `Program.cs` (lines 40–43), so these enums serialize to `"novice"`, `"activeMember"`, etc.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Storage/Entities/AppConfigEntity.cs Lovecraft/Lovecraft.Common/Enums/UserRank.cs Lovecraft/Lovecraft.Common/Enums/StaffRole.cs
git -C D:/src/lovecraft commit -m "feat(acl): add AppConfigEntity and UserRank/StaffRole enums"
```

---

# Phase 2 — `IAppConfigService`

## P2-T1: Define `AppConfig`, `RankThresholds`, `PermissionConfig` records + `IAppConfigService`

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/AppConfig.cs`
- Create: `Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs`

- [ ] **Step 1: Write `AppConfig.cs`**

```csharp
namespace Lovecraft.Backend.Services;

public record AppConfig(RankThresholds Ranks, PermissionConfig Permissions);

public record RankThresholds(
    int ActiveReplies,
    int ActiveLikes,
    int ActiveEvents,
    int FriendReplies,
    int FriendLikes,
    int FriendEvents,
    int CrewReplies,
    int CrewLikes,
    int CrewEvents,
    int CrewMatches)
{
    public static RankThresholds Defaults => new(
        ActiveReplies: 5,
        ActiveLikes: 3,
        ActiveEvents: 1,
        FriendReplies: 25,
        FriendLikes: 15,
        FriendEvents: 3,
        CrewReplies: 100,
        CrewLikes: 50,
        CrewEvents: 10,
        CrewMatches: 10);
}

public record PermissionConfig(
    string CreateTopic,
    string DeleteOwnReply,
    string DeleteAnyReply,
    string DeleteAnyTopic,
    string PinTopic,
    string BanUser,
    string AssignRole,
    string OverrideRank,
    string ManageEvents,
    string ManageBlog,
    string ManageStore)
{
    public static PermissionConfig Defaults => new(
        CreateTopic: "activeMember",
        DeleteOwnReply: "novice",
        DeleteAnyReply: "moderator",
        DeleteAnyTopic: "moderator",
        PinTopic: "moderator",
        BanUser: "moderator",
        AssignRole: "admin",
        OverrideRank: "admin",
        ManageEvents: "admin",
        ManageBlog: "admin",
        ManageStore: "admin");
}

public static class AppConfigKeys
{
    public static class RankThresholdsKeys
    {
        public const string ActiveReplies = "active_replies";
        public const string ActiveLikes = "active_likes";
        public const string ActiveEvents = "active_events";
        public const string FriendReplies = "friend_replies";
        public const string FriendLikes = "friend_likes";
        public const string FriendEvents = "friend_events";
        public const string CrewReplies = "crew_replies";
        public const string CrewLikes = "crew_likes";
        public const string CrewEvents = "crew_events";
        public const string CrewMatches = "crew_matches";
    }

    public static class PermissionKeys
    {
        public const string CreateTopic = "create_topic";
        public const string DeleteOwnReply = "delete_own_reply";
        public const string DeleteAnyReply = "delete_any_reply";
        public const string DeleteAnyTopic = "delete_any_topic";
        public const string PinTopic = "pin_topic";
        public const string BanUser = "ban_user";
        public const string AssignRole = "assign_role";
        public const string OverrideRank = "override_rank";
        public const string ManageEvents = "manage_events";
        public const string ManageBlog = "manage_blog";
        public const string ManageStore = "manage_store";
    }
}
```

- [ ] **Step 2: Write `IAppConfigService.cs`**

```csharp
namespace Lovecraft.Backend.Services;

public interface IAppConfigService
{
    Task<AppConfig> GetConfigAsync();
}
```

- [ ] **Step 3: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/AppConfig.cs Lovecraft/Lovecraft.Backend/Services/IAppConfigService.cs
git -C D:/src/lovecraft commit -m "feat(acl): define AppConfig records and IAppConfigService"
```

---

## P2-T2: `MockAppConfigService` + tests

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs`
- Create: `Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs`:

```csharp
using Lovecraft.Backend.Services;
using Xunit;

namespace Lovecraft.UnitTests;

public class MockAppConfigServiceTests
{
    [Fact]
    public async Task GetConfigAsync_ReturnsDefaultRankThresholds()
    {
        var service = new MockAppConfigService();
        var config = await service.GetConfigAsync();

        Assert.Equal(5, config.Ranks.ActiveReplies);
        Assert.Equal(15, config.Ranks.FriendLikes);
        Assert.Equal(100, config.Ranks.CrewReplies);
        Assert.Equal(10, config.Ranks.CrewMatches);
    }

    [Fact]
    public async Task GetConfigAsync_ReturnsDefaultPermissions()
    {
        var service = new MockAppConfigService();
        var config = await service.GetConfigAsync();

        Assert.Equal("activeMember", config.Permissions.CreateTopic);
        Assert.Equal("moderator", config.Permissions.DeleteAnyReply);
        Assert.Equal("admin", config.Permissions.AssignRole);
    }
}
```

- [ ] **Step 2: Run — see failure**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter MockAppConfigServiceTests`
Expected: FAIL with `CS0246: MockAppConfigService could not be found` (or similar).

- [ ] **Step 3: Write `MockAppConfigService.cs`**

```csharp
namespace Lovecraft.Backend.Services;

public class MockAppConfigService : IAppConfigService
{
    private static readonly AppConfig _config = new(
        RankThresholds.Defaults,
        PermissionConfig.Defaults);

    public Task<AppConfig> GetConfigAsync() => Task.FromResult(_config);
}
```

- [ ] **Step 4: Run — see pass**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter MockAppConfigServiceTests`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs
git -C D:/src/lovecraft commit -m "feat(acl): MockAppConfigService returns hardcoded defaults"
```

---

## P2-T3: `AzureAppConfigService` with `IMemoryCache`

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs`

Mirrors `CachingForumService` pattern (one stable cache key, `IMemoryCache.TryGetValue` → else fetch → `Set` with 1 hour TTL).

- [ ] **Step 1: Add failing tests (append to existing file)**

Append to `AppConfigServiceTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

public class AzureAppConfigServiceTests
{
    private static (Mock<TableServiceClient> tsc, Mock<TableClient> tc) BuildClientMocks(
        IEnumerable<AppConfigEntity> entities)
    {
        var tc = new Mock<TableClient>();
        var page = Azure.Page<AppConfigEntity>.FromValues(entities.ToList(), null, Mock.Of<Response>());
        tc.Setup(t => t.QueryAsync<AppConfigEntity>(
                It.IsAny<string>(), null, null, It.IsAny<CancellationToken>()))
            .Returns(Azure.AsyncPageable<AppConfigEntity>.FromPages(new[] { page }));
        tc.Setup(t => t.CreateIfNotExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Response.FromValue<TableItem>(null!, Mock.Of<Response>()));

        var tsc = new Mock<TableServiceClient>();
        tsc.Setup(x => x.GetTableClient(TableNames.AppConfig)).Returns(tc.Object);
        return (tsc, tc);
    }

    private static AppConfigEntity Row(string pk, string rk, string val) =>
        new() { PartitionKey = pk, RowKey = rk, Value = val };

    [Fact]
    public async Task GetConfigAsync_OverridesDefaultFromTable()
    {
        var entities = new[]
        {
            Row(AppConfigEntity.PartitionRankThresholds, AppConfigKeys.RankThresholdsKeys.ActiveReplies, "10"),
            Row(AppConfigEntity.PartitionPermissions, AppConfigKeys.PermissionKeys.CreateTopic, "novice"),
        };
        var (tsc, _) = BuildClientMocks(entities);
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = new AzureAppConfigService(tsc.Object, cache, NullLogger<AzureAppConfigService>.Instance);

        var config = await svc.GetConfigAsync();

        Assert.Equal(10, config.Ranks.ActiveReplies);
        Assert.Equal("novice", config.Permissions.CreateTopic);
        Assert.Equal(3, config.Ranks.ActiveLikes); // not overridden → default
    }

    [Fact]
    public async Task GetConfigAsync_SecondCallUsesCache()
    {
        var (tsc, tc) = BuildClientMocks(Array.Empty<AppConfigEntity>());
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = new AzureAppConfigService(tsc.Object, cache, NullLogger<AzureAppConfigService>.Instance);

        await svc.GetConfigAsync();
        await svc.GetConfigAsync();

        tc.Verify(t => t.QueryAsync<AppConfigEntity>(
            It.IsAny<string>(), null, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetConfigAsync_InvalidIntValueFallsBackToDefault()
    {
        var entities = new[]
        {
            Row(AppConfigEntity.PartitionRankThresholds, AppConfigKeys.RankThresholdsKeys.ActiveReplies, "not-a-number"),
        };
        var (tsc, _) = BuildClientMocks(entities);
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = new AzureAppConfigService(tsc.Object, cache, NullLogger<AzureAppConfigService>.Instance);

        var config = await svc.GetConfigAsync();

        Assert.Equal(5, config.Ranks.ActiveReplies); // default
    }
}
```

- [ ] **Step 2: Run — see failure**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter AzureAppConfigServiceTests`
Expected: FAIL — class not found.

- [ ] **Step 3: Implement**

Create `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs`:

```csharp
using Azure.Data.Tables;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace Lovecraft.Backend.Services.Azure;

public class AzureAppConfigService : IAppConfigService
{
    private const string CacheKey = "appconfig:all";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(1);

    private readonly TableClient _table;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AzureAppConfigService> _logger;

    public AzureAppConfigService(
        TableServiceClient tableServiceClient,
        IMemoryCache cache,
        ILogger<AzureAppConfigService> logger)
    {
        _cache = cache;
        _logger = logger;
        _table = tableServiceClient.GetTableClient(TableNames.AppConfig);
        _table.CreateIfNotExistsAsync().GetAwaiter().GetResult();
    }

    public async Task<AppConfig> GetConfigAsync()
    {
        if (_cache.TryGetValue(CacheKey, out AppConfig? cached) && cached is not null)
            return cached;

        var rows = new List<AppConfigEntity>();
        await foreach (var row in _table.QueryAsync<AppConfigEntity>())
            rows.Add(row);

        var config = BuildConfig(rows);
        _cache.Set(CacheKey, config, CacheTtl);
        return config;
    }

    private AppConfig BuildConfig(IReadOnlyList<AppConfigEntity> rows)
    {
        var thresholds = rows
            .Where(r => r.PartitionKey == AppConfigEntity.PartitionRankThresholds)
            .ToDictionary(r => r.RowKey, r => r.Value, StringComparer.OrdinalIgnoreCase);
        var perms = rows
            .Where(r => r.PartitionKey == AppConfigEntity.PartitionPermissions)
            .ToDictionary(r => r.RowKey, r => r.Value, StringComparer.OrdinalIgnoreCase);

        int I(string key, int fallback) =>
            thresholds.TryGetValue(key, out var v) && int.TryParse(v, out var n) ? n : fallback;
        string S(string key, string fallback) =>
            perms.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;

        var d = RankThresholds.Defaults;
        var p = PermissionConfig.Defaults;
        return new AppConfig(
            new RankThresholds(
                ActiveReplies: I(AppConfigKeys.RankThresholdsKeys.ActiveReplies, d.ActiveReplies),
                ActiveLikes: I(AppConfigKeys.RankThresholdsKeys.ActiveLikes, d.ActiveLikes),
                ActiveEvents: I(AppConfigKeys.RankThresholdsKeys.ActiveEvents, d.ActiveEvents),
                FriendReplies: I(AppConfigKeys.RankThresholdsKeys.FriendReplies, d.FriendReplies),
                FriendLikes: I(AppConfigKeys.RankThresholdsKeys.FriendLikes, d.FriendLikes),
                FriendEvents: I(AppConfigKeys.RankThresholdsKeys.FriendEvents, d.FriendEvents),
                CrewReplies: I(AppConfigKeys.RankThresholdsKeys.CrewReplies, d.CrewReplies),
                CrewLikes: I(AppConfigKeys.RankThresholdsKeys.CrewLikes, d.CrewLikes),
                CrewEvents: I(AppConfigKeys.RankThresholdsKeys.CrewEvents, d.CrewEvents),
                CrewMatches: I(AppConfigKeys.RankThresholdsKeys.CrewMatches, d.CrewMatches)),
            new PermissionConfig(
                CreateTopic: S(AppConfigKeys.PermissionKeys.CreateTopic, p.CreateTopic),
                DeleteOwnReply: S(AppConfigKeys.PermissionKeys.DeleteOwnReply, p.DeleteOwnReply),
                DeleteAnyReply: S(AppConfigKeys.PermissionKeys.DeleteAnyReply, p.DeleteAnyReply),
                DeleteAnyTopic: S(AppConfigKeys.PermissionKeys.DeleteAnyTopic, p.DeleteAnyTopic),
                PinTopic: S(AppConfigKeys.PermissionKeys.PinTopic, p.PinTopic),
                BanUser: S(AppConfigKeys.PermissionKeys.BanUser, p.BanUser),
                AssignRole: S(AppConfigKeys.PermissionKeys.AssignRole, p.AssignRole),
                OverrideRank: S(AppConfigKeys.PermissionKeys.OverrideRank, p.OverrideRank),
                ManageEvents: S(AppConfigKeys.PermissionKeys.ManageEvents, p.ManageEvents),
                ManageBlog: S(AppConfigKeys.PermissionKeys.ManageBlog, p.ManageBlog),
                ManageStore: S(AppConfigKeys.PermissionKeys.ManageStore, p.ManageStore)));
    }
}
```

- [ ] **Step 4: Run — see pass**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter AzureAppConfigServiceTests`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs Lovecraft/Lovecraft.UnitTests/AppConfigServiceTests.cs
git -C D:/src/lovecraft commit -m "feat(acl): AzureAppConfigService with 1h memory cache and defaults fallback"
```

---

## P2-T4: DI registration for `IAppConfigService`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Program.cs`

- [ ] **Step 1: Register in the Azure branch**

In `Program.cs` inside the `if (useAzure)` block, add (anywhere after `AddMemoryCache` is registered, immediately before `IAuthService`):

```csharp
builder.Services.AddSingleton<IAppConfigService, AzureAppConfigService>();
```

- [ ] **Step 2: Register in the mock branch**

In the `else` block:

```csharp
builder.Services.AddSingleton<IAppConfigService, MockAppConfigService>();
```

- [ ] **Step 3: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Program.cs
git -C D:/src/lovecraft commit -m "feat(acl): register IAppConfigService in DI (mock + Azure)"
```

---

# Phase 3 — `EffectiveLevel`, `RankCalculator`, `UserDto` rank exposure

## P3-T1: `EffectiveLevel` helper + tests

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Helpers/EffectiveLevel.cs`
- Create: `Lovecraft/Lovecraft.UnitTests/EffectiveLevelTests.cs`

- [ ] **Step 1: Write failing tests**

Create `Lovecraft/Lovecraft.UnitTests/EffectiveLevelTests.cs`:

```csharp
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class EffectiveLevelTests
{
    [Theory]
    [InlineData("novice", 0)]
    [InlineData("activeMember", 1)]
    [InlineData("friendOfAloe", 2)]
    [InlineData("aloeCrew", 3)]
    [InlineData("moderator", 4)]
    [InlineData("admin", 5)]
    [InlineData("none", 0)]
    [InlineData("NOVICE", 0)]
    public void Parse_ReturnsExpectedLevel(string input, int expected)
    {
        Assert.Equal(expected, EffectiveLevel.Parse(input));
    }

    [Fact]
    public void Parse_UnknownValue_ReturnsZero()
    {
        Assert.Equal(0, EffectiveLevel.Parse("potato"));
    }

    [Fact]
    public void For_NoviceWithNoStaffRole_ReturnsZero()
    {
        var user = new UserEntity { StaffRole = "none" };
        Assert.Equal(0, EffectiveLevel.For(user, UserRank.Novice));
    }

    [Fact]
    public void For_NoviceModerator_ReturnsModeratorLevel()
    {
        var user = new UserEntity { StaffRole = "moderator" };
        Assert.Equal(4, EffectiveLevel.For(user, UserRank.Novice));
    }

    [Fact]
    public void For_AloeCrewNoStaff_ReturnsThree()
    {
        var user = new UserEntity { StaffRole = "none" };
        Assert.Equal(3, EffectiveLevel.For(user, UserRank.AloeCrew));
    }

    [Fact]
    public void For_AloeCrewAdmin_ReturnsAdminLevel()
    {
        var user = new UserEntity { StaffRole = "admin" };
        Assert.Equal(5, EffectiveLevel.For(user, UserRank.AloeCrew));
    }
}
```

- [ ] **Step 2: Run — see failure**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter EffectiveLevelTests`
Expected: FAIL (class missing).

- [ ] **Step 3: Implement**

Create `Lovecraft/Lovecraft.Backend/Helpers/EffectiveLevel.cs`:

```csharp
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Helpers;

/// <summary>
/// Unified level map spanning user ranks (0–3) and staff roles (4–5).
/// A user's effective level = max(rank level, staff role level).
/// </summary>
public static class EffectiveLevel
{
    public const int Novice = 0;
    public const int ActiveMember = 1;
    public const int FriendOfAloe = 2;
    public const int AloeCrew = 3;
    public const int Moderator = 4;
    public const int Admin = 5;

    public static int Parse(string? value) =>
        value?.ToLowerInvariant() switch
        {
            "novice" or "none" or "" or null => Novice,
            "activemember" => ActiveMember,
            "friendofaloe" => FriendOfAloe,
            "aloecrew" => AloeCrew,
            "moderator" => Moderator,
            "admin" => Admin,
            _ => Novice,
        };

    public static int For(UserEntity user, UserRank computedRank)
    {
        var rankLevel = (int)computedRank;
        var staffLevel = Parse(user.StaffRole);
        return Math.Max(rankLevel, staffLevel);
    }
}
```

Note: `UserRank` enum values are `Novice=0, ActiveMember=1, FriendOfAloe=2, AloeCrew=3` by default; casting gives the level directly.

- [ ] **Step 4: Run — see pass**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter EffectiveLevelTests`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Helpers/EffectiveLevel.cs Lovecraft/Lovecraft.UnitTests/EffectiveLevelTests.cs
git -C D:/src/lovecraft commit -m "feat(acl): EffectiveLevel helper covering rank+staff levels 0-5"
```

---

## P3-T2: `RankCalculator` helper + tests

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Helpers/RankCalculator.cs`
- Create: `Lovecraft/Lovecraft.UnitTests/RankCalculatorTests.cs`

Implements the top-down OR logic from spec §Rank Computation.

- [ ] **Step 1: Write failing tests**

Create `Lovecraft/Lovecraft.UnitTests/RankCalculatorTests.cs`:

```csharp
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.Enums;
using Xunit;

namespace Lovecraft.UnitTests;

public class RankCalculatorTests
{
    private static readonly RankThresholds T = RankThresholds.Defaults;

    private static UserEntity U(int replies = 0, int likes = 0, int events = 0, int matches = 0,
                                string? rankOverride = null) =>
        new()
        {
            ReplyCount = replies,
            LikesReceived = likes,
            EventsAttended = events,
            MatchCount = matches,
            RankOverride = rankOverride,
        };

    [Fact]
    public void Fresh_User_IsNovice() =>
        Assert.Equal(UserRank.Novice, RankCalculator.Compute(U(), T));

    [Fact]
    public void ActiveReplies_Threshold_PromotesToActive() =>
        Assert.Equal(UserRank.ActiveMember, RankCalculator.Compute(U(replies: T.ActiveReplies), T));

    [Fact]
    public void ActiveLikes_Threshold_PromotesToActive() =>
        Assert.Equal(UserRank.ActiveMember, RankCalculator.Compute(U(likes: T.ActiveLikes), T));

    [Fact]
    public void ActiveEvents_Threshold_PromotesToActive() =>
        Assert.Equal(UserRank.ActiveMember, RankCalculator.Compute(U(events: T.ActiveEvents), T));

    [Fact]
    public void FriendReplies_Threshold_PromotesToFriend() =>
        Assert.Equal(UserRank.FriendOfAloe, RankCalculator.Compute(U(replies: T.FriendReplies), T));

    [Fact]
    public void FriendLikes_Threshold_PromotesToFriend() =>
        Assert.Equal(UserRank.FriendOfAloe, RankCalculator.Compute(U(likes: T.FriendLikes), T));

    [Fact]
    public void CrewReplies_Threshold_PromotesToCrew() =>
        Assert.Equal(UserRank.AloeCrew, RankCalculator.Compute(U(replies: T.CrewReplies), T));

    [Fact]
    public void CrewMatches_Only_PromotesToCrew()
    {
        // matches only matters at crew tier
        Assert.Equal(UserRank.AloeCrew, RankCalculator.Compute(U(matches: T.CrewMatches), T));
    }

    [Fact]
    public void FriendTierCriteria_WithoutCrewCriteria_StaysAtFriend() =>
        Assert.Equal(UserRank.FriendOfAloe,
            RankCalculator.Compute(U(replies: T.FriendReplies, matches: T.CrewMatches - 1), T));

    [Fact]
    public void OR_Logic_AnySingleCriterionSuffices()
    {
        // zero replies but enough events → promotion
        Assert.Equal(UserRank.FriendOfAloe, RankCalculator.Compute(U(events: T.FriendEvents), T));
    }

    [Fact]
    public void TopDown_CrewCheckedBeforeFriend()
    {
        // meets both crew and friend → crew
        Assert.Equal(UserRank.AloeCrew,
            RankCalculator.Compute(U(replies: T.CrewReplies, events: T.FriendEvents), T));
    }

    [Fact]
    public void RankOverride_TakesPrecedence()
    {
        Assert.Equal(UserRank.AloeCrew,
            RankCalculator.Compute(U(rankOverride: "aloeCrew"), T));
    }

    [Fact]
    public void NullOverride_FallsBackToComputed()
    {
        Assert.Equal(UserRank.Novice,
            RankCalculator.Compute(U(rankOverride: null), T));
    }

    [Fact]
    public void JustBelowActiveThreshold_StaysNovice() =>
        Assert.Equal(UserRank.Novice,
            RankCalculator.Compute(U(replies: T.ActiveReplies - 1, likes: T.ActiveLikes - 1), T));
}
```

- [ ] **Step 2: Run — see failure**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter RankCalculatorTests`
Expected: FAIL — class missing.

- [ ] **Step 3: Implement**

Create `Lovecraft/Lovecraft.Backend/Helpers/RankCalculator.cs`:

```csharp
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Helpers;

/// <summary>
/// Computes a user's current rank from activity counters and configurable thresholds.
/// Top-down OR logic — returns the highest tier for which any single criterion is met.
/// RankOverride (if set) takes precedence over the computed value.
/// </summary>
public static class RankCalculator
{
    public static UserRank Compute(UserEntity user, RankThresholds t)
    {
        if (!string.IsNullOrWhiteSpace(user.RankOverride) &&
            TryParseRank(user.RankOverride, out var overridden))
            return overridden;

        if (user.ReplyCount >= t.CrewReplies ||
            user.LikesReceived >= t.CrewLikes ||
            user.EventsAttended >= t.CrewEvents ||
            user.MatchCount >= t.CrewMatches)
            return UserRank.AloeCrew;

        if (user.ReplyCount >= t.FriendReplies ||
            user.LikesReceived >= t.FriendLikes ||
            user.EventsAttended >= t.FriendEvents)
            return UserRank.FriendOfAloe;

        if (user.ReplyCount >= t.ActiveReplies ||
            user.LikesReceived >= t.ActiveLikes ||
            user.EventsAttended >= t.ActiveEvents)
            return UserRank.ActiveMember;

        return UserRank.Novice;
    }

    private static bool TryParseRank(string value, out UserRank rank)
    {
        switch (value.ToLowerInvariant())
        {
            case "novice": rank = UserRank.Novice; return true;
            case "activemember": rank = UserRank.ActiveMember; return true;
            case "friendofaloe": rank = UserRank.FriendOfAloe; return true;
            case "aloecrew": rank = UserRank.AloeCrew; return true;
            default: rank = UserRank.Novice; return false;
        }
    }
}
```

- [ ] **Step 4: Run — see pass**

Run: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter RankCalculatorTests`
Expected: 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Helpers/RankCalculator.cs Lovecraft/Lovecraft.UnitTests/RankCalculatorTests.cs
git -C D:/src/lovecraft commit -m "feat(acl): RankCalculator with top-down OR logic and rank override"
```

---

## P3-T3: Extend `UserDto` with `Rank` + `StaffRole`

**Files:**
- Modify: `Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs`

- [ ] **Step 1: Add two properties**

At the top of `UserDto.cs` add `using Lovecraft.Common.Enums;` (already present). Inside `class UserDto`, append after `Settings`:

```csharp
public UserRank Rank { get; set; } = UserRank.Novice;
public StaffRole StaffRole { get; set; } = StaffRole.None;
```

- [ ] **Step 2: Build**

Run: `dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx`
Expected: builds.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs
git -C D:/src/lovecraft commit -m "feat(acl): expose Rank and StaffRole on UserDto"
```

---

## P3-T4: Compute rank in `IUserService` implementations + update `/users/me` tests

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockUserService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs` (add counter/role fields to existing mock users with value 0/"none")

Constructor DI changes: both mock and azure user services must now take `IAppConfigService` so they can pass `RankThresholds` to `RankCalculator`.

- [ ] **Step 1: Update `MockUserService` to accept `IAppConfigService` and compute rank**

Replace existing `MockUserService.cs` content with:

```csharp
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Users;
using Lovecraft.Common.Enums;

namespace Lovecraft.Backend.Services;

public class MockUserService : IUserService
{
    private readonly IAppConfigService _appConfig;

    public MockUserService(IAppConfigService appConfig)
    {
        _appConfig = appConfig;
    }

    public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10)
    {
        var config = await _appConfig.GetConfigAsync();
        return MockDataStore.Users
            .Skip(skip)
            .Take(take)
            .Select(dto => AugmentWithRank(dto, config.Ranks))
            .ToList();
    }

    public async Task<UserDto?> GetUserByIdAsync(string userId)
    {
        var config = await _appConfig.GetConfigAsync();
        var dto = MockDataStore.Users.FirstOrDefault(u => u.Id == userId);
        return dto is null ? null : AugmentWithRank(dto, config.Ranks);
    }

    public Task<UserDto> UpdateUserAsync(string userId, UserDto user)
    {
        var existing = MockDataStore.Users.FirstOrDefault(u => u.Id == userId);
        if (existing is null)
            return Task.FromResult(user);

        existing.Name = user.Name;
        existing.Age = user.Age;
        existing.Bio = user.Bio;
        existing.Location = user.Location;
        existing.Gender = user.Gender;
        existing.ProfileImage = user.ProfileImage;
        existing.Images = user.Images;
        existing.FavoriteSong = user.FavoriteSong;
        existing.Preferences = user.Preferences;
        existing.Settings = user.Settings;
        return Task.FromResult(existing);
    }

    public Task IncrementCounterAsync(string userId, UserCounter counter, int delta = 1)
    {
        if (!MockDataStore.UserActivity.TryGetValue(userId, out var activity))
        {
            activity = new MockUserActivity();
            MockDataStore.UserActivity[userId] = activity;
        }
        switch (counter)
        {
            case UserCounter.ReplyCount:     activity.ReplyCount     += delta; break;
            case UserCounter.LikesReceived:  activity.LikesReceived  += delta; break;
            case UserCounter.EventsAttended: activity.EventsAttended += delta; break;
            case UserCounter.MatchCount:     activity.MatchCount     += delta; break;
        }
        return Task.CompletedTask;
    }

    public Task SetStaffRoleAsync(string userId, StaffRole role)
    {
        MockDataStore.UserStaffRoles[userId] = role;
        return Task.CompletedTask;
    }

    public Task SetRankOverrideAsync(string userId, UserRank? rank)
    {
        if (rank is null)
            MockDataStore.UserRankOverrides.Remove(userId);
        else
            MockDataStore.UserRankOverrides[userId] = rank.Value;
        return Task.CompletedTask;
    }

    private UserDto AugmentWithRank(UserDto dto, RankThresholds t)
    {
        var activity = MockDataStore.UserActivity.TryGetValue(dto.Id, out var a)
            ? a : new MockUserActivity();
        var staffRole = MockDataStore.UserStaffRoles.TryGetValue(dto.Id, out var sr)
            ? sr : StaffRole.None;
        MockDataStore.UserRankOverrides.TryGetValue(dto.Id, out var overridden);

        var fakeEntity = new UserEntity
        {
            ReplyCount = activity.ReplyCount,
            LikesReceived = activity.LikesReceived,
            EventsAttended = activity.EventsAttended,
            MatchCount = activity.MatchCount,
            RankOverride = MockDataStore.UserRankOverrides.ContainsKey(dto.Id)
                ? overridden.ToString().ToCamelCase() : null,
        };
        dto.Rank = RankCalculator.Compute(fakeEntity, t);
        dto.StaffRole = staffRole;
        return dto;
    }
}

internal static class StringCasing
{
    public static string ToCamelCase(this string value) =>
        string.IsNullOrEmpty(value) ? value : char.ToLowerInvariant(value[0]) + value[1..];
}
```

- [ ] **Step 2: Update `IServices.cs` — `IUserService`**

Replace `IUserService` interface with:

```csharp
public enum UserCounter
{
    ReplyCount,
    LikesReceived,
    EventsAttended,
    MatchCount,
}

public interface IUserService
{
    Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10);
    Task<UserDto?> GetUserByIdAsync(string userId);
    Task<UserDto> UpdateUserAsync(string userId, UserDto user);
    Task IncrementCounterAsync(string userId, UserCounter counter, int delta = 1);
    Task SetStaffRoleAsync(string userId, StaffRole role);
    Task SetRankOverrideAsync(string userId, UserRank? rank);
}
```

Add `using Lovecraft.Common.Enums;` at top if not already.

- [ ] **Step 3: Add mock-state dictionaries to `MockDataStore.cs`**

At the top of `MockDataStore.cs` (just after the `Songs` field) add:

```csharp
public class MockUserActivity
{
    public int ReplyCount { get; set; }
    public int LikesReceived { get; set; }
    public int EventsAttended { get; set; }
    public int MatchCount { get; set; }
}

public static Dictionary<string, MockUserActivity> UserActivity { get; set; } = new();
public static Dictionary<string, Lovecraft.Common.Enums.StaffRole> UserStaffRoles { get; set; } = new();
public static Dictionary<string, Lovecraft.Common.Enums.UserRank> UserRankOverrides { get; set; } = new();
```

- [ ] **Step 4: Update `AzureUserService`**

In `AzureUserService.cs`:

- Add `private readonly IAppConfigService _appConfig;` and inject in ctor.
- In `ToDto` (or equivalent mapping), change signature to accept `RankThresholds` and compute rank there.
- Parse `StaffRole` string into enum with `Enum.TryParse<StaffRole>(entity.StaffRole, ignoreCase: true, out var sr)`; default `StaffRole.None`.
- Wire each `GetUsersAsync` / `GetUserByIdAsync` to load config first and pass to mapper.
- Implement `IncrementCounterAsync(userId, counter, delta)` as read-modify-write on `UserEntity`, using existing ETag pattern (see `AzureForumService.cs` reply count increment for reference).
- Implement `SetStaffRoleAsync(userId, role)` — read entity, set `StaffRole = role.ToString().ToLowerInvariant()` (note the enum prints PascalCase; lowercase for storage to match ACL spec strings), save.
- Implement `SetRankOverrideAsync(userId, rank)` — set/clear `RankOverride` string (`rank == null → null`, else `rank.Value.ToString()` with first char lowered).

- [ ] **Step 5: Update `UsersController.UploadProfileImage` DI / dependents**

If any downstream code constructs `MockUserService` directly (not via DI), add the `IAppConfigService` parameter. Search: `new MockUserService(` across solution. None expected in production code; if a test constructs one, pass `new MockAppConfigService()`.

- [ ] **Step 6: Write integration-style test asserting rank is populated**

Append to `Lovecraft/Lovecraft.UnitTests/ServiceTests.cs`:

```csharp
[Fact]
public async Task MockUserService_NoActivity_ReturnsNovice()
{
    var svc = new MockUserService(new MockAppConfigService());
    var user = await svc.GetUserByIdAsync("1");
    Assert.NotNull(user);
    Assert.Equal(UserRank.Novice, user!.Rank);
    Assert.Equal(StaffRole.None, user.StaffRole);
}

[Fact]
public async Task MockUserService_CrewReplyCount_ReturnsAloeCrew()
{
    MockDataStore.UserActivity["1"] = new MockUserActivity { ReplyCount = 100 };
    try
    {
        var svc = new MockUserService(new MockAppConfigService());
        var user = await svc.GetUserByIdAsync("1");
        Assert.Equal(UserRank.AloeCrew, user!.Rank);
    }
    finally
    {
        MockDataStore.UserActivity.Clear();
    }
}

[Fact]
public async Task MockUserService_IncrementCounter_PromotesTier()
{
    MockDataStore.UserActivity.Clear();
    var svc = new MockUserService(new MockAppConfigService());
    for (int i = 0; i < 5; i++)
        await svc.IncrementCounterAsync("1", UserCounter.ReplyCount);
    var user = await svc.GetUserByIdAsync("1");
    Assert.Equal(UserRank.ActiveMember, user!.Rank);
    MockDataStore.UserActivity.Clear();
}
```

- [ ] **Step 7: Run**

```
dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests
```
Expected: all pass (including pre-existing `ServiceTests`).

- [ ] **Step 8: Commit**

```bash
git -C D:/src/lovecraft add -A Lovecraft/Lovecraft.Backend Lovecraft/Lovecraft.UnitTests
git -C D:/src/lovecraft commit -m "feat(acl): compute rank in user service, add counter/role mutation methods"
```

---

# Phase 4 — Counter Hooks

All hooks call `IUserService.IncrementCounterAsync`. Inject `IUserService` into the forum/matching/event service classes where not already present.

## P4-T1: Reply counter hook in `IForumService`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Caching/CachingForumService.cs` (pass-through ctor change only)
- Modify: `Lovecraft/Lovecraft.UnitTests/ForumTests.cs`

- [ ] **Step 1: Write failing test**

In `ForumTests.cs`, add a new test inside the existing test class:

```csharp
[Fact]
public async Task CreateReply_IncrementsAuthorReplyCount()
{
    MockDataStore.UserActivity.Clear();
    var userSvc = new MockUserService(new MockAppConfigService());
    var service = new MockForumService(userSvc);

    await service.CreateReplyAsync(TopicId, "1", "Тест", "Some reply content that's fine.", null);

    var user = await userSvc.GetUserByIdAsync("1");
    Assert.Equal(1, MockDataStore.UserActivity.TryGetValue("1", out var a) ? a.ReplyCount : 0);
    // With only 1 reply and no other activity, user is still novice (threshold 5)
    Assert.Equal(UserRank.Novice, user!.Rank);
    MockDataStore.UserActivity.Clear();
}
```

You'll need `using Lovecraft.Common.Enums;` if not already present, and add `using Lovecraft.Backend.Services;` for `MockUserService`.

- [ ] **Step 2: Run — see failure**

`MockForumService` constructor doesn't accept `IUserService` yet. Expected: compile error.

- [ ] **Step 3: Update `MockForumService`**

Add ctor:

```csharp
private readonly IUserService _userService;

public MockForumService(IUserService userService)
{
    _userService = userService;
}
```

Extend `CreateReplyAsync` — just before `return Task.FromResult(reply);`, insert:

```csharp
_userService.IncrementCounterAsync(authorId, UserCounter.ReplyCount).GetAwaiter().GetResult();
```

(The method signature is `Task`-returning but the existing method is synchronous; we preserve that.)

Add `using Lovecraft.Common.Enums;` if missing.

- [ ] **Step 4: Update `AzureForumService`**

Inject `IUserService`, and after the existing topic reply-count update in `CreateReplyAsync`, call:

```csharp
await _userService.IncrementCounterAsync(authorId, UserCounter.ReplyCount);
```

- [ ] **Step 5: Update `CachingForumService` ctor**

Just adjust to inject inner `IForumService` (already does) — no change needed unless DI registration breaks. Confirm `Program.cs` still compiles after `AzureForumService` ctor signature changed.

- [ ] **Step 6: Fix Program.cs DI**

In the Azure branch, adjust `AzureForumService` construction to receive `IUserService`:

```csharp
builder.Services.AddSingleton<IForumService>(sp => new CachingForumService(
    new AzureForumService(
        sp.GetRequiredService<TableServiceClient>(),
        sp.GetRequiredService<IUserService>(),
        sp.GetRequiredService<ILogger<AzureForumService>>()),
    sp.GetRequiredService<IMemoryCache>()));
```

In the mock branch:

```csharp
builder.Services.AddSingleton<IForumService>(sp =>
    new MockForumService(sp.GetRequiredService<IUserService>()));
```

- [ ] **Step 7: Run**

`dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter ForumTests`
Expected: pass.

Full suite: `dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git -C D:/src/lovecraft add -A
git -C D:/src/lovecraft commit -m "feat(acl): ForumService increments author ReplyCount on reply"
```

---

## P4-T2: Likes + matches counter hooks

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockMatchingService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureMatchingService.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/MatchingTests.cs`

Mirrors P4-T1 pattern. When a like is sent: increment target's `LikesReceived`. When the reverse like exists (match created): increment both `MatchCount`.

- [ ] **Step 1: Write failing test**

In `MatchingTests.cs`, add inside the test class:

```csharp
[Fact]
public async Task CreateLike_IncrementsTargetLikesReceived()
{
    MockDataStore.UserActivity.Clear();
    var userSvc = new MockUserService(new MockAppConfigService());
    var service = new MockMatchingService(userSvc);

    await service.CreateLikeAsync("1", "2");

    Assert.Equal(1, MockDataStore.UserActivity.TryGetValue("2", out var a) ? a.LikesReceived : 0);
    MockDataStore.UserActivity.Clear();
}

[Fact]
public async Task MutualLike_IncrementsMatchCount_OnBoth()
{
    MockDataStore.UserActivity.Clear();
    MockDataStore.Matches = new List<MatchDto>();
    var userSvc = new MockUserService(new MockAppConfigService());
    var service = new MockMatchingService(userSvc);

    await service.CreateLikeAsync("1", "2"); // like 1→2
    await service.CreateLikeAsync("2", "1"); // reverse → match

    Assert.Equal(1, MockDataStore.UserActivity["1"].MatchCount);
    Assert.Equal(1, MockDataStore.UserActivity["2"].MatchCount);
    MockDataStore.UserActivity.Clear();
}
```

- [ ] **Step 2: Update `MockMatchingService`**

Add ctor `public MockMatchingService(IUserService userService)`. After existing `Likes.Add(...)` call:

```csharp
_userService.IncrementCounterAsync(toUserId, UserCounter.LikesReceived).GetAwaiter().GetResult();
```

Inside the mutual-match branch (where `Matches.Add(...)` runs), also:

```csharp
_userService.IncrementCounterAsync(fromUserId, UserCounter.MatchCount).GetAwaiter().GetResult();
_userService.IncrementCounterAsync(toUserId, UserCounter.MatchCount).GetAwaiter().GetResult();
```

- [ ] **Step 3: Update `AzureMatchingService`**

Inject `IUserService _userService` via ctor. Inside `CreateLikeAsync(fromUserId, toUserId)`:

- After the `_likesTable.AddEntityAsync(...)` (outgoing like) and `_likesReceivedTable.AddEntityAsync(...)` calls, add:

```csharp
await _userService.IncrementCounterAsync(toUserId, UserCounter.LikesReceived);
```

- In the mutual-match branch (where the `MatchEntity` is created and upserted), add after the match insert:

```csharp
await _userService.IncrementCounterAsync(fromUserId, UserCounter.MatchCount);
await _userService.IncrementCounterAsync(toUserId, UserCounter.MatchCount);
```

- [ ] **Step 4: Update `Program.cs` DI**

Azure branch:

```csharp
builder.Services.AddSingleton<IMatchingService>(sp => new AzureMatchingService(
    sp.GetRequiredService<TableServiceClient>(),
    sp.GetRequiredService<IUserService>(),
    sp.GetRequiredService<ILogger<AzureMatchingService>>()));
```

Mock branch:

```csharp
builder.Services.AddSingleton<IMatchingService>(sp =>
    new MockMatchingService(sp.GetRequiredService<IUserService>()));
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests
git -C D:/src/lovecraft add -A
git -C D:/src/lovecraft commit -m "feat(acl): MatchingService increments LikesReceived and MatchCount"
```

---

## P4-T3: Event registration counter hook

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockEventService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureEventService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Caching/CachingEventService.cs` (pass-through only)
- Modify: `Lovecraft/Lovecraft.UnitTests/ServiceTests.cs`

- [ ] **Step 1: Write failing test**

Append to `ServiceTests.cs`:

```csharp
[Fact]
public async Task RegisterForEvent_IncrementsEventsAttended()
{
    MockDataStore.UserActivity.Clear();
    var userSvc = new MockUserService(new MockAppConfigService());
    var svc = new MockEventService(userSvc);

    // Assume first mock event id exists
    var eventId = MockDataStore.Events.First().Id;
    var result = await svc.RegisterForEventAsync("1", eventId);

    Assert.True(result);
    Assert.Equal(1, MockDataStore.UserActivity["1"].EventsAttended);
    MockDataStore.UserActivity.Clear();
}
```

- [ ] **Step 2: Update `MockEventService`**

Add ctor `public MockEventService(IUserService userService)` and store the dependency. Inside `RegisterForEventAsync(userId, eventId)`, after the existing "add to attendees" logic succeeds but before the final `return Task.FromResult(true)`:

```csharp
_userService.IncrementCounterAsync(userId, UserCounter.EventsAttended).GetAwaiter().GetResult();
```

- [ ] **Step 3: Update `AzureEventService`**

Inject `IUserService _userService`. Inside `RegisterForEventAsync`, after the attendee entity upsert succeeds:

```csharp
await _userService.IncrementCounterAsync(userId, UserCounter.EventsAttended);
```

- [ ] **Step 4: Update `CachingEventService` ctor signature if needed**

`CachingEventService` wraps `IEventService`; if its ctor signature changed, update DI. Usually not required — it receives the inner `IEventService` and does not need `IUserService`.

- [ ] **Step 5: Update `Program.cs` DI**

Azure branch:

```csharp
builder.Services.AddSingleton<IEventService>(sp => new CachingEventService(
    new AzureEventService(
        sp.GetRequiredService<TableServiceClient>(),
        sp.GetRequiredService<IUserService>(),
        sp.GetRequiredService<ILogger<AzureEventService>>()),
    sp.GetRequiredService<IMemoryCache>()));
```

Mock branch:

```csharp
builder.Services.AddSingleton<IEventService>(sp =>
    new MockEventService(sp.GetRequiredService<IUserService>()));
```

- [ ] **Step 6: Run + commit**

```bash
dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests
git -C D:/src/lovecraft add -A
git -C D:/src/lovecraft commit -m "feat(acl): EventService increments EventsAttended on register"
```

---

# Phase 5 — Forum ACL Enforcement

## P5-T1: Extend forum DTOs with rank fields

**Files:**
- Modify: `Lovecraft/Lovecraft.Common/DTOs/Forum/ForumDtos.cs`

- [ ] **Step 1: Add fields**

```csharp
using Lovecraft.Common.Enums;
```

`ForumSectionDto`: add `public string MinRank { get; set; } = "novice";`

`ForumTopicDto`: add

```csharp
public string MinRank { get; set; } = "novice";
public bool NoviceVisible { get; set; } = true;
public bool NoviceCanReply { get; set; } = true;
```

`ForumReplyDto`: add

```csharp
public UserRank AuthorRank { get; set; } = UserRank.Novice;
public StaffRole AuthorStaffRole { get; set; } = StaffRole.None;
```

`CreateTopicRequestDto`: add

```csharp
public bool? NoviceVisible { get; set; }
public bool? NoviceCanReply { get; set; }
```

Also add a new DTO to the same file:

```csharp
public class UpdateTopicRequestDto
{
    public bool? NoviceVisible { get; set; }
    public bool? NoviceCanReply { get; set; }
    public bool? IsPinned { get; set; }
    public bool? IsLocked { get; set; }
}
```

- [ ] **Step 2: Build + commit**

```bash
dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx
git -C D:/src/lovecraft add -A
git -C D:/src/lovecraft commit -m "feat(acl): extend forum DTOs with rank/gating fields"
```

---

## P5-T2: Entity ↔ DTO mapping for new forum fields

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs`

Mechanical — no new test; covered by later ACL tests.

- [ ] **Step 1: Azure — update `ToSectionDto`**

Map `entity.MinRank → dto.MinRank` (defaulting empty/null to `"novice"`).

- [ ] **Step 2: Azure — update `ToTopicDto`**

```csharp
MinRank = string.IsNullOrWhiteSpace(entity.MinRank) ? "novice" : entity.MinRank,
NoviceVisible = entity.NoviceVisible ?? true,
NoviceCanReply = entity.NoviceCanReply ?? true,
```

- [ ] **Step 3: Azure — update `ToReplyDto`** to populate `AuthorRank` + `AuthorStaffRole`

Requires fetching the author from users table. This is already done in `AzureForumService` for avatar refresh (recent commit). Extend: compute rank via `RankCalculator` (requires injecting `IAppConfigService`) and read `StaffRole` string → enum.

Approach — keep it simple: require `IAppConfigService` in `AzureForumService`, fetch config once per `GetRepliesAsync` call, reuse for each reply.

- [ ] **Step 4: Mock — same**

In `MockForumService.CreateReplyAsync` and the `GetRepliesAsync` branch, look up rank via the same augmentation path `MockUserService` uses. Simplest: inject `IUserService`, call `GetUserByIdAsync(authorId)` per reply, copy `Rank`/`StaffRole`.

- [ ] **Step 5: Build + commit**

```bash
git -C D:/src/lovecraft commit -m "feat(acl): map MinRank/noviceVisible/noviceCanReply and author rank in forum services"
```

---

## P5-T3: `INSUFFICIENT_RANK` / `MODERATOR_REQUIRED` / `ADMIN_REQUIRED` shared constants

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Auth/AuthorizationErrors.cs`

- [ ] **Step 1: Write it**

```csharp
namespace Lovecraft.Backend.Auth;

public static class AuthorizationErrors
{
    public const string InsufficientRank = "INSUFFICIENT_RANK";
    public const string ModeratorRequired = "MODERATOR_REQUIRED";
    public const string AdminRequired = "ADMIN_REQUIRED";
    public const string InsufficientRankMessage = "Insufficient rank for this action";
    public const string ModeratorRequiredMessage = "Moderator or Admin role required";
    public const string AdminRequiredMessage = "Admin role required";
}
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/lovecraft commit -m "feat(acl): shared authorization error codes"
```

---

## P5-T4: Enforce `permissions.create_topic` on topic creation

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureForumService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs`
- Create: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

Design choice: enforce in the **controller** (has access to `User` claims and `IAppConfigService`), not in the service. Services stay testable in pure-data mode.

- [ ] **Step 1: Write failing test — Novice blocked**

Create `Lovecraft/Lovecraft.UnitTests/AclTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Forum;
using Lovecraft.Common.Enums;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lovecraft.UnitTests;

[Collection("ForumTests")] // share collection with ForumTests — both mutate MockDataStore forum state
public class AclTests : IClassFixture<AclTests.TestAppFactory>, IDisposable
{
    private readonly TestAppFactory _factory;

    public AclTests(TestAppFactory factory)
    {
        _factory = factory;
        MockDataStore.UserActivity.Clear();
        MockDataStore.UserStaffRoles.Clear();
        MockDataStore.UserRankOverrides.Clear();
    }

    public void Dispose()
    {
        MockDataStore.UserActivity.Clear();
        MockDataStore.UserStaffRoles.Clear();
        MockDataStore.UserRankOverrides.Clear();
    }

    [Fact]
    public async Task CreateTopic_AsNovice_ReturnsInsufficientRank()
    {
        using var client = _factory.CreateClientAsUser("novice-user-1");
        var body = new CreateTopicRequestDto
        {
            Title = "Title that is long enough",
            Content = "Content that is long enough too.",
        };
        var resp = await client.PostAsJsonAsync("/api/v1/forum/sections/general/topics", body);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        var payload = await resp.Content.ReadFromJsonAsync<ApiResponse<ForumTopicDto>>();
        Assert.Equal("INSUFFICIENT_RANK", payload!.Error!.Code);
    }

    [Fact]
    public async Task CreateTopic_AsActiveMember_Succeeds()
    {
        // promote user to ActiveMember by giving 5 replies
        MockDataStore.UserActivity["active-user-1"] = new MockUserActivity { ReplyCount = 5 };

        using var client = _factory.CreateClientAsUser("active-user-1");
        var body = new CreateTopicRequestDto
        {
            Title = "A valid topic title",
            Content = "Content that's definitely long enough.",
        };
        var resp = await client.PostAsJsonAsync("/api/v1/forum/sections/general/topics", body);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    // ── Test server harness ────────────────────────────────────────
    public class TestAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("USE_AZURE_STORAGE", "false");
            builder.ConfigureTestServices(services =>
            {
                // replace JWT auth with a test auth scheme that accepts X-Test-User header
                services.AddAuthentication("Test")
                    .AddScheme<TestAuthOptions, TestAuthHandler>("Test", _ => { });
            });
        }

        public HttpClient CreateClientAsUser(string userId, string staffRole = "none")
        {
            var client = CreateClient();
            client.DefaultRequestHeaders.Add("X-Test-User", userId);
            client.DefaultRequestHeaders.Add("X-Test-StaffRole", staffRole);
            return client;
        }
    }
}
```

Define the supporting `TestAuthHandler` in the same file (or a shared `TestAuthSupport.cs`):

```csharp
public class TestAuthOptions : Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions { }

public class TestAuthHandler : Microsoft.AspNetCore.Authentication.AuthenticationHandler<TestAuthOptions>
{
    public TestAuthHandler(
        Microsoft.Extensions.Options.IOptionsMonitor<TestAuthOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        System.Text.Encodings.Web.UrlEncoder encoder,
        Microsoft.AspNetCore.Authentication.ISystemClock clock)
        : base(options, logger, encoder, clock) { }

    protected override Task<Microsoft.AspNetCore.Authentication.AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers["X-Test-User"].ToString();
        if (string.IsNullOrEmpty(userId))
            return Task.FromResult(Microsoft.AspNetCore.Authentication.AuthenticateResult.NoResult());
        var staffRole = Request.Headers["X-Test-StaffRole"].ToString();
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, userId),
            new("staffRole", string.IsNullOrEmpty(staffRole) ? "none" : staffRole),
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var ticket = new Microsoft.AspNetCore.Authentication.AuthenticationTicket(
            new ClaimsPrincipal(identity), "Test");
        return Task.FromResult(Microsoft.AspNetCore.Authentication.AuthenticateResult.Success(ticket));
    }
}
```

Also adjust the `Program.cs` JWT auth setup to accept additional auth schemes via an `Authorization` policy — or simpler, have the test factory override `DefaultAuthenticateScheme` via `services.AddAuthentication("Test")` replacing JWT for tests. Pragmatic: in `TestAppFactory.ConfigureWebHost`, replace authentication with:

```csharp
services.Configure<Microsoft.AspNetCore.Authentication.AuthenticationOptions>(o =>
{
    o.DefaultAuthenticateScheme = "Test";
    o.DefaultChallengeScheme = "Test";
});
```

- [ ] **Step 2: Run — see failure**

`dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter AclTests`
Expected: first test fails — endpoint returns 200 (no enforcement yet).

- [ ] **Step 3: Implement permission guard helper**

Create `Lovecraft/Lovecraft.Backend/Auth/PermissionGuard.cs`:

```csharp
using System.Security.Claims;
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.Services;
using Lovecraft.Common.Enums;
using Microsoft.AspNetCore.Http;

namespace Lovecraft.Backend.Auth;

public static class PermissionGuard
{
    /// <summary>
    /// Returns true when the caller has at least the required level.
    /// Requires rank to be fetched from IUserService (uses computed rank, not stored).
    /// </summary>
    public static async Task<bool> MeetsAsync(
        ClaimsPrincipal user,
        IUserService userService,
        string requiredLevel)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return false;

        var staffRoleClaim = user.FindFirst("staffRole")?.Value ?? "none";
        var staffLevel = EffectiveLevel.Parse(staffRoleClaim);

        // rank comes from UserService (computed), not stored on user
        var dto = await userService.GetUserByIdAsync(userId);
        var rankLevel = (int)(dto?.Rank ?? UserRank.Novice);

        var required = EffectiveLevel.Parse(requiredLevel);
        return Math.Max(rankLevel, staffLevel) >= required;
    }
}
```

- [ ] **Step 4: Enforce in `ForumController.CreateTopic`**

Inject `IAppConfigService` and `IUserService` into the controller ctor. At the top of `CreateTopic`:

```csharp
var config = await _appConfig.GetConfigAsync();
var allowed = await PermissionGuard.MeetsAsync(User, _userService, config.Permissions.CreateTopic);
if (!allowed)
    return StatusCode(StatusCodes.Status403Forbidden,
        ApiResponse<ForumTopicDto>.ErrorResponse(
            AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));
```

Also pass `request.NoviceVisible` and `request.NoviceCanReply` through to the service (extend `IForumService.CreateTopicAsync` signature with two new optional nullable bools).

- [ ] **Step 5: Run — see pass**

`dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter AclTests`
Expected: both test cases pass.

- [ ] **Step 6: Commit**

```bash
git -C D:/src/lovecraft add -A
git -C D:/src/lovecraft commit -m "feat(acl): enforce permissions.create_topic + accept noviceVisible/noviceCanReply on topic creation"
```

---

## P5-T5: Enforce section `MinRank` and `noviceVisible` on topic listing / detail

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockForumService.cs` + `Azure/AzureForumService.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

Behavior:
- `GET /forum/sections/{id}/topics`: caller's effective level must be ≥ section's `MinRank`. If below, return `INSUFFICIENT_RANK`.
- Within that list, topics with `NoviceVisible=false` are excluded for callers whose computed rank is `Novice` (even if staff level satisfies section gate? Per spec, noviceVisible is specifically about computed rank — staff roles override everything, so staff users see all). We follow spec literally: exclude when computed rank is novice, regardless of staff.
- `GET /forum/topics/{id}`: same two checks. Missing section → 404.

- [ ] **Step 1: Write failing tests** (append to `AclTests`)

```csharp
[Fact]
public async Task GetTopicsInGatedSection_AsNovice_Returns403()
{
    // seed a section with MinRank=activeMember in mock data
    MockDataStore.ForumSections.Add(new ForumSectionDto
    {
        Id = "gated", Name = "Gated", Description = "", TopicCount = 0, MinRank = "activeMember"
    });
    using var client = _factory.CreateClientAsUser("novice-user-2");
    var resp = await client.GetAsync("/api/v1/forum/sections/gated/topics");
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
}

[Fact]
public async Task NoviceHiddenTopic_NotInList_ForNovice()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "hidden-1", SectionId = "general", Title = "Hidden", Content = "...",
        AuthorId = "x", AuthorName = "x", MinRank = "novice", NoviceVisible = false,
    });
    using var client = _factory.CreateClientAsUser("novice-user-3");
    var resp = await client.GetAsync("/api/v1/forum/sections/general/topics");
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    var payload = await resp.Content.ReadFromJsonAsync<ApiResponse<List<ForumTopicDto>>>();
    Assert.DoesNotContain(payload!.Data!, t => t.Id == "hidden-1");
}

[Fact]
public async Task NoviceHiddenTopic_Visible_ForActiveMember()
{
    MockDataStore.UserActivity["active-user-2"] = new MockUserActivity { ReplyCount = 5 };
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "hidden-2", SectionId = "general", Title = "Hidden 2", Content = "...",
        AuthorId = "x", AuthorName = "x", MinRank = "novice", NoviceVisible = false,
    });
    using var client = _factory.CreateClientAsUser("active-user-2");
    var resp = await client.GetAsync("/api/v1/forum/sections/general/topics");
    var payload = await resp.Content.ReadFromJsonAsync<ApiResponse<List<ForumTopicDto>>>();
    Assert.Contains(payload!.Data!, t => t.Id == "hidden-2");
}

[Fact]
public async Task GetHiddenTopic_ById_AsNovice_Returns403()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "hidden-3", SectionId = "general", Title = "H3", Content = "...",
        AuthorId = "x", AuthorName = "x", MinRank = "novice", NoviceVisible = false,
    });
    using var client = _factory.CreateClientAsUser("novice-user-4");
    var resp = await client.GetAsync("/api/v1/forum/topics/hidden-3");
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
}
```

- [ ] **Step 2: Run — see failures**

- [ ] **Step 3: Implement**

In `ForumController.GetTopics(sectionId)`:

```csharp
var section = (await _forumService.GetSectionsAsync()).FirstOrDefault(s => s.Id == sectionId);
if (section is null)
    return NotFound(ApiResponse<List<ForumTopicDto>>.ErrorResponse("NOT_FOUND", "Section not found"));

var allowed = await PermissionGuard.MeetsAsync(User, _userService, section.MinRank);
if (!allowed)
    return StatusCode(403, ApiResponse<List<ForumTopicDto>>.ErrorResponse(
        AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));

var topics = await _forumService.GetTopicsAsync(sectionId);
var callerRank = await GetCallerRankAsync();
if (callerRank == UserRank.Novice)
    topics = topics.Where(t => t.NoviceVisible).ToList();
return Ok(ApiResponse<List<ForumTopicDto>>.SuccessResponse(topics));
```

Add private helper:

```csharp
private async Task<UserRank> GetCallerRankAsync()
{
    var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(id)) return UserRank.Novice;
    var user = await _userService.GetUserByIdAsync(id);
    return user?.Rank ?? UserRank.Novice;
}
```

In `ForumController.GetTopic(topicId)`:

```csharp
var topic = await _forumService.GetTopicByIdAsync(topicId);
if (topic is null)
    return NotFound(ApiResponse<ForumTopicDto>.ErrorResponse("NOT_FOUND", "Topic not found"));

var allowed = await PermissionGuard.MeetsAsync(User, _userService, topic.MinRank);
if (!allowed)
    return StatusCode(403, ApiResponse<ForumTopicDto>.ErrorResponse(
        AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));

if (!topic.NoviceVisible && await GetCallerRankAsync() == UserRank.Novice)
    return StatusCode(403, ApiResponse<ForumTopicDto>.ErrorResponse(
        AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));

return Ok(ApiResponse<ForumTopicDto>.SuccessResponse(topic));
```

- [ ] **Step 4: Run + commit**

```bash
dotnet test D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests --filter AclTests
git -C D:/src/lovecraft commit -am "feat(acl): enforce section MinRank and noviceVisible on topic list and detail"
```

---

## P5-T6: Enforce `noviceCanReply` on reply creation

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
[Fact]
public async Task PostReply_WhenNoviceCantReply_AsNovice_Returns403()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "norep-1", SectionId = "general", Title = "NR", Content = "...",
        AuthorId = "x", AuthorName = "x", MinRank = "novice",
        NoviceVisible = true, NoviceCanReply = false,
    });
    using var client = _factory.CreateClientAsUser("novice-reply");
    var resp = await client.PostAsJsonAsync("/api/v1/forum/topics/norep-1/replies",
        new CreateReplyRequestDto { Content = "some text" });
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
}

[Fact]
public async Task PostReply_WhenNoviceCantReply_AsActive_Succeeds()
{
    MockDataStore.UserActivity["active-reply"] = new MockUserActivity { ReplyCount = 5 };
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "norep-2", SectionId = "general", Title = "NR2", Content = "...",
        AuthorId = "x", AuthorName = "x", MinRank = "novice",
        NoviceVisible = true, NoviceCanReply = false,
    });
    using var client = _factory.CreateClientAsUser("active-reply");
    var resp = await client.PostAsJsonAsync("/api/v1/forum/topics/norep-2/replies",
        new CreateReplyRequestDto { Content = "some text" });
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
}
```

- [ ] **Step 2: Implement**

At the start of `ForumController.CreateReply(topicId, request)`, after claim extraction:

```csharp
var topic = await _forumService.GetTopicByIdAsync(topicId);
if (topic is null)
    return NotFound(ApiResponse<ForumReplyDto>.ErrorResponse("NOT_FOUND", "Topic not found"));

var section = (await _forumService.GetSectionsAsync()).FirstOrDefault(s => s.Id == topic.SectionId);
var sectionAllowed = section is null ||
    await PermissionGuard.MeetsAsync(User, _userService, section.MinRank);
var topicAllowed = await PermissionGuard.MeetsAsync(User, _userService, topic.MinRank);
if (!sectionAllowed || !topicAllowed)
    return StatusCode(403, ApiResponse<ForumReplyDto>.ErrorResponse(
        AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));

if (!topic.NoviceCanReply && await GetCallerRankAsync() == UserRank.Novice)
    return StatusCode(403, ApiResponse<ForumReplyDto>.ErrorResponse(
        AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));
```

- [ ] **Step 3: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): enforce section MinRank + noviceCanReply on reply creation"
```

---

## P5-T7: `PUT /forum/topics/{id}` for topic author + moderator+

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs` + impls
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

Spec §API Endpoints: allowed for topic author (own topic) or Moderator+.

- [ ] **Step 1: Add service method**

`IForumService` add:

```csharp
Task<ForumTopicDto?> UpdateTopicAsync(string topicId, UpdateTopicRequestDto update);
```

Implement in Mock (update in-place) + Azure (`GetEntity`, apply non-null fields, `UpdateEntity` with ETag). Return null if not found.

- [ ] **Step 2: Write failing tests**

```csharp
[Fact]
public async Task UpdateTopic_AsAuthor_Succeeds()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "own-1", SectionId = "general", Title = "Own", Content = "...",
        AuthorId = "author-user", AuthorName = "Author", NoviceVisible = true, NoviceCanReply = true,
    });
    using var client = _factory.CreateClientAsUser("author-user");
    var resp = await client.PutAsJsonAsync("/api/v1/forum/topics/own-1",
        new UpdateTopicRequestDto { NoviceVisible = false });
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    Assert.False(MockDataStore.ForumTopics.First(t => t.Id == "own-1").NoviceVisible);
}

[Fact]
public async Task UpdateTopic_AsRandomUser_Returns403()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "own-2", SectionId = "general", Title = "Own2", Content = "...",
        AuthorId = "someone-else", AuthorName = "X",
    });
    using var client = _factory.CreateClientAsUser("rando");
    var resp = await client.PutAsJsonAsync("/api/v1/forum/topics/own-2",
        new UpdateTopicRequestDto { NoviceVisible = false });
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
}

[Fact]
public async Task UpdateTopic_AsModerator_Succeeds()
{
    MockDataStore.ForumTopics.Add(new ForumTopicDto
    {
        Id = "own-3", SectionId = "general", Title = "Own3", Content = "...",
        AuthorId = "someone-else", AuthorName = "X",
    });
    using var client = _factory.CreateClientAsUser("mod-user", "moderator");
    var resp = await client.PutAsJsonAsync("/api/v1/forum/topics/own-3",
        new UpdateTopicRequestDto { IsPinned = true });
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    Assert.True(MockDataStore.ForumTopics.First(t => t.Id == "own-3").IsPinned);
}
```

- [ ] **Step 3: Implement endpoint**

```csharp
[HttpPut("topics/{topicId}")]
public async Task<IActionResult> UpdateTopic(string topicId, [FromBody] UpdateTopicRequestDto request)
{
    var topic = await _forumService.GetTopicByIdAsync(topicId);
    if (topic is null)
        return NotFound(ApiResponse<ForumTopicDto>.ErrorResponse("NOT_FOUND", "Topic not found"));

    var callerId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    var staffRole = User.FindFirst("staffRole")?.Value ?? "none";
    var isAuthor = callerId == topic.AuthorId;
    var isModerator = EffectiveLevel.Parse(staffRole) >= EffectiveLevel.Moderator;
    if (!isAuthor && !isModerator)
        return StatusCode(403, ApiResponse<ForumTopicDto>.ErrorResponse(
            AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage));

    // Only moderators can set isPinned / isLocked
    if ((request.IsPinned.HasValue || request.IsLocked.HasValue) && !isModerator)
        return StatusCode(403, ApiResponse<ForumTopicDto>.ErrorResponse(
            AuthorizationErrors.ModeratorRequired, AuthorizationErrors.ModeratorRequiredMessage));

    var updated = await _forumService.UpdateTopicAsync(topicId, request);
    return Ok(ApiResponse<ForumTopicDto>.SuccessResponse(updated!));
}
```

- [ ] **Step 4: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): PUT /forum/topics/{id} for authors and moderators"
```

---

## P5-T8: Enforce `delete_any_reply` / `delete_any_topic` / `pin_topic` (explicit wiring)

Note: the spec lists these as configurable permissions. No existing DELETE endpoints are present today; rather than invent them just for the permission matrix, document in `AclTests` a skipped placeholder and defer actual DELETE endpoints to a future spec. This matches the spec's Out-of-Scope note for edit/delete UI.

- [ ] **Step 1: Add a comment block to `AclTests.cs`**

```csharp
// Delete endpoints (DELETE /forum/replies/{id}, DELETE /forum/topics/{id}) are not yet
// implemented in the backend. The permission keys delete_any_reply / delete_any_topic /
// pin_topic are defined in appconfig so a later spec can wire them without reconfig.
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/lovecraft commit --allow-empty -m "docs(acl): note that delete/pin endpoint wiring is deferred to future spec"
```

---

# Phase 6 — Admin Endpoints + Role/Permission Filters

## P6-T1: `[RequireStaffRole]` and `[RequirePermission]` action filters

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Auth/RequireStaffRoleAttribute.cs`
- Create: `Lovecraft/Lovecraft.Backend/Auth/RequirePermissionAttribute.cs`

- [ ] **Step 1: Write `RequireStaffRoleAttribute`**

```csharp
using Lovecraft.Backend.Helpers;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lovecraft.Backend.Auth;

/// <summary>
/// Requires the caller's staffRole claim meet at least the given minimum.
/// Valid values: "moderator" | "admin".
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireStaffRoleAttribute : Attribute, IAuthorizationFilter
{
    private readonly int _requiredLevel;
    private readonly string _errorCode;
    private readonly string _errorMessage;

    public RequireStaffRoleAttribute(string minimumRole)
    {
        _requiredLevel = EffectiveLevel.Parse(minimumRole);
        if (_requiredLevel >= EffectiveLevel.Admin)
        {
            _errorCode = AuthorizationErrors.AdminRequired;
            _errorMessage = AuthorizationErrors.AdminRequiredMessage;
        }
        else
        {
            _errorCode = AuthorizationErrors.ModeratorRequired;
            _errorMessage = AuthorizationErrors.ModeratorRequiredMessage;
        }
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var staffRole = context.HttpContext.User.FindFirst("staffRole")?.Value ?? "none";
        var actualLevel = EffectiveLevel.Parse(staffRole);
        if (actualLevel < _requiredLevel)
        {
            context.Result = new ObjectResult(
                ApiResponse<object>.ErrorResponse(_errorCode, _errorMessage))
            { StatusCode = 403 };
        }
    }
}
```

- [ ] **Step 2: Write `RequirePermissionAttribute`**

This one needs `IAppConfigService` at request time — use `IAsyncAuthorizationFilter`:

```csharp
using Lovecraft.Backend.Helpers;
using Lovecraft.Backend.Services;
using Lovecraft.Common.Enums;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lovecraft.Backend.Auth;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequirePermissionAttribute : Attribute, IFilterFactory
{
    public bool IsReusable => false;
    private readonly string _permissionKey;
    public RequirePermissionAttribute(string permissionKey) { _permissionKey = permissionKey; }

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) =>
        new Impl(
            serviceProvider.GetRequiredService<IAppConfigService>(),
            serviceProvider.GetRequiredService<IUserService>(),
            _permissionKey);

    private class Impl : IAsyncAuthorizationFilter
    {
        private readonly IAppConfigService _config;
        private readonly IUserService _users;
        private readonly string _key;

        public Impl(IAppConfigService config, IUserService users, string key)
        { _config = config; _users = users; _key = key; }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var cfg = await _config.GetConfigAsync();
            var required = LookupRequiredLevel(cfg.Permissions, _key);
            var ok = await PermissionGuard.MeetsAsync(context.HttpContext.User, _users, required);
            if (!ok)
            {
                context.Result = new ObjectResult(ApiResponse<object>.ErrorResponse(
                    AuthorizationErrors.InsufficientRank, AuthorizationErrors.InsufficientRankMessage))
                { StatusCode = 403 };
            }
        }

        private static string LookupRequiredLevel(PermissionConfig p, string key) => key switch
        {
            "create_topic" => p.CreateTopic,
            "delete_own_reply" => p.DeleteOwnReply,
            "delete_any_reply" => p.DeleteAnyReply,
            "delete_any_topic" => p.DeleteAnyTopic,
            "pin_topic" => p.PinTopic,
            "ban_user" => p.BanUser,
            "assign_role" => p.AssignRole,
            "override_rank" => p.OverrideRank,
            "manage_events" => p.ManageEvents,
            "manage_blog" => p.ManageBlog,
            "manage_store" => p.ManageStore,
            _ => "admin", // fail closed
        };
    }
}
```

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Auth/
git -C D:/src/lovecraft commit -m "feat(acl): RequireStaffRole and RequirePermission action filters"
```

---

## P6-T2: `PUT /api/v1/users/{id}/role`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs`
- Create: `Lovecraft/Lovecraft.Common/DTOs/Admin/AdminDtos.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

- [ ] **Step 1: Admin DTO**

Create `Lovecraft/Lovecraft.Common/DTOs/Admin/AdminDtos.cs`:

```csharp
using Lovecraft.Common.Enums;

namespace Lovecraft.Common.DTOs.Admin;

public record AssignRoleRequestDto(StaffRole Role);
public record SetRankOverrideRequestDto(UserRank? Rank);
public record AppConfigDto(
    Dictionary<string, string> RankThresholds,
    Dictionary<string, string> Permissions);
```

- [ ] **Step 2: Write failing tests**

Append to `AclTests`:

```csharp
[Fact]
public async Task AssignRole_AsAdmin_Succeeds()
{
    using var client = _factory.CreateClientAsUser("admin-1", "admin");
    var resp = await client.PutAsJsonAsync("/api/v1/users/u-target/role",
        new AssignRoleRequestDto(StaffRole.Moderator));
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    Assert.Equal(StaffRole.Moderator, MockDataStore.UserStaffRoles["u-target"]);
}

[Fact]
public async Task AssignRole_AsNonAdmin_ReturnsAdminRequired()
{
    using var client = _factory.CreateClientAsUser("mod-1", "moderator");
    var resp = await client.PutAsJsonAsync("/api/v1/users/u-target/role",
        new AssignRoleRequestDto(StaffRole.Admin));
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    var payload = await resp.Content.ReadFromJsonAsync<ApiResponse<object>>();
    Assert.Equal("ADMIN_REQUIRED", payload!.Error!.Code);
}
```

- [ ] **Step 3: Implement endpoint**

In `UsersController.cs` add:

```csharp
[HttpPut("{id}/role")]
[RequireStaffRole("admin")]
public async Task<IActionResult> AssignRole(string id, [FromBody] AssignRoleRequestDto request)
{
    await _userService.SetStaffRoleAsync(id, request.Role);
    return Ok(ApiResponse<object>.SuccessResponse(new { userId = id, staffRole = request.Role }));
}
```

- [ ] **Step 4: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): PUT /api/v1/users/{id}/role admin-only"
```

---

## P6-T3: `PUT /api/v1/users/{id}/rank-override`

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
[Fact]
public async Task SetRankOverride_AsAdmin_Succeeds()
{
    using var client = _factory.CreateClientAsUser("admin-2", "admin");
    var resp = await client.PutAsJsonAsync("/api/v1/users/u-2/rank-override",
        new SetRankOverrideRequestDto(UserRank.AloeCrew));
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    Assert.Equal(UserRank.AloeCrew, MockDataStore.UserRankOverrides["u-2"]);
}

[Fact]
public async Task ClearRankOverride_AsAdmin_Works()
{
    MockDataStore.UserRankOverrides["u-3"] = UserRank.AloeCrew;
    using var client = _factory.CreateClientAsUser("admin-3", "admin");
    var resp = await client.PutAsJsonAsync("/api/v1/users/u-3/rank-override",
        new SetRankOverrideRequestDto(null));
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    Assert.False(MockDataStore.UserRankOverrides.ContainsKey("u-3"));
}
```

- [ ] **Step 2: Implement**

```csharp
[HttpPut("{id}/rank-override")]
[RequireStaffRole("admin")]
public async Task<IActionResult> SetRankOverride(
    string id, [FromBody] SetRankOverrideRequestDto request)
{
    await _userService.SetRankOverrideAsync(id, request.Rank);
    return Ok(ApiResponse<object>.SuccessResponse(new { userId = id, rankOverride = request.Rank }));
}
```

- [ ] **Step 3: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): PUT /api/v1/users/{id}/rank-override admin-only"
```

---

## P6-T4: `GET /api/v1/admin/config`

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AclTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
[Fact]
public async Task GetAdminConfig_AsAdmin_ReturnsConfig()
{
    using var client = _factory.CreateClientAsUser("admin-4", "admin");
    var resp = await client.GetAsync("/api/v1/admin/config");
    Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    var payload = await resp.Content.ReadFromJsonAsync<ApiResponse<AppConfigDto>>();
    Assert.Equal("5", payload!.Data!.RankThresholds["active_replies"]);
    Assert.Equal("activeMember", payload.Data.Permissions["create_topic"]);
}

[Fact]
public async Task GetAdminConfig_AsUser_Returns403()
{
    using var client = _factory.CreateClientAsUser("regular");
    var resp = await client.GetAsync("/api/v1/admin/config");
    Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
}
```

- [ ] **Step 2: Implement controller**

Create `Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs`:

```csharp
using Lovecraft.Backend.Auth;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Admin;
using Lovecraft.Common.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
[RequireStaffRole("admin")]
public class AdminController : ControllerBase
{
    private readonly IAppConfigService _appConfig;

    public AdminController(IAppConfigService appConfig) { _appConfig = appConfig; }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await _appConfig.GetConfigAsync();
        var dto = new AppConfigDto(
            RankThresholds: new()
            {
                ["active_replies"] = cfg.Ranks.ActiveReplies.ToString(),
                ["active_likes"] = cfg.Ranks.ActiveLikes.ToString(),
                ["active_events"] = cfg.Ranks.ActiveEvents.ToString(),
                ["friend_replies"] = cfg.Ranks.FriendReplies.ToString(),
                ["friend_likes"] = cfg.Ranks.FriendLikes.ToString(),
                ["friend_events"] = cfg.Ranks.FriendEvents.ToString(),
                ["crew_replies"] = cfg.Ranks.CrewReplies.ToString(),
                ["crew_likes"] = cfg.Ranks.CrewLikes.ToString(),
                ["crew_events"] = cfg.Ranks.CrewEvents.ToString(),
                ["crew_matches"] = cfg.Ranks.CrewMatches.ToString(),
            },
            Permissions: new()
            {
                ["create_topic"] = cfg.Permissions.CreateTopic,
                ["delete_own_reply"] = cfg.Permissions.DeleteOwnReply,
                ["delete_any_reply"] = cfg.Permissions.DeleteAnyReply,
                ["delete_any_topic"] = cfg.Permissions.DeleteAnyTopic,
                ["pin_topic"] = cfg.Permissions.PinTopic,
                ["ban_user"] = cfg.Permissions.BanUser,
                ["assign_role"] = cfg.Permissions.AssignRole,
                ["override_rank"] = cfg.Permissions.OverrideRank,
                ["manage_events"] = cfg.Permissions.ManageEvents,
                ["manage_blog"] = cfg.Permissions.ManageBlog,
                ["manage_store"] = cfg.Permissions.ManageStore,
            });
        return Ok(ApiResponse<AppConfigDto>.SuccessResponse(dto));
    }
}
```

- [ ] **Step 3: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): GET /api/v1/admin/config admin-only"
```

---

## P6-T5: JWT now carries `staffRole` claim

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Auth/IJwtService.cs` + `JwtService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs` and `Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs`

- [ ] **Step 1: Extend `IJwtService.GenerateAccessToken`**

Add `staffRole` string parameter (default `"none"`). Inside token generation, add:

```csharp
new Claim("staffRole", staffRole),
```

- [ ] **Step 2: Pass from auth services**

In `MockAuthService`/`AzureAuthService` login and refresh flows, look up user's `StaffRole` (from `MockDataStore.UserStaffRoles` or the `UserEntity.StaffRole` field) and pass it into `GenerateAccessToken`.

- [ ] **Step 3: Add test**

In `AuthenticationTests.cs` add:

```csharp
[Fact]
public async Task Login_EmbedsStaffRoleInToken()
{
    MockDataStore.UserStaffRoles["mock-user-id"] = StaffRole.Moderator;
    var response = await _svc.LoginAsync(new LoginRequestDto { Email = "anna@test.com", Password = "Anna123!" });
    Assert.True(response.Success);
    // Decode JWT and assert claim
    var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
    var token = handler.ReadJwtToken(response.Data!.AccessToken);
    Assert.Equal("moderator", token.Claims.First(c => c.Type == "staffRole").Value);
}
```

(Adjust user id / email to match existing mock user; clear `UserStaffRoles` at test end.)

- [ ] **Step 4: Run + commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): JWT carries staffRole claim for zero-DB-hit authorization"
```

---

# Phase 7 — Seeder + Mock Data Parity

## P7-T1: Seeder seeds `appconfig` table with defaults

**Files:**
- Modify: `Lovecraft/Lovecraft.Tools.Seeder/Program.cs`

- [ ] **Step 1: Add `appconfig` to `allTables` list**

Find the `allTables` initializer and add:

```csharp
TableNames.AppConfig,
```

This makes it get created + wiped on each seeder run.

- [ ] **Step 2: Add a seeding block**

After the existing forum-seed block, add:

```csharp
Console.WriteLine("Seeding appconfig...");
var appConfigTable = serviceClient.GetTableClient(TableNames.AppConfig);

async Task Upsert(string pk, string rk, string value) =>
    await appConfigTable.UpsertEntityAsync(new Lovecraft.Backend.Storage.Entities.AppConfigEntity
    {
        PartitionKey = pk, RowKey = rk, Value = value,
    });

// rank_thresholds
await Upsert("rank_thresholds", "active_replies", "5");
await Upsert("rank_thresholds", "active_likes", "3");
await Upsert("rank_thresholds", "active_events", "1");
await Upsert("rank_thresholds", "friend_replies", "25");
await Upsert("rank_thresholds", "friend_likes", "15");
await Upsert("rank_thresholds", "friend_events", "3");
await Upsert("rank_thresholds", "crew_replies", "100");
await Upsert("rank_thresholds", "crew_likes", "50");
await Upsert("rank_thresholds", "crew_events", "10");
await Upsert("rank_thresholds", "crew_matches", "10");

// permissions
await Upsert("permissions", "create_topic", "activeMember");
await Upsert("permissions", "delete_own_reply", "novice");
await Upsert("permissions", "delete_any_reply", "moderator");
await Upsert("permissions", "delete_any_topic", "moderator");
await Upsert("permissions", "pin_topic", "moderator");
await Upsert("permissions", "ban_user", "moderator");
await Upsert("permissions", "assign_role", "admin");
await Upsert("permissions", "override_rank", "admin");
await Upsert("permissions", "manage_events", "admin");
await Upsert("permissions", "manage_blog", "admin");
await Upsert("permissions", "manage_store", "admin");
Console.WriteLine("Seeded appconfig with defaults.");
```

- [ ] **Step 3: Build + commit**

```bash
dotnet build D:\src\lovecraft\Lovecraft\Lovecraft.slnx
git -C D:/src/lovecraft commit -am "feat(acl): seeder populates appconfig with rank_thresholds and permissions"
```

---

## P7-T2: Seeder seeds activity counters and staff roles on mock users

**Files:**
- Modify: `Lovecraft/Lovecraft.Tools.Seeder/Program.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs` (already done P1-T1)

Seed per spec §Seeder:

| User Name contains | ReplyCount | LikesReceived | EventsAttended | MatchCount | Resulting rank |
|---|---|---|---|---|---|
| Anna | 120 | 60 | 12 | 11 | Aloe Crew |
| Dmitry | 30 | 18 | 4 | 0 | Friend of Aloe |
| Elena | 8 | 4 | 2 | 0 | Active Member |
| Maria | 1 | 0 | 0 | 0 | Novice |

- [ ] **Step 1: Modify `SeedUserAsync`**

Add optional parameters:

```csharp
static async Task SeedUserAsync(
    TableClient usersTable, TableClient indexTable, ..., 
    int replyCount = 0, int likesReceived = 0, int eventsAttended = 0, int matchCount = 0,
    string staffRole = "none")
```

Inside, populate the new entity fields.

- [ ] **Step 2: Update user-seeding calls**

Match by `Name.Contains("Anna")`, etc. — extend the existing `SeedUserAsync` calls with counter values.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): seeder assigns activity counters + staff roles to mock users"
```

---

## P7-T3: `MockDataStore` parallel activity for mock users

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs`

- [ ] **Step 1: Initialize `UserActivity`**

Replace the empty `UserActivity` dictionary initialization with:

```csharp
public static Dictionary<string, MockUserActivity> UserActivity { get; set; } = new()
{
    // Anna (Aloe Crew)
    ["1"] = new MockUserActivity { ReplyCount = 120, LikesReceived = 60, EventsAttended = 12, MatchCount = 11 },
    // Dmitry (Friend of Aloe) — use the id matching the second seeded user
    ["2"] = new MockUserActivity { ReplyCount = 30, LikesReceived = 18, EventsAttended = 4, MatchCount = 0 },
    // Elena (Active Member)
    ["3"] = new MockUserActivity { ReplyCount = 8, LikesReceived = 4, EventsAttended = 2, MatchCount = 0 },
    // Maria (Novice)
    ["4"] = new MockUserActivity { ReplyCount = 1 },
};
```

Adjust `Id` keys to match whatever the seeded mock user ids are in the existing `MockDataStore.Users` list (verify by reading the Users initializer).

- [ ] **Step 2: Commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): mock-mode activity counters make all four rank tiers visible"
```

---

## P7-T4: Seed forum sections with `MinRank` defaults

**Files:**
- Modify: `Lovecraft/Lovecraft.Tools.Seeder/Program.cs`
- Modify: `Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs`

For MVP: all existing sections stay `MinRank = "novice"` (public). Add one example gated section in Seeder (commented-out as an example) and one in MockDataStore (uncommented so devs can see gating in action).

- [ ] **Step 1: Seeder — update forum section seed calls**

Pass `minRank: "novice"` explicitly where sections are seeded (make the field explicit for readability).

- [ ] **Step 2: MockDataStore — add one gated section**

Add to the `ForumSections` list:

```csharp
new() { Id = "insiders", Name = "Инсайдеры", Description = "Only for Active Members+",
        TopicCount = 0, MinRank = "activeMember" },
```

Add the `MinRank` property in the `ForumSectionDto` constructor list.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft commit -am "feat(acl): seed forum sections with explicit MinRank + add gated demo section"
```

---

# Phase 8 — Frontend Types + API Mapping + Translations

## P8-T1: Add `UserRank` / `StaffRole` to types, extend `User`

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/types/user.ts`

- [ ] **Step 1: Append types**

```typescript
export type UserRank = 'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew';
export type StaffRole = 'none' | 'moderator' | 'admin';

export interface User {
  // ... existing fields ...
  rank: UserRank;
  staffRole: StaffRole;
}
```

Change the existing `User` interface in-place — add the two fields after `settings`.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/types/user.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(acl): UserRank and StaffRole types on User"
```

---

## P8-T2: `mapUserFromApi` surfaces `rank` + `staffRole`

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/services/api/usersApi.ts`

- [ ] **Step 1: Find `mapUserFromApi` and add mappings**

Add the two fields to the returned object, defaulting to `'novice'` / `'none'` when missing:

```typescript
rank: (apiUser.rank ?? 'novice') as UserRank,
staffRole: (apiUser.staffRole ?? 'none') as StaffRole,
```

Add the type imports at the top.

- [ ] **Step 2: Run frontend tests**

```bash
cd D:\src\aloevera-harmony-meet
npm run test -- --run usersApi
```

Expected: any existing tests still pass; no new assertions yet.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): map rank/staffRole from API in mapUserFromApi"
```

---

## P8-T3: Create `src/types/forum.ts` with rank fields

**Files:**
- Create: `D:/src/aloevera-harmony-meet/src/types/forum.ts`
- Modify: `D:/src/aloevera-harmony-meet/src/types/index.ts`

- [ ] **Step 1: Write types**

```typescript
import { UserRank, StaffRole } from './user';

export type ForumMinRank = UserRank;

export interface ForumSection {
  id: string;
  name: string;
  description: string;
  topicCount: number;
  minRank: ForumMinRank;
}

export interface ForumTopic {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  minRank: ForumMinRank;
  noviceVisible: boolean;
  noviceCanReply: boolean;
}

export interface ForumReply {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  imageUrls: string[];
  authorRank: UserRank;
  authorStaffRole: StaffRole;
}
```

- [ ] **Step 2: Export from index**

In `src/types/index.ts`:

```typescript
export * from './user';
export * from './chat';
export * from './forum';
```

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/types/forum.ts src/types/index.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(acl): add ForumSection/Topic/Reply types with rank fields"
```

---

## P8-T4: `forumsApi.ts` surfaces new fields

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/services/api/forumsApi.ts`

- [ ] **Step 1: Update inline types + mapping**

Extend the internal `ForumTopicDto` (and the matching `ForumSectionDto`/`ForumReplyDto` DTOs if inline) with the new fields, then map them through in each function to produce `ForumSection`/`ForumTopic`/`ForumReply` from the shared types.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): forumsApi surfaces minRank, noviceVisible, noviceCanReply, authorRank, authorStaffRole"
```

---

## P8-T5: Translation keys

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/contexts/LanguageContext.tsx`

- [ ] **Step 1: Add keys**

Inside `translations.ru`:

```typescript
'rank.novice': 'Новичок',
'rank.activeMember': 'Активный участник',
'rank.friendOfAloe': 'Друг AloeVera',
'rank.aloeCrew': 'Команда AloeVera',
'staffRole.moderator': 'Мод',
'staffRole.admin': 'Админ',
'forum.lockedSection': 'Только для активных участников+',
'forum.replyRestricted': 'Ответы доступны только активным участникам',
'forum.noviceVisible': 'Видно новичкам',
'forum.noviceCanReply': 'Новички могут отвечать',
```

Inside `translations.en`:

```typescript
'rank.novice': 'Novice',
'rank.activeMember': 'Active Member',
'rank.friendOfAloe': 'Friend of Aloe',
'rank.aloeCrew': 'Aloe Crew',
'staffRole.moderator': 'Mod',
'staffRole.admin': 'Admin',
'forum.lockedSection': 'Active Member+ only',
'forum.replyRestricted': 'Replies for Active Members only',
'forum.noviceVisible': 'Visible to new users',
'forum.noviceCanReply': 'New users can reply',
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): i18n keys for rank, staffRole, and forum gating messages"
```

---

## P8-T6: ACL helpers mirror backend

**Files:**
- Create: `D:/src/aloevera-harmony-meet/src/lib/acl.ts`
- Create: `D:/src/aloevera-harmony-meet/src/lib/__tests__/acl.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { effectiveLevel, meetsLevel } from '@/lib/acl';

describe('effectiveLevel', () => {
  it('returns 0 for novice / none', () => {
    expect(effectiveLevel('novice', 'none')).toBe(0);
  });

  it('takes max of rank and staff', () => {
    expect(effectiveLevel('aloeCrew', 'none')).toBe(3);
    expect(effectiveLevel('novice', 'moderator')).toBe(4);
    expect(effectiveLevel('activeMember', 'admin')).toBe(5);
  });
});

describe('meetsLevel', () => {
  it('true when user level equals required', () => {
    expect(meetsLevel('activeMember', 'none', 'activeMember')).toBe(true);
  });

  it('false when below required', () => {
    expect(meetsLevel('novice', 'none', 'activeMember')).toBe(false);
  });

  it('staff role satisfies rank requirement', () => {
    expect(meetsLevel('novice', 'moderator', 'activeMember')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — see fail**

```
npm run test -- --run src/lib/__tests__/acl.test.ts
```
Expected: module not found.

- [ ] **Step 3: Write `src/lib/acl.ts`**

```typescript
import type { UserRank, StaffRole } from '@/types/user';

const LEVELS: Record<string, number> = {
  novice: 0, none: 0,
  activeMember: 1,
  friendOfAloe: 2,
  aloeCrew: 3,
  moderator: 4,
  admin: 5,
};

export function levelOf(value: UserRank | StaffRole | string | null | undefined): number {
  if (!value) return 0;
  return LEVELS[value] ?? 0;
}

export function effectiveLevel(rank: UserRank, staffRole: StaffRole): number {
  return Math.max(levelOf(rank), levelOf(staffRole));
}

export function meetsLevel(
  rank: UserRank,
  staffRole: StaffRole,
  required: UserRank | StaffRole,
): boolean {
  return effectiveLevel(rank, staffRole) >= levelOf(required);
}
```

- [ ] **Step 4: Run + commit**

```bash
npm run test -- --run src/lib/__tests__/acl.test.ts
git -C D:/src/aloevera-harmony-meet add src/lib/acl.ts src/lib/__tests__/acl.test.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(acl): frontend effectiveLevel/meetsLevel helpers mirroring backend"
```

---

# Phase 9 — `<UserBadges />` Component

## P9-T1: `<UserBadges />` + tests

**Files:**
- Create: `D:/src/aloevera-harmony-meet/src/components/ui/user-badges.tsx`
- Create: `D:/src/aloevera-harmony-meet/src/components/ui/__tests__/user-badges.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { UserBadges } from '@/components/ui/user-badges';

describe('<UserBadges />', () => {
  it('renders nothing for novice with no staff role', () => {
    const { container } = renderWithProviders(
      <UserBadges rank="novice" staffRole="none" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders rank for activeMember', () => {
    renderWithProviders(<UserBadges rank="activeMember" staffRole="none" />);
    expect(screen.getByText('rank.activeMember')).toBeInTheDocument();
  });

  it('renders both rank and staff role', () => {
    renderWithProviders(<UserBadges rank="aloeCrew" staffRole="admin" />);
    expect(screen.getByText('rank.aloeCrew')).toBeInTheDocument();
    expect(screen.getByText('staffRole.admin')).toBeInTheDocument();
  });

  it('renders only staff when rank is novice but role is moderator', () => {
    renderWithProviders(<UserBadges rank="novice" staffRole="moderator" />);
    expect(screen.queryByText('rank.novice')).not.toBeInTheDocument();
    expect(screen.getByText('staffRole.moderator')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — see fail**

```
npm run test -- --run src/components/ui/__tests__/user-badges.test.tsx
```
Expected: module not found.

- [ ] **Step 3: Write `user-badges.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { UserRank, StaffRole } from '@/types/user';

export interface UserBadgesProps extends React.HTMLAttributes<HTMLDivElement> {
  rank?: UserRank;
  staffRole?: StaffRole;
}

const RANK_DOT: Record<UserRank, string> = {
  novice: 'bg-muted',
  activeMember: 'bg-aloe-sage',
  friendOfAloe: 'bg-aloe-ocean',
  aloeCrew: 'bg-aloe-gold',
};

const STAFF_PILL: Record<Exclude<StaffRole, 'none'>, string> = {
  moderator: 'bg-aloe-lavender',
  admin: 'bg-aloe-flame',
};

export function UserBadges({
  rank = 'novice',
  staffRole = 'none',
  className,
  ...props
}: UserBadgesProps) {
  const { t } = useLanguage();
  const showRank = rank !== 'novice';
  const showStaff = staffRole !== 'none';
  if (!showRank && !showStaff) return null;

  return (
    <div className={cn('inline-flex items-center gap-2 text-xs', className)} {...props}>
      {showRank && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className={cn('h-2 w-2 rounded-full', RANK_DOT[rank])} aria-hidden />
          <span>{t(`rank.${rank}`)}</span>
        </span>
      )}
      {showStaff && (
        <span
          className={cn(
            'uppercase text-[10px] tracking-wide px-1.5 py-0.5 rounded text-white font-semibold',
            STAFF_PILL[staffRole as Exclude<StaffRole, 'none'>],
          )}
        >
          {t(`staffRole.${staffRole}`)}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Tailwind color tokens if not present**

Check `tailwind.config.ts` for `aloe-sage`, `aloe-ocean`, `aloe-gold`, `aloe-lavender`, `aloe-flame`. If any are missing, add to the theme `extend.colors`:

```ts
'aloe-sage': 'hsl(var(--aloe-sage))',
'aloe-ocean': 'hsl(var(--aloe-ocean))',
'aloe-gold': 'hsl(var(--aloe-gold))',
'aloe-lavender': 'hsl(var(--aloe-lavender))',
'aloe-flame': 'hsl(var(--aloe-flame))',
```

And add the `--aloe-*` CSS variables to `src/index.css` if missing. Inspect existing variables in that file; copy the prefix pattern (`--aloe-*`) that other design tokens use.

- [ ] **Step 5: Run + commit**

```bash
npm run test -- --run src/components/ui/__tests__/user-badges.test.tsx
git -C D:/src/aloevera-harmony-meet add src/components/ui/user-badges.tsx src/components/ui/__tests__/user-badges.test.tsx tailwind.config.ts src/index.css
git -C D:/src/aloevera-harmony-meet commit -m "feat(acl): UserBadges component with rank dot + staff role pill"
```

---

# Phase 10 — `<UserBadges />` Placement

## P10-T1: `TopicDetail.tsx` — badges on each reply

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/components/forum/TopicDetail.tsx`

Per spec, badges attach to reply headers only — the original post does not get badges (keeps OP chrome minimal). If product later wants OP badges, the backend would need to surface `authorRank`/`authorStaffRole` on `ForumTopicDto`; that is not done in this plan.

- [ ] **Step 1: Import**

```tsx
import { UserBadges } from '@/components/ui/user-badges';
```

- [ ] **Step 2: Render on each reply (~line 175–195)**

Inside the `topic.replies.map(reply => ...)` block, beside each `AuthorBadge`:

```tsx
<UserBadges rank={reply.authorRank} staffRole={reply.authorStaffRole} />
```

- [ ] **Step 3: Run + commit**

```bash
npm run test
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): UserBadges beside each reply author in TopicDetail"
```

---

## P10-T2: `SettingsPage.tsx` — below display name

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add below line ~210 (`{user.name}, {user.age}`)**

```tsx
<UserBadges rank={user.rank} staffRole={user.staffRole} className="mt-1" />
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): UserBadges under display name on SettingsPage"
```

---

## P10-T3: `Friends.tsx` — swipe card + chat list

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/pages/Friends.tsx`

- [ ] **Step 1: Swipe card (~line 427)**

Below the name line add:

```tsx
<UserBadges rank={currentUser.rank} staffRole={currentUser.staffRole} />
```

- [ ] **Step 2: Chat list (~line 505)**

Below the name line add:

```tsx
<UserBadges rank={chat.otherUser.rank} staffRole={chat.otherUser.staffRole} />
```

Both `currentUser` (the swipe-target profile) and `chat.otherUser` already go through `mapUserFromApi` → include `rank`/`staffRole`.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): UserBadges on Friends swipe card and chat list items"
```

---

# Phase 11 — Frontend Gating UI

## P11-T1: Lock icon + gated toast in `Talks.tsx`

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/pages/Talks.tsx`
- Create: `D:/src/aloevera-harmony-meet/src/hooks/useCurrentUser.tsx`

- [ ] **Step 1: Create `useCurrentUser` hook**

```tsx
import { useEffect, useState } from 'react';
import type { User } from '@/types/user';
import { usersApi } from '@/services/api';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    usersApi.getCurrentUser().then((u) => {
      if (!cancelled) { setUser(u); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { user, loading };
}
```

- [ ] **Step 2: Update `Talks.tsx` section list (lines ~273–291)**

Import:

```tsx
import { Lock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { meetsLevel } from '@/lib/acl';
import { useLanguage } from '@/contexts/LanguageContext';
```

Inside the component, near the top:

```tsx
const { user } = useCurrentUser();
const { t } = useLanguage();
```

In the section `map`, conditionally render the lock:

```tsx
{forumSections.map(section => {
  const allowed = user
    ? meetsLevel(user.rank, user.staffRole, section.minRank)
    : true;
  return (
    <Card
      key={section.id}
      onClick={() => {
        if (!allowed) { toast.error(t('forum.lockedSection')); return; }
        setSelectedSection(section.id);
      }}
      className={!allowed ? 'opacity-60' : undefined}
    >
      <div className="flex items-center gap-2">
        <span>{section.name}</span>
        {!allowed && <Lock className="h-4 w-4" />}
      </div>
      {/* rest of existing card content */}
    </Card>
  );
})}
```

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): lock icon and gated toast on Talks forum sections"
```

---

## P11-T2: Hide reply form in `TopicDetail.tsx` for restricted novices

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/components/forum/TopicDetail.tsx`

- [ ] **Step 1: Gate the reply form (~lines 197–222)**

```tsx
const { user } = useCurrentUser();
const canReply = topic.noviceCanReply || (user && user.rank !== 'novice');
// ...
{canReply ? (
  <form onSubmit={handleSubmit(onSubmit)}>
    {/* existing form JSX */}
  </form>
) : (
  <p className="text-sm text-muted-foreground italic">
    {t('forum.replyRestricted')}
  </p>
)}
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): hide reply form for novices when noviceCanReply is false"
```

---

## P11-T3: `CreateTopicModal` toggles for `noviceVisible` + `noviceCanReply`

**Files:**
- Modify: `D:/src/aloevera-harmony-meet/src/components/forum/CreateTopicModal.tsx`

- [ ] **Step 1: Extend form fields + validators**

Add two checkboxes using shadcn `<Checkbox>` or `<Switch>`. Defaults: both `true`.

```tsx
const [noviceVisible, setNoviceVisible] = useState(true);
const [noviceCanReply, setNoviceCanReply] = useState(true);

// In the form JSX:
<div className="flex items-center gap-2">
  <Switch id="noviceVisible" checked={noviceVisible}
    onCheckedChange={(v) => {
      setNoviceVisible(v);
      if (!v) setNoviceCanReply(false); // hidden topic can't be replied to either
    }}
  />
  <Label htmlFor="noviceVisible">{t('forum.noviceVisible')}</Label>
</div>
<div className="flex items-center gap-2">
  <Switch id="noviceCanReply" checked={noviceCanReply}
    disabled={!noviceVisible}
    onCheckedChange={setNoviceCanReply}
  />
  <Label htmlFor="noviceCanReply">{t('forum.noviceCanReply')}</Label>
</div>
```

- [ ] **Step 2: Pass through to `forumsApi.createTopic`**

Update the call site and the `forumsApi.createTopic` signature to accept `{ noviceVisible?: boolean; noviceCanReply?: boolean }`.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "feat(acl): CreateTopicModal noviceVisible/noviceCanReply toggles"
```

---

# Phase 12 — Documentation

## P12-T1: `docs/ISSUES.md`

- [ ] **Step 1:** Open `D:/src/aloevera-harmony-meet/docs/ISSUES.md`. Mark MCF.12 as *partially resolved — rank & badge system shipped; badges/ranking future work is admin-panel-driven*. Update the active-issue count at the top.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "docs(acl): update ISSUES.md for MCF.12 partial resolution"
```

---

## P12-T2: `docs/FEATURES.md`

- [ ] **Step 1:** Append a new section:

```markdown
## 9. Roles & Ranks

### Ranks (auto-computed)

- **Novice** — default. Baseline permissions.
- **Active Member** — 5 forum replies OR 3 likes received OR 1 event attended.
- **Friend of Aloe** — 25 replies OR 15 likes OR 3 events.
- **Aloe Crew** — 100 replies OR 50 likes OR 10 events OR 10 matches.

Thresholds are stored in the `appconfig` Azure Table and cached for 1 hour.

### Staff Roles (manually assigned)

- `none` — no staff privileges.
- `moderator` — can delete any reply/topic, pin topics, ban users (effective level 4).
- `admin` — can assign staff roles, override ranks, manage events/blog/store (effective level 5).

### Badges

`<UserBadges rank staffRole />` renders a coloured dot + rank name and, when
staff role is set, a coloured pill. Rendered in forum, profile, swipe cards,
and chat list items.

### Gating

Forum sections can set `minRank`; topics can set `noviceVisible=false` (hidden
from novices) and `noviceCanReply=false` (novices see topic but can't reply).
Novice-gated sections show a lock icon.

### Admin endpoints

- `PUT /api/v1/users/{id}/role` — assign staff role (admin)
- `PUT /api/v1/users/{id}/rank-override` — override computed rank (admin)
- `GET /api/v1/admin/config` — read current appconfig values (admin)
```

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "docs(acl): add Roles & Ranks section to FEATURES.md"
```

---

## P12-T3: `docs/ARCHITECTURE.md`

- [ ] **Step 1:** In the Layers section, add "ACL enforcement" as a sub-layer between Controllers and Services. Describe `PermissionGuard`, `RequireStaffRoleAttribute`, `RequirePermissionAttribute`, `IAppConfigService` (cached, singleton, 1-hour TTL), and `RankCalculator` / `EffectiveLevel` helpers.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "docs(acl): describe ACL enforcement layer in ARCHITECTURE.md"
```

---

## P12-T4: `AGENTS.md`

- [ ] **Step 1:** Under *Component patterns*, add `<UserBadges />` to the list with its import path and prop shape. Under *Types*, add `UserRank` and `StaffRole` aliases. Under *State management*, note that `useCurrentUser()` is the canonical way to load the logged-in profile. Under *Backend integration*, note the `appconfig` table and its two partitions.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet commit -am "docs(acl): AGENTS.md updates for UserBadges, rank types, appconfig"
```

---

## P12-T5: `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md`

- [ ] **Step 1:** Update sections:

- **API Endpoints**: Add the three new admin endpoints and the new `PUT /forum/topics/{id}`.
- **Azure Tables**: Add `appconfig` with its two partitions.
- **Services**: Add `IAppConfigService` with its 1-hour cache.
- **Unit tests**: Bump count from 81 to the new total. Rough addition from this plan: +3 (AppConfig) + 7 (EffectiveLevel) + 13 (RankCalculator) + ~3 (service tests) + ~14 (AclTests) + ~6 (admin endpoint tests) ≈ **+46 tests**, so the total becomes **127**.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/lovecraft commit -am "docs(acl): IMPLEMENTATION_SUMMARY reflects new endpoints, table, and tests"
```

---

# Deployment

After all phases are implemented and merged:

1. **Rebuild stack on the VM:**
   ```bash
   cd ~/src/lovecraft && git pull
   cd ~/src/aloevera-harmony-meet && git pull
   cd ~/src/aloevera-harmony-meet && docker compose up -d --build
   ```
2. **Run the seeder** once to create the `appconfig` table and seed defaults:
   ```bash
   cd ~/src/lovecraft/Lovecraft/Lovecraft.Tools.Seeder && dotnet run
   ```
   The seeder wipes existing tables — coordinate with users.
3. **Smoke test:**
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://aloeve.club/api/v1/admin/config
   ```
   Expected: JSON with `rankThresholds` and `permissions` objects.
4. **Update `VM_DEPLOYMENT.md`** with:
   - Note that `appconfig` is now one of the tables created by the seeder.
   - Note the three admin endpoints.
   - Test admin credentials (if seeded with `StaffRole=admin` on a specific user).

---

# Out of Scope (this plan)

- **Admin panel UI (MCF.16)** — role assignment is API-only until the admin panel spec lands.
- **DELETE `/forum/replies/{id}` / `/forum/topics/{id}`** — permission keys exist in config but the endpoints are not wired in this plan (no existing delete endpoints to ACL-enforce; a future spec will add them).
- **Edit-own-reply UI / endpoint** — permission defined; endpoint deferred.
- **Delete-own-chat-message UI / endpoint** — permission defined; deferred.
- **Notification when a user ranks up** — future enhancement.
- **Secret events access control** — separate future spec.
