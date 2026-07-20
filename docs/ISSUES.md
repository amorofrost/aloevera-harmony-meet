# Known Issues & Technical Debt

**Last Updated**: 2026-06-05
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

### MCF.4. Notification System *(all 8 phases A–H shipped 2026-05-18/19 — see RESOLVED_ISSUES.md)*
**Impact**: No engagement hooks — users are never informed of new activity

**Shipped (2026-05-18)**: Phase A (infrastructure) + Phase B (in-app notifications + producers)
- Backend: notification model + 4 producer call sites (LikeReceived, MatchCreated, MessageReceived, ForumReplyToThread)
- Frontend: bell UI, dropdown, /notifications page, preferences settings (in-app mode only)
- Delivery: in-app via SignalR immediately
- Defaults: conservative (in-app only, no Telegram/email/Web Push)

**Shipped (2026-05-18)**: Phase C (worker scaffold) — Lovecraft.NotificationsWorker with DispatcherWorker (10s), DigestWorker (top-of-hour), JanitorWorker (3am UTC). Channel dispatchers are stubs (log + Delivered). 

**Shipped (2026-05-18)**: Phase D (real Telegram dispatcher + mute callback) — TelegramDispatcher lookup from users table, HTML body + inline keyboard, rate limiting, mute-type callback flow.

**Shipped (2026-05-18)**: Phase E (Web Push) — WebPushDispatcher in-process, VAPID keypair config, service worker + browser helper, device opt-in UI.

**Shipped (2026-05-18)**: Phase F (email digests) — EmailDispatcher + EmailDigestRenderer via SendGrid, UnsubscribeToken signed links, `GET /api/v1/notifications/unsubscribe` endpoint, required env vars (SENDGRID_API_KEY, FROM_EMAIL, FRONTEND_BASE_URL, JWT_SECRET_KEY).

**Shipped (2026-05-19)**: Phase G (event reminders + admin broadcast + 3 remaining producers)
- `broadcasts` Azure Table; `IBroadcastService` + `BroadcastAudienceResolver` (4 audience types: all / attendingEvent / minRank / staffRole)
- `AdminNotificationsController`: `POST /api/v1/admin/notifications/broadcast`, `GET /broadcasts`, `GET /broadcasts/{id}` — admin-only (`send_broadcast` permission key, default `"admin"`). Sync response + async `Task.Run` fan-out
- `EventReminderWorker` in `Lovecraft.NotificationsWorker` — 5-minute tick, reminds attendees of events in `[now+23h, now+25h]`; dedup via `sourceEventId = "event-reminder-{eventId}"`
- 3 producers wired: `EventPublished` (admin event creation, public only), `EventInviteReceived` (`IssuePersonalInviteAsync` + `EventInviteEntity.TargetUserId` column), `CommunityBroadcast` (admin broadcast endpoint)
- Frontend: `/admin/broadcasts` page (compose form + history table); `adminApi.broadcasts.{create,list,get}` dual-mode

**Shipped (2026-05-19)**: Phase H — final phase, RankUp producer wired
- `AzureUserService` + `MockUserService` extended with nullable optional `Lazy<INotificationProducer>?` ctor param (`Lazy<T>` required because `NotificationProducer` depends on `IUserService`, creating a DI cycle)
- `IncrementCounterAsync` snapshots counter fields + `RankOverride` before increment; computes old + new rank via `RankCalculator.Compute`; fires `RankUp` only on strict `EffectiveLevel` increase
- `RankOverride` short-circuits via `RankCalculator` → admin-overridden users never get rank notifications
- Decrement transitions (`UnregisterFromEvent` with delta=-1) explicitly suppressed — only upward transitions fire
- Payload `{ previousRank, newRank }` (camelCase); renderers currently read only `newRank`
- `sourceEventId = "rank-up-{userId}-{newRank}"` for 60-second dedup window

