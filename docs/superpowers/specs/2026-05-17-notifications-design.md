# Notifications System — design spec

**Date:** 2026-05-17
**Scope:** Multi-channel notifications for nine triggering events, with per-user opt-in matrix (notification type × delivery channel) and per-channel frequency (immediate / hourly digest / daily digest). Channels: in-app (SignalR), Telegram (bot DM), browser Web Push (VAPID), email (SendGrid).
**Out of scope (explicit):** Mobile-native (iOS/Android) push. User block list (depends on MCF.16). Push notifications for online presence / typing indicators. Mention-style notifications (`@username`) — forum mentions don't exist yet. Granular per-(type, channel) frequency — frequency is per-channel only. Per-user timezone for daily digest — UTC only for now (single configurable hour); revisit when user TZ field lands.
**Repos touched:** `lovecraft` (backend + new worker), `aloevera-harmony-meet` (frontend).
**Resolves:** MCF.4 (notification system).
**Related:** [`2026-03-15-chat-signalr-design.md`](./2026-03-15-chat-signalr-design.md) (SignalR hub we extend); [`2026-04-16-roles-and-acl-design.md`](./2026-04-16-roles-and-acl-design.md) (admin broadcast permission).

---

## Goal

Currently the platform has no engagement hook. Users only see new likes, matches, messages, or replies when they actively reload a page. The change:

- **Nine notification types** covering interpersonal (likes, matches, messages, replies), event (publish, reminder, invite), and system (community broadcast, rank-up) events.
- **Four delivery channels** with explicit user opt-in: in-app (bell + dropdown + dedicated page), Telegram bot DM (for users with Telegram linked), browser Web Push (per-device subscription), email (digest-friendly).
- **Per-channel frequency** — immediate, hourly digest, or daily digest at a user-chosen UTC hour.
- **Conservative defaults** — only in-app is on by default; every other channel/type cell is off until the user explicitly enables it.

---

## Non-goals

- No third-party push providers (FCM, OneSignal, Pusher). VAPID Web Push is sufficient at this scale.
- No new orchestration framework (Hangfire, Quartz, Azure Functions). A dedicated worker container with three timed loops is enough.
- No real-time presence / typing indicators / read receipts. Out of scope; tracked separately under MCF.4 follow-up work.
- No per-(type, channel) frequency. Frequency is per-channel only — easier UI, easier mental model. Power users who want type-specific frequency can disable types from a channel.
- No "rich" digest layout (e.g. avatar grids, message previews wider than one line). v1 digests render as bullet lists with deep links.
- No user-facing notification deletion that wipes server-side records. "Dismiss" hides from UI; canonical row stays for 90 days then janitor purges.
- No native mobile push. If iOS/Android apps ever ship we'll revisit (FCM or APNs).

---

## Architecture summary

Two-process split, communicating only through storage (Azure Tables):

- **API process (`Lovecraft.Backend`)** writes the canonical `notifications` row plus N `notificationsoutbox` rows (one per channel resolved from prefs) at the moment a trigger fires. For low-latency channels — in-app SignalR and Web Push — it also dispatches synchronously and marks the outbox row delivered. Higher-latency channels (Telegram, email) stay pending for the worker.
- **Worker process (`Lovecraft.NotificationsWorker`)** — new container alongside `backend` and `telegram-bot` in compose. Three timed loops:
  - **Outbox dispatcher** (10s tick) drains pending Telegram + email rows from `notificationsoutbox` by partition scan; retries on failure with exponential backoff; dead-letters after 5 attempts.
  - **Digest aggregator** (top of each hour, UTC) rolls up per-(user, channel) pending rows whose `frequency` is `hourly` or `daily` into one digest send.
  - **Event reminder scheduler** (5m tick) scans `events` for items 24h ahead and produces `EventReminder` notifications for attendees not yet reminded.

No RPC between API and worker. Both deploy and restart independently — outbox rows wait safely in storage. Tradeoff documented: polling adds up to ~10s latency for non-immediate channels vs a real queue (Azure Storage Queue) at the cost of one new piece of infra and another credential to manage. Polling chosen for simplicity at this scale.

---

## Notification types (9)

Each is a distinct `NotificationType` enum value. Producer = code path that fires the notification. Suppression = conditions where the producer skips enqueue.

