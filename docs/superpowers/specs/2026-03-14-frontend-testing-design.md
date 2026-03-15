# Frontend Testing Setup — Design Spec

**Date**: 2026-03-14
**Project**: AloeVera Harmony Meet (frontend)
**Scope**: Unit + component tests (Vitest + React Testing Library). No E2E (Playwright deferred).

---

## Goal

Add a testing foundation that covers the most critical paths: utility/validation logic and the auth forms. Establishes patterns the team can follow to expand coverage incrementally.

---

## Tech Stack

| Package | Purpose |
|---|---|
| `vitest` | Test runner (Vite-native) |
| `@vitest/coverage-v8` | Coverage reports |
| `@testing-library/react` | Component rendering |
| `@testing-library/user-event` | Realistic user interaction simulation |
| `@testing-library/jest-dom` | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| `jsdom` | DOM environment for Vitest |

No MSW. API services are mocked directly with `vi.mock()`, which fits the existing dual-mode (`mock`/`api`) architecture.

---

## Step 0: Install Dependencies

Before any configuration, install the test packages:

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

---

## Prerequisites: Source Code Changes

Two small changes to existing source files are required before writing tests:

**1. Export `LanguageContext` from `src/contexts/LanguageContext.tsx`**

The context object is currently not exported — only `useLanguage` and `LanguageProvider` are. Tests need to access `LanguageContext.Provider` directly to inject a mock value. Add `export` to the context declaration:

```ts
// change this:
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
// to:
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
```

Without this, `import { LanguageContext } from '@/contexts/LanguageContext'` returns `undefined` and every test that calls `renderWithProviders` throws at render time.

---

## Configuration

### `vite.config.ts` — add `test` block

The `test` block **must live inside the existing `vite.config.ts`**, not a separate `vitest.config.ts`. This ensures Vitest inherits the existing `resolve.alias` (`@` → `./src`) automatically. If placed in a separate config file, all `@/` imports will fail with module-not-found errors.

```ts
/// <reference types="vitest" />
// Add to existing defineConfig:
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  globals: true,
  env: {
    VITE_API_MODE: 'mock',
  },
  coverage: {
    provider: 'v8',
    include: ['src/lib/**', 'src/pages/Welcome.tsx'],
  },
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '/src/test/fileMock.ts',
  },
}
```

**`env: { VITE_API_MODE: 'mock' }`** is required. Without it, a CI environment with `VITE_API_MODE=api` set globally would cause tests to attempt real HTTP calls and fail. Pinning it explicitly makes the test environment deterministic regardless of the outer environment.

**`moduleNameMapper`** handles binary asset imports (`Welcome.tsx` imports `heroBg` and `appIcon` as `.jpg` files which jsdom cannot process). Uses absolute-style path relative to project root — not `<rootDir>` which is Jest syntax and not valid in Vitest.

**`coverage.include`** is required — without it, the coverage denominator includes all shadcn/ui and Radix re-exports, making numbers meaningless.

### `tsconfig.app.json` — add `vitest/globals` types

With `globals: true`, Vitest injects `describe`, `it`, `expect`, `vi`, etc. as globals. TypeScript must be told about them:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

Without this, TypeScript emits errors on every unimported `describe`/`expect` call.

### `src/test/setup.ts`

```ts
import '@testing-library/jest-dom';
```

Registers jest-dom matchers globally for all tests.

### `src/test/fileMock.ts`

```ts
export default 'test-file-stub';
```

### `package.json` scripts

```json
"test":          "vitest",
"test:run":      "vitest run",
"test:coverage": "vitest run --coverage"
```

---

## File Structure

```
src/
  test/
    setup.ts          # Global jest-dom import
    utils.tsx         # renderWithProviders() helper
    fileMock.ts       # Asset stub for jsdom
  lib/
    __tests__/
      validators.test.ts
      apiError.test.ts
      utils.test.ts
  pages/
    __tests__/
      Welcome.test.tsx
```

---

## Test Helper: `src/test/utils.tsx`