**MCF.4 closed.** All 9 producers (LikeReceived, MatchCreated, MessageReceived, ForumReplyToThread, CommunityBroadcast, EventPublished, EventReminder, EventInviteReceived, RankUp) and all 4 channels (in-app SignalR, Telegram, Web Push, email digest) are operational.

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

**2026-05-16**: Country + region filter shipped — `GET /api/v1/users?country=&region=` parameters added on the backend; `<SearchFilterSheet>` drawer in `Friends.tsx` wires them on the frontend. Age, gender, and distance filters remain open.

**Resolution**:
- Backend: Add remaining filter parameters to `GET /api/v1/users` (`?minAge=&maxAge=&gender=&eventId=`)
- Frontend: Pass the current user's preferences (age range, gender) when calling `usersApi.getUsers()` in `src/pages/Friends.tsx`
- UI: Extend the existing filter sheet with age/gender controls

---

### MCF.8. Anonymous Likes — ✅ Resolved (2026-07-17)
**Impact**: Core privacy feature absent from the matching system

A user can now send a normal like or an anonymous ("secret") like. Anonymity is a per-like property; the recipient of a pending anonymous like never sees the sender's identity and is shown only a count of secret admirers. A mutual like still becomes a normal, revealed match.

**Shipped**:
- Backend: `IsAnonymous` on `LikeEntity` / `LikeDto`, `Anonymous` on `CreateLikeRequestDto`. `CreateLikeAsync` drives the `LikeReceived` notification anonymity from the per-like flag (`actorId = null` when anonymous) — the old global-setting lookup was removed. `GET /api/v1/matching/likes/received` excludes pending anonymous likes; new `GET /api/v1/matching/likes/received/anonymous-count` returns the count. Both Azure + mock implementations, with unit tests covering the privacy exclusion, count, and actor-nulling.
- Frontend: deck card exposes explicit **Like** and **Secret like** buttons; swipe-right follows the user's Settings default. Received tab shows a "N people liked you secretly" summary card; Sent tab badges anonymous likes. The Settings `anonymousLikes` toggle is enabled and persisted (swipe-right default). See spec `docs/superpowers/specs/2026-07-17-anonymous-likes-design.md`.

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

### MCF.17. Telegram Mini App polish *(partial — auth + entry shell shipped)*
**Impact**: Mini App authentication, entry page, and inline registration wizard are live, but the experience inside Telegram still needs polish.

**Shipped**:
- `POST /auth/telegram-miniapp-login`, `/telegram-miniapp-register`, `/telegram-miniapp-link-login` with full HMAC verification of `Telegram.WebApp.initData`
- `/tg` entry route (`MiniAppEntry.tsx`) — reads initData, signs in or renders inline wizard
- `Lovecraft.TelegramBot` worker (separate hosted-service; long-polls for `/start` commands)
- `src/lib/telegramWebApp.ts` helpers (`isTelegramMiniApp()`, theme + viewport reads)
- Mock-mode debug banner hidden inside Mini App contexts

**Pending**:
- Deep-link start params (`?startapp=link_{guid}`, `event_{id}`, `user_{id}`, `invite_{code}`)
- Bot command menu (`/setMyCommands`, `SetChatMenuButton`)
- Theme mapping (Telegram theme params → `aloe-*` CSS variables)
- Back button / Main button integration with `Telegram.WebApp.BackButton` and `MainButton`
- One-time linking codes (`telegramlinkrequests` table + bot worker handler)

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

### TD.5. No Structured Logging or Monitoring in Production *(backend resolved 2026-05-22; frontend Sentry deferred)*
**Impact**: Frontend errors still untracked; alerting and log shipping not in place

**Backend half resolved 2026-05-22** — see [MONITORING.md](./MONITORING.md). Shipped: Serilog structured JSON to stdout in `Lovecraft.Backend` + `Lovecraft.TelegramBot` + `Lovecraft.NotificationsWorker` (enriched with `service`, `version`, `traceId`); `UseSerilogRequestLogging` for request summary lines; admin dashboard at `/admin/metrics` with container status, request volume + latency, DAU/MAU, BI counts; 4 toggleable collection categories; 30-day retention defaults.

