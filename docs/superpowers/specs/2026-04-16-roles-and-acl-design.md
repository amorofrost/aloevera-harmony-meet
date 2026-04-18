# Roles & ACL System — Design Spec

**Date**: 2026-04-16
**Status**: Approved
**Resolves**: MCF.12 (partial — ranking/badges), TD.1 follow-on (ACL enforcement)

---

## Overview

Two independent systems layered on top of the existing user model:

1. **Staff roles** — `moderator` | `admin`, manually assigned via API. Control privileged operations (delete any post, ban users, assign roles, manage content).
2. **User ranks** — `novice` → `activeMember` → `friendOfAloe` → `aloeCrew`, earned automatically through activity. Control community access tiers (create topics, access gated forum sections) and displayed as a badge next to every username.

Ranks are **computed on-demand** from activity counters stored on `UserEntity`. No stored rank field — thresholds live in a new `appconfig` Azure Table and are cached in memory. Changing a threshold in the table takes effect for all users within one hour, with no migration needed.

---

## Data Model

### `UserEntity` — new fields


| Field            | Type    | Default  | Notes                                                        |
| ---------------- | ------- | -------- | ------------------------------------------------------------ |
| `ReplyCount`     | int     | 0        | Incremented on every forum reply posted                      |
| `LikesReceived`  | int     | 0        | Incremented when another user sends a like to this user      |
| `EventsAttended` | int     | 0        | Incremented on event registration                            |
| `MatchCount`     | int     | 0        | Incremented on both users when a mutual like creates a match |
| `StaffRole`      | string  | `"none"` | `"none"`                                                     |
| `RankOverride`   | string? | null     | Admin-set override; null = use computed rank                 |


### `UserDto` — new fields

```ts
rank:      'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew'
staffRole: 'none' | 'moderator' | 'admin'
```

Rank is computed server-side before mapping to DTO. `rankLabel` is not included in the DTO — the frontend uses its own `t('rank.<value>')` translation key.

### `ForumReplyDto` — new fields

```ts
authorRank:      'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew'
authorStaffRole: 'none' | 'moderator' | 'admin'
```

### `ForumSectionEntity` — new field


| Field     | Type   | Default    | Notes                                                        |
| --------- | ------ | ---------- | ------------------------------------------------------------ |
| `MinRank` | string | `"novice"` | Minimum rank required to read and post. `"novice"` = public. |


`ForumSectionDto` exposes `minRank: string`.

### `ForumTopicEntity` — new fields


| Field            | Type   | Default    | Notes                                                                           |
| ---------------- | ------ | ---------- | ------------------------------------------------------------------------------- |
| `MinRank`        | string | `"novice"` | Minimum rank to read this topic (section-level default, overridable per topic). |
| `NoviceVisible`  | bool?  | null       | Can Novice users see this topic in the list? null = true (backward compat).     |
| `NoviceCanReply` | bool?  | null       | Can Novice users post a reply? null = true (backward compat).                   |


`ForumTopicDto` exposes all three: `minRank: string`, `noviceVisible: boolean`, `noviceCanReply: boolean`. Missing/null values are resolved to `true` before mapping to DTO so the frontend never sees null.

### `CreateTopicRequestDto` — new optional fields

```ts
noviceVisible?:  boolean  // default true — Novice users can see this topic
noviceCanReply?: boolean  // default true — Novice users can reply
```

Only accepted from Active Member and above (rank gate already enforced on topic creation). Topic author and Moderator+ can update these fields later via `PUT /forum/topics/{id}` (new endpoint, see API section).

### New `appconfig` Azure Table

General-purpose key-value config store with two partition keys used by this feature.

#### Partition `rank_thresholds` — activity counters for tier promotion


| RowKey           | Default | Meaning                                            |
| ---------------- | ------- | -------------------------------------------------- |
| `active_replies` | 5       | Replies needed for Novice → Active Member          |
| `active_likes`   | 3       | Likes received needed for Novice → Active Member   |
| `active_events`  | 1       | Events attended needed for Novice → Active Member  |
| `friend_replies` | 25      | Replies needed for Active → Friend of Aloe         |
| `friend_likes`   | 15      | Likes received needed for Active → Friend of Aloe  |
| `friend_events`  | 3       | Events attended needed for Active → Friend of Aloe |
| `crew_replies`   | 100     | Replies needed for Friend → Aloe Crew              |
| `crew_likes`     | 50      | Likes received needed for Friend → Aloe Crew       |
| `crew_events`    | 10      | Events attended needed for Friend → Aloe Crew      |
| `crew_matches`   | 10      | Matches needed for Friend → Aloe Crew              |


