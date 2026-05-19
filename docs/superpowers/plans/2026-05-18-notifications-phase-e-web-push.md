# Notifications — Phase E (Web Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship browser Web Push as a real delivery channel. Add VAPID keypair config (with a tiny CLI to generate one), expose the public key via `GET /api/v1/push/vapid-public-key`, build `WebPushDispatcher` in `Lovecraft.Backend` (in-process — NOT in the worker), wire it into `NotificationProducer`. Frontend gets a service worker (`public/sw.js`), a `webPush.ts` helper, and an "Enable on this device" button in the existing `NotificationPreferences` settings section.

**Architecture:** Web Push is an **in-process** channel. The producer dispatches it directly from the API request thread (fire-and-forget HTTP to push gateways like FCM/APNs), mirroring how `IInAppDispatcher` works for SignalR. The worker container is not involved — `Lovecraft.NotificationsWorker` only handles Telegram + email. Outbox rows for `WebPush` and `InApp` were previously orphaned (written by producer, never read by worker, never cleaned by janitor) — Phase E also fixes this carryover: producer no longer enqueues outbox for in-process channels.

**Tech Stack:** .NET 10 / `WebPush` NuGet (libwebpush .NET port) / browser Push API + service workers / React 18 + TypeScript / xUnit + Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Predecessors:** [A](./2026-05-17-notifications-phase-a-foundations.md), [B](./2026-05-18-notifications-phase-b-in-app.md), [C](./2026-05-18-notifications-phase-c-worker.md), [D](./2026-05-18-notifications-phase-d-telegram.md).

**Scope decisions (Phase E):**
- **Web Push fires from `Lovecraft.Backend`** (the API process), not from `Lovecraft.NotificationsWorker`. Same pattern as `IInAppDispatcher` — in-process, async HTTP, fire-and-forget.
- **Validator enforces `frequency.webPush == "immediate"`** (already true from Phase A). Worker's `DigestProcessor` only handles `Telegram` and `Email`, so even if someone changed it, no digest path exists.
- **In-process channels (InApp, WebPush) skip outbox enqueue entirely.** Producer change in `NotificationProducer.cs`. Eliminates the orphaned PENDING rows problem documented as a Phase A/B carryover.
- **Browser scope:** Web Push works in Chrome / Firefox / Edge / Safari 16.4+. iOS Safari requires the site to be installed as a PWA (out of scope). Service worker stays minimal — just `push` + `notificationclick` handlers; no offline caching.
- **VAPID keypair is one-time ops**: new `Lovecraft.Tools.VapidKeygen` CLI prints a fresh keypair to stdout; operator copies into env. Rotation invalidates all existing subscriptions — documented but not automated.
- **No locale-aware rendering** in Phase E (English-only, same trade-off as Phase D Telegram). Defer until a shared `INotificationLocalizer` lands as a follow-up.
- **No `BACKEND_URL` config in renderer yet** — `AppBaseUrl = "https://aloeve.club"` hardcoded; same trade-off as Phase D, tracked as follow-up.

**Repos:**
- Backend: `D:\src\lovecraft`
- Frontend: `D:\src\aloevera-harmony-meet`

**Branches:**
- Backend: `feat/notifications-phase-e`
- Frontend: `feat/notifications-phase-e`

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Frontend: `npm run test:run` (from `D:\src\aloevera-harmony-meet`)

---

## File map

### Backend new files (`D:\src\lovecraft\Lovecraft\`)

| File | Responsibility |
|---|---|
| `Lovecraft.Tools.VapidKeygen\Lovecraft.Tools.VapidKeygen.csproj` | Tiny console project, references `WebPush` |
| `Lovecraft.Tools.VapidKeygen\Program.cs` | Calls `VapidHelper.GenerateVapidKeys()`, prints to stdout |
| `Lovecraft.Common\DTOs\Notifications\VapidPublicKeyDto.cs` | `{ publicKey: string }` |
| `Lovecraft.Common\DTOs\Notifications\WebPushNotificationDto.cs` | The JSON payload sent to push gateways: `{ title, body, url, icon? }` |
| `Lovecraft.Backend\Services\Notifications\IWebPushDispatcher.cs` + `WebPushDispatcher.cs` | Dispatches a notification to all of a user's subscribed devices; deletes dead subs on 404/410 |
| `Lovecraft.Backend\Services\Notifications\IWebPushPayloadRenderer.cs` + `WebPushPayloadRenderer.cs` | Renders `NotificationDto` → `WebPushNotificationDto` (title/body/url per type) |
| `Lovecraft.UnitTests\WebPushDispatcherTests.cs` | 5 tests: success, 404 deletes sub, 410 deletes sub, other error logged but no delete, multiple devices |
| `Lovecraft.UnitTests\WebPushPayloadRendererTests.cs` | 4 tests covering rendering per notification type |

### Backend modifications

| File | Change |
|---|---|
| `Lovecraft.Backend\Lovecraft.Backend.csproj` | + `WebPush` PackageReference |
| `Lovecraft.Backend\Controllers\V1\NotificationsController.cs` | Add `GET /api/v1/push/vapid-public-key` (no-auth) returning `VapidPublicKeyDto`; read `VAPID_PUBLIC_KEY` env |
| `Lovecraft.Backend\Services\Notifications\NotificationProducer.cs` | Skip `EnqueueOutboxAsync` for `InApp` + `WebPush`; dispatch `WebPush` in-process via `IWebPushDispatcher.DispatchAsync`; dispatch `InApp` unchanged |
| `Lovecraft.Backend\Program.cs` | DI: register `IWebPushPayloadRenderer`, `IWebPushDispatcher`. VAPID env reads. |
| `Lovecraft.slnx` | + `Lovecraft.Tools.VapidKeygen` project |

### Frontend new files (`D:\src\aloevera-harmony-meet\`)

| File | Responsibility |
|---|---|
| `public\sw.js` | Service worker — `push` and `notificationclick` handlers |
| `src\lib\webPush.ts` | Browser-side helper: detect support, register sw, request permission, subscribe, post subscription to API, unsubscribe |
| `src\lib\__tests__\webPush.test.ts` | 4 tests with mocked `navigator.serviceWorker` and `Notification` |

### Frontend modifications

| File | Change |
|---|---|
| `src\components\settings\NotificationPreferences.tsx` | Show "Enable on this device" button when `!availability.webPushSubscribed`; "Disable on this device" when subscribed. Clicking enables/disables via `webPush.enable()/disable()`, refreshes availability. |
| `src\components\settings\__tests__\NotificationPreferences.test.tsx` | + 2 tests for enable button rendering + click behavior |
| `src\services\api\pushApi.ts` | Update `getVapidPublicKey` to use the now-real endpoint in API mode; mock returns empty string |

### Docs

| File | Change |
|---|---|
| `lovecraft\Lovecraft\docs\NOTIFICATIONS.md` | Append Phase E section (Web Push, in-process dispatch, VAPID setup) |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | One-line entry |
| `aloevera-harmony-meet\docs\ISSUES.md` | Update MCF.4: A/B/C/D/E shipped; F/G/H pending |
| `aloevera-harmony-meet\AGENTS.md` | Note: Web Push channel is live for users who opt in |
| `aloevera-harmony-meet\docs\API_INTEGRATION.md` | Note the now-real VAPID + push endpoints |

---

## Task ordering

Backend infrastructure first (Tasks 1–2: VAPID keygen tool, package + endpoint), then the dispatcher (Tasks 3–4: renderer, dispatcher with tests), then producer wiring (Task 5: orphaned outbox fix + WebPush dispatch), then DI (Task 6). Frontend afterwards (Tasks 7–9: service worker, helper, UI integration). Docs + final verification last (Tasks 10–11).

---

## Task 0: Create feature branches

