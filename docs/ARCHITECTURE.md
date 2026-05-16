# Architecture Documentation

**AloeVera Harmony Meet** - Technical Architecture Overview

**Last Updated**: 2026-05-15

---

## 📐 System Overview

AloeVera Harmony Meet is a **React-based single-page application (SPA)** designed as a fan community platform combining dating features, social networking, event management, and e-commerce for AloeVera music band enthusiasts.

### Current State
- **Full-stack deployed on Azure VM** at `https://aloeve.club` (HTTPS via Cloudflare + nginx TLS termination)
- **LoveCraft .NET 10 backend** running with JWT auth and Azure Table Storage
- **API service layer**: `src/services/api/` provides mock/real dual-mode HTTP client
- **All pages wired**: every page fetches data via `useEffect` + API service calls
- **Data persists**: Azure Table Storage, seeded via `Lovecraft.Tools.Seeder`
- **nginx proxy**: frontend container proxies `/api/` to backend — ports 80 (HTTP→HTTPS redirect) and 443 (HTTPS) exposed

### Technology Philosophy
- **Modern React**: Hooks, functional components, TypeScript
- **Component-Driven**: Modular UI with shadcn/ui primitives
- **Design System First**: Consistent theming via CSS variables and Tailwind
- **Mobile-First**: Responsive design with bottom navigation
- **Type-Safe**: TypeScript throughout (though loosely configured)

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│  (React Components, Pages, UI Components)           │
├─────────────────────────────────────────────────────┤
│              Application Logic Layer                 │
│  (Contexts, Hooks, State Management)                │
├─────────────────────────────────────────────────────┤
│                   Data Layer                         │
│  src/data/mock*.ts (mock mode) — centralized        │
├─────────────────────────────────────────────────────┤
│                  Services Layer                      │
│  src/services/api/ — dual-mode (mock / real API)    │
├─────────────────────────────────────────────────────┤
│                   Backend API                        │
│  .NET 10 ASP.NET Core — JWT auth + Azure Storage    │
│    ├─ Controllers                                    │
│    ├─ ACL Enforcement (PermissionGuard + filters)    │
│    └─ Services (IUserService, IForumService, …)      │
└─────────────────────────────────────────────────────┘
```

### ACL Enforcement (between Controllers and Services)

Cross-cutting authorisation layer introduced by the Roles & ACL spec. All forum/user/admin controller actions route through this layer before reaching service implementations.

- **`IAppConfigService`** (`Services/IAppConfigService.cs`) — singleton, backed by the Azure `appconfig` table with `IMemoryCache` (1-hour TTL). Surfaces `RankThresholds` and `PermissionConfig` with safe fallbacks to code-defined defaults on missing/invalid rows.
- **`RankCalculator`** (`Helpers/RankCalculator.cs`) — computes `UserRank` from `(ReplyCount, LikesReceived, EventsAttended, MatchCount)` against the configured thresholds. Honours `UserEntity.RankOverride` when set.
- **`EffectiveLevel`** (`Helpers/EffectiveLevel.cs`) — unified 0–5 level map that combines user rank (0–3) and staff role (0, 4, 5) via `Math.Max`. Used as the single comparison scale for all authorisation decisions.
- **`PermissionGuard.MeetsAsync`** — shared helper resolving a caller's effective level from the JWT `staffRole` claim + `IUserService.GetUserByIdAsync` (for computed rank) and comparing against a required level.
- **`[RequireStaffRoleAttribute]`** — synchronous action filter; reads the `staffRole` claim only (zero DB hits) and blocks with `MODERATOR_REQUIRED` / `ADMIN_REQUIRED`.
- **`[RequirePermissionAttribute]`** — async action filter (via `IFilterFactory`) that looks up the permission's required level from `AppConfig.Permissions` and delegates to `PermissionGuard`; blocks with `INSUFFICIENT_RANK`.

JWT access tokens carry `staffRole` as a custom claim so the synchronous filter never needs to hit storage for moderator/admin-gated endpoints.

---

## 📦 Frontend Architecture

### 1. Routing Architecture

**Library**: React Router DOM v6.30.1  
**Pattern**: Client-side routing with nested routes  
**File**: `src/App.tsx`

```typescript
<BrowserRouter>
  <Routes>
    {/* Public — authentication */}
    <Route path="/" element={<GuestRoute><Welcome /></GuestRoute>} />
    <Route path="/welcome/telegram" element={<WelcomeTelegram />} />
    <Route path="/welcome/google" element={<WelcomeGoogle />} />
    <Route path="/welcome/photo" element={<WelcomePhoto />} />
    <Route path="/tg" element={<MiniAppEntry />} />            {/* Telegram Mini App */}
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Protected — require a valid JWT */}
    <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
    <Route path="/talks" element={<ProtectedRoute><Talks /></ProtectedRoute>} />
    <Route path="/aloevera" element={<ProtectedRoute><AloeVera /></ProtectedRoute>} />
    <Route path="/aloevera/events/:eventId" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
    <Route path="/aloevera/blog/:postId"    element={<ProtectedRoute><BlogPost /></ProtectedRoute>} />
    <Route path="/aloevera/store/:itemId"   element={<ProtectedRoute><StoreItem /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

    {/* Legacy redirects */}
    <Route path="/search" element={<Navigate to="/friends" replace />} />
    <Route path="/events" element={<Navigate to="/aloevera" replace />} />
    <Route path="/likes"  element={<Navigate to="/friends"  replace />} />
    <Route path="/chats"  element={<Navigate to="/talks"    replace />} />
    <Route path="/profile" element={<Navigate to="/settings" replace />} />

    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

**Navigation strategy**:
- **Bottom Navigation**: mobile-first; 4 main tabs (Talks, Friends, AloeVera, Settings). Desktop nav is **not** implemented (MCF.1 in ISSUES.md).
- **Programmatic**: `useNavigate()` for cards/actions
- **URL params**: dynamic routes for details pages
- **Legacy redirects**: from old routes to current structure

**Route protection**:
- `<GuestRoute>` wraps `/` — redirects to `/friends` if already signed in
- `<ProtectedRoute>` wraps all content routes — validates JWT expiry from `localStorage`; silently refreshes near-expiry tokens; redirects to `/` if no valid session
- Welcome variants (`/welcome/telegram`, `/welcome/google`, `/welcome/photo`, `/tg`, `/verify-email`, `/reset-password`) are public — they all handle their own auth state transitions

**Second Vite entry**: `admin.html` → `src/admin/main.tsx` mounts an admin SPA at `/admin/*` with `BrowserRouter basename="/admin"`. Pages live under `src/admin/pages/` and gate UI by JWT `staffRole` claim via `src/lib/jwt.ts::getStaffRoleFromAccessToken`.

---

### 2. Component Architecture

**Pattern**: Atomic Design (loosely followed)  
**Style**: Functional components with hooks

```
src/
├── pages/                          # Page components
│   ├── Welcome.tsx                 # Landing + login/register + provider buttons
│   ├── WelcomeTelegram.tsx         # Pending-ticket redemption (Telegram Login Widget)
│   ├── WelcomeGoogle.tsx           # Pending-ticket redemption (Google)
│   ├── WelcomePhoto.tsx            # First-time profile photo step
│   ├── MiniAppEntry.tsx            # Telegram Mini App entry (/tg) — initData → sign-in or inline wizard
│   ├── VerifyEmail.tsx, ResetPassword.tsx   # Email-link landings
│   ├── Friends.tsx                 # Dating: search swipe deck, likes, chats
│   ├── Talks.tsx                   # Forum + event discussion threads
│   ├── AloeVera.tsx                # Band hub: events, store, blog tabs
│   ├── EventDetails.tsx, BlogPost.tsx, StoreItem.tsx
│   ├── SettingsPage.tsx            # Profile, preferences, linked methods, logout
│   └── NotFound.tsx                # 404
│
├── admin/                          # Second Vite entry (admin.html)
│   ├── main.tsx, AdminApp.tsx
│   ├── pages/                      # AdminLogin, AdminUsers, AdminConfig,
│   │                                 AdminEventEditorPage, AdminInvitesPage, etc.
│   └── components/
│
├── components/
│   ├── ProtectedRoute.tsx          # Auth guard
│   ├── GuestRoute.tsx              # Reverse guard for /
│   ├── GoogleSignInButton.tsx      # Wraps @react-oauth/google
│   ├── TelegramLoginWidget.tsx     # Injects telegram-widget.js
│   ├── ForgotPasswordModal.tsx     # Password-reset request dialog
│   ├── forum/                      # CreateTopicModal, TopicDetail
│   ├── profile/                    # Profile sub-components
│   ├── settings/                   # Settings sub-components
│   └── ui/                         # shadcn/ui (~60 files) + custom:
│                                     bottom-navigation, swipe-card, event-postmark,
│                                     user-badges, bbcode-renderer, bbcode-toolbar,
│                                     image-attachment-picker, image-attachment-display
│
├── contexts/LanguageContext.tsx    # i18n (ru/en)
│
├── hooks/
│   ├── useCurrentUser.tsx          # Loads logged-in user via usersApi.getCurrentUser
│   ├── useChatSignalR.ts           # SignalR group join/leave + event subscription
│   ├── use-mobile.tsx, use-toast.ts
│
├── services/
│   ├── api/                        # Dual-mode (mock/api) HTTP services:
│   │                                 apiClient, authApi, usersApi, eventsApi, storeApi,
│   │                                 blogApi, forumsApi, matchingApi, chatsApi (REST + SignalR),
│   │                                 songsApi (mock-only), imagesApi, adminApi
│   └── signalr/chatConnection.ts   # Module-level SignalR singleton (no-op in mock mode)
│
├── types/                          # User, Event, Match, Like, Chat, Message, Forum types
│
├── lib/
│   ├── utils.ts                    # cn()
│   ├── validators.ts               # Zod schemas
│   ├── apiError.ts                 # showApiError() toast helper
│   ├── acl.ts                      # Frontend rank/staff effective-level mirror
│   ├── jwt.ts                      # getStaffRoleFromAccessToken
│   ├── telegramWebApp.ts           # Telegram.WebApp helpers (isTelegramMiniApp, theme, etc.)
│   ├── inviteRedirect.ts           # Carry ?code= across auth bounces via sessionStorage
│   ├── authNavigation.ts           # Post-login destination resolver
│   └── commonGround.ts             # Profile match scoring
│
├── data/                           # All mock data (used by API services in mock mode)
│   ├── mockUsers, mockCurrentUser, mockProfiles
│   ├── mockEvents, mockStoreItems, mockBlogPosts, mockChats, mockForumData, mockSongs
│   └── prompts.ts                  # Profile prompt list
│
├── config/api.config.ts, bbcode.config.ts
└── App.tsx, main.tsx, index.css
```

**Two HTML entries**:
- `index.html` → `src/main.tsx` (main app)
- `admin.html` → `src/admin/main.tsx` (admin shell at `/admin/*`)
- `public/telegram/index.html` — stub for the Telegram Mini App embed

### Component Patterns

**Pages** (Container Components):
- Manage local state with `useState`
- Fetch data via `useEffect` + API service calls (with loading states)
- Handle business logic
- Compose UI components
- Use hooks for routing and context

**UI Components** (Presentational):
- Receive data via props
- Minimal or no state
- Reusable across pages
- Follow shadcn/ui patterns
- Composed with Radix UI primitives

**Custom Components**:
- `BottomNavigation`: Fixed bottom nav with active state detection
- `SwipeCard`: Swipeable card for Tinder-like UX
- `EventPostmark`: Artistic postage stamp-style event badges

---

### 3. State Management

**Current implementation**: minimal global state by design.

```
Global:
  LanguageContext       — ru/en translation; the only Context provider in the app

Imperative (singleton, not React state):
  apiClient (src/services/api/apiClient.ts)
    — JWT access + refresh token storage (localStorage); silent refresh on 401
  chatConnection (src/services/signalr/chatConnection.ts)
    — module-level SignalR singleton; no-op in mock mode

Hook (per-component fetch):
  useCurrentUser() — loads logged-in profile via usersApi.getCurrentUser; returns { user, loading }

Per-page useState:
  Friends.tsx, Talks.tsx, AloeVera.tsx, SettingsPage.tsx etc. own their own local state
  (activeTab, isLoading, selected*, etc.)
```

TanStack React Query is installed but currently unused — see ISSUES.md TD.3. Adopting it would replace many `useEffect` + `useState` fetch patterns; the pieces (token plumbing, request interceptors) are already in place to migrate page by page.

---

### 4. Data Layer

**Mock mode**: `src/data/mock*.ts` — centralized TypeScript arrays consumed by API services when `VITE_API_MODE=mock`

**API mode**: All data comes from the LoveCraft backend via `src/services/api/`. Each service has a mock branch and a real-API branch:

```typescript
// Pattern used by all services
export const eventsApi = {
  async getEvents() {
    if (!isApiMode()) return { success: true, data: mockEvents };
    return apiClient.get<EventDto[]>('/api/v1/events');
  }
};
```

**Services** (`src/services/api/`):
- `authApi.ts` — login, register, logout, refresh
- `usersApi.ts` — current user, user by ID, update profile
- `eventsApi.ts` — list, detail, register/unregister
- `storeApi.ts` — list, detail
- `blogApi.ts` — list, detail
- `forumsApi.ts` — sections, topics, topic detail, replies, create reply
- `matchingApi.ts` — search profiles, matches, send/get likes
- `chatsApi.ts` — mock-only (no backend endpoint yet)
- `songsApi.ts` — mock-only (no backend endpoint yet)

---

### 5. Type System

**Files**:
- `src/types/user.ts` - User, Event, Match, Like, AloeVeraSong
- `src/types/chat.ts` - Chat, Message, GroupChat, PrivateChat

**Type Definitions**:

```typescript
// Core Entities
User {
  id, name, age, bio, location, gender
  profileImage, images[]
  lastSeen, isOnline
  eventsAttended[], favoriteSong
  preferences {ageRange, maxDistance, showMe}
  settings {profileVisibility, anonymousLikes, language, notifications}
}

Event {
  id, title, description, imageUrl
  date, endDate, location
  capacity, attendees[]
  category: 'concert' | 'meetup' | 'party' | 'festival' | 'yachting'
  price, organizer, isSecret
}

Match {
  id, users: [string, string]
  createdAt, lastMessage
}

Like {
  id, fromUserId, toUserId
  createdAt, isMatch
}

Chat {
  id, type: 'private' | 'group'
  name, participants[]
  lastMessage, createdAt, updatedAt
  eventId // for group chats
}

Message {
  id, chatId, senderId, content
  timestamp, read
  type: 'text' | 'image' | 'system'
}
```

**Validation**: All wired forms use `react-hook-form` + Zod via `src/lib/validators.ts`. Schemas: `loginSchema`, `registerSchema` (+ `registerSchemaWithInvite`), `profileEditSchema`, `messageSchema`, `replySchema`, `createTopicSchema`.

**Note on enum aliases**: `UserRank` and `StaffRole` live in `src/types/user.ts` and `src/lib/acl.ts` mirrors the backend's 0–5 effective level map.

---

### 6. Styling Architecture

**Strategy**: Design System + Utility Classes

**Layers**:
1. **CSS Variables** (`src/index.css`) - Design tokens
2. **Tailwind Config** (`tailwind.config.ts`) - Theme extension
3. **Utility Classes** - Tailwind utilities in components
4. **Custom Classes** - Semantic classes for complex patterns

**Design System**:

```css
/* Brand Colors (HSL) */
--aloe-gold: 45 96% 53%
--aloe-flame: 14 91% 60%
--aloe-ocean: 204 64% 44%
--aloe-coral: 343 87% 70%
--aloe-lavender: 259 34% 62%
--aloe-sage: 159 25% 52%

/* Semantic Colors */
--primary: var(--aloe-flame)
--secondary: var(--aloe-gold)
--accent: var(--aloe-coral)

/* Custom Gradients */
--like-gradient: coral → flame
--pass-gradient: gray shades
--match-gradient: gold → light gold
--hero-gradient: gold → flame → ocean

/* Shadows */
--shadow-soft: subtle flame shadow
--shadow-glow: glowing gold effect
--shadow-card: elevated card shadow
```

**Custom Component Classes**:
```css
.btn-like       → Like button gradient
.btn-pass       → Pass button gradient
.btn-match      → Match button gradient
.profile-card   → Card with gradient background
.swipe-card     → Touch-enabled swipe card
.nav-active     → Active navigation state with glow
```

**Responsive Design**:
- Mobile-first approach
- Breakpoints via Tailwind: sm, md, lg, xl, 2xl
- Custom hook: `useMobile()` for conditional logic (768px threshold)
- Bottom navigation visible only on mobile

---

### 7. Internationalization (i18n)

**Implementation**: Custom Context API  
**File**: `src/contexts/LanguageContext.tsx`

**Supported Languages**: Russian (ru), English (en)  
**Default**: Russian

**Usage**:
```typescript
const { language, setLanguage, t } = useLanguage();

<h1>{t('welcome.title')}</h1>
<Button onClick={() => setLanguage('en')}>Switch to English</Button>
```

**Translation Structure**:
```typescript
const translations = {
  ru: {
    'nav.profile': 'Профиль',
    'common.like': 'Лайк',
    'search.title': 'Найди тех самых',
    // ... ~50 keys
  },
  en: {
    'nav.profile': 'Profile',
    'common.like': 'Like',
    'search.title': 'Find Love',
    // ... ~50 keys
  }
};
```

**Issues**:
- Many strings still hardcoded in Russian
- No pluralization support
- No date/number localization
- No dynamic content translation (blog, events)

**Recommended**: Consider migrating to `react-i18next` for:
- Pluralization
- Interpolation
- Lazy loading
- Better TypeScript support
- Translation management tools

---

### 8. Build & Development

**Build Tool**: Vite 5.4.19  
**Dev Server**: Vite dev server (port 8080)  
**Compiler**: SWC (via `@vitejs/plugin-react-swc`)

**Configuration** (`vite.config.ts`):
```typescript
{
  server: {
    host: "::",  // Listen on all interfaces
    port: 8080
  },
  plugins: [
    react(),  // SWC-based React plugin
    componentTagger()  // Lovable component tagging (dev only)
  ],
  resolve: {
    alias: {
      "@": "./src"  // Path alias
    }
  }
}
```

**Build Output**:
- `npm run build` → `dist/` directory
- Static assets with content hashing
- Code splitting by route
- Minified JS/CSS

**Deployment**:
- Can be deployed to any static hosting (Vercel, Netlify, Lovable, etc.)
- Docker support included (Nginx-based)

---

## 🔌 Integration Points

### Backend API (Live)

**Current Architecture**:

```
Browser
    ↓ HTTPS
Cloudflare (DNS proxy, DDoS protection, edge cache)
    ↓ HTTPS (Origin Certificate)
nginx (port 443 / 80→443 redirect)
    ├─ /           → React SPA static files
    ├─ /api/       → proxy_pass → backend:8080 (Docker internal)
    ├─ /swagger    → proxy_pass → backend:8080
    └─ /hubs/      → proxy_pass → backend:8080 (WebSocket/SignalR)
         ↓
.NET 10 ASP.NET Core (port 8080 internal)
    ├─ JWT authentication (JwtService, PBKDF2 password hashing)
    └─ Azure Table Storage (18 tables)
```

**Implemented API endpoints** (`/api/v1/`):

```
Auth (public unless noted; rate-limited at 20 req/min/IP):
  POST   /auth/register, /auth/login, /auth/logout, /auth/refresh
         /auth/verify-email, /auth/forgot-password, /auth/reset-password, /auth/change-password
  GET    /auth/me, /auth/methods                   (authorized)
  GET    /auth/registration-config                  → { requireEventInvite: bool }
  POST   /auth/resend-verification                  (authorized)

Google sign-in (public):
  GET    /auth/google-config                        → { clientId }
  POST   /auth/google-login                          → { status: 'signedIn'|'pending'|'emailConflict' }
  POST   /auth/google-register                       (redeems pending ticket)

Telegram Login Widget (public):
  GET    /auth/telegram-login-config                → { botUsername }
  POST   /auth/telegram-login                        → { status: 'signedIn'|'pending' }
  POST   /auth/telegram-register
  POST   /auth/telegram-link-login                  (link to existing email+password account in one call)
  POST   /auth/telegram-link                         (authorized — link to current account)

Telegram Mini App (public):
  POST   /auth/telegram-miniapp-login                → { status: 'signedIn'|'needsRegistration' }
  POST   /auth/telegram-miniapp-register
  POST   /auth/telegram-miniapp-link-login

Attach email (authorized):
  POST   /auth/attach-email                          (Telegram-only / Google-only → add local)

Users:
  GET    /users, /users/me, /users/{id}
  PUT    /users/{id}
  POST   /users/{id}/images                          (multipart — profile photo)
  PUT    /users/{id}/role                            (admin)
  PUT    /users/{id}/rank-override                   (admin)

Events:
  GET    /events, /events/{id}?code=<invite>
  POST   /events/{id}/register, DELETE /events/{id}/register
  POST   /events/{id}/interest,  DELETE /events/{id}/interest

Matching:
  POST   /matching/likes
  GET    /matching/likes/sent | /received | /matches

Store, Blog:
  GET    /store, /store/{id}
  GET    /blog,  /blog/{id}

Forum:
  GET    /forum/sections, /forum/sections/{id}/topics
  POST   /forum/sections/{sectionId}/topics
  GET    /forum/topics/{id}, /forum/topics/{id}/replies
  POST   /forum/topics/{id}/replies
  PUT    /forum/topics/{id}                          (author + moderator; pin/lock moderator+)
  GET    /forum/event-discussions/summary
  GET    /forum/event-discussions/{eventId}/topics   (server-filtered per-topic visibility)

Chats:
  GET    /chats
  POST   /chats                                       (get-or-create private chat)
  GET    /chats/{id}/messages?page=&pageSize=
  POST   /chats/{id}/messages

Images:
  POST   /images/upload                              (multipart, ≤10 MB, returns { Url })

Admin (admin-only):
  GET    /admin/config
  Event CRUD/archive/attendees/invites/forum-topics under /admin/events/{eventId}/...
  POST   /admin/invites/campaigns

SignalR:
  /hubs/chat        — JWT via ?access_token=; events MessageReceived, ReplyPosted
```

**Frontend gap**: `songsApi.ts` always returns mock — backend has no songs endpoint yet (MCF.5).

---

## 🔐 Security

**Shipped**:
- JWT-based auth on every content endpoint (`[Authorize]`); silent refresh on 401; proactive near-expiry refresh in `ProtectedRoute`
- PBKDF2 + random 16-byte salt + 100k iterations for passwords
- Token rotation on every refresh
- HTTPS-only in production via Cloudflare → Origin Cert on nginx
- CORS restricted to known origins (localhost dev + `aloeve.club`)
- Backend `HtmlGuard` rejects HTML tags on forum/chat/user-update inputs
- Rate limiting (sliding window 20 req/min/IP, shared bucket on all auth endpoints)
- Roles & ACL: `[RequireStaffRole]` (sync, JWT claim) + `[RequirePermission]` (async, `appconfig`-driven)
- React auto-escapes; BB code renderer is XSS-safe (no `dangerouslySetInnerHTML`)

**Open**:
- Token storage in `localStorage` rather than memory + HttpOnly cookie (TD.7)
- Account lockout after failed logins (PB.4)
- Azure Blob SAS tokens — containers currently public-read (TD.8)
- GDPR data export / deletion endpoints (not implemented)

---

## 📊 Performance Considerations

**Current Performance**: Good (static mock data)

**For Production**:

1. **Code Splitting**:
   - Lazy load routes
   - Lazy load heavy components (recharts, etc.)
   - Dynamic imports

2. **Image Optimization**:
   - Responsive images
   - Lazy loading
   - WebP format
   - CDN delivery
   - Placeholder/blur-up loading

3. **API Optimization**:
   - Pagination
   - Infinite scroll
   - Debouncing search
   - Caching with React Query
   - Optimistic updates

4. **Bundle Size**:
   - Remove unused dependencies
   - Tree shaking
   - Analyze bundle (vite-bundle-visualizer)
   - Split vendor chunks

5. **Runtime Performance**:
   - Memoization (useMemo, useCallback)
   - Virtual scrolling for long lists
   - Minimize re-renders

---

## 🧪 Testing

**Stack**: Vitest 4 + React Testing Library + jsdom. Config inside `vite.config.ts` (no separate `vitest.config.ts`) so the `@/` alias resolves automatically.

**Coverage** (run `npm run test:run`):

- `src/lib/__tests__/validators.test.ts` — Zod schemas (login, register, registerWithInvite, profileEdit, message, reply, createTopic)
- `src/lib/__tests__/apiError.test.ts` — `showApiError()` ApiResponse/Error/unknown/null cases
- `src/lib/__tests__/utils.test.ts` — `cn()` merging
- `src/lib/inviteRedirect.test.ts` — sessionStorage invite carry-over
- `src/pages/__tests__/Welcome.test.tsx` — login + register flows
- `src/data/__tests__/*` — mock-data shape checks
- `src/services/api/chatsApi.test.ts`, `matchingApi.test.ts` — service-layer tests

**Test helper**: `src/test/utils.tsx` exports `renderWithProviders(ui)` — wraps in `MemoryRouter` + `LanguageContext.Provider` with `t: key => key` (so queries stay language-agnostic).

**Key patterns**:
- Mock API surface via `vi.mock('@/services/api', ...)` (barrel index)
- Mock toast via `vi.mock('@/components/ui/sonner', ...)` (local re-export, not `'sonner'`)
- Spy on `apiClient` singleton methods via `vi.spyOn(apiClient, 'setAccessToken')`
- Radix `<Select>` mocked as native `<select>` due to jsdom incompatibility
- `fireEvent.submit(form)` to bypass jsdom HTML5 email constraint validation

**Scripts**:
```bash
npm run test:run        # CI single-run
npm run test            # Watch
npm run test:coverage   # Coverage (v8)
```

**Not yet covered**: page-level tests for Friends/Talks/AloeVera/SettingsPage, `ProtectedRoute`/`GuestRoute`, SignalR hook, admin shell, E2E (Playwright deferred).

---

## 🚀 Deployment

**Production** (live): Azure VM running Docker Compose with three services — `frontend` (nginx + SPA), `backend` (.NET 10 API), `telegram-bot` (Telegram long-poll worker). Cloudflare proxies DNS + edge cache, TLS handed off to nginx via Origin Certificate. See [HTTPS_SETUP.md](./HTTPS_SETUP.md).

```
Browser ─TLS─► Cloudflare ─TLS (Origin Cert)─► nginx:443 ─► {SPA static, /api → backend:8080, /hubs → backend:8080}
```

**Build**: `npm run build` → `dist/` (one bundle per HTML entry — `index.html`, `admin.html`).

**Environment variables**:
```
VITE_API_MODE=mock|api                # default mock in .env.development
VITE_API_BASE_URL=                    # empty in .env.production → relative URLs
VITE_GOOGLE_CLIENT_ID=...             # optional; falls back to /auth/google-config
VITE_TELEGRAM_BOT_USERNAME=...        # optional; falls back to /auth/telegram-login-config
```

---

## 📚 References

- React: https://react.dev/
- Vite: https://vitejs.dev/
- shadcn/ui: https://ui.shadcn.com/
- Tailwind CSS: https://tailwindcss.com/
- React Router: https://reactrouter.com/
- TanStack Query: https://tanstack.com/query/
- `@react-oauth/google`: https://github.com/MomenSherif/react-oauth
- Telegram Login Widget: https://core.telegram.org/widgets/login
- Telegram Mini Apps: https://core.telegram.org/bots/webapps

See also `../../lovecraft/Lovecraft/docs/` for backend documentation.
