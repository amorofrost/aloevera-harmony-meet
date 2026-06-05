# Meta (Facebook) OAuth — Design Spec

**Date**: 2026-06-05
**Status**: Approved design — ready for implementation planning
**Repos**: `lovecraft` (backend), `aloevera-harmony-meet` (frontend)

## Goal

Add **Facebook (Meta) sign-in** as a third social provider alongside Google and Telegram,
appearing as a round `#1877F2` icon button in the social-login row on Welcome (login + register)
and as a "Link Facebook" option in Settings. Mirror the existing Google/Telegram architecture as
closely as possible to keep the auth surface consistent.

## Chosen approach

- **Frontend**: official **Facebook JS SDK** (`FB.login`), popup-based (no redirect). Mirrors the
  Google official-button UX; no third-party React wrapper deps.
- **Backend verification**: classic access-token flow. The browser obtains a short-lived **access
  token**; the backend verifies it via Graph **`debug_token`** (assert `is_valid` and the token's
  `app_id` equals ours — prevents token substitution from another app) **then** **`/me`** with an
  `appsecret_proof` HMAC to fetch the profile. Both calls are mandatory.
- **No-email accounts**: Facebook may not return an email. When email is present → Google-style smart
  linking. When absent → Telegram-style **synthetic email** `facebook_{id}@facebook.local`,
  unverified, with attach-email available later.

## Non-goals (YAGNI)

- No VK or other providers. No Facebook "Limited Login" (OIDC, mobile-oriented). No anonymous flows.
  No changes to the existing Google/Telegram flows beyond shared helpers/UI rows.

---

## Backend (`Lovecraft`)

Mirrors the Google structure (`GoogleAuthOptions` / `GoogleIdTokenHelper` /
`IAuthService.GoogleLoginAsync` / `GoogleLoginResultDto` / `usergoogleindex`).

### Configuration
- `Configuration/FacebookAuthOptions.cs` → `{ AppId, AppSecret }`, section name `Facebook`.
- `Program.cs`: bind the section + env fallback `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
  (same `PostConfigure` pattern as `GOOGLE_OAUTH_CLIENT_ID`).
- `appsettings.json`: empty `Facebook: { AppId: "", AppSecret: "" }` placeholders.
- **AppId is public; AppSecret is a real secret** — backend `.env` only, never exposed to the client.

### Token verifier
- `Auth/FacebookTokenHelper.cs`: `ValidateAndExtractAsync(accessToken, appId, appSecret, httpClient, logger)`
  → `FacebookUserInfoDto? { Id, Email?, Name, PictureUrl? }`.
  1. `GET https://graph.facebook.com/v21.0/debug_token?input_token={token}&access_token={appId}|{appSecret}`
     → require `data.is_valid == true` and `data.app_id == appId`; else return null.
  2. Compute `appsecret_proof = HMACSHA256(accessToken, appSecret)` (lowercase hex).
  3. `GET https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token={token}&appsecret_proof={proof}`
     → map to `FacebookUserInfoDto`. `Email` may be null (do NOT reject — unlike Google).
  - Pin the Graph version in one constant (`v21.0`, the current stable as of 2026-06; bump deliberately).
  - Invalid/expired/app-mismatch → return null (controller maps to `400 FACEBOOK_TOKEN_INVALID`).
  - Network/transport exceptions propagate (controller → 500/503), not a misleading 400.
- Uses a DI-injected `HttpClient` (named client / `IHttpClientFactory`) so tests can mock the handler.

### DTOs (`Lovecraft.Common/DTOs/Auth/AuthDtos.cs`)
- `FacebookUserInfoDto { Id, Email?, Name, PictureUrl? }`
- `FacebookAuthConfigDto { AppId }`
- `FacebookLoginRequestDto { AccessToken }`
- `FacebookLoginResultDto { Status, Auth?, Ticket?, Facebook?, Message? }` — `Status` ∈
  `signedIn` | `pending` | `emailConflict` (identical shape to `GoogleLoginResultDto`).
- `FacebookRegisterRequestDto` — same fields as `GoogleRegisterRequestDto`
  (`Ticket, AccountName, Name, Age, Location, Country?, Region?, SecondaryCountry?, SecondaryRegion?, Gender, Bio, InviteCode?`).
