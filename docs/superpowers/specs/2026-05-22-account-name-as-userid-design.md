# Account name as userId — Design

**Status:** Drafted 2026-05-22
**Scope:** Frontend (`aloevera-harmony-meet`) + backend (`lovecraft`)

## Summary

Add a required "account name" (login) field to all four registration paths. For new accounts, `userId` becomes the lowercased account name instead of a server-generated GUID. Existing accounts (with GUID `userId`s) are untouched. Account names are immutable, Telegram-style format, unique case-insensitively, and visible publicly as `@handle`. The registration form does a debounced live availability check.

## Goals

- Replace auto-generated GUID `userId` with a user-chosen handle for new registrations.
- Keep the schema change minimal — no cross-table rewrites, no migration script.
- Make `@handle` discoverable (own profile, other users, search, profile URLs).
- Live availability feedback during sign-up.

## Non-goals

- Backfilling existing GUID-userId accounts — they keep their userId and have no account name.
- Renaming account names later — immutable for now.
- Telegram synthetic-email scheme (`telegram_{tgId}@telegram.local`) — unchanged.
- Public unauthenticated profile pages — `/u/:accountName` is gated by `<ProtectedRoute>` like everything else.

## Identity model

- `users.RowKey` (= `userId`) for new accounts is `accountName.ToLowerInvariant()` — e.g. `alice_doe`.
- New column `UserEntity.AccountNameDisplay` stores the original typed casing — e.g. `Alice_Doe`. Empty string for existing GUID-userId rows.
- `PartitionKey` formula unchanged: `"user-" + userId[0]`. Works because the first char of a lowercased account name is always `[a-z]`.
- No new index table. Availability checks read `users[PK="user-{first}", RK="{lowercased}"]` directly; partition is derivable from the name itself.
- Existing GUID-userId accounts coexist in the same `users` table indefinitely. Both formats round-trip through every existing code path (likes, matches, messages, forum, chats, notifications, refresh tokens, blob paths) because `userId` is still a string.
- This design is correct only because account names are immutable — `userId == accountName` lets us skip the "second column with a foreign-key rewrite" complexity.

## Validation rules

Telegram-style, enforced on both client and server:

- Regex: `^[A-Za-z][A-Za-z0-9_]{4,31}$`
- Length: 5–32
- Uniqueness: case-insensitive (canonical form = `ToLowerInvariant()`)
- Reserved-name list (case-insensitive lowercased comparison):
  ```
  admin, root, system, support, help, api, auth, login, logout,
  register, settings, profile, user, users, me, you, search, feed,
  friends, talks, aloevera, aloeve, aloeband, telegram, google,
  official, mod, moderator, staff, undefined, null, anonymous, bot
  ```
  Kept in code (`Helpers/ReservedAccountNames.cs` on backend, `RESERVED_ACCOUNT_NAMES` constant in `src/lib/validators.ts` on frontend). Mirrors must stay in sync.

## Backend changes (`lovecraft`)

### DTOs (`Lovecraft.Common/DTOs/Auth/`)

Add a required `string AccountName` to each registration DTO:

- `RegisterRequestDto`
- `TelegramRegisterRequestDto`
- `TelegramMiniAppRegisterRequestDto`
- `GoogleRegisterRequestDto`

Add nullable `string? AccountName` to `UserInfo` (returned wherever the user object is serialised). Null for legacy GUID-userId accounts.

New DTO `AccountNameAvailabilityDto { bool Available; string? Reason; }` where `Reason` is `"invalidFormat" | "reserved" | "taken"`.

### Entity (`Lovecraft.Backend/Storage/Entities/UserEntity.cs`)

Add `public string AccountNameDisplay { get; set; } = string.Empty;`. Default empty for backwards compatibility with existing rows. No partition-key change.

### Helper (`Lovecraft.Backend/Helpers/AccountNameValidator.cs`)

New helper class:

- `public static class AccountNameValidator`
- `public static AccountNameValidationResult Validate(string raw)` — returns one of `Ok`, `InvalidFormat`, `Reserved`
- `public static string Normalize(string raw)` — trim + ToLowerInvariant
- Internal regex + `HashSet<string>` of reserved names (case-insensitive comparer)

### Services (`IAuthService` + `AzureAuthService` + `MockAuthService`)

**New method on `IAuthService`:**

```csharp
Task<AccountNameAvailabilityDto> CheckAccountNameAvailabilityAsync(string name);
```

Implementation:
1. `AccountNameValidator.Validate(name)` → return `{ Available: false, Reason: "invalidFormat" | "reserved" }` on fail.
2. Compute lowercased canonical + partition. Look up `users[PK, RK]`. 404 → `{ Available: true }`. 200 → `{ Available: false, Reason: "taken" }`.

**All four `*RegisterAsync` methods** (`RegisterAsync`, `TelegramRegisterAsync`, `MiniAppRegisterAsync`, `GoogleRegisterAsync`):

- Call `AccountNameValidator.Validate(request.AccountName)` first; throw `InvalidAccountNameException` on fail.
- Replace `var userId = Guid.NewGuid().ToString()` with `var userId = AccountNameValidator.Normalize(request.AccountName)`.
- Set `userEntity.AccountNameDisplay = request.AccountName.Trim()`.
- Replace `_usersTable.UpsertEntityAsync(userEntity)` with `_usersTable.AddEntityAsync(userEntity)`. **Sequence the writes**: users table first, then email index (currently in `Task.WhenAll`) — so on 409 from users we know the email index hasn't been written and there's nothing to clean up. Catch `RequestFailedException` with `Status == 409` on the users write → throw `AccountNameTakenException`. The Telegram/Google flows write their respective index tables (`telegramIndexTable.AddEntityAsync` / `googleIndexTable.AddEntityAsync`) *before* the users row today as their atomic "claim this provider id" step; that order stays the same, but if the users write subsequently 409s on the account name, those index rows must be rolled back (extend the existing catch blocks).
- `IssueJwtPairAsync` and the explicit register responses populate `UserInfo.AccountName` from `AccountNameDisplay`.

**New exceptions** (in `Lovecraft.Backend/Services/`):

- `InvalidAccountNameException(string reason)` — `reason` is `"invalidFormat"` or `"reserved"`.
- `AccountNameTakenException`.

### Controllers

**`AuthController`:**

- New action:
  ```csharp
  [HttpGet("account-name-availability")]
  [EnableRateLimiting("AuthRateLimit")]
  public async Task<IActionResult> CheckAccountNameAvailability([FromQuery] string name)
  ```
- Map `InvalidAccountNameException` → 400 with code `INVALID_ACCOUNT_NAME` and the specific reason in the message.
- Map `AccountNameTakenException` → 409 with code `ACCOUNT_NAME_TAKEN`.

**`UsersController`:**

- New action:
  ```csharp
  [HttpGet("by-account-name/{name}")]
  public async Task<IActionResult> GetByAccountName(string name)
  ```
- Lowercase `name`, compute PK, fetch from users table. Return 404 if the row doesn't exist OR `AccountNameDisplay` is empty (i.e. it's a legacy GUID-userId row that happened to be reachable by lowercased lookup). Otherwise return the full user DTO.
- Existing `GET /users/{id}` is unchanged.

### Tests (`Lovecraft.UnitTests`)

- New `AccountNameValidatorTests` — regex boundaries, reserved-name matches (case-insensitive), normalize behaviour.
- New `AccountNameAvailabilityTests` — endpoint returns each reason; format precedes reserved precedes taken.
- Extend `AuthenticationTests`: register-with-account-name happy path for local/Telegram/Google; race-loss `ACCOUNT_NAME_TAKEN`; invalid format rejected before any DB write.
- `UsersControllerTests`: `by-account-name` 404 for legacy GUID rows, 200 for new rows.

## Frontend changes (`aloevera-harmony-meet`)

### Shared component — `src/components/ui/account-name-input.tsx`

