# Notifications — Phase D (Telegram Dispatcher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase C `StubTelegramDispatcher` with a real `TelegramDispatcher` that sends formatted notifications via the Telegram Bot API to users who have linked their Telegram account and opted Telegram on in `NotificationPreferences`. Extend the existing `Lovecraft.TelegramBot` worker to handle inline-keyboard callbacks ("Mute these"). Add a service-token-authenticated internal endpoint so the bot can mutate prefs on the user's behalf without a JWT.

**Architecture:** `TelegramDispatcher` reads the user's `TelegramUserId` from the `users` Azure Table directly (worker becomes a 4th-table consumer). Formats the message via `TelegramMessageRenderer` (per-type HTML templates + inline keyboard with "Open in app" deep link + "Mute these" callback button). Sends via `Telegram.Bot` SDK with per-bot global throttling (25 concurrent, ~30/s safe limit) and per-chat 1-second cooldown. Dead-letters immediately on `Forbidden: bot was blocked` and clears all `prefs.matrix.*.telegram = false` for that user. Real callbacks land at `Lovecraft.TelegramBot` worker, which calls a new internal backend endpoint `POST /api/v1/internal/notifications/mute-type` with `X-Service-Token` header.

**Tech Stack:** .NET 10 / `Telegram.Bot` 22.4.4 (same version `Lovecraft.TelegramBot` uses) / Azure.Data.Tables / xUnit + Moq.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Predecessors:** [Phase A](./2026-05-17-notifications-phase-a-foundations.md), [Phase B](./2026-05-18-notifications-phase-b-in-app.md), [Phase C](./2026-05-18-notifications-phase-c-worker.md) (worker scaffold + stub dispatchers).

**Scope decisions (Phase D):**
- **English-only message text.** Multi-locale rendering (reading `Settings.Language` from prefs) is deferred to a follow-up task. Telegram messages in Phase D use English templates with placeholder substitution.
- **Worker reads `users` table directly** (one extra read per dispatch) via a minimal `UserTelegramContactEntity` that only deserializes `TelegramUserId`. Symmetric with existing 3-table consumption.
- **"Open in app" buttons point to `https://aloeve.club/...`** routes (matches frontend formatter URLs from Phase B). No `t.me` deep links — Telegram Mini App polish is MCF.17 partial.
- **"Mute these" callback flips the entire type's Telegram column to false** for that user (not just unsubscribes one notification). The user can re-enable in Settings.
- **Service token gates the internal endpoint** — new `[RequireServiceToken]` attribute reads `X-Service-Token` header, compares to `INTERNAL_SERVICE_TOKEN` env var (constant-time compare).
- **The bot resolves Telegram user ID → app user ID** via the existing `usertelegramindex` table (Bot becomes a 5th-table consumer; minimal addition).
- **Rate limiting**: per-bot `SemaphoreSlim(25)` for global concurrency + per-chat 1-second cooldown via `ConcurrentDictionary<chatId, DateTime>`. Conservative vs Telegram's actual limits (30 msg/s/bot, 1 msg/s/chat) but safer.

**Repos:**
- Backend: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)
- Frontend: `D:\src\aloevera-harmony-meet` (commits via `git -C 'D:\src\aloevera-harmony-meet'` — only docker-compose env vars + docs)

**Branches:**
- Backend: `feat/notifications-phase-d`
- Frontend: `feat/notifications-phase-d`

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Build: `dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'`

---

## File map

### Backend new files (`D:\src\lovecraft\Lovecraft\`)

| File | Responsibility |
|---|---|
| `Lovecraft.Backend\Attributes\RequireServiceTokenAttribute.cs` | Sync action filter: 401 if `X-Service-Token` header doesn't match `INTERNAL_SERVICE_TOKEN` env var |
| `Lovecraft.Backend\Controllers\V1\InternalController.cs` | `POST /api/v1/internal/notifications/mute-type` |
| `Lovecraft.Common\DTOs\Notifications\InternalMuteTypeRequestDto.cs` | `{ TelegramUserId: string, Type: string }` |
| `Lovecraft.NotificationsWorker\Entities\UserTelegramContactEntity.cs` | Partial entity over `users` table — only deserializes `TelegramUserId` |
| `Lovecraft.NotificationsWorker\Renderers\ITelegramMessageRenderer.cs` + `TelegramMessageRenderer.cs` | Per-type HTML template + inline keyboard builder |
| `Lovecraft.NotificationsWorker\Dispatchers\TelegramDispatcher.cs` | Real impl: looks up chat id, renders message, sends via `Telegram.Bot`, handles rate limits + errors |
| `Lovecraft.NotificationsWorker\Services\ITelegramRateLimiter.cs` + `TelegramRateLimiter.cs` | `SemaphoreSlim(25)` + per-chat cooldown dictionary |
| `Lovecraft.TelegramBot\NotificationCallbackHandler.cs` | Handles `mute:{type}` callback queries; calls backend with service token |
| `Lovecraft.UnitTests\NotificationsWorker\TelegramMessageRendererTests.cs` | 6 tests: one per type rendering + inline keyboard |
| `Lovecraft.UnitTests\NotificationsWorker\TelegramDispatcherTests.cs` | 5 tests: success / forbidden→dead+mute / network→retry / chat-id-missing→dead / rate-limit semaphore |
| `Lovecraft.UnitTests\NotificationsWorker\TelegramRateLimiterTests.cs` | 3 tests: concurrent cap, per-chat cooldown, cooldown expires |
| `Lovecraft.UnitTests\TelegramBot\NotificationCallbackHandlerTests.cs` | 3 tests: mute callback → backend call, unknown callback ignored, malformed callback safe |
| `Lovecraft.UnitTests\InternalControllerTests.cs` | 4 tests: valid token → 200, missing header → 401, wrong token → 401, mute flips matrix |

### Backend modifications (`D:\src\lovecraft\Lovecraft\`)

| File | Change |
|---|---|
| `Lovecraft.NotificationsWorker\TableNames.cs` | + `Users` constant |
| `Lovecraft.NotificationsWorker\Program.cs` | DI: replace `StubTelegramDispatcher` registration with `TelegramDispatcher`; add `TelegramRateLimiter` singleton; add `users` TableClient; read `TELEGRAM_BOT_TOKEN` env var (fatal if missing); `ITelegramMessageRenderer` registration |
| `Lovecraft.Backend\Services\INotificationPreferenceService` | + `Task SetChannelDisabledForTypeAsync(string userId, NotificationType type, NotificationChannel channel)` (helper for the mute path) |
| `Lovecraft.Backend\Services\MockNotificationPreferenceService.cs` | implement the new method |
| `Lovecraft.Backend\Services\Azure\AzureNotificationPreferenceService.cs` | implement the new method |
| `Lovecraft.Backend\Services\IUserService.cs` (in `IServices.cs`) | + `Task<string?> GetTelegramUserIdAsync(string userId)` (the bot uses this to look up Telegram id from app id; only needed if the bot calls into IUserService — keep this only if necessary) — actually NOT NEEDED if the bot calls `usertelegramindex` directly via service token. **Skip this addition.** |
| `Lovecraft.Backend\Program.cs` | Map `InternalController` — no special wiring; the `[RequireServiceToken]` attribute is self-contained |
| `Lovecraft.TelegramBot\TelegramBotWorker.cs` | Extend `HandleUpdateAsync` to handle `update.CallbackQuery`; delegates to `NotificationCallbackHandler` |
| `Lovecraft.TelegramBot\Lovecraft.TelegramBot.csproj` | + `System.Net.Http.Json` package reference (for service token POST) |

### Frontend modifications (`D:\src\aloevera-harmony-meet\`)

| File | Change |
|---|---|
| `docker-compose.yml` | Pass `TELEGRAM_BOT_TOKEN` env var to `notifications-worker` service; pass `INTERNAL_SERVICE_TOKEN` to both `backend` and `telegram-bot` (note: docker-compose env_file already loads from .env, so this may be a docs-only change — verify) |