**Open items in TD.5 scope:**
- **Frontend error tracking (Sentry).** No `@sentry/react` integration yet. `X-Request-Id` response header is emitted so future Sentry → backend log correlation is one wire-up away.
- **Log shipping.** Stdout JSON only; no Application Insights / Loki / Seq sink. One-line `Serilog.WriteTo.*` config change when wanted.
- **Alerting.** Dashboard is pull-only; no threshold-based push alerts.

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

### TD.9. Migrate Telegram sign-in to the new Login SDK (OIDC `id_token`)
**Impact**: We're on Telegram's **legacy** Login Widget flow; Telegram has since shipped a new Login SDK that is the forward-looking, better-styled, OIDC-standard option.

**Current state** (2026-06-05): The web client signs in via the legacy `telegram-widget.js` script. We render our own round icon button (`src/components/TelegramLoginWidget.tsx`) that calls `window.Telegram.Login.auth({ bot_id })`, which returns the classic `{ id, first_name, auth_date, hash }` payload. The backend `TelegramLoginVerifier` validates it with `HMAC(SHA256(bot_token))`. `bot_id` is exposed (public) via `GET /api/v1/auth/telegram-login-config`. This works and looks right, but the legacy widget has **no native icon-only mode** — the icon is our own button wrapper.

**The new SDK** (`Telegram.Login.init/open/auth` with `client_id` + `nonce`) returns an OpenID-Connect **`id_token` JWT** and supports native button styles including `data-style="icon"`. Refs: https://core.telegram.org/widgets/login and https://core.telegram.org/bots/telegram-login.

**Why migrate**: native icon/style options (drop the custom-button wrapper), OIDC-standard verification (JWKS) instead of bespoke HMAC, `nonce` replay protection, and staying on Telegram's supported path as the legacy widget ages out.

**What needs to change**:
- **Backend** (`Lovecraft.Backend`): add an `id_token` verifier alongside `TelegramLoginVerifier` — validate the JWT against Telegram's published JWKS; check `aud == client_id`, `iss`, `exp`, and the `nonce`. Map OIDC claims (`sub` → Telegram user id, `name`, `picture`) onto the existing user-provisioning path so `telegram-login` → `signedIn`/`pending`, register, and link flows stay unchanged. Keep the legacy verifier during the transition (accept both).
- **DTOs**: extend the Telegram login request (or add a sibling) to accept `idToken` instead of the widget fields.
- **Frontend**: replace the custom button + `Telegram.Login.auth({ bot_id })` in `TelegramLoginWidget.tsx` with the new SDK (`Telegram.Login.init({ client_id, request_access, nonce })` + `open()`), or the new embeddable icon button; POST the returned `id_token`. Generate + round-trip a `nonce`. The `bot_id` already surfaced via `/telegram-login-config` doubles as `client_id`.
- **Config**: confirm whether the new `client_id` setup differs from the current BotFather `/setdomain`.

**Scope note**: medium. The account-provisioning/linking logic is reusable; work concentrates in token verification (backend) + the sign-in call (frontend). The Telegram **Mini App** flow (`telegram-miniapp-*`, `initData` HMAC) is separate and unaffected.

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
| 🟠 Missing Core Features | 14 (3 partials: MCF.12, MCF.16, MCF.17 — MCF.4 closed 2026-05-19) |
| 🟡 Technical Debt & Infrastructure | 9 |
| 🟢 UX / Polish | 11 |
| **Total active** | **35** |
| ✅ Resolved (see [RESOLVED_ISSUES.md](./RESOLVED_ISSUES.md)) | many |

---

## 📝 Changelog

