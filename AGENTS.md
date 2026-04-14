# AI Agent Instructions

**AloeVera Harmony Meet** - Guidelines for AI Assistants

This document provides context and instructions for AI coding assistants (like Cursor, GitHub Copilot, etc.) working on this project.

---

## 🎯 Project Overview

**AloeVera Harmony Meet** is a fan community platform for AloeVera music band enthusiasts that combines dating features, social networking, event management, and e-commerce.

**Current State**: React application with full backend integration. The **LoveCraft** backend (`@lovecraft/`) is running with JWT auth and mock data. All pages are wired to `src/services/api/` service layer. Authentication is enforced — all content routes require a valid JWT stored in `localStorage`. The full stack runs end-to-end in Docker.

**Tech Stack**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router DOM, react-hook-form + Zod (forms), sonner (toasts)

---

## 📁 Project Structure

```
aloevera-harmony-meet/
├── src/
│   ├── pages/              # Page components (main routes)
│   ├── components/
│   │   ├── ui/             # Reusable UI components (shadcn/ui + custom)
│   │   ├── forum/
│   │   │   └── TopicDetail.tsx # Forum topic detail view (post + replies + reply input)
│   │   └── ProtectedRoute.tsx  # Auth guard — redirects unauthenticated users to /
│   ├── config/
│   │   └── api.config.ts   # API mode (mock/api) and base URL config
│   ├── services/
│   │   ├── api/            # API service layer
│   │   │   ├── apiClient.ts    # Base HTTP client (auth headers, 401 handling, localStorage token)
│   │   │   ├── authApi.ts      # Auth endpoints (login/register/logout/refresh)
│   │   │   ├── usersApi.ts     # User endpoints (getCurrentUser, getUsers, updateUser)
│   │   │   ├── eventsApi.ts    # Events (list, detail, register/unregister)
│   │   │   ├── storeApi.ts     # Store items (list, detail)
│   │   │   ├── blogApi.ts      # Blog posts (list, detail)
│   │   │   ├── forumsApi.ts    # Forum sections, topics, topic detail, and replies
│   │   │   ├── matchingApi.ts  # Search profiles, matches, likes
│   │   │   ├── chatsApi.ts     # Private chats — dual-mode (mock + real backend REST)
│   │   │   ├── songsApi.ts     # AloeVera songs (mock-only)
│   │   │   └── index.ts        # Central exports
│   │   └── signalr/        # SignalR layer
│   │       └── chatConnection.ts  # Module-level singleton; no-op in mock mode
│   ├── data/               # Centralized mock data (used by API services in mock mode)
│   │   ├── mockUsers.ts
│   │   ├── mockCurrentUser.ts
│   │   ├── mockEvents.ts
│   │   ├── mockStoreItems.ts
│   │   ├── mockBlogPosts.ts
│   │   ├── mockForumData.ts    # Sections, topics, mockTopicDetails (12 topics × replies)
│   │   ├── mockChats.ts
│   │   ├── mockProfiles.ts
│   │   └── mockSongs.ts
│   ├── contexts/           # React Context providers (LanguageContext)
│   ├── types/              # TypeScript type definitions
│   ├── hooks/              # Custom React hooks (useChatSignalR)
│   ├── lib/                # Utility functions
│   │   ├── validators.ts   # Zod schemas: loginSchema, registerSchema, profileEditSchema, messageSchema, replySchema
│   │   ├── apiError.ts     # showApiError(err, fallback) — extracts ApiResponse error message and calls toast.error()
│   │   └── utils.ts        # cn() and other utilities
│   ├── assets/             # Images and static assets
│   ├── App.tsx             # Main app with routing (all routes except / are ProtectedRoute)
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles + design system
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # Technical architecture
│   ├── API_INTEGRATION.md  # API service layer guide
│   ├── FRONTEND_AUTH_GUIDE.md # Auth integration guide
│   ├── ISSUES.md           # Active issues and technical debt
│   ├── RESOLVED_ISSUES.md  # Archive of resolved issues
│   ├── FEATURES.md         # Feature specifications
│   └── BACKEND_PLAN.md     # Backend implementation roadmap
├── .env.development        # VITE_API_MODE=mock (default)
├── .env.production         # VITE_API_MODE=api
├── public/                 # Static public assets
├── [config files]          # vite.config.ts, tsconfig.json, tailwind.config.ts, etc.
└── AGENTS.md              # This file
```