- `FacebookLinkRequestDto { AccessToken }`.

### Service (`IAuthService` + `AzureAuthService` + `MockAuthService`)
- `FacebookLoginAsync(string accessToken) → FacebookLoginResultDto?`
  1. If AppId/AppSecret unset → null (controller → `503 FACEBOOK_NOT_CONFIGURED`).
  2. Verify token → `FacebookUserInfoDto` (null → controller → `400 FACEBOOK_TOKEN_INVALID`).
  3. Known FB id in `userfacebookindex` → load user → `signedIn`.
  4. Else if **email present** and matches `useremailindex`:
     - existing account has no FB linked → link FB (write index + `FacebookUserId` + add
       `"facebook"` to AuthMethods) → `signedIn`.
     - existing account already linked to a *different* FB id → `emailConflict`.
  5. Else (new identity, or no email) → mint `GenerateFacebookPendingTicket(fbInfo)` → `pending`
     (+ `Facebook` payload). **No user row written** on the pending path.
- `FacebookRegisterAsync(FacebookRegisterRequestDto) → AuthResponseDto?`
  - Validate ticket → provision user (invite gate, AccountName, profile fields). Email source:
    the verified FB email if present, else synthetic `facebook_{id}@facebook.local` (reuse the
    Telegram-only synthetic-email path). Write `userfacebookindex` (atomic insert-if-absent),
    set `FacebookUserId`, AuthMethods `["facebook"]`. Best-effort external photo download.
- `FacebookLinkAsync(string userId, string accessToken) → FacebookLinkResult`
  (enum-style result: `Ok` | `TokenInvalid` | `AlreadyLinkedElsewhere` | `AlreadyHasFacebook`).
  - Authorized. Verify token; if that FB id is already in `userfacebookindex` under another account →
    `AlreadyLinkedElsewhere`; if the current user already has FB → `AlreadyHasFacebook`; else attach to
    the current user (index + `FacebookUserId` + AuthMethods `"facebook"`) → `Ok`. Controller maps the
    result to 200 / 400 / 409. Mirrors the `AttachEmailResult` pattern.
- `JwtService`: `GenerateFacebookPendingTicket` / `ValidateFacebookPendingTicket` (mirror Google ticket).

### Controller (`Controllers/V1/AuthController.cs`)
- `GET  /auth/facebook-config` — public, returns `{ appId }` (mirrors `google-config`).
- `POST /auth/facebook-login` — public, `[EnableRateLimiting("AuthRateLimit")]`, body `{ accessToken }`.
- `POST /auth/facebook-register` — public, rate-limited.
- `POST /auth/facebook-link` — **authorized**, body `{ accessToken }` (Settings linking).
- Error codes: `FACEBOOK_NOT_CONFIGURED` (503), `FACEBOOK_TOKEN_INVALID` (400), `INVALID_REQUEST` (400).
- Add a BI metric call site mirroring the existing `google-login` one.

### Storage
- New table **`userfacebookindex`** — PK = FB user id, RK = `INDEX`, value `UserId`
  (`UserFacebookIndexEntity` cloning `UserGoogleIndexEntity`). Register in `Storage/TableNames.cs`
  → **34 tables**; create on startup; seed in `Lovecraft.Tools.Seeder`.
- `UserEntity.FacebookUserId` (new string field, default empty).
- `"facebook"` becomes a valid value in `AuthMethodsJson` and `GET /auth/methods`.

---

## Frontend (`aloevera-harmony-meet`)

### Components & services
- `src/components/FacebookSignInButton.tsx` — round **#1877F2** button, white "f" glyph, `h-11 w-11`
  (matches Google/Telegram icons). Loads the FB JS SDK (`connect.facebook.net/en_US/sdk.js`) once
  (module-level promise), `FB.init({ appId, version: 'vXX.0', cookie:false, xfbml:false })`. On click
  `FB.login(cb, { scope: 'public_profile,email' })` → `authResponse.accessToken` →
  `authApi.facebookLogin(token)` → handle:
  - `signedIn` → store tokens, navigate `/friends`.
  - `pending` → `navigate('/welcome/facebook', { state: { ticket, facebook } })`.
  - `emailConflict` → toast the message.
  - App id resolved at runtime from `GET /auth/facebook-config` (or `VITE_FACEBOOK_APP_ID`); renders a
    "not configured" placeholder circle when absent (mirrors Google). API-mode only.
