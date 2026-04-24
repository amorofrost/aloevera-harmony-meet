# Google OAuth (Sign-In) setup — full guide

This guide walks you through setting up **Google Sign-In (Google Identity Services)** for the AloeVera Harmony Meet stack when you **do not yet have a Google Cloud account**.

The implementation in these repos uses a **frontend Google button** that returns an **ID token (JWT)**, and the backend validates that token and issues the app’s own **JWT access/refresh** pair.

---

## What you are setting up (high-level)

- **Frontend (React)**: Shows an official Google Sign-In button. On success it receives a **JWT “credential”** (Google ID token).
- **Backend (Lovecraft .NET)**: Verifies the Google ID token using your **Web client ID** as the audience, then:
  - signs in an already-known Google user, or
  - auto-links Google to an existing account with the same email, or
  - returns `pending` so the user can complete profile fields (`/welcome/google`).

---

## Prerequisites

- A Google account (Gmail is fine).
- Access to your dev environment where you can set environment variables (local `.env` or Docker Compose env).

---

## Step 1 — Create a Google Cloud account + project

1. Go to **Google Cloud Console** at `https://console.cloud.google.com/`.
2. If prompted, create/accept the Google Cloud terms. (A billing account may be requested by Google, but OAuth credentials for web apps are typically available without paid services.)
3. Create a new project:
   - Project name: `AloeVera Harmony Meet` (or any name)
   - Note the **Project ID**

---

## Step 2 — Configure the OAuth consent screen

1. In Google Cloud Console, open **APIs & Services → OAuth consent screen**.
2. Choose **External** (unless you are using Google Workspace and want Internal).
3. Fill in:
   - **App name**: `AloeVera Harmony Meet`
   - **User support email**
   - **Developer contact email**
4. Scopes:
   - For this implementation, the default “email/profile/openid” is sufficient (Google Sign-In).
5. Test users:
   - While in development/unverified mode, add your own email(s) as **Test users**.

If Google asks for app verification later, you can keep this in testing mode for internal development.

---

## Step 3 — Create OAuth 2.0 Client ID (Web)

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Select **Web application**.
4. Add **Authorized JavaScript origins** (these must match your browser origin exactly):
   - Local dev (Vite in this project is typically `8080`):
     - `http://localhost:8080`
   - If you also run Vite on 5173:
     - `http://localhost:5173`
   - Production:
     - `https://aloeve.club`
     - `https://www.aloeve.club`
5. (Optional) Authorized redirect URIs
   - **Not required** for the current ID-token flow (we’re not using the classic OAuth redirect “code” flow in the browser).

After creation, copy:

- **Client ID**: looks like `1234567890-abc123.apps.googleusercontent.com`

You do **not** need the Client Secret for this specific implementation.

---

## Step 4 — Configure the backend (Lovecraft)

The backend expects the **Google OAuth Web client ID** for ID-token validation.

### Option A: Environment variable (recommended)

Set:

- `GOOGLE_OAUTH_CLIENT_ID=<your client id>`

Example (PowerShell):

```powershell
$env:GOOGLE_OAUTH_CLIENT_ID="1234567890-abc123.apps.googleusercontent.com"
```

### Option B: appsettings.json

In `lovecraft/Lovecraft/Lovecraft.Backend/appsettings.json`:

```json
{
  "Google": {
    "ClientId": "1234567890-abc123.apps.googleusercontent.com"
  }
}
```

### Verify the backend sees it

- `GET /api/v1/auth/google-config` should return the same client id.
- `POST /api/v1/auth/google-login` should stop returning `503 GOOGLE_NOT_CONFIGURED`.

---

## Step 5 — Configure the frontend (AloeVera Harmony Meet)

The frontend needs the **same** Web client ID to render Google’s sign-in button.

### Option A: Frontend env file

Create/update `aloevera-harmony-meet/.env.development`:

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
VITE_API_MODE=api
```

### Option B: Rely on backend `/google-config` (API mode)

If you do not set `VITE_GOOGLE_CLIENT_ID`, the UI will attempt to call:

- `GET /api/v1/auth/google-config`

and use that `clientId` at runtime **only in API mode**.

---

## Step 6 — Run and test (happy path)

1. Start backend + frontend (Docker or local).
2. Open the app and go to `/`.
3. Click **Continue with Google**.

Expected outcomes:

- **Existing Google-linked user**: immediately signs in → `/friends`.
- **Existing email/password account with same email**: backend auto-links Google → signs in.
- **Brand new user**: backend returns `pending` → frontend routes to `/welcome/google` to finish profile and create the account.

If your app requires an invite code (appconfig), `/welcome/google` will ask for it.

---

## Common issues + fixes

### “Google (not configured)” in UI

- Set `VITE_GOOGLE_CLIENT_ID` in frontend env **or**
- Ensure backend has `GOOGLE_OAUTH_CLIENT_ID` and `VITE_API_MODE=api` so `/api/v1/auth/google-config` works.

### Backend responds `GOOGLE_TOKEN_INVALID`

- Ensure backend `GOOGLE_OAUTH_CLIENT_ID` matches the client id used by the frontend button.
- Ensure you’re testing from an origin that is listed in **Authorized JavaScript origins**.
- Ensure system clock is correct (JWT validation is time-based).

### Google sign-in button shows but click does nothing

- Check browser console for blocked scripts or CSP issues.
- Ensure you’re not in `VITE_API_MODE=mock` (Google sign-in is API-only in this app).

---

## Security notes

- The backend validates the ID token signature and audience; it does **not** trust the frontend.
- The backend issues its own JWT access/refresh tokens; Google tokens are not stored or used for API auth.
- The app still uses the existing invite/registration policy; Google sign-up does not bypass it.