### Docs

| File | Change |
|---|---|
| `lovecraft\Lovecraft\docs\NOTIFICATIONS.md` | Append Phase D section (real Telegram, callback flow, rate limits) |
| `lovecraft\Lovecraft\docs\TELEGRAM_AUTH.md` | Add section on the callback / mute flow |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | One-line entry under "Done since" |
| `aloevera-harmony-meet\docs\ISSUES.md` | Update MCF.4: Phase D shipped; E/F/G/H pending |
| `aloevera-harmony-meet\AGENTS.md` | Note: notifications can now reach Telegram for users who opt in |

---

## Task ordering

Backend infrastructure first (Tasks 1–2: service token + internal endpoint, prefs mute helper), then worker pieces (Tasks 3–5: user contact entity, renderer, dispatcher, rate limiter), then bot extension (Task 6), then DI + docker (Task 7), docs (Task 8), final verification (Task 9). Branch setup is Task 0.

---

## Task 0: Create feature branches

**Files:** none.

- [ ] **Step 1: Backend branch**

```bash
git -C 'D:\src\lovecraft' checkout main
git -C 'D:\src\lovecraft' pull --ff-only
git -C 'D:\src\lovecraft' checkout -b feat/notifications-phase-d
```

- [ ] **Step 2: Frontend branch**

```bash
git -C 'D:\src\aloevera-harmony-meet' checkout main
git -C 'D:\src\aloevera-harmony-meet' pull --ff-only
git -C 'D:\src\aloevera-harmony-meet' checkout -b feat/notifications-phase-d
```

No commit.

---

## Task 1: Service-token auth + internal mute endpoint

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Attributes\RequireServiceTokenAttribute.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\InternalController.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Notifications\InternalMuteTypeRequestDto.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs` (add `SetChannelDisabledForTypeAsync` to `INotificationPreferenceService`)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockNotificationPreferenceService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureNotificationPreferenceService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs` (extend `IUserService` if needed — see below)
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\InternalControllerTests.cs`

The endpoint: `POST /api/v1/internal/notifications/mute-type` body `{ telegramUserId, type }` headers `X-Service-Token: <secret>`. Looks up app user id via `usertelegramindex`, flips `prefs.matrix[type].telegram = false`. Returns 204.

- [ ] **Step 1: Add the request DTO**

`Lovecraft.Common/DTOs/Notifications/InternalMuteTypeRequestDto.cs`:
```csharp
namespace Lovecraft.Common.DTOs.Notifications;