**July 19, 2026** — Attendee pre-registration + claim-on-first-login shipped. Admins can paste a JSON list of attendees (Telegram username, name, gender) into a new "Pre-register attendees" card in the event editor (`PreRegisterAttendeesCard.tsx`); `POST /api/v1/admin/events/{eventId}/preregister` creates a "shell" `UserEntity` per row (`userId` = normalized Telegram username, synthetic email `prereg_{userId}@telegram.local`, no auth method, `PreRegistered = true`) and registers it as an attendee of the event, returning a per-row `created`/`skippedExists`/`invalidUsername`/`invalidName`/`error` status. When that person later signs in via Telegram for the first time (widget or Mini App) with a matching username, `TryClaimPreRegistered(Async)` links their real numeric Telegram id onto the shell and the response is `signedIn` — they skip the registration wizard entirely. Backend `Lovecraft.Backend/Helpers/PreRegistrationRowValidator.cs` holds the shared row-validation rules; both `MockAuthService` and `AzureAuthService` implement `IAuthService.PreRegisterAttendeesAsync`. **Known limitation**: if a person changes their Telegram username between import and their first sign-in, the normalized-username lookup no longer matches, so no claim occurs — they register a fresh account instead, and the shell is left orphaned (still visible in the roster, harmless). Admin can re-import a corrected list; there is no automatic reconciliation.

**June 5, 2026** — Google sign-in re-enabled (real Google Cloud Web client id wired via backend `GOOGLE_OAUTH_CLIENT_ID`; frontend reads it at runtime from `/auth/google-config`; `<GoogleSignInButton>` restored to Welcome). Social-login row redesigned as round icon buttons. Telegram sign-in switched to a **custom round icon button** using the legacy `Telegram.Login.auth({ bot_id })` flow (Option B) — added public `botId` to `GET /auth/telegram-login-config`; existing HMAC verifier unchanged. Added **TD.9** to track migrating Telegram to the new OIDC `id_token` Login SDK.

**May 19, 2026 (later)** — Notifications Phase H shipped: `RankUp` producer wired into `IUserService.IncrementCounterAsync`. `Lazy<INotificationProducer>` injection avoids the producer→IUserService→producer DI cycle. Strict level-increase guard prevents decrement transitions (UnregisterFromEvent) from firing. All 8 phases complete; **MCF.4 fully resolved**.

**May 19, 2026** — Notifications Phase G shipped: admin community broadcast (compose+history UI at `/admin/broadcasts`), `EventReminderWorker` (24h ahead), and the 3 remaining producers (`EventPublished`, `EventInviteReceived`, `CommunityBroadcast`). Added `broadcasts` Azure Table (24th); `send_broadcast` permission key; `EventInviteEntity.TargetUserId` column. MCF.4 updated to "Phases A–G shipped; Phase H pending".

**May 18, 2026** — Notifications Phase B documentation. MCF.4 updated from "missing" to "partial — Phase A + B shipped (in-app + 4 producers); Phases C–F (worker, Telegram, Web Push, email) and G–H pending". Updated FEATURES.md, API_INTEGRATION.md, AGENTS.md, and backend NOTIFICATIONS.md to document the Phase B scope.

**May 15, 2026** — Documentation audit. MCF.17 (Telegram Mini App) updated from "not started" to "partial — auth + entry shell shipped; deep-link/command-menu/theme polish pending". Removed obsolete planning docs (DOCUMENTATION_SUMMARY.md, API_INTEGRATION_SUMMARY.md, BACKEND_PLAN.md, docs/README.md, AUTH_SIMPLIFICATION.md, AUTH_DECISIONS.md, AUTH_FLOWS.md, AUTH_IMPLEMENTATION.md). Updated AUTHENTICATION.md, FRONTEND_AUTH_GUIDE.md, DOCKER.md, QUICKSTART.md, ARCHITECTURE.md (both repos), FEATURES.md, IMPLEMENTATION_SUMMARY.md, AZURE_STORAGE.md to reflect Google + Telegram auth shipped.

