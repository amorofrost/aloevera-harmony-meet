# Design: User-Visible Error Handling & Form Validation

**Date:** 2026-03-12
**Issues:** #9 (error handling) + #10 (form validation)
**Status:** Approved

---

## Overview

Two related improvements to make the app usable in production:

1. **Issue #9** — Surface API failures to users via targeted toast notifications on auth actions and form submissions (currently all errors go silently to `console.error`)
2. **Issue #10** — Add validation to all forms using Zod schemas and react-hook-form (both libraries are installed but unused)

---

## Shared Utilities

### `src/lib/validators.ts`

Zod schemas shared across all forms:

- **`loginSchema`** — email (valid format), password (non-empty)
- **`registerSchema`** — email (valid format), password (≥8 chars, at least one uppercase, lowercase, digit, and special char — matches backend requirements), name (non-empty), age (18–99 integer), location (non-empty), gender (non-empty), bio (optional, max 500 chars)
- **`profileEditSchema`** — name (non-empty), age (18–99), location (non-empty), bio (optional, max 500 chars)
- **`messageSchema`** — content (non-empty after trim, max 2000 chars)
- **`replySchema`** — content (non-empty after trim, max 5000 chars)

TypeScript types inferred with `z.infer<typeof schema>` for use with `react-hook-form`.

### `src/lib/apiError.ts`

```typescript
export function showApiError(err: unknown, fallback = "Something went wrong") {
  // Extracts err.error.message from ApiResponse error shape if present
  // Falls back to the provided fallback string
  // Calls toast.error()
}
```

`showApiError` only handles display. Any branching on `error.code` (e.g. mapping `EMAIL_TAKEN` to a field-level `setError`) is the caller's responsibility at the call site, not inside this helper.

---

## Toast Setup (`src/App.tsx`)

Add `<Toaster />` from `sonner` inside `BrowserRouter`:
- Position: `bottom-center` (avoids overlap with mobile bottom navigation)
- `richColors` enabled (red for errors, green for successes)

---

## Auth Forms (`src/pages/Welcome.tsx`)

### Login form
- Migrate to `useForm<LoginSchema>` with `zodResolver`
- Inline field errors on submit only (fields are simple; no blur-triggered validation needed)
- `setError('root', ...)` for API-level errors (wrong credentials) shown inline below the form
- `showApiError(err, "Login failed")` for unexpected failures (network errors, etc.)
- `toast.success("Welcome back!")` on successful login

### Register form
- Migrate to `useForm<RegisterSchema>` with `zodResolver`
- Inline field errors: triggered on blur for all fields, and for all fields on submit
- Password field wired to existing requirement hints UI
- Known field-level API errors (e.g. email already taken) mapped to `setError('email', { message: ... })` as inline field errors, not toasts
- `showApiError(err, "Registration failed")` for unexpected/non-field API failures
- `toast.success("Account created! Check your email to verify.")` on success

---

## Profile Edit Form (`src/pages/SettingsPage.tsx`)

- Migrate profile edit fields to `useForm<ProfileEditSchema>` with `zodResolver`
- Inline field errors on submit
- `reset()` on cancel to restore original values
- `toast.success("Profile updated")` on successful save
- `showApiError(err, "Failed to update profile")` on failure
- Logout: `showApiError(err, "Logout failed")` if `authApi.logout()` fails (currently silent)

---

## Message & Reply Inputs

### Private chat (`src/pages/Friends.tsx`) & Group chat (`src/pages/Talks.tsx`)

These inputs are mock-only (no real API call for send). Use lightweight controlled validation instead of react-hook-form. `messageSchema` is defined in `validators.ts` for future use but is intentionally not wired here since send is mock-only and the overhead of react-hook-form is unnecessary:
- Block submit on empty/whitespace-only content
- Show inline error `"Message can't be empty"` below the input
- Clear error on next keystroke
- No toast (send is local/mock only)

### Forum reply (`src/components/forum/TopicDetail.tsx`)

Forum replies call the real API (`forumsApi.createReply`). Use `useForm<ReplySchema>` with `zodResolver` (single field, enforces non-empty + max 5000 chars):
- Inline error below the textarea if validation fails
- `toast.success("Reply posted")` on success; clear and reset the form
- `showApiError(err, "Failed to post reply")` on API failure

---

## What Is NOT Changing

- `apiClient.ts` — no global toast interceptor; 401 silent-refresh logic untouched
- Existing `isLoading` state patterns in pages — kept as-is to avoid regressions
- TypeScript strictness settings — out of scope for this change
- Any page not listed above (Friends search/likes, AloeVera, Talks forum browsing)

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/validators.ts` | **New** — Zod schemas |
| `src/lib/apiError.ts` | **New** — `showApiError` helper |
| `src/App.tsx` | Add `<Toaster />` |
| `src/pages/Welcome.tsx` | Migrate login + register to react-hook-form |
| `src/pages/SettingsPage.tsx` | Migrate profile edit to react-hook-form; add logout toast |
| `src/components/forum/TopicDetail.tsx` | Add reply validation + toasts |
| `src/pages/Friends.tsx` | Add message empty-check validation |
| `src/pages/Talks.tsx` | Add message empty-check validation |