public class InternalMuteTypeRequestDto
{
    /// <summary>Telegram user id (as string) the bot received in the callback.</summary>
    public string TelegramUserId { get; set; } = string.Empty;
    /// <summary>NotificationType camelCase name, e.g. "messageReceived".</summary>
    public string Type { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Write `RequireServiceTokenAttribute.cs`**

```csharp
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lovecraft.Backend.Attributes;

/// <summary>
/// Action filter: rejects with 401 if the X-Service-Token request header doesn't match
/// the INTERNAL_SERVICE_TOKEN env var. Used for back-channel calls from Lovecraft.TelegramBot
/// into Lovecraft.Backend (e.g. mute-type endpoint).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireServiceTokenAttribute : Attribute, IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        var expected = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_TOKEN");
        if (string.IsNullOrEmpty(expected))
        {
            context.Result = new StatusCodeResult(503);
            return;
        }

        if (!context.HttpContext.Request.Headers.TryGetValue("X-Service-Token", out var provided))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var providedBytes = Encoding.UTF8.GetBytes(provided.ToString());
        if (!CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes))
        {
            context.Result = new UnauthorizedResult();
            return;
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
```

- [ ] **Step 3: Add `SetChannelDisabledForTypeAsync` to `INotificationPreferenceService`**

In `IServices.cs`, on `INotificationPreferenceService`:
```csharp
/// <summary>Flip prefs.matrix[type].channel to false. Used by the mute-type internal endpoint.</summary>
Task SetChannelDisabledForTypeAsync(string userId, string typeKey, string channelKey);
```

(Use string keys not enum so callers can pass camelCase from JSON without re-parsing.)

- [ ] **Step 4: Implement on `MockNotificationPreferenceService`**

```csharp
public async Task SetChannelDisabledForTypeAsync(string userId, string typeKey, string channelKey)
{
    var prefs = await GetPreferencesAsync(userId);
    if (prefs.Matrix.TryGetValue(typeKey, out var row))
    {
        row[channelKey] = false;
    }
    await UpdatePreferencesAsync(userId, prefs);
}
```

- [ ] **Step 5: Implement on `AzureNotificationPreferenceService`**

```csharp
public async Task SetChannelDisabledForTypeAsync(string userId, string typeKey, string channelKey)
{
    var prefs = await GetPreferencesAsync(userId);
    if (prefs.Matrix.TryGetValue(typeKey, out var row))
    {
        row[channelKey] = false;
    }
    await UpdatePreferencesAsync(userId, prefs);
}
```

(Same body — both impls delegate to the existing `Get`+`Update` methods. If you prefer a more direct ETag-aware update on the Azure path, do that — but the read-modify-write pattern is fine for low-frequency mute clicks.)

- [ ] **Step 6: Write the failing test**

`Lovecraft.UnitTests/InternalControllerTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lovecraft.UnitTests;

public class InternalControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public InternalControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        MockDataStore.NotificationPreferences.Clear();
        Environment.SetEnvironmentVariable("INTERNAL_SERVICE_TOKEN", "test-service-token-abc123");
    }

    [Fact]
    public async Task Missing_header_returns_401()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/internal/notifications/mute-type",
            new InternalMuteTypeRequestDto { TelegramUserId = "1234", Type = "messageReceived" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Wrong_token_returns_401()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Service-Token", "wrong-token");
        var resp = await client.PostAsJsonAsync("/api/v1/internal/notifications/mute-type",
            new InternalMuteTypeRequestDto { TelegramUserId = "1234", Type = "messageReceived" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Unknown_telegram_user_returns_404()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Service-Token", "test-service-token-abc123");
        var resp = await client.PostAsJsonAsync("/api/v1/internal/notifications/mute-type",
            new InternalMuteTypeRequestDto { TelegramUserId = "9999999", Type = "messageReceived" });
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Valid_token_flips_matrix_to_false()
    {
        // Seed: a user linked via Telegram. Look at the existing TelegramPendingFlowTests to find the
        // mock telegram-link helper, or call the auth API directly to register a Telegram user.
        // Then opt them into Telegram notifications, then mute via internal endpoint, then verify off.

        // For brevity in the plan: seed via MockDataStore.UserTelegramIndex (assumes such a static
        // dictionary exists, or use the equivalent index location MockAuthService uses).
        var telegramId = "555111";
        var userId = "user-abc";
        MockDataStore.UserTelegramIndex ??= new();          // ensure dict exists; check actual store
        MockDataStore.UserTelegramIndex[telegramId] = userId;

        // Pre-seed prefs with Telegram on for messageReceived
        var prefSvc = (INotificationPreferenceService)_factory.Services.GetRequiredService(typeof(INotificationPreferenceService));
        var prefs = await prefSvc.GetPreferencesAsync(userId);
        prefs.Matrix["messageReceived"]["telegram"] = true;
        await prefSvc.UpdatePreferencesAsync(userId, prefs);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Service-Token", "test-service-token-abc123");
        var resp = await client.PostAsJsonAsync("/api/v1/internal/notifications/mute-type",
            new InternalMuteTypeRequestDto { TelegramUserId = telegramId, Type = "messageReceived" });
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        var after = await prefSvc.GetPreferencesAsync(userId);
        Assert.False(after.Matrix["messageReceived"]["telegram"]);
    }
}
```

**Note for executor:** The exact name of the mock Telegram index in `MockDataStore` may differ from `UserTelegramIndex`. Read `MockAuthService.cs` to find what it uses (Phase A added `usertelegramindex` table; the mock equivalent should exist). If it doesn't, add it now — small symmetric addition to `MockDataStore`.

- [ ] **Step 7: Write `InternalController.cs`**

The controller needs `IUserService` (or direct table access) to resolve Telegram id → user id. Check what's available — there's likely an existing helper. If not, add a small `Task<string?> ResolveAppUserIdAsync(string telegramUserId)` to `IUserService`.

Cleaner approach: add the resolution method to `IUserService`:
```csharp
// In IServices.cs IUserService:
Task<string?> GetUserIdByTelegramIdAsync(string telegramUserId);
```

Implement on Mock (look up in `MockDataStore.UserTelegramIndex` or whatever the existing mock auth uses) and Azure (query `usertelegramindex` table — see `AzureAuthService.TelegramLoginAsync` for the pattern).

Then the controller:

```csharp
using Lovecraft.Backend.Attributes;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Route("api/v1/internal")]
[RequireServiceToken]
public class InternalController : ControllerBase
{
    private readonly IUserService _users;
    private readonly INotificationPreferenceService _prefs;

    public InternalController(IUserService users, INotificationPreferenceService prefs)
    {
        _users = users;
        _prefs = prefs;
    }

    [HttpPost("notifications/mute-type")]
    public async Task<IActionResult> MuteType([FromBody] InternalMuteTypeRequestDto request)
    {
        if (string.IsNullOrEmpty(request.TelegramUserId) || string.IsNullOrEmpty(request.Type))
            return BadRequest();

        var userId = await _users.GetUserIdByTelegramIdAsync(request.TelegramUserId);
        if (userId is null)
            return NotFound();

        await _prefs.SetChannelDisabledForTypeAsync(userId, request.Type, "telegram");
        return NoContent();
    }
}
```

- [ ] **Step 8: Run tests, verify pass**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~InternalControllerTests"
```

Target: 4/4 pass; previous 371 still pass.

- [ ] **Step 9: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Backend/Attributes/' 'Lovecraft/Lovecraft.Backend/Controllers/V1/InternalController.cs' 'Lovecraft/Lovecraft.Backend/Services/IServices.cs' 'Lovecraft/Lovecraft.Backend/Services/MockNotificationPreferenceService.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureNotificationPreferenceService.cs' 'Lovecraft/Lovecraft.Backend/Services/MockUserService.cs' 'Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs' 'Lovecraft/Lovecraft.Common/DTOs/Notifications/InternalMuteTypeRequestDto.cs' 'Lovecraft/Lovecraft.UnitTests/InternalControllerTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: service-token internal endpoint + mute-type + GetUserIdByTelegramId"
```

Also stage `MockDataStore.cs` if a new dict was added there.

---

## Task 2: Worker user-contact entity + users TableName

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Entities\UserTelegramContactEntity.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\TableNames.cs`

The worker needs to look up `TelegramUserId` from the `users` table. Partial entity that only deserializes the field it needs.

- [ ] **Step 1: Add `Users` to worker `TableNames.cs`**

In `Lovecraft.NotificationsWorker/TableNames.cs`, append:
```csharp
public static string Users => Prefix + "users";
```

- [ ] **Step 2: Create `Entities/UserTelegramContactEntity.cs`**

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

/// <summary>
/// Partial mirror of Lovecraft.Backend.Storage.Entities.UserEntity — worker only needs
/// the Telegram chat id to dispatch. Azure Table Storage deserializes only matching columns
/// and ignores the rest, so this works without re-declaring the full user schema.
/// </summary>
public class UserTelegramContactEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string TelegramUserId { get; set; } = string.Empty;

    public static string GetPartitionKey(string userId)
    {
        if (string.IsNullOrEmpty(userId)) return "user-?";
        return $"user-{char.ToLowerInvariant(userId[0])}";
    }
}
```

(Verify the `GetPartitionKey` formula against the backend's `UserEntity.GetPartitionKey` — they must match. Read backend's UserEntity first.)

- [ ] **Step 3: Build**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Entities/UserTelegramContactEntity.cs' 'Lovecraft/Lovecraft.NotificationsWorker/TableNames.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: UserTelegramContactEntity for chat id lookups"
```

---

## Task 3: Telegram message renderer

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Renderers\ITelegramMessageRenderer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Renderers\TelegramMessageRenderer.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\TelegramMessageRendererTests.cs`

Renderer maps `NotificationModel` to `(string htmlBody, InlineKeyboardMarkup keyboard)`. Per-type templates use HTML parse mode. Each notification gets a `[Open in app]` button (URL based on type) + a `[Mute these]` button (callback_data `mute:{typeCamelCase}`).

URL routing (matches frontend formatter from Phase B):
- `LikeReceived` / `MatchCreated` → `https://aloeve.club/friends?userId={actorId}` (or `/friends` if anonymous)
- `MessageReceived` → `https://aloeve.club/talks?chat={chatId}` (payload has chatId)
- `ForumReplyToThread` → `https://aloeve.club/talks?topic={topicId}`
- `EventPublished` / `EventReminder` / `EventInviteReceived` → `https://aloeve.club/aloevera/events/{eventId}`
- `CommunityBroadcast` → uses `payload.link` if present, else `/aloevera`
- `RankUp` → `/settings`

For the body, follow the spec's i18n keys from `LanguageContext` (Phase B):
- `LikeReceived`: `❤️ <b>{actorName}</b> liked your profile` (or `Someone liked your profile` if anonymous)
- `MatchCreated`: `💞 New match with <b>{actorName}</b>!`
- `MessageReceived`: `💬 <b>{actorName}</b>: {preview}` (preview is in payload.preview, already truncated to 80 chars by Phase B)
- `ForumReplyToThread`: `💭 <b>{actorName}</b> replied in a thread`
- `CommunityBroadcast`: `📣 <b>{title}</b>\n\n{body}` (HtmlEncode the body)
- `EventPublished`: `📅 New event: <b>{eventTitle}</b>`
- `EventReminder`: `⏰ Event tomorrow: <b>{eventTitle}</b>`
- `EventInviteReceived`: `🎟️ You're invited: <b>{eventTitle}</b>`
- `RankUp`: `🏆 You're now <b>{newRank}</b>!`

Worker only knows `actorId` (not `actorName`) — Phase A's `NotificationModel` doesn't carry the actor name. **Two options:**
- A. Add `ActorName` to `NotificationModel` (requires backend producer to denormalize on enqueue — Phase A didn't)
- B. Worker fetches actor name from users table (extra read per dispatch)

For Phase D simplicity: render with a generic fallback `<b>Someone</b>` if `actorName` isn't available. Phase D ship without the lookup; defer enrichment to follow-up.

Actually — simpler: producer already wrote actor info into the `notifications` row's `ActorId`. The renderer can look up the actor's name OR just say "Someone you matched with" / "A user" as a placeholder. KISS for Phase D:

Default rendering:
- If actor name available (future) → use it
- Else if actorId not null → `Someone` (a real user, vs system)
- Else (system notification) → no actor

Actually let me revise. The PayloadJson already contains some context (preview, eventTitle, etc.). For Phase D, render with what's in the payload + fallback to "Someone" for actor. Then in a follow-up, add actor enrichment.

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs`:

```csharp
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Microsoft.Extensions.Logging.Abstractions;
using Telegram.Bot.Types.ReplyMarkups;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class TelegramMessageRendererTests
{
    private readonly TelegramMessageRenderer _renderer = new(NullLogger<TelegramMessageRenderer>.Instance);

    [Fact]
    public void LikeReceived_anonymous_omits_actor()
    {
        var notif = new NotificationModel("n1", "u1", "LikeReceived", null,
            "{\"likeId\":\"l1\",\"anonymous\":true}", DateTime.UtcNow);

        var (html, _) = _renderer.Render(notif);

        Assert.Contains("Someone", html);
        Assert.DoesNotContain("<b>Someone</b> liked", html);   // anonymous wording can vary; just check no actor name leak
    }

    [Fact]
    public void MessageReceived_uses_payload_preview()
    {
        var notif = new NotificationModel("n2", "u1", "MessageReceived", "actor",
            "{\"chatId\":\"c1\",\"messageId\":\"m1\",\"preview\":\"hello there\"}", DateTime.UtcNow);

        var (html, _) = _renderer.Render(notif);

        Assert.Contains("hello there", html);
    }

    [Fact]
    public void All_notifications_have_open_in_app_button_with_aloeve_url()
    {
        var notif = new NotificationModel("n3", "u1", "MatchCreated", "actor",
            "{\"matchId\":\"m1\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        Assert.NotNull(keyboard);
        var buttons = keyboard.InlineKeyboard.SelectMany(row => row).ToList();
        var openButton = buttons.FirstOrDefault(b => b.Text.Contains("Open"));
        Assert.NotNull(openButton);
        Assert.StartsWith("https://aloeve.club/", openButton!.Url);
    }

    [Fact]
    public void All_notifications_have_mute_callback_button()
    {
        var notif = new NotificationModel("n4", "u1", "MessageReceived", "actor",
            "{\"chatId\":\"c1\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        var muteButton = keyboard.InlineKeyboard.SelectMany(row => row).FirstOrDefault(b => b.CallbackData?.StartsWith("mute:") == true);
        Assert.NotNull(muteButton);
        Assert.Equal("mute:messageReceived", muteButton!.CallbackData);
    }

    [Fact]
    public void CommunityBroadcast_uses_payload_link()
    {
        var notif = new NotificationModel("n5", "u1", "CommunityBroadcast", null,
            "{\"title\":\"Big news\",\"body\":\"something\",\"link\":\"/aloevera/events/42\"}", DateTime.UtcNow);

        var (_, keyboard) = _renderer.Render(notif);

        var openButton = keyboard.InlineKeyboard.SelectMany(row => row).First(b => b.Text.Contains("Open"));
        Assert.Equal("https://aloeve.club/aloevera/events/42", openButton.Url);
    }

    [Fact]
    public void Malformed_payload_renders_gracefully()
    {
        var notif = new NotificationModel("n6", "u1", "MessageReceived", "actor",
            "not-valid-json", DateTime.UtcNow);

        var (html, keyboard) = _renderer.Render(notif);

        Assert.NotNull(html);
        Assert.NotEmpty(html);
        Assert.NotNull(keyboard);
    }
}
```

- [ ] **Step 2: Run tests, verify fail**

Expected: compile errors — renderer doesn't exist.

- [ ] **Step 3: Write `ITelegramMessageRenderer.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;
using Telegram.Bot.Types.ReplyMarkups;

namespace Lovecraft.NotificationsWorker.Renderers;

public interface ITelegramMessageRenderer
{
    /// <summary>
    /// Renders a notification as Telegram HTML body + inline keyboard.
    /// Returns null body if the notification type is not supported (defensive).
    /// </summary>
    (string Html, InlineKeyboardMarkup Keyboard) Render(NotificationModel notification);
}
```

- [ ] **Step 4: Write `TelegramMessageRenderer.cs`**

```csharp
using System.Text.Json;
using System.Web;
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;
using Telegram.Bot.Types.ReplyMarkups;

namespace Lovecraft.NotificationsWorker.Renderers;

public class TelegramMessageRenderer : ITelegramMessageRenderer
{
    private const string AppBaseUrl = "https://aloeve.club";

    private readonly ILogger<TelegramMessageRenderer> _logger;

    public TelegramMessageRenderer(ILogger<TelegramMessageRenderer> logger)
    {
        _logger = logger;
    }

    public (string Html, InlineKeyboardMarkup Keyboard) Render(NotificationModel notification)
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
                notification.NotificationId);
        }

        string body = notification.Type switch
        {
            "LikeReceived" => GetString(payload, "anonymous") == "True" || GetString(payload, "anonymous") == "true"
                ? "❤️ Someone liked your profile"
                : "❤️ Someone liked your profile",     // actor name lookup is a Phase D follow-up
            "MatchCreated" => "💞 You have a new match!",
            "MessageReceived" => $"💬 New message: {HttpUtility.HtmlEncode(GetString(payload, "preview"))}",
            "ForumReplyToThread" => "💭 Someone replied in a thread",
            "CommunityBroadcast" => $"📣 <b>{HttpUtility.HtmlEncode(GetString(payload, "title"))}</b>\n\n{HttpUtility.HtmlEncode(GetString(payload, "body"))}",
            "EventPublished" => $"📅 New event: <b>{HttpUtility.HtmlEncode(GetString(payload, "eventTitle"))}</b>",
            "EventReminder" => $"⏰ Event tomorrow: <b>{HttpUtility.HtmlEncode(GetString(payload, "eventTitle"))}</b>",
            "EventInviteReceived" => $"🎟️ You're invited: <b>{HttpUtility.HtmlEncode(GetString(payload, "eventTitle"))}</b>",
            "RankUp" => $"🏆 You're now <b>{HttpUtility.HtmlEncode(GetString(payload, "newRank"))}</b>!",
            _ => $"You have a new notification ({notification.Type})",
        };

        var openUrl = BuildOpenUrl(notification.Type, notification.ActorId, payload);
        var muteData = $"mute:{ToCamelCase(notification.Type)}";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithUrl("Open in app", openUrl),
                InlineKeyboardButton.WithCallbackData("Mute these", muteData),
            },
        });

