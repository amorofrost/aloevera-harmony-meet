# Frontend Testing Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest + React Testing Library to the AloeVera Harmony Meet frontend, covering utility/validation logic and the Welcome page auth forms.

**Architecture:** Vitest runs inside `vite.config.ts` (inheriting the `@` alias), renders components via jsdom + React Testing Library, mocks API services with `vi.mock()` fitting the existing dual-mode pattern. No MSW, no Playwright.

**Tech Stack:** vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add devDeps + test scripts |
| `vite.config.ts` | Modify | Add `test` block with jsdom, setupFiles, globals, env, coverage, moduleNameMapper |
| `tsconfig.app.json` | Modify | Add `"types": ["vitest/globals"]` |
| `src/contexts/LanguageContext.tsx` | Modify | Add `export` to `LanguageContext` declaration (line 11) |
| `src/test/setup.ts` | Create | Import `@testing-library/jest-dom` |
| `src/test/fileMock.ts` | Create | Stub binary asset imports (jpg/png/svg) |
| `src/test/utils.tsx` | Create | `renderWithProviders()` helper |
| `src/lib/__tests__/validators.test.ts` | Create | Tests for all 5 Zod schemas |
| `src/lib/__tests__/apiError.test.ts` | Create | Tests for `showApiError()` |
| `src/lib/__tests__/utils.test.ts` | Create | Tests for `cn()` |
| `src/pages/Welcome.tsx` | Modify | Add `role="alert"` to error elements (accessibility + testability) |
| `src/pages/__tests__/Welcome.test.tsx` | Create | Login + register form component tests |

---

## Chunk 1: Infrastructure

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (devDependencies, scripts)

- [ ] **Step 1: Install test packages**

```bash
cd D:/src/aloevera-harmony-meet && npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Expected: packages added to `devDependencies` in `package.json`, `node_modules` updated.

- [ ] **Step 2: Add test scripts to `package.json`**

Open `package.json`, find the `"scripts"` block, and add after the existing `"lint"` entry:

```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Verify scripts present**

```bash
cd D:/src/aloevera-harmony-meet && node -e "const p = require('./package.json'); console.log(p.scripts.test, p.scripts['test:run'], p.scripts['test:coverage'])"
```

Expected: `vitest vitest run vitest run --coverage`

- [ ] **Step 4: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add package.json package-lock.json && git commit -m "chore: install vitest + RTL test dependencies"
```

---

### Task 2: Configure Vitest inside `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

The `test` block must live inside `vite.config.ts` (not a separate `vitest.config.ts`) so Vitest inherits the existing `resolve.alias` for `@/` imports automatically.

Current file structure:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [...],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));
```

- [ ] **Step 1: Add `/// <reference types="vitest" />` and `test` block**

Add the triple-slash reference as the first line of the file, then add the `test` property to the config object:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    env: {
      VITE_API_MODE: "mock",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/Welcome.tsx"],
    },
    moduleNameMapper: {
      "\\.(jpg|jpeg|png|gif|svg|webp)$": "/src/test/fileMock.ts",
    },
  },
}));
```

`env: { VITE_API_MODE: "mock" }` pins the API mode regardless of the host environment, preventing tests from making real HTTP calls.

`coverage.include` scopes coverage to what matters — without it, shadcn/ui re-exports inflate the denominator.

`moduleNameMapper` stubs `.jpg` asset imports that `Welcome.tsx` uses (`heroBg`, `appIcon`) which jsdom cannot process.

- [ ] **Step 2: Verify config parses**

```bash
cd D:/src/aloevera-harmony-meet && npx vitest --version
```

Expected: prints a version string (e.g. `3.x.x`) without errors.

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add vite.config.ts && git commit -m "chore: add vitest config to vite.config.ts"
```

---

### Task 3: Add `vitest/globals` to TypeScript config

**Files:**
- Modify: `tsconfig.app.json`

