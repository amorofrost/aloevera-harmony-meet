# AI Agent Instructions

**AloeVera Harmony Meet** - Guidelines for AI Assistants

This document provides context and instructions for AI coding assistants (like Cursor, GitHub Copilot, etc.) working on this project.

---

## 🎯 Project Overview

**AloeVera Harmony Meet** is a fan community platform for AloeVera music band enthusiasts that combines dating features, social networking, event management, and e-commerce.

**Current State**: React SPA with full backend integration. The **LoveCraft** backend (`@lovecraft/`) runs with JWT auth + Azure Table Storage + SignalR. Multi-provider sign-in shipped (email/password, Google Identity Services, Telegram Login Widget, Telegram Mini App). All content pages are wired to `src/services/api/` and gated by `<ProtectedRoute>`. Full stack deployed at `https://aloeve.club` via Docker on Azure VM.

**Tech Stack**: React 18, TypeScript, Vite (two HTML entries: `index.html` + `admin.html`), Tailwind CSS, shadcn/ui, React Router DOM v6, react-hook-form + Zod, sonner toasts, TanStack Query (installed, currently unused), `@microsoft/signalr`, `@react-oauth/google`, `@dnd-kit/core`+`sortable`, `react-qr-code`

---

## 📁 Project Structure

```
aloevera-harmony-meet/
├── src/
│   ├── pages/                          # Page components
│   │   ├── Welcome.tsx                 # Landing + local login/register + Google + Telegram buttons
│   │   ├── WelcomeTelegram.tsx         # Pending-ticket redemption (Telegram Login Widget)
│   │   ├── WelcomeGoogle.tsx           # Pending-ticket redemption (Google Sign-In)
│   │   ├── WelcomePhoto.tsx            # First-time profile photo step
│   │   ├── MiniAppEntry.tsx            # Telegram Mini App entry (/tg)
│   │   ├── VerifyEmail.tsx             # /verify-email
│   │   ├── ResetPassword.tsx           # /reset-password
│   │   ├── Friends.tsx, Talks.tsx, AloeVera.tsx
│   │   ├── EventDetails.tsx, BlogPost.tsx, StoreItem.tsx
│   │   ├── SettingsPage.tsx, NotFound.tsx
│   │   └── (orphaned — exist but no routes: Chats, Events, Index, Likes, Profile, Search)
│   ├── admin/                          # Second Vite entry (admin.html → admin/main.tsx)
│   │   ├── AdminApp.tsx, main.tsx
│   │   ├── pages/                      # AdminLogin, AdminUsers, AdminConfig,
│   │   │                                 AdminEventEditorPage, AdminInvitesPage, etc.
│   │   └── components/
│   ├── components/
│   │   ├── ProtectedRoute.tsx, GuestRoute.tsx
│   │   ├── GoogleSignInButton.tsx      # @react-oauth/google wrapper
│   │   ├── TelegramLoginWidget.tsx     # telegram-widget.js injector
│   │   ├── ForgotPasswordModal.tsx
│   │   ├── SearchFilterSheet.tsx       # Country + region filter drawer for swipe deck
│   │   ├── forum/                      # TopicDetail, CreateTopicModal
│   │   ├── profile/, settings/
│   │   └── ui/                         # shadcn/ui + custom: bottom-navigation, swipe-card,
│   │                                     event-postmark, user-badges, bbcode-{renderer,toolbar},
│   │                                     image-attachment-{picker,display},
│   │                                     country-region-picker, dual-location-picker, location-display
│   ├── config/
│   │   ├── api.config.ts               # VITE_API_MODE (mock/api) + base URL
│   │   └── bbcode.config.ts            # Per-tag BB code enable/disable
│   ├── services/
│   │   ├── api/                        # apiClient, authApi, usersApi, eventsApi, storeApi,
│   │   │                                 blogApi, forumsApi, matchingApi, chatsApi,
│   │   │                                 songsApi (mock-only), imagesApi, adminApi
│   │   └── signalr/chatConnection.ts   # Module-level singleton (no-op in mock mode)
│   ├── data/                           # All mock data — never embed in components
│   │   ├── mockUsers, mockCurrentUser, mockProfiles, mockEvents, mockStoreItems,
│   │   ├── mockBlogPosts, mockForumData, mockChats, mockSongs
│   │   ├── prompts.ts                  # Profile-prompt list
│   │   ├── countries.ts               # Country list (code + name)
│   │   └── regions.ts                 # Region list keyed by country code
│   ├── contexts/LanguageContext.tsx    # i18n (ru/en) — only Context provider
│   ├── hooks/
│   │   ├── useCurrentUser.tsx          # Loads logged-in user
│   │   └── useChatSignalR.ts           # Group join/leave + event subscription
│   ├── types/                          # user.ts, chat.ts, forum.ts, index.ts
│   ├── lib/
│   │   ├── validators.ts               # Zod schemas (login, register, registerWithInvite,
│   │   │                                  profileEdit, message, reply, createTopic)
│   │   ├── apiError.ts                 # showApiError(err, fallback) → toast.error
│   │   ├── acl.ts                      # Effective-level mirror (Novice/.../Admin → 0–5)
│   │   ├── jwt.ts                      # getStaffRoleFromAccessToken
│   │   ├── telegramWebApp.ts           # isTelegramMiniApp / initData / theme reads
│   │   ├── inviteRedirect.ts           # sessionStorage ?code= carry-over
│   │   ├── authNavigation.ts           # Post-login destination resolver
│   │   ├── commonGround.ts             # Profile match scoring
│   │   ├── countryFlag.ts             # countryCodeToFlag() — ISO 3166-1 alpha-2 → emoji flag
│   │   └── utils.ts                    # cn()
│   ├── App.tsx                         # Routing
│   ├── main.tsx                        # Entry
│   └── index.css                       # Design system tokens
├── docs/
│   ├── ARCHITECTURE.md, FEATURES.md, ISSUES.md, RESOLVED_ISSUES.md
│   ├── API_INTEGRATION.md, FRONTEND_AUTH_GUIDE.md
│   ├── EVENTS.md, GOOGLE_OAUTH_SETUP.md, HTTPS_SETUP.md
├── .env.development                    # VITE_API_MODE=mock (default)
├── .env.production                     # VITE_API_MODE=api, VITE_API_BASE_URL=""
├── public/                             # Static (incl. public/telegram/index.html stub)
├── admin.html, index.html              # Two Vite HTML entries
├── nginx.conf, Dockerfile, Dockerfile.dev, docker-compose.yml
├── vite.config.ts, tsconfig*.json, tailwind.config.ts, eslint.config.js
└── AGENTS.md                           # This file
```

