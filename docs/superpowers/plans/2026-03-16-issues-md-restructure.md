# ISSUES.md Restructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `docs/ISSUES.md` into type-based sections, archive resolved issues to a new `docs/RESOLVED_ISSUES.md`, and add all newly identified issues from the March 16, 2026 audit.

**Architecture:** Pure documentation change — no code, no tests, no build steps. Three files are modified: `RESOLVED_ISSUES.md` is created from content extracted from the existing `ISSUES.md`; `ISSUES.md` is fully rewritten with the new structure; `AGENTS.md` is updated to reference both files. Each task is independent and self-contained.

**Tech Stack:** Markdown. No tooling required beyond a text editor.

**Spec:** `docs/superpowers/specs/2026-03-16-issues-restructure-design.md`

---

## Chunk 1: Create RESOLVED_ISSUES.md

### Task 1: Create `docs/RESOLVED_ISSUES.md`

**Files:**
- Create: `docs/RESOLVED_ISSUES.md`

- [ ] **Step 1: Verify the 9 resolved issues exist in the current ISSUES.md**

Open `docs/ISSUES.md` and confirm these are present and marked resolved:
`#1`, `#2`, `#3`, `#5`, `#6`, `#7`, `#9`, `#10`, `#17`

Expected: each has `~~N. Title~~ ✅ RESOLVED` or `✅ Resolved` heading.

- [ ] **Step 2: Create `docs/RESOLVED_ISSUES.md` with the following content**

Write the file exactly as shown:

```markdown
# Resolved Issues Archive

This file is the historical record of resolved issues for **AloeVera Harmony Meet**.

Active issues are tracked in [ISSUES.md](./ISSUES.md).

> **Append-only.** Issues move here when resolved. Nothing is deleted.

---

## ~~1. Pages Not Connected to Backend API~~ ✅ RESOLVED
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

**Forum topic detail** (added Feb 19, 2026):
- `src/components/forum/TopicDetail.tsx` — renders topic content, replies, and reply input
- `forumsApi.getTopic(topicId)` — calls `GET /api/v1/forum/topics/{topicId}` + `GET /api/v1/forum/topics/{topicId}/replies`
- `forumsApi.createReply(topicId, content)` — calls `POST /api/v1/forum/topics/{topicId}/replies`
- Clicking an author name/avatar in `TopicDetail` navigates to `/friends?userId={authorId}`; `Friends.tsx` loads that user's profile via `usersApi.getUserById`

---

## ~~2. AuthContext Not Implemented — Token Not Stored~~ ✅ RESOLVED
**Resolved**: February 19, 2026 (initial), February 24, 2026 (token refresh)
**Approach**: Lightweight localStorage-based token management instead of full AuthContext.

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

## ~~3. No Data Persistence (Backend In-Memory)~~ ✅ RESOLVED
**Resolved**: February 23, 2026

Azure Table Storage is now fully integrated into the backend. All data persists across restarts.

**What was implemented** (in `Lovecraft.Backend/`):
- `Storage/TableNames.cs` — 15 table name constants
- `Storage/Entities/` — 14 entity classes (UserEntity, EventEntity, BlogPostEntity, StoreItemEntity, ForumSectionEntity, ForumTopicEntity, ForumReplyEntity, LikeEntity, MatchEntity, RefreshTokenEntity, etc.)
- `Services/Azure/` — 7 Azure service implementations: `AzureAuthService`, `AzureUserService`, `AzureEventService`, `AzureMatchingService`, `AzureBlogService`, `AzureStoreService`, `AzureForumService`
- Mode switch via `USE_AZURE_STORAGE=true/false` in config (false = mock mode, true = Azure)
- Connection string via `AZURE_STORAGE_CONNECTION_STRING` env var

**`Lovecraft.Tools.Seeder`** — CLI tool that seeds Azure Table Storage with all mock data. Run from `Lovecraft/`:
```bash
dotnet run --project Lovecraft.Tools.Seeder
# Requires AZURE_STORAGE_CONNECTION_STRING in .env or environment
```

**Remaining at time of resolution**:
- Azure Blob Storage (image uploads) — not yet integrated (tracked as #32)
- Email service — tokens logged to console, no real email sending (tracked as #26)

---

## ~~5. No Testing Framework~~ ✅ RESOLVED
**Resolved**: March 15, 2026

**What was implemented**:
- **Vitest** + jsdom — test runner with `globals: true`, config in `vite.config.ts`
- **React Testing Library** — `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom/vitest`
- **50 tests** across 4 files — all passing

**Coverage**:
- `src/lib/validators.ts` — all 5 Zod schemas (22 tests)
- `src/lib/apiError.ts` — `showApiError()` (5 tests)
- `src/lib/utils.ts` — `cn()` (3 tests)
- `src/pages/Welcome.tsx` — login + register forms (17 tests)
- `src/services/api/chatsApi.ts` — 3 additional tests added March 15, 2026

**Run tests**: `npm run test:run`

**Remaining gaps**: Other page components, API services, `ProtectedRoute`, custom hooks. E2E (Playwright) deferred.

---

## ~~6. Mock Data Embedded in Page Components~~ ✅ RESOLVED
**Resolved**: February 19, 2026

All mock data has been extracted from page components into `src/data/` files. Each domain has a corresponding API service with a mock branch. Page components now use `useEffect` hooks to fetch data via service functions in both mock and API modes.

---

## ~~7. Type Inconsistencies (Duplicate Message Interface)~~ ✅ RESOLVED
**Resolved**: March 15, 2026

- Duplicate `Message` interface removed from `src/types/user.ts`
- `user.ts` now imports `Message` from `chat.ts`
- `chat.ts` is the single source of truth for `Message`, `ChatDto`, `MessageDto` (type aliases), and `PrivateChatWithUser`

---

## ~~9. No User-Visible Error Handling~~ ✅ RESOLVED
**Resolved**: March 14, 2026

**What was implemented**:
- `src/lib/apiError.ts` — `showApiError(err, fallback)` helper: extracts `err.error.message` from ApiResponse shape, falls back to `Error.message`, then the fallback string, and calls `toast.error()`
- `<Sonner position="bottom-center" richColors />` added to `App.tsx`
- Auth actions: `toast.success('Welcome back!')` on login, `toast.success('Account created! Check your email to verify.')` on register
- Profile save: `toast.success('Profile updated')` on success; `showApiError` on failure
- Logout: `showApiError(err, 'Logout failed')`
- Forum replies: `toast.success('Reply posted')` on success; `showApiError` on failure

---

## ~~10. No Validation on Forms~~ ✅ RESOLVED
**Resolved**: March 14, 2026

**What was implemented** — `src/lib/validators.ts` contains all Zod schemas:
- `loginSchema` — email (valid format), password (non-empty)
- `registerSchema` — email, password (≥8 chars + uppercase + lowercase + digit + special char), name, age (18–99 int), location, gender, bio (optional, max 500 chars)
- `profileEditSchema` — name, age (18–99), location, bio (optional, max 500 chars)
- `messageSchema` — content (non-empty after trim, max 2000 chars)
- `replySchema` — content (non-empty after trim, max 5000 chars)

**Forms migrated to `useForm<T>` + `zodResolver`**:
- `Welcome.tsx` — login + register
- `SettingsPage.tsx` — profile edit
- `TopicDetail.tsx` — forum reply

---

## ~~17. Incomplete Docker Configuration~~ ✅ RESOLVED
**Resolved**: February 23, 2026

Full stack deployed on Azure VM (`http://20.153.164.3:8080`).

**Key details**:
- nginx proxies `/api/` and `/swagger` to the backend container — only port 8080 needs to be exposed
- `VITE_API_BASE_URL` is baked into the frontend bundle at build time
- Backend reads `USE_AZURE_STORAGE` and `AZURE_STORAGE_CONNECTION_STRING` from `../../lovecraft/Lovecraft/.env` via `env_file`

```bash
# From aloevera-harmony-meet/
docker compose up --build -d
```

---

## 📝 Changelog