`renderWithProviders(ui)` wraps any component in:
- `MemoryRouter` (required by `useNavigate()`)
- `LanguageContext.Provider` with a mock value (bypasses `LanguageProvider` entirely)

**Why bypass `LanguageProvider`:** It hard-codes initial state to `'ru'` with no override prop. Rather than patching it, provide the context value directly.

**Query strategy:** The mock `t(key)` returns the raw translation key. Tests must **not** use `getByText` with translated strings — use role-based queries instead:
- `getByRole('button', { name: /submit/i })`
- `getByRole('textbox', { name: /email/i })`
- `getByRole('alert')` for error regions
- `getByTestId(...)` as last resort

This is language-agnostic and aligns with RTL best practices.

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageContext } from '@/contexts/LanguageContext';

const mockLanguageValue = {
  language: 'en' as const,
  setLanguage: vi.fn(),
  t: (key: string) => key,
};

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <LanguageContext.Provider value={mockLanguageValue}>
        {ui}
      </LanguageContext.Provider>
    </MemoryRouter>
  );
}
```

---

## Utility Tests

### `validators.test.ts`

Tests all 5 Zod schemas from `src/lib/validators.ts`. Pure function tests — no mocking needed.

**`loginSchema`**
- Valid email + non-empty password → passes
- Invalid email format → fails
- Empty password → fails

**`registerSchema`**
- Valid full input → passes
- Password < 8 chars → fails
- Password missing uppercase → fails
- Password missing special character → fails
- Age below 18 → fails; age above 99 → fails
- Invalid email format → fails
- Bio over 500 chars → fails

**`profileEditSchema`** — omits `email`, `password`, `gender`, `location` compared to `registerSchema`. Test only its own fields:
- Valid name/age/location → passes
- Age outside 18–99 → fails
- Bio over 500 chars → fails

**`messageSchema`**
- Non-empty content → passes
- Empty string → fails
- Whitespace-only (`"   "`) → fails — schema calls `.trim()` before `.min(1)`, so spaces-only strings pass the type check but fail after trimming
- Content over 2000 chars → fails

**`replySchema`**
- Non-empty content → passes
- Whitespace-only → fails (same `.trim()` behavior as `messageSchema`)
- Content over 5000 chars → fails

---

### `apiError.test.ts`

Tests `showApiError(err, fallback)` from `src/lib/apiError.ts`.

**Mock target:** `apiError.ts` imports `toast` from `@/components/ui/sonner` (the local re-export), **not** from `'sonner'` directly. Must mock the local path:

```ts
vi.mock('@/components/ui/sonner', () => ({ toast: { error: vi.fn() } }))
```

Mocking `'sonner'` instead will not intercept the call — assertions will silently pass even when `toast.error` was never called.

**Cases:**
- `ApiResponse`-shaped error (`{ error: { message: 'Server error' } }`) → calls `toast.error('Server error')`
- Plain `Error` (`new Error('Network failure')`) → calls `toast.error('Network failure')`
- Unknown object with no message → calls `toast.error(fallback)`
- `null` / `undefined` → calls `toast.error(fallback)`

---

### `utils.test.ts`

Tests `cn()` from `src/lib/utils.ts`.

**Cases:**
- Merges multiple class strings → `'foo bar'`
- Handles falsy conditionals → omits falsy class
- Resolves Tailwind conflicts → last conflicting utility wins (e.g. `p-2 p-4` → `p-4`)

---

## Component Tests

### `Welcome.test.tsx`

Tests the login and register forms in `src/pages/Welcome.tsx`.

**Module mocks** (hoisted automatically by Vitest):
```ts
vi.mock('@/services/api')         // must target the barrel index — Welcome.tsx imports from here
vi.mock('@/components/ui/sonner') // for asserting toast calls
```

**Instance method spying for `apiClient`:** `apiClient` is a singleton instance — its methods cannot be mocked with `vi.mock`. Use `vi.spyOn` before each test that asserts on token storage:

```ts
import { apiClient } from '@/services/api/apiClient';