---

## 🎨 Design System & Styling

### Colors (HSL Format)

**AloeVera Brand Colors**:
```css
--aloe-gold: 45 96% 53%        /* Primary yellow-gold */
--aloe-flame: 14 91% 60%       /* Primary orange-red */
--aloe-ocean: 204 64% 44%      /* Blue accent */
--aloe-coral: 343 87% 70%      /* Pink accent */
--aloe-lavender: 259 34% 62%   /* Purple accent */
--aloe-sage: 159 25% 52%       /* Green accent */
```

**Semantic Colors**:
```css
--primary: var(--aloe-flame)       /* Use for primary actions */
--secondary: var(--aloe-gold)      /* Use for secondary actions */
--accent: var(--aloe-coral)        /* Use for highlights */
```

### Custom CSS Classes

**Use these instead of inline Tailwind when applicable**:
```css
.btn-like       /* Like button (coral → flame gradient) */
.btn-pass       /* Pass button (gray gradient) */
.btn-match      /* Match button (gold gradient) */
.profile-card   /* Card with gradient background + shadow */
.swipe-card     /* Touch-enabled swipeable card */
.nav-active     /* Active navigation state with glow */
```

### Styling Guidelines

1. **Use Tailwind utilities** for layout and basic styling
2. **Use semantic color variables** instead of hardcoded colors
3. **Use custom classes** for complex, reusable patterns
4. **Follow mobile-first** responsive design
5. **Maintain consistent spacing** (4px base unit: p-1, p-2, p-4, p-6, p-8, p-12)

---

## 🧩 Component Patterns

### Page Components

**Location**: `src/pages/`

**Structure**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { Type1, Type2 } from '@/types/user';

