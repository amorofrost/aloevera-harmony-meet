# Email Service & Account Recovery — Design Spec

**Date**: 2026-03-16
**Issue**: PB.1 — Email Service Missing
**Status**: Approved

---

## Overview

Wire up a real email delivery layer (SendGrid) so that email verification and password reset work end-to-end. Covers backend `IEmailService` abstraction, auth service integration, and three new frontend surfaces: a Forgot Password modal, an email verification landing page, and a password reset page.

---

## Backend

### `IEmailService` Interface

`IEmailService` is defined in a new standalone file `Lovecraft.Backend/Services/IEmailService.cs`. It is **not** appended to `IServices.cs` (which contains domain content interfaces: `IUserService`, `IEventService`, etc.) or to `IAuthService.cs` (which is auth-specific). A dedicated file reflects that `IEmailService` is an infrastructure/support interface consumed only by auth services. The two implementations live in separate files alongside it.

```csharp
public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string name, string verificationToken);
    Task SendPasswordResetEmailAsync(string toEmail, string name, string resetToken);
}
```

Both methods include `name` for a personalised email greeting ("Hi, Anna").

### `NullEmailService`

New file: `Lovecraft.Backend/Services/NullEmailService.cs`

No-op implementation used when `SENDGRID_API_KEY` is not configured. Logs the token and constructed link to the console — preserves current dev behaviour with zero config required. An explicitly empty `SENDGRID_API_KEY` (e.g. `SENDGRID_API_KEY=`) also triggers this implementation, which is intentional.

### `SendGridEmailService`

New file: `Lovecraft.Backend/Services/SendGridEmailService.cs`

Uses the official `SendGrid` NuGet package. Reads config via `builder.Configuration["KEY"]` — the same approach used for `JWT_SECRET_KEY` and `AZURE_STORAGE_CONNECTION_STRING`, which reads from both `appsettings.json` and environment variables:

| Key | Description | Default in `appsettings.json` |
|---|---|---|
| `SENDGRID_API_KEY` | SendGrid API key | `""` (empty → `NullEmailService`) |
| `FROM_EMAIL` | Sender address | `"noreply@aloeband.ru"` |
| `FRONTEND_BASE_URL` | Base URL for token links in emails only | `"http://localhost:8080"` |

`FRONTEND_BASE_URL` is **only used to construct email link strings**. It does not affect CORS policy, which is separately configured in `Program.cs` via hardcoded allowed origins.

Constructs links:
- Verification: `{FRONTEND_BASE_URL}/verify-email?token={token}`
- Reset: `{FRONTEND_BASE_URL}/reset-password?token={token}`

Email body is simple inline HTML in C# strings. No external template engine.

`SendGridEmailService` is registered as a **Singleton** — `SendGridClient` is thread-safe and reusable, making Singleton appropriate.

### DI Registration (`Program.cs`)

`IEmailService` is registered **once, unconditionally, at the top level** — before the `if (useAzureStorage)` service registration block:

```csharp
var sendGridKey = builder.Configuration["SENDGRID_API_KEY"];
if (!string.IsNullOrEmpty(sendGridKey))
    builder.Services.AddSingleton<IEmailService, SendGridEmailService>();
else
    builder.Services.AddSingleton<IEmailService, NullEmailService>();
```

### Auth Service Wiring

`IEmailService` is injected into both `MockAuthService` and `AzureAuthService` via constructor.

**Registration (`RegisterAsync`)**: The user record (with `Name`) is available at creation time. After generating the verification token, call `IEmailService.SendVerificationEmailAsync(email, name, token)`.

**Forgot password (`ForgotPasswordAsync`)**:

- **`MockAuthService`**: already looks up the user by email internally. If user not found → return success immediately without calling `IEmailService` (anti-enumeration). If user found → call `IEmailService.SendPasswordResetEmailAsync(email, user.Name, token)`.
- **`AzureAuthService`**: currently only does an email-index lookup to obtain `userId` (via `_emailIndexTable`). After getting `userId`, an **additional** `_usersTable.GetEntityAsync(partitionKey, userId)` call is required to load the full `UserEntity` and obtain `user.Name`. This second read must be in its **own separate** `try/catch` block — it must not be swallowed by the outer `catch (RequestFailedException ex) when (ex.Status == 404)` that guards the index lookup. On inner 404 (index entry exists but user row is missing — data inconsistency edge case): log a warning, **do not write the reset token to the auth tokens table**, and return `true` immediately (anti-enumeration contract preserved). Happy path: load the full entity first → then write the reset token → then call `IEmailService.SendPasswordResetEmailAsync(email, user.Name, token)`.

