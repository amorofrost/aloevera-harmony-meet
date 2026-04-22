# Profile picture onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a profile picture during signup (Web + Telegram), by introducing a PendingRegistration flow (start → upload photo → finalize) so no real user record is created until a photo is staged.

**Architecture:** Add new backend registration-session endpoints under `AuthController` plus a storage-backed pending registration entity (Azure Table) and staged blob storage. Update frontend `Welcome.tsx` and `WelcomeTelegram.tsx` to use a new `registrationApi` service and a mandatory photo step with deterministic center-crop-to-square on the client.

**Tech Stack:** React 18 + TypeScript + Vite + Vitest/RTL (frontend), .NET 10 + xUnit + Azure Tables/Blobs + ImageSharp (backend).

---

## Target file map (locked-in)

### Frontend (`aloevera-harmony-meet/`)

- Create:
  - `src/services/api/registrationApi.ts` (start/upload/finalize/cancel; mock+api)
  - `src/lib/imageSquare.ts` (center-crop to square + export)
  - `src/components/ui/profile-picture-step.tsx` (shared photo step UI for web + telegram wizard)
- Modify:
  - `src/services/api/index.ts` (export `registrationApi`)
  - `src/pages/Welcome.tsx` (register flow becomes wizard: form → photo → finalize)
  - `src/pages/WelcomeTelegram.tsx` (create flow becomes wizard: form → photo → finalize)
- Tests:
  - `src/pages/__tests__/Welcome.test.tsx` (update register tests to match wizard)
  - Create `src/pages/__tests__/WelcomeTelegram.test.tsx`
  - Create `src/services/api/registrationApi.test.ts`

### Backend (`lovecraft/`)

- Create:
  - `Lovecraft/Lovecraft.Common/DTOs/Auth/RegistrationDtos.cs` (new DTOs: start/upload/finalize responses/requests)
  - `Lovecraft/Lovecraft.Backend/Storage/Entities/PendingRegistrationEntity.cs`
  - `Lovecraft/Lovecraft.Backend/Services/IPendingRegistrationService.cs`
  - `Lovecraft/Lovecraft.Backend/Services/Azure/AzurePendingRegistrationService.cs`
  - `Lovecraft/Lovecraft.Backend/Services/MockPendingRegistrationService.cs`
- Modify:
  - `Lovecraft/Lovecraft.Backend/Storage/TableNames.cs` (add `PendingRegistrations`)
  - `Lovecraft/Lovecraft.Backend/Services/IServices.cs` (register `IPendingRegistrationService` in DI via `Program.cs` patterns)
  - `Lovecraft/Lovecraft.Backend/Program.cs` (DI wiring; table creation when Azure mode)
  - `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs` (new endpoints)
  - `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs` (finalize path reuses existing user creation + invite validation)
  - `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs` (finalize path in mock mode)
  - `Lovecraft/Lovecraft.Backend/Services/Azure/AzureImageService.cs` (optional: helper for “staged upload normalization” if reused)
- Tests:
  - Create `Lovecraft/Lovecraft.UnitTests/PendingRegistrationTests.cs`
  - Extend `Lovecraft/Lovecraft.UnitTests/ImageTests.cs` with staged-upload validation tests (size/type/min-res)

---

## Shared constants (must match spec)

- Max upload size: **10 MB**
- Allowed formats: **JPEG, PNG**
- Min resolution: **256×256**
- Square required: **yes** (enforced by client-side crop; server rejects non-square unless crop params are implemented)
- Pending registration TTL: **24 hours**
- Pending secret: required header `X-Pending-Registration-Secret`

---

## Task 1: Backend — add DTOs for pending registration flow

**Files:**
- Create: `Lovecraft/Lovecraft.Common/DTOs/Auth/RegistrationDtos.cs`

- [ ] **Step 1: Write the DTOs**

```csharp
using System;

namespace Lovecraft.Common.DTOs.Auth;

public sealed class RegistrationStartRequestDto
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string Name { get; set; } = "";
    public int Age { get; set; }
    public string Gender { get; set; } = "";
    public string Location { get; set; } = "";
    public string? Bio { get; set; }
    public string? InviteCode { get; set; }
}

public sealed class RegistrationStartResponseDto
{
    public string PendingRegistrationId { get; set; } = "";
    public string PendingRegistrationSecret { get; set; } = "";
    public DateTime ExpiresAtUtc { get; set; }
    public bool RequireEmailVerification { get; set; }
}

public sealed class RegistrationFinalizeRequestDto
{
    public string PendingRegistrationId { get; set; } = "";
}
```

- [ ] **Step 2: Build the backend solution**

Run from `lovecraft/Lovecraft/`:

```bash
dotnet build
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add Lovecraft/Lovecraft.Common/DTOs/Auth/RegistrationDtos.cs
git commit -m "feat(auth): add pending registration DTOs"
```

