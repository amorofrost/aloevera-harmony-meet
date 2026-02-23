# Known Issues & Technical Debt

This document catalogs all identified issues, technical debt, and areas for improvement in the AloeVera Harmony Meet application.

**Last Updated**: February 23, 2026
**Status**: Full-stack deployed on Azure VM. Azure Table Storage integrated. Docker Compose working end-to-end via nginx proxy on port 8080.

---

## 🔴 Critical Issues

### ~~1. Pages Not Connected to Backend API~~ ✅ RESOLVED
**Resolved**: February 19, 2026

All pages are now wired to the backend API (in API mode) via dedicated service files in `src/services/api/`. Each service has a dual-mode mock/API implementation.

**API services created**:
- `eventsApi.ts` — Events list, detail, register/unregister
- `storeApi.ts` — Store items list and detail
- `blogApi.ts` — Blog posts list and detail
- `forumsApi.ts` — Forum sections and topics
- `matchingApi.ts` — Search profiles, matches, sent/received likes
- `chatsApi.ts` — Event group chats and private chats (mock-only; backend endpoint pending)
- `songsApi.ts` — AloeVera songs (mock-only; backend endpoint pending)

**Mock data centralized** in `src/data/`:
- `mockSongs.ts`, `mockEvents.ts`, `mockStoreItems.ts`, `mockBlogPosts.ts`
- `mockForumData.ts`, `mockChats.ts`, `mockProfiles.ts`, `mockCurrentUser.ts`

**Pages updated** to use `useEffect` + API services with loading states:
- `Friends.tsx`, `AloeVera.tsx`, `Talks.tsx`, `EventDetails.tsx`, `BlogPost.tsx`, `StoreItem.tsx`, `SettingsPage.tsx`

**Remaining**: Chat (private/group) send-message endpoints not yet backed by real API; songs endpoint not on backend.

**Forum topic detail** (added Feb 19, 2026):
- `src/components/forum/TopicDetail.tsx` — renders topic content, replies, and reply input
- `forumsApi.getTopic(topicId)` — calls `GET /api/v1/forum/topics/{topicId}` + `GET /api/v1/forum/topics/{topicId}/replies`
- `forumsApi.createReply(topicId, content)` — calls `POST /api/v1/forum/topics/{topicId}/replies`
- Clicking an author name/avatar in `TopicDetail` navigates to `/friends?userId={authorId}`; `Friends.tsx` loads that user's profile via `usersApi.getUserById`

---

### ~~2. AuthContext Not Implemented — Token Not Stored~~ ✅ RESOLVED (minimal implementation)
**Resolved**: February 19, 2026  
**Approach**: lightweight localStorage-based token management instead of full AuthContext

**What was implemented**:
- `apiClient.ts` now stores/reads/clears the access token from `localStorage` (`access_token` key)
- `Welcome.tsx` calls `apiClient.setAccessToken(token)` on successful login
- `SettingsPage.tsx` calls `apiClient.clearAccessToken()` on sign-out
- `apiClient.ts` handles `401 Unauthorized` responses by clearing the token and redirecting to `/`
- `src/components/ProtectedRoute.tsx` — reads and validates (incl. expiry) the JWT from `localStorage`; in API mode redirects unauthenticated users to `/`; in mock mode always passes through
- `App.tsx` wraps all routes except `/` with `<ProtectedRoute>`

**Remaining / known limitations**:
- No token refresh — when the access token expires (1 hour by default) the user is redirected to login
- No React Context for user identity — the current user is fetched per-page via `usersApi.getCurrentUser()`
- No `AuthProvider` / `useAuth()` hook — token is accessed imperatively via `apiClient`

---

### ~~3. No Data Persistence (Backend In-Memory)~~ ✅ RESOLVED
**Resolved**: February 23, 2026

Azure Table Storage is now fully integrated into the backend. All data persists across restarts.

**What was implemented** (in `Lovecraft.Backend/`):
- `Storage/TableNames.cs` — 15 table name constants
- `Storage/Entities/` — 14 entity classes (UserEntity, EventEntity, BlogPostEntity, StoreItemEntity, ForumSectionEntity, ForumTopicEntity, ForumReplyEntity, LikeEntity, MatchEntity, RefreshTokenEntity, etc.)
- `Services/Azure/` — 7 Azure service implementations: `AzureAuthService`, `AzureUserService`, `AzureEventService`, `AzureMatchingService`, `AzureBlogService`, `AzureStoreService`, `AzureForumService`
- Mode switch via `USE_AZURE_STORAGE=true/false` in config (false = mock mode, true = Azure)
- Connection string via `AZURE_STORAGE_CONNECTION_STRING` env var