---

## 🎨 Design System & Styling

### Colors (HSL Format)

**AloeVera Brand Colors**:
```css
--aloe-gold: 45 96% 53%        /* Primary yellow-gold */
--aloe-flame: 14 91% 60%       /* Primary orange-red */
--aloe-ocean: 204 64% 44%      /* Blue accent */
--aloe-coral: 343 87% 70%      /* Pink accent */
--aloe-lavender: 259 34% 62%   /* Purple accent */
--aloe-sage: 159 25% 52%       /* Green accent */
```

**Semantic Colors**:
```css
--primary: var(--aloe-flame)       /* Use for primary actions */
--secondary: var(--aloe-gold)      /* Use for secondary actions */
--accent: var(--aloe-coral)        /* Use for highlights */
```

### Custom CSS Classes

**Use these instead of inline Tailwind when applicable**:
```css
.btn-like       /* Like button (coral → flame gradient) */
.btn-pass       /* Pass button (gray gradient) */
.btn-match      /* Match button (gold gradient) */
.profile-card   /* Card with gradient background + shadow */
.swipe-card     /* Touch-enabled swipeable card */
.nav-active     /* Active navigation state with glow */
```

### Styling Guidelines

1. **Use Tailwind utilities** for layout and basic styling
2. **Use semantic color variables** instead of hardcoded colors
3. **Use custom classes** for complex, reusable patterns
4. **Follow mobile-first** responsive design
5. **Maintain consistent spacing** (4px base unit: p-1, p-2, p-4, p-6, p-8, p-12)

---

## 🧩 Component Patterns

### Page Components

**Location**: `src/pages/`

**Structure**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { Type1, Type2 } from '@/types/user';

