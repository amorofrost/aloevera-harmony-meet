# Error Handling & Form Validation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface API errors to users via toast notifications and add Zod + react-hook-form validation to all forms.

**Architecture:** Add two shared utilities (`validators.ts`, `apiError.ts`), configure the existing `<Sonner />` toast provider, then migrate each form one at a time. Chat message inputs (mock-only) use lightweight controlled validation instead of react-hook-form.

**Tech Stack:** Zod (installed, unused), react-hook-form + @hookform/resolvers (installed, unused), sonner (installed, `<Sonner />` already in App.tsx)

**Spec:** `docs/superpowers/specs/2026-03-12-error-handling-form-validation-design.md`

---

## Chunk 1: Foundation — shared utilities + toast provider

### Task 1: Create `src/lib/validators.ts`

**Files:**
- Create: `src/lib/validators.ts`

The project has no test infrastructure, so verification is manual (build check + runtime smoke test).

- [ ] **Step 1: Create the validators file**

```typescript
// src/lib/validators.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/[0-9]/, 'One number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'One special character'),
  name: z.string().min(1, 'Name is required'),
  age: z
    .number({ invalid_type_error: 'Age is required' })
    .int()
    .min(18, 'Must be at least 18')
    .max(99, 'Must be 99 or under'),
  location: z.string().min(1, 'Location is required'),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

export const profileEditSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z
    .number({ invalid_type_error: 'Age is required' })
    .int()
    .min(18, 'Must be at least 18')
    .max(99, 'Must be 99 or under'),
  location: z.string().min(1, 'Location is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(2000, 'Message is too long'),
});

export const replySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Reply can't be empty")
    .max(5000, 'Reply is too long'),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type ProfileEditSchema = z.infer<typeof profileEditSchema>;
export type MessageSchema = z.infer<typeof messageSchema>;
export type ReplySchema = z.infer<typeof replySchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:\src\aloevera-harmony-meet && npx tsc --noEmit`

Expected: No errors from `src/lib/validators.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: add Zod validation schemas"
```

---

### Task 2: Create `src/lib/apiError.ts`

**Files:**
- Create: `src/lib/apiError.ts`

- [ ] **Step 1: Create the apiError helper**

```typescript
// src/lib/apiError.ts
import { toast } from '@/components/ui/sonner';

export function showApiError(err: unknown, fallback = 'Something went wrong') {
  const message =
    (err as any)?.error?.message ||
    (err instanceof Error ? err.message : null) ||
    fallback;
  toast.error(message);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/apiError.ts
git commit -m "feat: add showApiError toast helper"
```

---

### Task 3: Configure toast provider in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx` line 26

- [ ] **Step 1: Add `position` and `richColors` to `<Sonner />`**

In `src/App.tsx`, change line 26:

Old:
```tsx
<Sonner />
```

New:
```tsx
<Sonner position="bottom-center" richColors />
```

- [ ] **Step 2: Smoke test in browser**

Start dev server: `npm run dev`

Open browser → DevTools console → paste:
```javascript
// This is just to verify the import chain works; no actual toast API in console
```
Navigate to `/` — confirm the page loads without errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: configure Sonner toast position and richColors"
```

---

## Chunk 2: Auth Forms — Welcome.tsx

### Task 4: Migrate login form to react-hook-form

**Files:**
- Modify: `src/pages/Welcome.tsx`

The login form currently uses `loginData` state + manual `handleLogin`. We replace it with `useForm<LoginSchema>`.

Key changes:
- Remove `loginData` state (keep `registerData`, `error`, `success`, `isLoading` for register form — we'll handle them in Task 5)
- Login form: `useForm` with `zodResolver`, `register()` each input, `formState.errors` for field errors, `setError('root')` for API-level errors, `toast.success("Welcome back!")` on success
- Remove the `error` banner display for login (move to root form error) — we keep the existing banner JSX but wire it to `loginForm.formState.errors.root?.message`

- [ ] **Step 1: Add imports at the top of Welcome.tsx**

Add after existing imports (around line 10):
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { loginSchema, type LoginSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
```

- [ ] **Step 2: Add login form hook before other state**

After `const { t } = useLanguage();` (line 16), add:
```tsx
const loginForm = useForm<LoginSchema>({
  resolver: zodResolver(loginSchema),
});
```

