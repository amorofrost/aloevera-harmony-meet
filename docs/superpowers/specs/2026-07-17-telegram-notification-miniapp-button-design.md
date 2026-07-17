# Telegram Notification Button → Mini App (guaranteed auth)

**Date**: 2026-07-17
**Status**: Approved (design)
**Repos**: `lovecraft` (backend renderer), `aloevera-harmony-meet` (frontend mini app entry)

---

## Problem

Telegram notification messages (new message, like received, match, event, broadcast,
rank-up, etc.) carry two inline buttons: **Open in app** and **Mute these**.

The **Open in app** button is currently an `InlineKeyboardButton.WithUrl(...)` pointing at
`https://aloeve.club/<deep-path>`. Telegram opens plain `WithUrl` links in its **in-app
browser view**, which runs an ordinary web session. If the user is signed out in that
WebView, they land on the login screen — the notification does not carry them into an
authenticated session.

By contrast, the bot's blue Mini App menu button (which opens the named mini app
`t.me/aloeveclub_bot/aloevera`, served from `aloeve.club/tg`) always opens a **Mini App
WebView** with a signed `initData` payload, which the app exchanges for a session via
`/auth/telegram-miniapp-login` — i.e. **guaranteed auth** for any linked Telegram account.

**Goal**: make the notification **Open in app** button open the Mini App WebView (guaranteed
auth) and land on the exact content the notification refers to, instead of the in-app
browser view. The **Mute these** button is unchanged.

---

## Approach

Use a Telegram **`web_app` inline keyboard button** (`InlineKeyboardButton.WithWebApp`)
instead of a URL button. `web_app` buttons:

- open the Web App WebView with `initData` injected (→ guaranteed auth via the existing
  `MiniAppEntry` → `/auth/telegram-miniapp-login` flow);
- are supported **in private chats between a user and the bot** — exactly where
  notifications are delivered;
- take an ordinary HTTPS URL, so the target route rides as a **plain query string**
  (`?dest=<encoded relative path>`) with no length/charset limits. This cleanly covers every
  notification type, including `CommunityBroadcast`'s arbitrary same-domain link.

Rejected alternative — a `t.me/aloeveclub_bot/aloevera?startapp=<token>` URL button: matches
the exact named-app path but caps the payload at 64 chars of `[A-Za-z0-9_-]`, which does not
fit `CommunityBroadcast` links, and requires wiring the bot username / app short name into
the NotificationsWorker. The `web_app` button needs no new config.

Functionally the `web_app` URL (`https://aloeve.club/tg`) **is** the same web app as the
named mini app; only Telegram's launch/labelling differs. `initData` is delivered either way.

---

## Backend changes — `Lovecraft.NotificationsWorker/Renderers/TelegramMessageRenderer.cs`

1. Add `private const string MiniAppUrl = "https://aloeve.club/tg";` (keep `AppBaseUrl` for
   the broadcast same-domain validation).
2. Rename `BuildOpenUrl` → **`BuildDestPath`**, returning a **relative SPA path** (leading
   `/`, no domain prefix):

   | Notification type | `dest` path |
   |---|---|
   | `LikeReceived`, `MatchCreated` | `/friends?userId={actorId}` — or `/friends` when `actorId` is null |
   | `MessageReceived` | `/talks?chat={chatId}` |
   | `ForumReplyToThread` | `/talks?topic={topicId}` |
   | `EventPublished`, `EventReminder`, `EventInviteReceived` | `/aloevera/events/{eventId}` |
   | `CommunityBroadcast` | relative path derived from the payload `link` (see below) |
   | `RankUp` | `/settings` |
   | default | `/` |

   Query-value segments (`actorId`, `chatId`, `topicId`, `eventId`) keep their existing
   `Uri.EscapeDataString` treatment.