const PageName = () => {
  const [state, setState] = useState(initialValue);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Mock data (until backend implemented)
  const mockData = [...];

  // Event handlers
  const handleAction = () => { /* ... */ };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" 
           style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        {/* Header content */}
      </div>

      {/* Content */}
      <div className="p-4 relative z-10">
        {/* Page content */}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default PageName;
```

**Guidelines**:
- Always include `BottomNavigation` at the end
- Use `pb-20` on main container to account for bottom nav
- Use backdrop blur for headers (`backdrop-blur-md`)
- Use relative z-index for layering (background: 0, content: 10, header: 40, nav: 50)
- Import translation function: `const { t } = useLanguage()`
- Use mock data until backend is implemented

---

### UI Components

**Location**: `src/components/ui/`

**shadcn/ui Components**:
- Use existing shadcn/ui components when possible
- Import from `@/components/ui/[component-name]`
- Follow shadcn/ui patterns and API

**Custom Components**:
- `<BottomNavigation />` - Fixed bottom navigation (mobile only)
- `<SwipeCard />` - Swipeable card for Tinder-like UX
- `<EventPostmark />` - Artistic postage stamp badge for events

**Component Guidelines**:
- Functional components with TypeScript
- Use `React.FC` type if you prefer, but not required
- Props interface above component
- Use `cn()` utility for conditional classes: `cn('base-classes', condition && 'conditional-classes')`

---

## 🌐 Internationalization

**Context**: `src/contexts/LanguageContext.tsx`

**Supported Languages**: Russian (ru), English (en)

**Usage**:
```typescript
import { useLanguage } from '@/contexts/LanguageContext';

const Component = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <h1>{t('welcome.title')}</h1>
      <Button onClick={() => setLanguage('en')}>English</Button>
    </div>
  );
};
```

**Adding New Translations**:
1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Keep keys descriptive

**Translation Guidelines**:
- Always use `t()` for user-facing text
- Don't translate: technical terms, brand names, code
- Translate: UI labels, messages, descriptions, button text

---

## 🗂️ Type Definitions

**Location**: `src/types/`

**Files**:
- `user.ts` - User, Event, Match, Like, AloeVeraSong
- `chat.ts` - Chat, Message, GroupChat, PrivateChat

**Note**: `Message` interface was previously duplicated; now only in `chat.ts`. `user.ts` imports it from `chat.ts`. `chat.ts` also exports `ChatDto`, `MessageDto` (aliases), and `PrivateChatWithUser`.

**Type Guidelines**:
- Use interfaces for object shapes
- Use types for unions and complex types
- Export all types
- Add JSDoc comments for complex types
- Use strict types (avoid `any`)

---

## 🔄 State Management

**Current Approach**:
- **Global State**: React Context for language/i18n only
- **Local State**: `useState` in page components
- **No Global User State**: User is hardcoded as `'current-user'`

**React Query**: Configured but not used yet. Will be used when backend is implemented.

**State Guidelines**:
- Keep state close to where it's used
- Lift state only when needed by multiple components
- Use `useState` for simple state
- Prepare for React Query migration (don't over-complicate state logic)

---

## 🚦 Routing

**Router**: React Router DOM v6

**Routes**:
```
/                              → Welcome (landing/auth)
/friends                       → Friends (search, likes, chats)
/talks                         → Talks (forum, event chats)
/aloevera                      → AloeVera (events, store, blog)
/aloevera/events/:eventId      → Event details
/aloevera/blog/:postId         → Blog post details
/aloevera/store/:itemId        → Store item details
/settings                      → Settings
```

**Legacy Redirects** (don't add new ones):
```
/search  → /friends
/events  → /aloevera
/likes   → /friends
/chats   → /talks
/profile → /settings
```

**Routing Guidelines**:
- Use `useNavigate()` for programmatic navigation
- Use `<Link>` for declarative navigation
- Use `useParams()` for route parameters
- Use `useSearchParams()` for query parameters
- Always handle 404 with `NotFound` component

---

## 🎯 Mock Data Guidelines

**Current State**: All mock data is centralized in `src/data/`. Every domain has a corresponding `src/services/api/[domain]Api.ts` service that loads from `src/data/` in mock mode and calls the real backend in API mode. **Do not embed new mock data directly in page components.**

**API Service Pattern** (follow for any new domain):
- Create `src/services/api/[domain]Api.ts` following the pattern in `eventsApi.ts` / `forumsApi.ts`
- Each service has a mock branch (`if (!isApiMode()) { return mockData; }`) and a real API branch
- Add mock data to `src/data/mock[Domain].ts`
- Export from `src/services/api/index.ts`

**Page component pattern** — fetch data via API service in `useEffect`:
```typescript
const [data, setData] = useState<Thing[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const load = async () => {
    try {
      const result = await thingApi.getThings();
      if (result.success && result.data) setData(result.data);
    } catch (err) {
      console.error('Failed to load things:', err);
    } finally {
      setIsLoading(false);
    }
  };
  load();
}, []);
```

---

## 📋 Form Validation Pattern

All forms that call real APIs use **react-hook-form + Zod** via `src/lib/validators.ts` and `src/lib/apiError.ts`.

### Standard wired-form pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { mySchema, type MySchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';

const form = useForm<MySchema>({
  resolver: zodResolver(mySchema),
  // mode: 'onBlur' for multi-field forms; default 'onSubmit' for simple ones
});

const handleSubmit = form.handleSubmit(async (data) => {
  try {
    const result = await someApi.doThing(data);
    if (!result.success) throw result;
    toast.success('Done!');
  } catch (err) {
    showApiError(err, 'Fallback message');
  }
});
```

