# Architecture Documentation

**AloeVera Harmony Meet** - Technical Architecture Overview

**Version**: 1.2 (Full-stack deployed)
**Last Updated**: February 23, 2026

---

## 📐 System Overview

AloeVera Harmony Meet is a **React-based single-page application (SPA)** designed as a fan community platform combining dating features, social networking, event management, and e-commerce for AloeVera music band enthusiasts.

### Current State
- **Full-stack deployed on Azure VM** at `http://20.153.164.3:8080`
- **LoveCraft .NET 10 backend** running with JWT auth and Azure Table Storage
- **API service layer**: `src/services/api/` provides mock/real dual-mode HTTP client
- **All pages wired**: every page fetches data via `useEffect` + API service calls
- **Data persists**: Azure Table Storage, seeded via `Lovecraft.Tools.Seeder`
- **nginx proxy**: frontend container proxies `/api/` to backend — only port 8080 exposed

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
└─────────────────────────────────────────────────────┘
```

---

## 📦 Frontend Architecture

### 1. Routing Architecture

**Library**: React Router DOM v6.30.1  
**Pattern**: Client-side routing with nested routes  
**File**: `src/App.tsx`

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Welcome />} />
    <Route path="/friends" element={<Friends />} />
    <Route path="/talks" element={<Talks />} />
    <Route path="/aloevera" element={<AloeVera />}>
      <Route path="events/:eventId" element={<EventDetails />} />
      <Route path="blog/:postId" element={<BlogPost />} />
      <Route path="store/:itemId" element={<StoreItem />} />
    </Route>
    <Route path="/settings" element={<SettingsPage />} />
    {/* Legacy redirects */}
    <Route path="/search" element={<Navigate to="/friends" />} />
    {/* ... */}
  </Routes>
</BrowserRouter>
```

**Navigation Strategy**:
- **Bottom Navigation**: Mobile-first with 4 main tabs (Talks, Friends, AloeVera, Settings)
- **Programmatic Navigation**: `useNavigate()` hook for card clicks and actions
- **URL Parameters**: Dynamic routes for details pages (`:eventId`, `:postId`, `:itemId`)
- **Legacy Support**: Redirects from old routes to new structure

**Route Protection**: ✅ `<ProtectedRoute>` wraps all routes except `/` — reads and validates JWT expiry from `localStorage`, redirects to `/` if missing/expired (in API mode)

---

### 2. Component Architecture

**Pattern**: Atomic Design (loosely followed)  
**Style**: Functional components with hooks

```
src/
├── pages/                    # Page-level components (Organisms)
│   ├── Welcome.tsx           # Landing + Auth
│   ├── Friends.tsx           # Dating features
│   ├── Talks.tsx             # Forum + Group chats
│   ├── AloeVera.tsx          # Band hub
│   ├── EventDetails.tsx      # Event detail view
│   ├── BlogPost.tsx          # Blog post view
│   ├── StoreItem.tsx         # Product detail view
│   ├── SettingsPage.tsx      # User settings
│   └── NotFound.tsx          # 404 page
│
├── components/
│   └── ui/                   # Reusable UI components (Atoms & Molecules)
│       ├── button.tsx        # shadcn/ui components (60+ files)
│       ├── card.tsx
│       ├── tabs.tsx
│       ├── bottom-navigation.tsx    # Custom navigation
│       ├── swipe-card.tsx           # Custom swipe interaction
│       └── event-postmark.tsx       # Custom artistic component
│
├── contexts/                 # Global state providers
│   └── LanguageContext.tsx   # i18n context
│
├── hooks/                    # Custom React hooks
│   ├── use-toast.ts
│   └── use-mobile.tsx
│
├── types/                    # TypeScript interfaces
│   ├── user.ts
│   └── chat.ts
│
└── lib/                      # Utilities
    └── utils.ts              # cn() for className merging
```

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

**Current Implementation**: Minimal global state

```typescript
// Global State (via Context API)
LanguageContext
  ├─ language: 'ru' | 'en'
  ├─ setLanguage()
  └─ t(key: string) -> translation

// Local State (useState in pages)
Friends.tsx
  ├─ activeTab: 'search' | 'likes' | 'chats'
  ├─ currentUserIndex
  ├─ showDetails
  ├─ selectedChat
  └─ messageText

AloeVera.tsx
  ├─ activeTab: 'events' | 'store' | 'blog'
  ├─ joinedEvents: string[]
  └─ selectedTag

Talks.tsx
  ├─ activeTab: 'forum' | 'events'
  ├─ selectedSection
  └─ selectedGroupChat
```

**Missing State Management**:
- User authentication state
- Current user profile
- Matches/likes globally
- Cart for store
- Draft messages
- Preferences/settings

**Recommended Architecture** (for future):

```typescript
// Auth State (Zustand or React Query + localStorage)
useAuthStore()
  ├─ user: User | null
  ├─ isAuthenticated: boolean
  ├─ login()
  ├─ logout()
  └─ updateProfile()

// Server State (React Query)
useUsers()
useMatches()
useEvents()
useMessages()
// etc.

// UI State (Local or Zustand)
useUIStore()
  ├─ bottomNavVisible
  ├─ theme: 'light' | 'dark'
  └─ notifications
```

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

**Known Type Issues**:
- Duplicate `Message` interface (in both user.ts and chat.ts)
- Inconsistent optional properties
- No validation schemas (Zod not used)

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
    ↓ HTTP/REST
nginx (port 8080)
    ├─ /           → React SPA static files
    ├─ /api/       → proxy_pass → backend:8080 (Docker internal)
    └─ /swagger    → proxy_pass → backend:8080
         ↓