        return (body, keyboard);
    }

    private static string BuildOpenUrl(string type, string? actorId, Dictionary<string, object?> payload)
    {
        return type switch
        {
            "LikeReceived" or "MatchCreated" => actorId is not null
                ? $"{AppBaseUrl}/friends?userId={Uri.EscapeDataString(actorId)}"
                : $"{AppBaseUrl}/friends",
            "MessageReceived" => $"{AppBaseUrl}/talks?chat={Uri.EscapeDataString(GetString(payload, "chatId"))}",
            "ForumReplyToThread" => $"{AppBaseUrl}/talks?topic={Uri.EscapeDataString(GetString(payload, "topicId"))}",
            "EventPublished" or "EventReminder" or "EventInviteReceived" =>
                $"{AppBaseUrl}/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            "CommunityBroadcast" =>
                IsAbsoluteUrl(GetString(payload, "link")) ? GetString(payload, "link") : $"{AppBaseUrl}{GetString(payload, "link")}",
            "RankUp" => $"{AppBaseUrl}/settings",
            _ => AppBaseUrl,
        };
    }

    private static string GetString(Dictionary<string, object?> payload, string key)
    {
        if (!payload.TryGetValue(key, out var v) || v is null) return string.Empty;
        return v.ToString() ?? string.Empty;
    }

    private static bool IsAbsoluteUrl(string s) => Uri.TryCreate(s, UriKind.Absolute, out _);

    private static string ToCamelCase(string pascal)
    {
        if (string.IsNullOrEmpty(pascal)) return pascal;
        return char.ToLowerInvariant(pascal[0]) + pascal[1..];
    }
}
```

- [ ] **Step 5: Run tests, verify pass**

Expected: 6/6 pass. Adjust `GetString(payload, "anonymous")` comparison if `JsonSerializer` returns `JsonElement` rather than the boxed bool — the test expectations should pass regardless of exact stringification, as long as the renderer produces consistent output.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Renderers/' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramMessageRendererTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: TelegramMessageRenderer + tests"
```

---

## Task 4: Telegram rate limiter

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\ITelegramRateLimiter.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Services\TelegramRateLimiter.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\TelegramRateLimiterTests.cs`

Per-bot semaphore (25 concurrent) + per-chat 1-second cooldown.

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/NotificationsWorker/TelegramRateLimiterTests.cs`:

```csharp
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class TelegramRateLimiterTests
{
    [Fact]
    public async Task First_call_passes_immediately()
    {
        var limiter = new TelegramRateLimiter(NullLogger<TelegramRateLimiter>.Instance);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await limiter.AcquireAsync("chat-1", CancellationToken.None);
        sw.Stop();
        Assert.True(sw.ElapsedMilliseconds < 200, $"First call should be immediate, took {sw.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task Second_call_same_chat_within_1s_is_delayed()
    {
        var limiter = new TelegramRateLimiter(NullLogger<TelegramRateLimiter>.Instance);
        await limiter.AcquireAsync("chat-1", CancellationToken.None);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await limiter.AcquireAsync("chat-1", CancellationToken.None);
        sw.Stop();
        Assert.True(sw.ElapsedMilliseconds >= 900, $"Second call should wait ~1s, took {sw.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task Different_chats_have_independent_cooldowns()
    {
        var limiter = new TelegramRateLimiter(NullLogger<TelegramRateLimiter>.Instance);
        await limiter.AcquireAsync("chat-1", CancellationToken.None);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await limiter.AcquireAsync("chat-2", CancellationToken.None);
        sw.Stop();
        Assert.True(sw.ElapsedMilliseconds < 200, $"Different chat should be immediate, took {sw.ElapsedMilliseconds}ms");
    }
}
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Write `ITelegramRateLimiter.cs`**

```csharp
namespace Lovecraft.NotificationsWorker.Services;

public interface ITelegramRateLimiter
{
    /// <summary>
    /// Acquires a slot for sending to this chat. Blocks until rate limit allows.
    /// Per-chat: minimum 1s between sends. Per-bot: global concurrency cap (25).
    /// </summary>
    Task AcquireAsync(string chatId, CancellationToken ct);
}
```

- [ ] **Step 4: Write `TelegramRateLimiter.cs`**

```csharp
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Services;

public class TelegramRateLimiter : ITelegramRateLimiter, IDisposable
{
    private static readonly TimeSpan PerChatCooldown = TimeSpan.FromSeconds(1);
    private const int MaxGlobalConcurrency = 25;

    private readonly SemaphoreSlim _globalSemaphore = new(MaxGlobalConcurrency, MaxGlobalConcurrency);
    private readonly ConcurrentDictionary<string, DateTime> _lastSendUtc = new();
    private readonly ILogger<TelegramRateLimiter> _logger;

    public TelegramRateLimiter(ILogger<TelegramRateLimiter> logger)
    {
        _logger = logger;
    }

    public async Task AcquireAsync(string chatId, CancellationToken ct)
    {
        await _globalSemaphore.WaitAsync(ct);
        try
        {
            if (_lastSendUtc.TryGetValue(chatId, out var last))
            {
                var elapsed = DateTime.UtcNow - last;
                if (elapsed < PerChatCooldown)
                {
                    var delay = PerChatCooldown - elapsed;
                    await Task.Delay(delay, ct);
                }
            }
            _lastSendUtc[chatId] = DateTime.UtcNow;
        }
        finally
        {
            _globalSemaphore.Release();
        }
    }

    public void Dispose() => _globalSemaphore.Dispose();
}
```

- [ ] **Step 5: Run tests, verify pass**

Expected: 3/3 pass. Tests may be flaky on slow CI — bump the per-chat cooldown assert tolerance if needed.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Services/ITelegramRateLimiter.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Services/TelegramRateLimiter.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramRateLimiterTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: TelegramRateLimiter (semaphore + per-chat cooldown) + tests"
```

---

## Task 5: Real `TelegramDispatcher`

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Dispatchers\TelegramDispatcher.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsWorker\TelegramDispatcherTests.cs`
- Keep: `Lovecraft.NotificationsWorker\Dispatchers\StubTelegramDispatcher.cs` (for tests / local dev — DI swap is Task 6)

The dispatcher:
1. Read user's `TelegramUserId` from `users` table via `UserTelegramContactEntity`.
2. If empty → return `DispatchResult.PermanentError` ("user has no Telegram linked" — dead-letter immediately; this also handles unlinked-after-enqueue).
3. Acquire rate limiter for `chatId = TelegramUserId`.
4. Render via `ITelegramMessageRenderer`.
5. Send via `ITelegramBotClient.SendMessage(chatId, html, parseMode: Html, replyMarkup: keyboard)`.
6. On `Telegram.Bot.Exceptions.ApiRequestException` with code `403` (forbidden / bot blocked):
   - Call `INotificationPreferenceMutator` to flip all `prefs.matrix.*.telegram = false` for the user
   - Return `PermanentError` (dead-letter)
7. On other `ApiRequestException` (4xx) → `PermanentError`
8. On `HttpRequestException` / timeout → `RetryableError`
9. Otherwise → `Delivered`

For step 6: the worker doesn't have direct access to the backend's `INotificationPreferenceService` (different process). The cleanest is to add the same "mute" capability to the worker via a service-token call to the backend's internal endpoint. But that's a 2nd back-channel from worker → backend. For Phase D simplicity, the worker can just log "user blocked bot — would clear telegram prefs" and dead-letter. The backend prefs stay stale (user remains opted in) but the dead-letter prevents repeated failed attempts within the natural retry budget. **Trade-off documented; production fix in a follow-up.**

Better approach if time permits: introduce `INotificationPreferenceClient` in the worker — wraps an HTTP call to the backend's `/internal/notifications/mute-all-telegram` endpoint (new variant of the mute endpoint that flips all 9 type matrix cells). But this adds another endpoint + auth path. Defer to follow-up. **For Phase D: log + dead-letter. Don't propagate to backend prefs.**

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/NotificationsWorker/TelegramDispatcherTests.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class TelegramDispatcherTests
{
    private static NotificationModel SampleNotification(string type = "LikeReceived") =>
        new("n1", "user-abc", type, "actor-1", "{\"likeId\":\"l1\"}", DateTime.UtcNow);

    private static (TelegramDispatcher, Mock<ITelegramBotClient>) BuildDispatcher(
        string? telegramUserId,
        Func<Task<Message>>? sendResult = null,
        Mock<ITelegramRateLimiter>? rateLimiter = null)
    {
        var users = new Mock<TableClient>();
        if (telegramUserId is not null)
        {
            users.Setup(t => t.GetEntityAsync<UserTelegramContactEntity>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response.FromValue(new UserTelegramContactEntity { TelegramUserId = telegramUserId }, new Mock<Response>().Object));
        }
        else
        {
            users.Setup(t => t.GetEntityAsync<UserTelegramContactEntity>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(404, "not found"));
        }

        var bot = new Mock<ITelegramBotClient>();
        if (sendResult is not null)
        {
            bot.Setup(b => b.MakeRequestAsync(It.IsAny<Telegram.Bot.Requests.Abstractions.IRequest<Message>>(), It.IsAny<CancellationToken>()))
                .Returns(sendResult);
        }

        rateLimiter ??= new Mock<ITelegramRateLimiter>();
        rateLimiter.Setup(r => r.AcquireAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var renderer = new TelegramMessageRenderer(NullLogger<TelegramMessageRenderer>.Instance);
        var dispatcher = new TelegramDispatcher(
            bot.Object, users.Object, renderer, rateLimiter.Object,
            NullLogger<TelegramDispatcher>.Instance);

        return (dispatcher, bot);
    }

    [Fact]
    public async Task Successful_send_returns_Delivered()
    {
        var (dispatcher, bot) = BuildDispatcher(telegramUserId: "555111",
            sendResult: () => Task.FromResult(new Message()));

        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);

        Assert.Equal(DispatchResult.Delivered, result);
    }

    [Fact]
    public async Task Missing_telegram_user_returns_PermanentError()
    {
        var (dispatcher, _) = BuildDispatcher(telegramUserId: null);

        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);

        Assert.Equal(DispatchResult.PermanentError, result);
    }

    [Fact]
    public async Task Empty_telegram_id_returns_PermanentError()
    {
        var (dispatcher, _) = BuildDispatcher(telegramUserId: "");

        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);

        Assert.Equal(DispatchResult.PermanentError, result);
    }

    [Fact]
    public async Task Bot_blocked_returns_PermanentError()
    {
        var (dispatcher, _) = BuildDispatcher(telegramUserId: "555111",
            sendResult: () => throw new ApiRequestException("Forbidden: bot was blocked by the user", 403));

        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);

        Assert.Equal(DispatchResult.PermanentError, result);
    }

    [Fact]
    public async Task Network_error_returns_RetryableError()
    {
        var (dispatcher, _) = BuildDispatcher(telegramUserId: "555111",
            sendResult: () => throw new HttpRequestException("network error"));

        var result = await dispatcher.DispatchAsync(SampleNotification(), CancellationToken.None);

        Assert.Equal(DispatchResult.RetryableError, result);
    }
}
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Write `TelegramDispatcher.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Lovecraft.NotificationsWorker.Services;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types.Enums;