- Inline field errors: `{form.formState.errors.field && <p className="text-xs text-destructive mt-1">{form.formState.errors.field.message}</p>}`
- Root/API errors: `form.setError('root', { message: '...' })`
- Known field-level API errors (e.g. EMAIL_TAKEN): `form.setError('email', { message: '...' })` (not toast)
- Select fields (shadcn `<Select>`): use `<Controller>` — `<Select>` is not a native input and cannot use `register()`
- Age and other numeric fields: use `valueAsNumber: true` on `register()` or `Controller`
- Cancel button: call `form.reset(savedValues)` to restore original values

### Lightweight inline validation (mock-only sends)

For inputs that only send to mock state (no API call), skip react-hook-form:
```typescript
const [msgError, setMsgError] = useState('');
const handleSend = () => {
  if (!content.trim()) { setMsgError("Message can't be empty"); return; }
  // do the mock send
};
// In JSX: onChange={() => setMsgError('')} to clear on keystroke
```

---

## BB Code

BB code formatting is controlled per-tag via `src/config/bbcode.config.ts`. To enable or disable a tag, change the boolean value — no other code changes needed.

- **Renderer**: `src/components/ui/bbcode-renderer.tsx` — parses raw BB code strings into React elements. Disabled tags render as literal `[tag]...[/tag]` text. XSS-safe: uses React text nodes, no `dangerouslySetInnerHTML`.
- **Toolbar**: `src/components/ui/bbcode-toolbar.tsx` — floating popup on text selection. Requires a `ref` to the target `<textarea>`.
- **Image picker**: `src/components/ui/image-attachment-picker.tsx` — max 4 files, holds `File[]` in state; parent uploads at send time.
- **Image display**: `src/components/ui/image-attachment-display.tsx` — 1→full-width, 2+→2-col grid, click-to-lightbox.

---

## 🔌 SignalR Real-Time Pattern

The chat system uses a module-level singleton (`src/services/signalr/chatConnection.ts`) and a React hook (`src/hooks/useChatSignalR.ts`).

### `chatConnection` singleton

- Is a no-op in mock mode (`isApiMode()` guard on every method)
- Token read from `localStorage.getItem('access_token')` at connect time
- All methods are async and safe to call even before `connect()` is awaited

```typescript
import { chatConnection } from '@/services/signalr/chatConnection';

await chatConnection.connect();           // idempotent — safe to call multiple times
await chatConnection.joinChat(chatId);    // join a private chat group
await chatConnection.joinTopic(topicId); // join a forum topic group
await chatConnection.leaveGroup(groupId);
await chatConnection.sendMessage(chatId, content); // real-time send
chatConnection.on('MessageReceived', handler);
chatConnection.off('MessageReceived', handler);
chatConnection.isConnected; // boolean
```

### `useChatSignalR(type, id)` hook

Manages join/leave lifecycle. Use `onEvent` to subscribe to hub events — **it returns a cleanup function** that must be returned from `useEffect`:

```typescript
const { sendMessage, isConnected, onEvent } = useChatSignalR('chat', chatId);
// or: useChatSignalR('topic', topicId)

useEffect(() => {
  return onEvent('MessageReceived', (msg) => {
    const incoming = msg as MessageDto;
    // Deduplicate — the REST sender also receives the group broadcast
    setMessages(prev =>
      prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
    );
  });
}, [onEvent]);
```

The `useChatSignalR` hook's own `useEffect` handles `connect()` → `joinChat/joinTopic` on mount and `leaveGroup` on unmount. Do not call these manually in the consumer component.

> **Deduplication is required.** `ChatsController.SendMessage` broadcasts `MessageReceived` to the full chat group (including the sender) via `IHubContext`. Do not also add the message from the REST response — rely solely on the SignalR push so every member (sender and recipient) receives exactly one copy.

### `getCurrentUserIdFromToken()`