**April 18, 2026** — Audit pass. Moved PB.1 (email service), MCF.3 (profile image upload), MCF.10 (gated registration), MCF.11 (rich text/media), and UX.10 (SEO metadata) to `RESOLVED_ISSUES.md`. Updated MCF.16 to note basic admin scaffold exists. Updated TD.6 to note backend CI workflow exists.

**April 15, 2026** — Profile image blobs renamed from `{userId}/profile.jpg` to `{userId}/{guid}.jpg` to eliminate sequential enumeration. Old blob deleted on re-upload. Added TD.8 tracking SAS tokens as the full privacy solution.

**April 13, 2026** — MCF.11 (rich text and media in forum & chat) resolved. BB code formatting via `src/components/ui/bbcode-renderer.tsx` with per-tag config in `src/config/bbcode.config.ts`; toolbar via `src/components/ui/bbcode-toolbar.tsx`. Image attachment picker (`src/components/ui/image-attachment-picker.tsx`) and display (`src/components/ui/image-attachment-display.tsx`). New backend endpoint `POST /api/v1/images/upload` (multipart/form-data, validates content-type and size ≤10 MB, resizes to 1200px, JPEG 85%, uploads to Azure Blob). `MessageDto` and `ForumReplyDto` now carry `imageUrls: string[]` arrays. Images uploaded at send time before persisting message/reply.

**April 12, 2026** — PB.3 (rate limiting) resolved. Sliding window rate limiter applied to `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password` (and later extended to `reset-password`, `google-login`, `google-register`, `telegram-login`, `telegram-register`, `telegram-link-login`, `telegram-miniapp-*`). Currently 20 req / 1 min / IP with a single shared permit bucket across all rate-limited auth endpoints. Returns 429 `TOO_MANY_REQUESTS` with `Retry-After: 60` header. `UseForwardedHeaders` added so real client IP is used behind nginx/Cloudflare. `refresh`, `logout`, and `me` are intentionally NOT rate-limited.

**April 11, 2026** — PB.5 (input sanitization) resolved. `HtmlGuard` static helper rejects inputs containing HTML tags with 400 `HTML_NOT_ALLOWED`. Guards added to `ForumController` (CreateTopic, CreateReply), `ChatsController` (SendMessage), and `UsersController` (UpdateUser: name, location, bio). Note: SignalR hub `SendMessage` path is not covered — must be addressed before MCF.11 ships.

**March 20, 2026** — PB.2 (HTTPS) resolved. nginx.conf updated for SSL + HTTP redirect; docker-compose updated for ports 80/443 and cert volume mount; Cloudflare Origin Certificate approach documented in `docs/HTTPS_SETUP.md`.

**March 16, 2026** — MCF.2 (forum topic creation) resolved and moved to `RESOLVED_ISSUES.md`.

**March 16, 2026** — Renumbered all issues with section prefixes (PB.1–PB.5, MCF.1–MCF.18, TD.1–TD.7, UX.1–UX.12). Updated all cross-references within the file.

**March 16, 2026** — Full restructure. Switched from severity-based to type-based sections. Resolved issues (#1, #2, #3, #5, #6, #7, #9, #10, #17) moved to `RESOLVED_ISSUES.md`. Added new issues from audit: production blockers, missing core features, tech debt. Escalated desktop navigation from UX/Polish to Missing Core Features. Removed "Recommended Priority Order" section — section ordering communicates priority.

**March 15, 2026** — Issues #5 (testing) and #7 (duplicate Message interface) resolved. Chat REST + SignalR implemented.

**March 14, 2026** — Issues #9 (error handling) and #10 (form validation) resolved.

**February 23, 2026** — Issue #3 (data persistence / Azure Storage) and #17 (Docker) resolved.

**February 19, 2026** — Issues #1 (pages wired to backend), #2 (auth token storage), and #6 (mock data centralized) resolved.