**Email send failure handling**: If `IEmailService.SendVerificationEmailAsync` or `IEmailService.SendPasswordResetEmailAsync` throws (e.g. transient SendGrid error), the token has already been written to the table. On throw: log a warning, **do not rethrow** — the token remains valid so the user can request again. Swallowing the exception preserves the anti-enumeration contract and avoids exposing infrastructure errors to the caller.

No changes to `ResetPasswordAsync` or `VerifyEmailAsync` — token validation logic already exists.

### `verify-email` Endpoint — HTTP Method

The existing backend controller defines `GET /api/v1/auth/verify-email?token={token}` with `[FromQuery] string token`. The frontend must use a `GET` request with the token as a query parameter — **not** a POST with a body.

---

## New `authApi.ts` Methods

| Method | Mock mode | API mode |
|---|---|---|
| `forgotPassword(email)` | returns `{ success: true }` | `POST /api/v1/auth/forgot-password` `{ email }` |
| `verifyEmail(token)` | returns `{ success: true }` (token is never validated in mock mode — the absent-token guard is in the page component, not in the API call) | `GET /api/v1/auth/verify-email?token={token}` |
| `resetPassword(token, newPassword)` | returns `{ success: true }` | `POST /api/v1/auth/reset-password` `{ token, newPassword }` |

---

## New Zod Schemas (`src/lib/validators.ts`)

Each schema exports both the schema object and the inferred TypeScript type, following the existing pattern:

```typescript
export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

// resetPasswordSchema validates each field individually only.
// Cross-field equality (password === confirmPassword) is NOT checked via .refine()
// because Zod refinement messages are static strings and cannot use t().
// Instead, the ResetPassword component calls form.setError('confirmPassword', ...)
// with a translated message in the submit handler before making the API call.
export const resetPasswordSchema = z.object({
  // Copy the EXACT validation chain from registerSchema.password in src/lib/validators.ts
  // (min length + all four .regex() calls — do not paraphrase or substitute)
  password: z.string()/* copy chain from registerSchema.password */,
  confirmPassword: z.string().min(1),
});
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
```

**Cross-field validation in `ResetPassword.tsx`**: Before calling `authApi.resetPassword`, check `data.password === data.confirmPassword`. If they don't match, call `form.setError('confirmPassword', { message: t('resetPassword.passwordMismatch') })` and return early. Add `resetPassword.passwordMismatch` to translation keys.

**Field mapping note**: The `ResetPassword` form field is named `password`. When calling `authApi.resetPassword(token, newPassword)`, the value of `data.password` maps to the `newPassword` argument — the API body sends `{ token, newPassword }`, not `{ token, password }`.

---

## Environment Variables

The existing `docker-compose.yml` uses `env_file: - .env` for all application config keys (`JWT_SECRET_KEY`, `AZURE_STORAGE_CONNECTION_STRING`, etc.). Follow the same convention — add the three new keys to the **`.env` file** (not to an `environment:` block in `docker-compose.yml`). After deploying, the `.env` file on the Azure VM must also be updated with the real `SENDGRID_API_KEY`; without it the deployed instance will silently fall back to `NullEmailService`.

```
SENDGRID_API_KEY=              # leave empty for NullEmailService in local dev
FROM_EMAIL=noreply@aloeband.ru
FRONTEND_BASE_URL=http://20.153.164.3:8080
```

Also add these keys with empty/default values to `appsettings.json` so `IConfiguration` has them as fallbacks.

---

## Frontend

All three new routes are **public** — added to `App.tsx` as bare `<Route>` elements, not wrapped in `<ProtectedRoute>`.

All user-facing strings go through `t()` from `useLanguage()`. New translation keys are added to both `ru` and `en` objects in `LanguageContext.tsx`. Key names are specified below.

### Forgot Password Modal (`src/components/ForgotPasswordModal.tsx`)

- Triggered by a "Forgot password?" link on the login form in `Welcome.tsx`
- shadcn `<Dialog>` with two internal states:
  - **Form**: email field + submit button. `useForm<ForgotPasswordSchema>` + `zodResolver(forgotPasswordSchema)`. The submit button is **disabled and shows a loading indicator** while the API call is in flight (`isSubmitting` from `formState`). Calls `authApi.forgotPassword(email)`. `showApiError` in catch.
  - **Success**: `{t('forgotPassword.successMessage')}` — *"If that email is registered, you'll receive a reset link shortly."* + Close button. Always shown on API success — prevents email enumeration. When the modal is closed from the Success state and reopened, it resets to the Form state **with the email field retaining the previously entered value** (so the user can re-submit without retyping). Because shadcn `<Dialog>` unmounts its children on close (losing all local state), the email value and the success/form state flag must be **lifted to `Welcome.tsx`** and passed into `ForgotPasswordModal` as props — not held in local state inside the modal. The prop interface requires both the current value **and** a setter so the modal can update the stored value as the user types:

```typescript
interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
}
```

`Welcome.tsx` holds `forgotEmail` and `setForgotEmail` in its own state, resets the success flag on open, and passes all four props down.

Translation keys: `forgotPassword.title`, `forgotPassword.emailLabel`, `forgotPassword.submitButton`, `forgotPassword.successMessage`, `forgotPassword.closeButton`.

### Email Verification Page (`src/pages/VerifyEmail.tsx`) — route: `/verify-email`

Reads `?token=` from URL query string on mount. If token is **absent**, treat as error state immediately (no API call). Otherwise calls `authApi.verifyEmail(token)` on mount.

| State | Trigger | UI |
|---|---|---|
| Loading | token present, request in flight | Spinner + `t('verifyEmail.loading')` |
| Success | API returns success | Checkmark + `t('verifyEmail.success')` + button navigating to `/` |
| Error | token absent **or** API returns error | `t('verifyEmail.error')` + button navigating to `/` |

The success state navigates to `/` (the `Welcome`/login screen) because email verification does not issue a JWT — the user still needs to log in after verifying. This is intentional. Do not navigate to `/friends` — that would hit `ProtectedRoute` and double-redirect.

Translation keys: `verifyEmail.loading`, `verifyEmail.success`, `verifyEmail.successButton`, `verifyEmail.error`, `verifyEmail.errorButton`.

**Asymmetry with ResetPassword**: `VerifyEmail` shows an error state when the token is absent (user sees an explanation). `ResetPassword` redirects to `/` when the token is absent (the page cannot function at all without a token, so there is nothing useful to show). This is intentional.

### Reset Password Page (`src/pages/ResetPassword.tsx`) — route: `/reset-password`

Reads `?token=` from URL. Redirects to `/` immediately if token is absent (the page cannot function without a token).

- Form: **New password** + **Confirm password** fields
- `useForm<ResetPasswordSchema>` + `zodResolver(resetPasswordSchema)`
- On submit: `data.password` is passed as the `newPassword` argument — `authApi.resetPassword(token, data.password)`
- On success: `toast.success(t('resetPassword.successToast'))` → navigate to `/`
- On error: `showApiError(err, t('resetPassword.errorFallback'))` — stays on page

Translation keys: `resetPassword.title`, `resetPassword.passwordLabel`, `resetPassword.confirmLabel`, `resetPassword.submitButton`, `resetPassword.successToast`, `resetPassword.errorFallback`, `resetPassword.passwordMismatch`.

---

## Files Changed / Created

### Backend (`D:\src\lovecraft\Lovecraft\`)

| File | Action |
|---|---|
| `Lovecraft.Backend/Services/IEmailService.cs` | Create — `IEmailService` interface |
| `Lovecraft.Backend/Services/NullEmailService.cs` | Create |
| `Lovecraft.Backend/Services/SendGridEmailService.cs` | Create |
| `Lovecraft.Backend/Services/MockAuthService.cs` | Modify — inject + call `IEmailService` in `RegisterAsync` and `ForgotPasswordAsync` |
| `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` | Modify — inject + call `IEmailService`; add user lookup in `ForgotPasswordAsync` to get `Name` |
| `Lovecraft.Backend/Program.cs` | Modify — top-level `IEmailService` DI registration before `if (useAzureStorage)` block |
| `Lovecraft.Backend/appsettings.json` | Modify — add `SENDGRID_API_KEY` (empty), `FROM_EMAIL`, `FRONTEND_BASE_URL` defaults |
| `Lovecraft/docker-compose.yml` | No change needed — already uses `env_file: - .env` |

### Frontend (`D:\src\aloevera-harmony-meet\`)

| File | Action |
|---|---|
| `src/services/api/authApi.ts` | Modify — add `forgotPassword`, `verifyEmail`, `resetPassword` |
| `src/lib/validators.ts` | Modify — add `forgotPasswordSchema` + `ForgotPasswordSchema`, `resetPasswordSchema` + `ResetPasswordSchema` |
| `src/components/ForgotPasswordModal.tsx` | Create |
| `src/pages/VerifyEmail.tsx` | Create |
| `src/pages/ResetPassword.tsx` | Create |
| `src/pages/Welcome.tsx` | Modify — add "Forgot password?" link + `<ForgotPasswordModal>` |
| `src/App.tsx` | Modify — add `/verify-email` and `/reset-password` public routes |
| `src/contexts/LanguageContext.tsx` | Modify — add i18n keys for all new UI text (listed per component above) |

---

## Out of Scope

- SendGrid dynamic templates (can be added later)
- Email resend / "resend verification" button
- Unit tests for `SendGridEmailService` (would require mocking HTTP calls to SendGrid)
- 2FA or any other auth flow
