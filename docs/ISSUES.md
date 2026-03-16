# Known Issues & Technical Debt

This document catalogs all identified issues, technical debt, and areas for improvement in the AloeVera Harmony Meet application.

**Last Updated**: March 15, 2026
**Status**: Full-stack deployed on Azure VM. Azure Table Storage integrated. Docker Compose working end-to-end via nginx proxy on port 8080. JWT token refresh fully implemented. Form validation (react-hook-form + Zod) and user-visible error handling (sonner toasts) implemented on all forms. Chat system (REST + SignalR) implemented on backend and frontend.

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
- `chatsApi.ts` — Private chats (dual-mode; backend REST + SignalR implemented as of March 15, 2026)
- `songsApi.ts` — AloeVera songs (mock-only; backend endpoint pending)

**Mock data centralized** in `src/data/`:
- `mockSongs.ts`, `mockEvents.ts`, `mockStoreItems.ts`, `mockBlogPosts.ts`
- `mockForumData.ts`, `mockChats.ts`, `mockProfiles.ts`, `mockCurrentUser.ts`

**Pages updated** to use `useEffect` + API services with loading states:
- `Friends.tsx`, `AloeVera.tsx`, `Talks.tsx`, `EventDetails.tsx`, `BlogPost.tsx`, `StoreItem.tsx`, `SettingsPage.tsx`

**Remaining**: Songs endpoint not on backend.

**Forum topic detail** (added Feb 19, 2026):
- `src/components/forum/TopicDetail.tsx` — renders topic content, replies, and reply input
- `forumsApi.getTopic(topicId)` — calls `GET /api/v1/forum/topics/{topicId}` + `GET /api/v1/forum/topics/{topicId}/replies`
- `forumsApi.createReply(topicId, content)` — calls `POST /api/v1/forum/topics/{topicId}/replies`
- Clicking an author name/avatar in `TopicDetail` navigates to `/friends?userId={authorId}`; `Friends.tsx` loads that user's profile via `usersApi.getUserById`

---

### ~~2. AuthContext Not Implemented — Token Not Stored~~ ✅ RESOLVED
**Resolved**: February 19, 2026 (initial), February 24, 2026 (token refresh)
**Approach**: lightweight localStorage-based token management instead of full AuthContext

**What was implemented**:
- `apiClient.ts` stores/reads/clears `access_token` and `refresh_token` from `localStorage`
- `Welcome.tsx` calls `apiClient.setAccessToken()` and `apiClient.setRefreshToken()` on successful login
- `SettingsPage.tsx` calls `authApi.logout()` (server-side revocation) + `apiClient.clearTokens()` on sign-out
- **Silent token refresh**: on any `401` response `apiClient` calls `POST /api/v1/auth/refresh` with the stored refresh token in the request body, updates both tokens, and retries the original request — concurrent 401s are deduplicated (only one refresh call fires; others queue)
- **Proactive refresh** in `ProtectedRoute`: if the access token is missing or expired and a refresh token is present, a silent refresh is attempted with a loading spinner; if the token is near-expiry (<5 min) the user is let through immediately and a background refresh fires
- `App.tsx` wraps all routes except `/` with `<ProtectedRoute>`

**Remaining / known limitations**:
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

### ~~5. No Testing Framework~~ ✅ Resolved

**Severity**: ~~High~~ → Resolved
**Impact**: Code quality, reliability, refactoring confidence

**Implemented** (2026-03-15):
- **Vitest** + jsdom — test runner with `globals: true`, config in `vite.config.ts`
- **React Testing Library** — `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom/vitest`
- **47 tests** across 4 files — all passing

**Coverage**:
- `src/lib/validators.ts` — all 5 Zod schemas (22 tests)
- `src/lib/apiError.ts` — `showApiError()` (5 tests)
- `src/lib/utils.ts` — `cn()` (3 tests)
- `src/pages/Welcome.tsx` — login + register forms (17 tests)

**Remaining gaps**: Other page components, API services, `ProtectedRoute`, custom hooks. E2E (Playwright) deferred.

---

### ~~6. Mock Data Still Embedded in Most Page Components~~ ✅ RESOLVED
**Resolved**: February 19, 2026

All mock data has been extracted from page components into `src/data/` files and each domain has a corresponding API service with a mock branch. Page components now use `useEffect` hooks to fetch data via service functions in both mock and API modes.

---

### ~~7. Type Inconsistencies~~ ✅ RESOLVED
**Resolved**: March 15, 2026

**Duplicate `Message` interface**:
- ~~Defined in both `src/types/user.ts` and `src/types/chat.ts`~~ — removed from `user.ts`
- `user.ts` now imports `Message` from `chat.ts`
- `chat.ts` is the single source of truth for `Message`, `ChatDto`, `MessageDto` (type aliases), and `PrivateChatWithUser`

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

### ~~9. Lack of Error Handling~~ ✅ RESOLVED
**Resolved**: March 14, 2026

**What was implemented**:
- `src/lib/apiError.ts` — `showApiError(err, fallback)` helper: extracts `err.error.message` from ApiResponse shape, falls back to `Error.message`, then the fallback string, and calls `toast.error()`
- `<Sonner position="bottom-center" richColors />` added to `App.tsx` (red for errors, green for success)
- Auth actions: `toast.success('Welcome back!')` on login, `toast.success('Account created! Check your email to verify.')` on register
- Profile save: `toast.success('Profile updated')` on success; `showApiError` on failure
- Logout: `showApiError(err, 'Logout failed')` instead of silently swallowing the error
- Forum replies: `toast.success('Reply posted')` on success; `showApiError` on failure
- Unexpected API failures (network errors, etc.) surfaced via `showApiError` in all wired forms

