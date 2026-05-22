# Notifications & Feed — Architecture Reference

**Last updated:** 2026-05-22
**Status:** MCF.4 resolved (all 8 phases A–H shipped 2026-05-18/19). Post-phase polish landed through 2026-05-22.

This is the single index for the notification + feed subsystem. Pick it up here when you return to this area — links into deeper docs from each section.

---

## TL;DR

- 9 notification types (Like, Match, Message, ForumReply, CommunityBroadcast, EventPublished, EventReminder, EventInviteReceived, RankUp).
- 4 channels — **in-app SignalR** (always-on), **Telegram** (opt-in), Web Push (opt-in, hidden in UI for now), Email (opt-in, hidden in UI for now).
- 9 producer call sites in `Lovecraft.Backend` services emit canonical notification rows + outbox rows per channel resolved from per-user preferences.
- Separate worker container (`Lovecraft.NotificationsWorker`) drains the outbox for Telegram + Email; runs digest aggregation + janitor + event-reminder scheduling.
- In-process channels (in-app + Web Push) dispatch directly from the API request thread (Web Push is fire-and-forget via `_ = Task.Run(...)`).
- Frontend renders notifications as: bell dropdown (10 most recent), `/notifications` list, and `/feed` rich-card page (5th bottom-nav button, feature-flagged).

---

## High-level architecture

```
                  ┌─────────────────────────────────────────────┐
   User actions   │                Lovecraft.Backend             │
   (like, msg,   →│                                              │
    reply, etc.)  │  ┌──────────────────┐                        │
                  │  │ Producer call    │  fires producer for    │
                  │  │ sites (services) │  each notification     │
                  │  └────────┬─────────┘                        │
                  │           │                                  │
                  │           ▼                                  │
                  │  ┌──────────────────┐  resolves channels    │
                  │  │NotificationProducer│ from prefs +         │
                  │  │   .ProduceAsync   │ availability matrix  │
                  │  └────────┬─────────┘                        │
                  │      │    │    │   │                         │
                  │      ▼    ▼    ▼   ▼                         │
                  │   Canonical InApp WebPush Outbox             │
                  │   row in    via    via   (Telegram +         │
                  │   table   SignalR  VAPID  Email rows)        │
                  └─────┬─────────────────────────┬──────────────┘
                        │                          │
                        ▼                          ▼
                 Frontend reads          ┌──────────────────────┐
                 via REST + SignalR      │ NotificationsWorker  │
                 (bell, /notifications,  │  - DispatcherWorker  │
                  /feed)                 │  - DigestWorker      │
                                         │  - EventReminderWorker│
                                         │  - JanitorWorker     │
                                         └──────────┬───────────┘
                                                    │
                                       Telegram API + SendGrid
```

---

## Backend

### Storage (Azure Tables)

5 tables specific to notifications + feed feature flags + forum subscriptions:

| Table | Partition / Row keys | Purpose |
|---|---|---|
| `notifications` | PK=recipientUserId, RK=`{invertedTicks}_{notificationId}` | Canonical inbox row. Source of truth. |
| `notificationsoutbox` | PK=`OUTBOX_{channel}_{state}` (`PENDING` / `DONE_{date}` / `DEAD_{date}`), RK=`{scheduledForUtc}_{notificationId}` | Per-channel delivery state. Worker drains the PENDING partitions. |
| `notificationpreferences` | PK=userId, RK=`INDEX` | Per-user matrix + frequency + mute/snooze. |
| `webpushsubscriptions` | PK=userId, RK=deviceId | One row per (user, browser device). |
| `broadcasts` | PK="BROADCAST", RK=`{invertedTicks}_{broadcastId}` | Admin community broadcast audit + status. |
| `forumtopicsubscriptions` | PK=topicId, RK=userId | Drives `ForumReplyToThread` fanout (Phase G+ post-polish). |

`appconfig` partitions consumed by this area:
- `features` (added 2026-05-21): `feed_enabled` (default `true`).
- `permissions`: `send_broadcast` (default `"admin"`).

### Services + key files

