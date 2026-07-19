# Attendee Pre-Registration & Claim-on-First-Login — Design

**Date:** 2026-07-19
**Status:** Approved design; ready for implementation planning
**Repos affected:** `lovecraft` (backend, primary), `aloevera-harmony-meet` (frontend admin UI)

---

## Problem

We have an event and a list of its attendees. For each attendee we know: **name**, **gender**, **photo URL**, and **Telegram username** (a string like `@john_doe`). We do **not** know their Telegram numeric user id.

We want to:

1. **Import** the list and create a user account for each attendee — unless an account with the same username already exists.
2. Because we lack the Telegram numeric id, we cannot link a real Telegram auth method at import time. Instead, when a person **whose Telegram username matches a pre-registered account signs in for the first time** (via Telegram Login Widget in the browser **or** Telegram Mini App), a normal Telegram auth method is **linked (claimed)** onto that pre-created account, using the real numeric id from the sign-in payload.

## Product decisions (from brainstorming)

- **Import trigger:** Admin API + admin UI (inside the existing event editor).
- **Shell visibility:** Pre-created ("shell") accounts are **visible immediately** — they appear as normal profiles (imported name + photo) in the swipe deck, event roster, etc., before the real person logs in.
- **Event attendance:** Imported accounts are **registered as attendees** of the target event.
- **Identity scheme (Approach A):** `userId` = normalized Telegram username. No new tables.

---

## Key facts about the existing system

- The app `userId` **is** the normalized account name (`UserEntity.RowKey`), not a GUID. `AccountNameValidator` enforces Telegram-style names: 5–32 chars, starts with a letter, `[A-Za-z0-9_]`, minus a reserved list; `Normalize` = trim + lowercase.
- The Telegram **username** is present in both sign-in payloads (`TelegramLoginRequestDto.Username`, Mini App `initData` `user.username`) but is **not persisted** on `UserEntity` today. Sign-in resolves an account solely via `telegramUserId → usertelegramindex`.
- Unknown Telegram numeric id → the login flows return `pending` (widget) / `needsRegistration` (Mini App).
- `AzureAuthService.AttachTelegramToUserAsync(userEntity, tgInfo)` already: sets `TelegramUserId`, appends `"telegram"` to `AuthMethodsJson`, atomically writes `usertelegramindex`, and sets the profile image only if currently empty. This is exactly the "claim" primitive.
- Telegram-only accounts already use a synthetic email `telegram_{tgId}@telegram.local` + a random unusable password hash + `AuthMethodsJson = ["telegram"]`.

---

## Architecture

### 1. Data model — the "shell" account

A pre-registered account is a **real `users` row** (so it is visible and can be an attendee) with no working login until claimed. It mirrors a Telegram-only account, minus the numeric id.

Fields for a freshly imported shell:

| Field | Value |
|---|---|
| `RowKey` / `userId` | `AccountNameValidator.Normalize(telegramUsername)` |
| `PartitionKey` | `UserEntity.GetPartitionKey(userId)` |
| `AccountNameDisplay` | original-case `@username` (without the `@`) |
| `Email` | synthetic `prereg_{normalizedUsername}@telegram.local` |
| `PasswordHash` | hash of random bytes (unusable) |
| `AuthMethodsJson` | `[]` (nothing linked yet) |
| `TelegramUserId` | `""` |
| `PreRegistered` | **`true`** — new `bool` column on `UserEntity` (default `false`) |
| `EmailVerified` | `true` (behaves as a normal profile) |
| `Name` | imported name (run through `HtmlGuard`) |
| `Gender` | imported gender via existing `NormalizeGender` |
| `ProfileImage` / `ImagesJson` | imported photo downloaded to blob (best-effort); gallery seeded with it |
| `Age`, `Country`, `Region`, prefs, settings | unset / existing defaults (same defaults as Telegram register) |
| `CreatedAt`/`UpdatedAt`/`LastSeen` | now |

A `useremailindex` row is written for the synthetic email so the "every user has an email + index" invariant holds, and the reserved-domain (`@telegram.local`) attach-email handling already applies.

**Claim-eligibility predicate (security boundary):**

```
claimable  ⟺  PreRegistered == true  &&  TelegramUserId == ""
```

- After a claim, `TelegramUserId` is set → the row is permanently no longer claimable. `PreRegistered` stays `true` as historical fact.
- A normal account whose account name coincidentally equals a Telegram username has `PreRegistered == false` → **never** auto-claimed. This prevents account takeover.

The **only** storage change is the one new `bool PreRegistered` column on `UserEntity`. No new tables; matching keys off `userId` directly (Approach A).

### 2. Import flow

**Endpoint:** `POST /api/v1/admin/events/{eventId}/preregister` — reuses the same admin guard as the sibling `/api/v1/admin/events/*` endpoints (no new permission key).

**Request:**

```json
{
  "attendees": [
    { "telegramUsername": "john_doe", "name": "John Doe", "gender": "male", "photoUrl": "https://.../p.jpg" }
  ]
}
```

`telegramUsername` and `name` are required per row; `gender` and `photoUrl` optional.

**New service:** `IUserPreRegistrationService` (`AzureUserPreRegistrationService` + `MockUserPreRegistrationService`) — keeps this out of the already-large auth service. Depends on the users table + email index, `IEventService` (attendee registration), and `IImageService` (photo download). Registered in `Program.cs` under the same `USE_AZURE_STORAGE` mode switch as sibling services.

**Per-row algorithm:**