Controlled input handling the entire pick-a-name UX. Reused on all four registration screens.

Props:
```ts
interface AccountNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  prefillSuggestion?: string;
  id?: string;
}
```

Behaviour:
- Internal state `status: 'idle' | 'checking' | 'available' | 'invalidFormat' | 'reserved' | 'taken'`.
- 400ms debounce on `value` changes; skip the network call if local format check fails (sets `status: 'invalidFormat'`).
- `AbortController` cancels in-flight requests when the user types again or the component unmounts.
- Calls `authApi.checkAccountNameAvailability(name)` only after local format passes.
- Renders the input plus a status row underneath (icon + i18n-resolved message).
- Reports `valid = status === 'available'` via `onValidityChange` so the parent form can disable Submit.
- `prefillSuggestion`: written into `value` once on mount if the parent passes a non-empty string and the input is empty.

### `src/lib/validators.ts`

Add shared schema:

```ts
const ACCOUNT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const RESERVED_ACCOUNT_NAMES = new Set<string>([/* mirror of backend list */]);

export const accountNameSchema = z.string()
  .regex(ACCOUNT_NAME_RE, 'Invalid format')
  .refine(v => !RESERVED_ACCOUNT_NAMES.has(v.toLowerCase()), 'Reserved name');
```

Extend the four register schemas:

```ts
export const registerSchema = z.object({ ..., accountName: accountNameSchema, ... });
export const telegramRegisterSchema = z.object({ ..., accountName: accountNameSchema, ... });
export const googleRegisterSchema = telegramRegisterSchema; // unchanged identity
```

`*WithInvite` variants inherit the field automatically through `.extend()`.

### `src/services/api/authApi.ts`

- Add `accountName: string` to `RegisterRequest`, `TelegramRegisterRequest`, `TelegramMiniAppRegisterRequest`, `GoogleRegisterRequest`.
- Add `accountName?: string` to the `user` shape on `AuthResponse`.
- New method:
  ```ts
  checkAccountNameAvailability(name: string): Promise<{ available: boolean; reason?: 'invalidFormat' | 'reserved' | 'taken' }>
  ```
  Dual-mode. Mock returns `{ available: true }` for valid names; `{ available: false, reason: 'reserved' }` for reserved; `{ available: false, reason: 'invalidFormat' }` for bad format.

### `src/services/api/usersApi.ts`

- New `getUserByAccountName(name: string): Promise<ApiResponse<User | null>>`.

### `src/types/user.ts`

- Add `accountName?: string` to `User`.

### Pages — add the field

Same pattern in all four:
- `Welcome.tsx` (local register form)
- `WelcomeTelegram.tsx`
- `WelcomeGoogle.tsx`
- `MiniAppEntry.tsx` (inline wizard)

Each:
1. Adds `<AccountNameInput>` controlled by `react-hook-form` `Controller`.
2. Tracks the input's `valid` state, disables Submit when invalid.
3. Passes a `prefillSuggestion`: Telegram form uses Telegram `username` if it matches the regex; Google form uses sanitized part-before-@ of Google email; local + Mini App pass nothing.
4. Includes `accountName` in the submit payload.
5. Maps `ACCOUNT_NAME_TAKEN` server error → `form.setError('accountName', { message: ... })`.

### Profile route `/u/:accountName`

New page `src/pages/UserProfile.tsx`:
- Reads param via `useParams<{ accountName: string }>()`.
- Fetches with `usersApi.getUserByAccountName(accountName)`.
- 404 → friendly empty state with link back to `/friends`.
- Found → renders profile card + bio + photos + favorite song + events attended.
- Extracted shared `<ProfileBody user={...} />` component (in `src/components/profile/`) used by this page and by the swipe-card expanded view, so the same layout/photo grid/song/events code is reused.
- Wrapped in `<ProtectedRoute>` like the rest of the content.

`App.tsx` adds the route after the existing profile-content routes.

### `@handle` rendering