- `Lovecraft.Backend/Services/Notifications/` — `INotificationProducer` (the facade), `IInAppDispatcher`, `IWebPushDispatcher`, `WebPushPayloadRenderer`, `NotificationPolicy.ResolveChannels`, `NotificationDeduper`, `IPresenceTracker`, `IBroadcastAudienceResolver`.
- `Lovecraft.Backend/Services/Azure/AzureNotificationService.cs` + `MockNotificationService.cs` — CRUD on the canonical + outbox tables. Both resolve actor name + avatar at read time via injected `IUserService` (so the frontend bell/feed renders `"Anna liked your profile"` instead of `"liked your profile"`).
- `Lovecraft.Backend/Services/Azure/AzureNotificationPreferenceService.cs` + Mock — per-user prefs.
- `Lovecraft.Backend/Services/Azure/AzurePushSubscriptionService.cs` + Mock — Web Push subs.
- `Lovecraft.Backend/Services/Azure/AzureBroadcastService.cs` + `MockBroadcastService.cs` + `IBroadcastService` — admin broadcasts.
- `Lovecraft.Backend/Services/Azure/AzureForumSubscriptionService.cs` + `MockForumSubscriptionService.cs` + `IForumSubscriptionService` — forum topic subscriptions.
- `Lovecraft.Backend/Services/Email/` — `SendGridEmailService` + `NullEmailService` (worker uses SendGrid directly via `IEmailSendClient`).

### Producer call sites (9 / 9 wired)

| Producer | Type | Suppression / notes |
|---|---|---|
| `MatchingService.CreateLikeAsync` (non-mutual) | LikeReceived | Self-action skip; anonymous-like payload omits actorId+name |
| `MatchingService.CreateLikeAsync` (mutual) | MatchCreated | Both users |
| `ChatsController.SendMessage` | MessageReceived | In-chat presence suppression via `IPresenceTracker` |
| `ForumService.CreateReplyAsync` | ForumReplyToThread | Fanout = `forumtopicsubscriptions` (was: topic author + every prior replier). Replier auto-subscribes |
| `EventsController.CreateEvent` (`AzureEventService` post-insert) | EventPublished | Only when `Visibility == Public`. Fanout to all users via `IUserService.GetUsersAsync(take: 10_000)` |
| `EventInviteService.IssuePersonalInviteAsync` | EventInviteReceived | Fires only when `TargetUserId` is set on the invite |
| `AdminNotificationsController.Broadcast` | CommunityBroadcast | Async fan-out via `_ = Task.Run(...)`. Audience: all / attendingEvent / minRank / staffRole |
| `EventReminderWorker` (in worker process) | EventReminder | 5-min tick; events with `Date ∈ [now+23h, now+25h]`; dedup via `sourceEventId = "event-reminder-{eventId}"` |
| `AzureUserService.IncrementCounterAsync` + Mock | RankUp | Injected as `Lazy<INotificationProducer>?` (breaks DI cycle). Fires only on strict `EffectiveLevel` increase. `RankOverride` short-circuits via `RankCalculator` (admin-overridden users never fire) |

### Conversation supersede (2026-05-22)

When a new `MessageReceived` lands, the producer hard-deletes prior notifications for the same `(recipient, chatId)` so the feed only shows the latest message per chat. Same for `ForumReplyToThread` per `(recipient, topicId)`. Other types are unaffected — each remains a discrete event.

Implementation: `NotificationProducer.SupersedeOlderAsync` runs after the canonical write. Uses `ExtractConversationKey(type, payloadJson)` to pull `chatId` / `topicId`; scans `ListAsync(userId, 200)`; calls `INotificationService.RemoveAsync` (hard delete, distinct from `DismissAsync` which only flags `DismissedAtUtc`).

Orphan outbox rows handled by `OutboxProcessor` — when the worker can't find the notification it dead-letters cleanly with `"Notification not found"`.

### Worker (`Lovecraft.NotificationsWorker`)

Background services in this order in `Program.cs`:

- `DispatcherWorker` (10s tick) — drains `OUTBOX_{Telegram,Email}_PENDING`. Backoff: `{30s, 2m, 10m, 1h, 6h}`, MaxAttempts=6, dead-letter after.
- `DigestWorker` (top-of-hour) — aggregates `Hourly` rows + `Daily` rows scheduled for the current UTC hour. Single-member groups render as non-digest messages.
- `EventReminderWorker` (5m tick) — see producer table above.
- `JanitorWorker` (daily 3am UTC) — deletes `OUTBOX_*_DONE_*` / `*_DEAD_*` partitions older than 30 days; deletes notifications rows older than 90 days.

