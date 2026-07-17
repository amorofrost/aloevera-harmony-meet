# Telegram Notification Button → Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Open in app" inline button on Telegram notification messages open the authenticated Mini App WebView and land on the exact content, instead of an unauthenticated in-app browser view.

**Architecture:** The backend NotificationsWorker renders the button as a Telegram `web_app` inline button (`InlineKeyboardButton.WithWebApp`) whose URL is `https://aloeve.club/tg?dest=<url-encoded relative path>`. Telegram opens that as a Mini App WebView with signed `initData`, which the existing `MiniAppEntry` page exchanges for a session (guaranteed auth). After sign-in, `MiniAppEntry` reads and sanitizes the `dest` query param and navigates there.

**Tech Stack:** C# / .NET 10, `Telegram.Bot` 22.4.4 (xUnit tests); React 18 + TypeScript + Vite, Vitest.

## Global Constraints

- Backend renderer file: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Renderers/TelegramMessageRenderer.cs`. The `lovecraft` repo root is `/home/amorofrost/src/lovecraft`.
- Frontend repo root: `/home/amorofrost/src/aloevera-harmony-meet` (branch `feature/telegram-notification-miniapp-button` already created).
- Mini App base URL is exactly `https://aloeve.club/tg`.
- `Telegram.Bot` 22.4.4 API (verified): `InlineKeyboardButton.WithWebApp(string text, Telegram.Bot.Types.WebAppInfo webApp)`; `WebAppInfo` has a parameterless constructor with a settable `Url` string; `InlineKeyboardButton.WebApp` exposes the `WebAppInfo` (its `.Url` is the string). A `web_app` button's `.Url` property is `null` — the URL lives at `.WebApp.Url`.
- The `Mute these` button (`WithCallbackData("Mute these", "mute:<camelType>")`) and all message-body rendering MUST remain byte-for-byte unchanged.
- `dest` values are **relative** SPA paths beginning with a single `/`. The renderer URL-encodes them with `Uri.EscapeDataString`; the frontend decodes via `URLSearchParams`.
- Backend commits go in the `lovecraft` repo; frontend commits go in the `aloevera-harmony-meet` repo. Each repo commits its own changes. End every commit message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Backend tests run with `dotnet test` from `/home/amorofrost/src/lovecraft/Lovecraft`. Frontend tests run with `npx vitest run <file>` from the frontend repo root.

---

## Task 1: Backend — render "Open in app" as a `web_app` button with a relative `dest` path

**Files:**
- Modify: `lovecraft/Lovecraft/Lovecraft.NotificationsWorker/Renderers/TelegramMessageRenderer.cs`
- Test: `lovecraft/Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs`

**Interfaces:**
- Consumes: nothing new. `NotificationModel` (fields `Type`, `ActorId`, `PayloadJson`) is unchanged; `ITelegramMessageRenderer.Render(NotificationModel) → (string Html, InlineKeyboardMarkup Keyboard)` signature is unchanged.
- Produces: the returned `InlineKeyboardMarkup` now has its open button as a `web_app` button — `openButton.WebApp.Url == "https://aloeve.club/tg?dest=<escaped path>"` and `openButton.Url == null`. The mute button is unchanged.

- [ ] **Step 1: Rewrite the existing button/URL tests to expect a `web_app` button + decoded `dest`**

Open `Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs`. Add `using System;` and `using System.Linq;` if not already resolved (the file already uses `SelectMany`/`FirstOrDefault`, so LINQ is in scope; `System` is implicitly available). Add this private helper inside the `TelegramMessageRendererTests` class (below the `_renderer` field):

```csharp
    // Extracts and decodes the relative dest path from the "Open in app" web_app button.
    private static string DestOf(InlineKeyboardMarkup keyboard)
    {
        var open = keyboard.InlineKeyboard.SelectMany(row => row).First(b => b.Text.Contains("Open"));
        Assert.Null(open.Url);                    // web_app button carries no plain Url
        Assert.NotNull(open.WebApp);
        var url = open.WebApp!.Url;
        Assert.StartsWith("https://aloeve.club/tg?dest=", url);
        const string marker = "?dest=";
        var encoded = url[(url.IndexOf(marker, StringComparison.Ordinal) + marker.Length)..];
        return Uri.UnescapeDataString(encoded);
    }
```

Replace the body of `All_notifications_have_open_in_app_button_with_aloeve_url` (rename it too) so it reads:

```csharp
    [Fact]
    public void Open_button_is_a_web_app_button_pointing_at_the_mini_app()
    {
        var notif = new NotificationModel("n3", "u1", "MatchCreated", "actor",
            "{\"matchId\":\"m1\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.NotNull(keyboard);
        var open = keyboard.InlineKeyboard.SelectMany(row => row).FirstOrDefault(b => b.Text.Contains("Open"));
        Assert.NotNull(open);
        Assert.Null(open!.Url);
        Assert.NotNull(open.WebApp);
        Assert.StartsWith("https://aloeve.club/tg?dest=", open.WebApp!.Url);
    }
```

Replace the two `CommunityBroadcast` URL tests so they assert the decoded relative `dest`:

```csharp
    [Fact]
    public void CommunityBroadcast_uses_payload_link()
    {
        var notif = new NotificationModel("n5", "u1", "CommunityBroadcast", null,
            "{\"title\":\"Big news\",\"body\":\"something\",\"link\":\"/aloevera/events/42\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/aloevera/events/42", DestOf(keyboard));
    }

    [Fact]
    public void CommunityBroadcast_disallows_off_domain_absolute_urls()
    {
        var notif = new NotificationModel("n7", "u1", "CommunityBroadcast", null,
            "{\"title\":\"X\",\"body\":\"Y\",\"link\":\"https://evil.example/phish\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/aloevera", DestOf(keyboard));
    }
```

Add per-type `dest` assertions:

```csharp
    [Fact]
    public void MessageReceived_dest_points_to_chat()
    {
        var notif = new NotificationModel("n8", "u1", "MessageReceived", "actor",
            "{\"chatId\":\"c1\",\"preview\":\"hi\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/talks?chat=c1", DestOf(keyboard));
    }

    [Fact]
    public void ForumReply_dest_points_to_topic()
    {
        var notif = new NotificationModel("n9", "u1", "ForumReplyToThread", "actor",
            "{\"topicId\":\"t1\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/talks?topic=t1", DestOf(keyboard));
    }

    [Fact]
    public void EventReminder_dest_points_to_event()
    {
        var notif = new NotificationModel("n10", "u1", "EventReminder", null,
            "{\"eventId\":\"e1\",\"eventTitle\":\"Show\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/aloevera/events/e1", DestOf(keyboard));
    }

    [Fact]
    public void LikeReceived_dest_targets_actor_profile()
    {
        var notif = new NotificationModel("n11", "u1", "LikeReceived", "actor-9",
            "{\"likeId\":\"l1\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/friends?userId=actor-9", DestOf(keyboard));
    }

    [Fact]
    public void RankUp_dest_points_to_settings()
    {
        var notif = new NotificationModel("n12", "u1", "RankUp", null,
            "{\"newRank\":\"aloeCrew\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.Equal("/settings", DestOf(keyboard));
    }
```

Leave `All_notifications_have_mute_callback_button`, `LikeReceived_anonymous_omits_actor`, `MessageReceived_uses_payload_preview`, and `Malformed_payload_renders_gracefully` unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter "FullyQualifiedName~TelegramMessageRendererTests"`
Expected: FAIL — compile succeeds but assertions fail (open button is still a `WithUrl` button, so `open.WebApp` is null / `open.Url` is non-null), e.g. `Assert.Null(open.Url)` fails and `DestOf` throws on the null `WebApp`.

- [ ] **Step 3: Change the renderer to emit a `web_app` button with a relative `dest` path**

In `TelegramMessageRenderer.cs`:

(a) Add the import at the top, alongside the existing `using Telegram.Bot.Types.ReplyMarkups;`:

```csharp
using Telegram.Bot.Types;
```

(b) Replace the class constant `private const string AppBaseUrl = "https://aloeve.club";` with:

```csharp
    private const string MiniAppUrl = "https://aloeve.club/tg";
```

(c) In `Render(...)`, replace these lines:

```csharp
        var openUrl  = BuildOpenUrl(notification.Type, notification.ActorId, payload);
        var muteData = $"mute:{ToCamelCase(notification.Type)}";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithUrl("Open in app", openUrl),
                InlineKeyboardButton.WithCallbackData("Mute these", muteData),
            },
        });
```

with:

```csharp
        var destPath  = BuildDestPath(notification.Type, notification.ActorId, payload);
        var webAppUrl = $"{MiniAppUrl}?dest={Uri.EscapeDataString(destPath)}";
        var muteData  = $"mute:{ToCamelCase(notification.Type)}";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("Open in app", new WebAppInfo { Url = webAppUrl }),
                InlineKeyboardButton.WithCallbackData("Mute these", muteData),
            },
        });