- **March 16, 2026** — Archive created. Issues #1, #2, #3, #5, #6, #7, #9, #10, #17 moved here from `ISSUES.md`.
```

- [ ] **Step 3: Verify the file was created and has all 9 issues**

Check that the file exists and contains headings for all resolved issues:
```
grep "## ~~" docs/RESOLVED_ISSUES.md
```
Expected output (9 lines):
```
## ~~1. Pages Not Connected to Backend API~~ ✅ RESOLVED
## ~~2. AuthContext Not Implemented...~~ ✅ RESOLVED
## ~~3. No Data Persistence...~~ ✅ RESOLVED
## ~~5. No Testing Framework~~ ✅ RESOLVED
## ~~6. Mock Data Embedded...~~ ✅ RESOLVED
## ~~7. Type Inconsistencies...~~ ✅ RESOLVED
## ~~9. No User-Visible Error Handling~~ ✅ RESOLVED
## ~~10. No Validation on Forms~~ ✅ RESOLVED
## ~~17. Incomplete Docker Configuration~~ ✅ RESOLVED
```

- [ ] **Step 4: Commit**

```bash
git add docs/RESOLVED_ISSUES.md
git commit -m "docs: create RESOLVED_ISSUES.md archive with 9 resolved issues"
```

---

## Chunk 2: Rewrite ISSUES.md

### Task 2: Rewrite `docs/ISSUES.md`

**Files:**
- Modify: `docs/ISSUES.md` (full rewrite)

- [ ] **Step 1: Verify the current state before editing**

Count current open issues (should be 16: #4, #8, #11–#16, #18–#25):
```
grep "^### [0-9]" docs/ISSUES.md | grep -v "~~"
```
Confirm the file is 529 lines:
```
wc -l docs/ISSUES.md
```

- [ ] **Step 2: Overwrite `docs/ISSUES.md` with the new content**

Write the entire file as follows:

```markdown
# Known Issues & Technical Debt

**Last Updated**: March 16, 2026
**Active issues only.** Resolved issues are archived in [RESOLVED_ISSUES.md](./RESOLVED_ISSUES.md).

---

## 🔴 Production Blockers

These issues must be resolved before the app serves real users.

### 26. Email Service Missing
**Impact**: Account recovery impossible; password reset non-functional

Email verification tokens are logged to the console only. Because `registerSchema` enforces a valid email address (treating email as first-class identity), email verification and account recovery must work at launch. Users who lose their password have no recourse.

**Resolution**: Integrate SMTP or SendGrid in `Lovecraft.Backend`. Wire `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` to send real emails. See `docs/AUTHENTICATION.md` in the backend repo.

---

### 27. No HTTPS on Azure VM
**Impact**: JWT tokens and credentials travel in plaintext

All traffic between the browser and the Azure VM is unencrypted. JWT tokens stored in `localStorage` are readable in transit.

