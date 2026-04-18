# Known Issues & Technical Debt

**Last Updated**: April 18, 2026
**Active issues only.** Resolved issues are archived in [RESOLVED_ISSUES.md](./RESOLVED_ISSUES.md).

---

## 🔴 Production Blockers

These issues must be resolved before the app serves real users.

### PB.4. No Account Lockout
**Impact**: Unlimited failed login attempts with no lockout

There is no tracking of failed login attempts and no temporary lockout mechanism.

**Resolution**: Add failed-attempt counting to `MockAuthService` / `AzureAuthService`. Lock account for 15 minutes after 10 consecutive failures. See `docs/AUTHENTICATION.md` in the backend repo.

---

## 🟠 Missing Core Features

### MCF.1. Desktop Navigation *(escalated from UX/Polish)*
**Impact**: App is functionally unusable on desktop viewports

Bottom navigation is mobile-only. No navigation element exists on large screens. Desktop users have no way to switch between pages.

**Resolution**: Add a sidebar or top navigation bar that is visible at `md:` breakpoints and above. Follow existing design system colours and active-state patterns from `src/components/ui/bottom-navigation.tsx`.

---

### MCF.4. Notification System
**Impact**: No engagement hooks — users are never informed of new activity

There are no notifications for: new match, received like, reply to a forum post you authored, new message. Users must manually refresh to discover activity.

**Resolution**: Design notification model (type, userId, payload, read flag). Implement `GET /api/v1/notifications` and `POST /api/v1/notifications/{id}/read` endpoints. Push new notifications via SignalR `ChatHub` as a `NotificationReceived` server event. Add notification bell UI to the header.

---

### MCF.5. Songs Backend Endpoint
**Impact**: Favorite songs on user profiles are disconnected from real data

`src/services/api/songsApi.ts` always returns mock data regardless of `VITE_API_MODE`. There is no backend endpoint for songs.

**Resolution**: Add `GET /api/v1/songs` endpoint to the backend. Implement `MockSongService` and `AzureSongService`. Update `songsApi.ts` to call the real endpoint in API mode.

---

### MCF.6. Pagination on List Views
**Impact**: All list views load full datasets; will degrade at scale

Events, blog posts, forum topics, store items, and user search results all fetch everything at once. No `page`/`pageSize` parameters are used on the frontend.

**Resolution**: Add `?page=&pageSize=` query parameters to all list API calls. Use the existing `PagedResult<T>` model already defined in `Lovecraft.Common`. Implement "Load more" buttons or infinite scroll on each list view.

---

### MCF.7. Advanced User Search & Filtering
**Impact**: User discovery has no filters; swipe deck shows all users

User preferences (age range, gender, location) exist in `UserPreferencesDto` and `SettingsPage.tsx` but are not sent to or honoured by `GET /api/v1/users`. The matching swipe deck shows every user regardless of preferences.

**Resolution**:
- Backend: Add filter parameters to `GET /api/v1/users` (`?country=&city=&minAge=&maxAge=&gender=&eventId=`)
- Frontend: Pass the current user's preferences when calling `usersApi.getUsers()` in `src/pages/Friends.tsx`
- UI: Add a filter sheet/drawer accessible from the Search tab header

---

### MCF.8. Anonymous Likes
**Impact**: Core privacy feature absent from the matching system

Currently all likes are visible to the recipient. A user sending an anonymous like has their identity stored in the system but not surfaced to the recipient. The sender is revealed only when the recipient also sends a like, creating a mutual (non-anonymous) match.

**Resolution**:
- Backend: Add `isAnonymous: boolean` to `CreateLikeRequestDto` and `LikeEntity`. Update `GET /api/v1/matching/likes/received` to omit sender details when `isAnonymous = true`
- Frontend: Add an "Anonymous" toggle to the like action in `src/pages/Friends.tsx`

---

### MCF.9. Event Sub-Groups
**Impact**: No way to organise attendees into sub-groups within an event

For events like yachting trips, attendees may be split into boats or other groups. Each group needs its own forum topic and roster, while remaining transparent — all event attendees can see and interact with all sub-groups.

**Resolution**:
- Backend: Add `EventSubGroup` entity and table. Add `POST /api/v1/events/{id}/subgroups`, `GET /api/v1/events/{id}/subgroups`, `POST /api/v1/events/{id}/subgroups/{groupId}/members` endpoints
- Frontend: Show sub-group tabs on `src/pages/EventDetails.tsx`. Each sub-group links to its own forum topic (using the existing `forumTopicId` pattern from `EventDto`)