```

(d) Replace the `BuildOpenUrl` method with `BuildDestPath` (returns relative paths):

```csharp
    private static string BuildDestPath(string type, string? actorId, Dictionary<string, object?> payload)
    {
        return type switch
        {
            "LikeReceived" or "MatchCreated" => actorId is not null
                ? $"/friends?userId={Uri.EscapeDataString(actorId)}"
                : "/friends",
            "MessageReceived"    => $"/talks?chat={Uri.EscapeDataString(GetString(payload, "chatId"))}",
            "ForumReplyToThread" => $"/talks?topic={Uri.EscapeDataString(GetString(payload, "topicId"))}",
            "EventPublished" or "EventReminder" or "EventInviteReceived" =>
                $"/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            "CommunityBroadcast" => ResolveCommunityBroadcastPath(GetString(payload, "link")),
            "RankUp"             => "/settings",
            _                    => "/",
        };
    }
```

(e) Replace `ResolveCommunityBroadcastLink` with `ResolveCommunityBroadcastPath` (returns a relative path, same same-domain policy):

```csharp
    private static string ResolveCommunityBroadcastPath(string link)
    {
        if (string.IsNullOrEmpty(link))
            return "/aloevera";

        // A rooted path is already an in-app relative path. This MUST be checked before
        // Uri.TryCreate: on Unix a leading-'/' string parses as an absolute file:// URI
        // (Uri.TryCreate(..., Absolute) returns true), which would otherwise send every
        // relative link down the "disallowed absolute" fallback. Reject protocol-relative
        // '//host' (open-redirect surface) → safe default.
        if (link.StartsWith('/'))
            return link.StartsWith("//") ? "/aloevera" : link;

        if (Uri.TryCreate(link, UriKind.Absolute, out var absolute))
        {
            // Only allow absolute URLs pointing to the app's own domain; use just the path+query.
            if (absolute.Scheme == Uri.UriSchemeHttps &&
                (absolute.Host.Equals("aloeve.club", StringComparison.OrdinalIgnoreCase) ||
                 absolute.Host.Equals("www.aloeve.club", StringComparison.OrdinalIgnoreCase)))
            {
                return absolute.PathAndQuery;
            }
            // Disallowed absolute URL (off-domain or non-HTTPS) — safe default.
            return "/aloevera";
        }

        // Non-rooted, non-absolute (e.g. "aloevera") — treat as a path.
        return $"/{link}";
    }
```

> **Note (pre-existing baseline):** before this change, `CommunityBroadcast_uses_payload_link` **fails** on Linux for exactly the `Uri.TryCreate` file:// reason above (asserts `/aloevera/events/42`, gets `/aloevera`). The corrected resolver above makes the rewritten test pass, so Task 1 also clears that baseline failure. When Step 5 runs the full suite, expect the total failing count to drop by 1 relative to the pre-task baseline.

Leave `IsAnonymous`, `GetString`, `ToCamelCase`, and the `body` switch untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter "FullyQualifiedName~TelegramMessageRendererTests"`
Expected: PASS — all tests in the class green.

- [ ] **Step 5: Run the full worker/unit test suite to confirm no regressions**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test`
Expected: PASS — the whole `Lovecraft.UnitTests` suite is green (no other code referenced `BuildOpenUrl`/`ResolveCommunityBroadcastLink`; grep-confirmed they were private to the renderer).

- [ ] **Step 6: Commit (in the lovecraft repo, on a feature branch)**

```bash
cd /home/amorofrost/src/lovecraft
git checkout -b feature/telegram-notification-miniapp-button
git add Lovecraft/Lovecraft.NotificationsWorker/Renderers/TelegramMessageRenderer.cs \
        Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs
git commit -m "feat: open Telegram notification button as authenticated mini app

Render the 'Open in app' inline button as a web_app button pointing at
https://aloeve.club/tg?dest=<relative path> so it opens the Mini App
WebView with initData (guaranteed auth) and lands on the exact content,
instead of the unauthenticated in-app browser view. Mute button unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend — `sanitizeDest` helper (pure, unit-tested)

**Files:**
- Create: `aloevera-harmony-meet/src/lib/miniAppDest.ts`
- Test: `aloevera-harmony-meet/src/lib/__tests__/miniAppDest.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function sanitizeDest(raw: string | null | undefined): string | null` — returns `raw` unchanged when it is a safe same-app relative path (starts with exactly one `/`, i.e. starts with `/` and not `//`), otherwise `null`. Task 3 imports and calls this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/miniAppDest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeDest } from '@/lib/miniAppDest';