A lightweight helper exported from `src/services/api/matchingApi.ts` that decodes the stored JWT without an API call:

```typescript
import { getCurrentUserIdFromToken } from '@/services/api';

const myId = getCurrentUserIdFromToken(); // e.g. "test-user-001"
```

Use this anywhere you need the current user's ID (e.g. filtering match partners, aligning chat messages left/right) without fetching `/api/v1/auth/me`. The .NET backend stores the user ID as the `"nameid"` claim in the JWT payload.

---

## 🐛 Known Issues

**See [docs/ISSUES.md](./docs/ISSUES.md) for active issues. Resolved issues are archived in [docs/RESOLVED_ISSUES.md](./docs/RESOLVED_ISSUES.md).**

**Current State**:
1. ✅ Backend exists (`@lovecraft/`) with JWT auth and mock services
2. ✅ Auth endpoints (login/register) wired to backend
3. ✅ Access token stored in `localStorage` via `apiClient.setAccessToken()` on login
4. ✅ Refresh token stored in `localStorage` via `apiClient.setRefreshToken()` on login
5. ✅ All content routes protected by `<ProtectedRoute>` — unauthenticated users redirected to `/`
6. ✅ Silent token refresh: `apiClient` intercepts 401 responses, calls `POST /api/v1/auth/refresh` with the stored refresh token, retries the original request
7. ✅ Proactive refresh in `ProtectedRoute`: near-expiry tokens (<5 min) trigger a background refresh; expired tokens with a valid refresh token trigger a silent refresh with a loading spinner
8. ✅ All pages wired to API services (mock or real depending on `VITE_API_MODE`)
9. ✅ All mock data centralized in `src/data/`
10. ❌ **No data persistence in mock mode** — `MockAuthService` uses in-memory storage, data resets on restart (Azure Storage mode persists)
11. ⚠️ TypeScript is loosely configured (see tsconfig.json)
12. ✅ Frontend testing: Vitest + RTL, 50 tests (47 existing + 3 new chatsApi tests)
13. ✅ Duplicate `Message` interface — removed from `user.ts`; single source in `chat.ts`
14. ✅ User-visible error handling: `showApiError` in `src/lib/apiError.ts` + sonner `<Toaster />` in `App.tsx`
15. ✅ Form validation: react-hook-form + Zod on all auth, profile, and reply forms (see `src/lib/validators.ts`)
16. ✅ Real-time chat: `chatConnection.ts` singleton + `useChatSignalR` hook + backend SignalR hub at `/hubs/chat`
17. ✅ Matching fixed end-to-end: `MatchingController` reads real user ID from JWT; matches computed as like intersection (no dedicated table); mutual like auto-creates a 1-on-1 chat; `getCurrentUserIdFromToken()` decodes JWT client-side for match partner resolution and message alignment
18. ✅ Backend: 81 unit tests passing (added 13 `MatchingTests` covering mutual like, auto-chat, intersection logic, idempotency)

**Don't Try to Fix Without Context**:
- Type system strictness (requires codebase-wide changes)
- Test setup (requires project decision on framework)

---

## ✅ Code Quality Guidelines

### TypeScript

```typescript
// ✅ Good
interface UserCardProps {
  user: User;
  onLike: (userId: string) => void;
  onPass: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onLike, onPass }) => {
  // ...
};

// ❌ Avoid
const UserCard = (props: any) => {
  // ...
};
```

### Component Structure

```typescript
// ✅ Good: Clear separation of concerns
const Component = () => {
  // 1. Hooks
  const [state, setState] = useState();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // 2. Derived state / computations
  const filteredData = data.filter(...);

  // 3. Event handlers
  const handleClick = () => { /* ... */ };

  // 4. Effects (if any)
  useEffect(() => { /* ... */ }, []);

  // 5. Render
  return <div>...</div>;
};
```

### Conditional Rendering

