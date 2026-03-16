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