---

## Task 2: Backend — storage entity + table name for PendingRegistration

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Storage/Entities/PendingRegistrationEntity.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Storage/TableNames.cs`
- Test: `Lovecraft/Lovecraft.UnitTests/PendingRegistrationTests.cs` (created in Task 4, but we’ll draft the entity now)

- [ ] **Step 1: Create `PendingRegistrationEntity`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.Backend.Storage.Entities;

public sealed class PendingRegistrationEntity : ITableEntity
{
    public const string FixedPartitionKey = "PENDING";

    public string PartitionKey { get; set; } = FixedPartitionKey;
    public string RowKey { get; set; } = ""; // pendingRegistrationId
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }

    public string Secret { get; set; } = "";

    // Snapshot of policy decision at start time
    public bool RequireInvite { get; set; }
    public string? InviteCode { get; set; }

    public string RegistrationMethod { get; set; } = "web"; // "web" | "telegram"

    // Draft profile fields for finalize
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public int Age { get; set; }
    public string Gender { get; set; } = "";
    public string Location { get; set; } = "";
    public string? Bio { get; set; }

    // Staged image
    public string? StagedProfileImageBlobName { get; set; }
}
```

- [ ] **Step 2: Add table name constant**

Edit `Lovecraft/Lovecraft.Backend/Storage/TableNames.cs`:

```csharp
public static string PendingRegistrations => Prefix + "pendingregistrations";
```

- [ ] **Step 3: Build**

```bash
dotnet build
```

- [ ] **Step 4: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Storage/Entities/PendingRegistrationEntity.cs Lovecraft/Lovecraft.Backend/Storage/TableNames.cs
git commit -m "feat(auth): add pending registration table entity"
```

---

## Task 3: Backend — PendingRegistration service (mock + Azure)

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/IPendingRegistrationService.cs`
- Create: `Lovecraft/Lovecraft.Backend/Services/Azure/AzurePendingRegistrationService.cs`
- Create: `Lovecraft/Lovecraft.Backend/Services/MockPendingRegistrationService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Program.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs` (if this repo uses a central interface file; otherwise skip and wire via DI directly)

- [ ] **Step 1: Define interface**

```csharp
using Lovecraft.Backend.Storage.Entities;

namespace Lovecraft.Backend.Services;

public interface IPendingRegistrationService
{
    Task<PendingRegistrationEntity> CreateAsync(PendingRegistrationEntity entity);
    Task<PendingRegistrationEntity?> GetAsync(string pendingId);
    Task<bool> ValidateSecretAsync(string pendingId, string secret);
    Task UpdateAsync(PendingRegistrationEntity entity);
    Task DeleteAsync(string pendingId);
}
```

- [ ] **Step 2: Azure implementation (TableClient CRUD)**

Key behaviors:

- `CreateAsync`: insert entity with `PartitionKey=PENDING`, `RowKey=pendingId`
- `ValidateSecretAsync`: point-read entity and compare constant-time (use `CryptographicOperations.FixedTimeEquals`)
- `GetAsync`: return null on 404
- `DeleteAsync`: delete entity (ignore 404)

- [ ] **Step 3: Mock implementation**

Use an in-memory `ConcurrentDictionary<string, PendingRegistrationEntity>` with TTL checks on read.

- [ ] **Step 4: Wire DI in `Program.cs`**

Match existing pattern for switching between `USE_AZURE_STORAGE` and mock services.

- [ ] **Step 5: Build**

```bash
dotnet build
```

- [ ] **Step 6: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Services/IPendingRegistrationService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzurePendingRegistrationService.cs Lovecraft/Lovecraft.Backend/Services/MockPendingRegistrationService.cs Lovecraft/Lovecraft.Backend/Program.cs
git commit -m "feat(auth): add pending registration service"
```

---

## Task 4: Backend — add AuthController endpoints (start/upload/finalize/cancel)

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs` (if needed for DI signature)
- Test: `Lovecraft/Lovecraft.UnitTests/PendingRegistrationTests.cs`

- [ ] **Step 1: Add unit tests for service behaviors (TTL + secret validation)**

Create `Lovecraft/Lovecraft.UnitTests/PendingRegistrationTests.cs`:

```csharp
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Storage.Entities;

namespace Lovecraft.UnitTests;

public class PendingRegistrationTests
{
    [Fact]
    public async Task MockPendingRegistration_ValidateSecret_ReturnsTrueForMatch()
    {
        var svc = new MockPendingRegistrationService();
        var e = new PendingRegistrationEntity
        {
            RowKey = Guid.NewGuid().ToString("N"),
            Secret = "secret",
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(24),
            Email = "a@b.com",
            PasswordHash = "h",
            PasswordSalt = "s",
            DisplayName = "A",
            Age = 25,
            Gender = "female",
            Location = "Moscow",
        };
        await svc.CreateAsync(e);

        var ok = await svc.ValidateSecretAsync(e.RowKey, "secret");
        Assert.True(ok);
    }
}
```