**Resolution**: Obtain an SSL certificate (Let's Encrypt / Certbot) and update `nginx.conf` in the frontend repo to serve HTTPS on port 443. Redirect HTTP → HTTPS.

---

### 28. No Rate Limiting on Auth Endpoints
**Impact**: Brute-force login attacks unprotected

`/api/v1/auth/login`, `/api/v1/auth/register`, and `/api/v1/auth/forgot-password` have no rate limiting. Attackers can make unlimited requests.

**Resolution**: Add ASP.NET Core rate limiting middleware (built-in in .NET 7+) in `Lovecraft.Backend/Program.cs`. Target: 5 login attempts per 15 minutes per IP.

---

### 29. No Account Lockout
**Impact**: Unlimited failed login attempts with no lockout

There is no tracking of failed login attempts and no temporary lockout mechanism.

**Resolution**: Add failed-attempt counting to `MockAuthService` / `AzureAuthService`. Lock account for 15 minutes after 10 consecutive failures. See `docs/AUTHENTICATION.md` in the backend repo.

---

### 30. No Input Sanitization on User-Generated Content
**Impact**: XSS risk when rich text rendering is introduced

Forum replies, chat messages, and bio fields are stored without sanitisation. React escapes plain string output by default, so the XSS surface is limited today — but this becomes a direct vulnerability when rich text rendering (#40) is implemented. Sanitisation must be in place before that feature ships.

**Resolution**: Add server-side HTML sanitisation (e.g. HtmlSanitizer NuGet package) to `ForumService.CreateReplyAsync`, `ChatService.SendMessageAsync`, and `UserService.UpdateUserAsync` (bio field) in the backend.

---

## 🟠 Missing Core Features

### 15. Desktop Navigation *(escalated from UX/Polish)*
**Impact**: App is functionally unusable on desktop viewports

Bottom navigation is mobile-only. No navigation element exists on large screens. Desktop users have no way to switch between pages.

**Resolution**: Add a sidebar or top navigation bar that is visible at `md:` breakpoints and above. Follow existing design system colours and active-state patterns from `src/components/ui/bottom-navigation.tsx`.

---

### 31. Forum Topic Creation
**Impact**: Community feature is read-only for new content

Users can only reply to existing topics. There is no UI, no `forumsApi.createTopic()` method, and no backend endpoint for creating new topics. The entire forum is seeded-only content.

**Resolution**:
- Backend: Add `POST /api/v1/forum/sections/{sectionId}/topics` endpoint to `ForumController` and `IForumService`
- Frontend: Add `forumsApi.createTopic(sectionId, title, content)` to `src/services/api/forumsApi.ts`
- UI: Add a "New Topic" button and form to the topic list view in `src/pages/Talks.tsx`

---

### 32. Profile Image Upload
**Impact**: Users cannot set their own profile photo

Profile images are hardcoded Unsplash URLs. Azure Blob Storage is not integrated. `UserDto.profileImage` is always an external URL.

**Resolution**:
- Backend: Integrate Azure Blob Storage. Add `POST /api/v1/users/{id}/images` endpoint. Store blob URL in `UserEntity`.
- Frontend: Add file input to the profile edit form in `src/pages/SettingsPage.tsx`. Call new upload endpoint. Display uploaded image preview.

---

### 33. Notification System
**Impact**: No engagement hooks — users are never informed of new activity

There are no notifications for: new match, received like, reply to a forum post you authored, new message. Users must manually refresh to discover activity.

**Resolution**: Design notification model (type, userId, payload, read flag). Implement `GET /api/v1/notifications` and `POST /api/v1/notifications/{id}/read` endpoints. Push new notifications via SignalR `ChatHub` as a `NotificationReceived` server event. Add notification bell UI to the header.

---

### 34. Songs Backend Endpoint
**Impact**: Favorite songs on user profiles are disconnected from real data

`src/services/api/songsApi.ts` always returns mock data regardless of `VITE_API_MODE`. There is no backend endpoint for songs.

**Resolution**: Add `GET /api/v1/songs` endpoint to the backend. Implement `MockSongService` and `AzureSongService`. Update `songsApi.ts` to call the real endpoint in API mode.

---

### 35. Pagination on List Views
**Impact**: All list views load full datasets; will degrade at scale

Events, blog posts, forum topics, store items, and user search results all fetch everything at once. No `page`/`pageSize` parameters are used on the frontend.

**Resolution**: Add `?page=&pageSize=` query parameters to all list API calls. Use the existing `PagedResult<T>` model already defined in `Lovecraft.Common`. Implement "Load more" buttons or infinite scroll on each list view.

---

### 36. Advanced User Search & Filtering
**Impact**: User discovery has no filters; swipe deck shows all users

User preferences (age range, gender, location) exist in `UserPreferencesDto` and `SettingsPage.tsx` but are not sent to or honoured by `GET /api/v1/users`. The matching swipe deck shows every user regardless of preferences.

**Resolution**:
- Backend: Add filter parameters to `GET /api/v1/users` (`?country=&city=&minAge=&maxAge=&gender=&eventId=`)
- Frontend: Pass the current user's preferences when calling `usersApi.getUsers()` in `src/pages/Friends.tsx`
- UI: Add a filter sheet/drawer accessible from the Search tab header

---

### 37. Anonymous Likes
**Impact**: Core privacy feature absent from the matching system

Currently all likes are visible to the recipient. A user sending an anonymous like has their identity stored in the system but not surfaced to the recipient. The sender is revealed only when the recipient also sends a like, creating a mutual (non-anonymous) match.

**Resolution**:
- Backend: Add `isAnonymous: boolean` to `CreateLikeRequestDto` and `LikeEntity`. Update `GET /api/v1/matching/likes/received` to omit sender details when `isAnonymous = true`
- Frontend: Add an "Anonymous" toggle to the like action in `src/pages/Friends.tsx`

---

### 38. Event Sub-Groups
**Impact**: No way to organise attendees into sub-groups within an event

For events like yachting trips, attendees may be split into boats or other groups. Each group needs its own forum topic and roster, while remaining transparent — all event attendees can see and interact with all sub-groups.

**Resolution**:
- Backend: Add `EventSubGroup` entity and table. Add `POST /api/v1/events/{id}/subgroups`, `GET /api/v1/events/{id}/subgroups`, `POST /api/v1/events/{id}/subgroups/{groupId}/members` endpoints
- Frontend: Show sub-group tabs on `src/pages/EventDetails.tsx`. Each sub-group links to its own forum topic (using the existing `forumTopicId` pattern from `EventDto`)

---

### 39. Gated Registration via Access Codes
**Impact**: No way to restrict who can create accounts

When enabled, only users with a valid access code can complete registration. Codes are time-limited and distributed at real-world events (printed QR codes or short keywords). Controlled via the admin panel (#45).

**Resolution**:
- Backend: Add `AccessCode` entity and table. Add `POST /api/v1/admin/access-codes` (create), `GET /api/v1/admin/access-codes` (list), `POST /api/v1/auth/validate-code` (validate before registration). Check for valid code during `RegisterAsync` when gating is enabled via feature flag
- Frontend: Add optional access code field to the registration form in `src/pages/Welcome.tsx`

---

### 40. Rich Text and Media in Forum & Chat
**Impact**: Forum posts and messages are plain text only; no images or formatting

Users cannot bold text, create lists, or attach images in forum replies or private messages. This is a baseline expectation for a community platform.

**Resolution**:
- Choose a rich text editor (e.g. TipTap or Quill) for the frontend
- Replace the plain `<textarea>` in `src/components/forum/TopicDetail.tsx` and the message input in `src/pages/Friends.tsx` with the editor component
- Backend: Store content as HTML or a safe subset (Markdown). Apply server-side sanitisation (see #30) before storage
- Add image upload support via Azure Blob Storage (see #32)

---

### 41. Ranking & Badges System
**Impact**: Community engagement has no visible progression or recognition

Active users receive no visible acknowledgement for their participation. No ranks, no badges, no profile distinction between a new user and a long-term community member.

**Proposed tiers**: Novice → Active Member → Friend of Aloe → Aloe Crew (criteria: forum post count, match count, likes received, events attended)

**Resolution**:
- Backend: Add rank computation logic to `UserService`. Expose `rank` and `badgeCount` on `UserDto`
- Frontend: Display rank badge on profile cards in `src/pages/Friends.tsx` and in `src/pages/SettingsPage.tsx`

---

### 42. Event Group Chat (Real Implementation)
**Impact**: Event discussions are routed through a forum topic workaround, not a real group chat

`src/pages/Talks.tsx` event chat tab uses a forum topic as a group chat proxy. This produces a poor UX (forum reply format instead of chat bubbles) and limits real-time features.

**Resolution**: Implement proper multi-participant group chat per event using the existing `ChatHub` SignalR infrastructure. Add a `type: 'event'` chat variant alongside the existing `private` type. Auto-create an event group chat when a new event is created (similar to how mutual likes auto-create a 1-on-1 chat).

---

### 43. Public Metrics Dashboard
**Impact**: No visibility into platform activity for users

Users have no way to see how active the platform is — total members, who is online, recent sign-ups.

**Resolution**:
- Backend: Add `GET /api/v1/stats` endpoint returning `{ totalUsers, onlineUsers, recentRegistrations[] }`
- Frontend: Add a stats widget to the main AloeVera or Welcome page

---

### 44. AI Content Moderation
**Impact**: No automated protection against spam or inappropriate content

Forum posts and chat messages are not screened. A single bad actor can flood the platform before a moderator notices.

**Resolution**: Integrate an AI moderation API (e.g. OpenAI Moderation, Azure Content Safety) at the point of content creation in the backend (`ForumService.CreateReplyAsync`, `ChatService.SendMessageAsync`). Flag content above a configurable threshold. Route flagged content to the admin panel (#45) for human review rather than blocking automatically.

---

### 45. Admin & Moderator Panel
**Impact**: No interface for managing the platform — feature flags, user blocking, content removal

There is no admin interface. A rogue user or spammer can only be stopped by directly modifying the database. Feature flags (e.g. gated registration from #39) have no toggle UI.

**Scope**:
- Feature flag management (enable/disable gated registration, maintenance mode, etc.)
- User management: view, block, unblock accounts
- Content management: delete forum posts and replies, clear chat messages
- Access code management (for #39)
- AI moderation review queue (for #44)
- Platform metrics view (for #43)

**Architecture note**: Consider a separate web application (`@aloevera-admin/`) with its own authentication (admin-only JWT role) for security isolation. Alternatively, add admin routes to the existing frontend behind a role check.

---

### 46. Telegram Mini App
**Impact**: Users who prefer Telegram have no native way to access the platform

A Telegram Mini App would let users interact with AloeVera Harmony Meet without leaving Telegram. Planned as a separate repository (`@aloevera-telegram-bot/`).

**Dependencies**: Telegram bot authentication on the backend (see `@lovecraft/Lovecraft/docs/AUTHENTICATION.md` — Phase 3, not yet implemented).

*Note: significant scope — separate project and repository.*

---

### 47. aloeband.ru Scraper
**Impact**: Events and store items require manual data entry; may fall out of sync with the official site

Upcoming concerts, events, and merchandise listed on `aloeband.ru` are not automatically reflected in the app. App events and store items should include a forward link to the official site for ticket and merchandise purchases.

**Resolution**: Build a scheduled scraper (Azure Function or cron job) that fetches `aloeband.ru`, parses event and store listings, and upserts them into the backend via the existing `EventService` and `StoreService`. Add `externalUrl` field to `EventDto` and `StoreItemDto`.

*Note: significant scope — depends on the structure of `aloeband.ru` and may require maintenance as the site changes.*

---

## 🟡 Technical Debt & Infrastructure

### 4. Loose TypeScript Configuration
**Impact**: Type safety compromised; potential runtime errors

Current `tsconfig.json` has `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`.

**Resolution**: Gradually enable strict mode. Start with `"strictNullChecks": true` as it catches the most bugs. Fix resulting type errors incrementally. Target: `"strict": true` with all errors resolved.

---

### 8. Incomplete Internationalization
**Impact**: Non-Russian speakers see untranslated UI

Many strings are hardcoded in Russian instead of using `t()` from `src/contexts/LanguageContext.tsx`. Affected areas: forum section names, store categories, event categories, chat placeholders, system messages.

**Resolution**: Audit all components for hardcoded Russian strings. Add keys to both `ru` and `en` translation objects in `LanguageContext.tsx`. Replace hardcoded strings with `{t('key')}`.

---

### 12. No Global State Management Strategy
**Impact**: State cannot be shared between pages; TanStack Query is configured but unused

User profile, auth state, match/like counts, and cart state are all managed in local component state and cannot be shared across routes.

**Resolution**: Adopt TanStack React Query (already installed) for all server state — replace `useEffect` + `useState` data-fetching patterns page by page. Consider Zustand for client-only global state (e.g. current user identity). Keep `LanguageContext` as-is.

---

### 48. No React Error Boundaries
**Impact**: Any unhandled component error crashes the entire app with a blank screen

There are no `ErrorBoundary` components anywhere in the React tree. A runtime error in any component unmounts the full UI.

**Resolution**: Add an `ErrorBoundary` component wrapping the main `<App />` in `src/main.tsx` and additional boundaries around each major page section. Display a user-friendly fallback UI with a "Reload" button.

---

### 49. No Structured Logging or Monitoring in Production
**Impact**: Impossible to diagnose issues after deployment; no alerting

The backend has no Serilog output configured for production and no Application Insights integration. There is no frontend error tracking (Sentry or equivalent).

**Resolution**:
- Backend: Add Serilog with structured JSON output to stdout (captured by Docker). Add Azure Application Insights SDK
- Frontend: Add Sentry SDK (`@sentry/react`). Capture unhandled exceptions and API errors

---

### 50. No CI/CD Pipeline
**Impact**: Tests are never run automatically; deployment is fully manual

There are no GitHub Actions (or equivalent) workflows. A breaking change can be pushed to the repo without any automated gate. Deployment requires SSH-ing into the Azure VM and running `docker compose up --build` manually.

**Resolution**:
- Add GitHub Actions workflow: run `npm run test:run` (frontend) and `dotnet test` (backend) on every push and PR
- Add deployment workflow: on merge to `main`, SSH to the Azure VM and run `docker compose up --build -d`

---

### 51. `localStorage` Token Security
**Impact**: Access tokens in `localStorage` are readable by any JavaScript on the page

Storing the access token in `localStorage` is vulnerable to XSS. The more secure pattern is: access token in memory (React state/context), refresh token in an HttpOnly cookie.

**Dependency**: Requires #27 (HTTPS) to be resolved first — the `Secure` cookie flag only works over HTTPS. The backend already supports the HttpOnly cookie flow conditionally on `Request.IsHttps`.

**Resolution**: After #27 is resolved, move `access_token` out of `localStorage` and into a React context (or Zustand store). The refresh flow in `apiClient.ts` continues to work — it reads from the context instead of `localStorage`.

---

## 🟢 UX / Polish

### 11. Accessibility Issues
**Impact**: Users with disabilities, SEO

Missing semantic HTML, ARIA labels, keyboard navigation support, focus management, alt text on some images.

**Resolution**: Audit with `axe` browser extension. Add ARIA attributes, semantic elements, and keyboard navigation. Test with a screen reader.

---

### 13. Swipe Functionality Incomplete
**Impact**: Core dating feature UX

`src/components/ui/swipe-card.tsx` exists but swipe gestures may not be smooth on all devices, there is no animation feedback, and no undo.

**Resolution**: Test gesture handling on iOS and Android. Add CSS transition animations for swipe direction. Add an "undo" button that restores the last-passed profile.

---

### 14. Image Handling Issues
**Impact**: Performance, UX

All images are external Unsplash URLs. No lazy loading, no optimisation, no unique images per user.

**Resolution**: Once #32 (profile image upload) is resolved, migrate to user-uploaded images. Add `loading="lazy"` to all `<img>` elements. Add skeleton loaders.

---

### 16. package.json Name Mismatch
**Impact**: Project identity confusion

`package.json` has `"name": "vite_react_shadcn_ts"` (default template name).

**Resolution**: Change to `"name": "aloevera-harmony-meet"`.

---

### 18. No .env.example File
**Impact**: New developers don't know which environment variables are required

**Resolution**: Add `.env.example` listing all required `VITE_*` variables with placeholder values. Commit it. Keep `.env.development` and `.env.production` in `.gitignore`.

---

### 19. Unused Dependencies
**Impact**: Bundle size, maintenance overhead

Unused packages: `recharts` (no charts), `next-themes` (dark mode not implemented), `react-resizable-panels`, `vaul`, `cmdk`.

**Resolution**: Remove unused packages with `npm uninstall <package>`. Exception: keep `@tanstack/react-query` — it will be used when #12 is addressed.

---

### 20. No Analytics or Monitoring
**Impact**: No business insights

No analytics (GA, Mixpanel), no error tracking (Sentry), no performance monitoring.

**Resolution**: Add analytics when there are real users. Add Sentry for error tracking (see #49 — handled together with structured logging).

---

### 21. No PWA Support
**Impact**: Mobile experience, offline functionality

No service worker, no offline support, no install prompt.

**Resolution**: Add `vite-plugin-pwa`. Configure a service worker that caches the app shell. Add a Web App Manifest.

---

### 22. Inconsistent Date Formatting
**Impact**: Code inconsistency, maintenance

Date formatting is duplicated across `Friends.tsx` (`formatDateShort`, `formatTime`, `formatChatDate`) and `AloeVera.tsx` (`formatDate`, `formatBlogDate`).

**Resolution**: Create `src/lib/dates.ts` with shared formatting functions using `date-fns`. Import and replace inline formatters.

---

### 23. Missing SEO Metadata
**Impact**: SEO, social sharing

`index.html` has no Open Graph tags, no Twitter Card tags, generic title/description, no structured data.

**Resolution**: Add `<meta property="og:*">` and `<meta name="twitter:*">` tags to `index.html`. Consider `react-helmet-async` for per-route metadata.

---

### 24. No Content Moderation UI Placeholder
**Impact**: No user-facing reporting mechanism

Users cannot report another user or flag a forum post. Only admin-side moderation (#45) is planned.

**Resolution**: Add a "Report" option to user cards and forum posts. Store reports in a backend table. Surface in the admin panel (#45).

---

### 25. Event Postmark Component Underutilised
**Impact**: Visual design opportunity missed

`src/components/ui/event-postmark.tsx` is only shown on event cards in `AloeVera.tsx`. It could serve as a collectible stamp on user profiles showing events attended.

**Resolution**: Display event postmarks on the user profile in `SettingsPage.tsx` and on user cards in `Friends.tsx` (for events the viewed user attended).

---

## 📊 Summary

| Section | Count |
|---|---|
| 🔴 Production Blockers | 5 |
| 🟠 Missing Core Features | 18 |
| 🟡 Technical Debt & Infrastructure | 7 |
| 🟢 UX / Polish | 12 |
| **Total active** | **42** |
| ✅ Resolved (see [RESOLVED_ISSUES.md](./RESOLVED_ISSUES.md)) | 9 |

---

## 📝 Changelog

**March 16, 2026** — Full restructure. Switched from severity-based to type-based sections. Resolved issues (#1, #2, #3, #5, #6, #7, #9, #10, #17) moved to `RESOLVED_ISSUES.md`. Added new issues from audit: production blockers (#26–#30), missing core features (#31–#47), tech debt (#48–#51). Escalated #15 (desktop navigation) from UX/Polish to Missing Core Features. Removed "Recommended Priority Order" section — section ordering communicates priority.

**March 15, 2026** — Issues #5 (testing) and #7 (duplicate Message interface) resolved. Chat REST + SignalR implemented.

**March 14, 2026** — Issues #9 (error handling) and #10 (form validation) resolved.

**February 23, 2026** — Issue #3 (data persistence / Azure Storage) and #17 (Docker) resolved.

**February 19, 2026** — Issues #1 (pages wired to backend), #2 (auth token storage), and #6 (mock data centralized) resolved.
```

- [ ] **Step 3: Verify the new ISSUES.md structure**

Check all 4 section headings exist:
```
grep "^## " docs/ISSUES.md
```
Expected:
```
## 🔴 Production Blockers
## 🟠 Missing Core Features
## 🟡 Technical Debt & Infrastructure
## 🟢 UX / Polish
## 📊 Summary
## 📝 Changelog
```

Count active issues (should be 42):
```
grep "^### " docs/ISSUES.md | wc -l
```

Confirm no resolved issues remain (no `✅ RESOLVED` headings):
```
grep "RESOLVED" docs/ISSUES.md
```
Expected: only the summary table line and changelog references. No issue headings with `RESOLVED`.

- [ ] **Step 4: Commit**

```bash
git add docs/ISSUES.md
git commit -m "docs: restructure ISSUES.md with type-based sections and 27 new issues"
```

---

## Chunk 3: Update AGENTS.md

### Task 3: Update `AGENTS.md` to reference both documentation files

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Locate the two references to update**

Find the current references:
```
grep -n "ISSUES.md" AGENTS.md
```
Expected matches on approximately:
- Line 74: directory listing in the `docs/` section
- Line 460: the "Known Issues" section

- [ ] **Step 2: Update the directory listing (around line 74)**

Find this line:
```
│   └── ISSUES.md           # Known issues and technical debt
```

Replace with:
```
│   ├── ISSUES.md           # Active issues and technical debt
│   └── RESOLVED_ISSUES.md  # Archive of resolved issues
```

- [ ] **Step 3: Update the Known Issues section reference (around line 460)**

Find this line:
```
**See [docs/ISSUES.md](./docs/ISSUES.md) for complete list.**
```

Replace with:
```
**See [docs/ISSUES.md](./docs/ISSUES.md) for active issues. Resolved issues are archived in [docs/RESOLVED_ISSUES.md](./docs/RESOLVED_ISSUES.md).**
```

- [ ] **Step 4: Verify the changes**

```
grep -n "RESOLVED_ISSUES" AGENTS.md
```
Expected: 2 matches — one in the directory listing, one in the Known Issues section.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md to reference RESOLVED_ISSUES.md"
```

---

## Final Verification

- [ ] **Confirm all three files are in their expected state**

```bash
# RESOLVED_ISSUES.md exists with 9 resolved issues
grep -c "## ~~" docs/RESOLVED_ISSUES.md
# Expected: 9

# ISSUES.md has 4 active sections
grep "^## " docs/ISSUES.md
# Expected: 6 lines (4 sections + Summary + Changelog)

# AGENTS.md references both files
grep "RESOLVED_ISSUES" AGENTS.md | wc -l
# Expected: 2
```

- [ ] **Final commit (if not already done per-task)**

```bash
git log --oneline -5
```
Expected: 3 commits visible — one per task above.