**Files:** none.

- [ ] **Step 1: Backend branch**

```bash
git -C 'D:\src\lovecraft' checkout main
git -C 'D:\src\lovecraft' pull --ff-only
git -C 'D:\src\lovecraft' checkout -b feat/notifications-phase-e
```

- [ ] **Step 2: Frontend branch**

```bash
git -C 'D:\src\aloevera-harmony-meet' checkout main
git -C 'D:\src\aloevera-harmony-meet' pull --ff-only
git -C 'D:\src\aloevera-harmony-meet' checkout -b feat/notifications-phase-e
```

No commit.

---

## Task 1: VAPID keygen CLI

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Tools.VapidKeygen\Lovecraft.Tools.VapidKeygen.csproj`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Tools.VapidKeygen\Program.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.slnx`

Tiny console project that prints a fresh VAPID keypair to stdout. Operator runs once: `dotnet run --project Lovecraft.Tools.VapidKeygen`, copies output to `.env`.

- [ ] **Step 1: Write `Lovecraft.Tools.VapidKeygen.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Lovecraft.Tools.VapidKeygen</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="WebPush" Version="1.0.24" />
  </ItemGroup>

</Project>
```

(Verify `WebPush` version against latest stable — at time of writing, 1.0.24 is common. If a newer version is on NuGet, prefer it.)

- [ ] **Step 2: Write `Program.cs`**

```csharp
using WebPush;

var keys = VapidHelper.GenerateVapidKeys();

Console.WriteLine("# VAPID keypair — paste into your .env file:");
Console.WriteLine();
Console.WriteLine($"VAPID_PUBLIC_KEY={keys.PublicKey}");
Console.WriteLine($"VAPID_PRIVATE_KEY={keys.PrivateKey}");
Console.WriteLine($"VAPID_SUBJECT=mailto:noreply@aloeband.ru   # change to your contact");
Console.WriteLine();
Console.WriteLine("# IMPORTANT: rotating these keys invalidates ALL existing browser subscriptions.");
Console.WriteLine("# Generate once per environment (dev / staging / prod) and keep secret.");
```

- [ ] **Step 3: Add project to solution**

In `D:\src\lovecraft\Lovecraft\Lovecraft.slnx`, append:
```xml
<Project Path="Lovecraft.Tools.VapidKeygen/Lovecraft.Tools.VapidKeygen.csproj" />
```

- [ ] **Step 4: Build**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: 7 projects build (added VapidKeygen). 0 errors.

- [ ] **Step 5: Smoke run**

```
dotnet run --project 'D:\src\lovecraft\Lovecraft\Lovecraft.Tools.VapidKeygen\Lovecraft.Tools.VapidKeygen.csproj'
```
Expected: prints a fresh keypair to stdout.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Tools.VapidKeygen/' 'Lovecraft/Lovecraft.slnx'
git -C 'D:\src\lovecraft' commit -m "notifications: Lovecraft.Tools.VapidKeygen CLI"
```

---

## Task 2: WebPush package + VAPID public-key endpoint

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\VapidPublicKeyDto.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\WebPushNotificationDto.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\NotificationsController.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsControllerTests.cs`

Add the WebPush package, the two DTOs, and the public-key endpoint (no auth required — VAPID public key is by definition public).

- [ ] **Step 1: Add `WebPush` package to backend csproj**

In `Lovecraft.Backend.csproj`, inside the `<ItemGroup>` with other package refs:
```xml
<PackageReference Include="WebPush" Version="1.0.24" />
```
Match the version used in `Lovecraft.Tools.VapidKeygen.csproj`.

- [ ] **Step 2: Write `VapidPublicKeyDto.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Notifications;

public class VapidPublicKeyDto
{
    /// <summary>Base64URL-encoded P-256 public key. Frontend uses this as applicationServerKey when subscribing.</summary>
    public string PublicKey { get; set; } = string.Empty;
}
```

- [ ] **Step 3: Write `WebPushNotificationDto.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Notifications;

/// <summary>
/// JSON payload sent through Web Push to the browser service worker.
/// `sw.js` reads it from event.data.json() and calls showNotification.
/// </summary>
public class WebPushNotificationDto
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Url { get; set; } = "/";
    public string? Icon { get; set; }
}
```

- [ ] **Step 4: Add failing test for the endpoint**

Append to `NotificationsControllerTests.cs`:

```csharp
[Fact]
public async Task GET_vapid_public_key_no_auth_returns_configured_key()
{
    Environment.SetEnvironmentVariable("VAPID_PUBLIC_KEY", "test-public-key-base64url-abc123");
    var client = _factory.CreateClient();
    // Note: no Authorization header
    var resp = await client.GetAsync("/api/v1/push/vapid-public-key");
    resp.EnsureSuccessStatusCode();
    var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    Assert.Equal("test-public-key-base64url-abc123", body.GetProperty("data").GetProperty("publicKey").GetString());
}

[Fact]
public async Task GET_vapid_public_key_returns_empty_when_unconfigured()
{
    Environment.SetEnvironmentVariable("VAPID_PUBLIC_KEY", null);
    var client = _factory.CreateClient();
    var resp = await client.GetAsync("/api/v1/push/vapid-public-key");
    resp.EnsureSuccessStatusCode();
    var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    Assert.Equal("", body.GetProperty("data").GetProperty("publicKey").GetString());
}
```

- [ ] **Step 5: Run, verify fail**

Expected: 404 — endpoint doesn't exist yet.

- [ ] **Step 6: Add the endpoint to `NotificationsController.cs`**

```csharp
[AllowAnonymous]
[HttpGet("push/vapid-public-key")]
public ActionResult<ApiResponse<VapidPublicKeyDto>> GetVapidPublicKey()
{
    var key = Environment.GetEnvironmentVariable("VAPID_PUBLIC_KEY") ?? string.Empty;
    return Ok(ApiResponse<VapidPublicKeyDto>.SuccessResponse(new VapidPublicKeyDto { PublicKey = key }));
}
```

Add `using Microsoft.AspNetCore.Authorization;` if not present (`AllowAnonymous` overrides the class-level `[Authorize]`).

- [ ] **Step 7: Run tests, verify pass**

Expected: 2 new tests pass; full suite no regressions.

- [ ] **Step 8: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Lovecraft.Backend.csproj' 'Lovecraft/Lovecraft.Common/DTOs/Notifications/VapidPublicKeyDto.cs' 'Lovecraft/Lovecraft.Common/DTOs/Notifications/WebPushNotificationDto.cs' 'Lovecraft/Lovecraft.Backend/Controllers/V1/NotificationsController.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsControllerTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: WebPush NuGet + VAPID public-key endpoint + DTOs"
```

---

## Task 3: Web Push payload renderer

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\IWebPushPayloadRenderer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\WebPushPayloadRenderer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\WebPushPayloadRendererTests.cs`

Renderer maps `NotificationDto` → `WebPushNotificationDto` (title, body, url). Per-type templates match Telegram dispatcher's English text but without HTML tags (Web Push notifications display plain text).

URL routing matches frontend's `formatNotificationLink` (Phase B):
- `LikeReceived`/`MatchCreated` → `/friends?userId={actorId}` or `/friends`
- `MessageReceived` → `/talks?chat={chatId}`
- `ForumReplyToThread` → `/talks?topic={topicId}`
- `EventPublished`/`EventReminder`/`EventInviteReceived` → `/aloevera/events/{eventId}`
- `CommunityBroadcast` → `payload.link` (with same domain allowlist as Telegram dispatcher) or `/aloevera`
- `RankUp` → `/settings`