`src/components/ui/user-badges.tsx`:
- Add optional `accountName?: string` prop.
- When present, render `@{accountName}` between the rank dot and the staff pill (small muted text).
- Existing call sites pass `accountName={user.accountName}` from the user object. Where the user object isn't already in scope (some chat-list rendering uses a slim partner DTO), thread it through — minor.

Call sites to update:
- `Friends.tsx` swipe-card and chat-list items
- `TopicDetail` reply headers
- `SettingsPage` display-name row
- (Anywhere else `<UserBadges>` is rendered with a known user)

### Find-by-handle

`Friends.tsx` search tab:
- Small input above the swipe deck: "Find by @handle".
- On submit, `navigate('/u/' + value.trim().toLowerCase())`. The `UserProfile.tsx` page handles 404. Casing is folded in the link because the backend lowercases anyway; the displayed `@handle` in the profile body comes from `user.accountName` (original casing).
- i18n keys `friends.findByHandle` and `friends.findByHandlePlaceholder`.

### i18n

New keys in `src/contexts/LanguageContext.tsx` for both `ru` and `en`:
- `auth.accountName`
- `auth.accountNamePlaceholder`
- `auth.accountNameHint` (e.g. "5–32 letters/digits/underscores, must start with a letter")
- `auth.accountNameAvailable`
- `auth.accountNameTaken`
- `auth.accountNameInvalid`
- `auth.accountNameReserved`
- `auth.accountNameChecking`
- `friends.findByHandle`
- `friends.findByHandlePlaceholder`

### Mock data

- Pre-existing mock users in `src/data/mockUsers.ts` get a stable `accountName` field populated (e.g. `user1`, `user2`, `user3`, `user4`) so search-by-handle and `/u/{accountName}` route work in mock mode.
- Mock `authApi.register*` includes `accountName` in the response `user` object.
- Mock `usersApi.getUserByAccountName` searches the mockUsers list (case-insensitive).
- Mock `authApi.checkAccountNameAvailability` checks the same mockUsers list for collisions (plus runs the format + reserved checks).

### Tests

- `account-name-input.test.tsx` — debounce, status transitions, AbortController on rapid typing.
- `validators.test.ts` — boundary cases on the new schema.
- Extend `Welcome.test.tsx` / `WelcomeTelegram.test.tsx` / `WelcomeGoogle.test.tsx` to assert the field appears and is required.

## Edge cases

- **Race on simultaneous registration of the same name.** Two clients pass the availability check at the same time and both submit register. The first call wins via `_usersTable.AddEntityAsync` → 409 on the second. Frontend translates to inline `ACCOUNT_NAME_TAKEN` error on the `accountName` field.
- **User registers with valid casing variants of a reserved/taken name.** All comparisons happen on `ToLowerInvariant()` so `Admin` / `admin` / `ADMIN` all collide identically.
- **First-char of account name is a letter** — guaranteed by the regex, so the partition formula is safe (no risk of `user-1`-bucket collision with future digit-starting names).
- **`UserCache` consistency** — `_userCache.Set(userEntity)` already runs after a successful users-table write in every register path; that pattern is preserved with the new `AccountNameDisplay` field carried.
- **JWT claims** — `userId` (the `nameid` claim) is now the lowercased account name for new accounts. Frontend's `getCurrentUserIdFromToken()` already returns that string verbatim; nothing changes in consumers.
- **`UsersController.GetByAccountName`** returns 404 for legacy GUID rows that *coincidentally* round-trip through a lowercased lookup, by checking `AccountNameDisplay != ""`. Prevents leaking legacy accounts via the by-handle endpoint.
- **Telegram synthetic email** stays `telegram_{tgId}@telegram.local` — it's in the `Email` field, which is decoupled from the account-name field. No collision.
- **Backwards compatibility on `GET /users/{id}`** — unchanged. Routes that already store/embed GUID userIds keep working.

## Rollout

Single-shot deploy. No migration. Existing accounts continue to function with empty `AccountNameDisplay`; new accounts get the field on registration.

## Open questions

None remaining.