beforeEach(() => {
  vi.spyOn(apiClient, 'setAccessToken');
  vi.spyOn(apiClient, 'setRefreshToken');
});
```

**Per-test API mock overrides:** Use `mockResolvedValueOnce` per test — not a shared `beforeEach` return value. Multiple tests need different return values from the same function; a shared mock bleeds between cases:

```ts
// ✅ correct
it('shows EMAIL_TAKEN error', async () => {
  vi.mocked(authApi.register).mockResolvedValueOnce({ success: false, error: { code: 'EMAIL_TAKEN' } });
});

// ❌ wrong — bleeds across tests
beforeEach(() => {
  vi.mocked(authApi.register).mockResolvedValue({ success: false, error: { code: 'EMAIL_TAKEN' } });
});
```

**`window.location` note:** `apiClient` calls `window.location.href = '/'` on session expiry. jsdom may log "Not implemented: navigation" warnings in test output. Tests covering this path should suppress the warning or mock `window.location`.

All tests use `renderWithProviders(<Welcome />)`.

#### Gender field (`Select`) — known limitation

The gender field uses Radix UI's `<Select>`, which uses a portal and pointer events that jsdom does not support. Tests requiring form submission with a valid gender must bypass the Select UI — set the value directly via the form instance or mock the field component. Tests that only verify non-gender validation errors (password strength, age, email format) do not need to interact with the Select.

#### Login form

| Test | Action | Expected |
|---|---|---|
| Renders | Mount | Email field, password field, sign-in button present |
| Email validation | Submit with invalid email | Inline validation error shown |
| Password validation | Submit with empty password | Inline validation error shown |
| API call args | Fill valid fields, submit | `authApi.login` called with `{ email, password }` |
| API failure (root error) | Mock returns `{ success: false, error: { code: 'INVALID_CREDENTIALS', message: '...' } }` | Inline root error shown (not a toast — mapped via `loginForm.setError('root', ...)`) |
| Network/unexpected failure | Mock `authApi.login` throws | `toast.error` called with fallback message |
| Token storage | Mock returns `{ success: true, data: { accessToken: 'at', refreshToken: 'rt', user: {...} } }` | Both `apiClient.setAccessToken('at')` **and** `apiClient.setRefreshToken('rt')` called. Mock must include `refreshToken` — `setRefreshToken` is only called when it is truthy |
| Success navigate | Mock returns success | navigate called (user redirected away from `/`) |

#### Register form

| Test | Action | Expected |
|---|---|---|
| Weak password — length | Submit password < 8 chars | Inline error shown |
| Weak password — uppercase | Submit password with no uppercase | Inline error shown |
| Weak password — special char | Submit password with no special char | Inline error shown |
| Age out of range | Submit age = 17 or 100 | Inline error shown |
| EMAIL_TAKEN | Mock returns `{ success: false, error: { code: 'EMAIL_TAKEN' } }` | Inline field error on email field (not a toast) |
| Generic server error | Mock returns `{ success: false, error: { code: 'SERVER_ERROR' } }` | `toast.error` called (via `showApiError`) |
| Valid submission args | Fill all valid fields (bypassing Select), submit | `authApi.register` called with correct payload |
| Post-success state | Mock returns `{ success: true }` | Register form no longer visible; login form shown |
| Success toast | Mock returns `{ success: true }` | Success toast shown |

---

## Out of Scope (This Session)

- Playwright / E2E tests
- API service tests (`src/services/api/`)
- Page component tests beyond `Welcome.tsx`
- `ProtectedRoute` component tests
- `TopicDetail` component tests
- Coverage thresholds / CI enforcement

---

## Success Criteria

- `npm run test:run` passes with no failures
- `npm run test:coverage` shows coverage for `src/lib/` and `src/pages/Welcome.tsx`
- Patterns (mocking, providers, asset stubs, `vi.spyOn` for instances) are clear enough that adding tests for other components follows the same structure