Promotion logic: **OR** — meeting any single criterion at a tier is sufficient. Ranks are sequential — a user must pass through each tier; they cannot skip levels. Matches are only a criterion for the Friend → Aloe Crew transition.

#### Partition `permissions` — minimum level required per action

Permission values use a **unified level hierarchy** that spans both user ranks and staff roles:

```
novice(0) < activeMember(1) < friendOfAloe(2) < aloeCrew(3) < moderator(4) < admin(5)
```

A user's **effective level** is `max(rank level, staff role level)`. A Novice Moderator has effective level 4. An Aloe Crew user with no staff role has effective level 3.


| RowKey             | Default        | Meaning                                              |
| ------------------ | -------------- | ---------------------------------------------------- |
| `create_topic`     | `activeMember` | Minimum level to create a new forum topic            |
| `delete_own_reply` | `novice`       | Minimum level to delete your own reply               |
| `delete_any_reply` | `moderator`    | Minimum level to delete anyone's reply               |
| `delete_any_topic` | `moderator`    | Minimum level to delete any topic                    |
| `pin_topic`        | `moderator`    | Minimum level to pin or lock a topic                 |
| `ban_user`         | `moderator`    | Minimum level to ban or suspend a user               |
| `assign_role`      | `admin`        | Minimum level to assign a staff role                 |
| `override_rank`    | `admin`        | Minimum level to manually override a user's rank     |
| `manage_events`    | `admin`        | Minimum level to create, edit, or delete events      |
| `manage_blog`      | `admin`        | Minimum level to create, edit, or delete blog posts  |
| `manage_store`     | `admin`        | Minimum level to create, edit, or delete store items |


Changing a value in this table reconfigures the system within one hour (cache TTL). The `IAppConfigService` returns a typed `PermissionConfig` record alongside `RankThresholds`.

---

## Rank Computation

### `RankCalculator` static helper

Location: `Lovecraft.Backend/Services/RankCalculator.cs`

```
Input:  UserEntity, RankThresholds (from IAppConfigService)
Output: UserRank enum value

Algorithm (top-down, returns first match):
  1. If RankOverride is set → return RankOverride
  2. If any crew threshold met (replies ≥ crew_replies OR likes ≥ crew_likes
       OR events ≥ crew_events OR matches ≥ crew_matches) → aloeCrew
  3. If any friend threshold met → friendOfAloe
  4. If any active threshold met → activeMember
  5. → novice
```

### `EffectiveLevel` static helper

Location: `Lovecraft.Backend/Services/EffectiveLevel.cs`

Unified level map covering both ranks and staff roles:


| Value          | Level |
| -------------- | ----- |
| `novice`       | 0     |
| `activeMember` | 1     |
| `friendOfAloe` | 2     |
| `aloeCrew`     | 3     |
| `moderator`    | 4     |
| `admin`        | 5     |


```
EffectiveLevel.For(UserEntity user, UserRank computedRank):
  rankLevel     = Level(computedRank)
  staffLevel    = Level(user.StaffRole)   // "none" → 0
  return max(rankLevel, staffLevel)
```

Used by all ACL checks:

```
// Permission from appconfig:
required = EffectiveLevel.Parse(permissionConfig.CreateTopic)  // e.g. 1
caller   = EffectiveLevel.For(callerEntity, callerRank)
if caller < required → 403 INSUFFICIENT_RANK

// Section/topic minRank gate (same helper, rank values only):
if caller < EffectiveLevel.Parse(section.MinRank) → 403 INSUFFICIENT_RANK
```

Replaces the previous `RankOrder` helper — single source of truth for all level comparisons.

### `IAppConfigService`

Singleton service with two implementations:

- `**AzureAppConfigService**` — reads `appconfig` table on startup, returns a typed `AppConfig` record containing both `RankThresholds` and `PermissionConfig`. Cache TTL: 1 hour.
- `**MockAppConfigService**` — returns hardcoded defaults (matching the Seeder defaults). Used when `USE_AZURE_STORAGE=false`.

```csharp
record AppConfig(RankThresholds Ranks, PermissionConfig Permissions);
record RankThresholds(int ActiveReplies, int ActiveLikes, ...);
record PermissionConfig(string CreateTopic, string DeleteAnyReply, string PinTopic, ...);
```

All services receive it via constructor injection. DI registration mirrors the existing `USE_AZURE_STORAGE` pattern in `Program.cs`.

---

## API Endpoints

### New endpoints


