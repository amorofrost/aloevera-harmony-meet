# Architecture Documentation

**AloeVera Harmony Meet** - Technical Architecture Overview

**Version**: 1.0 (Mock/Frontend Only)  
**Last Updated**: February 17, 2026

---

## 📐 System Overview

AloeVera Harmony Meet is a **React-based single-page application (SPA)** designed as a fan community platform combining dating features, social networking, event management, and e-commerce for AloeVera music band enthusiasts.

### Current State
- **Frontend Only**: Complete UI implementation with mock data
- **No Backend**: All data is hardcoded in components
- **No API Layer**: No HTTP requests or WebSocket connections
- **No Database**: No data persistence

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
│  [MISSING - Currently Mock Data in Components]      │
├─────────────────────────────────────────────────────┤
│                  Services Layer                      │
│  [MISSING - No API Service, Auth Service, etc.]     │
├─────────────────────────────────────────────────────┤
│                   Backend API                        │
│  [NOT IMPLEMENTED]                                   │
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

**Route Protection**: ❌ Not implemented (all routes are public)

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
- Contain mock data definitions
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

### 4. Data Layer (Current - Mock)

**Location**: Inline in page components  
**Format**: Hardcoded TypeScript arrays/objects

**Issues**:
- Duplication across components
- Inconsistent IDs and relationships
- Can't be shared between pages
- Hard to maintain

**Example** (`Friends.tsx`):
```typescript
const searchUsers: User[] = [
  { id: '1', name: 'Анна', age: 25, /* ... */ },
  { id: '2', name: 'Дмитрий', age: 28, /* ... */ },
  // ...
];

const mockMatches: (Match & { otherUser: User })[] = [
  { id: '1', users: ['current-user','1'], /* ... */ },
  // ...
];
```

**Recommended Refactor**:
```typescript
// src/data/mockData.ts
export const MOCK_USERS: User[] = [ /* ... */ ];
export const MOCK_EVENTS: Event[] = [ /* ... */ ];
export const MOCK_STORE_ITEMS: StoreItem[] = [ /* ... */ ];

// src/data/mockApi.ts
export const mockApi = {
  async getUsers(): Promise<User[]> {
    return Promise.resolve(MOCK_USERS);
  },
  async getUser(id: string): Promise<User | null> {
    return Promise.resolve(MOCK_USERS.find(u => u.id === id) || null);
  },
  // ...
};
```

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

## 🔌 Integration Points (Future)

### Backend API (To Be Implemented)

**Recommended Architecture**:

```
Frontend (React SPA)
    ↓ HTTP/REST
Backend API (Node.js/Express or similar)
    ↓
Database (PostgreSQL/MongoDB)
    ↓
External Services
    ├─ Authentication (Auth0, Firebase)
    ├─ File Storage (S3, Cloudinary)
    ├─ Email (SendGrid, AWS SES)
    ├─ Payment (Stripe)
    └─ Real-time (Socket.io, Pusher)
```

**API Endpoints Needed**:

```typescript
// Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

// Users
GET    /api/users
GET    /api/users/:id
PUT    /api/users/:id
GET    /api/users/search?preferences=...

// Matching
POST   /api/likes
GET    /api/likes/sent
GET    /api/likes/received
GET    /api/matches

// Messaging
GET    /api/chats
GET    /api/chats/:id
POST   /api/chats/:id/messages
WS     /ws/chats/:id  // Real-time

// Events
GET    /api/events
GET    /api/events/:id
POST   /api/events/:id/register
DELETE /api/events/:id/register

// Store
GET    /api/store/items
GET    /api/store/items/:id
POST   /api/store/orders

// Blog
GET    /api/blog/posts
GET    /api/blog/posts/:id

// Forum
GET    /api/forum/sections
GET    /api/forum/topics
POST   /api/forum/topics
POST   /api/forum/replies
```

**Service Layer** (to be created):

```typescript
// src/services/api.ts
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// src/services/authService.ts
export const authService = {
  login(email, password),
  register(data),
  logout(),
  getCurrentUser()
};

// src/services/userService.ts
export const userService = {
  getUsers(filters),
  getUser(id),
  updateUser(id, data)
};

// etc.
```

**React Query Integration**:

```typescript
// src/hooks/queries/useUsers.ts
export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => userService.getUsers(filters)
  });
}

// Usage in component
const { data: users, isLoading, error } = useUsers({ ageRange: [20, 30] });
```

---

## 🔐 Security Considerations (Future)

**Current**: ⚠️ No security implementation

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

**Current**: Not applicable (no backend)

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

**Phase 1: Foundation** (Current → Backend)
1. Centralize mock data
2. Create service layer interfaces
3. Add environment configuration
4. Implement authentication

**Phase 2: Backend Integration**
1. Replace mock data with API calls
2. Add React Query for server state
3. Implement real-time messaging
4. Add error handling

**Phase 3: Enhancement**
1. Add testing
2. Performance optimization
3. SEO improvements
4. PWA features

**Phase 4: Production**
1. Security audit
2. Load testing
3. Monitoring setup
4. Documentation

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