namespace Lovecraft.NotificationsWorker.Dispatchers;

/// <summary>
/// Real Telegram channel dispatcher. Looks up user's Telegram chat id from the users table,
/// renders the notification via ITelegramMessageRenderer, sends via Telegram.Bot SDK.
/// </summary>
public class TelegramDispatcher : ITelegramDispatcher
{
    private readonly ITelegramBotClient _bot;
    private readonly TableClient _users;
    private readonly ITelegramMessageRenderer _renderer;
    private readonly ITelegramRateLimiter _rateLimiter;
    private readonly ILogger<TelegramDispatcher> _logger;

    public TelegramDispatcher(
        ITelegramBotClient bot,
        TableClient users,
        ITelegramMessageRenderer renderer,
        ITelegramRateLimiter rateLimiter,
        ILogger<TelegramDispatcher> logger)
    {
        _bot = bot;
        _users = users;
        _renderer = renderer;
        _rateLimiter = rateLimiter;
        _logger = logger;
    }

    public async Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct)
    {
        // Look up chat id
        string? telegramUserId = null;
        try
        {
            var pk = UserTelegramContactEntity.GetPartitionKey(notification.UserId);
            var entity = await _users.GetEntityAsync<UserTelegramContactEntity>(pk, notification.UserId, cancellationToken: ct);
            telegramUserId = entity.Value.TelegramUserId;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            _logger.LogWarning("User {UserId} not found while dispatching Telegram notification {NotificationId}",
                notification.UserId, notification.NotificationId);
            return DispatchResult.PermanentError;
        }

        if (string.IsNullOrEmpty(telegramUserId))
        {
            _logger.LogWarning("User {UserId} has no Telegram linked; cannot dispatch notification {NotificationId}",
                notification.UserId, notification.NotificationId);
            return DispatchResult.PermanentError;
        }

        await _rateLimiter.AcquireAsync(telegramUserId, ct);

        var (html, keyboard) = _renderer.Render(notification);

        try
        {
            await _bot.SendMessage(
                chatId: telegramUserId,
                text: html,
                parseMode: ParseMode.Html,
                replyMarkup: keyboard,
                cancellationToken: ct);

            return DispatchResult.Delivered;
        }
        catch (ApiRequestException ex) when (ex.ErrorCode == 403)
        {
            _logger.LogInformation("Telegram bot blocked by user {UserId} (Telegram id {TelegramId}); dead-lettering notification {NotificationId}. Note: user's Telegram prefs are NOT auto-disabled in Phase D — see follow-up.",
                notification.UserId, telegramUserId, notification.NotificationId);
            return DispatchResult.PermanentError;
        }
        catch (ApiRequestException ex)
        {
            _logger.LogWarning("Telegram API error code {Code}: {Message} (notification {NotificationId})",
                ex.ErrorCode, ex.Message, notification.NotificationId);
            return DispatchResult.PermanentError;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Network error dispatching to Telegram; will retry (notification {NotificationId})",
                notification.NotificationId);
            return DispatchResult.RetryableError;
        }
        catch (TaskCanceledException)
        {
            // Cancelled by stoppingToken — re-throw to let the worker stop cleanly
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error dispatching to Telegram (notification {NotificationId})",
                notification.NotificationId);
            return DispatchResult.RetryableError;
        }
    }
}
```

**Note for executor:** `Telegram.Bot.SendMessage` extension method exists on `ITelegramBotClient` (verify exact signature for v22.4.4). The tests use the lower-level `MakeRequestAsync` for mocking convenience. If the extension method makes the tests harder to mock, adapt the test to inject a request callback via `SendMessage` directly — whichever compiles cleanly.

- [ ] **Step 4: Run tests, verify pass**

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/TelegramDispatcher.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramDispatcherTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: real TelegramDispatcher + tests"
```

---

## Task 6: Wire `TelegramDispatcher` in worker `Program.cs`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.NotificationsWorker\Program.cs`

Replace stub registration with real dispatcher. Add `TELEGRAM_BOT_TOKEN` env read (fatal if missing). Register `ITelegramBotClient` + `ITelegramRateLimiter` + `ITelegramMessageRenderer` + `users` TableClient. The `Lovecraft.NotificationsWorker.csproj` needs the `Telegram.Bot` package reference.

- [ ] **Step 1: Add `Telegram.Bot` package reference to worker csproj**

In `Lovecraft.NotificationsWorker.csproj`, inside the `<ItemGroup>` with other `<PackageReference>` entries:

```xml
<PackageReference Include="Telegram.Bot" Version="22.4.4" />
```

(Match the version used by `Lovecraft.TelegramBot`.)

- [ ] **Step 2: Update `Program.cs`**

Add the imports + env read + DI registrations. Replace `builder.Services.AddSingleton<ITelegramDispatcher, StubTelegramDispatcher>();` with:

```csharp
var telegramBotToken = Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN");
if (string.IsNullOrEmpty(telegramBotToken))
{
    Console.Error.WriteLine("TELEGRAM_BOT_TOKEN not set; Telegram notifications will not be dispatched (using stub).");
    builder.Services.AddSingleton<ITelegramDispatcher, StubTelegramDispatcher>();
}
else
{
    var usersTable = serviceClient.GetTableClient(TableNames.Users);
    // Don't CreateIfNotExists — backend owns this table.

    builder.Services.AddSingleton<ITelegramBotClient>(_ => new TelegramBotClient(telegramBotToken));
    builder.Services.AddSingleton<ITelegramRateLimiter, TelegramRateLimiter>();
    builder.Services.AddSingleton<ITelegramMessageRenderer, TelegramMessageRenderer>();
    builder.Services.AddSingleton<ITelegramDispatcher>(sp => new TelegramDispatcher(
        sp.GetRequiredService<ITelegramBotClient>(),
        usersTable,
        sp.GetRequiredService<ITelegramMessageRenderer>(),
        sp.GetRequiredService<ITelegramRateLimiter>(),
        sp.GetRequiredService<ILogger<TelegramDispatcher>>()));
}
```

Don't remove the `StubEmailDispatcher` registration — that stays until Phase F.

Add the missing `using` directives at the top.

- [ ] **Step 3: Build + test**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: 371 (B) + 4 (Internal) + 6 (renderer) + 3 (rate limiter) + 5 (dispatcher) = 389 tests pass.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj' 'Lovecraft/Lovecraft.NotificationsWorker/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: wire real TelegramDispatcher (StubTelegramDispatcher when token missing)"
```

---

## Task 7: Bot callback handler

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\NotificationCallbackHandler.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\TelegramBotWorker.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.TelegramBot\Lovecraft.TelegramBot.csproj` (no changes likely — `System.Net.Http.Json` is part of base SDK)
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\TelegramBot\NotificationCallbackHandlerTests.cs`

The handler:
- Receives a `CallbackQuery` from `TelegramBotWorker`
- If `Data` starts with `mute:` → extract type → POST to `{BACKEND_INTERNAL_URL}/api/v1/internal/notifications/mute-type` with `{ telegramUserId, type }` body + `X-Service-Token` header
- Answers the callback with a short confirmation toast

Env vars:
- `INTERNAL_SERVICE_TOKEN` — same secret as backend
- `BACKEND_INTERNAL_URL` — e.g. `http://backend:8080` (Docker internal name); fall back to `http://backend:8080` if not set