- [ ] **Step 2: Add `POST /api/v1/auth/registration/start`**

Implementation notes:

- Validate password via existing `IsValidPassword` helper (reuse from `AuthController` or move to shared helper if needed).
- Validate invite policy using existing `IAppConfigService` + same exceptions as register (`InviteRequiredException`, `InvalidInviteCodeException`) but **do not** create user.
- Hash password *now* (so plain password is not stored in pending entity).
- Create pending entity with:
  - `RowKey = Guid.NewGuid().ToString("N")`
  - `Secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))`
  - `ExpiresAtUtc = DateTime.UtcNow.AddHours(24)`

Return `RegistrationStartResponseDto`.

- [ ] **Step 3: Add `POST /api/v1/auth/registration/{pendingId}/profile-picture`**

Behavior:

- Read `X-Pending-Registration-Secret` header; reject if missing:
  - 401 with `ApiResponse<...>.ErrorResponse("PENDING_SECRET_REQUIRED", "...")`
- Validate secret via `IPendingRegistrationService.ValidateSecretAsync`
- Validate file:
  - ContentType jpeg/png (also check bytes if desired)
  - Length ≤ 10 MB
  - Decode image and verify min resolution ≥ 256×256
- Enforce square:
  - For v1: reject if decoded `Width != Height` with code `IMAGE_NOT_SQUARE`
  - (Client will upload a square file after center-crop)
- Upload staged image to blob as `pending/{pendingId}/profile.jpg` (normalize to jpg like current profile uploads)
- Update pending entity with `StagedProfileImageBlobName`

- [ ] **Step 4: Add `POST /api/v1/auth/registration/finalize`**

Behavior:

- Validate `X-Pending-Registration-Secret`
- Load pending entity; validate not expired; validate staged blob exists
- Create user using the same code path as existing `RegisterAsync` (for email/password) **but**:
  - use already-hashed password values from pending entity
  - set `ProfileImage` URL to the finalized blob URL after moving/copying the staged blob to the permanent location
- Send verification email (existing behavior for local auth)
- Return `AuthResponseDto` (same as existing register)
- Delete pending entity and staged blob(s) (best-effort cleanup)

- [ ] **Step 5: Add `DELETE /api/v1/auth/registration/{pendingId}`**

Behavior:

- Validate secret
- Delete pending entity + staged blob(s) (best-effort)
- Return success boolean

- [ ] **Step 6: Run backend unit tests**

```bash
dotnet test
```

Expected: PASS (including new tests).

- [ ] **Step 7: Commit**

```bash
git add Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.UnitTests/PendingRegistrationTests.cs
git commit -m "feat(auth): add pending registration start/upload/finalize endpoints"
```

---

## Task 5: Frontend — add `registrationApi` service (mock + api mode)

**Files:**
- Create: `src/services/api/registrationApi.ts`
- Modify: `src/services/api/index.ts`
- Test: `src/services/api/registrationApi.test.ts`

- [ ] **Step 1: Write mock-mode tests first**