**`Lovecraft.Tools.Seeder`** — new CLI tool that seeds Azure Table Storage with all mock data (users with hashed passwords, events, store items, blog posts, forum sections/topics/replies). Run from `Lovecraft/` directory:
```bash
dotnet run --project Lovecraft.Tools.Seeder
# Requires AZURE_STORAGE_CONNECTION_STRING in .env or environment
```

**Remaining**:
- Azure Blob Storage (image uploads) — not yet integrated (images still Unsplash URLs)
- Email service — tokens logged to console, no real email sending

---

## 🟠 High Priority Issues

### 4. Loose TypeScript Configuration
**Severity**: High  
**Impact**: Type safety compromised, potential runtime errors

**Current `tsconfig.json` settings**:
```json
{
  "noImplicitAny": false,
  "noUnusedParameters": false,
  "skipLibCheck": true,
  "allowJs": true,
  "noUnusedLocals": false,
  "strictNullChecks": false
}
```

**Problems**:
- Missing type annotations won't be caught
- Implicit `any` types allowed
- Null/undefined errors won't be caught at compile time
- Unused code won't be flagged

**Resolution**: Gradually enable strict mode:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

---

### 5. No Testing Framework
**Severity**: High  
**Impact**: Code quality, reliability, refactoring confidence

- No unit tests
- No integration tests
- No E2E tests
- No test infrastructure

**Resolution**: Add testing setup:
- **Vitest** for unit/integration tests (Vite-native)
- **React Testing Library** for component tests
- **Playwright** or **Cypress** for E2E tests

**Recommended Structure**:
```
src/
  __tests__/
    unit/
    integration/
  pages/
    __tests__/
      Friends.test.tsx
```

---

### ~~6. Mock Data Still Embedded in Most Page Components~~ ✅ RESOLVED
**Resolved**: February 19, 2026

All mock data has been extracted from page components into `src/data/` files and each domain has a corresponding API service with a mock branch. Page components now use `useEffect` hooks to fetch data via service functions in both mock and API modes.

---

### 7. Type Inconsistencies
**Severity**: High  
**Impact**: Type safety, potential bugs

**Duplicate `Message` interface**:
- Defined in both `src/types/user.ts` (lines 43-50) and `src/types/chat.ts` (lines 12-20)
- Different properties and structure
- Creates confusion about which to use

**Resolution**: 
- Remove `Message` from `user.ts`
- Use only the `Message` interface from `chat.ts`
- Update imports in all files
- Ensure `Match` interface properly references the correct `Message` type

---

### 8. Incomplete Internationalization
**Severity**: High  
**Impact**: User experience for non-Russian speakers

**Problems**:
- Many UI strings are hardcoded in Russian (not translated)
- Page components have mixed translated/untranslated strings
- No translation for error messages
- Forum section names hardcoded
- Blog content not translatable

**Examples of untranslated strings**:
- Forum sections: "Общий", "Музыка", "Города", "Офтопик"
- Store categories: "Одежда", "Музыка", "Мерч"
- Event categories: "Концерт", "Встреча", "Фестиваль"
- Chat placeholders and system messages

**Resolution**:
- Add all strings to `LanguageContext` translations
- Use `t()` function consistently throughout
- Consider using i18next for more robust i18n

---

## 🟡 Medium Priority Issues

### 9. Lack of Error Handling
**Severity**: Medium  
**Impact**: Poor UX when things go wrong

**Partially resolved** (February 19, 2026): All page components now have:
- `try/catch` blocks wrapping API calls
- Loading state with spinner while data loads
- Basic error logging to console

**Still missing**:
- React Error Boundaries (component-level crashes)
- User-visible error messages (toast / inline alerts) for failed API calls
- Retry logic
- Fallback UI when network is unavailable

**Resolution**:
- Add React Error Boundaries
- Surface errors with toast notifications (shadcn/ui `toast` is already available)
- Add retry buttons on error states

---

### 10. No Validation on Forms
**Severity**: Medium  
**Impact**: Data quality, UX

While React Hook Form and Zod are included in dependencies, they're not actually used in any forms:
- Login/register forms have no validation
- Profile edit forms have no validation
- Message inputs have no validation
- Settings changes have no validation

**Resolution**: Implement form validation with React Hook Form + Zod schemas.

---

### 11. Accessibility Issues
**Severity**: Medium  
**Impact**: Users with disabilities, SEO

**Missing**:
- Semantic HTML in many places
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management
- Alt text on some images
- Skip navigation links
- Proper heading hierarchy in some components