- [ ] **Step 3: Replace `handleLogin` (lines 43–67)**

Remove the old `handleLogin` function and replace with:
```tsx
const handleLogin = loginForm.handleSubmit(async (data) => {
  setIsLoading(true);
  try {
    const response = await authApi.login(data);
    if (!response.success) {
      const message = (response as any).error?.message || 'Login failed';
      loginForm.setError('root', { message });
      return;
    }
    if (response.data) {
      apiClient.setAccessToken(response.data.accessToken);
      if (response.data.refreshToken) {
        apiClient.setRefreshToken(response.data.refreshToken);
      }
      toast.success('Welcome back!');
      navigate('/friends');
    }
  } catch (err) {
    showApiError(err, 'Login failed');
  } finally {
    setIsLoading(false);
  }
});
```

- [ ] **Step 4: Update login form JSX**

Replace the login form inputs (lines 176–205) to use `register()`:

Email input — replace `value`/`onChange` with spread `{...loginForm.register('email')}`:
```tsx
<div className="space-y-2">
  <Label htmlFor="email" className="text-white font-medium">
    {t('auth.email')}
  </Label>
  <Input
    id="email"
    type="email"
    placeholder={t('auth.enterEmail')}
    {...loginForm.register('email')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {loginForm.formState.errors.email && (
    <p className="text-xs text-red-300">{loginForm.formState.errors.email.message}</p>
  )}
</div>
```

Password input:
```tsx
<div className="space-y-2">
  <Label htmlFor="password" className="text-white font-medium">
    {t('auth.password')}
  </Label>
  <Input
    id="password"
    type="password"
    placeholder={t('auth.enterPassword')}
    {...loginForm.register('password')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {loginForm.formState.errors.password && (
    <p className="text-xs text-red-300">{loginForm.formState.errors.password.message}</p>
  )}
</div>
```

- [ ] **Step 5: Wire root error and submit button**

Replace the error banner at the top of the login form (the `{error && ...}` block, now repurposed for login root errors only) with:
```tsx
{loginForm.formState.errors.root && (
  <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
    <div className="flex items-center gap-2 text-white">
      <AlertCircle className="w-5 h-5" />
      <span className="text-sm">{loginForm.formState.errors.root.message}</span>
    </div>
  </div>
)}
```

Change the login submit button to `type="submit"` and wrap **only the credentials + button section** in a `<form>`. The OAuth buttons and "Create account" link remain outside the form. Replace the outer `<div className="space-y-6 bg-white/10 ...">` (line 173) with:

```tsx
<div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
  <h2 className="text-2xl font-bold text-white mb-4">Sign In</h2>

  {/* Root error (API-level: wrong credentials) */}
  {loginForm.formState.errors.root && (
    <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
      <div className="flex items-center gap-2 text-white">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">{loginForm.formState.errors.root.message}</span>
      </div>
    </div>
  )}

  <form onSubmit={handleLogin} className="space-y-4">
    {/* email field */}
    <div className="space-y-2">
      <Label htmlFor="email" className="text-white font-medium">{t('auth.email')}</Label>
      <Input id="email" type="email" placeholder={t('auth.enterEmail')}
        {...loginForm.register('email')}
        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
        disabled={isLoading} />
      {loginForm.formState.errors.email && (
        <p className="text-xs text-red-300">{loginForm.formState.errors.email.message}</p>
      )}
    </div>
    {/* password field */}
    <div className="space-y-2">
      <Label htmlFor="password" className="text-white font-medium">{t('auth.password')}</Label>
      <Input id="password" type="password" placeholder={t('auth.enterPassword')}
        {...loginForm.register('password')}
        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
        disabled={isLoading} />
      {loginForm.formState.errors.password && (
        <p className="text-xs text-red-300">{loginForm.formState.errors.password.message}</p>
      )}
    </div>

    <Button type="submit" size="lg"
      className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
      disabled={isLoading}>
      {isLoading ? (
        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing in...</>
      ) : (
        t('auth.signIn')
      )}
    </Button>
  </form>

  {/* OAuth Buttons — outside the form so they don't trigger form submission */}
  <div className="space-y-3 pt-4 border-t border-white/20">
    <p className="text-white/60 text-sm">Or continue with</p>
    <div className="grid grid-cols-3 gap-3">
      <Button onClick={() => handleOAuthLogin('google')} variant="outline"
        className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Google</Button>
      <Button onClick={() => handleOAuthLogin('facebook')} variant="outline"
        className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Facebook</Button>
      <Button onClick={() => handleOAuthLogin('vk')} variant="outline"
        className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>VK</Button>
    </div>
  </div>

  <div className="text-center space-y-2">
    <button onClick={() => setShowRegister(true)}
      className="text-white/80 hover:text-white underline text-sm block w-full">
      {t('auth.noAccount')}
    </button>
    <button className="text-white/60 hover:text-white/80 text-xs block w-full">
      Forgot password?
    </button>
  </div>
</div>
```