With `globals: true`, Vitest injects `describe`, `it`, `expect`, `vi`, etc. as globals. Without declaring their types, TypeScript errors on every unimported test global.

Current `tsconfig.app.json` has no `types` array in `compilerOptions`.

- [ ] **Step 1: Add `"types": ["vitest/globals"]` to `compilerOptions`**

Find the `"compilerOptions"` object in `tsconfig.app.json` and add the `types` key:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

(Merge with existing `compilerOptions` — do not remove other keys.)

- [ ] **Step 2: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add tsconfig.app.json && git commit -m "chore: add vitest/globals types to tsconfig"
```

---

### Task 4: Export `LanguageContext` from its module

**Files:**
- Modify: `src/contexts/LanguageContext.tsx` (line 11)

`renderWithProviders` needs `LanguageContext.Provider` directly. The context object is currently not exported — only `useLanguage` and `LanguageProvider` are. Without this export, `import { LanguageContext }` returns `undefined` and every test that calls `renderWithProviders` crashes at render time.

- [ ] **Step 1: Add `export` to the `LanguageContext` declaration**

In `src/contexts/LanguageContext.tsx`, find line 11:
```ts
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
```

Change to:
```ts
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
```

- [ ] **Step 2: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/contexts/LanguageContext.tsx && git commit -m "feat: export LanguageContext for test provider injection"
```

---

### Task 5: Create test infrastructure files

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/test/fileMock.ts`
- Create: `src/test/utils.tsx`

- [ ] **Step 1: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

This registers custom DOM matchers (`toBeInTheDocument`, `toHaveValue`, etc.) globally for all tests.

- [ ] **Step 2: Create `src/test/fileMock.ts`**

```ts
export default 'test-file-stub';
```

The `moduleNameMapper` in `vite.config.ts` redirects all `.jpg`/`.png`/`.svg` imports to this file, preventing jsdom from crashing on binary assets.

- [ ] **Step 3: Create `src/test/utils.tsx`**

```tsx
import React from 'react';
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

**Why `MemoryRouter`:** `Welcome.tsx` calls `useNavigate()`, which throws if rendered outside a router context.

**Why bypass `LanguageProvider`:** `LanguageProvider` hard-codes `language` to `'ru'` with no override prop. Injecting via `LanguageContext.Provider` gives tests full control over the context value.

**Why `t: key => key`:** Tests use role-based queries (`getByRole`), not translated text. The identity function makes the mock transparent — if a test accidentally queries by translated text it will fail on the raw key, making the mistake obvious.

- [ ] **Step 4: Run an empty smoke test to verify the setup wires up**

Create a temporary file `src/test/smoke.test.ts`:
```ts
it('setup works', () => {
  expect(true).toBe(true);
});
```

Run:
```bash
cd D:/src/aloevera-harmony-meet && npm run test:run
```

Expected: 1 test passes. Delete `src/test/smoke.test.ts` after confirming.

- [ ] **Step 5: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/test/ && git commit -m "chore: add test infrastructure (setup, fileMock, renderWithProviders)"
```

---

## Chunk 2: Utility Tests

### Task 6: Validator tests

**Files:**
- Create: `src/lib/__tests__/validators.test.ts`

Pure function tests — no mocking, no rendering. Tests parse results from Zod's `.safeParse()`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/validators.test.ts`:

```ts
import {
  loginSchema,
  registerSchema,
  profileEditSchema,
  messageSchema,
  replySchema,
} from '@/lib/validators';

describe('loginSchema', () => {
  it('passes with valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('fails with empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'Secure1!',
    age: 25,
    gender: 'female',
    location: 'Moscow',
    bio: 'Hello',
  };

  it('passes with valid full input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('fails when password is under 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'Ab1!' }).success).toBe(false);
  });

  it('fails when password has no uppercase letter', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'secure1!' }).success).toBe(false);
  });

  it('fails when password has no special character', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'Secure123' }).success).toBe(false);
  });

  it('fails when age is below 18', () => {
    expect(registerSchema.safeParse({ ...valid, age: 17 }).success).toBe(false);
  });

  it('fails when age is above 99', () => {
    expect(registerSchema.safeParse({ ...valid, age: 100 }).success).toBe(false);
  });

  it('fails with invalid email format', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'bad-email' }).success).toBe(false);
  });

  it('fails when bio exceeds 500 characters', () => {
    expect(registerSchema.safeParse({ ...valid, bio: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('profileEditSchema', () => {
  const valid = { name: 'Bob', age: 30, location: 'SPB', bio: 'Hi' };

  it('passes with valid name/age/location', () => {
    expect(profileEditSchema.safeParse(valid).success).toBe(true);
  });

  it('fails when age is below 18', () => {
    expect(profileEditSchema.safeParse({ ...valid, age: 17 }).success).toBe(false);
  });

  it('fails when age is above 99', () => {
    expect(profileEditSchema.safeParse({ ...valid, age: 100 }).success).toBe(false);
  });

  it('fails when bio exceeds 500 characters', () => {
    expect(profileEditSchema.safeParse({ ...valid, bio: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('messageSchema', () => {
  it('passes with non-empty content', () => {
    expect(messageSchema.safeParse({ content: 'Hello!' }).success).toBe(true);
  });

  it('fails with empty string', () => {
    expect(messageSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('fails with whitespace-only content', () => {
    // Schema calls .trim() before .min(1) — spaces collapse to empty
    expect(messageSchema.safeParse({ content: '   ' }).success).toBe(false);
  });

  it('fails when content exceeds 2000 characters', () => {
    expect(messageSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('replySchema', () => {
  it('passes with non-empty content', () => {
    expect(replySchema.safeParse({ content: 'A reply.' }).success).toBe(true);
  });

  it('fails with whitespace-only content', () => {
    expect(replySchema.safeParse({ content: '   ' }).success).toBe(false);
  });

  it('fails when content exceeds 5000 characters', () => {
    expect(replySchema.safeParse({ content: 'x'.repeat(5001) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run -- src/lib/__tests__/validators.test.ts
```

Expected: all tests pass. If any fail, check the actual schema constraints in `src/lib/validators.ts` and adjust the boundary values.

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/lib/__tests__/validators.test.ts && git commit -m "test: add validator schema tests"
```

---

### Task 7: `showApiError` tests

**Files:**
- Create: `src/lib/__tests__/apiError.test.ts`

`showApiError` calls `toast.error()` from `@/components/ui/sonner` — mock that local re-export path, not `'sonner'` directly.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/apiError.test.ts`:

```ts
import { showApiError } from '@/lib/apiError';
import { toast } from '@/components/ui/sonner';

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('showApiError', () => {
  it('uses ApiResponse error message when present', () => {
    const err = { error: { message: 'Server error' } };
    showApiError(err, 'fallback');
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('uses plain Error message', () => {
    showApiError(new Error('Network failure'), 'fallback');
    expect(toast.error).toHaveBeenCalledWith('Network failure');
  });

  it('uses fallback when error has no recognizable message', () => {
    showApiError({ code: 42 }, 'fallback');
    expect(toast.error).toHaveBeenCalledWith('fallback');
  });

  it('uses fallback for null', () => {
    showApiError(null, 'fallback');
    expect(toast.error).toHaveBeenCalledWith('fallback');
  });

  it('uses fallback for undefined', () => {
    showApiError(undefined, 'fallback');
    expect(toast.error).toHaveBeenCalledWith('fallback');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run -- src/lib/__tests__/apiError.test.ts
```

