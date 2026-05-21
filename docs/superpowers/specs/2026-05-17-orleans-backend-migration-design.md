# Orleans Backend Migration — Design Spec

**Date**: 2026-05-17
**Status**: Approved
**Resolves**: Scale-out readiness (multiple silos behind nginx round-robin) + thread-safe per-entity state model + cleaner separation of behavior and storage

---

## Overview

Migrate the LoveCraft .NET 10 backend from the current service-per-table pattern (11 `Mock*Service` / `Azure*Service` implementations behind `IUserService`, `IChatService`, etc.) to a Microsoft Orleans virtual-actor model. Per-entity state lives in grains; the existing entity tables are retained as the storage layer that grains read and write directly. Catalog/list reads continue as direct `TableClient` queries through stateless helpers.

The migration is a **clean break** at the controller boundary (controllers inject `IGrainFactory` and call grains directly — no surviving `IUserService`-style facade), but the rollout lands in six phases with the user table migrated behind a feature flag so the riskiest cutover is reversible without redeploy.

### Why now

- Codebase is still small enough that rewriting tests + service-layer call sites is bounded work (estimated 2–3 weeks of focused effort)
- Already-on-the-roadmap features (notifications, presence, typing indicators, event group chat) all need per-entity coordination that grains express cleanly
- Counter-increment correctness (`ReplyCount`, `LikesReceived`, `EventsAttended`, `MatchCount`) currently relies on a 3× ETag-412 retry loop in `AzureUserService.IncrementCounterAsync`; the grain mailbox eliminates the race entirely

### Why not now (acknowledged trade-off)

- The current architecture is already stateless and horizontally scalable; this migration is preparatory rather than load-driven. We are accepting ~2–3 weeks of migration work against scale-out wins that are most valuable in 6–12 months. The codebase being small is exactly what makes this affordable.

### Success criteria

1. Single backend container scales to ≥3 replicas behind `nginx` round-robin without losing chat messages, forum reply notifications, or grain state across silos
2. Counter increments are correct without retry loops
3. No `MockDataStore` static state; existing 25-test-class suite passes against Orleans `TestCluster` + in-memory `TableClient` stub
4. Test parallelization re-enabled (current `[CollectionBehavior(DisableTestParallelization = true)]` removed)
5. All existing Azure Tables retained (currently 27, including the recently-shipped notifications set); two new tables added by Orleans (`orleansmembership`, `orleansreminders`). Notification grains are out of scope for this migration and tracked as a future phase.

---

## Decisions Log

Four architectural decisions made during brainstorming. Each is recorded with the alternatives considered and the reasoning.

### D1. Clean break at the controller boundary

Controllers inject `IGrainFactory` and call grains directly (`_grainFactory.GetGrain<IUserGrain>(id).GetProfileAsync()`). The current `IUserService` / `IChatService` / `IEventService` / `IForumService` / `IMatchingService` / `IAppConfigService` interfaces are **deleted** during the migration, not kept as facades.

**Alternatives considered:**
- *Strangler-fig (keep interfaces as facades).* Lets us migrate one bounded context at a time and ship between steps. Rejected because the facade layer becomes cruft we'd be obligated to clean up later, and the migration is small enough that the phased approach (below) gives us the same incremental safety without the facade pattern.
- *Hybrid (facade for AuthService, direct grain calls elsewhere).* Rejected for inconsistency.

**Consequence:** Every controller, every test, and every `Mock*Service` consumer changes. The phased migration plan (§ Migration Phases) mitigates the blast radius by ordering changes from low- to high-risk.

### D2. Hybrid persistence — grains for per-entity state, raw tables for catalogs

Per-entity state is owned by grains (`IUserGrain`, `IChatGrain`, `IEventGrain`, `IForumTopicGrain`, `IEventInviteGrain`, `IAppConfigGrain`). Catalog and bulk-query workloads (swipe deck, paginated blog/store/events, admin user list, forum section browse, reverse-lookup indexes) stay as direct `TableClient` queries from stateless helpers.

**Alternatives considered:**
- *Pure Orleans grain persistence via `IPersistentState`.* Rejected because Orleans' default Azure Table grain storage stores grain state as opaque blobs in `orleansgrainstate`, which means a separate denormalized projection table is needed for every grain we want to query (write-amplification + consistency window). The codebase has too many query-style operations (swipe deck shuffle, admin lists, paginated browse) for opaque-blob storage to be a net win.
- *Hydrate grains from existing tables as a write-through cache.* Rejected as duplication of state shape between entity class and grain state class.

**Departure from "via `IPersistentState`":** during brainstorming the chosen option said "grains own state via `IPersistentState`." On detailed review, we are choosing **not** to use `IPersistentState` because Orleans' Azure Table grain storage provider writes opaque blobs that are unqueryable. Grains instead read/write the existing entity tables directly via injected `TableClient`. This preserves queryability (admin lists, swipe deck) without write-amplification. `IPersistentState` is reserved for future grains where state is genuinely opaque (e.g., a hypothetical `IUserPresenceGrain` tracking connection state).

### D3. Co-located silos

Each backend container hosts an Orleans Silo **and** the ASP.NET Core pipeline (controllers + `ChatHub`). Single Dockerfile. To scale, add backend container replicas — they join the cluster via the Azure Table membership provider and load-balance via `nginx`.

**Alternatives considered:**
- *Separated frontend + silo cluster.* Cleaner separation of HTTP and domain concerns, but doubles the deployment surface and is overkill at current scale. Documented as a future option behind narrow controller-to-grain interfaces (already what we have, so the split is a `docker-compose` + `Program.cs` change, not a rewrite).

### D4. Redis backplane for SignalR fan-out across silos

`SignalR.AddStackExchangeRedis()` provides cross-silo message fan-out for `IHubContext.Clients.Group(...).SendAsync(...)` calls. Grains inject `IHubContext<ChatHub>` and call it directly after persisting state.

**Alternatives considered:**
- *Orleans Streams + per-silo `SignalRForwarder` hosted service.* Architecturally aligned with "everything goes through Orleans" but requires custom subscription-lifecycle bookkeeping (~300 LOC of forwarder logic), higher latency (5–20 ms vs ~1 ms), and more bug surface. We may revisit if/when presence + notifications + typing indicators land — at that point Orleans Streams become attractive as a unified pub/sub fabric.
- *Azure SignalR Service (managed backplane).* Zero custom code but per-connection pricing and vendor lock-in. Rejected for cost predictability at scale.

