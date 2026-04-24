# Profile Photo Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After any successful login, users without a profile photo are redirected to a mandatory `/welcome/photo` upload page before reaching the main app.

**Architecture:** Add `ProfileImage` to the `UserInfo` DTO returned by all auth endpoints. After tokens are stored, call `navigateAfterAuth(navigate, user)` instead of hard-coding `navigate('/friends')` — the helper routes to `/welcome/photo` (with `userId` in state) when `profileImage` is empty, or to `/friends` when it isn't. A new `WelcomePhoto` page self-guards (redirect to `/` if no token/userId) and calls the existing `usersApi.uploadProfileImage` on save.

**Tech Stack:** React 18, React Router v6, Vitest, .NET 10 C#, Azure Table Storage

---

## File Map

**Create:**
- `src/lib/authNavigation.ts` — `navigateAfterAuth` helper
- `src/__tests__/authNavigation.test.ts` — unit tests for the helper
- `src/pages/WelcomePhoto.tsx` — mandatory photo upload page

**Modify:**
- `Lovecraft.Common/DTOs/Auth/AuthDtos.cs` — add `ProfileImage` to `UserInfo`
- `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` — populate `ProfileImage` in 4 `new UserInfo` blocks
- `Lovecraft.Backend/Services/MockAuthService.cs` — add `ProfileImage` to `MockUser`; populate in 5 `new UserInfo` blocks
- `src/services/api/authApi.ts` — add `profileImage: string` to `AuthResponse.user` type; update 4 mock return objects
- `src/pages/Welcome.tsx` — use `navigateAfterAuth` in `handleLogin`
- `src/pages/WelcomeTelegram.tsx` — use `navigateAfterAuth` in `handleLink` and `handleCreate`
- `src/pages/WelcomeGoogle.tsx` — use `navigateAfterAuth` in `handleCreate`
- `src/pages/MiniAppEntry.tsx` — use `navigateAfterAuth` in 3 navigation points
- `src/App.tsx` — import `WelcomePhoto`, add `/welcome/photo` route

---

### Task 1: Backend — Add `ProfileImage` to `UserInfo` DTO and populate it

**Files:**
- Modify: `Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`

- [ ] **Step 1: Add `ProfileImage` to the `UserInfo` class in `AuthDtos.cs`**

  Open `Lovecraft.Common/DTOs/Auth/AuthDtos.cs`. Find the `UserInfo` class (currently ends at `AuthMethods`). Add one property:

  ```csharp
  public class UserInfo
  {
      public string Id { get; set; } = string.Empty;
      public string Email { get; set; } = string.Empty;
      public string Name { get; set; } = string.Empty;
      public bool EmailVerified { get; set; }
      public List<string> AuthMethods { get; set; } = new();
      public string ProfileImage { get; set; } = string.Empty;  // ← add this line
  }
  ```

- [ ] **Step 2: Populate `ProfileImage` in `AzureAuthService.cs` — `IssueJwtPairAsync` (line ~951)**

  `IssueJwtPairAsync` is a private helper (`private async Task<AuthResponseDto> IssueJwtPairAsync(UserEntity userEntity)`). Its `User = new UserInfo` block currently looks like:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods,
  },
  ```

  Add `ProfileImage`:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods,
      ProfileImage = userEntity.ProfileImage,
  },
  ```

- [ ] **Step 3: Populate `ProfileImage` in `AzureAuthService.cs` — `LoginAsync` (line ~1018)**

  `LoginAsync` has its own `return new AuthResponseDto` block. Change:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods
  },
  ```

  To:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods,
      ProfileImage = userEntity.ProfileImage,
  },
  ```