Expected: all 5 pass.

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/lib/__tests__/apiError.test.ts && git commit -m "test: add showApiError tests"
```

---

### Task 8: `cn()` utility tests

**Files:**
- Create: `src/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/utils.test.ts`:

```ts
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('omits falsy conditionals', () => {
    expect(cn('foo', false && 'bar', undefined, 'baz')).toBe('foo baz');
  });

  it('resolves Tailwind conflicts — last utility wins', () => {
    // twMerge keeps the last conflicting utility
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run -- src/lib/__tests__/utils.test.ts
```

Expected: all 3 pass.

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/lib/__tests__/utils.test.ts && git commit -m "test: add cn() utility tests"
```

---

## Chunk 3: Component Tests

### Task 9: Add `role="alert"` to Welcome.tsx error elements

**Files:**
- Modify: `src/pages/Welcome.tsx`

The test helpers `getByRole('alert')` and `getAllByRole('alert')` find elements by ARIA role. The error containers in `Welcome.tsx` are plain `<div>` and `<p>` elements with no ARIA role — RTL cannot find them. This task adds `role="alert"` so the tests can query them.

**Why this is the right fix:** It also improves the component's accessibility — screen readers announce `role="alert"` elements to users immediately when they appear.

- [ ] **Step 1: Add `role="alert"` to the login root error `<div>`**

In `src/pages/Welcome.tsx`, find line 135:
```tsx
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
```
Change to:
```tsx
                <div role="alert" className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
```

- [ ] **Step 2: Add `role="alert"` to all field error `<p>` elements**

There are 9 field error paragraphs in the file. All follow the pattern `<p className="text-xs text-red-300">`. Change each to `<p role="alert" className="text-xs text-red-300">`.

Affected locations (by the condition they render under):
- `loginForm.formState.errors.email` (line ~151)
- `loginForm.formState.errors.password` (line ~161)
- `registerForm.formState.errors.email` (line ~218)
- `registerForm.formState.errors.name` (line ~234)
- `registerForm.formState.errors.password` (line ~279)
- `registerForm.formState.errors.age` (line ~297)
- `registerForm.formState.errors.gender` (line ~322)
- `registerForm.formState.errors.location` (line ~339)
- `registerForm.formState.errors.bio` (line ~355)

Use find-and-replace-all: change `<p className="text-xs text-red-300">` → `<p role="alert" className="text-xs text-red-300">` throughout the file.

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/pages/Welcome.tsx && git commit -m "a11y: add role=alert to form error elements in Welcome"
```

---

### Task 10: Welcome page — login form tests

**Files:**
- Create: `src/pages/__tests__/Welcome.test.tsx`

**Setup context:**

`Welcome.tsx` imports from `'@/services/api'` (barrel index) and `'@/components/ui/sonner'`. Both need to be mocked. `apiClient` is a class instance — its methods need `vi.spyOn` rather than `vi.mock`. `react-router-dom` needs a partial mock to capture `navigate` calls.

The Radix UI `<Select>` (gender field) uses pointer events that jsdom does not support — it must be mocked with a native `<select>` wrapper for any test that submits a complete register form. Login form tests do not need the Select mock.

**Button name queries:** The mock `t(key) => key` returns raw translation keys. The login submit button renders `t('auth.signIn')` = `auth.signIn`. Queries must match these raw key strings, not English text.

- [ ] **Step 1: Write the login form tests (first half of the file)**

Create `src/pages/__tests__/Welcome.test.tsx`:

```tsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Welcome from '@/pages/Welcome';
import { authApi, apiClient } from '@/services/api';
import { toast } from '@/components/ui/sonner';

// --- Module mocks ---

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    authApi: { login: vi.fn(), register: vi.fn() },
  };
});

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

// Mock Radix Select — jsdom does not support pointer events required by Radix portal
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, children }: any) => (
    <div>
      <select
        data-testid="gender-select"
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
}));

// --- Shared setup ---

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(apiClient, 'setAccessToken');
  vi.spyOn(apiClient, 'setRefreshToken');
});

// ============================================================
// LOGIN FORM
// ============================================================