Remove the old error/success banner JSX that appeared before the `{!showRegister ? (` conditional (lines 153–169) — these are now handled by `loginForm.formState.errors.root` inline above and by `toast.success` / `toast.error` for the register form.

- [ ] **Step 6: Verify TypeScript compiles + visual test**

Run: `npx tsc --noEmit`

Manual test:
1. Navigate to `/`
2. Click Sign In with empty fields → should see field-level errors
3. Enter bad credentials → should see root error below the form
4. Enter correct credentials → should see "Welcome back!" toast, redirect to /friends

- [ ] **Step 7: Commit**

```bash
git add src/pages/Welcome.tsx
git commit -m "feat: migrate login form to react-hook-form with Zod validation"
```

---

### Task 5: Migrate register form to react-hook-form

**Files:**
- Modify: `src/pages/Welcome.tsx`

The register form uses `registerData` state. We replace it with `useForm<RegisterSchema>` with blur + submit validation. After this task, the old `error`/`success` state (lines 19–20), `registerData` state (lines 23–31), and `validatePassword` function (lines 33–41) can be removed.

- [ ] **Step 1: Add register schema import**

Add to the existing import from validators (already has loginSchema):
```tsx
import { loginSchema, registerSchema, type LoginSchema, type RegisterSchema } from '@/lib/validators';
```

- [ ] **Step 2: Add register form hook**

After `loginForm`:
```tsx
const registerForm = useForm<RegisterSchema>({
  resolver: zodResolver(registerSchema),
  mode: 'onBlur',
});
```

- [ ] **Step 3: Replace `handleRegister` (lines 69–106)**

Remove old `handleRegister` and replace with:
```tsx
const handleRegister = registerForm.handleSubmit(async (data) => {
  setIsLoading(true);
  try {
    const response = await authApi.register({
      email: data.email,
      password: data.password,
      name: data.name,
      age: data.age,
      location: data.location,
      gender: data.gender,
      bio: data.bio,
    });
    if (!response.success) {
      const apiErr = (response as any).error;
      if (apiErr?.code === 'EMAIL_TAKEN') {
        registerForm.setError('email', { message: apiErr.message || 'Email is already taken' });
        return;
      }
      showApiError(response, 'Registration failed');
      return;
    }
    toast.success('Account created! Check your email to verify.');
    setShowRegister(false);
  } catch (err) {
    showApiError(err, 'Registration failed');
  } finally {
    setIsLoading(false);
  }
});
```

- [ ] **Step 4: Remove old state and fix `handleOAuthLogin`**

Remove these lines (no longer needed):
- Line 19: `const [error, setError] = useState<string>('');`
- Line 20: `const [success, setSuccess] = useState<string>('');`
- Lines 23–31: `const [registerData, setRegisterData] = useState({...})`
- Lines 33–41: `const validatePassword = (password: string): string[] => {...}`

**Important:** `handleOAuthLogin` (lines 108–112) still calls `setError(...)`, which will no longer exist after removing the state. Replace it with `toast.error`:

Old:
```tsx
const handleOAuthLogin = (provider: 'google' | 'facebook' | 'vk') => {
  // TODO: Redirect to OAuth endpoint when integrated
  // window.location.href = `${API_CONFIG.baseURL}/api/v1/auth/oauth/${provider}/login`;
  setError(`${provider} login will be available soon`);
};
```

New:
```tsx
const handleOAuthLogin = (provider: 'google' | 'facebook' | 'vk') => {
  // TODO: Redirect to OAuth endpoint when integrated
  // window.location.href = `${API_CONFIG.baseURL}/api/v1/auth/oauth/${provider}/login`;
  toast.error(`${provider} login will be available soon`);
};
```