const PageName = () => {
  const [state, setState] = useState(initialValue);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Mock data (until backend implemented)
  const mockData = [...];

  // Event handlers
  const handleAction = () => { /* ... */ };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" 
           style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        {/* Header content */}
      </div>

      {/* Content */}
      <div className="p-4 relative z-10">
        {/* Page content */}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default PageName;
```

**Guidelines**:
- Always include `BottomNavigation` at the end
- Use `pb-20` on main container to account for bottom nav
- Use backdrop blur for headers (`backdrop-blur-md`)
- Use relative z-index for layering (background: 0, content: 10, header: 40, nav: 50)
- Import translation function: `const { t } = useLanguage()`
- Use mock data until backend is implemented

---

### UI Components

**Location**: `src/components/ui/`

**shadcn/ui Components**:
- Use existing shadcn/ui components when possible
- Import from `@/components/ui/[component-name]`
- Follow shadcn/ui patterns and API

**Custom Components**:
- `<BottomNavigation />` - Fixed bottom navigation (mobile only)
- `<SwipeCard />` - Swipeable card for Tinder-like UX
- `<EventPostmark />` - Artistic postage stamp badge for events

### UserBadges

`import { UserBadges } from '@/components/ui/user-badges';`

Props: `{ rank?: UserRank; staffRole?: StaffRole; className?: string }`. Renders a coloured rank dot + translated rank name (hidden for `novice`) and an uppercase coloured pill for staff role (hidden for `none`). Returns `null` when both are unset so you can drop it into any author/profile header unconditionally.

Rendered in: reply headers in `TopicDetail`, display name in `SettingsPage`, swipe card + chat-list items in `Friends`.

### Notification Formatting Helpers

Notification formatting (converting `NotificationDto` enum payloads into user-facing text + action links) is centralized in `src/lib/notificationFormatters.ts`. Each notification type has a formatter function that produces `{ title, message, actionText?, actionHref? }`. The `<NotificationDropdown>` and `/notifications` page consume these helpers to render consistent, translated notification text.

Maintained in: `<NotificationBell>`, `<NotificationDropdown>`, notification list page.

### Web Push Channel

Web Push channel: opt-in per device via Settings → Notifications → Browser push → "Enable on this device". Helper at `src/lib/webPush.ts`. Backend uses `WebPushDispatcher` (in-process; no worker involvement). Dead subscriptions auto-cleaned on HTTP 404/410.

### Email Channel

Email channel: daily digest delivery via SendGrid (Phase F shipped 2026-05-18). Outbox rows aggregated per user at `DailyDigestHourUtc` (default 9am UTC). `EmailDispatcher` renders HTML digest with notifications grouped by type. Unsubscribe via signed token: `GET /api/v1/notifications/unsubscribe?token=...` (public endpoint, token validated via HMAC-SHA256). Token format: `{userIdBase64Url}.{expiresAtUnixSeconds}.{base64hmac}` (dot-separated, base64url-encoded), valid for 30 days.

### RankUp Notifications (Phase H)

`AzureUserService` + `MockUserService` fire `RankUp` from `IncrementCounterAsync` when a user crosses a rank threshold upward. Implementation snapshots the four counter fields + `RankOverride` before increment, computes old + new rank via `RankCalculator.Compute`, and fires only when `EffectiveLevel.Parse(newRank) > EffectiveLevel.Parse(oldRank)`. Admin-overridden ranks never fire (RankCalculator short-circuits on RankOverride → both calculations return the override). Decrement transitions (e.g., `UnregisterFromEvent` with delta=-1) explicitly suppressed.

Producer is injected as `Lazy<INotificationProducer>?` — **`Lazy<T>` is required** because `NotificationProducer` depends on `IUserService` (for `GetNotificationContactStatusAsync`); direct injection would create a circular DI graph. Container resolves the wrapper eagerly; `.Value` lazy-resolves the producer on first invocation. Payload `{ previousRank, newRank }`; renderers currently read only `newRank`.

### Admin Broadcasts + Event Reminders (Phase G)

Admin community broadcast UI lives at `/admin/broadcasts` — compose form (title ≤100, body ≤1000, optional link, audience selector) + history table with status badge. Backend endpoint `POST /api/v1/admin/notifications/broadcast` returns `{ broadcastId, estimatedRecipients }` synchronously, then fans out `CommunityBroadcast` producer calls in background `Task.Run`. Audience types: `all` / `attendingEvent` (eventId) / `minRank` (rank name) / `staffRole` (role name). Gated by `appconfig.permissions.send_broadcast` (default `"admin"`; lowerable via appconfig without code change). `adminApi.broadcasts.{create,list,get}` is dual-mode (mock/api).

Event reminders fire via `EventReminderWorker` in `Lovecraft.NotificationsWorker` (5-minute tick, env var `NOTIFICATIONS_WORKER_REMINDER_SCAN_INTERVAL_MINUTES`). Reminds attendees of events in `[now+23h, now+25h]`. The worker writes `notifications` + `notificationsoutbox` rows directly (no `INotificationProducer` access — worker is isolated from backend). Dedup via partition scan for existing `SourceEventId == "event-reminder-{eventId}"`. In-process channels (InApp + WebPush) are NOT written by the worker — only Telegram + Email outbox rows.

Per-user invites: `AdminController.CreateEventInvite` accepts an optional `targetUserId` in the request body. When present, routes to `IEventInviteService.IssuePersonalInviteAsync` which writes the invite with `EventInviteEntity.TargetUserId` set and fires `EventInviteReceived` for that user. `TargetUserId` is informational only — the code still works for anyone who knows it. Existing event-level `CreateOrRotateInviteAsync` is unchanged.

### Admin shell (second Vite entry)

- **HTML entry**: `admin.html` → `src/admin/main.tsx`. Production build emits `dist/admin.html` + `dist/assets/admin-*.js`.
- **Routes**: `BrowserRouter` with `basename="/admin"` — e.g. `/admin/login`, `/admin/users`, `/admin/config`.
- **Dev**: open `http://localhost:8080/admin` (middleware rewrites to `admin.html`). Requires `VITE_API_MODE=api`; sign in with an account whose JWT has `staffRole: admin`.
- **Nginx**: `location ~ ^/admin { try_files $uri $uri/ /admin.html; }` so client-side routes work.
- **APIs**: `GET /api/v1/users?skip=&take=` (list), `GET /api/v1/admin/config` (read-only tables), `PUT /api/v1/users/{id}/role`, `PUT /api/v1/users/{id}/rank-override` (admin-only).
- **JWT helpers**: `getStaffRoleFromAccessToken` in `src/lib/jwt.ts` for gating the admin UI.

**Component Guidelines**:
- Functional components with TypeScript
- Use `React.FC` type if you prefer, but not required
- Props interface above component
- Use `cn()` utility for conditional classes: `cn('base-classes', condition && 'conditional-classes')`

---

## 🌐 Internationalization

**Context**: `src/contexts/LanguageContext.tsx`

**Supported Languages**: Russian (ru), English (en)

**Usage**:
```typescript
import { useLanguage } from '@/contexts/LanguageContext';

const Component = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <h1>{t('welcome.title')}</h1>
      <Button onClick={() => setLanguage('en')}>English</Button>
    </div>
  );
};
```

**Adding New Translations**:
1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Keep keys descriptive

**Translation Guidelines**:
- Always use `t()` for user-facing text
- Don't translate: technical terms, brand names, code
- Translate: UI labels, messages, descriptions, button text

---

## 🗂️ Type Definitions

**Location**: `src/types/`

**Files**:
- `user.ts` - User, Event, Match, Like, AloeVeraSong
- `chat.ts` - Chat, Message, GroupChat, PrivateChat

**Note**: `Message` interface was previously duplicated; now only in `chat.ts`. `user.ts` imports it from `chat.ts`. `chat.ts` also exports `ChatDto`, `MessageDto` (aliases), and `PrivateChatWithUser`.

**Rank & role aliases**:

- `UserRank` = `'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew'` (`src/types/user.ts`) — auto-computed from activity counters on the backend.
- `StaffRole` = `'none' | 'moderator' | 'admin'` (`src/types/user.ts`) — manually assigned by admins.
- Both are now required on `User` and returned by `mapUserFromApi`. The frontend helpers `levelOf` / `effectiveLevel` / `meetsLevel` live in `src/lib/acl.ts` and mirror the backend's 0–5 unified level map.

**Type Guidelines**:
- Use interfaces for object shapes
- Use types for unions and complex types
- Export all types
- Add JSDoc comments for complex types
- Use strict types (avoid `any`)

---

## 🔄 State Management

**Current Approach**:
- **Global State**: React Context for language/i18n; **Zustand for notifications** (`useNotificationStore` — Phase B adoption)
- **Local State**: `useState` in page components
- **No Global User State**: User is hardcoded as `'current-user'`
- **Current user**: `useCurrentUser()` from `@/hooks/useCurrentUser` is the canonical way to load the logged-in profile inside a component. It unwraps the `ApiResponse<User | null>` envelope returned by `usersApi.getCurrentUser()` and returns `{ user, loading }`. Components gating UI by rank (`<Talks>`, `<TopicDetail>`) consume this hook rather than re-reading the token or calling the API directly.

**React Query**: Configured but not used yet. Will be used when backend is implemented.

**State Guidelines**:
- Keep state close to where it's used
- Lift state only when needed by multiple components
- Use `useState` for simple state
- Use Zustand for cross-page shared client state (see `useNotificationStore` as the first pattern)
- Prepare for React Query migration (don't over-complicate state logic)

---

## 🚦 Routing

**Router**: React Router DOM v6

**Public routes**:
```
/                       → Welcome (login + register + Google + Telegram); wrapped in <GuestRoute>
/welcome/telegram       → WelcomeTelegram — Telegram pending-ticket redemption
/welcome/google         → WelcomeGoogle  — Google pending-ticket redemption
/welcome/photo          → WelcomePhoto   — first-time profile photo
/tg                     → MiniAppEntry   — Telegram Mini App entry
/verify-email           → VerifyEmail
/reset-password         → ResetPassword
```

**Protected routes** (wrapped in `<ProtectedRoute>`):
```
/friends                       → Friends (search, likes, chats)
/talks                         → Talks (forum, event discussions)
/aloevera                      → AloeVera (events, store, blog)
/aloevera/events/:eventId      → EventDetails
/aloevera/blog/:postId         → BlogPost
/aloevera/store/:itemId        → StoreItem
/settings                      → SettingsPage
```

**Admin entry**: `/admin/*` mounted under `admin.html` (separate Vite entry with `BrowserRouter basename="/admin"`).

**Legacy Redirects** (don't add new ones):
```
/search  → /friends
/events  → /aloevera
/likes   → /friends
/chats   → /talks
/profile → /settings
```

**Routing Guidelines**:
- Use `useNavigate()` for programmatic navigation
- Use `<Link>` for declarative navigation
- Use `useParams()` for route parameters
- Use `useSearchParams()` for query parameters
- Always handle 404 with `NotFound` component

---

## 🎯 Mock Data Guidelines

**Current State**: All mock data is centralized in `src/data/`. Every domain has a corresponding `src/services/api/[domain]Api.ts` service that loads from `src/data/` in mock mode and calls the real backend in API mode. **Do not embed new mock data directly in page components.**

**API Service Pattern** (follow for any new domain):
- Create `src/services/api/[domain]Api.ts` following the pattern in `eventsApi.ts` / `forumsApi.ts`
- Each service has a mock branch (`if (!isApiMode()) { return mockData; }`) and a real API branch
- Add mock data to `src/data/mock[Domain].ts`
- Export from `src/services/api/index.ts`

**Page component pattern** — fetch data via API service in `useEffect`:
```typescript
const [data, setData] = useState<Thing[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const load = async () => {
    try {
      const result = await thingApi.getThings();
      if (result.success && result.data) setData(result.data);
    } catch (err) {
      console.error('Failed to load things:', err);
    } finally {
      setIsLoading(false);
    }
  };
  load();
}, []);
```

---

## 📋 Form Validation Pattern

All forms that call real APIs use **react-hook-form + Zod** via `src/lib/validators.ts` and `src/lib/apiError.ts`.

### Standard wired-form pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { mySchema, type MySchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';

const form = useForm<MySchema>({
  resolver: zodResolver(mySchema),
  // mode: 'onBlur' for multi-field forms; default 'onSubmit' for simple ones
});

const handleSubmit = form.handleSubmit(async (data) => {
  try {
    const result = await someApi.doThing(data);
    if (!result.success) throw result;
    toast.success('Done!');
  } catch (err) {
    showApiError(err, 'Fallback message');
  }
});
```

- Inline field errors: `{form.formState.errors.field && <p className="text-xs text-destructive mt-1">{form.formState.errors.field.message}</p>}`
- Root/API errors: `form.setError('root', { message: '...' })`
- Known field-level API errors (e.g. EMAIL_TAKEN): `form.setError('email', { message: '...' })` (not toast)
- Select fields (shadcn `<Select>`): use `<Controller>` — `<Select>` is not a native input and cannot use `register()`
- Age and other numeric fields: use `valueAsNumber: true` on `register()` or `Controller`
- Cancel button: call `form.reset(savedValues)` to restore original values

### Lightweight inline validation (mock-only sends)

For inputs that only send to mock state (no API call), skip react-hook-form:
```typescript
const [msgError, setMsgError] = useState('');
const handleSend = () => {
  if (!content.trim()) { setMsgError("Message can't be empty"); return; }
  // do the mock send
};
// In JSX: onChange={() => setMsgError('')} to clear on keystroke
```

---

## BB Code

BB code formatting is controlled per-tag via `src/config/bbcode.config.ts`. To enable or disable a tag, change the boolean value — no other code changes needed.

- **Renderer**: `src/components/ui/bbcode-renderer.tsx` — parses raw BB code strings into React elements. Disabled tags render as literal `[tag]...[/tag]` text. XSS-safe: uses React text nodes, no `dangerouslySetInnerHTML`.
- **Toolbar**: `src/components/ui/bbcode-toolbar.tsx` — floating popup on text selection. Requires a `ref` to the target `<textarea>`.
- **Image picker**: `src/components/ui/image-attachment-picker.tsx` — max 4 files, holds `File[]` in state; parent uploads at send time.
- **Image display**: `src/components/ui/image-attachment-display.tsx` — 1→full-width, 2+→2-col grid, click-to-lightbox.

---

## 🔌 SignalR Real-Time Pattern

The chat system uses a module-level singleton (`src/services/signalr/chatConnection.ts`) and a React hook (`src/hooks/useChatSignalR.ts`).

### `chatConnection` singleton

- Is a no-op in mock mode (`isApiMode()` guard on every method)
- Token read from `localStorage.getItem('access_token')` at connect time
- All methods are async and safe to call even before `connect()` is awaited

```typescript
import { chatConnection } from '@/services/signalr/chatConnection';

await chatConnection.connect();           // idempotent — safe to call multiple times
await chatConnection.joinChat(chatId);    // join a private chat group
await chatConnection.joinTopic(topicId); // join a forum topic group
await chatConnection.leaveGroup(groupId);
await chatConnection.sendMessage(chatId, content); // real-time send
chatConnection.on('MessageReceived', handler);
chatConnection.off('MessageReceived', handler);
chatConnection.isConnected; // boolean
```

### `useChatSignalR(type, id)` hook

Manages join/leave lifecycle. Use `onEvent` to subscribe to hub events — **it returns a cleanup function** that must be returned from `useEffect`:

```typescript
const { sendMessage, isConnected, onEvent } = useChatSignalR('chat', chatId);
// or: useChatSignalR('topic', topicId)

useEffect(() => {
  return onEvent('MessageReceived', (msg) => {
    const incoming = msg as MessageDto;
    // Deduplicate — the REST sender also receives the group broadcast
    setMessages(prev =>
      prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
    );
  });
}, [onEvent]);
```

The `useChatSignalR` hook's own `useEffect` handles `connect()` → `joinChat/joinTopic` on mount and `leaveGroup` on unmount. Do not call these manually in the consumer component.

> **Deduplication is required.** `ChatsController.SendMessage` broadcasts `MessageReceived` to the full chat group (including the sender) via `IHubContext`. Do not also add the message from the REST response — rely solely on the SignalR push so every member (sender and recipient) receives exactly one copy.

### `getCurrentUserIdFromToken()`

A lightweight helper exported from `src/services/api/matchingApi.ts` that decodes the stored JWT without an API call:

```typescript
import { getCurrentUserIdFromToken } from '@/services/api';

const myId = getCurrentUserIdFromToken(); // e.g. "test-user-001"
```

Use this anywhere you need the current user's ID (e.g. filtering match partners, aligning chat messages left/right) without fetching `/api/v1/auth/me`. The .NET backend stores the user ID as the `"nameid"` claim in the JWT payload.

---

## 🐛 Known Issues

**See [docs/ISSUES.md](./docs/ISSUES.md) for active issues. Resolved issues are archived in [docs/RESOLVED_ISSUES.md](./docs/RESOLVED_ISSUES.md).**

**Current state** (high-level — see [docs/ISSUES.md](./docs/ISSUES.md) for the full list):

- ✅ Backend `@lovecraft/` runs against Azure Table Storage (23 tables) with mock-mode fallback
- ✅ Multi-provider auth: email/password + **Google Identity Services** + **Telegram Login Widget** + **Telegram Mini App** (all shipped end-to-end)
- ✅ Account linking across providers; smart email-based auto-link for Google
- ✅ `Lovecraft.TelegramBot` worker (separate hosted-service container)
- ✅ Tokens in `localStorage`; silent refresh on 401 (deduplicated); proactive near-expiry refresh in `ProtectedRoute`
- ✅ All pages wired to `src/services/api/` (mock or real depending on `VITE_API_MODE`)
- ✅ All mock data centralized in `src/data/`
- ✅ Real-time chat via SignalR (`chatConnection.ts` + `useChatSignalR`)
- ✅ Email delivery via SendGrid (`NullEmailService` console-logs when key absent)
- ✅ Rate limiting (sliding window, 20 req/min/IP, shared bucket on all auth endpoints)
- ✅ HTTPS in production (Cloudflare + Origin Cert on nginx, https://aloeve.club)
- ✅ Image upload + BB code + image attachments in forum & chat
- ✅ Roles & ACL (`appconfig` thresholds + permissions; `[RequireStaffRole]` + `[RequirePermission]`)
- ✅ Admin shell (`/admin/*`) for user/role/rank-override management + event editor + invites
- ⚠️ TypeScript loosely configured (see `tsconfig.json` — TD.1)
- ❌ **No persistence in mock mode** — `MockAuthService` is in-memory; restart resets state. Azure mode persists.
- ❌ Songs backend endpoint not yet built (`songsApi.ts` always returns mock — MCF.5)

**Don't fix without context**:
- Type system strictness (requires codebase-wide changes — TD.1)
- localStorage → in-memory token migration (depends on backend HttpOnly cookie path — TD.7)
- Blob storage SAS tokens (cross-cutting backend change — TD.8)

---

## ✅ Code Quality Guidelines

### TypeScript

```typescript
// ✅ Good
interface UserCardProps {
  user: User;
  onLike: (userId: string) => void;
  onPass: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onLike, onPass }) => {
  // ...
};

// ❌ Avoid
const UserCard = (props: any) => {
  // ...
};
```

### Component Structure

```typescript
// ✅ Good: Clear separation of concerns
const Component = () => {
  // 1. Hooks
  const [state, setState] = useState();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // 2. Derived state / computations
  const filteredData = data.filter(...);

  // 3. Event handlers
  const handleClick = () => { /* ... */ };

  // 4. Effects (if any)
  useEffect(() => { /* ... */ }, []);

  // 5. Render
  return <div>...</div>;
};
```

### Conditional Rendering

```typescript
// ✅ Good
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataList data={data} />}

