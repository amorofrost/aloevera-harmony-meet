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

## ~~MCF.2. Forum Topic Creation~~ ✅ RESOLVED
**Resolved**: March 16, 2026

Users can now create new forum topics within any section. The forum is no longer read-only for new content.

**What was implemented**:

**Backend** (`D:\src\lovecraft\Lovecraft\`):
- `CreateTopicRequestDto` updated: removed unused `SectionId` property, added `[Required]` + `[StringLength]` validation annotations (`Title`: 5–100 chars, `Content`: 10–5000 chars)
- `IForumService.CreateTopicAsync(sectionId, authorId, authorName, title, content)` added
- `MockForumService.CreateTopicAsync` — creates topic in mock store, increments section `TopicCount`; `GetTopicsAsync` now returns pinned topics first
- `AzureForumService.CreateTopicAsync` — inserts `ForumTopicEntity` + `ForumTopicIndexEntity`, increments `TopicCount` on `ForumSectionEntity` via ETag-optimistic update
- `CachingForumService.CreateTopicAsync` — delegates to inner, then invalidates `forum:topics:{sectionId}` and `forum:sections` cache keys
- `ForumController` — new `POST /api/v1/forum/sections/{sectionId}/topics` action; also fixed hardcoded `"current-user"` author ID in `CreateReply` (now extracts from JWT claims)
- `Lovecraft.UnitTests/ForumTests.cs` — 5 new unit tests: `CreateTopic_AddsToSection_ReturnsTopic`, `CreateTopic_IncrementsSectionTopicCount`, `CreateTopic_UnknownSection_Throws`, `GetTopics_ReturnsPinnedFirst`, `CreateReply_IncrementsReplyCount`

**Frontend** (`D:\src\aloevera-harmony-meet\`):
- `src/lib/validators.ts` — `createTopicSchema` (title 5–100, content 10–5000, both trimmed) + `CreateTopicFormData` type
- `src/lib/__tests__/validators.test.ts` — 6 new tests for `createTopicSchema`
- `src/services/api/forumsApi.ts` — `createTopic(sectionId, title, content)` with mock and API mode implementations; also fixed `createReply` API mode to map response through `mapReplyFromApi` (date conversion bug fix)
- `src/components/forum/CreateTopicModal.tsx` — shadcn `Dialog` with title + content fields, `useForm` + `zodResolver`, loading state, `showApiError` on failure, `onCreated` callback
- `src/contexts/LanguageContext.tsx` — 8 new translation keys (`forum.createTopic.*`, `forum.newTopic`) in both `ru` and `en`
- `src/pages/Talks.tsx` — `createModalOpen` state, `handleTopicCreated` callback (prepends stub to section topics, increments `topicCount`, navigates to new topic), "+ New Topic" button (visible when section selected, no topic open), `<CreateTopicModal>` rendered

**New endpoint**: `POST /api/v1/forum/sections/{sectionId}/topics` (requires Bearer token)

---

## ~~PB.2. No HTTPS on Azure VM~~ ✅ RESOLVED
**Resolved**: March 20, 2026

HTTPS is now configured using **Cloudflare** as a DNS proxy (free tier) with a **Cloudflare Origin Certificate** on nginx. This approach is portable — migrating to a new host only requires updating a DNS A record.

**What was changed** (`D:\src\aloevera-harmony-meet\`):
- `nginx.conf` — added HTTP→HTTPS redirect server block (port 80); added HTTPS server block (port 443) with SSL config, HSTS header, and `X-Forwarded-Proto` on all proxy locations.
- `docker-compose.yml` — frontend ports changed from `8080:80` to `80:80` + `443:443`; added `/etc/ssl/aloeve:/etc/ssl/aloeve:ro` volume mount; backend external port removed (backend only reachable internally via Docker network); `ASPNETCORE_ENVIRONMENT` changed to `Production`.
- `Dockerfile` — added `EXPOSE 443`.
- `docs/HTTPS_SETUP.md` — full step-by-step setup guide (Cloudflare account, DNS records, SSL mode, Origin Certificate generation, cert placement on VM, Azure NSG port rules, migration path).

**Setup summary**:
1. Add `aloeve.club` to Cloudflare; point GoDaddy nameservers to Cloudflare.
2. Add A records `@` and `www` → Azure VM IP (orange cloud / proxied).
3. SSL/TLS mode → **Full (strict)**.
4. SSL/TLS → Origin Server → Create Certificate (hostnames: `aloeve.club`, `*.aloeve.club`; 15 years).
5. Place `origin.pem` + `origin.key` at `/etc/ssl/aloeve/` on the VM.
6. Open ports 80 and 443 in Azure NSG; close public port 8080.
7. `docker compose down && docker compose up --build -d`.

See `docs/HTTPS_SETUP.md` for the complete guide and troubleshooting table.

---

## ~~PB.1. Email Service Missing~~ ✅ RESOLVED
**Resolved**: April 18, 2026

Email sending is fully integrated via `SendGridEmailService`. When `SENDGRID_API_KEY` is set, the backend sends real emails through SendGrid. When the key is absent it falls back to `NullEmailService`, which logs the token and link to stdout (safe for dev/staging).

**What was implemented** (`Lovecraft.Backend/`):
- `IEmailService` interface with `SendVerificationEmailAsync` / `SendPasswordResetEmailAsync`
- `SendGridEmailService` — sends HTML + plain-text email via the SendGrid SDK; throws on non-2xx responses
- `NullEmailService` — logs the full action link at `LogInformation` level; no-op otherwise
- Conditional registration in `Program.cs`: `SendGridEmailService` when `SENDGRID_API_KEY` is present, `NullEmailService` otherwise
- Both `MockAuthService` and `AzureAuthService` inject `IEmailService` and call it on `RegisterAsync` (verification) and `ForgotPasswordAsync` (reset)
- `EmailServiceTests.cs` — unit tests covering both implementations

**Required env vars for real email**: `SENDGRID_API_KEY`, `FROM_EMAIL` (default `noreply@aloeband.ru`), `FRONTEND_BASE_URL` (default `http://localhost:8080`)

---

## ~~MCF.3. Profile Image Upload~~ ✅ RESOLVED
**Resolved**: April 18, 2026

Users can now upload and replace their profile photo. The full stack — upload endpoint, blob storage, and frontend UI — is implemented.

**What was implemented**:
- **Backend**: `POST /api/v1/users/{id}/images` in `UsersController`; validates ownership; calls `IImageService.UploadProfileImageAsync`; `AzureImageService` stores blob at `profile-images/{userId}/{guid}.jpg`, updates `UserEntity.ProfileImageUrl`; mock mode returns placeholder URL
- **Frontend**: `usersApi.uploadProfileImage(userId, file)` sends `multipart/form-data`; `SettingsPage.tsx` shows file picker, image preview (`previewUrl`), and calls the API on save

---

## ~~MCF.10. Gated Registration via Access Codes~~ ✅ RESOLVED
**Resolved**: April 18, 2026

Registration can be gated behind a single invite code configured via the `INVITE_CODE` environment variable. When the variable is set, the registration form shows an invite-code field and the backend validates it.

**What was implemented**:
- **Backend**: `GET /api/v1/auth/registration-config` returns `{ inviteCodeRequired: boolean }` (true when `INVITE_CODE` env var is non-empty); `RegisterRequestDto.InviteCode` (nullable string); `InvalidInviteCodeException`; both `MockAuthService.RegisterAsync` and `AzureAuthService.RegisterAsync` compare `request.InviteCode` against `INVITE_CODE` and throw `InvalidInviteCodeException` on mismatch
- **Frontend**: `authApi.getRegistrationConfig()` fetches the flag on page load; `Welcome.tsx` conditionally renders the invite-code field; `registerSchemaWithInvite` Zod schema (extends `registerSchema` with required `inviteCode`); field-level error set on `INVALID_INVITE_CODE` response

**Configuration**: Set `INVITE_CODE=<code>` in the backend environment. Omit or leave empty to allow open registration.

---

## ~~MCF.11. Rich Text and Media in Forum & Chat~~ ✅ RESOLVED
**Resolved**: April 13, 2026

Forum replies and private chat messages support BB code formatting and image attachments.

**What was implemented**:
- `src/components/ui/bbcode-renderer.tsx` — parses BB code into React elements; XSS-safe (no `dangerouslySetInnerHTML`); tags configurable in `src/config/bbcode.config.ts`
- `src/components/ui/bbcode-toolbar.tsx` — floating popup on text selection; wraps selected text in the chosen BB tag
- `src/components/ui/image-attachment-picker.tsx` — up to 4 files; holds `File[]` in state; parent uploads at send time
- `src/components/ui/image-attachment-display.tsx` — 1-image full width, 2+: 2-col grid, click-to-lightbox
- **Backend**: `POST /api/v1/images/upload` — validates JPEG/PNG/GIF/WebP, max 10 MB; resizes to 1200px max (JPEG 85%); uploads to Azure Blob `content-images` container; returns `{ Url: string }`
- `MessageDto` and `ForumReplyDto` carry `imageUrls: string[]`; images are uploaded before the message/reply is sent

---

## ~~UX.10. Missing SEO Metadata~~ ✅ RESOLVED
**Resolved**: April 18, 2026

`index.html` now has full Open Graph and Twitter Card metadata.

**What was implemented**:
- `<title>AloeVera Dating - Знакомства для фанатов музыки</title>`
- `<meta name="description">` and `<meta name="keywords">`
- `<meta property="og:title">`, `og:description`, `og:type`, `og:image`
- `<meta name="twitter:card">`, `twitter:site`, `twitter:image`

Per-route metadata (via `react-helmet-async`) remains a future enhancement.

---

## ~~April 26 — External profile photo download~~ ✅ RESOLVED
**Resolved**: April 26, 2026

When a user registers or links their account via Telegram or Google, the backend now downloads the provider's CDN profile photo and stores it in Azure Blob Storage (`profile-images` container) instead of keeping the external URL.

**What was implemented**:
- `IImageService.DownloadAndUploadExternalImageAsync(userId, externalUrl)` — downloads, resizes (max 800px, JPEG Q85), uploads, returns blob URL; returns `string.Empty` on any failure (best-effort)
- `AzureAuthService` calls this helper in `TelegramRegisterAsync`, `GoogleRegisterAsync`, `AttachGoogleToUserAsync`, and `AttachTelegramToUserAsync` — the `Attach*` methods only set the photo if the user's existing profile image is empty
- `MockAuthService` passes the external URL through unchanged

---

## ~~April 26 — Instagram handle on user profiles~~ ✅ RESOLVED
**Resolved**: April 26, 2026

Users can now add an optional Instagram account name to their profile. The handle is stored in the `Users` table and shown as a clickable link everywhere a profile is displayed.

**What was implemented**:
- **Backend**: `UserEntity.InstagramHandle` (string, default `""`); `UserDto.InstagramHandle` (nullable string); `AzureUserService.UpdateUserAsync` persists the handle; `ToDto` returns `null` for empty strings
- **Frontend**: `User.instagramHandle?: string` type; `profileEditSchema` Zod validation (max 30 chars, `[a-zA-Z0-9_.]` only); Instagram field in `SettingsPage.tsx` (edit: text input; view: clickable `@handle` link to `instagram.com`); Instagram link shown on swipe cards in `Friends.tsx`
- **Translations**: `profile.instagram` / `profile.instagramPlaceholder` added in Russian and English

---

## ~~April 26 — Unified swipe card profile view~~ ✅ RESOLVED
**Resolved**: April 26, 2026

The swipe card on the Friends/Search page previously showed minimal info with a tap-to-expand detail overlay. It now always shows the same rich content as the direct-link profile view.

**What was changed**:
- Removed `showDetails` toggle state and the `onTap` prop from `SwipeCard`
- Removed the dark detail overlay; replaced with always-visible bio, Instagram link (if set), and event attendance badges — matching the `viewingUser` panel
- Age field made optional in the registration form (`registerSchema` Zod update; backend accepts `null` age; UI labels the field as optional)

---

## 📝 Changelog

- **April 26, 2026** — External profile photo download (Telegram/Google → Azure Blob), Instagram handle field, unified swipe card profile view, optional age at registration.
- **April 18, 2026** — PB.1 (email service), MCF.3 (profile image upload), MCF.10 (gated registration), MCF.11 (rich text/media), UX.10 (SEO metadata) resolved and moved here.
- **March 20, 2026** — PB.2 (HTTPS) resolved and added to this archive.
- **March 16, 2026** — MCF.2 (forum topic creation) resolved and added to this archive.
- **March 16, 2026** — Archive created. Issues #1, #2, #3, #5, #6, #7, #9, #10, #17 moved here from `ISSUES.md`.