Create `src/services/api/registrationApi.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

import { registrationApi } from '@/services/api/registrationApi';

describe('registrationApi (mock mode)', () => {
  it('startRegistration returns pending id + secret', async () => {
    const res = await registrationApi.startRegistration({
      email: 'a@b.com',
      password: 'Secure1!',
      name: 'Alice',
      age: 25,
      gender: 'female',
      location: 'Moscow',
      bio: '',
      inviteCode: undefined,
    });
    expect(res.success).toBe(true);
    expect(res.data?.pendingRegistrationId).toBeTruthy();
    expect(res.data?.pendingRegistrationSecret).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement `registrationApi.ts`**

API mode endpoints:

- `POST /api/v1/auth/registration/start`
- `POST /api/v1/auth/registration/{id}/profile-picture` (form upload) with header `X-Pending-Registration-Secret`
- `POST /api/v1/auth/registration/finalize` with header
- `DELETE /api/v1/auth/registration/{id}` with header

Implementation detail: reuse `apiClient.post` and `apiClient.fetchWithTimeout` patterns; for form upload, add a helper that allows passing extra headers with `FormData` (either add a new `apiClient.postFormWithHeaders` or implement `fetch` directly inside `registrationApi`).

- [ ] **Step 3: Run frontend tests**

From `aloevera-harmony-meet/`:

```bash
npm run test:run
```

- [ ] **Step 4: Commit**

```bash
git add src/services/api/registrationApi.ts src/services/api/index.ts src/services/api/registrationApi.test.ts
git commit -m "feat(auth): add registrationApi for pending registration flow"
```

---

## Task 6: Frontend — deterministic center-crop-to-square helper

**Files:**
- Create: `src/lib/imageSquare.ts`
- Test: (inline in component tests; unit tests optional)

- [ ] **Step 1: Implement helper**

Create `src/lib/imageSquare.ts`:

```ts
export async function centerCropToSquareJpeg(file: File, quality = 0.9): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const side = Math.min(img.width, img.height);
    const sx = Math.floor((img.width - side) / 2);
    const sy = Math.floor((img.height - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
    });

    return new File([blob], 'profile.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/imageSquare.ts
git commit -m "feat(images): add client-side center-crop square helper"
```

---

## Task 7: Frontend — add required photo step UI component

**Files:**
- Create: `src/components/ui/profile-picture-step.tsx`

- [ ] **Step 1: Implement component**

Component responsibilities:

- Render preview circle/square
- File input accept `image/jpeg,image/png`
- On select:
  - validate file size ≤ 10MB
  - run `centerCropToSquareJpeg`
  - validate resulting image dimensions (>=256) by loading it
- Expose callbacks:
  - `onUpload(file: File): Promise<void>`
  - `onBack(): void`
  - `isLoading` state

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/profile-picture-step.tsx
git commit -m "feat(auth): add reusable profile picture step component"
```

---

## Task 8: Frontend — update `Welcome.tsx` register flow to wizard

**Files:**
- Modify: `src/pages/Welcome.tsx`
- Modify: `src/pages/__tests__/Welcome.test.tsx`

- [ ] **Step 1: Update tests first**

In `Welcome.test.tsx`, adjust “register form” tests to:

- fill profile form → click “Next” (new button)
- ensure photo step is shown (e.g. heading text “Upload profile picture”)
- simulate upload by calling mocked `registrationApi.uploadProfilePicture`
- finalize call triggers toast + returns to login (or signs in immediately if we keep current behavior)

Mock module:

```ts
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    authApi: { login: vi.fn(), getRegistrationConfig: vi.fn() },
    registrationApi: {
      startRegistration: vi.fn(),
      uploadProfilePicture: vi.fn(),
      finalizeRegistration: vi.fn(),
      cancelRegistration: vi.fn(),
    },
  };
});
```

- [ ] **Step 2: Implement wizard in `Welcome.tsx`**

State machine:

- `registerStep: 'form' | 'photo'`
- store `{ pendingId, pendingSecret }` in state after `startRegistration`

Flow:

- Submit form → `registrationApi.startRegistration` (not `authApi.register`)
- Go to photo step
- On photo upload success, enable “Create account”
- Finalize → store tokens (same as login) OR if backend returns “created but must verify”, show toast and return to login

Note: existing backend login rejects unverified email, so we can still return tokens but the user may not be able to use them until verified; decide consistent behavior with current `authApi.register` UX (“check your email”). Prefer: finalize returns success but no navigation; keep current toast and return to login.

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Welcome.tsx src/pages/__tests__/Welcome.test.tsx
git commit -m "feat(auth): require profile picture during web registration"
```

---

## Task 9: Frontend — update `WelcomeTelegram.tsx` create flow to wizard

**Files:**
- Modify: `src/pages/WelcomeTelegram.tsx`
- Create: `src/pages/__tests__/WelcomeTelegram.test.tsx`

- [ ] **Step 1: Add tests**

Cover:

- missing `location.state` redirects to `/`
- create flow:
  - submit profile form → calls `registrationApi.startRegistration` with invite code etc
  - photo step shown
  - finalize navigates to `/friends` and sets tokens

- [ ] **Step 2: Implement wizard**

State machine:

- `createStep: 'form' | 'photo'`

Default photo:

- For now, show a placeholder + “Use Telegram photo” button that triggers upload of a fetched blob (follow-up task can integrate actual Telegram photo fetch if currently implemented elsewhere).

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/WelcomeTelegram.tsx src/pages/__tests__/WelcomeTelegram.test.tsx
git commit -m "feat(auth): require profile picture during Telegram registration"
```

---

## Task 10: End-to-end verification (manual)

- [ ] **Step 1: Run backend**

```bash
cd lovecraft/Lovecraft/Lovecraft.Backend
dotnet run
```

- [ ] **Step 2: Run frontend in API mode**

```bash
cd aloevera-harmony-meet
$env:VITE_API_MODE='api'
npm run dev
```

- [ ] **Step 3: Manual scenarios**

- Web: start registration with invalid invite → blocked before photo step
- Web: start registration valid → photo required → finalize → user created → verify email gating works as expected
- Telegram: create account → photo default/change → finalize → user created

- [ ] **Step 4: Record any follow-up fixes as separate tasks/commits**

