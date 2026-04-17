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

| Field | Type | Default | Notes |
|---|---|---|---|
| `ReplyCount` | int | 0 | Incremented on every forum reply posted |
| `LikesReceived` | int | 0 | Incremented when another user sends a like to this user |
| `EventsAttended` | int | 0 | Incremented on event registration |
| `MatchCount` | int | 0 | Incremented on both users when a mutual like creates a match |
| `StaffRole` | string | `"none"` | `"none"` \| `"moderator"` \| `"admin"` |
| `RankOverride` | string? | null | Admin-set override; null = use computed rank |

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

### `ForumSectionEntity` / `ForumTopicEntity` — new field

| Field | Type | Default | Notes |
|---|---|---|---|
| `MinRank` | string | `"novice"` | Minimum rank required to read and post. `"novice"` = public. |

Both `ForumSectionDto` and `ForumTopicDto` expose `minRank: string` so the frontend can render lock states without making a separate request. The field is also added to `ForumSectionDto` in `Lovecraft.Common/DTOs/Forum/ForumDtos.cs`.

### New `appconfig` Azure Table

General-purpose key-value config store. Rank thresholds use partition key `rank_thresholds`:

| RowKey | Default Value | Meaning |
|---|---|---|
| `active_replies` | 5 | Replies needed for Novice → Active Member |
| `active_likes` | 3 | Likes received needed for Novice → Active Member |
| `active_events` | 1 | Events attended needed for Novice → Active Member |
| `friend_replies` | 25 | Replies needed for Active → Friend of Aloe |
| `friend_likes` | 15 | Likes received needed for Active → Friend of Aloe |
| `friend_events` | 3 | Events attended needed for Active → Friend of Aloe |
| `crew_replies` | 100 | Replies needed for Friend → Aloe Crew |
| `crew_likes` | 50 | Likes received needed for Friend → Aloe Crew |
| `crew_events` | 10 | Events attended needed for Friend → Aloe Crew |
| `crew_matches` | 10 | Matches needed for Friend → Aloe Crew |

Promotion logic: **OR** — meeting any single criterion at a tier is sufficient. Ranks are sequential — a user must pass through each tier; they cannot skip levels. Matches are only a criterion for the Friend → Aloe Crew transition.

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

### `RankOrder` static helper

Maps rank strings to integers for comparison: `novice=0`, `activeMember=1`, `friendOfAloe=2`, `aloeCrew=3`.

Used by ACL checks: `if (RankOrder.Value(callerRank) < RankOrder.Parse(section.MinRank)) → 403`.

### `IAppConfigService`

Singleton service with two implementations:

- **`AzureAppConfigService`** — reads `appconfig` table on startup, returns typed `RankThresholds` record. Cache TTL: 1 hour.
- **`MockAppConfigService`** — returns hardcoded defaults (matching the Seeder defaults above). Used when `USE_AZURE_STORAGE=false`.

All services receive it via constructor injection. DI registration mirrors the existing `USE_AZURE_STORAGE` pattern in `Program.cs`.

---

## API Endpoints

### New endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `PUT` | `/api/v1/users/{id}/role` | Admin JWT | Assign `staffRole` (`"moderator"` \| `"admin"` \| `"none"`) |
| `PUT` | `/api/v1/users/{id}/rank-override` | Admin JWT | Set manual rank override; body `{ rankOverride: string \| null }`, null clears override |
| `GET` | `/api/v1/admin/config` | Admin JWT | Read current `appconfig` table (rank thresholds + any future keys) |

### Modified endpoints

| Endpoint | Change |
|---|---|
| `GET /users`, `GET /users/{id}`, `GET /users/me` | Response includes `rank`, `staffRole` |
| `POST /forum/topics/{id}/replies` | Checks caller rank ≥ section `MinRank`; 403 `INSUFFICIENT_RANK` if not |
| `GET /forum/sections` | Response includes `minRank` per section |
| `GET /forum/sections/{id}/topics` | Response includes `minRank` per topic |
| `POST /forum/sections/{sectionId}/topics` | Blocked for Novice; 403 `INSUFFICIENT_RANK` |

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `INSUFFICIENT_RANK` | 403 | Caller's rank is below the required minimum |
| `ADMIN_REQUIRED` | 403 | Operation requires Admin staff role |
| `MODERATOR_REQUIRED` | 403 | Operation requires Moderator or Admin staff role |

---

## Counter Increment Hooks

Each counter is incremented by calling `IUserService.IncrementCounterAsync(userId, counter)` inside the relevant service method. This keeps counter logic out of controller layer.

| Event | Counter | Location |
|---|---|---|
| Forum reply posted | `ReplyCount` on author | `ForumService.CreateReplyAsync` |
| Like sent to a user | `LikesReceived` on target | `MatchingService.CreateLikeAsync` |
| Event registered | `EventsAttended` on registrant | `EventService.RegisterAsync` |
| Mutual like (match created) | `MatchCount` on both users | `MatchingService.CreateLikeAsync` |

