# Profile photo required at onboarding

**Date**: 2026-04-24
**Repos in scope**: `aloevera-harmony-meet/` (frontend), `lovecraft/` (backend)
**Status**: Approved

## Goal

All users must have a profile photo. After any successful authentication (email/password login, Telegram, Google), if the authenticated user has no profile photo they are redirected to a mandatory photo upload page before reaching the main app.

Supersedes the more complex staged-registration approach in `2026-04-22-profile-picture-onboarding-design.md`.

## Non-goals

- Enforcing photo existence in every protected route (ProtectedRoute guard)
- Cropping UI or minimum resolution enforcement on the frontend
- Migrating or deprecating the existing `/api/v1/auth/register` endpoint

## Chosen approach

After any auth success, check `user.profileImage`. If empty, navigate to `/welcome/photo` instead of `/friends`. The photo page uploads via the existing `usersApi.uploadProfileImage` endpoint, then navigates to `/friends`. No skip option.

## Backend changes

### `Lovecraft.Common/DTOs/Auth/AuthDtos.cs`

Add `ProfileImage` to `UserInfo`:

```csharp
public class UserInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public List<string> AuthMethods { get; set; } = new();
    public string ProfileImage { get; set; } = string.Empty;  // ← new
}
```

### Auth service

Populate `ProfileImage` from the user entity's profile image URL in every method that builds a `UserInfo` object. Affected endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/telegram-login`, `POST /api/v1/auth/google-login`, and all social-auth variant endpoints that return `AuthResponseDto`.

## Frontend changes

### `src/services/api/authApi.ts`

Add `profileImage: string` to the `UserInfo` TypeScript type.

### Shared helper

A small utility `navigateAfterAuth(navigate, user)` in `src/lib/authNavigation.ts`:

```ts
export function navigateAfterAuth(navigate: NavigateFunction, user: UserInfo) {
  if (!user.profileImage) {
    navigate('/welcome/photo', { state: { userId: user.id }, replace: true });
  } else {
    navigate('/friends', { replace: true });
  }
}
```

Used in:
- `handleLogin` in `Welcome.tsx` (replaces `navigate('/friends')`)
- `handleCreate` and `handleLink` in `WelcomeTelegram.tsx`
- Post-auth navigation in `WelcomeGoogle.tsx`

### `src/pages/WelcomePhoto.tsx` (new file)

Full-screen page matching the hero background style of other Welcome pages.

**On mount:**
- If no auth token is present in `apiClient`, redirect to `/`.
- If `location.state?.userId` is absent, redirect to `/`.

**UI:**
- Centred avatar circle, camera icon when no file selected, image preview when file is picked.
- "Save photo" button — disabled until a file is selected, shows spinner during upload.
- No skip button.

**On submit:**
- Call `usersApi.uploadProfileImage(userId, file)`.
- On success: `navigate('/friends', { replace: true })`.
- On failure: toast error, stay on page (user can retry).

**File input:**
- `accept="image/jpeg,image/png,image/webp"`
- Single file only.

### `src/App.tsx`

Add route before the protected routes block:

```tsx
<Route path="/welcome/photo" element={<WelcomePhoto />} />
```

No `ProtectedRoute` wrapper — the page self-guards by checking for auth tokens and navigation state.

## Error handling

| Scenario | Behaviour |
|---|---|
| Upload fails | Toast error, stay on `/welcome/photo`, user can retry |
| Direct navigation to `/welcome/photo` without tokens | Redirect to `/` |
| Direct navigation to `/welcome/photo` without `userId` state | Redirect to `/` |
| User navigates away via browser back/URL bar | Redirected back to `/welcome/photo` on next login |

## Mock mode

`usersApi.uploadProfileImage` already has a mock branch that returns `mockCurrentUser.profileImage`. No additional mock changes needed. In mock mode the photo page will appear to succeed and navigate to `/friends`.