.NET 10 ASP.NET Core (port 8080 internal)
    ├─ JWT authentication (JwtService, PBKDF2 password hashing)
    └─ Azure Table Storage (15 tables)
```

**Implemented API Endpoints** (`/api/v1/`):
```
POST   /auth/register, /auth/login, /auth/logout, /auth/refresh
       /auth/verify-email, /auth/forgot-password, /auth/reset-password, /auth/change-password

GET    /users, /users/me, /users/{id}
PUT    /users/{id}

GET    /events, /events/{id}
POST   /events/{id}/register
DELETE /events/{id}/register

POST   /matching/likes
GET    /matching/likes/sent, /matching/likes/received, /matching/matches

GET    /store, /store/{id}
GET    /blog, /blog/{id}

GET    /forum/sections, /forum/sections/{id}/topics
GET    /forum/topics/{id}, /forum/topics/{id}/replies
POST   /forum/topics/{id}/replies
```

**Not yet on backend** (frontend falls back to mock data):
- Private/group chats (`chatsApi.ts`)
- Songs (`songsApi.ts`)

---

## 🔐 Security Considerations

**Current**: JWT auth enforced on all content endpoints (`[Authorize]`). Token stored in `localStorage`. PBKDF2+salt password hashing. CORS restricted to known origins.

**Required for Production**:

1. **Authentication**:
   - JWT tokens or session cookies
   - Secure token storage
   - Token refresh mechanism
   - CSRF protection

2. **Authorization**:
   - Route protection
   - API endpoint protection
   - Role-based access control (user, admin, moderator)

3. **Data Protection**:
   - Input sanitization
   - XSS prevention
   - SQL injection prevention (backend)
   - Rate limiting
   - CORS configuration

4. **Privacy**:
   - GDPR compliance
   - Privacy settings enforcement
   - Anonymous mode
   - Data export/deletion

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

## 🧪 Testing Strategy (To Be Implemented)

**Recommended Testing Pyramid**:

```
        /\
       /E2E\      ← Few (Playwright/Cypress)
      /────\
     /Integ.\    ← Some (React Testing Library)
    /────────\
   /   Unit   \  ← Many (Vitest)
  /____________\
```

**Unit Tests** (Vitest):
- Utility functions
- Custom hooks
- Type guards
- Formatters

**Component Tests** (React Testing Library):
- UI component behavior
- User interactions
- Conditional rendering
- Props handling

**Integration Tests**:
- Page component flows
- Context providers
- Router navigation
- Form submissions

**E2E Tests** (Playwright):
- User journeys (login → search → match → chat)
- Critical paths
- Cross-browser testing

---

## 🚀 Deployment Architecture

**Current**: Can be deployed as static site

**Production Recommendations**:

```
┌─────────────────────────────────────────┐
│          CDN (CloudFlare/AWS)           │
│         (Static Assets, SPA)            │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │  Load       │
        │  Balancer   │
        └──────┬──────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼───┐
│Backend │          │Backend  │
│Server 1│          │Server 2 │
└───┬────┘          └─────┬───┘
    │                     │
    └──────────┬──────────┘
               │
        ┌──────▼──────┐
        │  Database   │
        │(PostgreSQL) │
        └─────────────┘
```

**Frontend Deployment**:
- Build: `npm run build`
- Output: `dist/` directory
- Hosting options:
  - Lovable (native)
  - Vercel
  - Netlify
  - AWS S3 + CloudFront
  - Docker + Nginx (included in repo)

**Environment Variables** (to be added):
```env
VITE_API_URL=https://api.aloevera-meet.com
VITE_WS_URL=wss://api.aloevera-meet.com
VITE_CDN_URL=https://cdn.aloevera-meet.com
VITE_SENTRY_DSN=...
VITE_GA_ID=...
```

---

## 📈 Scalability Considerations

**Current**: Backend running as in-memory mock (Azure Storage not integrated)

**For Growth**:

1. **Database**:
   - Indexing on frequently queried fields
   - Denormalization where appropriate
   - Caching layer (Redis)
   - Read replicas

2. **API**:
   - Horizontal scaling
   - Caching (Redis, CDN)
   - Rate limiting per user
   - GraphQL for flexible queries (optional)

3. **Real-time**:
   - WebSocket server clustering
   - Redis pub/sub for message distribution
   - Presence tracking

4. **Media**:
   - CDN for images
   - Image processing service
   - Video streaming (if added)

---

## 🔄 Migration Path

**Phase 1: Foundation** ✅ Done
1. ~~Centralize mock data~~ — all in `src/data/`
2. ~~Create service layer~~ — `src/services/api/`
3. ~~Add environment configuration~~ — `.env.development`/`.env.production`
4. ~~Implement authentication~~ — backend JWT + frontend `authApi.ts`

**Phase 2: Backend Integration** ✅ Done
1. ~~Implement token storage + protected routes~~ — `localStorage` + `ProtectedRoute`
2. ~~Replace mock data with API calls~~ — all pages use `useEffect` + API services
3. ~~Azure Table Storage~~ — integrated with mode switch + seeder tool
4. ~~Docker deployment~~ — nginx proxy, single port, deployed on Azure VM

**Phase 3: Enhancement** 🔄 Next
1. **Token refresh** — proper `AuthContext` + refresh token flow (Issue #2 follow-up)
2. Add testing
3. Performance optimization
4. Complete i18n (Issue #8)
5. Add user-visible error handling (Issue #9)

**Phase 4: Production**
1. Azure Blob Storage (image uploads)
2. Email service (SMTP/SendGrid)
3. Real-time messaging (SignalR)
4. Security audit
5. Load testing
6. Monitoring setup

---

## 📚 References

- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **React Router**: https://reactrouter.com/
- **TanStack Query**: https://tanstack.com/query/

---

**Next**: See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for backend implementation details.