The old error/success banner JSX that appeared before the `{!showRegister ? (` conditional (lines 153–169) was already removed in Task 4 Step 5.

- [ ] **Step 5: Update register form JSX**

Wrap the register form content in `<form onSubmit={handleRegister}>`.

Replace each field's `value`/`onChange` with `register()`. The Controller pattern is needed for the Select components (gender). Add inline error messages after each field.

**Email field:**
```tsx
<div className="space-y-2">
  <Label htmlFor="reg-email" className="text-white font-medium">
    {t('auth.email')} *
  </Label>
  <Input
    id="reg-email"
    type="email"
    placeholder={t('auth.enterEmail')}
    {...registerForm.register('email')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  <p className="text-xs text-white/60">Your email will be used as your login</p>
  {registerForm.formState.errors.email && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.email.message}</p>
  )}
</div>
```

**Name field:**
```tsx
<div className="space-y-2">
  <Label htmlFor="reg-name" className="text-white font-medium">
    Display Name *
  </Label>
  <Input
    id="reg-name"
    type="text"
    placeholder="Your name"
    {...registerForm.register('name')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {registerForm.formState.errors.name && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.name.message}</p>
  )}
</div>
```

**Password field** — keep the existing requirement hints UI but drive it from react-hook-form watch:
```tsx
<div className="space-y-2">
  <Label htmlFor="reg-password" className="text-white font-medium">
    {t('auth.password')} *
  </Label>
  <Input
    id="reg-password"
    type="password"
    placeholder={t('auth.createPassword')}
    {...registerForm.register('password')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {(() => {
    const pw = registerForm.watch('password') || '';
    if (!pw) return null;
    const rules = [
      { test: pw.length >= 8, label: 'At least 8 characters' },
      { test: /[A-Z]/.test(pw), label: 'One uppercase letter' },
      { test: /[a-z]/.test(pw), label: 'One lowercase letter' },
      { test: /[0-9]/.test(pw), label: 'One number' },
      { test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw), label: 'One special character' },
    ];
    return (
      <div className="text-xs text-white/70 space-y-1 mt-2">
        {rules.map((r, i) =>
          r.test ? null : (
            <div key={i} className="flex items-center gap-1">
              <span className="text-red-300">✗</span> {r.label}
            </div>
          )
        )}
        {rules.every(r => r.test) && (
          <div className="flex items-center gap-1 text-green-300">
            <span>✓</span> Password meets requirements
          </div>
        )}
      </div>
    );
  })()}
  {registerForm.formState.errors.password && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.password.message}</p>
  )}
</div>
```

**Age field** — note: Zod expects `number` but HTML input gives `string`; use `valueAsNumber`:
```tsx
<div className="space-y-2">
  <Label htmlFor="age" className="text-white font-medium">
    {t('auth.age')}
  </Label>
  <Input
    id="age"
    type="number"
    placeholder={t('auth.age')}
    {...registerForm.register('age', { valueAsNumber: true })}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {registerForm.formState.errors.age && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.age.message}</p>
  )}
</div>
```

**Gender Select** — use `Controller` from react-hook-form (must add import):

Add `Controller` to the react-hook-form import:
```tsx
import { useForm, Controller } from 'react-hook-form';
```

Then:
```tsx
<div className="space-y-2">
  <Label htmlFor="gender" className="text-white font-medium">
    {t('auth.gender')}
  </Label>
  <Controller
    name="gender"
    control={registerForm.control}
    render={({ field }) => (
      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
        <SelectTrigger className="bg-white/20 border-white/30 text-white">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="male">{t('auth.male')}</SelectItem>
          <SelectItem value="female">{t('auth.female')}</SelectItem>
          <SelectItem value="other">{t('auth.other')}</SelectItem>
        </SelectContent>
      </Select>
    )}
  />
  {registerForm.formState.errors.gender && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.gender.message}</p>
  )}
</div>
```

**Location field:**
```tsx
<div className="space-y-2">
  <Label htmlFor="location" className="text-white font-medium">
    {t('auth.location')}
  </Label>
  <Input
    id="location"
    placeholder={t('auth.cityCountry')}
    {...registerForm.register('location')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
    disabled={isLoading}
  />
  {registerForm.formState.errors.location && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.location.message}</p>
  )}
</div>
```