// ❌ Avoid ternaries for simple conditions
{isLoading ? <Spinner /> : null}
```

### Event Handlers

```typescript
// ✅ Good: Named handlers
const handleLike = () => {
  console.log('Liked:', user.name);
  onLike(user.id);
};

<Button onClick={handleLike}>Like</Button>

// ❌ Avoid inline arrow functions (re-renders)
<Button onClick={() => onLike(user.id)}>Like</Button>

// ℹ️ Inline is OK for simple toggles
<Button onClick={() => setOpen(!open)}>Toggle</Button>
```

---

## 🎨 UI/UX Guidelines

### Mobile-First Design

```typescript
// ✅ Good: Mobile-first, then desktop
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>

// ❌ Avoid desktop-first
<div className="p-8 md:p-4">
```

### Responsive Images

```typescript
// ✅ Good
<img
  src={user.profileImage}
  alt={user.name}
  className="w-full h-48 object-cover rounded-lg"
/>

// ❌ Avoid fixed dimensions without object-cover
<img src={user.profileImage} className="w-400 h-600" />
```

### Loading States

```typescript
// ✅ Good: Show loading state
if (isLoading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner />
    </div>
  );
}

// ❌ Avoid rendering nothing
if (isLoading) return null;
```

### Empty States

```typescript
// ✅ Good: Friendly empty state
{matches.length === 0 && (
  <div className="text-center p-8">
    <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
    <p className="text-lg font-semibold">{t('likes.noMatches')}</p>
    <p className="text-sm text-muted-foreground">
      Keep swiping to find your match!
    </p>
  </div>
)}