| Method | Path                               | Auth      | Description                                                        |
| ------ | ---------------------------------- | --------- | ------------------------------------------------------------------ |
| `PUT`  | `/api/v1/users/{id}/role`          | Admin JWT | Assign `staffRole` (`"moderator"`                                  |
| `PUT`  | `/api/v1/users/{id}/rank-override` | Admin JWT | Set manual rank override; body `{ rankOverride: string             |
| `GET`  | `/api/v1/admin/config`             | Admin JWT | Read current `appconfig` table (rank thresholds + any future keys) |


### Modified endpoints


| Endpoint                                         | Change                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users`, `GET /users/{id}`, `GET /users/me` | Response includes `rank`, `staffRole`                                                                                                                       |
| `GET /forum/sections`                            | Response includes `minRank` per section                                                                                                                     |
| `GET /forum/sections/{id}/topics`                | Response includes `minRank`, `noviceVisible`, `noviceCanReply` per topic. Topics where `noviceVisible=false` are excluded from the list for Novice callers. |
| `GET /forum/topics/{id}`                         | Returns 403 `INSUFFICIENT_RANK` for Novice callers if `noviceVisible=false`                                                                                 |
| `POST /forum/sections/{sectionId}/topics`        | Checks `permissions.create_topic` via `EffectiveLevel`; accepts optional `noviceVisible` and `noviceCanReply` in body                                       |
| `POST /forum/topics/{id}/replies`                | Checks caller level ≥ section/topic `MinRank`; additionally checks `noviceCanReply` for Novice callers                                                      |
| `PUT /forum/topics/{id}`                         | **New** — update `noviceVisible`, `noviceCanReply`, `isPinned`, `isLocked`. Allowed for topic author (own topic settings) or Moderator+ (any topic).        |


### Error codes


| Code                 | HTTP | Meaning                                                                                                       |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| `INSUFFICIENT_RANK`  | 403  | Caller's effective level is below the required minimum                                                        |
| `ADMIN_REQUIRED`     | 403  | Operation requires Admin staff role (returned when `permissions.assign_role = admin` and caller is not admin) |
| `MODERATOR_REQUIRED` | 403  | Operation requires Moderator or Admin staff role                                                              |


---

## Counter Increment Hooks

Each counter is incremented by calling `IUserService.IncrementCounterAsync(userId, counter)` inside the relevant service method. This keeps counter logic out of controller layer.


| Event                       | Counter                        | Location                          |
| --------------------------- | ------------------------------ | --------------------------------- |
| Forum reply posted          | `ReplyCount` on author         | `ForumService.CreateReplyAsync`   |
| Like sent to a user         | `LikesReceived` on target      | `MatchingService.CreateLikeAsync` |
| Event registered            | `EventsAttended` on registrant | `EventService.RegisterAsync`      |
| Mutual like (match created) | `MatchCount` on both users     | `MatchingService.CreateLikeAsync` |


---

## Permission Matrix

> The defaults below match the `permissions` partition in `appconfig`. Starred rows (★) are stored in `appconfig` and can be changed at runtime. Unstarred rows are always-allowed (all authenticated users) and are not stored in config.


| Action                                         | Novice | Active | Friend | Crew | Mod | Admin | Config key                                            |
| ---------------------------------------------- | ------ | ------ | ------ | ---- | --- | ----- | ----------------------------------------------------- |
| Read public forum                              | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| Read gated section/topic (minRank gate)        | ✕      | ✓      | ✓      | ✓    | ✓   | ✓     | per-entity `minRank`                                  |
| Read topic with `noviceVisible=false`          | ✕      | ✓      | ✓      | ✓    | ✓   | ✓     | per-topic field                                       |
| Post reply (public topic)                      | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| Post reply (topic with `noviceCanReply=false`) | ✕      | ✓      | ✓      | ✓    | ✓   | ✓     | per-topic field                                       |
| Post reply (minRank-gated section)             | ✕      | ✓      | ✓      | ✓    | ✓   | ✓     | per-entity `minRank`                                  |
| ★ Create topic                                 | ✕      | ✓      | ✓      | ✓    | ✓   | ✓     | `create_topic` = `activeMember`                       |
| Edit / delete own reply                        | own    | own    | own    | own  | ✓   | ✓     | `delete_own_reply` = `novice`                         |
| ★ Delete any reply or topic                    | ✕      | ✕      | ✕      | ✕    | ✓   | ✓     | `delete_any_reply` / `delete_any_topic` = `moderator` |
| ★ Pin / lock topic                             | ✕      | ✕      | ✕      | ✕    | ✓   | ✓     | `pin_topic` = `moderator`                             |
| Update own topic settings (noviceVisible etc.) | own    | own    | own    | own  | ✓   | ✓     | —                                                     |
| Send likes / swipe                             | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| Send / receive private messages                | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| Delete own chat message                        | own    | own    | own    | own  | ✓   | ✓     | —                                                     |
| Edit own profile                               | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| ★ Ban / suspend user                           | ✕      | ✕      | ✕      | ✕    | ✓   | ✓     | `ban_user` = `moderator`                              |
| ★ Assign staff role                            | ✕      | ✕      | ✕      | ✕    | ✕   | ✓     | `assign_role` = `admin`                               |
| ★ Override user rank                           | ✕      | ✕      | ✕      | ✕    | ✕   | ✓     | `override_rank` = `admin`                             |
| Register for events                            | ✓      | ✓      | ✓      | ✓    | ✓   | ✓     | —                                                     |
| ★ Create / edit / delete events                | ✕      | ✕      | ✕      | ✕    | ✕   | ✓     | `manage_events` = `admin`                             |
| ★ Manage blog posts & store items              | ✕      | ✕      | ✕      | ✕    | ✕   | ✓     | `manage_blog` / `manage_store` = `admin`              |


---

## Frontend

### New component: `<UserBadges />`

Location: `src/components/ui/user-badges.tsx`

```tsx
interface UserBadgesProps {
  rank?: UserRank        // 'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew'
  staffRole?: StaffRole  // 'none' | 'moderator' | 'admin'
}
```

Renders Style B: coloured dot + rank name inline, staff role as a small uppercase pill to the right. Renders nothing if both are absent or `staffRole === 'none'` and rank is `'novice'` (novice is the default state — no badge noise for new users).

Rank dot colours match existing design system variables:

- novice: `--muted`
- activeMember: `--aloe-sage` (#34d399 equivalent)
- friendOfAloe: `--aloe-ocean`
- aloeCrew: `--aloe-gold`
- Moderator pill: `--aloe-lavender`
- Admin pill: `--aloe-flame`

### Translation keys added to `LanguageContext`

```ts
'rank.novice':          { ru: 'Новичок',               en: 'Novice' }
'rank.activeMember':    { ru: 'Активный участник',      en: 'Active Member' }
'rank.friendOfAloe':    { ru: 'Друг AloeVera',          en: 'Friend of Aloe' }
'rank.aloeCrew':        { ru: 'Команда AloeVera',       en: 'Aloe Crew' }
'staffRole.moderator':  { ru: 'Мод',                   en: 'Mod' }
'staffRole.admin':      { ru: 'Админ',                 en: 'Admin' }
'forum.lockedSection':  { ru: 'Только для активных участников+', en: 'Active Member+ only' }
'forum.replyRestricted':{ ru: 'Ответы доступны только активным участникам', en: 'Replies for Active Members only' }
'forum.noviceVisible':  { ru: 'Видно новичкам', en: 'Visible to new users' }
'forum.noviceCanReply': { ru: 'Новички могут отвечать', en: 'New users can reply' }
```

### Where `<UserBadges />` is used


| Location                  | Component          | Detail                                |
| ------------------------- | ------------------ | ------------------------------------- |
| Forum reply header        | `TopicDetail.tsx`  | Next to author name, before timestamp |
| Profile / settings header | `SettingsPage.tsx` | Below display name                    |
| User swipe cards          | `Friends.tsx`      | Below name on profile card            |
| Chat list items           | `Friends.tsx`      | Below name in chat list               |


### Gated forum sections and topics (UI)

**Section-level gating** (`Talks.tsx`): sections where `minRank > 'novice'` and the current user's level is insufficient:

- Lock icon next to section name, muted style
- Click shows `toast.error(t('forum.lockedSection'))` instead of navigating

**Topic-level gating** (`Talks.tsx` topic list): topics excluded server-side when `noviceVisible=false` for Novice callers; Novice users simply don't see those topics. No lock icon needed — they're invisible.

**Reply gating** (`TopicDetail.tsx`): when `noviceCanReply=false` and the current user is Novice, the reply input is hidden and replaced with `t('forum.replyRestricted')` message.

**Create topic form** (`Talks.tsx`): when creating a new topic (Active Member+), show two optional toggles:

- "Visible to new users (Novice)" — default on
- "New users can reply" — default on

Toggling "Visible" off also disables and resets "Can reply" (a hidden topic can't be replied to either).

### New translation keys

```ts
'forum.lockedSection':    { ru: 'Только для активных участников+', en: 'Active Member+ only' }
'forum.replyRestricted':  { ru: 'Ответы доступны только активным участникам', en: 'Replies for Active Members only' }
'forum.noviceVisible':    { ru: 'Видно новичкам', en: 'Visible to new users' }
'forum.noviceCanReply':   { ru: 'Новички могут отвечать', en: 'New users can reply' }
```

### Type updates

`src/types/user.ts`:

```ts
type UserRank  = 'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew'
type StaffRole = 'none' | 'moderator' | 'admin'

interface User {
  // ... existing fields ...
  rank:      UserRank
  staffRole: StaffRole
}
```

`src/types/` (new file or extend `chat.ts`): `ForumReplyDto` gets `authorRank: UserRank` and `authorStaffRole: StaffRole`.

---

## Seeder & Mock Data Updates

### Seeder (Azure mode — `USE_AZURE_STORAGE=true`)

`Lovecraft.Tools.Seeder` additions:

1. **Seed `appconfig` table** with all 10 rank threshold rows and all 11 permission rows (upsert — safe to re-run)
2. **Seed mock user activity counters** to make all four rank tiers visible immediately:


| User   | ReplyCount | LikesReceived | EventsAttended | MatchCount | Rank           |
| ------ | ---------- | ------------- | -------------- | ---------- | -------------- |
| Anna   | 120        | 60            | 12             | 11         | Aloe Crew      |
| Dmitry | 30         | 18            | 4              | 0          | Friend of Aloe |
| Elena  | 8          | 4             | 2              | 0          | Active Member  |
| Maria  | 1          | 0             | 0              | 0          | Novice         |


### MockDataStore (mock mode — `USE_AZURE_STORAGE=false`)

`MockDataStore.cs` mock users get the same activity counter values as the Seeder table above, so rank badges are visible and rank-gating works correctly in mock mode without Azure Storage.

---

## Tests

### Backend — new test classes

`**RankCalculatorTests`** (12 tests):

- Boundary values for each of the three tier transitions
- OR logic: meeting any single criterion is sufficient
- Top-down evaluation: crew checked before friend before active
- `RankOverride` takes precedence over computed rank
- `null` override falls back to computed rank

`**AclTests`** (14 tests):

- Novice blocked from creating topic → `INSUFFICIENT_RANK` (from `permissions.create_topic`)
- Active Member allowed to create topic
- Novice blocked from minRank-gated section → `INSUFFICIENT_RANK`
- Active Member allowed into minRank-gated section
- Novice cannot see topic with `noviceVisible=false` (excluded from list; 403 on direct fetch)
- Active Member can see topic with `noviceVisible=false`
- Novice cannot reply to topic with `noviceCanReply=false` → `INSUFFICIENT_RANK`
- Active Member can reply to topic with `noviceCanReply=false`
- Moderator can delete any reply (effective level ≥ `permissions.delete_any_reply`)
- Admin can assign staff role; non-Admin gets `ADMIN_REQUIRED`
- Effective level: Novice Moderator passes moderator-gated action
- Effective level: Aloe Crew without staff role blocked from moderator-gated action
- Changing `permissions.create_topic` to `novice` in config allows Novice to create topic
- Rank gate uses computed rank, not stored (override respected)

### Backend — existing test impact

`MatchingTests`: `MockMatchingService.CreateLikeAsync` now calls `IncrementCounterAsync` — existing assertions remain valid; counter side-effects are testable but not required by existing tests.

---

## Documentation Updates

The following docs are updated as part of this implementation:


| File                                                 | Change                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/ISSUES.md`                                     | Mark MCF.12 partially resolved (rank/badge system implemented); update active count                                       |
| `docs/FEATURES.md`                                   | Add section 9: Roles & Ranks                                                                                              |
| `docs/ARCHITECTURE.md`                               | Add ACL system to architecture layers; mention `RankCalculator` and `IAppConfigService`                                   |
| `AGENTS.md`                                          | Add `<UserBadges />` to component patterns; add `UserRank` / `StaffRole` types to type guidelines; note `appconfig` table |
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | Add new endpoints, new tables (`appconfig`), new unit test count                                                          |


---

## Out of Scope (this spec)

- Admin panel UI (MCF.16) — role assignment remains API-only
- Secret events access control — separate future spec
- Ban/suspend UI — permission defined but enforcement deferred to admin panel
- Edit/delete own reply UI — permission defined; backend enforcement and frontend UI deferred (no edit endpoint exists yet)
- Delete own chat message — permission defined; deferred to chat feature work
- Notification when user ranks up — future enhancement