- [ ] **Step 1: Write the failing tests**

`Lovecraft.UnitTests/TelegramBot/NotificationCallbackHandlerTests.cs`:

```csharp
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using Lovecraft.TelegramBot;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using Xunit;

namespace Lovecraft.UnitTests.TelegramBot;

public class NotificationCallbackHandlerTests
{
    private static (NotificationCallbackHandler handler, Mock<HttpMessageHandler> http) Build(HttpStatusCode responseCode = HttpStatusCode.NoContent)
    {
        var http = new Mock<HttpMessageHandler>();
        http.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(responseCode));

        var client = new HttpClient(http.Object) { BaseAddress = new Uri("http://backend:8080") };
        var handler = new NotificationCallbackHandler(client, serviceToken: "test-token", NullLogger<NotificationCallbackHandler>.Instance);
        return (handler, http);
    }

    [Fact]
    public async Task Mute_callback_posts_to_backend_with_service_token()
    {
        var (handler, http) = Build();

        await handler.HandleMuteCallbackAsync(telegramUserId: 555111, callbackData: "mute:messageReceived", CancellationToken.None);

        http.Protected().Verify("SendAsync", Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.Method == HttpMethod.Post &&
                req.RequestUri!.PathAndQuery == "/api/v1/internal/notifications/mute-type" &&
                req.Headers.GetValues("X-Service-Token").FirstOrDefault() == "test-token"),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Malformed_callback_data_is_ignored_safely()
    {
        var (handler, http) = Build();

        await handler.HandleMuteCallbackAsync(telegramUserId: 555111, callbackData: "not-a-mute", CancellationToken.None);

        http.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Empty_callback_data_is_ignored_safely()
    {
        var (handler, http) = Build();

        await handler.HandleMuteCallbackAsync(telegramUserId: 555111, callbackData: "", CancellationToken.None);

        http.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }
}
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Write `NotificationCallbackHandler.cs`**

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace Lovecraft.TelegramBot;

public class NotificationCallbackHandler
{
    private const string MutePrefix = "mute:";
    private const string MuteEndpoint = "/api/v1/internal/notifications/mute-type";

    private readonly HttpClient _http;
    private readonly string _serviceToken;
    private readonly ILogger<NotificationCallbackHandler> _logger;

    public NotificationCallbackHandler(HttpClient http, string serviceToken, ILogger<NotificationCallbackHandler> logger)
    {
        _http = http;
        _serviceToken = serviceToken;
        _logger = logger;
    }

    /// <summary>
    /// Returns true if the callback was a mute action (caller should answer the callback);
    /// false if the callback was unrecognized and should be ignored.
    /// </summary>
    public async Task<bool> HandleMuteCallbackAsync(long telegramUserId, string callbackData, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(callbackData) || !callbackData.StartsWith(MutePrefix, StringComparison.Ordinal))
            return false;

        var type = callbackData[MutePrefix.Length..];
        if (string.IsNullOrEmpty(type)) return false;

        var request = new HttpRequestMessage(HttpMethod.Post, MuteEndpoint);
        request.Headers.Add("X-Service-Token", _serviceToken);
        request.Content = JsonContent.Create(new
        {
            telegramUserId = telegramUserId.ToString(),
            type,
        });

        try
        {
            var resp = await _http.SendAsync(request, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Mute callback for Telegram user {Id} type {Type} failed: {StatusCode}",
                    telegramUserId, type, resp.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mute callback for Telegram user {Id} type {Type} threw exception",
                telegramUserId, type);
        }

        return true;
    }
}
```

- [ ] **Step 4: Run tests, verify pass**

Expected: 3/3 pass.

- [ ] **Step 5: Modify `TelegramBotWorker.cs`**

Add `NotificationCallbackHandler` field + ctor injection + DI registration in `Program.cs`. Extend `HandleUpdateAsync`:

```csharp
private async Task HandleUpdateAsync(ITelegramBotClient bot, Update update, CancellationToken ct)
{
    // Callback queries (mute buttons etc.)
    if (update.CallbackQuery is { } cb)
    {
        var fromId = cb.From.Id;
        var handled = _callbackHandler is not null
            ? await _callbackHandler.HandleMuteCallbackAsync(fromId, cb.Data ?? string.Empty, ct)
            : false;
        if (handled && cb.Id is { } id)
        {
            await bot.AnswerCallbackQuery(id, "Notifications muted", cancellationToken: ct);
        }
        return;
    }

    if (update.Message is not { } message) return;
    // ... existing /start /help handling unchanged ...
}
```

Add field + ctor injection of `NotificationCallbackHandler? _callbackHandler`. Make it nullable so the bot still runs without the service token configured (graceful degradation).

In `Program.cs` of `Lovecraft.TelegramBot`:

```csharp
using Microsoft.Extensions.DependencyInjection;
using Lovecraft.TelegramBot;

var builder = Host.CreateApplicationBuilder(args);

var serviceToken = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_TOKEN");
var backendUrl = Environment.GetEnvironmentVariable("BACKEND_INTERNAL_URL") ?? "http://backend:8080";

if (!string.IsNullOrEmpty(serviceToken))
{
    builder.Services.AddSingleton(sp =>
    {
        var client = new HttpClient { BaseAddress = new Uri(backendUrl) };
        return new NotificationCallbackHandler(client, serviceToken, sp.GetRequiredService<ILogger<NotificationCallbackHandler>>());
    });
}

builder.Services.AddHostedService<TelegramBotWorker>();

var host = builder.Build();
await host.RunAsync();
```

(Make `TelegramBotWorker` accept `NotificationCallbackHandler?` via DI — its constructor needs updating.)

- [ ] **Step 6: Build + test**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```
Expected: 389 + 3 = 392 tests pass.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.TelegramBot/' 'Lovecraft/Lovecraft.UnitTests/TelegramBot/'
git -C 'D:\src\lovecraft' commit -m "telegram-bot: handle mute:{type} callbacks via backend service-token endpoint"
```

---

## Task 8: docker-compose env vars

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docker-compose.yml`

The worker and bot need `TELEGRAM_BOT_TOKEN` and `INTERNAL_SERVICE_TOKEN` env vars. Both should come from `.env` via `env_file`.

- [ ] **Step 1: Verify .env already has both**

These should already exist in `D:\src\lovecraft\Lovecraft\.env` from earlier phases:
```
TELEGRAM_BOT_TOKEN=<existing>
```

And from Phase A spec:
```
INTERNAL_SERVICE_TOKEN=<random 32-byte hex>
```

If `INTERNAL_SERVICE_TOKEN` is missing, generate one and add it. The frontend repo doesn't touch the `.env` file directly — env vars get baked in via `env_file: ../lovecraft/Lovecraft/.env` already.

- [ ] **Step 2: Modify `docker-compose.yml`**

Add a comment on the `notifications-worker` service block explaining that `TELEGRAM_BOT_TOKEN` and `INTERNAL_SERVICE_TOKEN` are picked up via `env_file`. No new config block needed — env_file already references the shared `.env`.

The change is minimal — just a comment update:

```yaml
  # Notifications outbox worker (no inbound port; reads/writes Azure Tables; sends Telegram + email)
  notifications-worker:
    build:
      context: ../lovecraft/Lovecraft
      dockerfile: Dockerfile.notifications-worker
    container_name: aloevera-notifications-worker
    env_file:
      # Picks up AZURE_STORAGE_CONNECTION_STRING, TELEGRAM_BOT_TOKEN, INTERNAL_SERVICE_TOKEN
      - ../lovecraft/Lovecraft/.env
    depends_on:
      - backend
    networks:
      - aloevera-network
    restart: unless-stopped