// ❌ Avoid bare text
{matches.length === 0 && <p>No matches</p>}
```

---

## 🔧 Development Workflow

### Adding a New Feature

1. **Understand the context**: Read relevant docs (FEATURES.md, ARCHITECTURE.md)
2. **Check for existing patterns**: Look at similar existing features
3. **Create types**: Define TypeScript interfaces in `src/types/`
4. **Create mock data**: Add realistic mock data
5. **Build UI**: Create/modify page component
6. **Add translations**: Add i18n keys to LanguageContext
7. **Test manually**: Test in browser (mobile and desktop views)
8. **Update docs**: Update FEATURES.md if significant

### Modifying Existing Code

1. **Read the file first**: Understand existing patterns
2. **Maintain consistency**: Follow existing code style
3. **Don't break**: Ensure existing functionality still works
4. **Test changes**: Manual testing in browser
5. **Update types**: Keep TypeScript types in sync

### Adding UI Components

1. **Check shadcn/ui first**: Use existing component if possible
2. **Location**: `src/components/ui/[component-name].tsx`
3. **Follow patterns**: Look at existing custom components
4. **TypeScript**: Define props interface
5. **Styling**: Use Tailwind + design system colors
6. **Documentation**: Add JSDoc comments if complex

---

## 📦 Dependencies

### Adding New Dependencies

**Before adding a dependency**:
1. Check if it's already in package.json
2. Consider if it's really needed
3. Check bundle size impact
4. Ensure it's actively maintained

**Preferred libraries** (already in project):
- UI: shadcn/ui components (Radix UI)
- Icons: lucide-react
- Dates: date-fns
- Forms: react-hook-form + zod (in use — see `src/lib/validators.ts`)
- Notifications: sonner (`toast.success()`, `toast.error()` via `showApiError` in `src/lib/apiError.ts`)
- Animations: tailwindcss-animate

**Don't add without discussion**:
- State management libraries (Redux, MobX, etc.)
- UI libraries (Material-UI, Ant Design, etc.) - we use shadcn/ui
- CSS frameworks (Bootstrap, etc.) - we use Tailwind

---

## 🚀 Backend Integration — Current State

The full stack is deployed and operational at `https://aloeve.club`. All API services are wired; multi-provider authentication is enforced end-to-end.