**Bio field:**
```tsx
<div className="space-y-2">
  <Label htmlFor="bio" className="text-white font-medium">
    {t('auth.bio')}
  </Label>
  <Textarea
    id="bio"
    placeholder={t('auth.aboutYourself')}
    {...registerForm.register('bio')}
    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 min-h-[80px]"
    disabled={isLoading}
  />
  {registerForm.formState.errors.bio && (
    <p className="text-xs text-red-300">{registerForm.formState.errors.bio.message}</p>
  )}
</div>
```

Change register Button to `type="submit"`.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 7: Manual test**

1. Navigate to Create Account form
2. Click "Create Account" with empty fields → field errors appear
3. Type then blur each field → errors appear/clear on blur
4. Type weak password → requirement hints update live
5. Fill all fields correctly → submit → toast "Account created! Check your email to verify."

- [ ] **Step 8: Commit**

```bash
git add src/pages/Welcome.tsx
git commit -m "feat: migrate register form to react-hook-form with Zod validation"
```

---

## Chunk 3: Profile Edit — SettingsPage.tsx

### Task 6: Migrate profile edit to react-hook-form

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

Current state: `handleSave` (line 55) calls `usersApi.updateUser` with no feedback. `handleSignOut` (line 61) silently swallows logout errors.

- [ ] **Step 1: Add imports**

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { profileEditSchema, type ProfileEditSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
```

- [ ] **Step 2: Add `profileForm` hook**

Add after the existing state declarations (after line 27):
```tsx
const profileForm = useForm<ProfileEditSchema>({
  resolver: zodResolver(profileEditSchema),
});
```

- [ ] **Step 3: Reset form when user data loads**

In `SettingsPage.tsx`, the `useEffect` load function has this line (line 36):
```tsx
if (userRes.success && userRes.data) setUser(userRes.data);
```

Replace it with a block form that also resets the form:
```tsx
if (userRes.success && userRes.data) {
  setUser(userRes.data);
  profileForm.reset({
    name: userRes.data.name,
    age: userRes.data.age,
    location: userRes.data.location,
    bio: userRes.data.bio ?? '',
  });
}
```

- [ ] **Step 4: Replace `handleSave` (lines 55–59)**

```tsx
const handleSave = profileForm.handleSubmit(async (data) => {
  if (!user) return;
  try {
    const response = await usersApi.updateUser(user.id, { ...user, ...data });
    if (!response.success) {
      showApiError(response, 'Failed to update profile');
      return;
    }
    setUser({ ...user, ...data });
    setIsEditing(false);
    toast.success('Profile updated');
  } catch (err) {
    showApiError(err, 'Failed to update profile');
  }
});
```

- [ ] **Step 5: Update `handleSignOut` (lines 61–66)**

```tsx
const handleSignOut = async () => {
  try {
    await authApi.logout();
  } catch (err) {
    showApiError(err, 'Logout failed');
  }
  apiClient.clearTokens();
  navigate('/');
};
```

- [ ] **Step 6: Update Cancel button to call `profileForm.reset()`**

Old cancel (line 135):
```tsx
<Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">{t('common.cancel')}</Button>
```

New:
```tsx
<Button
  variant="outline"
  onClick={() => { profileForm.reset(); setIsEditing(false); }}
  className="flex-1"
>
  {t('common.cancel')}
</Button>
```

- [ ] **Step 7: Update profile form fields to use react-hook-form**

Wrap the editable section in `<form onSubmit={handleSave}>` and change Save Button to `type="submit"`.

Name Input (line 117):
```tsx
<div>
  <Label>{t('profile.name')}</Label>
  <Input
    {...(isEditing ? profileForm.register('name') : {})}
    value={isEditing ? undefined : user.name}
    disabled={!isEditing}
    className="mt-1"
  />
  {isEditing && profileForm.formState.errors.name && (
    <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.name.message}</p>
  )}
</div>
```

Age Input (line 118):
```tsx
<div>
  <Label>{t('profile.age')}</Label>
  <Input
    type="number"
    {...(isEditing ? profileForm.register('age', { valueAsNumber: true }) : {})}
    value={isEditing ? undefined : user.age}
    disabled={!isEditing}
    className="mt-1"
  />
  {isEditing && profileForm.formState.errors.age && (
    <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.age.message}</p>
  )}
