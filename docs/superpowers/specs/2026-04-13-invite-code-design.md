# Invite Code — Design Spec

**Date**: 2026-04-13  
**Status**: Approved  
**Scope**: Frontend (`aloevera-harmony-meet`) + Backend (`lovecraft`)

---

## Overview

Registration is gated by a single invite code stored in the backend `.env`. The invite code input field appears in the registration form only when a code is configured; when no code is set the field is hidden and registration is open. Validation happens exclusively on the backend — the code is never exposed in the JS bundle.

---

## Backend

### Configuration

`INVITE_CODE` environment variable in `Lovecraft/Lovecraft.Backend` (read via `IConfiguration`).

| Value | Behaviour |
|---|---|
| Non-empty string | Invite code required; registration blocked if code doesn't match |
| Empty / not set | Invite code validation skipped; registration open |

### New endpoint

```
GET /api/v1/auth/registration-config
```

- **Auth**: none (public)
- **Response**:
  ```json
  { "success": true, "data": { "inviteCodeRequired": true }, "timestamp": "..." }
  ```
- Implemented as a new action on `AuthController`
- `inviteCodeRequired` is `true` iff `INVITE_CODE` is a non-empty string in config

### DTO changes

`Lovecraft.Common/DTOs/Auth/AuthDtos.cs`:

```csharp
// New response DTO
public record RegistrationConfigDto(bool InviteCodeRequired);

// Existing DTO — add one property
public class RegisterRequestDto
{
    // ... existing fields ...
    public string? InviteCode { get; set; }  // nullable — omitted when not required
}
```

### Service changes

Both `MockAuthService.RegisterAsync` and `AzureAuthService.RegisterAsync`:

1. Read `INVITE_CODE` from `IConfiguration` (injected via constructor)
2. If `INVITE_CODE` is non-empty **and** `request.InviteCode` does not match (case-sensitive) → return failure:
   ```json
   { "success": false, "error": { "code": "INVALID_INVITE_CODE", "message": "Invalid invite code" } }
   ```
3. Otherwise proceed with existing registration logic

### `.env` changes

```env
# Added to Lovecraft/Lovecraft/.env (and .env.example)
INVITE_CODE=
```

Empty by default → validation skipped in development.

---

## Frontend

### `src/lib/validators.ts`

Export two registration schemas:

```typescript
// Existing — no invite field
export const registerSchema = z.object({ /* name, email, password, age, gender, location, bio */ });

// Extended — invite field required
export const registerSchemaWithInvite = registerSchema.extend({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type RegisterSchemaWithInvite = z.infer<typeof registerSchemaWithInvite>;
```

### `src/services/api/authApi.ts`

```typescript
// New method
getRegistrationConfig(): Promise<ApiResponse<{ inviteCodeRequired: boolean }>>

// Mock mode returns: { success: true, data: { inviteCodeRequired: false } }
// API mode calls: GET /api/v1/auth/registration-config
```

`register()` already accepts a payload object — add optional `inviteCode?: string` to the argument type.

### `src/pages/Welcome.tsx` — registration tab changes

1. On mount (inside the existing register tab's `useEffect` or a dedicated one), call `authApi.getRegistrationConfig()` and store `inviteCodeRequired: boolean` in local state. While loading show a small spinner in place of the form.

2. Initialise `useForm` with `zodResolver(inviteCodeRequired ? registerSchemaWithInvite : registerSchema)`.

3. Conditionally render the invite code field between the existing fields (after location, before the submit button):
   ```tsx
   {inviteCodeRequired && (
     <div>
       <Input
         placeholder={t('register.inviteCodePlaceholder')}
         {...form.register('inviteCode')}
       />
       {form.formState.errors.inviteCode && (
         <p className="text-xs text-destructive mt-1">
           {form.formState.errors.inviteCode.message}
         </p>
       )}
     </div>
   )}
   ```

4. On `INVALID_INVITE_CODE` response code, call `form.setError('inviteCode', { message: 'Invalid invite code' })` — inline error on the field, not a toast.

### `src/contexts/LanguageContext.tsx`

Add two translation keys:

| Key | Russian | English |
|---|---|---|
| `register.inviteCode` | `Инвайт-код` | `Invite code` |
| `register.inviteCodePlaceholder` | `Введите инвайт-код` | `Enter invite code` |

---

## Data flow

```
Welcome.tsx mounts (register tab)
  → authApi.getRegistrationConfig()
      mock mode → { inviteCodeRequired: false }  (no field shown)
      api mode  → GET /api/v1/auth/registration-config → { inviteCodeRequired: bool }
  → show/hide invite code field
  → useForm uses matching schema

User submits form
  → authApi.register({ ..., inviteCode? })
      mock mode → success (no code check)
      api mode  → POST /api/v1/auth/register
                    backend checks INVITE_CODE config
                    match / empty config → create user, return tokens
                    no match → { error: { code: "INVALID_INVITE_CODE" } }
  → INVALID_INVITE_CODE → form.setError('inviteCode', ...)
  → other errors → showApiError(err, fallback)
```

---

## Error handling

| Scenario | Behaviour |
|---|---|
| `getRegistrationConfig` fails | Assume `inviteCodeRequired: false`, log error. Field hidden — registration remains usable. |
| Invite code field empty on submit | Zod catches it; inline error `"Invite code is required"` |
| Wrong invite code | Backend returns `INVALID_INVITE_CODE`; inline error on field |
| All other registration errors | `showApiError(err, fallback)` → toast |

---

## Tests

### Backend (`Lovecraft.UnitTests/AuthenticationTests.cs`)

- `RegisterAsync` with valid invite code → succeeds
- `RegisterAsync` with invalid invite code → returns `INVALID_INVITE_CODE`
- `RegisterAsync` with `InviteCode = null` when code is configured → returns `INVALID_INVITE_CODE`
- `RegisterAsync` when `INVITE_CODE` not configured → succeeds regardless of `InviteCode` value
- `GetRegistrationConfig` with code configured → `inviteCodeRequired: true`
- `GetRegistrationConfig` without code → `inviteCodeRequired: false`

### Frontend (`src/pages/__tests__/Welcome.test.tsx`)

- When `getRegistrationConfig` returns `inviteCodeRequired: false` → invite code field not in DOM
- When `getRegistrationConfig` returns `inviteCodeRequired: true` → invite code field rendered
- Submitting with invite code field visible but empty → Zod inline error, no API call
- Successful submission includes `inviteCode` in payload
- `INVALID_INVITE_CODE` response → inline error on invite code field

---

## Deployment

1. Push backend + frontend changes to GitHub
2. SSH to VM, pull both repos, rebuild and restart the stack
3. Add `INVITE_CODE=<chosen-code>` to `~/src/lovecraft/Lovecraft/.env` on the VM
4. Update `D:\src\misc\VM_DEPLOYMENT.md` with the new env var

---

## Out of scope

- Multiple invite codes (tracked as MCF.10 in `docs/ISSUES.md`)
- Invite code expiry or per-user codes
- Admin UI for managing codes
- Rate limiting on `registration-config` endpoint (already covered by existing rate limiter on auth routes if needed)