**Resolution**: 
- Add ARIA attributes
- Implement keyboard navigation
- Test with screen readers
- Add focus traps for modals
- Use semantic HTML elements

---

### 12. No State Management Strategy
**Severity**: Medium  
**Impact**: Scalability, code organization

**Current approach**:
- React Context only for language (good)
- Local component state for everything else
- TanStack React Query configured but unused
- No global state for user, auth, or app state

**Problems**:
- Can't share state between pages
- Auth state is hardcoded
- User profile not globally accessible
- Matches/likes not accessible outside Friends page

**Resolution**: 
- Use TanStack React Query for server state (when backend exists)
- Consider Zustand or Jotai for client-side global state
- Keep Context API for theme/language

---

### 13. Swipe Functionality Incomplete
**Severity**: Medium  
**Impact**: Core dating feature UX

The `SwipeCard` component exists (`src/components/ui/swipe-card.tsx`) but:
- Swipe gestures may not work smoothly on all devices
- No swipe animation feedback
- No undo functionality
- No algorithm for user recommendations
- No filtering based on preferences

**Resolution**: 
- Test and improve gesture handling
- Add swipe animations
- Implement user recommendation algorithm (backend)
- Add preference-based filtering

---

### 14. Image Handling Issues
**Severity**: Medium  
**Impact**: Performance, UX

**Problems**:
- All images are from Unsplash URLs (external dependency)
- No image optimization
- No lazy loading
- No image upload functionality
- No image validation
- Same placeholder images used for different users

**Resolution**:
- Implement image upload functionality
- Add image optimization (sharp, cloudinary, or similar)
- Implement lazy loading
- Add proper CDN or local storage
- Use unique, appropriate images

---

### 15. Responsive Design Gaps
**Severity**: Medium  
**Impact**: UX on various devices

- Mobile-first approach is good
- Bottom navigation only shown on mobile
- Some components may not work well on tablets
- Desktop experience could be enhanced with sidebar navigation
- Some text may be too small on mobile

**Resolution**:
- Test on various devices and screen sizes
- Add tablet-specific layouts
- Consider desktop sidebar navigation
- Ensure all touch targets are at least 44x44px

---

## 🟢 Low Priority Issues

### 16. Package.json Name Mismatch
**Severity**: Low  
**Impact**: Project identity confusion

`package.json` has name: `"vite_react_shadcn_ts"` (generic template name) instead of `"aloevera-harmony-meet"`

**Resolution**: Update package.json name field.

---

### ~~17. Incomplete Docker Configuration~~ ✅ RESOLVED
**Resolved**: February 23, 2026 (updated)

Full stack is deployed and tested on Azure VM (`http://20.153.164.3:8080`). The `docker-compose.yml` in `loveable/aloevera-harmony-meet/` starts both containers.

**Key deployment details**:
- nginx proxies `/api/` and `/swagger` to the backend container over the internal Docker network — only port 8080 needs to be exposed publicly (port 5000 does not need to be open in the Azure NSG)
- `VITE_API_BASE_URL` is baked into the frontend bundle at build time and must match the public hostname/IP (currently `http://20.153.164.3:8080`)
- Backend reads `USE_AZURE_STORAGE` and `AZURE_STORAGE_CONNECTION_STRING` from `../../lovecraft/Lovecraft/.env` via `env_file`

```bash
# From loveable/aloevera-harmony-meet/
docker compose up --build -d
```

---

### 18. No Environment Configuration
**Severity**: Low  
**Impact**: Configuration management

- No `.env` file or `.env.example`
- API URLs will need to be hardcoded
- No way to configure different environments (dev/staging/prod)

**Resolution**: 
- Add `.env.example` with template variables
- Document all required environment variables
- Use Vite's env variable system (`import.meta.env`)

---

### 19. Unused Dependencies
**Severity**: Low  
**Impact**: Bundle size, maintenance

Several packages are included but not used or minimally used:
- `@tanstack/react-query` - Configured but not used
- `recharts` - Imported but no charts implemented
- `next-themes` - Dark mode package but dark mode not implemented
- `react-resizable-panels` - Not used anywhere
- `vaul` - Drawer component not used
- `cmdk` - Command palette not used

**Resolution**: 
- Remove unused packages OR
- Implement features that use them (e.g., dark mode, analytics charts)

---

### 20. No Analytics or Monitoring
**Severity**: Low  
**Impact**: Business insights, debugging

- No analytics integration (GA, Mixpanel, etc.)
- No error tracking (Sentry, LogRocket, etc.)
- No performance monitoring
- No user behavior tracking

**Resolution**: Add analytics and monitoring when backend is implemented.

---