describe('sanitizeDest', () => {
  it('accepts a simple relative path', () => {
    expect(sanitizeDest('/friends')).toBe('/friends');
  });

  it('accepts a relative path with a query string', () => {
    expect(sanitizeDest('/talks?chat=c1')).toBe('/talks?chat=c1');
    expect(sanitizeDest('/aloevera/events/e1')).toBe('/aloevera/events/e1');
  });

  it('rejects a protocol-relative path', () => {
    expect(sanitizeDest('//evil.com')).toBeNull();
  });

  it('rejects an absolute URL', () => {
    expect(sanitizeDest('https://evil.com')).toBeNull();
    expect(sanitizeDest('http://evil.com/x')).toBeNull();
  });

  it('rejects a path that does not start with a slash', () => {
    expect(sanitizeDest('friends')).toBeNull();
  });

  it('rejects empty, null, and undefined', () => {
    expect(sanitizeDest('')).toBeNull();
    expect(sanitizeDest(null)).toBeNull();
    expect(sanitizeDest(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/lib/__tests__/miniAppDest.test.ts`
Expected: FAIL — module `@/lib/miniAppDest` does not exist (import/resolve error).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/miniAppDest.ts`:

```typescript
/**
 * Validate a post-auth navigation target passed to the Telegram Mini App via the
 * `?dest=` query param (e.g. from a notification's "Open in app" button).
 *
 * Only same-app relative paths are allowed: the value must start with a single `/`
 * (rejecting protocol-relative `//host` and absolute `scheme://` URLs). This bounds
 * navigation to in-app routes and removes any open-redirect surface.
 *
 * @returns the safe relative path, or null when the input is missing/unsafe.
 */
export function sanitizeDest(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/lib/__tests__/miniAppDest.test.ts`
Expected: PASS — all `sanitizeDest` cases green.

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/aloevera-harmony-meet
git add src/lib/miniAppDest.ts src/lib/__tests__/miniAppDest.test.ts
git commit -m "feat: add sanitizeDest helper for mini app deep-link routing

Validates the ?dest= post-auth navigation target as a same-app relative
path (rejects //host and scheme:// URLs) to prevent open redirects.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend — route `MiniAppEntry` to `dest` after sign-in

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/MiniAppEntry.tsx`

**Interfaces:**
- Consumes: `sanitizeDest` from `@/lib/miniAppDest` (Task 2).
- Produces: no new exports. Behavior change only: in the `signedIn` branch, after the existing invite deep-link handling, a valid `dest` param drives `navigate(dest, { replace: true })`.

- [ ] **Step 1: Import the helper**

In `src/pages/MiniAppEntry.tsx`, add to the existing import block (near the other `@/lib/...` imports, e.g. after the `navigateAfterAuth` import on line 18):

```typescript
import { sanitizeDest } from '@/lib/miniAppDest';
```

- [ ] **Step 2: Read and sanitize the `dest` param at mount**

Directly below the existing line

```typescript
  const inviteFromDeepLink = inviteFromStartParam(getStartParam());
```

add:

```typescript
  // Post-auth navigation target from a Telegram notification's "Open in app" web_app button:
  // https://aloeve.club/tg?dest=<url-encoded relative path>. URLSearchParams decodes it; we
  // then bound it to a safe same-app relative path.
  const destFromQuery = sanitizeDest(new URLSearchParams(window.location.search).get('dest'));
```

- [ ] **Step 3: Navigate to `dest` in the `signedIn` branch**

In the `signedIn` branch, the current code ends the branch with the invite handling followed by `navigateAfterAuth(navigate, res.data.auth.user); return;`. Insert the `dest` handling **between** the invite block and the `navigateAfterAuth` call. Locate:

```typescript
          if (inviteFromDeepLink) {
            try {
              const lookup = await invitesApi.lookupEvent(inviteFromDeepLink);
              if (lookup.success && lookup.data?.eventId) {
                navigate(`/aloevera/events/${lookup.data.eventId}?code=${encodeURIComponent(inviteFromDeepLink)}`, { replace: true });
                return;
              }
            } catch (lookupErr) {
              console.error('Invite lookup failed; falling back to default post-auth nav', lookupErr);
            }
          }

          navigateAfterAuth(navigate, res.data.auth.user);
          return;
```

and change it to add the `dest` block just before `navigateAfterAuth`:

```typescript
          if (inviteFromDeepLink) {
            try {
              const lookup = await invitesApi.lookupEvent(inviteFromDeepLink);
              if (lookup.success && lookup.data?.eventId) {
                navigate(`/aloevera/events/${lookup.data.eventId}?code=${encodeURIComponent(inviteFromDeepLink)}`, { replace: true });
                return;
              }
            } catch (lookupErr) {
              console.error('Invite lookup failed; falling back to default post-auth nav', lookupErr);
            }
          }

          // Notification deep link: land on the exact content the notification referenced.
          if (destFromQuery) {
            navigate(destFromQuery, { replace: true });
            return;
          }

          navigateAfterAuth(navigate, res.data.auth.user);
          return;
```

- [ ] **Step 4: Add the note that registration ignores `dest`**

The `needsRegistration` path is unreachable for notification recipients (they are always linked Telegram accounts). Directly above the existing line `// needsRegistration` add a clarifying comment:

```typescript
        // needsRegistration
        // Note: destFromQuery is intentionally ignored here — a user receiving Telegram
        // notifications already has a linked account, so this branch is not reached from a
        // notification deep link. New registrants follow the normal post-auth destination.
```

(Keep the existing `setTelegram(...)` and following lines unchanged.)

- [ ] **Step 5: Typecheck / build to verify the wiring compiles**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npm run build`
Expected: PASS — Vite build completes with no TypeScript errors (both `index.html` and `admin.html` entries emit).

- [ ] **Step 6: Run the full frontend test suite to confirm no regressions**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run`
Expected: PASS — the whole suite (including the new `miniAppDest` test) is green.

- [ ] **Step 7: Commit**

```bash
cd /home/amorofrost/src/aloevera-harmony-meet
git add src/pages/MiniAppEntry.tsx
git commit -m "feat: route mini app to notification dest after sign-in

MiniAppEntry reads the sanitized ?dest= param and, on signedIn, navigates
to it so a Telegram notification's 'Open in app' button lands on the exact
chat/thread/event/profile inside the authenticated mini app.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: End-to-end verification (manual reasoning + build/test gates)

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Confirm the produced web_app URL is well-formed**

From the backend test output (Task 1) or by inspection, confirm a `MessageReceived` notification yields button `WebApp.Url == "https://aloeve.club/tg?dest=%2Ftalks%3Fchat%3Dc1"` and that `URLSearchParams("dest=%2Ftalks%3Fchat%3Dc1").get('dest')` decodes to `/talks?chat=c1` (matches the frontend `sanitizeDest` accept case). This confirms the encode/decode round-trip across the two repos.

- [ ] **Step 2: Confirm both suites are green**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test`
Expected: PASS.
Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Note the deploy-time manual check**

Record in the PR/description that the only behavior not covered by automated tests is Telegram's actual launch of the `web_app` button (requires a real Telegram client). After deploy, manually verify: trigger a notification (e.g. receive a message), tap "Open in app" in Telegram, confirm the Mini App WebView opens (not the browser view), the session is authenticated without a login prompt, and it lands on the referenced content. This is expected/acceptable — the cross-repo encode/decode contract is unit-tested; only the Telegram client integration is manual.

---

## Self-Review

**Spec coverage:**
- Backend `web_app` button + `MiniAppUrl` + `BuildDestPath` per-type mapping + broadcast relative-path resolution → Task 1 (Steps 3c–3e). ✓
- Backend test updates (web_app assertion, per-type dest, broadcast fallback) → Task 1 (Step 1). ✓
- Frontend `sanitizeDest` helper + its unit test → Task 2. ✓
- Frontend `MiniAppEntry` post-auth nav priority (invite → dest → default) and the `needsRegistration` comment → Task 3. ✓
- `Telegram.Bot` version / `WithWebApp` availability check → resolved during planning (22.4.4 confirmed) and encoded in Global Constraints. ✓
- Out-of-scope items (email links, in-app links, mute button, MCF.17 startapp) → untouched by every task; mute button explicitly preserved in Task 1. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — every code step shows complete code. ✓

**Type consistency:** `sanitizeDest(raw: string | null | undefined): string | null` defined in Task 2 is imported and called with a `string | null` argument (`URLSearchParams.get` returns `string | null`) in Task 3. Backend `BuildDestPath` / `ResolveCommunityBroadcastPath` names are used consistently across Steps 3c–3e and the test helper `DestOf`. ✓