3. `CommunityBroadcast` link resolution (adapt existing `ResolveCommunityBroadcastLink` to
   return a **relative** path):
   - empty → `/aloevera`;
   - absolute HTTPS URL whose host is `aloeve.club` / `www.aloeve.club` → use its
     `PathAndQuery`;
   - any other absolute URL (off-domain or non-HTTPS) → `/aloevera` (safe fallback,
     unchanged policy);
   - relative path → normalized to start with `/`.

4. Build the button:
   ```csharp
   var destPath   = BuildDestPath(notification.Type, notification.ActorId, payload);
   var webAppUrl  = $"{MiniAppUrl}?dest={Uri.EscapeDataString(destPath)}";
   var openButton = InlineKeyboardButton.WithWebApp("Open in app", new WebAppInfo { Url = webAppUrl });
   ```
   The `Mute these` `WithCallbackData` button and the message body rendering are untouched.

5. Implementation check: confirm the project's `Telegram.Bot` package version exposes
   `InlineKeyboardButton.WithWebApp` and `WebAppInfo` (both are standard in supported
   versions; add the `using Telegram.Bot.Types;` import for `WebAppInfo`).

No new environment variables or config. `TelegramSendClient` is unchanged (it already sends
whatever `InlineKeyboardMarkup` the renderer returns).

---

## Frontend changes — `aloevera-harmony-meet/src/pages/MiniAppEntry.tsx`

1. Add a `sanitizeDest(raw: string | null): string | null` helper (module-scope, unit-
   testable):
   - read from `new URLSearchParams(window.location.search).get('dest')` at the call site;
   - accept **only** a same-app relative path: value must start with a single `/` and **not**
     `//` (rejects protocol-relative and absolute URLs). Otherwise return `null`.
   - This bounds post-auth navigation to in-app routes (no open-redirect surface).
2. In the `signedIn` branch, set post-auth navigation priority:
   1. existing invite deep-link handling (`inviteFromDeepLink`) — unchanged;
   2. **`dest`** (when `sanitizeDest` returns non-null) → `navigate(dest, { replace: true })`;
   3. otherwise `navigateAfterAuth(navigate, user)` (default `/friends`) — unchanged.
3. The `needsRegistration` branch is unreachable for notification recipients (they are always
   linked Telegram accounts). Leave its default behavior; add a one-line comment noting the
   `dest` param is intentionally ignored there.

---

## Testing

**Backend** — `Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs`
- Update `All_notifications_have_open_in_app_button_with_aloeve_url`: the open button now
  carries `WebApp` (not `Url`). Assert `openButton.WebApp` is non-null and
  `openButton.WebApp.Url` starts with `https://aloeve.club/tg?dest=`.
- Add per-type assertions that the decoded `dest` equals the expected relative path
  (`MessageReceived` → `/talks?chat=c1`; `EventReminder` → `/aloevera/events/e1`;
  `LikeReceived` with actor → `/friends?userId=...`; `RankUp` → `/settings`).
- Add a `CommunityBroadcast` off-domain-link case asserting the `dest` falls back to
  `/aloevera`.
- Keep the existing `Mute these` callback-button test as-is (regression guard that it is
  untouched).

**Frontend**
- Add a focused unit test for `sanitizeDest`: accepts `/talks?chat=c1` and `/aloevera/events/e1`;
  rejects `//evil.com`, `https://evil.com`, `` (empty), and `null`.

---

## Out of scope

- Email digest links, in-app notification links, and the `Mute these` button.
- The broader MCF.17 `startapp` deep-link scheme (`?startapp=event_{id}` etc.).
- Any change to the named mini app / BotFather configuration.

---

## Data flow

```
notification row
  → TelegramMessageRenderer builds  https://aloeve.club/tg?dest=<url-encoded /path>  web_app button
  → user taps "Open in app"
  → Telegram opens Mini App WebView with signed initData
  → MiniAppEntry posts initData to /auth/telegram-miniapp-login  (guaranteed auth)
  → on signedIn, navigate(sanitizeDest(dest))  →  exact content
```