### 21. No PWA Support
**Severity**: Low  
**Impact**: Mobile experience, offline functionality

No Progressive Web App capabilities:
- No service worker
- No offline support
- No install prompt
- No push notifications

**Resolution**: Add PWA support using Vite PWA plugin.

---

### 22. Inconsistent Date Formatting
**Severity**: Low  
**Impact**: Code consistency

Date formatting is done manually in multiple places with `Intl.DateTimeFormat`:
- `Friends.tsx`: `formatDateShort`, `formatTime`, `formatChatDate`
- `AloeVera.tsx`: `formatDate`, `formatBlogDate`
- Different formats in different components

**Resolution**: Create centralized date formatting utilities using date-fns.

---

### 23. Missing Metadata and SEO
**Severity**: Low  
**Impact**: SEO, social sharing

`index.html` has basic metadata but:
- No Open Graph tags
- No Twitter Card tags
- Generic title/description
- No favicon variation (only basic)
- No structured data (JSON-LD)

**Resolution**: Add comprehensive metadata for SEO and social sharing.

---

### 24. No Content Moderation System
**Severity**: Low (for mock) / High (for production)  
**Impact**: Community safety

No consideration for:
- Inappropriate content detection
- User reporting
- Admin moderation interface
- Spam prevention
- Blocking/muting users

**Resolution**: Design and implement moderation system when backend is built.

---

### 25. Event Postmark Component Unused
**Severity**: Low  
**Impact**: Visual design opportunity missed

The artistic `EventPostmark` component is imported but its full potential isn't utilized:
- Only shown on event cards in `AloeVera.tsx`
- Could be used more prominently
- Could be collected as "stamps" by users who attended events

**Resolution**: Enhance event postmark feature as a collectible/badge system.

---

## 📊 Summary by Category

| Category | Critical | High | Medium | Low | Total | Resolved |
|----------|----------|------|--------|-----|-------|----------|
| **Backend/Data** | 0 | 1 | 1 | 0 | 3 | #1, #3, #6, #17 |
| **TypeScript/Code Quality** | 0 | 3 | 1 | 1 | 5 | — |
| **UX/Features** | 0 | 1 | 4 | 3 | 8 | #2 (partial) |
| **Infrastructure** | 0 | 0 | 1 | 3 | 4 | #17 |
| **Total** | **0** | **5** | **7** | **7** | **19 open** | **#1, #2, #3, #6, #17** |

---

## 🎯 Recommended Priority Order

1. ~~**Implement AuthContext** (Issue #2)~~ ✅ Done (localStorage-based minimal implementation)
2. ~~**Add Protected Routes** (Issue #2)~~ ✅ Done (`ProtectedRoute` component in `App.tsx`)
3. ~~**Wire remaining pages to API** (Issue #1)~~ ✅ Done (all pages use API services)
4. ~~**Backend: Azure Storage** (Issue #3)~~ ✅ Done (Azure Table Storage integrated, seeder tool available)
5. **Full AuthContext with token refresh** (Issue #2 follow-up) — Replace localStorage pattern with proper context + refresh token flow
6. **Fix Type Issues** (Issues #4, #7) — Prevents bugs during development
7. **Add Testing** (Issue #5) — Enables confident refactoring
8. **Complete i18n** (Issue #8) — Better UX
9. **Add Form Validation** (Issue #10) — Data quality
10. **Improve Error Handling** (Issue #9) — User-visible error messages, error boundaries
11. **Implement State Management** (Issue #12) — Scalability
12. **Improve Swipe UX** (Issue #13) — Core feature polish
13. **Everything else** — Based on priority

---

## 📝 Notes

- Application was bootstrapped with Lovable, then manually extended
- Backend (`@lovecraft/`) is a working .NET 10 stub with full JWT auth and mock services
- All pages are now wired to the API service layer — the full stack can be run end-to-end in Docker
- Auth is enforced on all backend content endpoints (`[Authorize]`); the frontend protects routes via `ProtectedRoute`
- API service layer (`src/services/api/`) provides the mock/real dual-mode pattern
- Mock data is centralized in `src/data/` for consistency and reuse
- Backend enum serialization uses camelCase strings (e.g., `"concert"`, `"male"`) for frontend compatibility
- Design system and component architecture are solid foundations
- The primary remaining data gap is **real persistence** (Azure Storage, Issue #3)

---

**Next Steps**: Implement token refresh (Issue #2 follow-up) and Azure Storage (Issue #3). See [API_INTEGRATION.md](./API_INTEGRATION.md) and [FRONTEND_AUTH_GUIDE.md](./FRONTEND_AUTH_GUIDE.md) for guidance.