```

Same comment update for `telegram-bot` (now also needs `INTERNAL_SERVICE_TOKEN` and `BACKEND_INTERNAL_URL`):

```yaml
  telegram-bot:
    build:
      context: ../lovecraft/Lovecraft
      dockerfile: Dockerfile.telegram-bot
    container_name: aloevera-telegram-bot
    env_file:
      # Picks up TELEGRAM_BOT_TOKEN, INTERNAL_SERVICE_TOKEN (for callback → backend),
      # BACKEND_INTERNAL_URL (defaults to http://backend:8080 inside the Docker network)
      - ../lovecraft/Lovecraft/.env
    depends_on:
      - backend
    networks:
      - aloevera-network
    restart: unless-stopped
```

Notice: `telegram-bot` should also `depends_on: - backend` (which it should already have from a previous phase — verify).

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add 'docker-compose.yml'
git -C 'D:\src\aloevera-harmony-meet' commit -m "compose: env-file comments for Telegram dispatcher + callback flow"
```

---

## Task 9: Docs

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\docs\NOTIFICATIONS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\TELEGRAM_AUTH.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`

- [ ] **Step 1: Append Phase D section to backend `NOTIFICATIONS.md`**

```markdown
## Phase D — shipped 2026-MM-DD

**Real Telegram dispatcher** lands in `Lovecraft.NotificationsWorker`:
- `TelegramDispatcher` reads user's `TelegramUserId` from the `users` Azure Table via a minimal `UserTelegramContactEntity` (worker now consumes 4 tables: notifications, notificationsoutbox, notificationpreferences, users)
- `TelegramMessageRenderer` produces per-type HTML body + inline keyboard
- `TelegramRateLimiter` enforces global concurrency cap (25) + per-chat 1-second cooldown
- Inline keyboard: `[Open in app]` (https://aloeve.club deep link) + `[Mute these]` (callback_data `mute:{typeCamelCase}`)
- Errors: 403 (bot blocked) → PermanentError dead-letter (no auto-disable of prefs in Phase D — see follow-up); other 4xx → PermanentError; network/timeout → RetryableError

**Mute callback flow** in `Lovecraft.TelegramBot`:
- `NotificationCallbackHandler` receives `mute:{type}` callbacks, POSTs to backend `/api/v1/internal/notifications/mute-type` with `X-Service-Token` header
- Backend `[RequireServiceToken]` action filter validates the token in constant-time; new `InternalController` resolves Telegram id → app user id via `usertelegramindex` table, calls `INotificationPreferenceService.SetChannelDisabledForTypeAsync` to flip the matrix cell

**Required env vars (Phase D additions):**
```
TELEGRAM_BOT_TOKEN=...                 # already used by Lovecraft.TelegramBot
INTERNAL_SERVICE_TOKEN=...             # shared secret backend ↔ bot ↔ (future) worker
BACKEND_INTERNAL_URL=http://backend:8080   # optional; defaults shown
```

**Known limitations:**
- English-only message text (no `Settings.Language` lookup yet)
- Actor names not resolved — notifications render with `Someone` or fall back to payload fields. Producer-side denormalization of actor display name into `NotificationModel.ActorName` is a follow-up.
- Bot-blocked (403) does not auto-clear `prefs.matrix.*.telegram = false` — would need a worker→backend back-channel call. Currently just dead-letters; user keeps receiving failed-dispatch attempts on subsequent notifications until they manually toggle off.
```

- [ ] **Step 2: Add callback section to `TELEGRAM_AUTH.md`**

```markdown
## Notification callbacks (Phase D)

The bot listens for `mute:{notificationType}` callback_data from inline keyboards sent by `Lovecraft.NotificationsWorker.TelegramDispatcher`. On callback:

1. Bot resolves the calling Telegram user id from `CallbackQuery.From.Id`
2. Bot POSTs `{ telegramUserId, type }` to backend `/api/v1/internal/notifications/mute-type` with `X-Service-Token: $INTERNAL_SERVICE_TOKEN`
3. Backend's `[RequireServiceToken]` attribute validates the header in constant time
4. `InternalController.MuteType` resolves the app user id via `usertelegramindex` and flips `prefs.matrix[type].telegram = false` via `INotificationPreferenceService.SetChannelDisabledForTypeAsync`
5. Bot answers the callback with `"Notifications muted"` toast

The mute action affects only the **Telegram channel** for the **specific notification type**. User can re-enable in `/settings`.

**Auth model:** Service-token auth gates a single internal endpoint. Bot must possess `INTERNAL_SERVICE_TOKEN` (shared via `env_file`). Bot's HTTP base URL defaults to `http://backend:8080` (Docker internal network).
```

- [ ] **Step 3: Add IMPLEMENTATION_SUMMARY.md line**

Append under "Done since the original plan":

```
- ✅ Notifications Phase D: real TelegramDispatcher (lookup chat id from users table, render HTML + inline keyboard, rate limiting); mute callback flow via service-token internal endpoint; Lovecraft.TelegramBot handles `mute:{type}` callbacks.
```

- [ ] **Step 4: Update `ISSUES.md`**

Under MCF.4's Resolution block, append:

```
Phase D (real Telegram dispatcher + mute callback) shipped 2026-MM-DD. Phases E (Web Push), F (email digest), G (event reminders + admin broadcast), H (rank-up) pending.
```

- [ ] **Step 5: Update `AGENTS.md`**

Add a bullet under "Notifications":

```
- Telegram channel: opt-in per notification type in Settings → Notifications. When enabled, the worker dispatches via Telegram.Bot SDK to the user's linked chat. "Mute these" inline button flips the type's Telegram toggle off via service-token internal endpoint.
```

- [ ] **Step 6: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md' 'Lovecraft/docs/TELEGRAM_AUTH.md' 'Lovecraft/docs/IMPLEMENTATION_SUMMARY.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase D (Telegram dispatcher + mute callback)"

git -C 'D:\src\aloevera-harmony-meet' add 'docs/ISSUES.md' 'AGENTS.md'
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase D (Telegram dispatch)"
```

---

## Task 10: Final verification

**Files:** none.

- [ ] **Step 1: Build full backend solution**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: 6 projects, 0 errors.

- [ ] **Step 2: Run full backend test suite**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --nologo
```
Expected: 371 (Phase C) + 4 (Internal) + 6 (Renderer) + 3 (RateLimiter) + 5 (Dispatcher) + 3 (CallbackHandler) = 392 tests pass.

- [ ] **Step 3: Verify git state**

```
git -C 'D:\src\lovecraft' log --oneline main..HEAD
git -C 'D:\src\aloevera-harmony-meet' log --oneline main..HEAD
```

Backend: ~7 commits (1 per task). Frontend: ~2 commits (compose + docs).

- [ ] **Step 4: Marker commits (optional)**

```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase D complete"
git -C 'D:\src\aloevera-harmony-meet' commit --allow-empty -m "notifications: phase D complete"
```

---

## After Phase D

Phase D follow-ups (track but don't block):
1. **Actor name denormalization** — add `ActorName` to `NotificationModel`, populate at producer enqueue time (read User.Name once and store in PayloadJson or a new column on `notificationsoutbox`). Renderer uses it instead of "Someone".
2. **Bot-blocked auto-disable** — extend backend with `POST /api/v1/internal/notifications/mute-all-telegram` (flips all 9 type matrix cells to `false`); worker calls it on 403 instead of just dead-lettering.
3. **Locale-aware rendering** — worker reads `Settings.Language` from prefs (or a new column); renderer dispatches to `ru` / `en` templates.
4. **Per-chat cooldown precision** — current `TelegramRateLimiter` holds the global semaphore while waiting for per-chat cooldown, which can stall other chats. Refactor to release the semaphore before per-chat delay or use a different ordering.

**Next phase: E (Web Push)** — VAPID keypair generation, `GET /api/v1/push/vapid-public-key`, service worker (`public/sw.js`), `WebPushDispatcher` fires from `Lovecraft.Backend` (NOT the worker) using `WebPush` NuGet, frontend "Enable on this device" button in Settings.
