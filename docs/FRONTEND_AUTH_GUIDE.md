# Frontend Authentication Guide

**Last Updated**: 2026-05-15

Authentication in the web client uses **JWT tokens stored in `localStorage`** managed by `src/services/api/apiClient.ts`. There is intentionally no React `AuthContext` / `useAuth()` hook — token access is imperative.

**Token keys in `localStorage`:**
- `access_token` — 15-minute JWT
- `refresh_token` — 7-day rotating refresh token

**Supported sign-in methods (all shipped):**
- Email + password (local)
- Google (Google Identity Services)
- Telegram (Login Widget on the public site)
- Telegram Mini App (in-Telegram WebView at `/tg`)

See [`lovecraft/Lovecraft/docs/AUTHENTICATION.md`](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md) for the full backend surface and pending-ticket flow.

---

## 🗺️ Pages

| Route | Page | Purpose |
|---|---|---|
| `/` | `Welcome.tsx` | Login + register; mounts `GoogleSignInButton` + `TelegramLoginWidget` |
| `/welcome/telegram` | `WelcomeTelegram.tsx` | Pending-ticket redemption for new Telegram identities (profile fields + invite code → `/auth/telegram-register` or `/auth/telegram-link-login`) |
| `/welcome/google` | `WelcomeGoogle.tsx` | Same shape for new Google identities |
| `/welcome/photo` | `WelcomePhoto.tsx` | First-time profile photo step (optional) |
| `/tg` | `MiniAppEntry.tsx` | Telegram Mini App entry — reads `Telegram.WebApp.initData`, calls `/auth/telegram-miniapp-login`, then either signs in or renders inline registration wizard |
| `/verify-email` | `VerifyEmail.tsx` | Handles the link sent by SendGrid |
| `/reset-password` | `ResetPassword.tsx` | Handles the password-reset link sent by SendGrid |

Welcome routes are public. `/friends`, `/talks`, `/aloevera*`, `/settings` are wrapped in `<ProtectedRoute>` (`src/App.tsx`). `/` is wrapped in `<GuestRoute>` so already-authenticated users get redirected to `/friends`.

---

## 🔧 Key components

### `<GoogleSignInButton>` (`src/components/GoogleSignInButton.tsx`)

Renders Google's button via `@react-oauth/google`. On success the JWT credential is sent to `authApi.googleLogin(idToken)`:

```typescript
<GoogleLogin onSuccess={async (resp) => {
  const result = await authApi.googleLogin(resp.credential!);
  if (result.success) {
    if (result.data.status === 'signedIn') { /* save tokens, navigate */ }
    else if (result.data.status === 'pending') { /* navigate to /welcome/google with ticket */ }
    else if (result.data.status === 'emailConflict') { /* show "log in with password to link" */ }
  }
}} />
```

The Web client ID is fetched from `GET /api/v1/auth/google-config` at runtime (or from `VITE_GOOGLE_CLIENT_ID` if set).

### `<TelegramLoginWidget>` (`src/components/TelegramLoginWidget.tsx`)

Injects `<script src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login=… data-onauth="onTelegramAuth(user)" …>` and registers `window.onTelegramAuth`. On callback:

```typescript
window.onTelegramAuth = async (user) => {
  const result = await authApi.telegramLogin(user);
  if (result.success) {
    if (result.data.status === 'signedIn') { /* save tokens, navigate */ }
    else if (result.data.status === 'pending') { /* navigate to /welcome/telegram with ticket */ }
  }
};
```

Bot username comes from `GET /api/v1/auth/telegram-login-config` (or `VITE_TELEGRAM_BOT_USERNAME`). BotFather `/setdomain` must include the origin you're testing from.

### `<GuestRoute>` (`src/components/GuestRoute.tsx`)

Redirects to `/friends` if a valid `access_token` is in `localStorage`. Used on `/` so already-signed-in users don't see the Welcome form.

### `<ProtectedRoute>` (`src/components/ProtectedRoute.tsx`)

Runs on every transition to a protected route:
- No `access_token` → redirect to `/`
- Token expired + `refresh_token` present → silent refresh with loading spinner
- Token near-expiry (<5 min) → let through immediately + background refresh
- Refresh fails → clear tokens, redirect to `/`

### `<ForgotPasswordModal>` (`src/components/ForgotPasswordModal.tsx`)

Triggered from `Welcome.tsx`. Posts to `/auth/forgot-password`; always shows the same success message (anti-enumeration).