### Shipped

- All domain API services in `src/services/api/` (dual-mode: mock + real)
- All pages fetch data via `useEffect` + API service calls, with loading states
- Tokens in `localStorage`; `apiClient` adds bearer header + silent 401 refresh + proactive near-expiry refresh in `ProtectedRoute`
- All content routes guarded by `<ProtectedRoute>`; `/` guarded by `<GuestRoute>`
- Backend returns camelCase enum strings matching frontend expectations
- Real-time chat & forum reply broadcast via SignalR `/hubs/chat`
- Google + Telegram (Login Widget + Mini App) sign-in via `<GoogleSignInButton>` and `<TelegramLoginWidget>`
- Profile photo upload + BB code + image attachments
- Roles/ACL: backend `[RequireStaffRole]` + `[RequirePermission]`; frontend mirror via `src/lib/acl.ts` + `<UserBadges>`
- Notifications Phase B + Phase D: in-app notifications via SignalR + real Telegram dispatch. Telegram channel: opt-in per notification type in Settings → Notifications. When enabled, the worker dispatches via Telegram.Bot SDK to the user's linked chat. "Mute these" inline button flips the type's Telegram toggle off via service-token internal endpoint.

### Open

- Songs backend endpoint (`songsApi.ts` still mock)
- Token storage hardening (`localStorage` → in-memory + HttpOnly cookie — TD.7)
- Blob storage SAS tokens (containers currently public-read — TD.8)
- Pagination on list views (`PagedResult<T>` exists server-side, unused on client — MCF.6)