Body templates:
- `LikeReceived`: title="New like", body="Someone liked your profile"
- `MatchCreated`: title="New match!", body="You have a new match"
- `MessageReceived`: title="New message", body=preview (from payload, ≤80 chars)
- `ForumReplyToThread`: title="New reply", body="Someone replied in a thread"
- `CommunityBroadcast`: title=payload.title, body=payload.body
- `EventPublished`: title="New event", body=payload.eventTitle
- `EventReminder`: title="Event tomorrow", body=payload.eventTitle
- `EventInviteReceived`: title="You're invited", body=payload.eventTitle
- `RankUp`: title="Rank up!", body="You're now {newRank}"

Plain text — no `<b>` tags. Web Push spec doesn't support HTML in title/body.

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/WebPushPayloadRendererTests.cs`:

```csharp
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests;

public class WebPushPayloadRendererTests
{
    private readonly WebPushPayloadRenderer _renderer = new(NullLogger<WebPushPayloadRenderer>.Instance);

    private static NotificationDto MakeNotification(NotificationType type, string payloadJson, string? actorId = null) =>
        new()
        {
            Id = "n1",
            UserId = "u1",
            Type = type,
            ActorId = actorId,
            PayloadJson = payloadJson,
            CreatedAtUtc = DateTime.UtcNow,
        };

    [Fact]
    public void MessageReceived_uses_payload_preview()
    {
        var notif = MakeNotification(NotificationType.MessageReceived,
            "{\"chatId\":\"c1\",\"messageId\":\"m1\",\"preview\":\"hello\"}");

        var result = _renderer.Render(notif);

        Assert.Equal("New message", result.Title);
        Assert.Equal("hello", result.Body);
        Assert.Equal("/talks?chat=c1", result.Url);
    }

    [Fact]
    public void LikeReceived_routes_to_friends_with_actor()
    {
        var notif = MakeNotification(NotificationType.LikeReceived,
            "{\"likeId\":\"l1\",\"anonymous\":false}",
            actorId: "actor-1");

        var result = _renderer.Render(notif);

        Assert.Equal("/friends?userId=actor-1", result.Url);
    }

    [Fact]
    public void CommunityBroadcast_disallows_off_domain_absolute_urls()
    {
        var notif = MakeNotification(NotificationType.CommunityBroadcast,
            "{\"title\":\"X\",\"body\":\"Y\",\"link\":\"https://evil.example/phish\"}");

        var result = _renderer.Render(notif);

        Assert.DoesNotContain("evil.example", result.Url);
        Assert.StartsWith("/", result.Url);   // Falls back to /aloevera safe default
    }

    [Fact]
    public void Malformed_payload_renders_safely()
    {
        var notif = MakeNotification(NotificationType.MessageReceived, "not-valid-json");

        var result = _renderer.Render(notif);

        Assert.NotEmpty(result.Title);
        Assert.NotNull(result.Body);
        Assert.NotEmpty(result.Url);
    }
}
```

- [ ] **Step 2: Run, verify fail**

Expected: compile error.

- [ ] **Step 3: Write `IWebPushPayloadRenderer.cs`**

```csharp
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services.Notifications;

public interface IWebPushPayloadRenderer
{
    WebPushNotificationDto Render(NotificationDto notification);
}
```

- [ ] **Step 4: Write `WebPushPayloadRenderer.cs`**

```csharp
using System.Text.Json;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging;

namespace Lovecraft.Backend.Services.Notifications;

public class WebPushPayloadRenderer : IWebPushPayloadRenderer
{
    private readonly ILogger<WebPushPayloadRenderer> _logger;

    public WebPushPayloadRenderer(ILogger<WebPushPayloadRenderer> logger)
    {
        _logger = logger;
    }

