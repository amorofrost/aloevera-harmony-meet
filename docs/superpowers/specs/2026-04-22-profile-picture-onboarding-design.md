# Profile picture required during signup (Web + Telegram)

**Date**: 2026-04-22  
**Repos in scope**: `aloevera-harmony-meet/` (frontend), `lovecraft/` (backend)  
**Status**: Draft (needs user approval)

## Goal

When creating a new account from:

- **Web**: `Welcome` page flow
- **Telegram Mini App**: `WelcomeTelegram` flow

…the user must **choose/upload a profile picture** *before* the backend creates a real user account and before any account becomes usable.

Constraints:

- **Invite code validation** (if required by policy) must occur before final account creation.
- **Profile picture rules**:
  - Required: **yes**
  - Crop: **square crop enforced** (1:1)
  - Formats: **jpg/jpeg, png only**
  - Max upload size: **10 MB**
  - Minimum resolution: **at least 256×256**
  - Backend stores an optimized/normalized image (resize/compress “like now”).

## Non-goals

- Implementing OAuth or Telegram auth provider linking.
- Adding a full AuthContext on the frontend (keep current `apiClient`-driven approach).
- Adding multi-photo galleries during signup (only single profile image).

## Chosen approach (Option A)

Create a short-lived **PendingRegistration** “registration session” after validating invite code and other form fields. The profile image is uploaded and stored **staged** (temporary) keyed by the pending registration id. Only after image upload succeeds do we “finalize” which creates the user record and triggers verification email flow (if applicable).

This avoids creating real user rows for abandoned signups, keeps Web+Telegram aligned, and makes cleanup straightforward via TTL.

## User experience

### Web (Welcome)

1. **Step 1 — Profile form** (existing fields)
   - Display name, email, password, age, gender, location, invite code (if required), etc.
2. **Step 2 — Upload profile picture (required)**
   - File picker accepts jpg/png
   - Client-side crop UI enforces square crop (preferred) OR a simpler “center-crop on backend” fallback.
3. **Step 3 — Create account**
   - Finalize call creates the user + triggers email verification workflow (if required for local auth).

### Telegram (WelcomeTelegram)

1. **Step 1 — Profile form** (existing fields + Telegram identity)
   - Invite code required if policy says so (same as web)
2. **Step 2 — Confirm/change profile picture**
   - Default selection comes from Telegram profile photo (as today)
   - User can replace it via file picker if Telegram client supports it, otherwise via URL fetch of Telegram photo.
3. **Step 3 — Create account**
   - Finalize creates the user.

## Backend design

### New entities / tables (Azure Table Storage)

Add a dedicated table for pending registrations.

- **Table**: `pendingregistrations` (name to match existing conventions)
- **PartitionKey**: `PENDING`
- **RowKey**: `{pendingRegistrationId}` (GUID as string)
- **TTL strategy**:
  - Store `ExpiresAt` and perform periodic cleanup in a background job (or opportunistic cleanup on reads/writes).
  - Initial TTL: **24 hours** (configurable).

**PendingRegistrationEntity fields (minimum):**

- `PendingRegistrationId` (guid/string, same as RowKey)
- `CreatedAt`, `ExpiresAt`
- `Secret` (random, high-entropy string) — acts like a bearer token for upload/finalize so the pending id cannot be guessed/abused
- `InviteCode` (string, optional)
- `RequireInvite` (bool snapshot of policy decision)
- `RegistrationMethod` (`web` | `telegram`)
- **User profile draft fields** needed to create the user on finalize:
  - `Email`
  - `PasswordHash/Salt` (preferred) — never store a plain password in the pending entity
  - `DisplayName`, `Age`, `Gender`, `Location`, `Bio` (if applicable)
  - Telegram identifiers if flow is Telegram-based
- **Staged image pointer**
  - `StagedProfileImageBlobKey` (string) OR `StagedProfileImageUrl`

Notes:

- Do **not** issue JWT tokens at start; tokens are returned only on finalize success (same as current register behavior).
- Any uniqueness checks that matter (email already taken) should happen at finalize as well (race-safe), but we may also pre-check at start for fast feedback.

### Staged image storage (Azure Blob)

Use a temporary blob prefix for staged registration uploads.

- Container: reuse existing image container if present, or add `staged-profile-images`
- Key format:
  - `pending/{pendingRegistrationId}/profile.{ext}`