| # | Type | Producer | Suppression |
|---|---|---|---|
| 1 | `LikeReceived` | `MatchingService.CreateLikeAsync` (non-mutual branch) | Self-action; recipient blocked actor (future hook) |
| 2 | `MatchCreated` | `MatchingService.CreateLikeAsync` (mutual branch) | None |
| 3 | `MessageReceived` | `ChatsController.SendMessage` | Recipient currently in `chat-{id}` SignalR group |
| 4 | `ForumReplyToThread` | `ForumService.CreateReplyAsync` | Recipient == reply author |
| 5 | `CommunityBroadcast` | `AdminController.Broadcast` (admin-only) | None — explicit admin push |
| 6 | `EventPublished` | `EventsController.CreateEvent` when `visibility == Public` | None |
| 7 | `EventReminder` | Worker scheduler, 24h before `event.date` | Already reminded; user unregistered between schedule and send |
| 8 | `EventInviteReceived` | Admin issues an invite with `targetUserId` (new optional field on `EventInviteEntity`) | None |
| 9 | `RankUp` | After every `IUserService.IncrementCounterAsync`, compare new computed rank to old; fire if changed | `RankOverride` active (overridden ranks don't trigger transitions) |

**Anonymous likes:** when `LikeReceived` fires and the sender's `Settings.AnonymousLikes == true`, the payload omits `actorId` and `actorName`. Renders as "Someone liked your profile."

---

## Storage schema (5 new Azure Tables)

Brings total tables 23 → 28. All names respect existing `AZURE_TABLE_PREFIX`.

### `notifications` — canonical record

| Key | Value |
|---|---|
| PartitionKey | `userId` (recipient) |
| RowKey | `{invertedTicks}_{notificationId}` (newest first; same pattern as `messages`, `forumreplies`) |
| Columns | `Type` (string enum), `ActorId?`, `PayloadJson` (type-specific), `CreatedAtUtc`, `ReadAtUtc?`, `DismissedAtUtc?`, `DigestGroupId?` |

`PayloadJson` shape per type (examples):
- `LikeReceived`: `{ "likeId": "...", "anonymous": false }`
- `MessageReceived`: `{ "chatId": "...", "messageId": "...", "preview": "Hey!" }` (preview ≤ 80 chars)
- `EventReminder`: `{ "eventId": "...", "eventTitle": "...", "eventDateUtc": "..." }`
- `RankUp`: `{ "previousRank": "novice", "newRank": "activeMember" }`
- `CommunityBroadcast`: `{ "title": "...", "body": "...", "link": "/aloevera/events/..." }`

### `notificationsoutbox` — per-(notification, channel) delivery attempt

Partition naming makes worker scans O(partition-size) rather than table-scan:

| Key | Value |
|---|---|
| PartitionKey | `OUTBOX_{channel}_PENDING` for pending; `OUTBOX_{channel}_DONE_{yyyy-MM-dd}` after delivery; `OUTBOX_{channel}_DEAD_{yyyy-MM-dd}` after 5 failed attempts |
| RowKey | `{scheduledForUtc:yyyy-MM-ddTHH:mm:ss}_{notificationId}` — lex sort = chronological, supports `RowKey <= now` range filter |
| Columns | `UserId`, `NotificationId`, `Channel` (enum string), `Frequency` (immediate / hourly / daily), `Attempts`, `LastErrorMessage?`, `DeliveredAtUtc?` |

Channel values: `inApp`, `telegram`, `webPush`, `email`.

Lifecycle: insert into `PENDING`; worker scans `RowKey <= now`; on success delete + insert into `DONE_{date}`; on failure update `Attempts` and re-schedule (re-insert at new RK). Daily janitor (in the same worker) deletes `DONE_*` and `DEAD_*` partitions older than 30 days.

### `webpushsubscriptions` — one row per (user, browser device)

| Key | Value |
|---|---|
| PartitionKey | `userId` |
| RowKey | `deviceId` (client-generated GUID stored in `localStorage` so the same browser re-uses it across visits) |
| Columns | `Endpoint`, `P256dh`, `Auth`, `UserAgent`, `CreatedAtUtc`, `LastSeenAtUtc` |

Push services return HTTP 404 or 410 when a subscription is gone — on either status the row is deleted at delivery time.

### `notificationpreferences` — one row per user

Separate from `users.SettingsJson` so prefs changes don't invalidate `UserCache`, and the worker can fetch prefs without loading the full user row.

| Key | Value |
|---|---|
| PartitionKey | `userId` |
| RowKey | `INDEX` |
| Columns | `MatrixJson`, `FrequencyJson`, `DailyDigestHourUtc` (int 0–23), `Mute` (bool), `MutedUntilUtc?` |

`MatrixJson` / `FrequencyJson` shape: see "Preferences model" below.

### `broadcasts` — admin community broadcast audit log

One row per `POST /api/v1/admin/notifications/broadcast` call so admins can see send progress and history.

| Key | Value |
|---|---|
| PartitionKey | `"BROADCAST"` (single partition — broadcasts are listed together, low volume) |
| RowKey | `{invertedTicks}_{broadcastId}` |
| Columns | `Title`, `Body`, `Link?`, `AudienceJson` (`{ type, value }`), `IssuedByUserId`, `IssuedAtUtc`, `EstimatedRecipients`, `DispatchedCount`, `Status` (`pending` / `completed`), `CompletedAtUtc?` |

---

## Preferences model

```json
{
  "matrix": {
    "likeReceived":       { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "matchCreated":       { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "messageReceived":    { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "forumReplyToThread": { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "communityBroadcast": { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "eventPublished":     { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "eventReminder":      { "inApp": true, "telegram": false, "webPush": false, "email": false },
    "eventInviteReceived":{ "inApp": true, "telegram": false, "webPush": false, "email": false },
    "rankUp":             { "inApp": true, "telegram": false, "webPush": false, "email": false }
  },
  "frequency": {
    "inApp":    "immediate",
    "telegram": "immediate",
    "webPush":  "immediate",
    "email":    "daily"
  },
  "dailyDigestHourUtc": 9,
  "mute": false,
  "mutedUntilUtc": null
}
```

**Defaults are conservative — all channels off except in-app, every type.** Users explicitly enable each (type, channel) cell they want. In-app is always on for every type and always immediate (the bell is the user's inbox; UI hides the in-app frequency selector). Web Push is always immediate (UI hides its frequency selector — digesting a push that fires a banner doesn't make sense).

Validator (server-side on `PUT /preferences`):
- All 9 type keys present; all 4 channel keys per type
- `inApp` always `true` for every type (enforced server-side; UI doesn't expose toggles to switch off)
- `frequency.inApp == "immediate"` and `frequency.webPush == "immediate"`
- `dailyDigestHourUtc` in `[0, 23]`
- `mutedUntilUtc` either null or in the future

A single helper, `NotificationPolicy.ResolveChannels(userId, type)`, returns the channel list to enqueue for a given notification. It reads prefs once, then filters out channels where:
- The matrix cell is `false`
- Master `mute` is `true`
- `mutedUntilUtc` is in the future
- The channel is unavailable: no `TelegramUserId` linked, no rows in `webpushsubscriptions`, email unverified

---

## Per-channel delivery mechanics

### In-app (SignalR)

Fires from **API process**. Existing `ChatHub` gains a server-to-client event:

```csharp
// Hub adds nothing client-callable; server calls:
await _hubContext.Clients.User(recipientId)
    .SendAsync("NotificationReceived", notificationDto);
```

SignalR's `IUserIdProvider` is wired to read the JWT `sub` claim on hub connect — already in `Program.cs`. Outbox row marked `delivered` immediately whether or not the user has an active connection; the canonical `notifications` row is the durable source, and the user picks it up from the bell on next page load.

### Telegram

Fires from **worker** only. Uses the existing `Telegram.Bot` NuGet (same dep `Lovecraft.TelegramBot` uses). `chatId == UserEntity.TelegramUserId` (private chats with the bot use the user's Telegram ID as the chat ID). Each message uses HTML parse mode plus an inline keyboard:

```
What you'd see:
  💬 New message from Anna: "Hey, are you going to the Moscow show?"

  [Open chat] [Mute these]
```

`[Open chat]` is a `t.me/{bot}?startapp=chat_{chatId}` deep link (handled by Mini App when MCF.17 polish lands; for now it just opens the bot).
`[Mute these]` is `callback_data=mute:messageReceived` — handled in `Lovecraft.TelegramBot`'s update handler, which makes an authenticated server-to-server call into `Lovecraft.Backend` (shared service token in env) to flip `prefs.matrix.messageReceived.telegram = false`.

Telegram's per-bot rate limit (~30 msg/s) and per-chat limit (~1 msg/s) are honored via a `SemaphoreSlim` in the worker — at most 25 concurrent sends, with a per-chatId 1-second cooldown.

### Web Push (VAPID)

Fires from **API process** only — validator enforces `frequency.webPush == "immediate"`. NuGet `WebPush` (libwebpush .NET port).

One VAPID keypair generated once at first deploy via `VapidHelper.GenerateVapidKeys()` (from the `WebPush` NuGet) — a tiny `dotnet run --project Lovecraft.Tools.VapidKeygen` console tool printed to stdout, then copy-pasted into env. Stored in env:
```
VAPID_PUBLIC_KEY=...      (Base64URL-encoded P-256 public key)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@aloeband.ru
```

Rotating the keypair invalidates every active subscription — users have to re-subscribe. Treat as a one-time setup; rotate only on key compromise.

Public key exposed via `GET /api/v1/push/vapid-public-key` (no auth required — public by definition). Frontend service worker (`public/sw.js`) registers the subscription, the React app posts `{ endpoint, p256dh, auth, deviceId, userAgent }` to `POST /api/v1/push/subscribe`.

API process loops over all `webpushsubscriptions` rows for the recipient, calls `WebPushClient.SendNotificationAsync(subscription, payloadJson)` for each (async, fire-and-forget). HTTP 404/410 → delete that subscription row. Other failures → log + skip (no retry of immediate push: the canonical in-app row remains, user sees it on next visit).

Service worker handles `push` and `notificationclick`:
```js
self.addEventListener('push', (e) => {
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icon-192.png', badge: '/badge.png',
    data: { url: data.url }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
```

### Email (SendGrid)

Fires from **worker only**. Uses existing `IEmailService` extended with:
```csharp
Task SendNotificationDigestAsync(string toEmail, NotificationDigestModel model);
```

Per-channel `frequency=immediate`: one email per notification (rare; user must opt in explicitly per type). Per-channel `frequency=daily` (default for email): worker scans pending email outbox rows scheduled for the user's `DailyDigestHourUtc` and rolls them into one templated message.

Template (HTML + plaintext fallback):
```
Subject: 3 new likes, 1 match, 5 messages today on AloeVera

You have N new notifications today.

NEW MATCHES (1)
  • Anna liked you back! [Open chat]

NEW LIKES (3)
  • Dmitry liked your profile
  • Someone liked your profile (anonymous)
  • Elena liked your profile

NEW MESSAGES (5)
  • Anna: "Hey, are you going to the Moscow show?"
  • Maria: "thanks!"
  • ... (truncated to 5 most recent)

Manage notifications: https://aloeve.club/settings#notifications
Unsubscribe from email digests: https://aloeve.club/notifications/unsubscribe?token=...
```

Unsubscribe link uses a signed one-time token (24h validity) that flips every email cell to `false` without requiring login.

---

## Digest aggregation

Worker's **digest aggregator** runs at the top of each hour (UTC). For each `(userId, channel)` pair:

1. Query `OUTBOX_{channel}_PENDING` filtered by `UserId == X AND Frequency IN ('hourly', 'daily') AND RowKey <= now`.
2. Group: `hourly` rows are dispatched this tick; `daily` rows are dispatched only when `now.Hour == prefs.DailyDigestHourUtc`.
3. **0 rows** → nothing.
   **1 row** → render as a single non-digest message (no "1 new notification" preamble).
   **2+ rows** → render one digest message.
4. Assign all member rows a shared `DigestGroupId` (GUID) written back to their `notifications` rows.
5. Move member outbox rows to `OUTBOX_{channel}_DONE_{date}`.

The digest renderer is per-channel: `ITelegramDigestRenderer`, `IEmailDigestRenderer`. Each produces a channel-appropriate payload. Empty-group rule: if every member type is muted in the user's current matrix (e.g. they changed prefs after enqueue), skip dispatch but still mark delivered (don't accumulate forever).

In-app and Web Push are validator-enforced to be `immediate` only — the aggregator skips them.

---

## Suppression rules

Applied at **producer time** (before enqueue), so we don't waste outbox writes on rows we'd skip on dispatch.

| Rule | Where |
|---|---|
| Don't notify on self-action | All producers — skip if `actorId == recipientId` |
| Don't notify if recipient blocked actor | Hook stub for future MCF.16 — `IBlockListService.IsBlockedAsync(recipientId, actorId)` returns `false` for now |
| Suppress `MessageReceived` if recipient is in the chat | Producer queries `IPresenceTracker` (new singleton) — tracks `chat-{id}` SignalR group membership via `OnConnectedAsync` / `OnDisconnectedAsync`; if recipient present, only write canonical row, skip outbox |
| Master `mute` flag | `NotificationPolicy.ResolveChannels` returns empty list |
| Snooze (`MutedUntilUtc > now`) | Same — empty list. Snooze does NOT swallow notifications; canonical row is still written. |
| Anonymous likes | `LikeReceived` payload omits `actorId` and `actorName`; renders as "Someone liked your profile" |

---

## Retry and failure handling

Per-outbox-row `Attempts` counter (max 5). On failure:
- `Attempts++`
- `LastErrorMessage` ← exception summary
- New `ScheduledForUtc = now + backoff(Attempts)` where backoff is `{ 30s, 2m, 10m, 1h, 6h }`
- Delete from `OUTBOX_{channel}_PENDING` at old RK, re-insert at new RK

After 5 failed attempts, move row to `OUTBOX_{channel}_DEAD_{yyyy-MM-dd}` and `LogError` (Application Insights metrics tracked under TD.5 follow-up).

Per-channel error semantics:
- **Telegram** `Forbidden: bot was blocked by the user` → dead-letter immediately AND clear every `prefs.matrix.*.telegram` (user signalled "go away")
- **Web Push** `HTTP 404 / 410 Gone` at send time → delete that one `webpushsubscriptions` row, don't retry the notification (other devices may still succeed)
- **SendGrid** 4xx → dead-letter immediately; 5xx → retry per backoff
- **SignalR** never errors at producer time (in-process fire-and-forget); no outbox-retry path

---

## Dedup

Two scenarios:

1. **REST + SignalR double-fire for messages**: existing chat already broadcasts `MessageReceived` from both `ChatsController.SendMessage` and `ChatHub.SendMessage`. The notification producer must run **only on the REST path** (the frontend always uses REST). Concretely the producer call lives inside `ChatsController.SendMessage` after `_hubContext.Clients.Group(...).SendAsync(...)`.
2. **Same-event retry / buggy double-call**: producer checks "is there already a `notifications` row with `(recipientId, type, actorId, sourceEventId)` in the last 60 seconds?" via a partition-scan on the recipient's notifications (cheap — partition scan with `Top: 20`). If so, skip enqueue.

`sourceEventId` is the natural primary key of the underlying event (e.g. `messageId` for messages, `replyId` for replies, `likeId` for likes). Different `sourceEventId` values bypass dedup, so three messages in five seconds correctly produce three notifications.

---

## Frontend

### Notification bell (header)

Added to each protected route's existing sticky header. Component: `src/components/notifications/NotificationBell.tsx`.

- Bell icon (lucide `Bell`). Badge: red dot for 1 unread, count for 2+, `9+` cap.
- Click → desktop: `Popover` (shadcn) showing 10 most recent (unread first then read); mobile: full-screen `Sheet`.
- Each row: type icon, actor avatar + name (or "Someone" if anonymous), one-line preview, relative time. Click navigates to source URL (chat, profile, event, topic).
- Footer: "Mark all as read" link · "See all" → `/notifications`.

Bell badge is live-updated via SignalR. New handler on existing `chatConnection`:

```ts
// src/hooks/useNotificationSignalR.ts
const { addNotification } = useNotificationStore();
useEffect(() => {
  return chatConnection.on('NotificationReceived', addNotification);
}, [addNotification]);
```

Lightweight Zustand store at `src/stores/notificationStore.ts` for unread count + last-N cache. Replaces the per-page fetch pattern for this one feature (one of the first cases where global state earns its keep — TD.3 first concrete win).

### `/notifications` page

`src/pages/Notifications.tsx`. Full history, paginated (cursor-based), filter chips (All / Unread / per-type), bulk actions (mark-all-read, dismiss-selected). Same row component as the dropdown for visual consistency.

### Settings — Notifications section

New section in `src/pages/SettingsPage.tsx`, collapsible accordion. Component: `src/components/settings/NotificationPreferences.tsx`.

```
Notifications [^]
  ┌────────────────────────────────────────────┐
  │ [ ] Pause all notifications                │
  │ Snooze for: [ never ▼ ]  (1h / 4h / 24h / specific date) │
  └────────────────────────────────────────────┘

  ── In-app ──────────────────────────────────
  (always immediate; bell + dropdown)
  Type                              [Toggle]
  New like                            [ON]
  New match                           [ON]
  ...

  ── Telegram ───────────────────────────────
  Linked as @anna_telegram  ·  Frequency: [Immediate ▼]
  New like                            [OFF]
  ...

  ── Browser push ───────────────────────────
  2 devices subscribed  ·  Frequency: [Immediate]  (locked)
  [Enable on this device]
  ...

  ── Email ──────────────────────────────────
  noreply@example.com  ·  Frequency: [Daily digest ▼]
  ...

  Daily digest hour (UTC):  [09:00 ▼]
  (Shown only if any channel set to Daily.)

  [Save changes]
```

If a channel is unavailable (Telegram not linked, no Web Push subs, email unverified), its block greys out with a "Link Telegram" / "Enable on this device" / "Verify email" CTA. Save → `PUT /api/v1/notifications/preferences`.

### Service worker

New file `public/sw.js`:
```js
self.addEventListener('push', (e) => {
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icon-192.png', badge: '/badge.png',
    data: { url: data.url }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
```

Registered on explicit "Enable on this device" click in settings (not on first visit — the permission prompt requires a user gesture anyway). Helper at `src/lib/webPush.ts` wraps `navigator.serviceWorker.register` + `pushManager.subscribe({ applicationServerKey })` + `POST /push/subscribe`.

---

## Backend services and helpers

New under `Lovecraft.Backend/Services/`:

```
INotificationService                          // CRUD on notifications + outbox
  ├── MockNotificationService
  └── Azure/AzureNotificationService

INotificationPreferenceService                // read + update prefs
  ├── MockNotificationPreferenceService
  └── Azure/AzureNotificationPreferenceService

IPushSubscriptionService                      // CRUD on webpushsubscriptions
  ├── MockPushSubscriptionService
  └── Azure/AzurePushSubscriptionService

IPresenceTracker (singleton)                  // tracks SignalR group membership
  └── chat-{id} / topic-{id} → set of userIds

NotificationPolicy (static)                   // ResolveChannels(userId, type) → list
NotificationDeduper                           // 60s same-source-event window
```

New under `Lovecraft.Backend/Services/Notifications/`:
- `IInAppDispatcher` (uses `IHubContext<ChatHub>`)
- `IWebPushDispatcher` (uses `WebPushClient`)
- `INotificationProducer` — facade injected into controllers + services; `ProduceAsync(NotificationType, recipientId, actorId?, payload)` does: dedup check → write notifications row → resolve channels → write outbox rows → in-process dispatch for inApp + webPush.

Producer call sites:
- `MatchingService.CreateLikeAsync` — for `LikeReceived` and `MatchCreated`
- `ChatsController.SendMessage` — for `MessageReceived`
- `ForumService.CreateReplyAsync` — for `ForumReplyToThread`
- `EventsController.CreateEvent` — for `EventPublished`
- `AdminController.IssueInvite` (extended) — for `EventInviteReceived`
- `AzureUserService.IncrementCounterAsync` — for `RankUp` (after increment, compute new rank, compare to entity's `LastComputedRank` cached field; if changed, fire)
- `AdminController.Broadcast` — for `CommunityBroadcast` (loops audience)

New under `Lovecraft.NotificationsWorker/` (new project):

```
Program.cs              // Host.CreateApplicationBuilder + AddHostedService<DispatcherWorker> + DigestWorker + EventReminderWorker + JanitorWorker
DispatcherWorker        // 10s tick: drain OUTBOX_{channel}_PENDING for telegram + email
DigestWorker            // top of each hour: aggregate hourly + (when matches user hour) daily
EventReminderWorker     // 5m tick: scan events for date BETWEEN now+23h AND now+25h
JanitorWorker           // daily 03:00 UTC: delete OUTBOX_*_DONE_* and OUTBOX_*_DEAD_* partitions older than 30d; delete notifications rows older than 90d
Dispatchers/
  ITelegramDispatcher   // Telegram.Bot SendMessageAsync
  IEmailDispatcher      // wraps IEmailService.SendNotificationDigestAsync
Renderers/
  ITelegramRenderer     // single + digest text + inline keyboard
  IEmailRenderer        // single + digest HTML/plaintext templates
```

Worker shares `Lovecraft.Common` DTOs. Storage entity classes (`NotificationEntity`, `NotificationOutboxEntity`, `NotificationPreferencesEntity`, `WebPushSubscriptionEntity`, `BroadcastEntity`) are **duplicated** in the worker project rather than referenced from `Lovecraft.Backend` — matches the existing `Lovecraft.TelegramBot` pattern and avoids cross-project coupling. If the entities drift, integration tests in the backend (which exercise the same tables through real reads/writes) will catch the schema mismatch.

---

## API endpoints

```
Authenticated, user-facing:
  GET    /api/v1/notifications?cursor=&limit=20      → paginated list (newest first)
  GET    /api/v1/notifications/unread-count          → { count: int }
  POST   /api/v1/notifications/{id}/read             → mark one read
  POST   /api/v1/notifications/mark-all-read         → bulk mark
  DELETE /api/v1/notifications/{id}                  → dismiss (sets DismissedAtUtc)
  GET    /api/v1/notifications/preferences           → current prefs
  PUT    /api/v1/notifications/preferences           → full replace (validator above)

Web Push:
  GET    /api/v1/push/vapid-public-key               → { publicKey } (no auth required)
  POST   /api/v1/push/subscribe                      → body { endpoint, p256dh, auth, deviceId?, userAgent? }
  DELETE /api/v1/push/subscribe/{deviceId}           → unsubscribe this device

Unsubscribe (email link, no auth required):
  GET    /api/v1/notifications/unsubscribe?token=    → flips email column off, returns small HTML page

Admin (require StaffRole=admin):
  POST   /api/v1/admin/notifications/broadcast       → enqueue community broadcast
  GET    /api/v1/admin/notifications/broadcasts      → list past broadcasts (paginated)
  GET    /api/v1/admin/notifications/broadcasts/{id} → status + dispatched count
```

Rate-limit `POST /push/subscribe` under the existing `AuthRateLimit` bucket (defensive against subscription spam from a compromised client).

---

## Admin community broadcast

Request body:
```json
{
  "title": "string (≤ 100)",
  "body": "string (≤ 1000)",
  "link": "/aloevera/events/123",
  "audience": {
    "type": "all" | "attendingEvent" | "minRank" | "staffRole",
    "value": "<eventId | rank name | role name>"
  }
}
```

Synchronous response `{ broadcastId, estimatedRecipients }`; actual fan-out runs in a background `Task.Run` plus a small `broadcasts` table row tracking `Status` and `DispatchedCount`. For >10k recipients we'd want batched enqueue with backpressure (semaphore + chunk size); for current scale a straight loop is fine.

Admin UI gets a new `/admin/broadcasts` page: compose form + history list with status. Endpoint guarded by `[RequireStaffRole("admin")]`; a new permission key `send_broadcast` is added to `appconfig.permissions` so the threshold can be lowered to moderator later without code changes — but the attribute defaults to admin.

---

## Configuration

```
# Web Push (required for browser push channel)
VAPID_PUBLIC_KEY=...                  # base64url-encoded P-256 public key
VAPID_PRIVATE_KEY=...                 # base64url-encoded P-256 private key
VAPID_SUBJECT=mailto:noreply@aloeband.ru

# Worker process (Lovecraft.NotificationsWorker)
NOTIFICATIONS_WORKER_DISPATCH_INTERVAL_SECONDS=10
NOTIFICATIONS_WORKER_REMINDER_SCAN_INTERVAL_MINUTES=5
NOTIFICATIONS_WORKER_JANITOR_HOUR_UTC=3

# Shared service token used by Lovecraft.TelegramBot callback handler
# when calling back into Lovecraft.Backend to mutate prefs (e.g. on "Mute these" callback).
# Worker writes outbox status directly to storage — does NOT need this token.
INTERNAL_SERVICE_TOKEN=<random 32-byte hex>
```

Worker reads `USE_AZURE_STORAGE` and `AZURE_STORAGE_CONNECTION_STRING` the same way the backend does (shared `env_file: ../../lovecraft/Lovecraft/.env`).

`docker-compose.yml` (frontend repo) gains a third backend service:
```yaml
notifications-worker:
  build:
    context: ../../lovecraft/Lovecraft
    dockerfile: Dockerfile.notifications-worker
  env_file: ../../lovecraft/Lovecraft/.env
  depends_on:
    - backend
  restart: unless-stopped
```

---

## Tests

xUnit, following existing patterns in `Lovecraft.UnitTests/` (`[CollectionBehavior(DisableTestParallelization = true)]` for the suite).

- `NotificationPolicyTests` — `ResolveChannels` permutations: mute on, snooze active, anonymous like, dead Telegram link, no push subs, unverified email
- `NotificationProducerTests` — each of 9 triggers writes correct `notifications` + `notificationsoutbox` rows; self-action suppression; in-chat suppression; dedup within 60s window; different sourceEventId bypasses dedup
- `NotificationOutboxDispatcherTests` — pending scan returns due rows, retry backoff schedule, dead-letter after 5 attempts, partition movement on success/failure
- `DigestAggregatorTests` — hourly bucketing, daily at user's hour, empty-group skip, single-row renders without digest preamble
- `WebPushTests` — subscription lifecycle (subscribe + LastSeen update + 410 → delete), VAPID encoding round-trip with `WebPush` library
- `TelegramDigestRendererTests`, `EmailDigestRendererTests` — snapshot tests of formatted output
- `EventReminderSchedulerTests` — 24h window math, idempotency (rerun doesn't re-remind), attendee unregistered between schedule and send → skip
- `BroadcastTests` — audience expansion for each `type`, async dispatch, admin auth required
- `NotificationsControllerTests` — integration via `WebApplicationFactory<Program>`: list / read / dismiss / preferences flows
- `PresenceTrackerTests` — group join/leave / multiple connections per user / disconnect cleans up

Frontend (Vitest):
- `notificationsApi.test.ts`, `pushApi.test.ts` — service mocks
- `NotificationBell.test.tsx` — badge counts (0, 1, 9, 10), dropdown render with mixed read/unread, mark-as-read flow
- `NotificationPreferences.test.tsx` — matrix rendering, channel-unavailable greyed state, daily hour picker shown/hidden based on selected frequencies, save flow
- `useNotificationSignalR.test.tsx` — incoming `NotificationReceived` updates store + bumps badge
- `notificationStore.test.ts` — store reducers (add / mark read / mark all read / dismiss)

---

## Phasing

Even though we're building the whole thing, shipping in phases means each lands in `main` with green tests and demonstrably works in production.

| # | Phase | What ships |
|---|---|---|
| A | Foundations | 4 new tables, DTOs, enums, `INotificationService` + Mock/Azure, `INotificationPreferenceService`, basic CRUD endpoints, `NotificationPolicy.ResolveChannels`, `NotificationDeduper`, `IPresenceTracker` |
| B | In-app + producers | All 9 producers wired; SignalR `NotificationReceived`; bell UI + dropdown + `/notifications` page + unread badge. Other channels are no-ops because defaults are off. |
| C | Worker scaffold | `Lovecraft.NotificationsWorker` project + Dockerfile + compose service; `DispatcherWorker` loop (channel impls empty); `JanitorWorker`; `DigestWorker` skeleton |
| D | Telegram | Worker dispatches Telegram outbox; inline keyboard + callback handling in `Lovecraft.TelegramBot`; UI toggle to enable Telegram column meaningful |
| E | Web Push | VAPID setup; `sw.js`; `/push/subscribe` endpoints; API-side immediate push; UI "Enable on this device" |
| F | Email digests | `SendNotificationDigestAsync` + template; worker daily digest path; UI frequency selector becomes meaningful; signed unsubscribe link |
| G | Event reminders + admin broadcast | `EventReminderWorker`; `/admin/notifications/broadcast` + admin UI page; `broadcasts` table |
| H | Rank-up | `IncrementCounterAsync` delta hook; `RankUp` producer |

Each phase merges independently. Phases C–H can in principle ship in any order after C is in (Telegram, push, email, reminders, broadcast, rank-up don't depend on each other). The order above tracks roughly increasing complexity and reflects "what makes the most useful demo next".

---

## Documentation updates

- New backend doc: `lovecraft/Lovecraft/docs/NOTIFICATIONS.md` — full reference covering producers, channels, worker loops, retry, dedup
- `lovecraft/Lovecraft/docs/AZURE_STORAGE.md` — add the 4 new tables to the schema list
- `lovecraft/Lovecraft/docs/ARCHITECTURE.md` — add notifications layer to the architecture diagram; add `Lovecraft.NotificationsWorker` to project structure
- `lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md` — note the new `NotificationReceived` server event
- `aloevera-harmony-meet/docs/API_INTEGRATION.md` — new `notificationsApi`, `pushApi` services
- `aloevera-harmony-meet/docs/FEATURES.md` — new section 10 covering notifications UX
- `aloevera-harmony-meet/AGENTS.md` — add notification preferences pattern, presence tracker, producer pattern
- `aloevera-harmony-meet/docs/ISSUES.md` — close MCF.4
- `aloevera-harmony-meet/docs/RESOLVED_ISSUES.md` — append resolution entry