---

### MCF.12. Ranking & Badges System (partially resolved — rank & badge system shipped)
**Impact**: Community engagement has no visible progression or recognition

Active users receive no visible acknowledgement for their participation. No ranks, no badges, no profile distinction between a new user and a long-term community member.

**Proposed tiers**: Novice → Active Member → Friend of Aloe → Aloe Crew (criteria: forum post count, match count, likes received, events attended)

**Resolution**:
- ✅ Backend: `UserService.GetUserByIdAsync` returns computed `rank` on `UserDto` (derived from activity counters against thresholds in the `appconfig` table)
- ✅ Backend: `StaffRole` exposed on `UserDto` and embedded as JWT claim
- ✅ Frontend: `<UserBadges rank staffRole />` in `src/components/ui/user-badges.tsx` — rendered on forum replies, profile, swipe cards, and chat list items
- ⏳ Future: automated rank-up notifications; admin UI for threshold tuning (tracked under MCF.16)

---

### MCF.13. Event Group Chat (Real Implementation)
**Impact**: Event discussions are routed through a forum topic workaround, not a real group chat

`src/pages/Talks.tsx` event chat tab uses a forum topic as a group chat proxy. This produces a poor UX (forum reply format instead of chat bubbles) and limits real-time features.

**Resolution**: Implement proper multi-participant group chat per event using the existing `ChatHub` SignalR infrastructure. Add a `type: 'event'` chat variant alongside the existing `private` type. Auto-create an event group chat when a new event is created (similar to how mutual likes auto-create a 1-on-1 chat).

---

### MCF.14. Public Metrics Dashboard
**Impact**: No visibility into platform activity for users

Users have no way to see how active the platform is — total members, who is online, recent sign-ups.

**Resolution**:
- Backend: Add `GET /api/v1/stats` endpoint returning `{ totalUsers, onlineUsers, recentRegistrations[] }`
- Frontend: Add a stats widget to the main AloeVera or Welcome page

---

### MCF.15. AI Content Moderation
**Impact**: No automated protection against spam or inappropriate content

Forum posts and chat messages are not screened. A single bad actor can flood the platform before a moderator notices.

**Resolution**: Integrate an AI moderation API (e.g. OpenAI Moderation, Azure Content Safety) at the point of content creation in the backend (`ForumService.CreateReplyAsync`, `ChatService.SendMessageAsync`). Flag content above a configurable threshold. Route flagged content to the admin panel (MCF.16) for human review rather than blocking automatically.

---

### MCF.16. Admin & Moderator Panel *(partial — scaffold exists)*
**Impact**: Platform management is incomplete — feature flags, user blocking, content removal not yet available

A basic admin shell exists (`admin.html` → `src/admin/`, routes at `/admin/login`, `/admin/users`, `/admin/config`). It covers user listing, staff role assignment, rank overrides, and read-only `appconfig` view. The following scope items remain unimplemented:

- ❌ Feature flag management (enable/disable gated registration, maintenance mode via UI)
- ❌ User blocking/unblocking (block flag on `UserEntity` not implemented)
- ❌ Content management: delete forum posts and replies, clear chat messages
- ❌ AI moderation review queue (for MCF.15)
- ❌ Platform metrics view (for MCF.14)

**Resolution**: Extend the existing admin shell. Add block/unblock to `UsersController` + `AdminUsersPage`. Add content management endpoints to `ForumController` / `ChatsController` and corresponding admin pages.

---

### MCF.17. Telegram Mini App
**Impact**: Users who prefer Telegram have no native way to access the platform

A Telegram Mini App would let users interact with AloeVera Harmony Meet without leaving Telegram. Planned as a separate repository (`@aloevera-telegram-bot/`).

**Dependencies**: Telegram bot authentication on the backend (see `@lovecraft/Lovecraft/docs/AUTHENTICATION.md` — Phase 3, not yet implemented).

*Note: significant scope — separate project and repository.*

---

### MCF.18. aloeband.ru Scraper
**Impact**: Events and store items require manual data entry; may fall out of sync with the official site

Upcoming concerts, events, and merchandise listed on `aloeband.ru` are not automatically reflected in the app. App events and store items should include a forward link to the official site for ticket and merchandise purchases.