### `appconfig` Azure Table

Three partitions drive the runtime config:

- **`rank_thresholds`** — 10 integer rows (`active_replies`, `active_likes`, `active_events`, `friend_replies`, `friend_likes`, `friend_events`, `crew_replies`, `crew_likes`, `crew_events`, `crew_matches`). Consumed by `RankCalculator`.
- **`permissions`** — 11 string rows (`create_topic`, `delete_own_reply`, `delete_any_reply`, `delete_any_topic`, `pin_topic`, `ban_user`, `assign_role`, `override_rank`, `manage_events`, `manage_blog`, `manage_store`). Each value is the minimum rank/role name. Consumed by `[RequirePermission("<key>")]`.
- **`registration`** — `require_event_invite` (bool). Exposed via `GET /api/v1/auth/registration-config`.

Served by `IAppConfigService` (1-hour `IMemoryCache`), seeded by `Lovecraft.Tools.Seeder`, exposed read-only via `GET /api/v1/admin/config` (admin-only).

**See [docs/API_INTEGRATION.md](./docs/API_INTEGRATION.md), [docs/FRONTEND_AUTH_GUIDE.md](./docs/FRONTEND_AUTH_GUIDE.md), and [`../lovecraft/Lovecraft/docs/AUTHENTICATION.md`](../lovecraft/Lovecraft/docs/AUTHENTICATION.md).**

---

## 📚 Documentation

### When to Update Docs

**Update README.md** when:
- Adding major features
- Changing setup instructions
- Updating tech stack

**Update docs/FEATURES.md** when:
- Adding new features
- Changing feature behavior
- Adding new pages

**Update docs/ISSUES.md** when:
- Discovering new issues
- Fixing existing issues

**Update docs/ARCHITECTURE.md** when:
- Changing architecture patterns
- Adding new layers/systems
- Changing tech stack

**Update AGENTS.md (this file)** when:
- Adding new conventions
- Changing code patterns
- Adding new guidelines

---

## 🎯 Common Tasks

### Adding a New Page

1. Create `src/pages/PageName.tsx`
2. Follow page component structure (see above)
3. Add route to `src/App.tsx`
4. Add navigation link to `BottomNavigation` (if needed)
5. Add translations to `LanguageContext`
6. Update `docs/FEATURES.md`

### Adding a New UI Component

1. Create `src/components/ui/component-name.tsx`
2. Use TypeScript + props interface
3. Use Tailwind + design system
4. Export component
5. Import and use in pages

### Adding Mock Data

1. Define at top of page component
2. Use TypeScript types
3. Use realistic data
4. Keep IDs consistent
5. Add comments

### Fixing Styling Issues

1. Check if custom class exists (`.btn-like`, `.profile-card`, etc.)
2. Use Tailwind utilities for simple cases
3. Use CSS variables for colors (never hardcode hex colors)
4. Test on mobile and desktop
5. Check dark mode (if applicable)

### Adding Translations

1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Use in component: `{t('section.key')}`

---

## ❓ FAQ for AI Agents

**Q: Is there a backend?**  
A: Yes — `@lovecraft/` (.NET 10) is deployed at `https://aloeve.club`. It runs against Azure Table Storage with JWT auth, SignalR, and SendGrid email. There's a `MockDataStore` in-memory fallback (`USE_AZURE_STORAGE=false`) for offline dev. The frontend's API service layer is in `src/services/api/`.

**Q: Should I make API calls in page components?**  
A: All existing pages use the API service pattern (`useEffect` + `[domain]Api.[method]()`). Follow the same for new pages. Never embed mock data directly in page components — add it to `src/data/` and consume it via the API service.

**Q: What mode is the app running in?**  
A: Controlled by `VITE_API_MODE` env var. `mock` (default in `.env.development`) = uses local mock data, no backend required. `api` (default in `.env.production`) = calls real backend. For local API-mode dev: `VITE_API_MODE=api npm run dev` (Google/Telegram sign-in only work in API mode).