- On finalize:
  - Validate the staged blob exists
  - Process/resize/compress
  - Copy/move to permanent location:
    - `profile-images/{userId}/profile.jpg` (normalized to jpg)
  - Delete staged blob(s)

### API endpoints

All endpoints return the standard `ApiResponse<T>` envelope.

#### 1) Start registration

`POST /api/v1/auth/registration/start`

Validates:

- Invite code rules (based on appconfig policy)
- Basic field validation (age bounds, email format, password strength, etc.)

Returns:

- `pendingRegistrationId`
- `pendingRegistrationSecret`
- `expiresAt`
- `requireEmailVerification` (if applicable)

#### 2) Upload staged profile picture

`POST /api/v1/auth/registration/{pendingRegistrationId}/profile-picture`

- `multipart/form-data` with a single file field, e.g. `file`
- Auth: `X-Pending-Registration-Secret: <pendingRegistrationSecret>` header (or include in body); required to prevent guessing the id
- Validations:
  - content-type + magic bytes (jpg/png)
  - <= 10MB
  - min dimensions >= 256×256 (after decoding)
  - enforce square crop by requiring a square image upload (client-side crop), or accept crop params and crop server-side (see “Cropping” below)

Processing:

- Store staged original (optional)
- Store processed normalized image (recommended) and overwrite staged key

Returns:

- `stagedProfileImageUrl` (optional) for preview

#### 3) Finalize registration (create user)

`POST /api/v1/auth/registration/finalize`

Body:

```json
{ "pendingRegistrationId": "..." }
```

Auth:

- `X-Pending-Registration-Secret: <pendingRegistrationSecret>`

Validations:

- PendingRegistration exists and not expired
- Staged profile image exists
- Final uniqueness checks (email not taken, telegram id not already linked, etc.)

Effects:

- Create the real user entities (user profile + settings + preferences as needed)
- Move/copy staged profile image to permanent user profile image location
- Send verification email if required
- Issue JWT access + refresh tokens (matching current `register` behavior)
- Delete PendingRegistration

#### 4) Cancel registration (optional but recommended)

`DELETE /api/v1/auth/registration/{pendingRegistrationId}`

- Auth: `X-Pending-Registration-Secret: <pendingRegistrationSecret>`
- Deletes pending record and staged blobs.

### Cropping (square requirement)

We enforce a 1:1 profile picture via **client-side crop** so the backend receives an already-square image. This keeps backend simpler and produces consistent UX across Web + Telegram.

Fallback (allowed if Telegram client limitations make cropping hard):

- Backend accepts `crop` parameters (x/y/size) alongside the uploaded image and performs the crop before resizing/normalizing.

### Compatibility / migration

- Keep existing `POST /api/v1/auth/register` and Telegram login endpoints initially for backwards compatibility.
- Frontend `Welcome` and `WelcomeTelegram` will migrate to the new 2-step flow.
- Eventually, legacy direct register endpoints can be removed once clients are updated.

## Frontend design

### Service layer additions

Add `registrationApi.ts` under `src/services/api/` with mock+api dual-mode:

- `startRegistration(payload)`
- `uploadProfilePicture(pendingId, pendingSecret, fileOrBlob)`
- `finalizeRegistration(pendingId, pendingSecret)`
- `cancelRegistration(pendingId, pendingSecret)` (optional)

### Page flow updates

#### `Welcome` (web)

- On “Next” after form validation:
  - call `registrationApi.startRegistration(...)`
  - navigate to an in-page “Upload photo” step
- Upload step:
  - enforce square crop UI
  - call `registrationApi.uploadProfilePicture(pendingId, secret, file)`
  - show preview of staged result
- Final step:
  - call `registrationApi.finalizeRegistration(...)`
  - on success: store `access_token` + `refresh_token`, route to `/friends` (same as today)

#### `WelcomeTelegram` (Telegram Mini App)

- After profile fields + invite validation:
  - call `startRegistration` to obtain pending id + secret
- Photo step:
  - default photo source: Telegram profile photo (existing behavior)
  - user can replace with uploaded jpg/png (if supported)
  - otherwise: fetch Telegram photo as a blob, present crop UI, then upload
- Finalize:
  - call `finalizeRegistration` and proceed as current flow does on success

### Mock mode behavior

In `VITE_API_MODE=mock`, `registrationApi` should simulate:

- returning a fake `pendingRegistrationId` + `secret`
- accepting an uploaded image and returning a placeholder/stub URL
- finalizing by creating a new mock user entry in memory (same persistence limitations as current mock mode)