**Resolution**: Build a scheduled scraper (Azure Function or cron job) that fetches `aloeband.ru`, parses event and store listings, and upserts them into the backend via the existing `EventService` and `StoreService`. Add `externalUrl` field to `EventDto` and `StoreItemDto`.

*Note: significant scope — depends on the structure of `aloeband.ru` and may require maintenance as the site changes.*

---

## 🟡 Technical Debt & Infrastructure

### TD.1. Loose TypeScript Configuration
**Impact**: Type safety compromised; potential runtime errors

Current `tsconfig.json` has `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`.

**Resolution**: Gradually enable strict mode. Start with `"strictNullChecks": true` as it catches the most bugs. Fix resulting type errors incrementally. Target: `"strict": true` with all errors resolved.

---

### TD.2. Incomplete Internationalization
**Impact**: Non-Russian speakers see untranslated UI

Many strings are hardcoded in Russian instead of using `t()` from `src/contexts/LanguageContext.tsx`. Affected areas: forum section names, store categories, event categories, chat placeholders, system messages.

**Resolution**: Audit all components for hardcoded Russian strings. Add keys to both `ru` and `en` translation objects in `LanguageContext.tsx`. Replace hardcoded strings with `{t('key')}`.

---

### TD.3. No Global State Management Strategy
**Impact**: State cannot be shared between pages; TanStack Query is configured but unused

User profile, auth state, match/like counts, and cart state are all managed in local component state and cannot be shared across routes.

**Resolution**: Adopt TanStack React Query (already installed) for all server state — replace `useEffect` + `useState` data-fetching patterns page by page. Consider Zustand for client-only global state (e.g. current user identity). Keep `LanguageContext` as-is.

---

### TD.4. No React Error Boundaries
**Impact**: Any unhandled component error crashes the entire app with a blank screen

There are no `ErrorBoundary` components anywhere in the React tree. A runtime error in any component unmounts the full UI.

**Resolution**: Add an `ErrorBoundary` component wrapping the main `<App />` in `src/main.tsx` and additional boundaries around each major page section. Display a user-friendly fallback UI with a "Reload" button.

---

### TD.5. No Structured Logging or Monitoring in Production
**Impact**: Impossible to diagnose issues after deployment; no alerting

The backend has no Serilog output configured for production and no Application Insights integration. There is no frontend error tracking (Sentry or equivalent).

**Resolution**:
- Backend: Add Serilog with structured JSON output to stdout (captured by Docker). Add Azure Application Insights SDK
- Frontend: Add Sentry SDK (`@sentry/react`). Capture unhandled exceptions and API errors

---

### TD.6. No CI/CD Pipeline *(partial — backend CI exists)*
**Impact**: Frontend tests never run automatically; deployment is fully manual

The backend (`@lovecraft/`) has a GitHub Actions workflow (`.github/workflows/dotnet-desktop.yml`) that runs `dotnet build` + `dotnet test` on every push and PR to `main`. The frontend has no CI workflow and deployment requires SSH-ing into the Azure VM manually.

**Resolution**:
- Add GitHub Actions workflow to `@aloevera-harmony-meet`: run `npm run test:run` on every push and PR
- Add deployment workflow: on merge to `main`, SSH to the Azure VM and run `docker compose up --build -d`

---

### TD.8. Blob Storage Images Are Publicly Accessible
**Impact**: Any image URL can be downloaded by an unauthenticated user; URLs do not expire

Both `profile-images` and `content-images` Azure Blob containers are set to public read access (`PublicAccessType.Blob`). A user in possession of an image URL — from a leaked log, a shared link, or browser history — can download it indefinitely with no authentication.

Profile images were previously named `{userId}/profile.jpg` (enumerable by sequential userId). This was patched on 2026-04-15: profile images are now stored as `{userId}/{guid}.jpg`, eliminating the enumeration risk. Content images (`content-images/{userId}/{guid}.jpg`) were already non-enumerable. Neither container requires authentication to read.

**Resolution**: Switch both containers to private access. Generate short-lived Azure SAS (Shared Access Signature) tokens in the backend when serving URLs to authenticated clients. Tokens should expire after ~1 hour. The backend embeds pre-signed SAS URLs into all DTOs that carry image URLs (`UserDto.profileImage`, `ForumReplyDto.imageUrls`, `MessageDto.imageUrls`) so the browser fetches blobs directly from Azure without routing through the VM.