1. Validate `telegramUsername` via `AccountNameValidator`. `InvalidFormat`/`Reserved` → result `invalidUsername`.
2. `userId = Normalize(username)`. Point-read `users` by `(GetPartitionKey(userId), userId)`. Exists → `skippedExists` (message notes whether it was already a shell or a real account).
3. Best-effort download `photoUrl` to the `profile-images` blob container (reuse the existing external-photo helper). Failure → empty photo; **not** a row failure.
4. Build and insert the shell `UserEntity` (Section 1) + `useremailindex` row. A `409` on insert (concurrent create) → `skippedExists`.
5. Register the new `userId` as an attendee of `{eventId}` via the existing staff registration path (no invite code required for staff).
6. Result → `created` (with the new `userId`).

**Response:**

```json
{
  "summary": { "created": 3, "skippedExists": 1, "invalidUsername": 1, "error": 0 },
  "results": [
    { "telegramUsername": "john_doe", "status": "created", "userId": "john_doe" },
    { "telegramUsername": "official", "status": "invalidUsername", "message": "reserved" }
  ]
}
```

Re-importing the same list is **idempotent** (all rows → `skippedExists`).

**Admin UI:** a "Pre-register attendees" section inside `AdminEventEditorPage.tsx`. Admin pastes a JSON array (or a simple one-attendee-per-line format), sees a preview table, submits, and gets a results table with the per-row statuses. `adminApi.preRegisterAttendees(eventId, rows)` follows the existing dual-mode `ADMIN_REQUIRES_API` pattern. Errors surfaced via `showApiError`.

### 3. Claim on first Telegram sign-in

A shared private helper `TryClaimPreRegisteredAsync(tgInfo)` is invoked in the **unknown-numeric-id** branch of **both** `TelegramLoginAsync` (browser widget) and `MiniAppLoginAsync` (Mini App), **before** they return `pending` / `needsRegistration`:

1. If the payload carries a `username`: `userId = Normalize(username)`; point-read `users`.
2. If found **and** claim-eligible (`PreRegistered && TelegramUserId == ""`): call `AttachTelegramToUserAsync(shell, tgInfo)` (imported photo is non-empty, so it is kept), persist, issue the JWT pair → **`signedIn`**. The person never sees the registration wizard.
3. Otherwise (no username / no row / row is a real non-shell account / already claimed) → fall through to the **existing** `pending` / `needsRegistration` path, unchanged.

`MockAuthService` gets the same helper for parity so mock mode and unit tests exercise the claim. Concurrency is handled by `AttachTelegramToUserAsync`'s atomic `usertelegramindex` insert (race → exactly one winner; the loser falls through).

---

## Edge cases & error handling

- **Username changed since import** — live Telegram username no longer matches any shell → no claim → normal registration creates a fresh account; the shell is left orphaned (still visible as an attendee). Accepted limitation; admin can re-import a corrected list. Not solved (YAGNI).
- **Reserved / too-short / malformed username** — cannot become a valid `userId` → `invalidUsername` row result; the rest of the batch proceeds.
- **Duplicate rows within one batch** — first → `created`, rest → `skippedExists` (same resolved `userId`).
- **Collision with an existing real account name** — point-read finds `PreRegistered == false` → `skippedExists` on import; and on login that account is never auto-claimed (predicate fails). No takeover.
- **Photo download failure** — best-effort; account still created with empty photo.
- **Name sanitization** — imported `name` passes through `HtmlGuard` (same as `UpdateUser`); `photoUrl` validated as a well-formed http(s) URL before fetch.
- **Shell accrued activity before claim** — likes/messages/matches are keyed on `userId`, stable through claim → preserved and visible post-claim. No migration.
- **Claim race** — atomic `usertelegramindex` insert → one winner.

---

## Testing

**Backend (xUnit):**
- `UserPreRegistrationServiceTests` — created / skippedExists (shell + real-name collision) / invalidUsername (reserved + short) / attendee-registration side effect / photo best-effort failure / batch duplicate / idempotent re-import.
- Claim tests in both `AzureAuthService` and `MockAuthService` (widget + Mini App): shell + matching username → `signedIn` with `telegram` linked and `usertelegramindex` written; real non-shell same-name → not claimed (pending/needsRegistration); already-claimed shell → normal id sign-in; username mismatch/absent → pending/needsRegistration.
- Assembly already disables test parallelization (static `MockDataStore`) — no new harness work.

**Frontend (Vitest + RTL):**
- `adminApi` dual-mode test for `preRegisterAttendees` (mock → `ADMIN_REQUIRES_API`; api → correct path/shape).
- Admin UI component test: parse pasted input → preview table; render per-row results (created/skipped/invalid) after submit; input-validation errors via `showApiError`.

**Manual verification:** backend in mock mode → import a small list via the admin UI → confirm shells appear in the event roster + swipe deck → simulate a Telegram sign-in with a matching username → confirm it links + signs in with no wizard.

---

## Out of scope

- Re-linking / merging an orphaned shell when a user's Telegram username changed before first login.
- Importing any profile fields beyond name / gender / photo / username (age, location, bio, etc.).
- CSV file upload (the UI accepts pasted JSON / line input; CSV can be added later if needed).
- Notifying pre-registered users (they have no linked channel until claimed).

---

## Storage change summary

| Change | Location |
|---|---|
| New `bool PreRegistered` column (default `false`) | `UserEntity` (`users` table) |
| No new tables | — |
| No new blob containers | photos reuse `profile-images` |