- `src/services/api/authApi.ts`: `getFacebookConfig()`, `facebookLogin(accessToken)`,
  `facebookRegister(req)`, `facebookLink(accessToken)` (dual-mode like the Google methods).
- `src/pages/WelcomeFacebook.tsx` + route `/welcome/facebook` in `App.tsx` — clone of `WelcomeGoogle.tsx`
  (profile fields + optional invite → `facebookRegister`).
- `src/pages/Welcome.tsx`: add `<FacebookSignInButton>` to **both** the login and register social rows
  (same `flex justify-center gap-3` row as Google + Telegram).
- `src/components/settings/LinkedAccountsCard.tsx`: add a **Facebook row** (icon + "Linked" / Link button).
  Link button runs `FB.login` → `authApi.facebookLink(token)` → reload methods. Mirrors the Telegram row.

### CSP (`nginx.conf`)
- `script-src`: add `https://connect.facebook.net`.
- `frame-src`: add `https://www.facebook.com` (login popup/iframe).
- `connect-src`: add `https://*.facebook.com` (SDK XHRs). Graph calls are backend-side (no client entry needed).

---

## Config / Ops (manual, user-side)

1. Create a Meta app at developers.facebook.com (type **Consumer**) → add the **Facebook Login** product.
2. App settings: **App Domains** + Website **Site URL** = `https://aloeve.club`; add `aloeve.club` to
   "Allowed Domains for the JavaScript SDK".
3. Backend `.env`: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`.
4. **Testing**: add yourself/others as Admin/Developer/Tester (Roles) — works in Dev mode immediately.
5. **Public launch gate (parallel track, not blocking the build)** — to grant the general public
   `email`/`public_profile` (Advanced Access) and switch the app **Live**, Meta requires:
   - **Business Verification** in Meta Business Manager (linked Facebook Page, 2FA, business/identity docs).
   - **App Review** for `email`: written use-case + **screencast** of the login flow + reviewer test steps.
   - **Public Privacy Policy URL** — *new prerequisite: the app has none; a privacy policy page must be added.*
   - **Data Deletion** callback URL or instructions URL — *new prerequisite: must be added.*
   - App icon, category, contact email; compliance with Platform Terms / Developer Policies.
   - The button ships dark (renders "not configured" until `FACEBOOK_APP_ID` is set), so nothing is
     exposed publicly before approval.

---

## Error handling & edge cases

- Token invalid / expired / wrong app → `FACEBOOK_TOKEN_INVALID` (400); user sees a toast.
- Backend not configured → `FACEBOOK_NOT_CONFIGURED` (503); button shows the placeholder anyway
  (it gates on the missing app id before calling).
- No email from Facebook → synthetic email, account still created.
- FB email matches an account already bound to a different FB id → `emailConflict`.
- Linking a FB id already attached elsewhere → conflict error in `facebook-link`.
- Concurrent pending registrations race on the atomic `userfacebookindex` insert (409 → reload), same
  guard as Telegram/Google.
- User closes the FB popup → SDK returns `status !== 'connected'`; stay silent (no error toast).

## Testing

- Backend: `FacebookTokenHelper` tests with a mocked HTTP handler (valid, app-mismatch, invalid,
  no-email). `FacebookPendingFlowTests` mirroring `GooglePendingFlowTests`: known-id signin,
  email auto-link, emailConflict, pending→register (with email), pending→register (no email →
  synthetic), facebook-link, and `FACEBOOK_NOT_CONFIGURED`.
- Frontend: `FacebookSignInButton` render-state test (loading / not-configured / ready); `authApi`
  facebook method dual-mode test.

## Documentation

- New `FACEBOOK_OAUTH_SETUP.md` in both repos (mirror the Google guides, incl. the review checklist).
- Update `lovecraft/.../AUTHENTICATION.md`, `AZURE_STORAGE.md` (34th table), and frontend
  `FRONTEND_AUTH_GUIDE.md`, `AGENTS.md`, `ISSUES.md` changelog.
- Update project memory (table count 33 → 34; Facebook provider added).