**Scope**:
- Backend: Set both containers to `PublicAccessType.None` on startup. Add `GenerateSasUrl(BlobClient, TimeSpan)` helper to `IImageService`/`AzureImageService`. Call it in `UsersController` when returning `UserDto`, in `AzureForumService.ToReplyDto`, and in `AzureChatService` when mapping messages
- Frontend: No changes needed — SAS URLs are standard HTTPS URLs; `<img src>` and `uploadImage` calls work the same way
- `MockImageService`: no changes — placeholder URLs are always returned as-is

---

### TD.7. `localStorage` Token Security
**Impact**: Access tokens in `localStorage` are readable by any JavaScript on the page

Storing the access token in `localStorage` is vulnerable to XSS. The more secure pattern is: access token in memory (React state/context), refresh token in an HttpOnly cookie.

**Dependency**: Requires PB.2 (HTTPS) to be resolved first — the `Secure` cookie flag only works over HTTPS. The backend already supports the HttpOnly cookie flow conditionally on `Request.IsHttps`.

**Resolution**: After PB.2 is resolved, move `access_token` out of `localStorage` and into a React context (or Zustand store). The refresh flow in `apiClient.ts` continues to work — it reads from the context instead of `localStorage`.

---

## 🟢 UX / Polish

### UX.1. Accessibility Issues
**Impact**: Users with disabilities, SEO

Missing semantic HTML, ARIA labels, keyboard navigation support, focus management, alt text on some images.

**Resolution**: Audit with `axe` browser extension. Add ARIA attributes, semantic elements, and keyboard navigation. Test with a screen reader.

---

### UX.2. Swipe Functionality Incomplete
**Impact**: Core dating feature UX

`src/components/ui/swipe-card.tsx` exists but swipe gestures may not be smooth on all devices, there is no animation feedback, and no undo.

**Resolution**: Test gesture handling on iOS and Android. Add CSS transition animations for swipe direction. Add an "undo" button that restores the last-passed profile.

---

### UX.3. Image Handling Issues
**Impact**: Performance, UX

All images are external Unsplash URLs. No lazy loading, no optimisation, no unique images per user.

**Resolution**: Once MCF.3 (profile image upload) is resolved, migrate to user-uploaded images. Add `loading="lazy"` to all `<img>` elements. Add skeleton loaders.

---

### UX.4. package.json Name Mismatch
**Impact**: Project identity confusion

`package.json` has `"name": "vite_react_shadcn_ts"` (default template name).

**Resolution**: Change to `"name": "aloevera-harmony-meet"`.

---

### UX.5. No .env.example File
**Impact**: New developers don't know which environment variables are required

**Resolution**: Add `.env.example` listing all required `VITE_*` variables with placeholder values. Commit it. Keep `.env.development` and `.env.production` in `.gitignore`.

---

### UX.6. Unused Dependencies
**Impact**: Bundle size, maintenance overhead

Unused packages: `recharts` (no charts), `next-themes` (dark mode not implemented), `react-resizable-panels`, `vaul`, `cmdk`.

**Resolution**: Remove unused packages with `npm uninstall <package>`. Exception: keep `@tanstack/react-query` — it will be used when TD.3 is addressed.

---

### UX.7. No Analytics or Monitoring
**Impact**: No business insights

No analytics (GA, Mixpanel), no error tracking (Sentry), no performance monitoring.

**Resolution**: Add analytics when there are real users. Add Sentry for error tracking (see TD.5 — handled together with structured logging).

---

### UX.8. No PWA Support
**Impact**: Mobile experience, offline functionality

No service worker, no offline support, no install prompt.

**Resolution**: Add `vite-plugin-pwa`. Configure a service worker that caches the app shell. Add a Web App Manifest.

---

### UX.9. Inconsistent Date Formatting
**Impact**: Code inconsistency, maintenance

Date formatting is duplicated across `Friends.tsx` (`formatDateShort`, `formatTime`, `formatChatDate`) and `AloeVera.tsx` (`formatDate`, `formatBlogDate`).

**Resolution**: Create `src/lib/dates.ts` with shared formatting functions using `date-fns`. Import and replace inline formatters.

---

### UX.11. No Content Moderation UI Placeholder
**Impact**: No user-facing reporting mechanism

Users cannot report another user or flag a forum post. Only admin-side moderation (MCF.16) is planned.

**Resolution**: Add a "Report" option to user cards and forum posts. Store reports in a backend table. Surface in the admin panel (MCF.16).

---

### UX.12. Event Postmark Component Underutilised
**Impact**: Visual design opportunity missed