describe('Welcome — login form', () => {
  it('renders email field, password field, and sign-in button', () => {
    renderWithProviders(<Welcome />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    // Button text = t('auth.signIn') = 'auth.signIn' (mock returns key as-is)
    expect(screen.getByRole('button', { name: /auth\.signIn/i })).toBeInTheDocument();
  });

  it('shows inline error when email is invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'bad-email');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      // Both email and password errors fire — use getAllByRole
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error when password is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      // Only password error fires (email is valid)
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls authApi.login with correct email and password', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' });
    });
  });

  it('shows inline root error on API failure (INVALID_CREDENTIALS)', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      // loginForm.setError('root', ...) renders an inline error, not a toast
      // Valid email + password means no field errors — only root error fires
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('calls toast.error with fallback message on network/unexpected failure', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Network failure'));
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('calls setAccessToken and setRefreshToken on success', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('at');
      expect(apiClient.setRefreshToken).toHaveBeenCalledWith('rt');
    });
  });

  it('navigates away from / on successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run login tests to check they pass**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run -- src/pages/__tests__/Welcome.test.tsx --reporter=verbose 2>&1 | head -60
```

Expected: login form `describe` block all green. If a test fails, check the exact element text by running `screen.debug()` in a failing test.

---

### Task 11: Welcome page — register form tests

**Files:**
- Modify: `src/pages/__tests__/Welcome.test.tsx` (append register suite)

**Note:** Register submit button renders `t('auth.createAccount')` = `auth.createAccount`. The switch-to-register button renders `t('auth.noAccount')` = `auth.noAccount`.

When submitting an incomplete register form (e.g. only a password typed), multiple field errors fire simultaneously. Use `getAllByRole('alert')` and check `length > 0` in these tests — the individual validation rules are already covered by `validators.test.ts`.

- [ ] **Step 1: Append register form tests to the file**

Add the following `describe` block at the end of `src/pages/__tests__/Welcome.test.tsx`:

```tsx
// ============================================================
// REGISTER FORM
// ============================================================

describe('Welcome — register form', () => {
  // Helper: switch to register tab
  async function openRegisterForm(user: ReturnType<typeof userEvent.setup>) {
    // Button text = t('auth.noAccount') = 'auth.noAccount' (mock returns key as-is)
    const switchBtn = screen.getByRole('button', { name: /auth\.noAccount/i });
    await user.click(switchBtn);
  }

  // Helper: fill all valid fields (bio is optional and omitted)
  async function fillValidRegisterForm(user: ReturnType<typeof userEvent.setup>) {
    // Labels use t() — mock returns key. Queries match substrings case-insensitively.
    // 'Display Name *' label → matches /name/i
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
    // 'auth.email *' label → matches /email/i
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
    // 'auth.password *' label → matches /password/i
    await user.type(screen.getByLabelText(/password/i), 'Secure1!');
    // 'auth.age' label → matches /age/i; number input has role 'spinbutton'
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
    // Gender uses native <select> mock with data-testid
    await user.selectOptions(screen.getByTestId('gender-select'), 'female');
    // 'auth.location' label → matches /location/i
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
  }

  it('shows inline error for password under 8 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'Ab1!');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // Multiple fields are empty → multiple errors fire; check at least one
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for password missing uppercase', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'secure1!');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for password missing special character', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'Secure123');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for age out of range (17)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '17');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline field error on email field for EMAIL_TAKEN', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      success: false,
      error: { code: 'EMAIL_TAKEN', message: 'Email already in use' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // registerForm.setError('email', ...) — inline field error, not toast
      // All fields are valid so only the email error fires
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('calls toast.error for generic server error', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('calls authApi.register with correct payload', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'Secure1!',
          age: 25,
          gender: 'female',
          location: 'Moscow',
        })
      );
    });
  });

  it('shows login form after successful registration', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // setShowRegister(false) — register form gone, login visible
      // Login submit button text = t('auth.signIn') = 'auth.signIn'
      expect(screen.getByRole('button', { name: /auth\.signIn/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /auth\.createAccount/i })).not.toBeInTheDocument();
    });
  });

  it('shows success toast after successful registration', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the full Welcome test suite**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run -- src/pages/__tests__/Welcome.test.tsx --reporter=verbose
```

Expected: all tests pass (login suite + register suite).

If tests fail:
- `getByRole('button', { name: /auth\.signIn/i })` failing → the button text is the raw `t()` key; check Welcome.tsx line 171 for the exact key used
- `getByRole('button', { name: /auth\.createAccount/i })` failing → check Welcome.tsx line 371 for the exact key
- `getAllByRole('alert')` returns empty → confirm Task 9's `role="alert"` changes are in place
- `getByRole('spinbutton', { name: /age/i })` failing → number inputs use `spinbutton` role; check if the `<Label htmlFor="age">` is correctly linked

- [ ] **Step 3: Commit**

```bash
cd D:/src/aloevera-harmony-meet && git add src/pages/__tests__/Welcome.test.tsx && git commit -m "test: add Welcome page login and register form tests"
```

---

### Task 12: Run full suite and coverage

- [ ] **Step 1: Run all tests**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:run
```

Expected: all tests pass with no failures.

- [ ] **Step 2: Run coverage**

```bash
cd D:/src/aloevera-harmony-meet && npm run test:coverage
```

Expected: coverage report printed for `src/lib/` and `src/pages/Welcome.tsx`. Numbers should be meaningful (not diluted by shadcn re-exports) because `coverage.include` is scoped.

- [ ] **Step 3: Final commit**

```bash
cd D:/src/aloevera-harmony-meet && git add -A && git commit -m "test: frontend testing foundation complete (Vitest + RTL)"
```

---

## Troubleshooting Reference

| Symptom | Cause | Fix |
|---|---|---|
| `@/` imports fail with module-not-found | `test` block in separate `vitest.config.ts` instead of `vite.config.ts` | Move config to `vite.config.ts` |
| `describe is not defined` / `expect is not defined` | Missing `"types": ["vitest/globals"]` in `tsconfig.app.json` | Add the types entry |
| `LanguageContext is undefined` | `LanguageContext` not exported from `LanguageContext.tsx` | Add `export` to line 11 |
| `Cannot process .jpg` crash | `moduleNameMapper` missing or path wrong | Verify regex and fileMock path in `vite.config.ts` |
| `toast.error` not called (assertion fails silently) | Mocking `'sonner'` instead of `'@/components/ui/sonner'` | Change mock target to `@/components/ui/sonner` |
| Radix Select doesn't respond to `userEvent.click` | Radix uses portals + pointer events jsdom can't handle | Confirm `vi.mock('@/components/ui/select', ...)` is in place |
| `apiClient.setAccessToken` assertion fails | Method mocked via `vi.mock` instead of `vi.spyOn` | Use `vi.spyOn(apiClient, 'setAccessToken')` in `beforeEach` |
| Mock bleeds between tests | Using `mockResolvedValue` in `beforeEach` | Use `mockResolvedValueOnce` per test |
| navigate never called | `useNavigate` not mocked | Verify partial react-router-dom mock with `mockNavigate` |
| VITE_API_MODE=api makes tests call real API | `env` block missing from `vite.config.ts` | Add `env: { VITE_API_MODE: 'mock' }` to test config |
| `getByRole('button', { name: /sign.?in/i })` fails | `t()` mock returns raw key `auth.signIn`; regex `/sign.?in/i` doesn't match | Use `/auth\.signIn/i` |
| `getByRole('button', { name: /create.?account/i })` fails | `t()` mock returns raw key `auth.createAccount`; regex doesn't match | Use `/auth\.createAccount/i` |
| `getByRole('alert')` fails (not found) | Error `<div>`/`<p>` has no ARIA role | Confirm Task 9's `role="alert"` changes to Welcome.tsx are applied |
| `getByRole('alert')` fails (multiple elements) | Multiple field errors fire simultaneously (e.g. invalid email + empty password) | Use `getAllByRole('alert')` and check `length > 0` |