- [ ] **Step 4: Populate `ProfileImage` in `AzureAuthService.cs` — `RefreshTokenAsync` (line ~1080)**

  Change:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods
  },
  ```

  To:

  ```csharp
  User = new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods,
      ProfileImage = userEntity.ProfileImage,
  },
  ```

- [ ] **Step 5: Populate `ProfileImage` in `AzureAuthService.cs` — `GetCurrentUserAsync` (line ~1369)**

  Change:

  ```csharp
  return new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods
  };
  ```

  To:

  ```csharp
  return new UserInfo
  {
      Id = userEntity.RowKey,
      Email = userEntity.Email,
      Name = userEntity.Name,
      EmailVerified = userEntity.EmailVerified,
      AuthMethods = authMethods,
      ProfileImage = userEntity.ProfileImage,
  };
  ```

- [ ] **Step 6: Add `ProfileImage` to `MockUser` in `MockAuthService.cs`**

  Find the `private class MockUser` near the bottom of `MockAuthService.cs` and add the property:

  ```csharp
  private class MockUser
  {
      public string Id { get; set; } = string.Empty;
      public string Email { get; set; } = string.Empty;
      public string Name { get; set; } = string.Empty;
      public string PasswordHash { get; set; } = string.Empty;
      public bool EmailVerified { get; set; }
      public List<string> AuthMethods { get; set; } = new();
      public DateTime CreatedAt { get; set; }
      public DateTime? LastLoginAt { get; set; }
      public int Age { get; set; }
      public string Location { get; set; } = string.Empty;
      public string Gender { get; set; } = string.Empty;
      public string Bio { get; set; } = string.Empty;
      public string? TelegramUserId { get; set; }
      public string? GoogleUserId { get; set; }
      public string ProfileImage { get; set; } = string.Empty;  // ← add this line
  }
  ```

- [ ] **Step 7: Populate `ProfileImage` in the 5 `new UserInfo` blocks in `MockAuthService.cs`**

  There are 5 `new UserInfo` blocks in `MockAuthService.cs` (at approximately lines 146, 550, 615, 658, 822). Each one looks like:

  ```csharp
  User = new UserInfo
  {
      Id = user.Id,
      Email = user.Email,
      Name = user.Name,
      EmailVerified = user.EmailVerified,
      AuthMethods = user.AuthMethods
  },
  ```

  (The block at line 822 uses `return new UserInfo` instead of `User = new UserInfo`.)

  Add `ProfileImage = user.ProfileImage` to **all five**. Example for the `User =` form:

  ```csharp
  User = new UserInfo
  {
      Id = user.Id,
      Email = user.Email,
      Name = user.Name,
      EmailVerified = user.EmailVerified,
      AuthMethods = user.AuthMethods,
      ProfileImage = user.ProfileImage,
  },
  ```

  And for the `return new UserInfo` form:

  ```csharp
  return new UserInfo
  {
      Id = user.Id,
      Email = user.Email,
      Name = user.Name,
      EmailVerified = user.EmailVerified,
      AuthMethods = user.AuthMethods,
      ProfileImage = user.ProfileImage,
  };
  ```

- [ ] **Step 8: Build the backend to confirm no compile errors**

  Run from the `Lovecraft/` directory:

  ```bash
  dotnet build Lovecraft.sln
  ```

  Expected: `Build succeeded.` with 0 errors.

- [ ] **Step 9: Commit backend changes**

  ```bash
  git add Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs \
          Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs \
          Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs
  git commit -m "feat: add ProfileImage to UserInfo in all auth responses"
  ```

---

### Task 2: Frontend — Update `AuthResponse.user` TypeScript type and mock returns

**Files:**
- Modify: `src/services/api/authApi.ts`

- [ ] **Step 1: Add `profileImage` to the `AuthResponse.user` inline type**

  In `src/services/api/authApi.ts`, find the `AuthResponse` interface (currently around line 21). Change:

  ```ts
  export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      authMethods: string[];
    };
    expiresAt: string;
  }
  ```

  To:

  ```ts
  export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      authMethods: string[];
      profileImage: string;
    };
    expiresAt: string;
  }
  ```

- [ ] **Step 2: Update the mock `login` return to include `profileImage`**

  In the mock branch of `authApi.login` (around line 142–157), the successful return object has a `user` field. Change:

  ```ts
  user: {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    emailVerified: true,
    authMethods: ['local'],
  },
  ```

  To:

  ```ts
  user: {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    emailVerified: true,
    authMethods: ['local'],
    profileImage: mockUser.profileImage || '',
  },
  ```

- [ ] **Step 3: Update the mock `register` return to include `profileImage`**

  In the mock branch of `authApi.register` (around line 185), the `user` field has no profileImage. Change:

  ```ts
  user: {
    id: `user-${Date.now()}`,
    email: data.email,
    name: data.name,
    emailVerified: false,
    authMethods: ['local'],
  },
  ```

  To:

  ```ts
  user: {
    id: `user-${Date.now()}`,
    email: data.email,
    name: data.name,
    emailVerified: false,
    authMethods: ['local'],
    profileImage: '',
  },
  ```

- [ ] **Step 4: Update the mock `refreshToken` return to include `profileImage`**

  In the mock branch of `authApi.refreshToken` (around line 227), change:

  ```ts
  user: {
    id: 'current-user',
    email: 'user@example.com',
    name: 'Mock User',
    emailVerified: true,
    authMethods: ['local'],
  },
  ```

  To:

  ```ts
  user: {
    id: 'current-user',
    email: 'user@example.com',
    name: 'Mock User',
    emailVerified: true,
    authMethods: ['local'],
    profileImage: '/placeholder.svg',
  },
  ```

- [ ] **Step 5: Update the mock `getCurrentUser` return to include `profileImage`**

  In the mock branch of `authApi.getCurrentUser` (around line 252), change:

  ```ts
  data: {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    emailVerified: true,
    authMethods: ['local'],
  },
  ```

  To:

  ```ts
  data: {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    emailVerified: true,
    authMethods: ['local'],
    profileImage: mockUser.profileImage || '',
  },
  ```

- [ ] **Step 6: Check for TypeScript errors**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors. If TypeScript reports that mock returns for `telegramRegister`, `telegramLinkLogin`, etc. are missing `profileImage` — those mocks all return `{ success: false }` and never reach the `user` object, so no update is needed for them.

- [ ] **Step 7: Commit**

  ```bash
  git add src/services/api/authApi.ts
  git commit -m "feat: add profileImage to AuthResponse user type and mock returns"
  ```

---

### Task 3: Write failing test for `navigateAfterAuth`

**Files:**
- Create: `src/__tests__/authNavigation.test.ts`

- [ ] **Step 1: Create the test file**

  Create `src/__tests__/authNavigation.test.ts` with this content:

  ```ts
  import { describe, it, expect, vi } from 'vitest';
  import { navigateAfterAuth } from '@/lib/authNavigation';

  describe('navigateAfterAuth', () => {
    it('routes to /welcome/photo with userId state when profileImage is empty', () => {
      const navigate = vi.fn();
      navigateAfterAuth(navigate as any, { id: 'user-123', profileImage: '' });
      expect(navigate).toHaveBeenCalledWith(
        '/welcome/photo',
        { state: { userId: 'user-123' }, replace: true }
      );
    });

    it('routes to /friends when user has a profileImage', () => {
      const navigate = vi.fn();
      navigateAfterAuth(navigate as any, { id: 'user-123', profileImage: 'https://cdn.example.com/photo.jpg' });
      expect(navigate).toHaveBeenCalledWith('/friends', { replace: true });
    });

    it('routes to /welcome/photo when profileImage is undefined', () => {
      const navigate = vi.fn();
      navigateAfterAuth(navigate as any, { id: 'user-456', profileImage: undefined as any });
      expect(navigate).toHaveBeenCalledWith(
        '/welcome/photo',
        { state: { userId: 'user-456' }, replace: true }
      );
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm it fails**

  ```bash
  npx vitest run src/__tests__/authNavigation.test.ts
  ```

  Expected: FAIL — `Cannot find module '@/lib/authNavigation'`

---

### Task 4: Implement `navigateAfterAuth` and make the tests pass

**Files:**
- Create: `src/lib/authNavigation.ts`

- [ ] **Step 1: Create `src/lib/authNavigation.ts`**

  ```ts
  import type { NavigateFunction } from 'react-router-dom';

  export function navigateAfterAuth(
    navigate: NavigateFunction,
    user: { id: string; profileImage: string }
  ): void {
    if (!user.profileImage) {
      navigate('/welcome/photo', { state: { userId: user.id }, replace: true });
    } else {
      navigate('/friends', { replace: true });
    }
  }
  ```

- [ ] **Step 2: Run the tests and confirm they pass**

  ```bash
  npx vitest run src/__tests__/authNavigation.test.ts
  ```

  Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/authNavigation.ts src/__tests__/authNavigation.test.ts
  git commit -m "feat: add navigateAfterAuth helper with tests"
  ```

---

### Task 5: Wire `navigateAfterAuth` into all auth handlers

**Files:**
- Modify: `src/pages/Welcome.tsx`
- Modify: `src/pages/WelcomeTelegram.tsx`
- Modify: `src/pages/WelcomeGoogle.tsx`
- Modify: `src/pages/MiniAppEntry.tsx`

- [ ] **Step 1: Update `Welcome.tsx` — `handleLogin`**

  Add the import at the top of `src/pages/Welcome.tsx` (with other `@/lib` imports):

  ```ts
  import { navigateAfterAuth } from '@/lib/authNavigation';
  ```

  Find `handleLogin` (around line 59). Replace:

  ```ts
  toast.success('Welcome back!');
  navigate('/friends');
  ```

  With:

  ```ts
  toast.success('Welcome back!');
  navigateAfterAuth(navigate, response.data.user);
  ```

- [ ] **Step 2: Update `WelcomeTelegram.tsx` — `handleLink`**

  Add the import at the top of `src/pages/WelcomeTelegram.tsx`:

  ```ts
  import { navigateAfterAuth } from '@/lib/authNavigation';
  ```

  In `handleLink` (around line 99–102), replace:

  ```ts
  toast.success('Telegram linked to your account');
  navigate('/friends');
  ```

  With:

  ```ts
  toast.success('Telegram linked to your account');
  navigateAfterAuth(navigate, res.data.user);
  ```

- [ ] **Step 3: Update `WelcomeTelegram.tsx` — `handleCreate`**

  In `handleCreate` (around line 135–138), replace:

  ```ts
  toast.success('Account created!');
  navigate('/friends');
  ```

  With:

  ```ts
  toast.success('Account created!');
  navigateAfterAuth(navigate, res.data.user);
  ```

- [ ] **Step 4: Update `WelcomeGoogle.tsx` — `handleCreate`**

  Add the import at the top of `src/pages/WelcomeGoogle.tsx`:

  ```ts
  import { navigateAfterAuth } from '@/lib/authNavigation';
  ```

  In `handleCreate` (around line 98–101), replace:

  ```ts
  toast.success('Account created!');
  navigate('/friends');
  ```

  With:

  ```ts
  toast.success('Account created!');
  navigateAfterAuth(navigate, res.data.user);
  ```

- [ ] **Step 5: Update `MiniAppEntry.tsx` — `miniAppLogin` signedIn branch**

  Add the import at the top of `src/pages/MiniAppEntry.tsx`:

  ```ts
  import { navigateAfterAuth } from '@/lib/authNavigation';
  ```

  Find the `if (res.data.status === 'signedIn' && res.data.auth)` block (around line 98–102). Replace:

  ```ts
  navigate('/friends', { replace: true });
  return;
  ```

  With:

  ```ts
  navigateAfterAuth(navigate, res.data.auth.user);
  return;
  ```

- [ ] **Step 6: Update `MiniAppEntry.tsx` — `handleLink` (miniAppLinkLogin)**

  Find the `handleLink` submit handler (around line 151–154). Replace:

  ```ts
  toast.success('Telegram linked to your account');
  navigate('/friends', { replace: true });
  ```

  With:

  ```ts
  toast.success('Telegram linked to your account');
  navigateAfterAuth(navigate, res.data.user);
  ```

- [ ] **Step 7: Update `MiniAppEntry.tsx` — `handleCreate` (miniAppRegister)**

  Find the `handleCreate` submit handler (around line 187–190). Replace:

  ```ts
  toast.success('Account created!');
  navigate('/friends', { replace: true });
  ```

  With:

  ```ts
  toast.success('Account created!');
  navigateAfterAuth(navigate, res.data.user);
  ```

- [ ] **Step 8: Verify no TypeScript errors**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 9: Commit**

  ```bash
  git add src/pages/Welcome.tsx src/pages/WelcomeTelegram.tsx \
          src/pages/WelcomeGoogle.tsx src/pages/MiniAppEntry.tsx
  git commit -m "feat: route to /welcome/photo after login when user has no profile photo"
  ```

---

### Task 6: Create `WelcomePhoto.tsx` and register the route

**Files:**
- Create: `src/pages/WelcomePhoto.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/pages/WelcomePhoto.tsx`**

  ```tsx
  import React, { useRef, useState } from 'react';
  import { useLocation, useNavigate, Navigate } from 'react-router-dom';
  import { Camera, Loader2 } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { toast } from '@/components/ui/sonner';
  import { showApiError } from '@/lib/apiError';
  import { usersApi } from '@/services/api/usersApi';
  import { apiClient } from '@/services/api';
  import heroBg from '@/assets/hero-bg.jpg';
  import appIcon from '@/assets/app-icon.jpg';

  const WelcomePhoto: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as { userId: string } | null;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    if (!apiClient.getAccessToken() || !state?.userId) {
      return <Navigate to="/" replace />;
    }

    const { userId } = state;

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const selected = e.target.files?.[0];
      if (!selected) return;
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      e.target.value = '';
    }

    async function handleSave() {
      if (!file) return;
      setIsUploading(true);
      try {
        const res = await usersApi.uploadProfileImage(userId, file);
        if (!res.success) {
          showApiError(res, 'Photo upload failed');
          return;
        }
        toast.success('Profile photo saved!');
        navigate('/friends', { replace: true });
      } catch (err) {
        showApiError(err, 'Photo upload failed');
      } finally {
        setIsUploading(false);
      }
    }

    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="absolute inset-0 hero-gradient opacity-80" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="mb-6 floating">
            <img src={appIcon} alt="AloeVera" className="w-20 h-20 rounded-3xl shadow-2xl glow" />
          </div>

          <div className="w-full max-w-sm">
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div>
                <h2 className="text-2xl font-bold text-white">Add a profile photo</h2>
                <p className="text-sm text-white/70 mt-2">
                  A photo helps others recognize you. Choose something clear and friendly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto w-32 h-32 rounded-full overflow-hidden flex items-center justify-center bg-white/20 border-2 border-dashed border-white/50 hover:border-white transition-colors"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-10 h-10 text-white/70" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                onClick={handleSave}
                disabled={!file || isUploading}
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save photo'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default WelcomePhoto;
  ```

- [ ] **Step 2: Register the route in `App.tsx`**

  Add the import after the existing welcome page imports (around line 13–14):

  ```ts
  import WelcomePhoto from "./pages/WelcomePhoto";
  ```

  Add the route inside `<Routes>`, after `/welcome/google` (around line 50):

  ```tsx
  <Route path="/welcome/photo" element={<WelcomePhoto />} />
  ```

- [ ] **Step 3: Verify no TypeScript errors**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Run all tests**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass (including the `authNavigation` tests from Task 4).

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/WelcomePhoto.tsx src/App.tsx
  git commit -m "feat: add WelcomePhoto page and /welcome/photo route"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ `ProfileImage` added to `UserInfo` DTO (Task 1)
- ✅ Populated in all `AzureAuthService` and `MockAuthService` `new UserInfo` blocks (Task 1)
- ✅ `profileImage: string` added to TypeScript type and all mock returns (Task 2)
- ✅ `navigateAfterAuth` helper with tests (Tasks 3–4)
- ✅ Wired into Welcome, WelcomeTelegram, WelcomeGoogle, MiniAppEntry (Task 5)
- ✅ `WelcomePhoto` page: hero background, avatar circle with preview, save button, no skip (Task 6)
- ✅ Self-guard: redirect to `/` if no token or no `userId` in state (Task 6, Step 1)
- ✅ Route registered without `ProtectedRoute` (Task 6, Step 2)
- ✅ Upload failure: toast + stay on page (Task 6, `handleSave` catch block)
- ✅ Mock mode works: `usersApi.uploadProfileImage` mock returns success URL (no changes needed)