```typescript
// ✅ Good
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataList data={data} />}

// ❌ Avoid ternaries for simple conditions
{isLoading ? <Spinner /> : null}
```

### Event Handlers

```typescript
// ✅ Good: Named handlers
const handleLike = () => {
  console.log('Liked:', user.name);
  onLike(user.id);
};

<Button onClick={handleLike}>Like</Button>

// ❌ Avoid inline arrow functions (re-renders)
<Button onClick={() => onLike(user.id)}>Like</Button>

// ℹ️ Inline is OK for simple toggles
<Button onClick={() => setOpen(!open)}>Toggle</Button>
```

---

## 🎨 UI/UX Guidelines

### Mobile-First Design

```typescript
// ✅ Good: Mobile-first, then desktop
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>

// ❌ Avoid desktop-first
<div className="p-8 md:p-4">
```

### Responsive Images

```typescript
// ✅ Good
<img
  src={user.profileImage}
  alt={user.name}
  className="w-full h-48 object-cover rounded-lg"
/>

// ❌ Avoid fixed dimensions without object-cover
<img src={user.profileImage} className="w-400 h-600" />
```

### Loading States

```typescript
// ✅ Good: Show loading state
if (isLoading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner />
    </div>
  );
}

// ❌ Avoid rendering nothing
if (isLoading) return null;
```

### Empty States

```typescript
// ✅ Good: Friendly empty state
{matches.length === 0 && (
  <div className="text-center p-8">
    <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
    <p className="text-lg font-semibold">{t('likes.noMatches')}</p>
    <p className="text-sm text-muted-foreground">
      Keep swiping to find your match!
    </p>
  </div>
)}

// ❌ Avoid bare text
{matches.length === 0 && <p>No matches</p>}
```

---

## 🔧 Development Workflow

### Adding a New Feature

1. **Understand the context**: Read relevant docs (FEATURES.md, ARCHITECTURE.md)
2. **Check for existing patterns**: Look at similar existing features
3. **Create types**: Define TypeScript interfaces in `src/types/`
4. **Create mock data**: Add realistic mock data
5. **Build UI**: Create/modify page component
6. **Add translations**: Add i18n keys to LanguageContext
7. **Test manually**: Test in browser (mobile and desktop views)
8. **Update docs**: Update FEATURES.md if significant

### Modifying Existing Code

1. **Read the file first**: Understand existing patterns
2. **Maintain consistency**: Follow existing code style
3. **Don't break**: Ensure existing functionality still works
4. **Test changes**: Manual testing in browser
5. **Update types**: Keep TypeScript types in sync

### Adding UI Components

1. **Check shadcn/ui first**: Use existing component if possible
2. **Location**: `src/components/ui/[component-name].tsx`
3. **Follow patterns**: Look at existing custom components
4. **TypeScript**: Define props interface
5. **Styling**: Use Tailwind + design system colors
6. **Documentation**: Add JSDoc comments if complex

---

## 📦 Dependencies

### Adding New Dependencies

**Before adding a dependency**:
1. Check if it's already in package.json
2. Consider if it's really needed
3. Check bundle size impact
4. Ensure it's actively maintained

**Preferred libraries** (already in project):
- UI: shadcn/ui components (Radix UI)
- Icons: lucide-react
- Dates: date-fns
- Forms: react-hook-form + zod (in use — see `src/lib/validators.ts`)
- Notifications: sonner (`toast.success()`, `toast.error()` via `showApiError` in `src/lib/apiError.ts`)
- Animations: tailwindcss-animate

**Don't add without discussion**:
- State management libraries (Redux, MobX, etc.)
- UI libraries (Material-UI, Ant Design, etc.) - we use shadcn/ui
- CSS frameworks (Bootstrap, etc.) - we use Tailwind

---

## 🚀 Backend Integration — Current State & Next Steps

**The API service layer is fully in place.** All pages are wired. Authentication is enforced end-to-end.

### What's Done