Dispatchers + renderers:
- `TelegramDispatcher` + `TelegramMessageRenderer` (Phase D) — inline keyboard with `[Open]` + `[Mute these]`; rate limiter (25 concurrent + 1s/chat).
- `EmailDispatcher` + `EmailDigestRenderer` (Phase F) — SendGrid via `IEmailSendClient`; HMAC-SHA256 unsubscribe tokens (30d) via `Lovecraft.Common.UnsubscribeToken`.
- `StubTelegramDispatcher` + `StubEmailDispatcher` — fallback when env vars missing.

Worker is isolated from `Lovecraft.Backend` (no cross-project reference). Entity classes duplicated under `Lovecraft.NotificationsWorker/Entities/`.

### REST endpoints

```
User-facing (require JWT):
  GET    /api/v1/notifications?cursor=&limit=20
  GET    /api/v1/notifications/unread-count
  POST   /api/v1/notifications/{id}/read
  POST   /api/v1/notifications/mark-all-read
  DELETE /api/v1/notifications/{id}              (soft dismiss; sets DismissedAtUtc)
  GET    /api/v1/notifications/preferences
  PUT    /api/v1/notifications/preferences
  GET    /api/v1/notifications/availability       (telegramLinked, emailVerified, webPushSubscribed)

  GET    /api/v1/forum/topics/{id}/subscription   (returns { topicId, subscribed })
  POST   /api/v1/forum/topics/{id}/subscribe
  DELETE /api/v1/forum/topics/{id}/subscribe

Web Push:
  GET    /api/v1/push/vapid-public-key            (anonymous)
  POST   /api/v1/push/subscribe
  DELETE /api/v1/push/subscribe/{deviceId}

Unsubscribe (anonymous, HMAC token):
  GET    /api/v1/notifications/unsubscribe?token=...

Admin ([RequireStaffRole("admin")]):
  POST   /api/v1/admin/notifications/broadcast
  GET    /api/v1/admin/notifications/broadcasts
  GET    /api/v1/admin/notifications/broadcasts/{id}

Features (anonymous):
  GET    /api/v1/features                          ({ feedEnabled })
```

### SignalR