**Trade-off accepted:** Redis is one more infrastructure piece to operate (container, connection string, monitoring). For a solo-developer project, the operational simplicity and battle-tested ecosystem outweigh the architectural cohesion win of Orleans Streams.

---

## Solution Layout

### Projects

| Project | Status | Purpose |
|---|---|---|
| `Lovecraft.Common` | unchanged shape | Controller-facing DTOs, enums, `ApiResponse<T>`, `PagedResult<T>` |
| `Lovecraft.Grains.Abstractions` | **new** | Grain interfaces (`IUserGrain`, `IChatGrain`, ...) — referenced by backend and tests. Separate from `Lovecraft.Common` because grain interfaces are an implementation concern. |
| `Lovecraft.Grains` | **new** | Concrete grain implementations + grain-state classes (each implements `ITableEntity` for direct `TableClient` I/O). Backend-only reference. |
| `Lovecraft.Backend` | shrinks | `Services/` shrinks dramatically. `Services/Azure/`, `Services/Caching/`, `MockData/` deleted. Most `Storage/Entities/` classes move into `Lovecraft.Grains` as grain-state classes. Surviving services: `IAuthService`, `IMatchingService`, `IImageService`, `IUserDirectory`, `IEventCatalog`, `IStoreCatalog`, `IBlogCatalog`, `IForumSectionCatalog`, `IForumTopicCatalog`, `IUserChatsIndex`. |
| `Lovecraft.TelegramBot` | unchanged | Telegram long-poll worker; no Orleans dependency. Talks to backend via HTTP, not grain calls. |
| `Lovecraft.Tools.Seeder` | rewritten | Connects to running silo as Orleans client; seeds catalog tables via `TableClient` directly + entity grains via `IGrainFactory`. |
| `Lovecraft.UnitTests` | tests rewritten | Adds `Orleans.TestingHost` package + `TestSiloFixture` + `InMemoryTableClient` stub. All ~25 test classes converted from `MockDataStore`-based to grain-based. |

### Program.cs silo configuration

```csharp
builder.Host.UseOrleans(siloBuilder =>
{
    var connStr = builder.Configuration["AZURE_STORAGE_CONNECTION_STRING"]!;
    var prefix  = builder.Configuration["AZURE_TABLE_PREFIX"] ?? "";

    siloBuilder
        .UseAzureStorageClustering(opts =>
        {
            opts.ConfigureTableServiceClient(connStr);
            opts.TableName = prefix + "orleansmembership";
        })
        .UseAzureTableReminderService(opts =>
        {
            opts.ConfigureTableServiceClient(connStr);
            opts.TableName = prefix + "orleansreminders";
        })
        .Configure<ClusterOptions>(opts =>
        {
            opts.ClusterId = builder.Configuration["ORLEANS_CLUSTER_ID"] ?? "aloevera-cluster";
            opts.ServiceId = "lovecraft";
        })
        .ConfigureEndpoints(siloPort: 11111, gatewayPort: 30000)
        .UseDashboard(opts => opts.HostSelf = false);
});

builder.Services.AddSignalR()
    .AddStackExchangeRedis(
        builder.Configuration["REDIS_CONNECTION_STRING"]!,
        opts => opts.Configuration.ChannelPrefix = RedisChannel.Literal("lovecraft"));
```

No grain storage provider is registered because grains own their own `TableClient` access (per D2).

### New env vars

| Var | Required | Purpose |
|---|---|---|
| `REDIS_CONNECTION_STRING` | yes (prod + dev) | SignalR backplane |
| `ORLEANS_CLUSTER_ID` | optional | Override cluster ID; defaults to `aloevera-cluster` |
| `AZURE_TABLE_PREFIX` | (existing) | Already honored; extended to also prefix `orleansmembership` |

`USE_AZURE_STORAGE` is **removed** in Phase 6.

### Docker compose changes

**Frontend repo `docker-compose.yml`:**
- Add `redis` service (`image: redis:7-alpine`, no port exposed, internal only)
- `backend` container exposes silo + gateway ports only on the internal Docker network
- `nginx` proxies `/api/`, `/hubs/` → `backend:8080` (round-robin if multiple replicas)

**Frontend repo `docker-compose.dev.yml`:**
- Add `redis` service (same image)
- Add `azurite` service (`image: mcr.microsoft.com/azure-storage/azurite`) for local Azure Tables + Blobs
- Backend env points at `AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;...` (Azurite default)

---

## Grain Catalog

Seven grain types. Six own state-backed-by-table; one (`IUserPairGrain`) is a pure coordinator with no durable state of its own. Grain state IS the existing entity-table row. Grains load on activation via `TableClient` and write on state changes. `IPersistentState` is not used (per D2).

| Grain | Kind | Key |
|---|---|---|
| `IUserGrain` | entity | userId |
| `IChatGrain` | entity | chatId (GUID) |
| `IEventGrain` | entity | eventId |
| `IForumTopicGrain` | entity | topicId |
| `IEventInviteGrain` | entity | normalized invite code |
| `IAppConfigGrain` | singleton | `"app"` |
| `IUserPairGrain` | coordinator (no own storage) | `{min(a,b)}-{max(a,b)}` |

### `IUserGrain`