</div>
```

Location Input (line 119):
```tsx
<div>
  <Label>{t('profile.location')}</Label>
  <Input
    {...(isEditing ? profileForm.register('location') : {})}
    value={isEditing ? undefined : user.location}
    disabled={!isEditing}
    className="mt-1"
  />
  {isEditing && profileForm.formState.errors.location && (
    <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.location.message}</p>
  )}
</div>
```

Bio Textarea (line 131):
```tsx
<div>
  <Label>{t('profile.bio')}</Label>
  <Textarea
    {...(isEditing ? profileForm.register('bio') : {})}
    value={isEditing ? undefined : (user.bio ?? '')}
    disabled={!isEditing}
    className="mt-1 min-h-[100px]"
  />
  {isEditing && profileForm.formState.errors.bio && (
    <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.bio.message}</p>
  )}
</div>
```

Change Save Button to `type="submit"`:
```tsx
<Button type="submit" className="flex-1">{t('common.save')}</Button>
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 9: Manual test**

1. Navigate to Settings → Profile tab
2. Click edit pencil
3. Clear the name field and click Save → error appears below field
4. Restore name, click Save → toast "Profile updated"
5. Click edit, change name, click Cancel → name reverts to original
6. Sign Out → if API fails, toast shows error; otherwise navigates to /

- [ ] **Step 10: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add profile edit validation and save/logout toasts"
```

---

## Chunk 4: Forum Reply — TopicDetail.tsx

### Task 7: Migrate forum reply to react-hook-form

**Files:**
- Modify: `src/components/forum/TopicDetail.tsx`

Current state: `replyText` state + bare `handleSendReply` with `if (!replyText.trim() || isSending) return` guard. Uses `Input` (single-line). No success/error feedback.

The spec says: use `useForm<ReplySchema>` with `zodResolver`, inline error below textarea, `toast.success("Reply posted")`, `showApiError` on failure.

Note: The current input is `<Input>` (single-line) — we switch to `<Textarea>` to match the spec's intent for a reply field.

- [ ] **Step 1: Add imports**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { replySchema, type ReplySchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import { Textarea } from '@/components/ui/textarea';
```

- [ ] **Step 2: Replace `replyText` state with `replyForm` hook**

Remove:
```tsx
const [replyText, setReplyText] = useState('');
```

Add:
```tsx
const replyForm = useForm<ReplySchema>({
  resolver: zodResolver(replySchema),
});
```

- [ ] **Step 3: Replace `handleSendReply` (lines 34–47)**

```tsx
const handleSendReply = replyForm.handleSubmit(async (data) => {
  if (isSending) return;
  setIsSending(true);
  try {
    const res = await forumsApi.createReply(topicId, data.content);
    if (!res.success) {
      showApiError(res, 'Failed to post reply');
      return;
    }
    if (res.data && topic) {
      setTopic({
        ...topic,
        replies: [...topic.replies, res.data],
        replyCount: topic.replyCount + 1,
      });
    }
    replyForm.reset();
    toast.success('Reply posted');
  } catch (err) {
    showApiError(err, 'Failed to post reply');
  } finally {
    setIsSending(false);
  }
});
```

- [ ] **Step 4: Update reply input JSX (lines 151–163)**

