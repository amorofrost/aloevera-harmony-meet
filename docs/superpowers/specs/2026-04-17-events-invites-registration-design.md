# Events, secret visibility, and invite codes — design spec

**Status**: Draft for implementation  
**Date**: 2026-04-17  
**Scope**: Backend + frontend; replaces global `INVITE_CODE` (`.env`) with **Approach 1** — dedicated event invite records, app-config-driven registration policy, and forum-first discussion UX.

---

## 1. Goals

1. **Reliability** — Join/leave and “attending” state use the **real user id** from JWT; list and detail stay consistent; remove hardcoded or placeholder join state on the client.
2. **Secret events** — Per-event visibility: **hidden** (not listed; tight access rules) vs **teaser** (listed with redacted fields). Unauthorized users do not get full detail.
3. **Invites** — **One shared invite code per event** (stored as hash), **optional expiration**, **rotation** (new code revokes the previous). Links/QR encode the raw code or a redeemable token (implementation detail: prefer opaque token in URL that maps server-side to validation).
4. **Registration** — **Fully replace** `INVITE_CODE` environment variable. `**appconfig`** row `**registration` / `require_event_invite`** gates: (a) invite **required** for every new account, or (b) invite **optional** with open signup. Invite validation uses the **event invite** subsystem.
5. **Registration source on profile** — If signup uses a valid event invite, persist `**registrationSourceEventId`** (and optional metadata) on the user for future UX and analytics.
6. **Social (forum-first)** — Event detail prioritizes navigation to the event’s **forum topic** (`forumTopicId`); Talks/event chat polish is out of scope for this slice.

---

## 2. Non-goals (this slice)

- Unique-per-recipient invite codes, analytics per recipient.
- Full notification system for event reminders.
- Event sub-groups, waitlists, or organizer roles beyond what’s needed for **issue/revoke invite** (admin/staff).
- Replacing or redesigning the Talks “event chat” experience beyond a stable link to forum where applicable.

---

## 3. Replacement of `INVITE_CODE` (`.env`)

### Current behavior (to remove)

- `Lovecraft.Backend`: `MockAuthService` / `AzureAuthService` read `INVITE_CODE` from `IConfiguration`. If non-empty, `RegisterAsync` requires `request.InviteCode` to match exactly.
- `AuthController.GetRegistrationConfig`: `inviteCodeRequired = !string.IsNullOrEmpty(_configuration["INVITE_CODE"])`.
- Deployments set the secret in `.env` / Docker env.

### Target behavior


| Concern                                                                    | Source of truth                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Must every **new account** use an event invite, or is invite **optional**? | `**appconfig` table** (same Azure Table pattern as rank/permissions): partition `registration`, row `**require_event_invite`** — value `**true`** |
| Does this **specific registration attempt** include a valid invite?        | `**EventInvite`** rows: validate **hashed** code, `expiresAt`, not revoked; associate to **one event**.                                           |
| Global “single secret string” for the whole site                           | **Removed** (`INVITE_CODE` env).                                                                                                                  |


**Two modes (controlled only by `require_event_invite` in `appconfig`):**

1. `**require_event_invite = true`** — **Invite-only registration.** Creating a new account **requires** a valid, non-expired, non-revoked **event** invite code. There is no registration without a code.
2. `**require_event_invite = false`** — **Open registration.** Users may create an account **without** any invite code. An invite field remains **optional**: if the user supplies a valid event invite code at signup, the server still validates it, **adds them as an attendee** for that event, and **persists the event as their registration source** on their profile (see §4.4).

**Seeder / ops:** Seed default `registration` / `require_event_invite` (e.g. `false` for dev openness) alongside existing `appconfig` rows; document how to flip for production.

### Migration notes

- Remove all reads of `INVITE_CODE` from auth services and tests that assert env-based behavior; replace with appconfig + `EventInvite` validation.
- Update `Lovecraft.UnitTests` (`AuthenticationTests` invite tests) to use in-memory appconfig + seeded invite rows instead of `WithInviteCode`.
- Document in `DOCKER.md` / deployment docs: **delete** `INVITE_CODE`; add seed or admin procedure for `registration.mode` and event invites.
- Frontend: `GET /api/v1/auth/registration-config` response shape **may change** (see §6); `Welcome.tsx` and tests updated accordingly.

---

## 4. Data model (Approach 1)

### 4.1 Event visibility

Extend event entity/DTO with explicit visibility (exact names can match existing enums):

- `public` — listed for all authenticated users; full detail per existing rules.
- `secretHidden` — omitted from default list; full detail only with **valid invite**, **already attending**, or **staff**; unauthorized → **404** for detail (recommended to avoid existence leaks).
- `secretTeaser` — listed with **teaser DTO** (subset of fields); full detail same gate as `secretHidden`.

**Per-event setting** satisfies “either A or B depending on event.”

### 4.2 `EventInvite` (working name)

Logical fields:

- `eventId` (FK)
- `codeHash` (never store raw code; use strong hash + optional pepper from config)
- `expiresAt` (required for product rule “not valid after”)
- `revokedAt` / `supersededByInviteId` — when organizer issues a new code, previous row is no longer valid for redemption
- `createdAt`, optional `createdByUserId`

**Invariant**: At most **one** invite row per event is considered the **current** redeemable code for validation (or: validate against any non-revoked non-expired row — **prefer single active** to avoid ambiguity for “which QR is current”).

Storage: new Azure Table (e.g. `eventinvites`) or consolidated pattern per existing `TableNames` conventions.

### 4.3 Attendance

Reuse existing event registration/attendee model. Redeeming a valid invite for an **existing user** calls the same path as “register for event” (idempotent). **New user**: single transaction — create user + mark attendee for that event **after** invite validation.