**Still missing**:
- React Error Boundaries (component-level crashes)
- Retry logic / fallback UI when network is unavailable

---

### ~~10. No Validation on Forms~~ ✅ RESOLVED
**Resolved**: March 14, 2026

**What was implemented** — `src/lib/validators.ts` (new) contains all Zod schemas:
- `loginSchema` — email (valid format), password (non-empty)
- `registerSchema` — email, password (≥8 chars + uppercase + lowercase + digit + special char), name, age (18–99 int), location, gender, bio (optional, max 500 chars)
- `profileEditSchema` — name, age (18–99), location, bio (optional, max 500 chars)
- `messageSchema` — content (non-empty after trim, max 2000 chars)
- `replySchema` — content (non-empty after trim, max 5000 chars)

**Forms migrated to `useForm<T>` + `zodResolver`**:
- `Welcome.tsx` — login (`mode: onSubmit`, root error for wrong credentials) + register (`mode: onBlur`, EMAIL_TAKEN mapped to field-level `setError('email', ...)`)
- `SettingsPage.tsx` — profile edit (`reset()` on cancel, `editStartUser` captures state at edit start to restore gender on cancel)
- `TopicDetail.tsx` — forum reply (single textarea, inline error below)

**Lightweight inline validation** (no react-hook-form, send is mock-only):
- `Friends.tsx` — message input: blocks empty/whitespace, inline `"Message can't be empty"` error, clears on keystroke
- `Talks.tsx` — same pattern

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
| **TypeScript/Code Quality** | 0 | 1 | 1 | 1 | 4 | #5, #7 |
| **UX/Features** | 0 | 1 | 2 | 3 | 8 | #2, #9, #10 |
| **Infrastructure** | 0 | 0 | 1 | 3 | 4 | #17 |
| **Total** | **0** | **3** | **5** | **7** | **14 open** | **#1, #2, #3, #5, #6, #7, #9, #10, #17** |

---

## 🎯 Recommended Priority Order

1. ✔️~~**Implement AuthContext** (Issue #2)~~ ✅ Done (localStorage-based minimal implementation)
2. ✔️~~**Add Protected Routes** (Issue #2)~~ ✅ Done (`ProtectedRoute` component in `App.tsx`)
3. ✔️~~**Wire remaining pages to API** (Issue #1)~~ ✅ Done (all pages use API services)
4. ✔️~~**Backend: Azure Storage** (Issue #3)~~ ✅ Done (Azure Table Storage integrated, seeder tool available)
5. ✔️~~**Full AuthContext with token refresh** (Issue #2 follow-up)~~ ✅ Done (silent refresh in `apiClient`, proactive refresh in `ProtectedRoute`, 13 new backend unit tests)
6. **Fix Type Issues** (Issue #4) — Prevents bugs during development
7. ✔️~~**Add Testing** (Issue #5)~~ ✅ Done (Vitest + RTL, 47 tests covering `src/lib/` and `Welcome.tsx`)
8. **Complete i18n** (Issue #8) — Better UX
9. ✅~~**Add Form Validation** (Issue #10)~~ ✅ Done (react-hook-form + Zod on all forms)
10. ✅~~**Improve Error Handling** (Issue #9)~~ ✅ Done (sonner toasts via `showApiError`, success toasts on auth/save/reply)
11. **Implement State Management** (Issue #12) — Scalability
12. **Improve Swipe UX** (Issue #13) — Core feature polish
13. **Everything else** — Based on priority

---

## 📝 Notes

- Application was bootstrapped with Lovable, then manually extended
- Backend (`@lovecraft/`) is a working .NET 10 API with full JWT auth, Azure Table Storage, SignalR chat, and 53 unit tests
- All pages are now wired to the API service layer — the full stack can be run end-to-end in Docker
- Auth is enforced on all backend content endpoints (`[Authorize]`); the frontend protects routes via `ProtectedRoute`
- Token refresh is fully implemented: silent refresh on 401 (with concurrent-request deduplication), proactive refresh in `ProtectedRoute`, and 13 dedicated unit tests in `RefreshTokenTests.cs`
- API service layer (`src/services/api/`) provides the mock/real dual-mode pattern
- Mock data is centralized in `src/data/` for consistency and reuse
- Backend enum serialization uses camelCase strings (e.g., `"concert"`, `"male"`) for frontend compatibility
- Design system and component architecture are solid foundations

---

**Next Steps**: Fix Type Issues (#4) and complete i18n (#8). See [API_INTEGRATION.md](./API_INTEGRATION.md) and [FRONTEND_AUTH_GUIDE.md](./FRONTEND_AUTH_GUIDE.md) for guidance.

**March 14, 2026 update**: Issues #9 (error handling) and #10 (form validation) are fully resolved. All forms use react-hook-form + Zod. User-facing errors and successes surface via sonner toasts. See `src/lib/validators.ts` and `src/lib/apiError.ts`.

**March 15, 2026 update**: Issues #5 (frontend testing, 47 tests) and #7 (duplicate Message interface) resolved. Chat system (REST + SignalR) implemented on both backend and frontend — `chatsApi.ts` is now dual-mode, `Friends.tsx` uses live messages, `Talks.tsx` uses forum topics for event discussion with real-time reply broadcasting. See `docs/superpowers/plans/2026-03-15-chat-signalr.md` and `@lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md`.