Replace the `<div className="flex gap-2 ...">` reply input section with:
```tsx
<form onSubmit={handleSendReply} className="pt-2 pb-4 space-y-1">
  <div className="flex gap-2">
    <Textarea
      {...replyForm.register('content')}
      placeholder="Написать ответ..."
      className="flex-1 min-h-[40px] max-h-[120px] resize-y"
    />
    <Button type="submit" disabled={isSending}>
      <Send className="w-4 h-4" />
    </Button>
  </div>
  {replyForm.formState.errors.content && (
    <p className="text-xs text-destructive">{replyForm.formState.errors.content.message}</p>
  )}
</form>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 6: Manual test**

1. Navigate to Talks → Forum → open a topic
2. Click Send with empty reply → error "Reply can't be empty" appears
3. Type reply, click Send → reply appears in list, toast "Reply posted"
4. Type 5001 characters → error "Reply is too long"

- [ ] **Step 7: Commit**

```bash
git add src/components/forum/TopicDetail.tsx
git commit -m "feat: add react-hook-form validation and toasts to forum reply"
```

---

## Chunk 5: Chat Inputs — Friends.tsx + Talks.tsx

### Task 8: Add lightweight validation to Friends.tsx message input

**Files:**
- Modify: `src/pages/Friends.tsx`

These are mock-only sends. No react-hook-form needed. Add `messageError` state; show inline error if empty; clear on keystroke.

- [ ] **Step 1: Add `messageError` state**

In `Friends.tsx`, find `const [messageText, setMessageText] = useState('');` (line 24).

Add below it:
```tsx
const [messageError, setMessageError] = useState('');
```

- [ ] **Step 2: Update `handleSendMessage` (lines 92–93)**

Current:
```tsx
const handleSendMessage = () => {
  if (!messageText.trim() || !selectedChat) return;
```

New:
```tsx
const handleSendMessage = () => {
  if (!messageText.trim()) {
    setMessageError("Message can't be empty");
    return;
  }
  if (!selectedChat) return;
  setMessageError('');
```

- [ ] **Step 3: Update message input onChange to clear error**

Find the Input's `onChange` (line 136):

Old:
```tsx
onChange={(e) => setMessageText(e.target.value)}
```

New:
```tsx
onChange={(e) => { setMessageText(e.target.value); if (messageError) setMessageError(''); }}
```

- [ ] **Step 4: Add inline error below the input**

Find the `<div>` that wraps the input + send button (around line 135). After the closing `</div>` of the message input row, add:
```tsx
{messageError && (
  <p className="text-xs text-destructive mt-1">{messageError}</p>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Manual test**

1. Navigate to Friends → open a chat
2. Click Send with empty input → error "Message can't be empty" below input
3. Type a character → error disappears
4. Send message → message appears normally

- [ ] **Step 7: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat: add inline empty validation to chat message input (Friends)"
```

---

### Task 9: Add lightweight validation to Talks.tsx message input

**Files:**
- Modify: `src/pages/Talks.tsx`

Same pattern as Friends.tsx.

- [ ] **Step 1: Add `messageError` state**

Find `const [messageText, setMessageText] = useState('');` (line 22).

Add below it:
```tsx
const [messageError, setMessageError] = useState('');
```

- [ ] **Step 2: Update `handleSendMessage` (lines 69–70)**

Current:
```tsx
const handleSendMessage = () => {
  if (!messageText.trim()) return;
```

New:
```tsx
const handleSendMessage = () => {
  if (!messageText.trim()) {
    setMessageError("Message can't be empty");
    return;
  }
  setMessageError('');
```

- [ ] **Step 3: Update message input onChange to clear error**

Find the Input's `onChange` (line 125):

Old:
```tsx
onChange={(e) => setMessageText(e.target.value)}
```

New:
```tsx
onChange={(e) => { setMessageText(e.target.value); if (messageError) setMessageError(''); }}
```

- [ ] **Step 4: Add inline error below the input**

After the closing `</div>` of the message input row (around line 127), add:
```tsx
{messageError && (
  <p className="text-xs text-destructive mt-1">{messageError}</p>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Manual test**

1. Navigate to Talks → open a group chat
2. Click Send with empty input → error appears
3. Type a character → error disappears

- [ ] **Step 7: Commit**

```bash
git add src/pages/Talks.tsx
git commit -m "feat: add inline empty validation to chat message input (Talks)"
```

---

## Final Verification

- [ ] **Full TypeScript check**

```bash
cd D:\src\aloevera-harmony-meet && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Build check**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **End-to-end smoke test**

1. Login with bad credentials → root error inline below login form
2. Login with good credentials → "Welcome back!" toast, redirect to /friends
3. Register with weak password → field errors on blur/submit
4. Register successfully → "Account created!" toast
5. Settings → edit profile → clear name → save → error inline
6. Settings → edit profile → save valid data → "Profile updated" toast
7. Settings → edit profile → make change → cancel → original values restored
8. Forum → post reply → "Reply posted" toast
9. Friends chat → send empty → inline error, clears on keystroke
10. Talks chat → send empty → inline error, clears on keystroke