    public WebPushNotificationDto Render(NotificationDto notification)
    {
        Dictionary<string, object?> payload;
        try
        {
            payload = JsonSerializer.Deserialize<Dictionary<string, object?>>(notification.PayloadJson)
                      ?? new Dictionary<string, object?>();
        }
        catch
        {
            payload = new Dictionary<string, object?>();
            _logger.LogWarning("Notification {NotificationId} has malformed PayloadJson; rendering with empty payload",
                notification.Id);
        }

        return notification.Type switch
        {
            NotificationType.LikeReceived => new WebPushNotificationDto
            {
                Title = "New like",
                Body = "Someone liked your profile",
                Url = BuildFriendsUrl(notification.ActorId),
            },
            NotificationType.MatchCreated => new WebPushNotificationDto
            {
                Title = "New match!",
                Body = "You have a new match",
                Url = BuildFriendsUrl(notification.ActorId),
            },
            NotificationType.MessageReceived => new WebPushNotificationDto
            {
                Title = "New message",
                Body = GetString(payload, "preview"),
                Url = $"/talks?chat={Uri.EscapeDataString(GetString(payload, "chatId"))}",
            },
            NotificationType.ForumReplyToThread => new WebPushNotificationDto
            {
                Title = "New reply",
                Body = "Someone replied in a thread",
                Url = $"/talks?topic={Uri.EscapeDataString(GetString(payload, "topicId"))}",
            },
            NotificationType.CommunityBroadcast => new WebPushNotificationDto
            {
                Title = GetString(payload, "title", fallback: "Community update"),
                Body = GetString(payload, "body"),
                Url = ResolveCommunityBroadcastUrl(GetString(payload, "link")),
            },
            NotificationType.EventPublished => new WebPushNotificationDto
            {
                Title = "New event",
                Body = GetString(payload, "eventTitle"),
                Url = $"/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            },
            NotificationType.EventReminder => new WebPushNotificationDto
            {
                Title = "Event tomorrow",
                Body = GetString(payload, "eventTitle"),
                Url = $"/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            },
            NotificationType.EventInviteReceived => new WebPushNotificationDto
            {
                Title = "You're invited",
                Body = GetString(payload, "eventTitle"),
                Url = $"/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            },
            NotificationType.RankUp => new WebPushNotificationDto
            {
                Title = "Rank up!",
                Body = $"You're now {GetString(payload, "newRank")}",
                Url = "/settings",
            },
            _ => new WebPushNotificationDto
            {
                Title = "New notification",
                Body = "You have a new notification",
                Url = "/notifications",
            },
        };
    }

    private static string BuildFriendsUrl(string? actorId)
        => actorId is not null ? $"/friends?userId={Uri.EscapeDataString(actorId)}" : "/friends";

    private static string ResolveCommunityBroadcastUrl(string link)
    {
        if (string.IsNullOrEmpty(link)) return "/aloevera";

        if (Uri.TryCreate(link, UriKind.Absolute, out var absolute))
        {
            if (absolute.Scheme == Uri.UriSchemeHttps
                && (absolute.Host.Equals("aloeve.club", StringComparison.OrdinalIgnoreCase)
                    || absolute.Host.Equals("www.aloeve.club", StringComparison.OrdinalIgnoreCase)))
            {
                return absolute.PathAndQuery;   // strip scheme + host since URL is relative-rooted
            }
            return "/aloevera";
        }

        return link.StartsWith('/') ? link : "/" + link;
    }

    private static string GetString(Dictionary<string, object?> payload, string key, string fallback = "")
    {
        if (!payload.TryGetValue(key, out var v) || v is null) return fallback;
        return v.ToString() ?? fallback;
    }
}
```

- [ ] **Step 5: Run tests, verify pass**

Expected: 4/4 pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/IWebPushPayloadRenderer.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/WebPushPayloadRenderer.cs' 'Lovecraft/Lovecraft.UnitTests/WebPushPayloadRendererTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: WebPushPayloadRenderer + tests"
```

---

## Task 4: `IWebPushDispatcher` + tests

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\IWebPushDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\WebPushDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\WebPushDispatcherTests.cs`

The dispatcher:
1. Reads VAPID config from env at construction (or accepts via constructor params for testability).
2. `DispatchAsync(userId, notificationDto)`:
   - Fetches subscriptions via `IPushSubscriptionService.ListAsync(userId)`
   - For each subscription: renders payload, JSON-serializes, calls `WebPushClient.SendNotificationAsync(subscription, payload, vapidDetails)`
   - On `WebPushException` with HTTP 404 or 410: `await _pushService.UnsubscribeAsync(userId, deviceId)`
   - On other errors: log and continue (no retry — Web Push is best-effort in-process)
   - All sends are awaited (no fire-and-forget within the dispatcher; the caller can fire-and-forget the whole method)
3. If VAPID config not set → log warning, no-op (graceful degradation in mock-mode dev)

Wrap the `WebPushClient` behind `IWebPushClient` interface for testability (similar to Phase D's `ITelegramSendClient` pattern).

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/WebPushDispatcherTests.cs`:

```csharp
using System.Net;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.Common.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebPush;
using Xunit;

namespace Lovecraft.UnitTests;

public class WebPushDispatcherTests
{
    private static NotificationDto SampleNotification() => new()
    {
        Id = "n1",
        UserId = "u1",
        Type = NotificationType.LikeReceived,
        ActorId = "actor-1",
        PayloadJson = "{\"likeId\":\"l1\",\"anonymous\":false}",
        CreatedAtUtc = DateTime.UtcNow,
    };

    private static WebPushSubscriptionDto MakeSub(string deviceId) => new()
    {
        DeviceId = deviceId,
        Endpoint = "https://push.example/" + deviceId,
        P256dh = "p256dh-key-base64url",
        Auth = "auth-key-base64url",
        UserAgent = "test",
        CreatedAtUtc = DateTime.UtcNow,
        LastSeenAtUtc = DateTime.UtcNow,
    };

    private static (WebPushDispatcher dispatcher, Mock<IPushSubscriptionService> push, Mock<IWebPushClient> client)
        Build(Mock<IPushSubscriptionService>? push = null, Mock<IWebPushClient>? client = null)
    {
        push ??= new Mock<IPushSubscriptionService>();
        client ??= new Mock<IWebPushClient>();

        var renderer = new WebPushPayloadRenderer(NullLogger<WebPushPayloadRenderer>.Instance);
        var dispatcher = new WebPushDispatcher(
            client.Object, push.Object, renderer,
            publicKey: "test-public-key", privateKey: "test-private-key", subject: "mailto:test@example.com",
            NullLogger<WebPushDispatcher>.Instance);
        return (dispatcher, push, client);
    }

    [Fact]
    public async Task No_subscriptions_does_nothing()
    {
        var push = new Mock<IPushSubscriptionService>();
        push.Setup(p => p.ListAsync("u1")).ReturnsAsync(new List<WebPushSubscriptionDto>());
        var (dispatcher, _, client) = Build(push);

        await dispatcher.DispatchAsync("u1", SampleNotification());

        client.Verify(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()), Times.Never);
    }

    [Fact]
    public async Task Successful_send_does_not_unsubscribe()
    {
        var push = new Mock<IPushSubscriptionService>();
        push.Setup(p => p.ListAsync("u1")).ReturnsAsync(new List<WebPushSubscriptionDto> { MakeSub("dev1") });
        var client = new Mock<IWebPushClient>();
        client.Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()))
            .Returns(Task.CompletedTask);
        var (dispatcher, _, _) = Build(push, client);

        await dispatcher.DispatchAsync("u1", SampleNotification());

        push.Verify(p => p.UnsubscribeAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Http_404_deletes_subscription()
    {
        var push = new Mock<IPushSubscriptionService>();
        push.Setup(p => p.ListAsync("u1")).ReturnsAsync(new List<WebPushSubscriptionDto> { MakeSub("dev1") });
        var client = new Mock<IWebPushClient>();
        client.Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()))
            .ThrowsAsync(new WebPushException("Gone", HttpStatusCode.Gone, new HttpResponseHeaders[0] as System.Net.Http.Headers.HttpResponseHeaders, null!));
        var (dispatcher, _, _) = Build(push, client);

        await dispatcher.DispatchAsync("u1", SampleNotification());

        push.Verify(p => p.UnsubscribeAsync("u1", "dev1"), Times.Once);
    }

    [Fact]
    public async Task Http_410_deletes_subscription()
    {
        var push = new Mock<IPushSubscriptionService>();
        push.Setup(p => p.ListAsync("u1")).ReturnsAsync(new List<WebPushSubscriptionDto> { MakeSub("dev1") });
        var client = new Mock<IWebPushClient>();
        client.Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()))
            .ThrowsAsync(new WebPushException("NotFound", HttpStatusCode.NotFound, null!, null!));
        var (dispatcher, _, _) = Build(push, client);

        await dispatcher.DispatchAsync("u1", SampleNotification());

        push.Verify(p => p.UnsubscribeAsync("u1", "dev1"), Times.Once);
    }

    [Fact]
    public async Task Multiple_devices_all_attempted()
    {
        var push = new Mock<IPushSubscriptionService>();
        push.Setup(p => p.ListAsync("u1")).ReturnsAsync(new List<WebPushSubscriptionDto>
        {
            MakeSub("dev1"),
            MakeSub("dev2"),
            MakeSub("dev3"),
        });
        var client = new Mock<IWebPushClient>();
        client.Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()))
            .Returns(Task.CompletedTask);
        var (dispatcher, _, _) = Build(push, client);

        await dispatcher.DispatchAsync("u1", SampleNotification());

        client.Verify(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>()), Times.Exactly(3));
    }
}
```

**Note:** the `WebPushException` constructor signature varies by version. If the test code doesn't compile, simplify by throwing `new WebPushException("Gone")` and checking via a status property — or use whatever constructor matches the installed version. The key behaviors to test are: HTTP 404 + 410 trigger unsubscribe, other errors don't.

- [ ] **Step 2: Run, verify fail**

Expected: compile errors — dispatcher + IWebPushClient don't exist.

- [ ] **Step 3: Write `IWebPushClient.cs`**

(Optional wrapper for testability, mirroring Phase D's pattern.)

```csharp
using WebPush;

namespace Lovecraft.Backend.Services.Notifications;

public interface IWebPushClient
{
    Task SendNotificationAsync(PushSubscription subscription, string payload, VapidDetails vapidDetails);
}

public class WebPushClientAdapter : IWebPushClient
{
    private readonly WebPushClient _inner = new();

    public Task SendNotificationAsync(PushSubscription subscription, string payload, VapidDetails vapidDetails)
        => _inner.SendNotificationAsync(subscription, payload, vapidDetails);
}
```

- [ ] **Step 4: Write `IWebPushDispatcher.cs` + `WebPushDispatcher.cs`**

`IWebPushDispatcher.cs`:
```csharp
using Lovecraft.Common.DTOs.Notifications;

namespace Lovecraft.Backend.Services.Notifications;

public interface IWebPushDispatcher
{
    /// <summary>
    /// Fires Web Push to all of the user's subscribed devices. Best-effort: errors are logged
    /// and dead subscriptions (HTTP 404/410) are deleted. Caller can fire-and-forget.
    /// </summary>
    Task DispatchAsync(string userId, NotificationDto notification);
}
```

`WebPushDispatcher.cs`:
```csharp
using System.Net;
using System.Text.Json;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.Extensions.Logging;
using WebPush;

namespace Lovecraft.Backend.Services.Notifications;

public class WebPushDispatcher : IWebPushDispatcher
{
    private readonly IWebPushClient _client;
    private readonly IPushSubscriptionService _pushService;
    private readonly IWebPushPayloadRenderer _renderer;
    private readonly VapidDetails? _vapidDetails;
    private readonly ILogger<WebPushDispatcher> _logger;

    public WebPushDispatcher(
        IWebPushClient client,
        IPushSubscriptionService pushService,
        IWebPushPayloadRenderer renderer,
        string? publicKey, string? privateKey, string? subject,
        ILogger<WebPushDispatcher> logger)
    {
        _client = client;
        _pushService = pushService;
        _renderer = renderer;
        _logger = logger;

        if (!string.IsNullOrEmpty(publicKey) && !string.IsNullOrEmpty(privateKey) && !string.IsNullOrEmpty(subject))
        {
            _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
        }
    }

    public async Task DispatchAsync(string userId, NotificationDto notification)
    {
        if (_vapidDetails is null)
        {
            _logger.LogDebug("WebPush VAPID not configured; skipping dispatch for {NotificationId}", notification.Id);
            return;
        }

        var subscriptions = await _pushService.ListAsync(userId);
        if (subscriptions.Count == 0) return;

        var payload = _renderer.Render(notification);
        var payloadJson = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        foreach (var sub in subscriptions)
        {
            var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
            try
            {
                await _client.SendNotificationAsync(pushSub, payloadJson, _vapidDetails);
            }
            catch (WebPushException ex) when (
                ex.StatusCode == HttpStatusCode.NotFound || ex.StatusCode == HttpStatusCode.Gone)
            {
                _logger.LogInformation("Push subscription {DeviceId} for user {UserId} is gone ({Status}); removing",
                    sub.DeviceId, userId, ex.StatusCode);
                try { await _pushService.UnsubscribeAsync(userId, sub.DeviceId); }
                catch (Exception delEx)
                {
                    _logger.LogWarning(delEx, "Failed to clean up dead push subscription {DeviceId}", sub.DeviceId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WebPush send failed for user {UserId} device {DeviceId} (continuing)",
                    userId, sub.DeviceId);
            }
        }
    }
}
```

- [ ] **Step 5: Run tests, verify pass**

Expected: 5/5 new tests pass.

If `WebPushException` constructor doesn't match the test code, adjust the test fixture (and document the actual signature). The dispatcher's `catch when (ex.StatusCode == ...)` should still work — `StatusCode` is a property on `WebPushException` regardless of how the exception is constructed.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/IWebPushClient.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/IWebPushDispatcher.cs' 'Lovecraft/Lovecraft.Backend/Services/Notifications/WebPushDispatcher.cs' 'Lovecraft/Lovecraft.UnitTests/WebPushDispatcherTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: WebPushDispatcher (in-process, dead-sub cleanup) + tests"
```

---

## Task 5: Producer change — skip outbox for in-process channels + dispatch WebPush

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Notifications\NotificationProducer.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationProducerTests.cs`

Two related changes:
1. **No outbox enqueue for InApp + WebPush** — these are in-process channels; outbox rows would be orphaned (Phase A/B/C/D carryover documented as known follow-up).
2. **Dispatch WebPush in-process** — `_webPush.DispatchAsync(recipientUserId, dto)` for `WebPush` channel, mirroring the InApp branch.

Producer constructor gains `IWebPushDispatcher` parameter.

- [ ] **Step 1: Add failing tests**

Append to `NotificationProducerTests.cs`:

```csharp
[Fact]
public async Task InApp_channel_does_not_enqueue_outbox_row()
{
    // Tests that NotificationProducer.ProduceAsync, when only InApp is the resolved channel,
    // writes the canonical notifications row but does NOT call _notifications.EnqueueOutboxAsync.

    MockDataStore.Notifications.Clear();
    MockDataStore.NotificationPreferences.Clear();

    var notifSvc = new Mock<INotificationService>();
    notifSvc.Setup(n => n.CreateAsync(It.IsAny<string>(), It.IsAny<NotificationType>(), It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string?>()))
        .ReturnsAsync(new NotificationDto { Id = "n-new", UserId = "u-recipient", Type = NotificationType.LikeReceived });
    notifSvc.Setup(n => n.RecentForDedupAsync(It.IsAny<string>(), It.IsAny<NotificationType>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int>()))
        .ReturnsAsync(new List<NotificationDto>());

    var prefSvc = new MockNotificationPreferenceService();
    var pushSvc = new MockPushSubscriptionService();
    var users = new Mock<IUserService>();
    users.Setup(u => u.GetNotificationContactStatusAsync(It.IsAny<string>())).ReturnsAsync((false, false));
    var inApp = new Mock<IInAppDispatcher>();
    var webPush = new Mock<IWebPushDispatcher>();
    var presence = new PresenceTracker();
    var deduper = new NotificationDeduper(notifSvc.Object);

    var producer = new NotificationProducer(
        notifSvc.Object, prefSvc, pushSvc, users.Object,
        inApp.Object, webPush.Object, presence, deduper,
        NullLogger<NotificationProducer>.Instance);

    await producer.ProduceAsync("u-recipient", NotificationType.LikeReceived,
        actorId: "u-actor", payloadJson: "{}", sourceEventId: "like-1");

    notifSvc.Verify(n => n.EnqueueOutboxAsync(
        It.IsAny<string>(),
        It.IsAny<string>(),
        NotificationChannel.InApp,
        It.IsAny<NotificationFrequency>(),
        It.IsAny<DateTime>()), Times.Never);
}

[Fact]
public async Task WebPush_channel_dispatched_in_process_no_outbox()
{
    // When WebPush is enabled AND the user has push subscriptions, WebPush should fire
    // via IWebPushDispatcher (in-process) and NOT enqueue an outbox row.

    MockDataStore.Notifications.Clear();
    MockDataStore.NotificationPreferences.Clear();
    MockDataStore.PushSubscriptions.Clear();
    // Seed: one push subscription so availability resolves to webPushSubscribed=true
    MockDataStore.PushSubscriptions[("u-recipient", "dev1")] = new WebPushSubscriptionDto
    {
        DeviceId = "dev1", Endpoint = "x", P256dh = "p", Auth = "a", UserAgent = "",
        CreatedAtUtc = DateTime.UtcNow, LastSeenAtUtc = DateTime.UtcNow,
    };

    // Seed prefs: enable WebPush for LikeReceived
    var prefSvc = new MockNotificationPreferenceService();
    var prefs = await prefSvc.GetPreferencesAsync("u-recipient");
    prefs.Matrix["likeReceived"]["webPush"] = true;
    await prefSvc.UpdatePreferencesAsync("u-recipient", prefs);

    var notifSvc = new MockNotificationService();
    var pushSvc = new MockPushSubscriptionService();
    var users = new Mock<IUserService>();
    users.Setup(u => u.GetNotificationContactStatusAsync(It.IsAny<string>())).ReturnsAsync((false, false));
    var inApp = new Mock<IInAppDispatcher>();
    var webPush = new Mock<IWebPushDispatcher>();
    webPush.Setup(w => w.DispatchAsync(It.IsAny<string>(), It.IsAny<NotificationDto>())).Returns(Task.CompletedTask);
    var presence = new PresenceTracker();
    var deduper = new NotificationDeduper(notifSvc);

    var producer = new NotificationProducer(
        notifSvc, prefSvc, pushSvc, users.Object,
        inApp.Object, webPush.Object, presence, deduper,
        NullLogger<NotificationProducer>.Instance);

    var dto = await producer.ProduceAsync("u-recipient", NotificationType.LikeReceived,
        actorId: "u-actor", payloadJson: "{}", sourceEventId: "like-w1");

    Assert.NotNull(dto);
    webPush.Verify(w => w.DispatchAsync("u-recipient", It.Is<NotificationDto>(n => n.Id == dto!.Id)), Times.Once);
}
```

(The first test asserts that `EnqueueOutboxAsync` is NOT called for `InApp` channel — that's the carryover fix.)

- [ ] **Step 2: Run, verify fail**

Expected: tests fail because the producer still enqueues outbox for InApp.

- [ ] **Step 3: Modify `NotificationProducer.cs`**

Update constructor to accept `IWebPushDispatcher webPush`. Modify the channel-loop to skip outbox for in-process channels and dispatch WebPush:

```csharp
foreach (var channel in channels)
{
    var frequencyKey = char.ToLowerInvariant(channel.ToString()[0]) + channel.ToString()[1..];
    var frequency = prefs.Frequency.TryGetValue(frequencyKey, out var f) ? f : NotificationFrequency.Immediate;
    var scheduledFor = ScheduleFor(now, frequency, prefs.DailyDigestHourUtc);

    // In-process channels (InApp, WebPush) dispatch directly from the API process.
    // They don't go through the outbox/worker — those rows would be orphaned.
    if (channel == NotificationChannel.InApp)
    {
        try { await _inApp.DispatchAsync(recipientUserId, dto); }
        catch (Exception ex) { _logger.LogWarning(ex, "InApp dispatch failed for {NotificationId}", dto.Id); }
        continue;
    }
    if (channel == NotificationChannel.WebPush)
    {
        try { await _webPush.DispatchAsync(recipientUserId, dto); }
        catch (Exception ex) { _logger.LogWarning(ex, "WebPush dispatch failed for {NotificationId}", dto.Id); }
        continue;
    }

    // Telegram + Email: enqueue outbox for the worker to process
    try
    {
        await _notifications.EnqueueOutboxAsync(recipientUserId, dto.Id, channel, frequency, scheduledFor);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to enqueue outbox row for {Channel}/{NotificationId}",
            channel, dto.Id);
    }
}
```

Add `IWebPushDispatcher _webPush` field; constructor takes it after `_inApp`.

- [ ] **Step 4: Run tests, verify pass**

Expected: 2 new tests pass; ALL previous tests in `NotificationProducerTests` still pass (the existing `InApp_dispatcher_called_when_channels_include_in_app` test should still pass — InApp is still dispatched, just no longer enqueued).

If existing tests assert `EnqueueOutboxAsync` was called for InApp, update them to reflect the new behavior.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Services/Notifications/NotificationProducer.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationProducerTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: skip outbox enqueue for in-process channels + dispatch WebPush via producer"
```

---

## Task 6: Backend DI wiring

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Program.cs`

Register the new services:
- `IWebPushClient` → `WebPushClientAdapter` (singleton)
- `IWebPushPayloadRenderer` → `WebPushPayloadRenderer` (singleton)
- `IWebPushDispatcher` → `WebPushDispatcher` factory lambda — reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` from env

`INotificationProducer` already exists; update its DI factory to pass `IWebPushDispatcher` to the constructor.

- [ ] **Step 1: Read existing `Program.cs` to find the notification services block**

Find where `INotificationProducer` is currently registered. There should already be `IInAppDispatcher`, `IPresenceTracker`, `NotificationDeduper` registrations from Phase A.

- [ ] **Step 2: Add Web Push registrations**

Near the other notification DI registrations:

```csharp
builder.Services.AddSingleton<IWebPushClient, WebPushClientAdapter>();
builder.Services.AddSingleton<IWebPushPayloadRenderer, WebPushPayloadRenderer>();
builder.Services.AddSingleton<IWebPushDispatcher>(sp =>
{
    var publicKey = Environment.GetEnvironmentVariable("VAPID_PUBLIC_KEY");
    var privateKey = Environment.GetEnvironmentVariable("VAPID_PRIVATE_KEY");
    var subject = Environment.GetEnvironmentVariable("VAPID_SUBJECT");
    return new WebPushDispatcher(
        sp.GetRequiredService<IWebPushClient>(),
        sp.GetRequiredService<IPushSubscriptionService>(),
        sp.GetRequiredService<IWebPushPayloadRenderer>(),
        publicKey, privateKey, subject,
        sp.GetRequiredService<ILogger<WebPushDispatcher>>());
});
```

Then update the `INotificationProducer` registration to inject `IWebPushDispatcher`. If it's currently `AddSingleton<INotificationProducer, NotificationProducer>()` and DI resolves all constructor params automatically, the change is just adding `IWebPushDispatcher` to the constructor — DI will handle it. No factory change needed.

- [ ] **Step 3: Build + test**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: full suite passes (393 prior + 2 vapid + 4 renderer + 5 dispatcher + 2 producer = 406).

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: DI wiring for WebPushDispatcher + adapter + renderer"
```

---

## Task 7: Frontend service worker

**Files:**
- Create: `D:\src\aloevera-harmony-meet\public\sw.js`

Minimal service worker — `push` event displays notification, `notificationclick` opens URL.

- [ ] **Step 1: Write `public/sw.js`**

```javascript
// Service worker for Web Push notifications.
// Registered via navigator.serviceWorker.register('/sw.js') in src/lib/webPush.ts.
// Vite serves /public assets at the root path; build copies sw.js to /dist/sw.js.

self.addEventListener('install', () => {
  // Activate immediately for new versions
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of clients without requiring page reload
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'AloeVera Harmony Meet', body: 'You have a new notification' };
  }

  const title = data.title || 'AloeVera Harmony Meet';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/badge.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at this URL, focus it
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const targetParsed = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === targetParsed.pathname && 'focus' in client) {
            return client.focus();
          }
        } catch {
          // ignore URL parse errors
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
```

- [ ] **Step 2: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'public/sw.js'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: service worker (push + notificationclick handlers)"
```

(No tests for the service worker — its environment is the browser, not Vitest.)

---

## Task 8: Frontend `webPush.ts` helper

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\lib\webPush.ts`
- Create: `D:\src\aloevera-harmony-meet\src\lib\__tests__\webPush.test.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\pushApi.ts` (verify endpoint URL matches Task 2)

Helper provides four exports:
- `isWebPushSupported(): boolean` — check `'serviceWorker' in navigator && 'PushManager' in window`
- `getSubscriptionStatus(): Promise<'subscribed' | 'denied' | 'unsupported' | 'available'>`
- `enableWebPush(): Promise<{ deviceId: string }>` — register sw → request permission → subscribe with VAPID key → POST to API
- `disableWebPush(): Promise<void>` — unsubscribe from push manager + POST DELETE to API

The `applicationServerKey` for `pushManager.subscribe` is the VAPID public key in raw bytes form. Helper converts the URL-safe base64 string into `Uint8Array`.

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/webPush.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isWebPushSupported, enableWebPush, disableWebPush } from '../webPush';

// Mock browser APIs
const mockPushManagerSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

const mockSubscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({
    endpoint: 'https://push.example/abc',
    keys: { p256dh: 'p256dh-val', auth: 'auth-val' },
  }),
  unsubscribe: mockUnsubscribe,
};

vi.mock('@/services/api', () => ({
  pushApi: {
    getVapidPublicKey: vi.fn().mockResolvedValue({ success: true, data: { publicKey: 'BMqSv...' } }),
    subscribe: vi.fn().mockResolvedValue({ success: true, data: { deviceId: 'dev-1' } }),
    unsubscribe: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('webPush helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPushManagerSubscribe.mockReset().mockResolvedValue(mockSubscription);
    mockUnsubscribe.mockReset().mockResolvedValue(true);

    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: {
          register: vi.fn().mockResolvedValue({
            pushManager: {
              subscribe: mockPushManagerSubscribe,
              getSubscription: vi.fn().mockResolvedValue(mockSubscription),
            },
          }),
          ready: Promise.resolve({
            pushManager: {
              subscribe: mockPushManagerSubscribe,
              getSubscription: vi.fn().mockResolvedValue(mockSubscription),
            },
          }),
        },
        userAgent: 'test',
      },
      writable: true,
    });

    Object.defineProperty(global, 'window', {
      value: { PushManager: {} },
      writable: true,
    });

    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true,
    });

    // localStorage shim
    let store: Record<string, string> = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
      writable: true,
    });
  });

  it('isWebPushSupported returns true when APIs present', () => {
    expect(isWebPushSupported()).toBe(true);
  });

  it('isWebPushSupported returns false without service worker', () => {
    // @ts-expect-error — testing browser feature detection
    delete global.navigator.serviceWorker;
    expect(isWebPushSupported()).toBe(false);
  });

  it('enableWebPush registers sw, subscribes, and posts to API', async () => {
    const result = await enableWebPush();
    expect(result.deviceId).toBe('dev-1');
    expect(global.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(mockPushManagerSubscribe).toHaveBeenCalled();
  });

  it('disableWebPush calls unsubscribe and API delete', async () => {
    // Pretend we have a stored deviceId
    localStorage.setItem('webPushDeviceId', 'dev-1');
    await disableWebPush();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Expected: import error.

- [ ] **Step 3: Write `src/lib/webPush.ts`**

```typescript
import { pushApi } from '@/services/api';

const DEVICE_ID_KEY = 'webPushDeviceId';

export function isWebPushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof window !== 'undefined'
    && 'PushManager' in window;
}

export type SubscriptionStatus = 'subscribed' | 'denied' | 'unsupported' | 'available';

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (!isWebPushSupported()) return 'unsupported';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'available';
  } catch {
    return 'available';
  }
}

export async function enableWebPush(): Promise<{ deviceId: string }> {
  if (!isWebPushSupported()) throw new Error('Web Push not supported in this browser');

  // Register service worker
  const reg = await navigator.serviceWorker.register('/sw.js');

  // Request permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(`Notification permission ${perm}`);

  // Fetch VAPID public key
  const vapidResp = await pushApi.getVapidPublicKey();
  const publicKey = vapidResp.data?.publicKey;
  if (!publicKey) throw new Error('VAPID public key not configured on server');

  // Subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Extract keys
  const subJson = sub.toJSON();
  const endpoint = subJson.endpoint!;
  const p256dh = subJson.keys!.p256dh;
  const auth = subJson.keys!.auth;

  // Read or generate deviceId
  let deviceId = localStorage.getItem(DEVICE_ID_KEY) ?? '';

  const resp = await pushApi.subscribe({
    deviceId: deviceId || undefined,
    endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  });

  if (!resp.success || !resp.data) throw new Error('Failed to register push subscription with API');

  deviceId = resp.data.deviceId;
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return { deviceId };
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  const deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (deviceId) {
    await pushApi.unsubscribe(deviceId);
    localStorage.removeItem(DEVICE_ID_KEY);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
```

- [ ] **Step 4: Verify `src/services/api/pushApi.ts` is in sync**

The `pushApi.getVapidPublicKey()` mock from Phase A returns `{ publicKey: '' }`. In API mode it calls `GET /api/v1/push/vapid-public-key`. After Task 2 the endpoint exists and returns the configured key. No code change needed unless the URL path changed — verify both match.

- [ ] **Step 5: Run tests, verify pass**

```
npx vitest run 'src/lib/__tests__/webPush.test.ts'
```
Expected: 4/4 pass.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/lib/webPush.ts' 'src/lib/__tests__/webPush.test.ts'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: webPush helper (enable/disable/subscription status) + tests"
```

---

## Task 9: NotificationPreferences — Enable on this device button

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\components\settings\NotificationPreferences.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\components\settings\__tests__\NotificationPreferences.test.tsx`

The component already has a "Browser push" channel block with the matrix toggles, greyed when not subscribed. Add a button at the top of the Web Push block:
- If `availability.webPushSubscribed` → "Disable on this device" → calls `disableWebPush()` → refreshes availability
- If subscription status is `'available'` → "Enable on this device" → calls `enableWebPush()` → refreshes
- If subscription status is `'denied'` → "Notification permission blocked — enable in browser settings" (disabled button)
- If subscription status is `'unsupported'` → "Browser doesn't support Web Push" (disabled button)

Show a `toast.success` on enable, `showApiError` on failure.

- [ ] **Step 1: Add failing tests**

Append to `NotificationPreferences.test.tsx`:

```typescript
import { isWebPushSupported, getSubscriptionStatus, enableWebPush, disableWebPush } from '@/lib/webPush';

vi.mock('@/lib/webPush', () => ({
  isWebPushSupported: vi.fn().mockReturnValue(true),
  getSubscriptionStatus: vi.fn().mockResolvedValue('available'),
  enableWebPush: vi.fn().mockResolvedValue({ deviceId: 'dev-1' }),
  disableWebPush: vi.fn().mockResolvedValue(undefined),
}));

it('shows Enable on this device button when not subscribed', async () => {
  renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={false} emailVerified={false} />);
  expect(await screen.findByText(/Enable on this device/i)).toBeInTheDocument();
});

it('clicking Enable on this device calls webPush.enableWebPush', async () => {
  renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={false} emailVerified={false} />);
  const button = await screen.findByText(/Enable on this device/i);
  await userEvent.click(button);
  expect(enableWebPush).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify fail**

Expected: tests fail because the button doesn't exist.

- [ ] **Step 3: Modify `NotificationPreferences.tsx`**

Add to the Web Push channel block (before the matrix toggles):

```tsx
import { isWebPushSupported, getSubscriptionStatus, enableWebPush, disableWebPush } from '@/lib/webPush';
import { toast } from '@/components/ui/sonner';

// Inside the component:
const [webPushStatus, setWebPushStatus] = useState<'subscribed' | 'denied' | 'unsupported' | 'available' | 'loading'>('loading');

useEffect(() => {
  if (isWebPushSupported()) {
    getSubscriptionStatus().then(setWebPushStatus);
  } else {
    setWebPushStatus('unsupported');
  }
}, [pushSubscribed]);   // re-check when availability changes

const handleEnableWebPush = async () => {
  try {
    await enableWebPush();
    toast.success('Web Push enabled');
    setWebPushStatus('subscribed');
  } catch (err) {
    showApiError(err as Error, 'Failed to enable Web Push');
  }
};

const handleDisableWebPush = async () => {
  try {
    await disableWebPush();
    toast.success('Web Push disabled on this device');
    setWebPushStatus('available');
  } catch (err) {
    showApiError(err as Error, 'Failed to disable Web Push');
  }
};

// Inside the Web Push channel block (in the existing CHANNELS.map iteration, when channel === 'webPush'):
{channel === 'webPush' && (
  <div className="text-sm">
    {webPushStatus === 'loading' && <span>Checking…</span>}
    {webPushStatus === 'subscribed' && (
      <Button variant="outline" size="sm" onClick={handleDisableWebPush}>
        Disable on this device
      </Button>
    )}
    {webPushStatus === 'available' && (
      <Button variant="outline" size="sm" onClick={handleEnableWebPush}>
        Enable on this device
      </Button>
    )}
    {webPushStatus === 'denied' && (
      <span className="text-muted-foreground">
        Notification permission blocked — enable in browser settings
      </span>
    )}
    {webPushStatus === 'unsupported' && (
      <span className="text-muted-foreground">Browser doesn't support Web Push</span>
    )}
  </div>
)}
```

Adjust to fit the existing structure of the Web Push block.

- [ ] **Step 4: Run tests, verify pass**

Expected: 2 new tests pass; full suite no regressions.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'src/components/settings/NotificationPreferences.tsx' 'src/components/settings/__tests__/NotificationPreferences.test.tsx'
git -C 'D:\src\aloevera-harmony-meet' commit -m "notifications: Enable/Disable on this device button in NotificationPreferences"
```

---

## Task 10: Docs + docker-compose env

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\NOTIFICATIONS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\API_INTEGRATION.md`
- Modify: `D:\src\aloevera-harmony-meet\docker-compose.yml`

Today's date: 2026-05-18.

- [ ] **Step 1: Append Phase E section to backend `NOTIFICATIONS.md`**

```markdown
## Phase E — shipped 2026-MM-DD

**Web Push** is a real delivery channel. Architecture: dispatcher lives in `Lovecraft.Backend` (the API process), NOT in `Lovecraft.NotificationsWorker`. Producer dispatches in-process via `IWebPushDispatcher` for `WebPush` channel, same pattern as `IInAppDispatcher` for SignalR.

**Setup:**
- `Lovecraft.Tools.VapidKeygen` CLI: `dotnet run --project Lovecraft.Tools.VapidKeygen` prints a fresh keypair. Copy `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` into `.env`. Run once per environment; rotation invalidates all subscriptions.
- `GET /api/v1/push/vapid-public-key` (no auth) exposes the public key to the frontend.

**Pipeline:**
- `WebPushPayloadRenderer` maps `NotificationDto` → `WebPushNotificationDto` (title, body, url). Same URL-allowlist treatment as Telegram for `CommunityBroadcast`.
- `WebPushDispatcher` iterates `IPushSubscriptionService.ListAsync(userId)`, sends each subscription via `WebPushClient.SendNotificationAsync(subscription, payload, vapidDetails)`. Dead subscriptions (HTTP 404/410) → call `_pushService.UnsubscribeAsync(userId, deviceId)`. Other errors → log + continue.

**In-process channel orphan fix:** `NotificationProducer` no longer enqueues `OUTBOX_InApp_PENDING` or `OUTBOX_WebPush_PENDING` rows — those channels are dispatched in-process and the outbox rows would be orphaned. The DispatcherWorker / DigestWorker / JanitorWorker only handle Telegram and Email.

**Frontend:**
- `public/sw.js` service worker — minimal `push` + `notificationclick` handlers
- `src/lib/webPush.ts` — `isWebPushSupported`, `getSubscriptionStatus`, `enableWebPush`, `disableWebPush` helpers
- `src/components/settings/NotificationPreferences.tsx` Web Push channel block has an "Enable on this device" button (or "Disable" if subscribed)
- Permission is requested on the explicit Enable click (browser requirement for user gesture)

**Required env vars (Phase E additions):**
```
VAPID_PUBLIC_KEY=...     # P-256 public key, base64url
VAPID_PRIVATE_KEY=...    # P-256 private key, base64url
VAPID_SUBJECT=mailto:noreply@aloeband.ru
```
Generate via `dotnet run --project Lovecraft.Tools.VapidKeygen`.

**Known follow-ups:**
- English-only payload text (no `Settings.Language` lookup yet — same trade-off as Phase D Telegram).
- `AppBaseUrl` hardcoded `/` paths in the renderer (no scheme/host — the URL is the path-only string; frontend's service worker prepends origin). Sufficient because notifications are origin-scoped to the user's subscribed app.
```

- [ ] **Step 2: Add `IMPLEMENTATION_SUMMARY.md` line**

```
- ✅ Notifications Phase E: WebPushDispatcher (in-process, VAPID, dead-sub cleanup); Lovecraft.Tools.VapidKeygen CLI; GET /push/vapid-public-key; service worker + browser-side helper; "Enable on this device" UI. Producer now skips outbox enqueue for in-process channels.
```

- [ ] **Step 3: Update `ISSUES.md`**

In MCF.4's Resolution block, append:
```
Phase E (Web Push) shipped 2026-MM-DD. Phases F (email digest), G (event reminders + admin broadcast), H (rank-up) pending.
```

- [ ] **Step 4: Update `AGENTS.md`**

Add a bullet under notifications:
```
- Web Push channel: opt-in per device via Settings → Notifications → Browser push → "Enable on this device". Helper at `src/lib/webPush.ts`. Backend uses `WebPushDispatcher` (in-process; no worker involvement). Dead subscriptions auto-cleaned on HTTP 404/410.
```

- [ ] **Step 5: Update `API_INTEGRATION.md`**

Note the now-real endpoints under Notifications section:
```
- `GET /api/v1/push/vapid-public-key` (no auth) — returns the configured VAPID public key for the frontend to use as `applicationServerKey` in `pushManager.subscribe`.
- `POST /api/v1/push/subscribe` / `DELETE /api/v1/push/subscribe/{deviceId}` — register/unregister device push subscription (these existed from Phase A; now real).
```

- [ ] **Step 6: Update `docker-compose.yml`**

In the `backend` service block, update the `env_file:` comment to mention VAPID:
```yaml
    env_file:
      # Picks up: AZURE_STORAGE_CONNECTION_STRING, USE_AZURE_STORAGE,
      # JWT_SECRET_KEY, GOOGLE_OAUTH_CLIENT_ID, TELEGRAM_BOT_TOKEN,
      # SENDGRID_API_KEY, INTERNAL_SERVICE_TOKEN, VAPID_*
      - ../lovecraft/Lovecraft/.env
```

- [ ] **Step 7: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md' 'Lovecraft/docs/IMPLEMENTATION_SUMMARY.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase E (Web Push + VAPID)"

git -C 'D:\src\aloevera-harmony-meet' add 'docs/ISSUES.md' 'AGENTS.md' 'docs/API_INTEGRATION.md' 'docker-compose.yml'
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase E (Web Push)"
```

---

## Task 11: Final verification

**Files:** none.

- [ ] **Step 1: Build + test backend**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --nologo
```
Expected: 7 projects build (VapidKeygen added), 0 errors. Full suite: 393 (Phase D) + 2 (vapid endpoint) + 4 (renderer) + 5 (dispatcher) + 2 (producer) = 406. Hopefully no regressions.

- [ ] **Step 2: Build + test frontend**

```
npm --prefix 'D:/src/aloevera-harmony-meet' run test:run
npm --prefix 'D:/src/aloevera-harmony-meet' run build
```
Expected: full suite passes (228 prior + 4 webPush + 2 NotificationPreferences = 234). Build clean.

- [ ] **Step 3: Verify git state**

```
git -C 'D:\src\lovecraft' log --oneline main..HEAD
git -C 'D:\src\aloevera-harmony-meet' log --oneline main..HEAD
```

Backend: ~7 commits. Frontend: ~4 commits.

- [ ] **Step 4: Marker commits (optional)**

```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase E complete"
git -C 'D:\src\aloevera-harmony-meet' commit --allow-empty -m "notifications: phase E complete"
```

---

## After Phase E

Phase E follow-ups (track but don't block):
1. **Notification icon assets** — service worker references `/icon-192.png` and `/badge.png`. Verify these exist in `public/` or create them. Without them browser falls back to a default but UX is slightly worse.
2. **Locale-aware rendering** — same trade-off as Phase D Telegram. Defer until a shared `INotificationLocalizer` interface lands.
3. **`AppBaseUrl` env config** — both `TelegramMessageRenderer` and `WebPushPayloadRenderer` hardcode the path-only URLs; the frontend prepends origin. Acceptable for now but should be parameterized when staging environments need different hosts.
4. **Service worker auto-registration** — currently SW is only registered on the explicit "Enable on this device" click. A future enhancement registers it on app load and lets the user opt-in/out later without re-registering. Probably worth deferring — Vite's HMR and SW caching don't always play nicely in dev.

**Next phase: F (Email digest)** — `IEmailService.SendNotificationDigestAsync` template (HTML + plaintext); worker daily digest path; signed unsubscribe link. Worker currently has `StubEmailDispatcher` — swap to real `EmailDispatcher` that calls `IEmailService`.