- All domain API services exist in `src/services/api/`
- All pages fetch data via `useEffect` + API service calls, with loading states
- Token stored in `localStorage`; `apiClient` reads it on every request
- All content routes guarded by `<ProtectedRoute>` — redirects to `/` if no valid token
- Backend returns camelCase enum strings matching frontend expectations
- Full-stack Docker Compose workflow tested and working

### What's Left / Next Steps

#### 1. Token refresh (Issue #2 follow-up)
Implement proper refresh token flow so users aren't logged out every hour:
```typescript
// src/contexts/AuthContext.tsx
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );
  // Set up refresh interval using authApi.refreshToken()
}
```

#### 2. Azure Storage (Issue #3)
Replace in-memory `Mock*Service` implementations in the backend with real Azure Table Storage / Blob Storage. See `@lovecraft/Lovecraft/docs/AZURE_STORAGE.md`.

#### 3. Backend endpoints for songs
`songsApi.ts` still returns mock data — the backend has no songs endpoint yet. `chatsApi.ts` is now dual-mode (REST + SignalR backend implemented as of March 15, 2026).

**See [docs/API_INTEGRATION.md](./docs/API_INTEGRATION.md) and [docs/FRONTEND_AUTH_GUIDE.md](./docs/FRONTEND_AUTH_GUIDE.md) for details.**

---

## 📚 Documentation

### When to Update Docs

**Update README.md** when:
- Adding major features
- Changing setup instructions
- Updating tech stack

**Update docs/FEATURES.md** when:
- Adding new features
- Changing feature behavior
- Adding new pages

**Update docs/ISSUES.md** when:
- Discovering new issues
- Fixing existing issues

**Update docs/ARCHITECTURE.md** when:
- Changing architecture patterns
- Adding new layers/systems
- Changing tech stack

**Update AGENTS.md (this file)** when:
- Adding new conventions
- Changing code patterns
- Adding new guidelines

---

## 🎯 Common Tasks

### Adding a New Page

1. Create `src/pages/PageName.tsx`
2. Follow page component structure (see above)
3. Add route to `src/App.tsx`
4. Add navigation link to `BottomNavigation` (if needed)
5. Add translations to `LanguageContext`
6. Update `docs/FEATURES.md`

### Adding a New UI Component

1. Create `src/components/ui/component-name.tsx`
2. Use TypeScript + props interface
3. Use Tailwind + design system
4. Export component
5. Import and use in pages

### Adding Mock Data

1. Define at top of page component
2. Use TypeScript types
3. Use realistic data
4. Keep IDs consistent
5. Add comments

### Fixing Styling Issues

1. Check if custom class exists (`.btn-like`, `.profile-card`, etc.)
2. Use Tailwind utilities for simple cases
3. Use CSS variables for colors (never hardcode hex colors)
4. Test on mobile and desktop
5. Check dark mode (if applicable)

### Adding Translations

1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Use in component: `{t('section.key')}`

---

## ❓ FAQ for AI Agents

**Q: Is there a backend?**  
A: Yes. The LoveCraft backend (`@lovecraft/`) is a .NET 10 API with JWT auth and mock services. It runs at `http://localhost:5000`. The frontend has an API service layer in `src/services/api/`.

**Q: Should I make API calls in page components?**  
A: All existing pages now use the API service pattern (`useEffect` + `[domain]Api.[method]()`). Follow the same pattern for any new pages. Never embed mock data directly in page components — add it to `src/data/` and consume it via the API service.

**Q: What mode is the app running in?**  
A: Controlled by `VITE_API_MODE` env var. `mock` (default) = uses local mock data. `api` = calls real backend. Set `.env.development` to `VITE_API_MODE=api` to use the real backend in dev.

**Q: How is the access token stored?**  
A: In `localStorage` under the key `access_token`. `apiClient.setAccessToken()` / `getAccessToken()` / `clearAccessToken()` manage it. `Welcome.tsx` stores it on login; `SettingsPage.tsx` clears it on logout. On a `401` response, `apiClient` clears the token and redirects to `/`.