---

## 🔄 Token lifecycle

### Login (any method)

```typescript
// Welcome.tsx (simplified, applies to all login flows)
const result = await authApi.login({ email, password });
if (result.success && result.data) {
  apiClient.setAccessToken(result.data.accessToken);
  apiClient.setRefreshToken(result.data.refreshToken);
  navigate('/friends');
}
```

### `apiClient.ts`

```
ACCESS_TOKEN_KEY  = 'access_token'
REFRESH_TOKEN_KEY = 'refresh_token'

setAccessToken(token)   → localStorage.setItem(ACCESS_TOKEN_KEY, token)
getAccessToken()        → localStorage.getItem(ACCESS_TOKEN_KEY)
setRefreshToken(token)  → localStorage.setItem(REFRESH_TOKEN_KEY, token)
getRefreshToken()       → localStorage.getItem(REFRESH_TOKEN_KEY)
clearTokens()           → remove both
```

Every outgoing API call sets `Authorization: Bearer <access_token>` automatically.

### Silent refresh on 401

`apiClient` intercepts every 401:
1. POST `/api/v1/auth/refresh` with `{ refreshToken }`
2. Save the new pair (refresh rotates)
3. Retry the original request

Concurrent 401s are deduplicated — only one refresh call fires, others queue.

### Proactive refresh

`ProtectedRoute` calls `apiClient.refreshAccessToken()` when the JWT's `exp` is within 5 minutes of `Date.now()`. Done in the background; doesn't block navigation.

### Logout

```typescript
await authApi.logout();    // server revokes refresh token, clears HttpOnly cookie
apiClient.clearTokens();   // remove both from localStorage
navigate('/');
```

---

## 📝 Forms

All auth + profile forms use `react-hook-form` + `zodResolver` from `src/lib/validators.ts`:

| Schema | Used by |
|---|---|
| `loginSchema` | `Welcome.tsx` login form |
| `registerSchema` | `Welcome.tsx` register form (when invite-code gate is off) |
| `registerSchemaWithInvite` | `Welcome.tsx` register form (when `/auth/registration-config` returns `requireEventInvite: true`) |
| `profileEditSchema` | `SettingsPage.tsx`, `WelcomeTelegram.tsx`, `WelcomeGoogle.tsx` |
| `messageSchema` | Chat input |
| `replySchema` | `TopicDetail.tsx` reply input |
| `createTopicSchema` | `CreateTopicModal.tsx` |

Standard wired-form pattern:

```typescript
const form = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) });

const handleLogin = form.handleSubmit(async (data) => {
  try {
    const result = await authApi.login(data);
    if (!result.success) throw result;
    apiClient.setAccessToken(result.data.accessToken);
    apiClient.setRefreshToken(result.data.refreshToken);
    navigate('/friends');
  } catch (err) {
    if (err?.error?.code === 'EMAIL_TAKEN') {
      form.setError('email', { message: 'This email is already registered' });
      return;
    }
    showApiError(err, 'Login failed');
  }
});
```

---

## 🎫 Pending-ticket flow (Google + Telegram Widget)

When the verifier endpoints don't recognise the identity, they return `status: 'pending'` (Google/Telegram Widget) or `status: 'needsRegistration'` (Telegram Mini App) instead of issuing a JWT:

```
POST /auth/google-login → { status: 'pending', ticket, google }
       ↓
navigate('/welcome/google', { state: { ticket, google } })
       ↓
WelcomeGoogle.tsx: collect age, location, gender, bio, optional inviteCode
       ↓
POST /auth/google-register → returns AuthResponseDto (now signed in)
```

Same shape for Telegram Widget (`/welcome/telegram` + `/auth/telegram-register`).

Mini App uses **inline** registration — `MiniAppEntry.tsx` keeps the verified `initData` in component state and replays it on `POST /auth/telegram-miniapp-register`. No separate ticket is issued because the Mini App can re-verify cheaply.

**No user row is written** on the pending path — abandoned signups leave no trace. Profile fields are collected before account creation.

---

## 🔗 Account linking