### 4.4 User profile — registration source event

When a user **creates an account while redeeming an event invite** (invite code present and valid at `POST /api/v1/auth/register`), persist **which event** that was for **long-lived profile use** (analytics, UX copy, future features — e.g. “You joined via [event]”).

**Stored fields (backend entity + `UserDto`):**


| Field (conceptual)                                            | Purpose                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**registrationSourceEventId`**                               | Nullable `string`. Set **once** at signup when registration included a valid event invite; **immutable** thereafter (do not overwrite on later event joins). If signup had no invite, leave `null`.                                                                   |
| `**registrationSourceEventTitle`** (optional denormalization) | If useful for display without an extra fetch, store snapshot of event title at signup time; otherwise resolve via `registrationSourceEventId` when needed. **Recommendation:** start with **event id only**; add denormalized title if product needs offline display. |
| `**registrationSourceRedeemedAt`** (optional)                 | UTC timestamp when the invite was redeemed at signup; supports audit and support.                                                                                                                                                                                     |


**Rules**

- Set only when `**inviteCode` on register** validates against `EventInvite` and registration succeeds.
- **Do not** set or change these fields when an **existing user** later joins events or redeems invites on login flows — those paths update attendance only, not “registration source.”
- **Privacy / API:** Expose `registrationSourceEventId` on `**/users/me`** (and any admin views as needed). Whether it appears on **other users’** public profiles is a product decision (default: **self-only** or **hidden from others** unless we add a setting later).

**Frontend:** Settings or profile can show “Registered via event …” when `registrationSourceEventId` is present (fetch event title by id or use denormalized field if added).

---

## 5. API sketch

**Events**

- `GET /api/v1/events` — Returns public + `secretTeaser` entries (redacted); **excludes** `secretHidden` unless specified otherwise (e.g. staff filter — optional).
- `GET /api/v1/events/{id}` — If secret: require **valid invite token/code** (query/header), **or** caller already attendee, **or** staff; else 404/403 per policy (default **404** for hidden detail).
- `POST /api/v1/events/{id}/register` — Body may include `inviteCode` when event is secret; validate before registering.

**Invites (admin/staff)**

- `POST /api/v1/admin/events/{id}/invites` — Create/replace invite: returns **plaintext code once** in response (for QR/link generation); server stores hash only. Revokes previous active invite for that event.

**Auth**

- `POST /api/v1/auth/register` — Body: existing fields + `inviteCode` optional or required per `**appconfig` `registration` / `require_event_invite`** (see §3). If present, resolve via `EventInvite` validation; on success register user, add to that event’s attendees, and set `**registrationSourceEventId`** (and optional timestamps) on the new user.

**Registration config**

- `GET /api/v1/auth/registration-config` — Returns e.g. `{ requireEventInvite: boolean }` mirroring `**appconfig`** `registration` / `require_event_invite` (frontend maps to required vs optional invite field + copy). **No** dependency on `INVITE_CODE` env.

**Users**

- `GET /api/v1/users/me` — Include `registrationSourceEventId` (and optional denormalized fields) on the authenticated user’s DTO.

---

## 6. Frontend

- **Registration** — When `requireEventInvite === true`, require invite field (Zod + UX: event invite code). When `false`, invite field **optional**; registration without code allowed; if user enters a valid code, backend attaches them to the event and stores **registration source** on the profile.
- **Profile / settings** — Optionally display registration source when `registrationSourceEventId` is set (load event name or use API field if denormalized later).
- **Event list/detail** — Fix **attending** detection using **JWT user id** (not `'current-user'`); sync **joined** state with API responses after register/unregister.
- **AloeVera** — Remove **hardcoded** `joinedEvents` seed; load from user/events API or derive from event payloads.
- **Event detail** — Prominent **Forum** CTA using `forumTopicId` (and existing backend lazy topic creation on first fetch if applicable).
- **Deep links** — e.g. `/aloevera/events/:id?code=...` passes code to API for gated detail/register flows.

---

## 7. Errors

Reuse/extend codes: `INVALID_INVITE_CODE`, `INVITE_EXPIRED`, `INVITE_REVOKED`, `EVENT_NOT_FOUND`, `EVENT_FULL` (if capacity enforced), `INVITE_REQUIRED` (when `require_event_invite` is true and request omitted code or validation failed before attendee step).

---

## 8. Security

- Raw invite codes only transmitted over **HTTPS** in production; hashes at rest.
- Constant-time comparison for code validation.
- Teaser responses must not leak **location**, **exact time**, **forum links**, or **attendee identities** if product says so (define exact teaser fields in implementation plan).

---

## 9. Testing

- **Unit**: Invite validation (expiry, rotation, wrong code), `require_event_invite` true vs false, register+attend atomicity, `**registrationSourceEventId` set only on invite-at-signup**.
- **Integration**: List filtering, detail gating, admin invite issuance replaces old code.
- **Frontend**: Welcome register flows updated; tests mock `getRegistrationConfig` with `requireEventInvite` from appconfig (not `INVITE_CODE` env).

---

## 10. Self-review checklist


| Check                | Status                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placeholders / TBD   | Teaser field list left flexible — nail down in implementation plan                                                                                                                 |
| Internal consistency | Env invite fully removed; **registration gate** = `appconfig` `registration` / `require_event_invite`; **profile** stores **registration source event** when invite used at signup |
| Scope                | Large but single coherent slice; sub-groups explicitly out                                                                                                                         |
| Ambiguity            | Single **active** invite per event — confirm in plan if “any non-revoked” allowed                                                                                                  |


---

## 11. Approval

Implementation should not start until this spec is reviewed and any teaser-field policy and HTTP status (404 vs 403) choices are confirmed.