---

## Permission Matrix

| Action | Novice | Active | Friend | Crew | Mod | Admin |
|---|---|---|---|---|---|---|
| Read public forum | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read gated sections (minRank=activeMember+) | ✕ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post reply (public section) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post reply (gated section) | ✕ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create topic (public section) | ✕ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create topic (gated section) | ✕ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit / delete own reply | own | own | own | own | ✓ | ✓ |
| Delete any reply or topic | ✕ | ✕ | ✕ | ✕ | ✓ | ✓ |
| Pin / lock topic | ✕ | ✕ | ✕ | ✕ | ✓ | ✓ |
| Send likes / swipe | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send / receive private messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete own chat message | own | own | own | own | ✓ | ✓ |
| Edit own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ban / suspend user | ✕ | ✕ | ✕ | ✕ | ✓ | ✓ |
| Assign staff role | ✕ | ✕ | ✕ | ✕ | ✕ | ✓ |
| Override user rank | ✕ | ✕ | ✕ | ✕ | ✕ | ✓ |
| Register for events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit / delete events | ✕ | ✕ | ✕ | ✕ | ✕ | ✓ |
| Manage blog posts & store items | ✕ | ✕ | ✕ | ✕ | ✕ | ✓ |

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
```

### Where `<UserBadges />` is used

| Location | Component | Detail |
|---|---|---|
| Forum reply header | `TopicDetail.tsx` | Next to author name, before timestamp |
| Profile / settings header | `SettingsPage.tsx` | Below display name |
| User swipe cards | `Friends.tsx` | Below name on profile card |
| Chat list items | `Friends.tsx` | Below name in chat list |

### Gated forum sections (UI)

In `Talks.tsx`, sections/topics where `minRank > 'novice'` and the current user's rank is insufficient are rendered with:
- Lock icon (🔒) next to section name
- Muted/dimmed style
- Click shows `toast.error(t('forum.lockedSection'))` instead of navigating
- Backend enforces the actual 403 — this is UX only

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

1. **Seed `appconfig` table** with all 10 default threshold rows (upsert — safe to re-run)
2. **Seed mock user activity counters** to make all four rank tiers visible immediately:

| User | ReplyCount | LikesReceived | EventsAttended | MatchCount | Rank |
|---|---|---|---|---|---|
| Anna | 120 | 60 | 12 | 11 | Aloe Crew |
| Dmitry | 30 | 18 | 4 | 0 | Friend of Aloe |
| Elena | 8 | 4 | 2 | 0 | Active Member |
| Maria | 1 | 0 | 0 | 0 | Novice |

### MockDataStore (mock mode — `USE_AZURE_STORAGE=false`)

`MockDataStore.cs` mock users get the same activity counter values as the Seeder table above, so rank badges are visible and rank-gating works correctly in mock mode without Azure Storage.

---

## Tests

### Backend — new test classes

**`RankCalculatorTests`** (12 tests):
- Boundary values for each of the three tier transitions
- OR logic: meeting any single criterion is sufficient
- Top-down evaluation: crew checked before friend before active
- `RankOverride` takes precedence over computed rank
- `null` override falls back to computed rank

**`AclTests`** (8 tests):
- Novice blocked from creating topic → `INSUFFICIENT_RANK`
- Active Member allowed to create topic
- Novice blocked from gated section → `INSUFFICIENT_RANK`
- Active Member allowed into gated section
- Moderator can delete any reply
- Admin can assign staff role; non-Admin gets `ADMIN_REQUIRED`
- Rank gate uses computed rank, not stored (override respected)

### Backend — existing test impact

`MatchingTests`: `MockMatchingService.CreateLikeAsync` now calls `IncrementCounterAsync` — existing assertions remain valid; counter side-effects are testable but not required by existing tests.

---

## Documentation Updates

The following docs are updated as part of this implementation:

| File | Change |
|---|---|
| `docs/ISSUES.md` | Mark MCF.12 partially resolved (rank/badge system implemented); update active count |
| `docs/FEATURES.md` | Add section 9: Roles & Ranks |
| `docs/ARCHITECTURE.md` | Add ACL system to architecture layers; mention `RankCalculator` and `IAppConfigService` |
| `AGENTS.md` | Add `<UserBadges />` to component patterns; add `UserRank` / `StaffRole` types to type guidelines; note `appconfig` table |
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | Add new endpoints, new tables (`appconfig`), new unit test count |

---

## Out of Scope (this spec)

- Admin panel UI (MCF.16) — role assignment remains API-only
- Secret events access control — separate future spec
- Ban/suspend UI — permission defined but enforcement deferred to admin panel
- Edit/delete own reply UI — permission defined; backend enforcement and frontend UI deferred (no edit endpoint exists yet)
- Delete own chat message — permission defined; deferred to chat feature work
- Notification when user ranks up — future enhancement