| Trigger | Endpoint | Result |
|---|---|---|
| Google email matches existing local account | (handled in `google-login`) | Auto-link if local account exists; backend returns `signedIn` or `emailConflict` |
| `emailConflict`: user enters password | (re-call `/auth/login` then link manually via `/auth/google-register` with the saved ticket) | Backend uses the ticket to attach Google to the account |
| Telegram → existing email account | `POST /auth/telegram-link-login` (body: `email`, `password`, `ticket`) | Atomic; logs in + links Telegram in one call |
| Telegram → currently authenticated account | `POST /auth/telegram-link` (body: `{ ticket }`) | Authenticated; appends Telegram |
| Telegram-only user adds email+password | `POST /auth/attach-email` | Sends verification email; `local` method appended when verification link clicked |

`GET /auth/methods` returns the list of methods linked to the current account (used in `SettingsPage.tsx`).

---

## 🔐 Invite codes & registration gating

Whether new accounts must supply an event invite code is controlled by **backend `appconfig`** (`registration` / `require_event_invite`), exposed via:

```typescript
const cfg = await authApi.getRegistrationConfig();   // { requireEventInvite: boolean }
```

`Welcome.tsx` calls this on mount and conditionally renders the invite-code field (using `registerSchemaWithInvite`). Same applies on `/welcome/telegram` and `/welcome/google` — the redemption call accepts an optional `inviteCode` field.

`src/lib/inviteRedirect.ts` stashes `?code=` from any inbound URL into `sessionStorage` so the Welcome form can pre-fill the invite-code field after auth bounces.

---

## ⚙️ Frontend env vars

```bash
VITE_API_MODE=mock|api                      # default mock in .env.development
VITE_API_BASE_URL=                          # empty in .env.production (relative URLs)

# Optional — fall back to /auth/google-config and /auth/telegram-login-config if absent
VITE_GOOGLE_CLIENT_ID=<web client id>
VITE_TELEGRAM_BOT_USERNAME=<bot username>
```

In API mode the frontend automatically queries `GET /auth/google-config` and `GET /auth/telegram-login-config` so deployments don't need to bake provider IDs into the bundle.

---

## 🔒 Security notes

Tokens live in `localStorage`, which is readable by any JavaScript on the page. The backend also supports HttpOnly-cookie refresh tokens (`Secure` flag conditional on `Request.IsHttps`), so when ready the access token can move to memory and the refresh token to cookie. See ISSUES.md TD.7.

---

## 📁 Key file map

| File | Role |
|---|---|
| `src/services/api/apiClient.ts` | HTTP client; auth header + 401 silent refresh |
| `src/services/api/authApi.ts` | All auth endpoint wrappers (local, Google, Telegram Widget, Mini App, attach-email, etc.) |
| `src/components/ProtectedRoute.tsx` | Auth guard + proactive refresh |
| `src/components/GuestRoute.tsx` | Reverse guard for `/` |
| `src/components/GoogleSignInButton.tsx` | `@react-oauth/google` wrapper |
| `src/components/TelegramLoginWidget.tsx` | Login Widget injector |
| `src/components/ForgotPasswordModal.tsx` | Password reset form |
| `src/pages/Welcome.tsx` | Login + register + provider buttons |
| `src/pages/WelcomeTelegram.tsx` | Telegram pending-ticket redemption |
| `src/pages/WelcomeGoogle.tsx` | Google pending-ticket redemption |
| `src/pages/MiniAppEntry.tsx` | Telegram Mini App entry |
| `src/pages/VerifyEmail.tsx`, `ResetPassword.tsx` | Email-link landings |
| `src/pages/SettingsPage.tsx` | Logout, change password, linked methods, attach-email |
| `src/lib/validators.ts` | Zod schemas |
| `src/lib/apiError.ts` | `showApiError(err, fallback)` toast helper |
| `src/lib/jwt.ts` | `getStaffRoleFromAccessToken` |
| `src/lib/telegramWebApp.ts` | `isTelegramMiniApp()` etc. |
| `src/lib/inviteRedirect.ts` | `sessionStorage` invite carry-over |
| `src/lib/authNavigation.ts` | Post-login destination resolver |

---

## 📚 Related docs

- [API_INTEGRATION.md](./API_INTEGRATION.md) — dual-mode mock/API layer
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) — Google Cloud Console setup
- [HTTPS_SETUP.md](./HTTPS_SETUP.md) — Cloudflare + Origin Certificate
- [`../../lovecraft/Lovecraft/docs/AUTHENTICATION.md`](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md) — backend auth design
- [`../../lovecraft/Lovecraft/docs/TELEGRAM_AUTH.md`](../../lovecraft/Lovecraft/docs/TELEGRAM_AUTH.md) — Telegram Login Widget + Mini App
