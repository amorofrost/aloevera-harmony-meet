# Events, invites & registration — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement event invites (hash, expiry, rotation), `appconfig`-gated registration (`require_event_invite`), persist `registrationSourceEventId` on users at signup, secret event list/detail rules, remove `INVITE_CODE` env usage, and fix frontend event join state — per [2026-04-17-events-invites-registration-design.md](../specs/2026-04-17-events-invites-registration-design.md).

**Architecture:** Extend `AppConfig` + `AzureAppConfigService` with a `registration` partition row; add `EventInvite` Azure table + service; extend `EventDto`/`EventEntity` for visibility modes; extend auth register path to validate invites and call event registration; extend `UserEntity`/`UserDto`; add admin endpoint to mint invites; update React `Welcome`, `eventsApi`, `usersApi`, `AloeVera`, `EventDetails`.

**Tech Stack:** .NET 10 (Lovecraft), Azure Tables, React/TS/Vite (aloevera-harmony-meet), Vitest.

---

## File map (both repos)

**Lovecraft (`D:\src\lovecraft\Lovecraft\`)**


| Area              | Files                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App config        | `Lovecraft.Backend/Services/AppConfig.cs`, `Azure/AzureAppConfigService.cs`, `MockAppConfigService.cs`, `IAppConfigService.cs`                                                                        |
| App config entity | `Lovecraft.Backend/Storage/Entities/AppConfigEntity.cs`                                                                                                                                               |
| Seeder            | `Lovecraft.Tools.Seeder/Program.cs`                                                                                                                                                                   |
| Event invites     | **New:** `Storage/Entities/EventInviteEntity.cs`, `Storage/TableNames.cs` (add), `Services/IEventInviteService.cs`, `Services/Azure/AzureEventInviteService.cs`, `Services/MockEventInviteService.cs` |
| Events            | `Lovecraft.Common/DTOs/Events/EventDtos.cs`, `Storage/Entities/EventEntity.cs`, `Services/*EventService*.cs`, `Controllers/V1/EventsController.cs`                                                    |
| Auth              | `Services/Azure/AzureAuthService.cs`, `Services/MockAuthService.cs`, `Controllers/V1/AuthController.cs`, `Lovecraft.Common/DTOs/Auth/AuthDtos.cs`                                                     |
| Users             | `Lovecraft.Common/DTOs/Users/UserDto.cs`, `Storage/Entities/UserEntity.cs`, mapping in `AzureUserService` / `MockUserService`                                                                         |
| Admin             | `Controllers/V1/AdminController.cs` (or dedicated controller)                                                                                                                                         |
| DI                | `Lovecraft.Backend/Program.cs`                                                                                                                                                                        |
| Tests             | `Lovecraft.UnitTests/AuthenticationTests.cs`, new `EventInviteTests.cs` or extend existing                                                                                                            |


**Frontend (`D:\src\aloevera-harmony-meet\`)**


| Area       | Files                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| API        | `src/services/api/authApi.ts`, `usersApi.ts`, `eventsApi.ts`                    |
| Types      | `src/types/user.ts`                                                             |
| Pages      | `src/pages/Welcome.tsx`, `src/pages/AloeVera.tsx`, `src/pages/EventDetails.tsx` |
| Validators | `src/lib/validators.ts`                                                         |
| Tests      | `src/pages/__tests__/Welcome.test.tsx`                                          |


---

### Task 1: AppConfig — `require_event_invite`

**Files:**

- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/AppConfig.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Azure/AzureAppConfigService.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/MockAppConfigService.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/AppConfigEntity.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Tools.Seeder/Program.cs`
- **Step 1:** Add `public const string PartitionRegistration = "registration";` to `AppConfigEntity.cs`.
- **Step 2:** Add a small record, e.g. `public record RegistrationConfig(bool RequireEventInvite)`, and extend `AppConfig` to include `RegistrationConfig Registration` (or nest under existing record — prefer top-level property on `AppConfig`).
- **Step 3:** In `AzureAppConfigService.BuildConfig`, after building ranks/perms, read rows where `PartitionKey == AppConfigEntity.PartitionRegistration`. RowKey `require_event_invite`, value `true`/`false` (case-insensitive). Default `RequireEventInvite = false` if missing.
- **Step 4:** `MockAppConfigService`: return `RegistrationConfig(false)` in the static `AppConfig`.
- **Step 5:** Seeder: `UpsertAppConfigAsync("registration", "require_event_invite", "false");` (or `true` for prod docs — match team choice; default `false` for dev).
- **Step 6:** `dotnet build` on `Lovecraft.sln`; fix compile errors across any `new AppConfig(...)` call sites by adding the new constructor argument.
- **Step 7:** Commit: `feat(backend): add appconfig registration.require_event_invite`

---

### Task 2: Auth — `GetRegistrationConfig` + remove `INVITE_CODE`

**Files:**

- Modify: `lovecraft/Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs` — change `RegistrationConfigDto` to `bool RequireEventInvite` (or add property alongside legacy for one PR — prefer **replace** `InviteCodeRequired` with `RequireEventInvite` to match spec).
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs` — inject `IAppConfigService`, `GetRegistrationConfig` returns `(await _appConfig.GetConfigAsync()).Registration.RequireEventInvite`.
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs` — delete `INVITE_CODE` block (lines ~60–65 area).
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs` — delete `INVITE_CODE` block; **do not** add invite logic yet (Task 4).
- **Step 1:** Update DTO and controller; run `dotnet build`.
- **Step 2:** Update `Lovecraft.UnitTests/AuthenticationTests.cs` — remove or rewrite `WithInviteCode` / `INVITE_CODE` tests; add test: when `MockAppConfigService` returns `RequireEventInvite = true`, register without code fails (once register validation exists in Task 4). For this task, only test `GetRegistrationConfig` endpoint if exposed, or skip until integration.
- **Step 3:** Commit: `feat(auth): registration-config from appconfig; remove INVITE_CODE env`

---

### Task 3: Event visibility + `EventInvite` storage skeleton

**Files:**

- Modify: `lovecraft/Lovecraft/Lovecraft.Common/DTOs/Events/EventDtos.cs`
- Modify: `lovecraft/Lovecraft/Lovecraft.Backend/Storage/Entities/EventEntity.cs`
- Add enum: `Lovecraft.Common/Enums/EventVisibility.cs` — `Public`, `SecretHidden`, `SecretTeaser` (JSON camelCase).
- Add: `EventInviteEntity.cs`, extend `TableNames.cs`, register table creation in invite service ctor.

**Spec mapping:** Replace or complement `IsSecret: bool` — either migrate to `Visibility` only, or keep `IsSecret` as derived `Visibility != Public`. Simplest: add `EventVisibility Visibility { get; set; }` to DTO/entity; map legacy `IsSecret == true` → `SecretHidden` when reading old rows if needed.

- **Step 1:** Add enum + DTO/entity fields; map in Azure/Mock event services.
- **Step 2:** Seeder: set visibility on seeded events (mostly `Public`; one `SecretTeaser` / `SecretHidden` for manual QA).
- **Step 3:** Commit: `feat(events): event visibility enum and storage fields`

---

### Task 4: `IEventInviteService` + hash + validation API

**Files:**

- Add: `Lovecraft.Backend/Services/IEventInviteService.cs`
- Add: `Lovecraft.Backend/Services/Azure/AzureEventInviteService.cs`
- Add: `Lovecraft.Backend/Services/MockEventInviteService.cs`
- Modify: `Lovecraft.Backend/Program.cs` — register by `USE_AZURE_STORAGE`.

**Methods (minimum):**

- `Task<EventInviteValidationResult?> ValidateCodeAsync(string plainCode, CancellationToken ct)` — returns null if invalid; on success returns `eventId`, `inviteRowId`.
- `Task<EventInviteEntity> CreateOrRotateInviteAsync(string eventId, DateTime expiresAt, ...)` — admin path; stores hash, revokes previous.

Use HMAC-SHA256 or PBKDF2 for `codeHash`; store random **salt per invite** on entity if using generic hash.

- **Step 1:** Unit tests in `Lovecraft.UnitTests` for hash validation, expiry, revocation.
- **Step 2:** Commit: `feat(backend): event invite service`

---

### Task 5: User profile — `RegistrationSourceEventId`

**Files:**

- Modify: `UserEntity.cs` — `public string? RegistrationSourceEventId { get; set; }` (and optional `RegistrationSourceRedeemedAt`).
- Modify: `UserDto.cs` — same properties.
- Modify: `AzureUserService` / `MockUserService` — map to/from entity; include in `GetUserById` / `GetCurrentUser` mapping.
- **Step 1:** Azure user upsert paths must persist new columns (Table Storage accepts new props).
- **Step 2:** Commit: `feat(users): registration source event fields`

---

### Task 6: `RegisterAsync` — wire invites + attendance + profile

**Files:**

- Modify: `AzureAuthService.cs`, `MockAuthService.cs`
- Inject: `IAppConfigService`, `IEventInviteService`, `IEventService` (for `RegisterForEventAsync` or equivalent)

**Logic:**

1. Load `Registration.RequireEventInvite`.
2. If `true` and `string.IsNullOrWhiteSpace(request.InviteCode)` → throw `InvalidInviteCodeException` or new `InviteRequiredException` mapped to `INVITE_REQUIRED`.
3. If `false` and no code → register user without source (existing flow + new nullable fields null).
4. If code present → `ValidateCodeAsync`; on failure throw invalid; on success note `eventId`.
5. Create user entity; set `RegistrationSourceEventId = eventId` **only when** code was validated at signup; set `RegistrationSourceRedeemedAt = UtcNow` if applicable.
6. Call event service to add user to `eventId` attendees (same as register endpoint).

**Transaction:** Azure Tables are not single transactional — order: validate invite → create user → add attendee; if attendee fails, log + compensate (delete user) or document eventual consistency; prefer **validate → create user with pending flag** only if needed — YAGNI: **validate → create user → register for event**; if last fails, delete user row (compensation).

- **Step 1:** Integration tests for register with/without invite, `RequireEventInvite` true/false.
- **Step 2:** Commit: `feat(auth): register with event invite and registration source`

---

### Task 7: Events API — list/detail gating + query param `inviteCode`

**Files:**

- Modify: `EventsController.cs`, `IEventService` implementations.

**List:** Filter out `SecretHidden` for normal listing; return teaser DTO for `SecretTeaser` (define `EventTeaserDto` or null sensitive fields on same DTO).

**Detail:** `GET /api/v1/events/{id}?inviteCode=xyz` — validate invite matches event; else if not attendee and not staff → 404.

- **Step 1:** Tests for list/detail.
- **Step 2:** Commit: `feat(events): secret visibility list and detail gating`

---

### Task 8: Admin — issue/rotate invite

**Files:**

- Modify: `AdminController.cs` or `EventsController` under `[Authorize]` + permission attribute `manage_events`.

**POST** body: `{ "expiresAt": "ISO8601" }`  
Response: `{ "plainCode": "...", "expiresAt": "..." }` once.

- **Step 1:** Commit: `feat(admin): rotate event invite code`

---

### Task 9: Frontend — API types and Welcome

**Files:**

- `aloevera-harmony-meet/src/services/api/authApi.ts` — `getRegistrationConfig` type `RequireEventInvite`; register payload unchanged (`inviteCode` optional).
- `aloevera-harmony-meet/src/lib/validators.ts` — conditional: if `requireEventInvite`, `inviteCode` required in `registerSchema` (use dynamic resolver pattern already in `Welcome.tsx` with ref).
- `aloevera-harmony-meet/src/pages/Welcome.tsx` — rename state from `inviteCodeRequired` to `requireEventInvite`; wire API.
- `aloevera-harmony-meet/src/types/user.ts` — add `registrationSourceEventId?: string` to `User` if displayed.
- **Step 1:** Update `Welcome.test.tsx` mocks to `requireEventInvite`.
- **Step 2:** `npm run test:run` in frontend.
- **Step 3:** Commit: `feat(frontend): registration config requireEventInvite`

---

### Task 10: Frontend — events join state + EventDetails

**Files:**

- `aloevera-harmony-meet/src/pages/AloeVera.tsx` — remove hardcoded `joinedEvents`; derive from `eventsApi.getEvents()` each event’s `attendees` includes current user id from `getCurrentUserIdFromToken()` or `usersApi.getCurrentUser()`.
- `aloevera-harmony-meet/src/pages/EventDetails.tsx` — replace `'current-user'` with JWT user id; pass `inviteCode` from `useSearchParams()` when calling `getEventById`.
- **Step 1:** Manual QA with Docker stack.
- **Step 2:** Commit: `fix(frontend): event attendance uses real user id`

---

### Task 11: Docs and deployment

**Files:**

- `lovecraft/README.md`, `lovecraft/Lovecraft/docs/DOCKER.md` — remove `INVITE_CODE`; document `registration` / `require_event_invite` in appconfig.
- `aloevera-harmony-meet/docs/superpowers/specs/2026-04-17-events-invites-registration-design.md` — mark **Status: Approved** if desired.
- **Step 1:** Commit: `docs: remove INVITE_CODE; document registration appconfig`

---

## Spec coverage check


| Spec section             | Tasks            |
| ------------------------ | ---------------- |
| §3 Replace INVITE_CODE   | Task 2, 6, 11    |
| §4.1 Visibility          | Task 3, 7        |
| §4.2 EventInvite         | Task 4, 8        |
| §4.3 Attendance          | Task 6, 7        |
| §4.4 Registration source | Task 5, 6, 9     |
| §5 API sketch            | Tasks 2, 6, 7, 8 |
| §6 Frontend              | Tasks 9, 10      |


---

## Self-review

- No TBD steps; order respects dependencies (AppConfig before auth register logic).
- Naming: align C# `RequireEventInvite` with TS `requireEventInvite` (camelCase API).

---

## Execution options

**Plan saved to:** `aloevera-harmony-meet/docs/superpowers/plans/2026-04-17-events-invites-registration.md`

1. **Subagent-driven (recommended)** — one subagent per task, review between tasks.
2. **Inline execution** — run tasks in this session in order with checkpoints.

**Execution:** Subagent-driven batches completed in-repo (2026-04-17).