`/hubs/chat` adds a server-to-client `NotificationReceived` event; `IInAppDispatcher.DispatchAsync` calls `_hubContext.Clients.User(recipientId).SendAsync("NotificationReceived", dto)`. JWT carried via `?access_token=` query (WebSocket can't send Authorization header).

### Phase-by-phase backend doc

`Lovecraft/docs/NOTIFICATIONS.md` has the detailed phase-by-phase scope, env vars, and per-phase follow-ups. **Use it when you need the why behind a specific commit; this overview is for the current state.**

---

## Frontend

### Pages + components

- `src/pages/Notifications.tsx` — minimal list at `/notifications`. Used as a fallback when `feedEnabled` is false.
- `src/pages/Feed.tsx` — rich-card page at `/feed`. Same data source (`useNotificationStore`), rendered via `FeedCardForNotification` dispatcher. Header matches the AloeVera/Friends/etc. primary-page pattern (title + NotificationBell + Newspaper icon).
- `src/components/notifications/NotificationBell.tsx` — sticky bell, badge count, dropdown with last 10. "See all" routes to `/feed` when flag on, else `/notifications`.
- `src/components/notifications/NotificationDropdown.tsx` — the dropdown rendering.
- `src/components/notifications/NotificationItem.tsx` — single row used in dropdown + `/notifications`.
- `src/components/feed/` — 7 card components (`LikeFeedCard`, `MatchFeedCard`, `MessageFeedCard`, `ForumReplyFeedCard`, `EventFeedCard`, `BroadcastFeedCard`, `RankUpFeedCard`) + shared `FeedCard` shell + `feedContextCache.ts` (module-level promise caches dedup `usersApi.getUserById` / `eventsApi.getEventById` across cards).
- `src/components/settings/NotificationPreferences.tsx` — Settings page section. Matrix layout: rows = notification types, columns = In-app + Telegram. Web Push + Email column-sections hidden for now (backend cells still honored if set). Telegram availability + frequency picker live in a dedicated status row above the matrix.
- `src/admin/pages/AdminBroadcastsPage.tsx` — compose form + history table at `/admin/broadcasts`.

### State + services

- `src/stores/notificationStore.ts` — Zustand store (items, unreadCount, add/remove/markRead/markAllRead). One of the first concrete TD.3 wins.
- `src/hooks/useNotificationSignalR.ts` — subscribes to `NotificationReceived` once at protected-route mount.
- `src/services/api/notificationsApi.ts` — REST client.
- `src/services/api/featuresApi.ts` — `featuresApi.getFlags()` + `DEFAULT_FEATURE_FLAGS` (mirror backend).
- `src/contexts/FeatureFlagsContext.tsx` — provider + `useFeatureFlags()` hook. One-shot fetch at mount; falls back to defaults on failure (so a network blip never hides a feature behind an unreachable flag).
- `src/services/api/forumsApi.ts` — adds `getSubscription` / `subscribeToTopic` / `unsubscribeFromTopic`.
- `src/lib/notificationFormatting.ts` — `formatNotificationTitle(n, t)` + `formatNotificationLink(n)`. Title uses i18n templates with `{actor}` / `{title}` placeholders; link maps each type to its destination route (e.g. `messageReceived` → `/friends?tab=chats&chat={chatId}` per Friends.tsx routing).
- `src/lib/webPush.ts` — `isWebPushSupported`, `getSubscriptionStatus`, `enableWebPush`, `disableWebPush`.
- `src/hooks/useSmartBack.ts` — back-navigation helper. Calls `navigate(-1)` when there's prior history, falls back to a provided path when `location.key === 'default'` (fresh tab / deep link). Used by `EventDetails.tsx` and `Friends.tsx` private-chat back button so feed → detail page → back returns to feed.

### i18n keys

All notification copy lives in `src/contexts/LanguageContext.tsx` (ru + en). Key namespaces:
- `notifications.title.*` — per-type notification titles (use `{actor}`/`{title}`/`{preview}`/`{rank}` placeholders)
- `notifications.settings.type.*` — settings labels (plain, no placeholders — used in the matrix rows)
- `notifications.settings.channel.*`, `notifications.settings.frequency.*`, `notifications.settings.unavailable.*` — settings UI
- `nav.feed`, `notifications.feedTitle`, `feed.*` — Feed page
- `forum.subscribe` / `forum.unsubscribe` / `forum.subscribed` / `forum.subscribeFailed` — subscribe toggle

### Frontend AGENTS.md

Has scattered sections; see "Notification Formatting Helpers", "Web Push Channel", "Email Channel", "RankUp Notifications", "Admin Broadcasts + Event Reminders", "Client-visible Feature Flags", "Feed Page", "Forum Topic Subscriptions". For pattern-level guidance start there; for the architecture overview start here.

---

## Default preferences

All matrix cells default to `false` except `inApp` (forced true server-side for every type — the bell is always the user's inbox). Frequency: `inApp=immediate` (locked), `webPush=immediate` (locked), `telegram=immediate`, `email=daily`. `DailyDigestHourUtc=9`. `mute=false`. Web Push + Email channel toggles are hidden from the Settings UI for now.

---

## Feature flags

`appconfig.features` partition (loaded by `AzureAppConfigService` with 1-hour `IMemoryCache`):

| Key | Default | Effect |
|---|---|---|
| `feed_enabled` | `true` | When false: 5th bottom-nav button + `/feed` route hidden; bell "See all" routes to `/notifications` |

To add a flag: update `FeatureFlagsConfig` in `Lovecraft.Backend/Services/AppConfig.cs`, the reader in `AzureAppConfigService.BuildConfig`, `FeatureFlagsDto` in `Lovecraft.Common/DTOs/Features/`, `FeaturesController.GetFlags`, and frontend `FeatureFlags` + `DEFAULT_FEATURE_FLAGS` in `src/services/api/featuresApi.ts`. Defaults must match between backend and frontend.

---

## Permission keys

`appconfig.permissions`:

| Key | Default | Used by |
|---|---|---|
| `send_broadcast` | `"admin"` | `AdminNotificationsController` (currently gated by `[RequireStaffRole("admin")]` directly; the appconfig key exists so it can be demoted to moderator without code change) |

---

## Known follow-ups (open after 2026-05-22)

Carryover items not currently blocking:

- **Telegram digest** — `TelegramDispatcher.DispatchDigestAsync` not implemented; worker uses the single-member trick (sends the first member as a non-digest message). Fine for current scale.
- **Locale-aware rendering** — `Settings.Language` not read by any worker-side renderer (TelegramMessageRenderer, EmailDigestRenderer, WebPushPayloadRenderer). Currently English-only.
- **AppBaseUrl central config** — hardcoded across renderers; needs typed `IOptions<AppUrlOptions>` shared with all renderers.
- **Audience fan-out cap** — `BroadcastAudienceResolver` and `AzureEventService.CreateEventAsync` both use `take: 10_000` on user list. Above that scale we need pagination + chunked dispatch with semaphore.
- **Per-user email rate cap** — no daily cap. Misconfigured digest prefs could send unbounded mail.
- **Renderers reading `previousRank`** on RankUp — currently only render `newRank`. Payload already carries both.
- **Web Push + Email Settings UI** — channel toggles hidden for now (PR-by-PR sub-task to re-enable per channel as the user stories firm up).
- **Forum subscription backfill** — pre-existing forum participation (topic authorship + replies before 2026-05-22) is NOT auto-subscribed. Users who once replied to a topic but never re-engaged won't keep getting `ForumReplyToThread` notifications. One-shot backfill tool can be added if missed-notification complaints surface.
- **`/notifications` page deprecation** — kept as a fallback when `feed_enabled` is false; could be removed entirely once the flag is permanently on.
- **Smart back on `Talks.tsx`** — Forum topic detail back navigation still uses hardcoded `setSearchParams`. `useSmartBack` not wired there; if forum-reply notifications start prompting back-nav complaints, apply the same hook.

---

## Test surface

| Suite | Count | Key files |
|---|---|---|
| Backend (Lovecraft.UnitTests) | 537 | `NotificationProducerTests`, `NotificationServiceTests`, `NotificationsControllerTests`, `NotificationPreferenceServiceTests`, `NotificationDeduperTests`, `EventReminderProcessorTests`, `DispatcherWorkerTests`, `DigestProcessorTests`, `OutboxProcessorTests`, `JanitorTests`, `TelegramDispatcherTests`, `EmailDispatcherTests`, `WebPushDispatcherTests`, `BroadcastServiceTests`, `BroadcastAudienceResolverTests`, `AdminNotificationsControllerTests`, `ForumSubscriptionServiceTests`, `UserServiceRankUpTests`, `FeaturesControllerTests`, `AppConfigServiceTests`, `UnsubscribeTokenTests` |
| Frontend (vitest) | 245 | `notificationFormatting.test`, `NotificationBell.test`, `NotificationPreferences.test`, `webPush.test`, `Feed.test`, `AdminBroadcastsPage.test`, plus integration coverage in chat / forum / events tests |

---

## Quick triage when something breaks in prod

```bash
ssh -i D:\src\misc\vm\april2026key.pem amorofrost@20.153.164.3
cd ~/src/aloevera-harmony-meet
docker compose logs --tail 100 backend                  # producer + in-app + Web Push
docker compose logs --tail 100 notifications-worker     # outbox dispatch + digest + reminders + janitor
docker compose logs --tail 100 telegram-bot             # mute-callback round trip
```

Most failures look like: producer ran (visible in backend logs) but channel didn't dispatch (missing env var → worker fallback to stub). Filter logs by user id or notification id to trace one specific row end-to-end.

---

## Phase history (for context)

| Phase | Date | What shipped |
|---|---|---|
| A | 2026-05-18 | Foundations: 4 tables, services, producer facade, controller, prefs |
| B | 2026-05-18 | In-app + 4 producers (Like, Match, Message, ForumReply); bell + dropdown + /notifications + prefs UI |
| C | 2026-05-18 | Worker scaffold + 3 background services + stub dispatchers |
| D | 2026-05-18 | Real Telegram dispatcher + inline keyboard + mute callback |
| E | 2026-05-18 | Web Push: VAPID, service worker, in-process dispatch, opt-in |
| F | 2026-05-18 | Email digest via SendGrid + HMAC unsubscribe |
| G | 2026-05-19 | Event reminders + admin broadcast + 3 remaining producers (EventPublished/EventInviteReceived/CommunityBroadcast) |
| H | 2026-05-19 | RankUp producer (closes MCF.4) |

Post-phase polish (no phase ID):

| Date | Change |
|---|---|
| 2026-05-20 | Settings UI: notification type labels (matrix labels were rendering as broken title-template strings); /talks?chat= bug fix → /friends?tab=chats&chat={chatId} |
| 2026-05-21 | Feed page + feature flags + 5th bottom-nav button; smart-back navigation; notification settings matrix layout (Web Push + Email hidden) |
| 2026-05-22 | Actor name resolution at read time; conversation supersede (chat/topic dedup); Feed page header aligned with primary-page pattern; smart-back on EventDetails + private chat; **forum topic subscriptions** (replaces implicit-participation fanout); `forumtopicsubscriptions` table (29th) |