`src/components/ui/event-postmark.tsx` is only shown on event cards in `AloeVera.tsx`. It could serve as a collectible stamp on user profiles showing events attended.

**Resolution**: Display event postmarks on the user profile in `SettingsPage.tsx` and on user cards in `Friends.tsx` (for events the viewed user attended).

---

## 📊 Summary

| Section | Count |
|---|---|
| 🔴 Production Blockers | 1 |
| 🟠 Missing Core Features | 14 |
| 🟡 Technical Debt & Infrastructure | 8 |
| 🟢 UX / Polish | 11 |
| **Total active** | **34** |
| ✅ Resolved (see [RESOLVED_ISSUES.md](./RESOLVED_ISSUES.md)) | 16 |

---

## 📝 Changelog

**April 18, 2026** — Audit pass. Moved PB.1 (email service), MCF.3 (profile image upload), MCF.10 (gated registration), MCF.11 (rich text/media), and UX.10 (SEO metadata) to `RESOLVED_ISSUES.md`. Updated MCF.16 to note basic admin scaffold exists. Updated TD.6 to note backend CI workflow exists.

**April 15, 2026** — Profile image blobs renamed from `{userId}/profile.jpg` to `{userId}/{guid}.jpg` to eliminate sequential enumeration. Old blob deleted on re-upload. Added TD.8 tracking SAS tokens as the full privacy solution.

**April 13, 2026** — MCF.11 (rich text and media in forum & chat) resolved. BB code formatting via `src/components/ui/bbcode-renderer.tsx` with per-tag config in `src/config/bbcode.config.ts`; toolbar via `src/components/ui/bbcode-toolbar.tsx`. Image attachment picker (`src/components/ui/image-attachment-picker.tsx`) and display (`src/components/ui/image-attachment-display.tsx`). New backend endpoint `POST /api/v1/images/upload` (multipart/form-data, validates content-type and size ≤10 MB, resizes to 1200px, JPEG 85%, uploads to Azure Blob). `MessageDto` and `ForumReplyDto` now carry `imageUrls: string[]` arrays. Images uploaded at send time before persisting message/reply.

**April 12, 2026** — PB.3 (rate limiting) resolved. Sliding window rate limiter (5 req / 15 min / IP) applied to `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password`. Returns 429 `TOO_MANY_REQUESTS` with `Retry-After` header. `UseForwardedHeaders` added so real client IP is used behind nginx/Cloudflare. One shared permit bucket per IP across all three endpoints. `refresh`, `logout`, and other auth endpoints are intentionally not rate-limited.

**April 11, 2026** — PB.5 (input sanitization) resolved. `HtmlGuard` static helper rejects inputs containing HTML tags with 400 `HTML_NOT_ALLOWED`. Guards added to `ForumController` (CreateTopic, CreateReply), `ChatsController` (SendMessage), and `UsersController` (UpdateUser: name, location, bio). Note: SignalR hub `SendMessage` path is not covered — must be addressed before MCF.11 ships.

**March 20, 2026** — PB.2 (HTTPS) resolved. nginx.conf updated for SSL + HTTP redirect; docker-compose updated for ports 80/443 and cert volume mount; Cloudflare Origin Certificate approach documented in `docs/HTTPS_SETUP.md`.

**March 16, 2026** — MCF.2 (forum topic creation) resolved and moved to `RESOLVED_ISSUES.md`.

**March 16, 2026** — Renumbered all issues with section prefixes (PB.1–PB.5, MCF.1–MCF.18, TD.1–TD.7, UX.1–UX.12). Updated all cross-references within the file.

**March 16, 2026** — Full restructure. Switched from severity-based to type-based sections. Resolved issues (#1, #2, #3, #5, #6, #7, #9, #10, #17) moved to `RESOLVED_ISSUES.md`. Added new issues from audit: production blockers, missing core features, tech debt. Escalated desktop navigation from UX/Polish to Missing Core Features. Removed "Recommended Priority Order" section — section ordering communicates priority.

**March 15, 2026** — Issues #5 (testing) and #7 (duplicate Message interface) resolved. Chat REST + SignalR implemented.

**March 14, 2026** — Issues #9 (error handling) and #10 (form validation) resolved.

**February 23, 2026** — Issue #3 (data persistence / Azure Storage) and #17 (Docker) resolved.

**February 19, 2026** — Issues #1 (pages wired to backend), #2 (auth token storage), and #6 (mock data centralized) resolved.