**Q: Should I fix TypeScript strict mode issues?**  
A: No. This requires codebase-wide changes. It's in ISSUES.md as known technical debt.

**Q: How should I handle errors from API calls?**
A: Import `showApiError` from `src/lib/apiError.ts` and call it in the catch block: `showApiError(err, 'Fallback message')`. For known field-level errors (e.g. email already taken), call `form.setError('fieldName', { message: '...' })` instead so the error appears inline next to the field.

**Q: How do I add form validation to a new form?**
A: Add a Zod schema to `src/lib/validators.ts`, infer the TypeScript type, then use `useForm<YourSchema>({ resolver: zodResolver(yourSchema) })`. See the Form Validation Pattern section above.

**Q: Should I add tests?**
A: Yes — Vitest + RTL is configured. Run `npx vitest run`. Add test files as `*.test.ts(x)` alongside the source. Follow the pattern in `src/services/api/chatsApi.test.ts` for service tests.

**Q: Can I use a different UI library?**  
A: No. This project uses shadcn/ui exclusively. Use existing components or create custom ones.

**Q: Can I add dark mode?**  
A: The design system supports it (check index.css), but it's not implemented. Only add if specifically requested.

**Q: Should I centralize mock data?**  
A: Yes — always. All mock data lives in `src/data/`. Do not define new mock data in page components or service files. Add a new `src/data/mock[Domain].ts` file if needed.

**Q: Where do I put images?**  
A: Use Unsplash URLs for mock images. Real image upload will be a backend feature.

**Q: Should I optimize performance?**  
A: Only if there's a specific performance issue. Don't prematurely optimize.

**Q: Can I refactor large components?**  
A: Only if specifically requested or if making changes that naturally lead to refactoring. Maintain existing patterns.

---

## 🤝 Best Practices Summary

✅ **DO**:
- Follow existing patterns and conventions
- Use TypeScript properly (with types from `src/types/`)
- Use design system colors (CSS variables)
- Use i18n for all user-facing text
- Add mock data with realistic content
- Test manually in browser (mobile + desktop)
- Keep components focused and readable
- Add comments for complex logic
- Update documentation when adding features

❌ **DON'T**:
- Add backend functionality (it's a frontend-only app)
- Make breaking changes without understanding impact
- Add new dependencies without good reason
- Hardcode colors (use CSS variables)
- Skip translations (use `t()` function)
- Ignore TypeScript errors (even if config is loose)
- Over-engineer solutions (keep it simple)
- Remove existing functionality without confirmation

---

## 📞 Getting Help

**For questions about**:
- **Features**: See [docs/FEATURES.md](./docs/FEATURES.md)
- **Architecture**: See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Known issues**: See [docs/ISSUES.md](./docs/ISSUES.md)
- **API integration**: See [docs/API_INTEGRATION.md](./docs/API_INTEGRATION.md)
- **Auth integration**: See [docs/FRONTEND_AUTH_GUIDE.md](./docs/FRONTEND_AUTH_GUIDE.md)
- **Backend plans**: See [docs/BACKEND_PLAN.md](./docs/BACKEND_PLAN.md)
- **Setup/deployment**: See [README.md](./README.md)

**If you're unsure**:
1. Read the relevant documentation
2. Look at similar existing code
3. Ask the user/developer for clarification

---

**Remember**: This is a fully integrated full-stack application. All pages are wired to the LoveCraft backend. All content requires authentication. The API service layer (`src/services/api/`) is the bridge — use it for all data access, keep mock data in `src/data/`, and maintain the mock/API dual-mode pattern for any new features.

For real-time features, use `chatConnection.ts` + `useChatSignalR` hook. The hook is a no-op in mock mode — no special handling needed in mock-mode consumers. See the **SignalR Real-Time Pattern** section above and `@lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md` for the backend design.

Good luck! 🚀