**Q: How are tokens stored?**  
A: `localStorage` under `access_token` and `refresh_token`. Managed by `apiClient.setAccessToken()/setRefreshToken()/clearTokens()`. Set on login (`Welcome.tsx`, `WelcomeGoogle.tsx`, `WelcomeTelegram.tsx`, `MiniAppEntry.tsx`); cleared on logout (`SettingsPage.tsx`). On a 401 response `apiClient` calls `/auth/refresh` with the stored refresh token, retries the original request, deduplicates concurrent refreshes.

**Q: Should I fix TypeScript strict mode issues?**  
A: No. This requires codebase-wide changes. It's in ISSUES.md as known technical debt.

**Q: How should I handle errors from API calls?**
A: Import `showApiError` from `src/lib/apiError.ts` and call it in the catch block: `showApiError(err, 'Fallback message')`. For known field-level errors (e.g. email already taken), call `form.setError('fieldName', { message: '...' })` instead so the error appears inline next to the field.

**Q: How do I add form validation to a new form?**
A: Add a Zod schema to `src/lib/validators.ts`, infer the TypeScript type, then use `useForm<YourSchema>({ resolver: zodResolver(yourSchema) })`. See the Form Validation Pattern section above.

**Q: Should I add tests?**
A: Yes — Vitest + RTL is configured. Run `npx vitest run`. Add test files as `*.test.ts(x)` alongside the source. Follow the pattern in `src/services/api/chatsApi.test.ts` for service tests.

**Q: Can I use a different UI library?**  
A: No. This project uses shadcn/ui exclusively. Use existing components or create custom ones.

**Q: Can I add dark mode?**  
A: The design system supports it (check index.css), but it's not implemented. Only add if specifically requested.

**Q: How does Google / Telegram sign-in work?**  
A: Google uses `@react-oauth/google` via `<GoogleSignInButton>` which calls `/auth/google-login` with the ID token. Telegram Login Widget uses `<TelegramLoginWidget>` which calls `/auth/telegram-login`. Both return `signedIn` (immediate JWT), `pending` (new identity — route to `/welcome/google` or `/welcome/telegram` for profile fields), or `emailConflict` (Google only — user must enter password to auto-link). Mini App uses `MiniAppEntry.tsx` and `/auth/telegram-miniapp-login`. See `docs/FRONTEND_AUTH_GUIDE.md`.

**Q: How is the admin panel accessed?**  
A: Open `/admin` (in API mode with an account whose JWT has `staffRole: admin`). Dev: `http://localhost:8080/admin`. It's a separate Vite entry (`admin.html` → `src/admin/main.tsx`) with `BrowserRouter basename="/admin"`. UI is gated via `getStaffRoleFromAccessToken` in `src/lib/jwt.ts`.

**Q: Should I centralize mock data?**  
A: Yes — always. All mock data lives in `src/data/`. Do not define new mock data in page components or service files. Add a new `src/data/mock[Domain].ts` file if needed.

**Q: Where do I put images?**  
A: Use Unsplash URLs for mock images. Real image upload will be a backend feature.

**Q: Should I optimize performance?**  
A: Only if there's a specific performance issue. Don't prematurely optimize.

**Q: Can I refactor large components?**  
A: Only if specifically requested or if making changes that naturally lead to refactoring. Maintain existing patterns.

---

## 🤝 Best Practices Summary

✅ **DO**:
- Follow existing patterns and conventions
- Use TypeScript properly (with types from `src/types/`)
- Use design system colors (CSS variables)
- Use i18n for all user-facing text
- Add mock data with realistic content
- Test manually in browser (mobile + desktop)
- Keep components focused and readable
- Add comments for complex logic
- Update documentation when adding features

❌ **DON'T**:
- Add backend functionality (it's a frontend-only app)
- Make breaking changes without understanding impact
- Add new dependencies without good reason
- Hardcode colors (use CSS variables)
- Skip translations (use `t()` function)
- Ignore TypeScript errors (even if config is loose)
- Over-engineer solutions (keep it simple)
- Remove existing functionality without confirmation

---

## 📞 Getting Help

**For questions about**:
- **Features**: See [docs/FEATURES.md](./docs/FEATURES.md)
- **Architecture**: See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Known issues**: See [docs/ISSUES.md](./docs/ISSUES.md)
- **API integration**: See [docs/API_INTEGRATION.md](./docs/API_INTEGRATION.md)
- **Auth integration**: See [docs/FRONTEND_AUTH_GUIDE.md](./docs/FRONTEND_AUTH_GUIDE.md)
- **Backend docs**: See [`../lovecraft/Lovecraft/docs/`](../lovecraft/Lovecraft/docs/) (IMPLEMENTATION_SUMMARY.md, AUTHENTICATION.md, EVENTS.md, etc.)
- **Setup/deployment**: See [README.md](./README.md)

**If you're unsure**:
1. Read the relevant documentation
2. Look at similar existing code
3. Ask the user/developer for clarification

---

**Remember**: This is a fully integrated full-stack application. All pages are wired to the LoveCraft backend. All content requires authentication. The API service layer (`src/services/api/`) is the bridge — use it for all data access, keep mock data in `src/data/`, and maintain the mock/API dual-mode pattern for any new features.

For real-time features, use `chatConnection.ts` + `useChatSignalR` hook. The hook is a no-op in mock mode — no special handling needed in mock-mode consumers. See the **SignalR Real-Time Pattern** section above and `@lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md` for the backend design.

Good luck! 🚀