- **Key:** `string userId` (GUID-as-string)
- **Storage:** `users` table (today's `UserEntity` becomes `UserGrainState : ITableEntity`)
- **State:** Email, EmailVerified, Name, Age, Gender, Bio, Location, ProfileImage, ImagesJson, PromptsJson, PreferencesJson, SettingsJson, FavoriteSongJson, InstagramHandle, PasswordHash, AuthMethodsJson, TelegramUserId, GoogleUserId, StaffRole, RankOverride, ReplyCount, LikesReceived, EventsAttended, MatchCount, RegistrationSourceEventId, RegistrationSourceRedeemedAtUtc, CreatedAt, UpdatedAt

```csharp
public interface IUserGrain : IGrainWithStringKey
{
    Task<UserDto> GetProfileAsync();
    Task<UserDto> UpdateProfileAsync(UpdateUserRequestDto req);
    Task SetProfileImageAsync(string url);
    Task IncrementCounterAsync(UserCounter counter, int delta = 1);    // ReplyCount/LikesReceived/EventsAttended/MatchCount
    Task SetStaffRoleAsync(StaffRole role);
    Task SetRankOverrideAsync(string? rank);                            // null = clear override
    Task AttachAuthMethodAsync(AuthMethod method, string externalId, string? externalEmail);
    Task DetachAuthMethodAsync(AuthMethod method);                      // for "unlink" flows
    Task<bool> VerifyPasswordAsync(string plaintext);                   // returns bool; hash never leaves grain
    Task SetPasswordAsync(string newPlaintext);                         // hashes via injected IPasswordHasher
    Task SetEmailVerifiedAsync(bool verified);
    Task SetRegistrationSourceAsync(string eventId);                    // immutable; throws if already set
    Task<bool> ExistsAsync();                                            // for orchestration code that needs to check before mutating
}
```

**Replaces:** `AzureUserService`, `MockUserService`, `UserCache` singleton, password verification path inside `AzureAuthService`.

**Reminders:** none.

### `IChatGrain`

- **Key:** `string chatId` (GUID — existing chats keep their IDs; backward-compatible with today's data)
- **Storage:** `chats` row + `userchats` rows (one per participant) + `messages` table for history. The grain owns the metadata row + writes to userchats/messages on every send; it does **not** hold the message list in memory.
- **State (loaded into grain):** ParticipantIds, CreatedAtUtc, LastMessageContent (truncated to 200 chars), LastMessageAt, UnreadCountByUserId

```csharp
public interface IChatGrain : IGrainWithStringKey
{
    Task EnsureCreatedAsync(string[] participantUserIds);              // idempotent; persists chats + userchats rows on first call
    Task<MessageDto> SendMessageAsync(string senderId, string content, string[] imageUrls);
    Task<List<MessageDto>> GetMessagesAsync(int page, int pageSize);
    Task<ChatDto> GetMetadataAsync();
    Task MarkReadAsync(string userId);
}
```

**Replaces:** `AzureChatService`, `MockChatService`.

**Chat discovery (replaces `GetOrCreateChatAsync`):** because chatIds are GUIDs (not derivable from user IDs), `IMatchingService` cannot generate the chatId itself — concurrent mutual-like detections would each generate a different GUID for the same pair and produce duplicate chats (the `IChatGrain.EnsureCreatedAsync` mailbox only serializes calls to the same key). Discovery is therefore routed through a dedicated per-pair coordinator grain `IUserPairGrain` (see § `IUserPairGrain` below), which serializes by deterministic pair key and returns a stable chatId.

**Real-time:** `SendMessageAsync` persists to `messages` table → updates `userchats` rows → mutates grain state → calls `_hubContext.Clients.Group($"chat-{id}").SendAsync("MessageReceived", dto)`. Redis backplane fans the SignalR call out to all silos.

### `IEventGrain`

- **Key:** `string eventId`
- **Storage:** `events` row + `eventattendees` (rows under PK=eventId) + `eventinterested` (rows under PK=eventId)
- **State:** all `EventEntity` fields + `Attendees: HashSet<string>` + `Interested: HashSet<string>`

```csharp
public interface IEventGrain : IGrainWithStringKey
{
    Task<EventDto> GetAsync(string? viewerId, string? inviteCode);     // visibility-filtered; validates code
    Task<EventDto> UpdateAsync(UpdateEventRequestDto req);              // admin
    Task RegisterAsync(string userId, string? inviteCode);              // calls IEventInviteGrain.ClaimForEventAttendanceAsync
    Task UnregisterAsync(string userId);
    Task SetInterestedAsync(string userId, bool interested);
    Task ArchiveAsync(bool archived);
    Task SetForumTopicIdAsync(string topicId);                          // for the auto-created public discussion thread
}
```

**Replaces:** `AzureEventService`, `MockEventService` (+ caching variant).

### `IForumTopicGrain`

- **Key:** `string topicId`
- **Storage:** `forumtopics` row + `forumtopicindex` row + `forumreplies` table for history
- **State:** SectionId, Title, Content, AuthorId, AuthorName, IsPinned, IsLocked, ReplyCount (denormalized), LastReplyAtUtc, MinRank, NoviceVisible, NoviceCanReply, EventId, EventTopicVisibility, AllowedUserIds

```csharp
public interface IForumTopicGrain : IGrainWithStringKey
{
    Task<ForumReplyDto> AddReplyAsync(string authorId, string content, string[] imageUrls);
    Task<List<ForumReplyDto>> GetRepliesAsync(int page, int pageSize);
    Task<ForumTopicDto> GetAsync();
    Task<ForumTopicDto> UpdateAsync(UpdateTopicRequestDto req, string callerUserId, StaffRole callerStaffRole);
    Task DeleteReplyAsync(string replyId, string callerUserId, StaffRole callerStaffRole);
}
```

**Replaces:** `AzureForumService` (topic + reply portions). Section listing, topic listing, event-discussion summary, event-discussion topics — all stay as table queries in `IForumSectionCatalog` / `IForumTopicCatalog`.

**Real-time:** `AddReplyAsync` calls `_hubContext.Clients.Group($"topic-{id}").SendAsync("ReplyPosted", dto, id)`.

### `IUserPairGrain`

- **Key:** `string pairKey` = `{min(userA, userB)}-{max(userA, userB)}` (sorted lexicographically for determinism)
- **Storage:** none (no persistent state of its own). On activation, queries `userchats` to learn whether a chatId already exists for the pair.
- **State (in-memory only):** `ChatId: string?` — null until the first call mints one
- **Purpose:** serialize chat lookup/creation per user-pair, eliminating the duplicate-chat race when two mutual likes arrive concurrently. Without this grain, `IMatchingService` would generate independent GUIDs for the two concurrent calls and `IChatGrain.EnsureCreatedAsync` would happily persist both (different grain keys → no mailbox coordination).

```csharp
public interface IUserPairGrain : IGrainWithStringKey
{
    Task<string> GetOrCreateChatIdAsync(string userA, string userB);
}

// Implementation sketch:
public class UserPairGrain : Grain, IUserPairGrain
{
    private string? _chatId;
    private readonly IUserChatsIndex _index;
    private readonly IGrainFactory _grainFactory;

    public override async Task OnActivateAsync(CancellationToken ct)
    {
        var (a, b) = ParsePairKey(this.GetPrimaryKeyString());
        _chatId = await _index.FindChatBetweenAsync(a, b);   // null if no existing chat
    }

    public async Task<string> GetOrCreateChatIdAsync(string a, string b)
    {
        AssertPairMatchesKey(a, b);
        if (_chatId is not null) return _chatId;

        var newId = Guid.NewGuid().ToString();
        await _grainFactory.GetGrain<IChatGrain>(newId).EnsureCreatedAsync(new[] { a, b });
        _chatId = newId;
        return _chatId;
    }
}
```

**Why this is race-free:** both concurrent `IMatchingService` calls compute the same `pairKey` from `(userA, userB)`, route to the same `IUserPairGrain` instance, and serialize through its mailbox. The first call mints a GUID + activates the `IChatGrain`; the second call observes the cached `_chatId` and returns it.

**Backward compatibility:** existing chats already have GUIDs in `chats`/`userchats`. On first activation for a legacy pair, `OnActivateAsync` loads the existing GUID via `IUserChatsIndex.FindChatBetweenAsync`. No data migration needed.

**No persistent state required:** the chat row + userchats rows persisted by `IChatGrain.EnsureCreatedAsync` *are* the durable record. If the pair grain deactivates and re-activates, `OnActivateAsync`'s lookup finds the rows and recovers `_chatId`.

**Replaces:** the today's `IChatService.GetOrCreateChatAsync` idempotent lookup, with grain-mailbox-based race protection in place of the table-ETag dance.

### `IEventInviteGrain`

- **Key:** `string normalizedCode` (uppercase, trimmed)
- **Storage:** `eventinvites` row
- **State:** EventId (or negative for campaign), CampaignLabel, PlainCode, ExpiresAtUtc, Revoked, CreatedAtUtc, RegistrationCount, EventAttendanceClaimCount

```csharp
public interface IEventInviteGrain : IGrainWithStringKey
{
    Task<InviteValidationResult> ValidateAsync();                       // for ?code= event view
    Task ClaimForRegistrationAsync(string newUserId);                   // throws on revoked/expired
    Task ClaimForEventAttendanceAsync(string userId, string eventId);   // throws on mismatched event / revoked / expired
    Task RevokeAsync();
    Task RotateAsync(DateTime expiresAtUtc, string? plainCode);         // admin; revokes self + creates a new grain
}
```

**Replaces:** `AzureEventInviteService`, `MockEventInviteService`.

### `IAppConfigGrain`

- **Key:** singleton `"app"`
- **Storage:** `appconfig` table (rank_thresholds + permissions + registration partitions)
- **State:** `RankThresholds`, `PermissionConfig`, `RegistrationConfig { RequireEventInvite: bool }`

```csharp
public interface IAppConfigGrain : IGrainWithStringKey
{
    Task<RankThresholds> GetRankThresholdsAsync();
    Task<PermissionConfig> GetPermissionsAsync();
    Task<bool> GetRequireEventInviteAsync();
    Task<AppConfigSnapshot> GetSnapshotAsync();                          // bundle for admin /admin/config endpoint
    Task ReloadAsync();                                                  // forced re-read
}
```

**Replaces:** `AzureAppConfigService` + `IMemoryCache` wrapper.

**Reminders:** registers a `"reload"` reminder on activation, period 1 hour, to re-read the `appconfig` table. Replaces today's 1-hour `IMemoryCache` TTL.

---

## Stateless Services

What survives as plain services injected into controllers (not facades over grains — these are genuine orchestrators of cross-grain or non-grain operations):

| Service | Purpose | Talks to |
|---|---|---|
| `IAuthService` | register / login / refresh / Google / Telegram / Mini App / attach-email orchestration | Reverse-lookup indexes (`useremailindex`, `usertelegramindex`, `usergoogleindex`), token tables (`refreshtokens`, `authtokens`), `IUserGrain` for user mutation, `IPasswordHasher`, `IJwtService`, `IEmailService` |
| `IMatchingService` | Send like + mutual-match detection | `likes` / `likesreceived` / `matches` tables, `IUserGrain.IncrementCounterAsync`, `IChatGrain.EnsureCreatedAsync` |
| `IImageService` | Profile image upload + content image upload + external CDN download | `BlobClient` (`profile-images` / `content-images` containers) |
| `IUserDirectory` | `GET /users` swipe deck + admin user list | `users` table (Fisher-Yates shuffle in-helper, paginated reads) |
| `IEventCatalog` | `GET /events` list view | `events` table (visibility filter via existing `EventForumAccess` helper) |
| `IStoreCatalog` | `GET /store` | `storeitems` table |
| `IBlogCatalog` | `GET /blog` | `blogposts` table |
| `IForumSectionCatalog` | `GET /forum/sections` | `forumsections` table |
| `IForumTopicCatalog` | `GET /forum/sections/{id}/topics`, event-discussion summary + per-event topic list | `forumtopics` table (filtered by visibility helpers) |
| `IUserChatsIndex` | `GET /chats` per-user chat list + `FindChatBetweenAsync(a, b)` for `IMatchingService` | `userchats` table (written by `IChatGrain.SendMessageAsync`) |
| `IEventInviteCatalog` | Admin invite-listing pages | `eventinvites` table |

**ACL helpers** (`PermissionGuard`, `RequireStaffRoleAttribute`, `RequirePermissionAttribute`, `EffectiveLevel`, `RankCalculator`, `EventForumAccess`, `EventTopicAccess`, `HtmlGuard`) — unchanged in spirit. Filters now call `IGrainFactory.GetGrain<IUserGrain>(callerId).GetProfileAsync()` and `IGrainFactory.GetGrain<IAppConfigGrain>("app").GetPermissionsAsync()` instead of `IUserService` + `IAppConfigService`.

---

## Persistence Model

### Tables retained (all existing) + 2 new

**Per-entity (owned by grains, queried by catalogs):**
- `users` — `IUserGrain` reads/writes; `IUserDirectory` queries
- `events`, `eventattendees`, `eventinterested` — `IEventGrain` reads/writes; `IEventCatalog` queries `events`
- `eventinvites` — `IEventInviteGrain` reads/writes; `IEventInviteCatalog` queries
- `chats`, `userchats`, `messages` — `IChatGrain` reads/writes; `IUserChatsIndex` queries `userchats`
- `forumtopics`, `forumtopicindex`, `forumreplies` — `IForumTopicGrain` reads/writes; `IForumTopicCatalog` queries `forumtopics`
- `appconfig` — `IAppConfigGrain` reads

**Catalogs (read-mostly, no grain):**
- `forumsections`, `storeitems`, `blogposts` — written by `Lovecraft.Tools.Seeder` and admin endpoints; read by catalog helpers

**Indexes + tokens + edges (owned by stateless services):**
- `useremailindex`, `usertelegramindex`, `usergoogleindex` — `IAuthService`
- `refreshtokens`, `authtokens` — `IAuthService`
- `likes`, `likesreceived`, `matches` — `IMatchingService`

**New:**
- `orleansmembership` — Orleans clustering membership (Azure Table membership provider)
- `orleansreminders` — Orleans Reminders state (used by `IAppConfigGrain`'s 1-hour reload reminder)

### Why likes/matches don't go on `IUserGrain`

A popular user can easily accumulate thousands of likes received. Loading all of them on every grain activation is wasteful. The `LikesReceived: int` counter stays on `IUserGrain`; the actual edge rows stay in `likes` / `likesreceived` tables, queried by `IMatchingService` and the matching endpoints.

### Concurrency model

Orleans grains are **non-reentrant by default**. One method at a time per grain instance. This eliminates several current correctness concerns:

| Today | After migration |
|---|---|
| `AzureUserService.IncrementCounterAsync` retries 3× on ETag 412 | Grain mailbox serializes; no retries needed |
| Concurrent `RegisterForEvent` races could double-claim an invite if ETag retry fails | `IEventInviteGrain.ClaimForEventAttendanceAsync` serializes; invariant is local |
| Mutual-like detection races could create duplicate `matches` rows | Same — but matches are still in tables; `IMatchingService` uses idempotent upsert + counters via grains |

`[CollectionBehavior(DisableTestParallelization = true)]` in `AssemblyInfo.cs` is removed in Phase 6 — each test cluster is isolated.

### Entity classes — what moves where

Existing entity classes in `Lovecraft.Backend/Storage/Entities/`:

| Class | Fate |
|---|---|
| `UserEntity` | Renamed to `UserGrainState` (still `ITableEntity`); moves to `Lovecraft.Grains`. PK/RK semantics unchanged. |
| `EventEntity` | → `EventGrainState`, moves to `Lovecraft.Grains` |
| `ChatEntity` | → `ChatGrainState`, moves to `Lovecraft.Grains` |
| `ForumTopicEntity` | → `ForumTopicGrainState`, moves to `Lovecraft.Grains` |
| `EventInviteEntity` | → `EventInviteGrainState`, moves to `Lovecraft.Grains` |
| `AppConfigEntity` | → `AppConfigRowEntity` (single-row representation; grain composes the `AppConfigState` snapshot from multiple rows), stays in backend |
| `UserEmailIndexEntity`, `UserTelegramIndexEntity`, `UserGoogleIndexEntity` | Unchanged; used by `IAuthService` |
| `RefreshTokenEntity`, `AuthTokenEntity` | Unchanged; used by `IAuthService` |
| `LikeEntity`, `LikeReceivedEntity`, `MatchEntity` | Unchanged; used by `IMatchingService` |
| `EventAttendeeEntity`, `EventInterestedEntity` | Unchanged; used by `IEventGrain` via `TableClient` |
| `MessageEntity` | Unchanged; used by `IChatGrain` |
| `ForumReplyEntity` | Unchanged; used by `IForumTopicGrain` |
| `UserChatEntity`, `ForumTopicIndexEntity` | Unchanged; used by `IUserChatsIndex` / `IForumTopicGrain` |
| `StoreItemEntity`, `BlogPostEntity`, `ForumSectionEntity` | Unchanged; used by catalog helpers |

---

## Data Flow (representative)

### Login

```
POST /auth/login {email, password}
  AuthController.Login
    IAuthService.LoginAsync(email, password)
      • TableClient: useremailindex[email] → userId
      • IGrainFactory.GetGrain<IUserGrain>(userId).VerifyPasswordAsync(password)
      • IGrainFactory.GetGrain<IUserGrain>(userId).GetProfileAsync()   // for staffRole, rank
      • IJwtService.GenerateAccessToken(userDto)
      • TableClient: refreshtokens upsert (rotation chain)
    → AuthResponseDto
```

### Send chat message

```
POST /chats/{id}/messages {content, imageUrls}
  ChatsController.SendMessage
    IGrainFactory.GetGrain<IChatGrain>(chatId).SendMessageAsync(senderId, content, imageUrls)
      [grain]
      • assert senderId ∈ State.Participants
      • TableClient: write messages row (PK=chatId, RK=invertedTicks_msgId)
      • TableClient: update userchats rows for each participant
      • mutate State (LastMessage*, UnreadCountByUserId)
      • _hubContext.Clients.Group($"chat-{id}").SendAsync("MessageReceived", dto)
        — Redis backplane fans out to all silos
      → MessageDto
```

### Register for event (three-grain coordination)

```
POST /events/{id}/register {inviteCode}
  EventsController.Register
    IGrainFactory.GetGrain<IEventGrain>(eventId).RegisterAsync(userId, code)
      [grain]
      • IGrainFactory.GetGrain<IEventInviteGrain>(normalized(code))
          .ClaimForEventAttendanceAsync(userId, eventId)
            → throws InvalidInviteCode / InviteRequired / InviteRevoked / InviteExpired
      • TableClient: eventattendees upsert
      • mutate State.Attendees
      • IGrainFactory.GetGrain<IUserGrain>(userId).IncrementCounterAsync(UserCounter.EventsAttended)
```

### Mutual like (counters via grains, edges in tables)

```
POST /matching/likes {toUserId}
  MatchingController.CreateLike
    IMatchingService.CreateLikeAsync(fromUserId, toUserId)
      • TableClient: likes + likesreceived upsert
      • TableClient: query reverse like
        → if mutual:
          • TableClient: matches upsert
          • pairKey = $"{min(fromUserId, toUserId)}-{max(fromUserId, toUserId)}"
          • chatId = await IGrainFactory.GetGrain<IUserPairGrain>(pairKey)
                       .GetOrCreateChatIdAsync(fromUserId, toUserId)
            — pair grain serializes; returns existing chatId or mints a new GUID and
              calls IChatGrain.EnsureCreatedAsync exactly once
          • IGrainFactory.GetGrain<IUserGrain>(fromUserId).IncrementCounterAsync(MatchCount)
          • IGrainFactory.GetGrain<IUserGrain>(toUserId).IncrementCounterAsync(MatchCount)
        → IGrainFactory.GetGrain<IUserGrain>(toUserId).IncrementCounterAsync(LikesReceived)
```

### List events (catalog read — no grain)

```
GET /events
  EventsController.GetEvents
    IEventCatalog.GetEventsAsync(viewerId, skip, take)
      • TableClient query: events table (PK="EVENTS")
      • Visibility filter (existing EventForumAccess helper)
      → List<EventDto>
```

### ACL filter

`[RequireStaffRole]` and `[RequirePermission]` call:
```
IGrainFactory.GetGrain<IUserGrain>(callerId).GetProfileAsync()       // staffRole, rank
IGrainFactory.GetGrain<IAppConfigGrain>("app").GetPermissionsAsync() // for [RequirePermission]
```

Both grains stay activated under load (idle eviction ~2 min); near-zero cost on hot path.

---

## Real-Time Path

### Single-silo (today / dev)

`IChatGrain.SendMessageAsync` calls `_hubContext.Clients.Group("chat-{id}").SendAsync(...)`. Local hub fans out to local connections. Identical to today's behavior.

### Multi-silo (production scale-out)

`IChatGrain` lives on some silo (placement decided by Orleans). The grain calls `_hubContext.Clients.Group(...).SendAsync(...)` — `AddStackExchangeRedis()` intercepts the call, publishes to a Redis channel. All silos subscribe to that channel and locally re-broadcast to their connections. Net: every connected client in group `chat-{id}` receives the message, regardless of which silo it's connected to.

### SignalR client connection lifecycle

Unchanged from today:
- Client connects to `/hubs/chat?access_token=<jwt>`
- `JwtBearerEvents.OnMessageReceived` reads token from query string
- On connect, client calls `JoinChat(chatId)` / `JoinTopic(topicId)` hub methods (still on the hub, still validates via grain calls: `IGrainFactory.GetGrain<IChatGrain>(chatId).GetMetadataAsync()` → check participant membership)
- `ChatHub.SendMessage` hub method becomes a thin wrapper: `await _grainFactory.GetGrain<IChatGrain>(chatId).SendMessageAsync(...)` (or removed; the REST path is preferred)

### Forum reply broadcast

`IForumTopicGrain.AddReplyAsync` calls `_hubContext.Clients.Group("topic-{id}").SendAsync("ReplyPosted", dto, id)`. Redis fans out across silos. Frontend `useChatSignalR('topic', topicId)` hook subscribes locally on the silo it's connected to.

---

## Dev Mode & Testing

### Production / dev

- `docker-compose.yml` (prod): adds `redis` service; Azure Storage stays Azure
- `docker-compose.dev.yml`: adds `redis` + `azurite` services; backend env points at Azurite connection string
- Backend `.env`: requires `AZURE_STORAGE_CONNECTION_STRING` + `REDIS_CONNECTION_STRING`
- `USE_AZURE_STORAGE=false` mock branch is **removed** in Phase 6

### Tests — three layers

**1. Grain unit tests (most tests).** xUnit `IClassFixture<TestSiloFixture>`. The fixture:
- Spins up `Orleans.TestingHost.TestCluster` with `UseLocalhostClustering()`
- Registers in-memory `TableClient` stub (`Lovecraft.UnitTests/Infrastructure/InMemoryTableClient.cs`) — implements the ~12 `TableClient` methods this codebase uses (`GetEntityAsync`, `UpsertEntityAsync`, `DeleteEntityAsync`, `QueryAsync`, ETag handling)
- Registers in-memory `IHubContext<ChatHub>` stub that captures broadcasts for assertion
- No Redis required for single-silo tests
- Per-test reset via `Reset()` method on the stubs
- Startup ~1 s shared across all tests in the fixture; individual test ~10–50 ms

**2. Integration tests.** `WebApplicationFactory<Program>` wired with `TestCluster` — replaces today's pattern in `AclTests`. End-to-end controller → grain → in-memory storage. Existing `TestAuthHandler.cs` for JWT claim injection survives.

**3. Multi-silo fan-out test.** One dedicated test class `MultiSiloFanOutTests` spins up a 2-silo `TestCluster` + a Redis testcontainer (`Testcontainers.Redis`) to verify cross-silo SignalR fan-out. Slower (~5 s startup) — runs in CI but not in fast-feedback inner loop.

### Test conversion pattern

| Today | Migrated |
|---|---|
| `new MockUserService(MockDataStore.Instance).GetUserByIdAsync("u1")` | `cluster.GrainFactory.GetGrain<IUserGrain>("u1").GetProfileAsync()` |
| `MockDataStore.Users["u1"].StaffRole = "admin"` | `cluster.GrainFactory.GetGrain<IUserGrain>("u1").SetStaffRoleAsync(StaffRole.Admin)` |
| `[CollectionBehavior(DisableTestParallelization = true)]` | Removed |

All ~25 test classes are converted as part of the phase that touches their corresponding grain. Estimated effort is mechanical 1:1 line-count.

### New test infrastructure files

- `Lovecraft.UnitTests/Infrastructure/InMemoryTableClient.cs`
- `Lovecraft.UnitTests/Infrastructure/InMemoryHubContext.cs`
- `Lovecraft.UnitTests/Infrastructure/TestSiloFixture.cs`
- `Lovecraft.UnitTests/Infrastructure/MultiSiloTestClusterFactory.cs` (for `MultiSiloFanOutTests`)

---

## Migration Phases

Each phase ships independently to production.

### Phase 0 — Orleans infrastructure (no grains)

- Add NuGet refs: `Microsoft.Orleans.Server`, `Microsoft.Orleans.Clustering.AzureStorage`, `Microsoft.Orleans.Reminders.AzureStorage`, `Microsoft.AspNetCore.SignalR.StackExchangeRedis`
- Wire `Host.UseOrleans(...)` + Redis SignalR backplane in `Program.cs`
- Add `Lovecraft.Grains.Abstractions` + `Lovecraft.Grains` projects with a smoke-test `IPingGrain`
- Add `Orleans.TestingHost` + `TestSiloFixture` + `InMemoryTableClient` to `Lovecraft.UnitTests`
- Smoke test: `PingGrain_RoundTrips`
- Add `redis` to both `docker-compose.yml` and `docker-compose.dev.yml`; add `azurite` to dev
- All existing services + tests still pass; nothing replaced

**Ships:** Orleans cluster live, processing zero traffic. Validates clustering, Redis backplane, membership table creation, dev compose.

**Risk:** low. Rollback = revert PR.

### Phase 1 — `IAppConfigGrain`

- Implement grain + state class
- Wire DI: remove `IAppConfigService` registration, add `IAppConfigGrain` usage in `RankCalculator`, `RequirePermissionAttribute`, `AdminController.GetConfig`
- Convert `AppConfigServiceTests` → `AppConfigGrainTests`
- Delete `AzureAppConfigService`, `IAppConfigService`

**Ships:** appconfig reads go through the grain, including in `[RequirePermission]` filter.

**Risk:** low. Singleton grain, no hot data path, replacement is straightforward.

### Phase 2 — `IUserGrain` (highest blast radius)

- Implement grain + `UserGrainState : ITableEntity`
- Implement `IUserDirectory` stateless helper (swipe deck, admin list, with Fisher-Yates shuffle)
- Update controllers: `UsersController`, `MatchingController` (for counter increments), `ACL filters`
- Split `AzureAuthService` → stateless `IAuthService`:
  - Token-table + index operations stay in service
  - User lookup/mutate calls `IUserGrain`
- Add feature flag `AppRuntime.UseUserGrain` (env: `USE_USER_GRAIN=true|false`)
- Convert tests: `AuthenticationTests`, `RefreshTokenTests`, `AzureUserServiceTests`, `UserCacheTests`, `UsersControllerUpdateTests` → grain-based equivalents
- Delete `AzureUserService`, `MockUserService`, `UserCache`, `IUserService`
- Initial production deploy with `USE_USER_GRAIN=false` (no behavior change), then flip after load-test in staging

**Ships:** all user-touching code paths go through `IUserGrain` after flag flip.

**Risk:** **high.** Feature flag is the safety net — flip back without redeploy if a perf or correctness issue surfaces. Flag deleted in a follow-up commit once stable for ≥1 week.

### Phase 3 — `IEventGrain` + `IEventInviteGrain`

- Implement both grains + state classes
- Implement `IEventCatalog`, `IEventInviteCatalog` stateless helpers
- Update controllers: `EventsController`, `AdminController` (event editor, invite admin actions)
- Convert tests: `EventInviteServiceTests`, `EventTopicAccessTests` (partial — also covers `IForumTopicGrain` later) → grain-based
- Delete `AzureEventService`, `MockEventService`, `AzureEventInviteService`, `MockEventInviteService`, `IEventService`, `IEventInviteService`

**Risk:** medium. Tight coupling between event registration and invite claim makes both grains best done together.

### Phase 4 — `IForumTopicGrain`

- Implement grain + `ForumTopicGrainState`
- Implement `IForumSectionCatalog`, `IForumTopicCatalog`
- Wire `ReplyPosted` SignalR broadcast through grain → `IHubContext` → Redis
- Update `ForumController`, `AdminController` forum-topic actions
- Convert `ForumTests`, finish `EventTopicAccessTests` conversion
- Delete `AzureForumService`, `MockForumService`, `IForumService` (+ caching variant)

**Risk:** medium. Real-time broadcast path is new on this grain but already validated on chat (well, on `IPingGrain` smoke + general Redis backplane health).

### Phase 5 — `IChatGrain` + `IUserPairGrain`

- Implement `IChatGrain` + `ChatGrainState`
- Implement `IUserPairGrain` (no own storage; lookup via `IUserChatsIndex` on activation)
- Implement `IUserChatsIndex` stateless helper (`GetChatsForUserAsync` + `FindChatBetweenAsync`)
- `ChatsController` becomes a thin grain-call wrapper
- `ChatHub.SendMessage` (the SignalR-direct hub method) calls `IChatGrain.SendMessageAsync`
- Update `IMatchingService` to use `IUserPairGrain.GetOrCreateChatIdAsync` for chat discovery on mutual likes
- Convert `ChatTests`
- Add `MultiSiloFanOutTests`
- Add `UserPairGrainTests` (concurrency: 100 parallel `GetOrCreateChatIdAsync` calls for same pair must return same chatId)
- Delete `AzureChatService`, `MockChatService`, `IChatService`

**Risk:** medium-high. Real-time correctness across silos is the hardest to retrofit. Feature flag (`USE_CHAT_GRAIN`) for the fan-out path is optional but recommended.

### Phase 6 — Cleanup

- Delete `MockDataStore`, all `Mock*Service.cs` files
- Delete unused entity classes (those that became grain state)
- Drop `USE_AZURE_STORAGE` env var branching
- Remove `[CollectionBehavior(DisableTestParallelization = true)]`
- Update `Lovecraft.Tools.Seeder` final form (Orleans client + table writer)
- Remove feature flags from Phase 2 + Phase 5
- Update docs:
  - `Lovecraft/docs/ARCHITECTURE.md` (rewrite layer diagram)
  - `Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` (new grain section)
  - `Lovecraft/docs/DOCKER.md` (Redis + Azurite for dev)
  - `Lovecraft/docs/AZURE_STORAGE.md` (add `orleansmembership`)
  - `aloevera-harmony-meet/AGENTS.md` and the memory entry `MEMORY.md`

### Timeline

| Phase | Effort | Risk | Feature flag |
|---|---|---|---|
| 0 — Infrastructure | 1–2 days | low | — |
| 1 — AppConfigGrain | 1 day | low | no |
| 2 — UserGrain | 4–6 days | high | yes (`USE_USER_GRAIN`) |
| 3 — Event + EventInvite | 3–4 days | medium | optional |
| 4 — ForumTopic | 2–3 days | medium | optional |
| 5 — Chat | 3–4 days | medium-high | optional (`USE_CHAT_GRAIN`) |
| 6 — Cleanup | 1 day | low | — |

Total: 2–3 weeks of focused work.

---

## Risks & Mitigations

### Grain activation storm on cold start

After a silo restart, the first request to each grain key triggers an activation — a TableClient read. Under a flood of requests for many distinct keys, this could spike Azure Tables read latency.

**Mitigation:** Orleans caches activated grains for 2 minutes idle by default. Steady state is fine. For controlled rollouts, the first deploy with `USE_USER_GRAIN=true` should happen during a low-traffic window.

### Reentrancy + deadlocks

Default non-reentrant grains can deadlock if grain A calls grain B which calls back into A. The data-flow patterns above don't have this — calls go one-way (e.g., `IEventGrain.RegisterAsync` → `IEventInviteGrain.ClaimForEventAttendance` → `IUserGrain.IncrementCounterAsync`, never back). The implementation will assert no callbacks.

**Mitigation:** code review for grain-to-grain call graphs. If a legitimate reentrant need arises (e.g., `IAppConfigGrain` reads its own snapshot during a permission check from another grain), use `[Reentrant]` on the read method.

### Redis as a new SPOF

If Redis is down, SignalR backplane fails. ASP.NET Core SignalR + StackExchangeRedis behaviour: messages within a single silo still deliver locally; cross-silo fan-out fails until Redis is back. Real-time chat partially degrades but doesn't outright break.

**Mitigation:** monitor Redis container health; document in `docs/DOCKER.md`. Future option: switch to managed Azure Cache for Redis with availability SLA.

### Counter races during transition (Phase 2)

While `USE_USER_GRAIN=false`, the old `AzureUserService.IncrementCounterAsync` (with 3× ETag retry) and the new `IUserGrain.IncrementCounterAsync` (grain mailbox) coexist briefly. If both code paths run concurrently against the same user, races can re-emerge.

**Mitigation:** the flag is global, not per-request. Either all writes go through the grain, or none do. The flag flip is atomic from the application's perspective.

### TestCluster startup cost

Spinning up a `TestCluster` per test class is ~1 s. For ~25 test classes, total test-suite time grows.

**Mitigation:** `IClassFixture<TestSiloFixture>` shares one cluster per test class; `Reset()` method clears in-memory stub state between tests. CI total test-suite time: estimated ~30 s (versus current ~10 s, but the parallelism enabled by removing `DisableTestParallelization` may offset this).

### Multi-silo development friction

When developing locally, spinning up 2+ silos to test fan-out is annoying. Single-silo dev hides multi-silo bugs.

**Mitigation:** `MultiSiloFanOutTests` exists specifically to catch them in CI without requiring multi-silo local dev.

---

## Files Changed / Added / Deleted (summary)

### Added

- `Lovecraft.Grains.Abstractions/` (project) — grain interfaces
- `Lovecraft.Grains/` (project) — grain implementations + state classes
- `Lovecraft.Backend/Services/IUserDirectory.cs`, `IEventCatalog.cs`, `IStoreCatalog.cs`, `IBlogCatalog.cs`, `IForumSectionCatalog.cs`, `IForumTopicCatalog.cs`, `IUserChatsIndex.cs`, `IEventInviteCatalog.cs` (stateless helpers)
- `Lovecraft.Backend/Storage/TableNames.cs` — add `OrleansMembership` constant
- `Lovecraft.UnitTests/Infrastructure/InMemoryTableClient.cs`, `InMemoryHubContext.cs`, `TestSiloFixture.cs`, `MultiSiloTestClusterFactory.cs`
- `aloevera-harmony-meet/docker-compose.yml` — `redis` service
- `aloevera-harmony-meet/docker-compose.dev.yml` — `redis` + `azurite` services

### Modified

- `Lovecraft.Backend/Program.cs` — `Host.UseOrleans(...)` + `AddStackExchangeRedis`
- `Lovecraft.Backend/Controllers/V1/*` — all controllers swap service calls for `IGrainFactory` calls
- `Lovecraft.Backend/Attributes/RequireStaffRoleAttribute.cs`, `RequirePermissionAttribute.cs` — call `IUserGrain` + `IAppConfigGrain`
- `Lovecraft.Backend/Helpers/PermissionGuard.cs`, `RankCalculator.cs` — accept grain factory or DTO with rank pre-computed
- `Lovecraft.Backend/Services/IAuthService.cs` + impl — stateless, calls `IUserGrain` + tables
- `Lovecraft.Backend/Services/IMatchingService.cs` + impl — stateless, calls `IUserGrain` + `IChatGrain` + tables
- `Lovecraft.Backend/Services/IImageService.cs` + impl — unchanged shape
- `Lovecraft.UnitTests/*` — all ~25 test classes converted

### Deleted

- `Lovecraft.Backend/Services/IUserService.cs`, `IEventService.cs`, `IChatService.cs`, `IForumService.cs`, `IEventInviteService.cs`, `IAppConfigService.cs` (interfaces)
- `Lovecraft.Backend/Services/Azure/AzureUserService.cs`, `AzureEventService.cs`, `AzureChatService.cs`, `AzureForumService.cs`, `AzureEventInviteService.cs`, `AzureAppConfigService.cs`
- `Lovecraft.Backend/Services/Caching/UserCache.cs`, `CachingEventService.cs`, `CachingStoreService.cs`, `CachingBlogService.cs`, `CachingForumService.cs`
- `Lovecraft.Backend/Services/MockUserService.cs`, `MockEventService.cs`, `MockChatService.cs`, `MockForumService.cs`, `MockEventInviteService.cs`, `MockAppConfigService.cs`
- `Lovecraft.Backend/MockData/MockDataStore.cs`
- `Lovecraft.Backend/Storage/Entities/UserEntity.cs`, `EventEntity.cs`, `ChatEntity.cs`, `ForumTopicEntity.cs`, `EventInviteEntity.cs` (replaced by grain state classes in `Lovecraft.Grains`)
- `Lovecraft.UnitTests/AssemblyInfo.cs` `[CollectionBehavior(DisableTestParallelization = true)]` line

---

## References

- Microsoft Orleans docs: https://learn.microsoft.com/dotnet/orleans/
- Orleans Azure Table clustering: `Microsoft.Orleans.Clustering.AzureStorage`
- Orleans Azure Table reminders: `Microsoft.Orleans.Reminders.AzureStorage`
- ASP.NET Core SignalR Redis backplane: https://learn.microsoft.com/aspnet/core/signalr/redis-backplane
- This repository's prior specs:
  - `2026-03-15-chat-signalr-design.md` (chat REST + SignalR design — survives as the data layer here)
  - `2026-04-16-roles-and-acl-design.md` (ACL system — adapts to grains with minimal changes)
- Backend repo docs:
  - `Lovecraft/docs/ARCHITECTURE.md` (will be updated in Phase 6)
  - `Lovecraft/docs/AZURE_STORAGE.md` (will gain `orleansmembership` row)
  - `Lovecraft/docs/CHAT_ARCHITECTURE.md` (will update SignalR sections)
