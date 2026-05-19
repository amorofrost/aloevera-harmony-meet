# Notifications — Phase F (Email Digest) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase C's `StubEmailDispatcher` with a real `EmailDispatcher` in `Lovecraft.NotificationsWorker` that sends rendered HTML+plaintext emails via SendGrid. Make the existing daily-digest aggregation (Phase C `DigestProcessor`) produce real grouped emails. Add a signed unsubscribe link in every email; backend exposes `GET /api/v1/notifications/unsubscribe?token=...` (no-auth) that flips all email channel toggles to false.

**Architecture:** `EmailDispatcher` lives in `Lovecraft.NotificationsWorker` (worker dispatches email — different from Phase E's WebPush, which fires from the API). Worker has its own SendGrid HTTP client via the existing `SendGrid` NuGet (already used by backend for verification emails). `IEmailDigestRenderer` produces `(Subject, HtmlBody, PlainText)` for both single-notification and grouped-digest paths. `IEmailDispatcher` interface gains a `DispatchDigestAsync(DigestModel)` method; `DigestProcessor` calls it instead of the Phase C single-member trick. Unsubscribe token is a compact HMAC-SHA256 signed value `{userId}.{expirationTimestamp}.{base64hmac}` shared between worker (generates) and backend (verifies) via a small `Lovecraft.Common.UnsubscribeToken` helper.

**Tech Stack:** .NET 10 / `SendGrid` 9.x NuGet (already used by backend) / xUnit + Moq. No frontend changes — Phase B's `NotificationPreferences` already has the email block; Phase F just makes the toggles meaningful.

**Spec:** [`docs/superpowers/specs/2026-05-17-notifications-design.md`](../specs/2026-05-17-notifications-design.md)

**Predecessors:** [A](./2026-05-17-notifications-phase-a-foundations.md), [B](./2026-05-18-notifications-phase-b-in-app.md), [C](./2026-05-18-notifications-phase-c-worker.md), [D](./2026-05-18-notifications-phase-d-telegram.md), [E](./2026-05-18-notifications-phase-e-web-push.md).

**Scope decisions (Phase F):**
- **Worker calls SendGrid directly** (not via backend internal endpoint). Needs `SENDGRID_API_KEY`, `FROM_EMAIL`, `FRONTEND_BASE_URL` env vars passed to worker via existing `env_file` reference. Same SendGrid account as backend, no additional cost.
- **Worker reads user email + verified-flag from `users` table** — extend the existing `UserTelegramContactEntity` to a more general `UserContactEntity` carrying `TelegramUserId`, `Email`, `EmailVerified`. Same partial-entity pattern from Phase D.
- **Email-channel availability requires `EmailVerified == true`** — `NotificationPolicy.ResolveChannels` already checks this via `IUserService.GetNotificationContactStatusAsync`. Worker double-checks at dispatch time (race condition: user un-verifies between enqueue and send → silently skip).
- **`IEmailDispatcher` gets a second method**: `DispatchDigestAsync(DigestModel)`. Single emails still go through `DispatchAsync(NotificationModel)`. `DigestProcessor` only calls digest method for email channel.
- **Unsubscribe = "kill switch for all email types"**. One-click. Flips all 9 `prefs.matrix.*.email = false` (not just one type). Future enhancement could be per-type unsubscribe links; YAGNI for Phase F.
- **Telegram digests stay stubbed** (Phase C single-member trick remains). Hourly/Daily Telegram digests are rare UX and out of scope for Phase F — defer until user demand surfaces.
- **English-only templates.** Same trade-off as Phase D/E. Locale-aware rendering is a deferred follow-up.
- **No throttling/retry inside `EmailDispatcher`** — SendGrid handles its own rate limits, and the outbox retry/backoff path in `OutboxProcessor` (Phase C) handles failures. No per-recipient cooldown needed (digests are 1-per-user-per-hour-or-day).

**Repos:**
- Backend: `D:\src\lovecraft`
- Frontend: `D:\src\aloevera-harmony-meet` (docs + docker-compose comment only — no UI changes)

**Branches:**
- Backend: `feat/notifications-phase-f`
- Frontend: `feat/notifications-phase-f`

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Frontend: `npm run test:run` (from `D:\src\aloevera-harmony-meet`)

---

## File map

### Backend new files (`D:\src\lovecraft\Lovecraft\`)

| File | Responsibility |
|---|---|
| `Lovecraft.Common\UnsubscribeToken.cs` | Static helper: `Generate(userId, secret, expiresAt)` + `TryVerify(token, secret, out userId)`. HMAC-SHA256. |
| `Lovecraft.Common\DTOs\Notifications\EmailDigestSectionDto.cs` | One section per type within a digest: `{Type, Items[]}` |
| `Lovecraft.Common\DTOs\Notifications\EmailRenderResultDto.cs` | `{Subject, HtmlBody, PlainTextBody}` |
| `Lovecraft.Backend\Controllers\V1\NotificationsController.cs` (modify) | + `[AllowAnonymous] GET /notifications/unsubscribe?token=...` action |
| `Lovecraft.NotificationsWorker\Entities\UserContactEntity.cs` | Renamed from `UserTelegramContactEntity`; adds `Email`, `EmailVerified` columns. Telegram dispatcher updated to use new type. |
| `Lovecraft.NotificationsWorker\Dispatchers\IEmailSendClient.cs` + `SendGridEmailSendClient.cs` | Thin wrapper around `SendGrid.SendGridClient.SendEmailAsync` for testability (same pattern as `ITelegramSendClient`) |
| `Lovecraft.NotificationsWorker\Renderers\IEmailDigestRenderer.cs` + `EmailDigestRenderer.cs` | Renders single notification + grouped digest → `(Subject, HtmlBody, PlainText)` |
| `Lovecraft.NotificationsWorker\Dispatchers\EmailDispatcher.cs` | Real impl: lookup email, render, send, return Delivered/Retryable/Permanent |
| `Lovecraft.UnitTests\UnsubscribeTokenTests.cs` | 5 tests: round-trip, tamper detection, expiration, missing-parts handling, different secrets |
| `Lovecraft.UnitTests\NotificationsWorker\EmailDigestRendererTests.cs` | 5 tests: single notification render, digest with multiple types, plaintext fallback, unsubscribe link present, malformed payload |
| `Lovecraft.UnitTests\NotificationsWorker\EmailDispatcherTests.cs` | 6 tests: success, missing email → permanent error, unverified email → permanent error, SendGrid 4xx → permanent, SendGrid 5xx → retryable, digest path |
| `Lovecraft.UnitTests\UnsubscribeControllerTests.cs` | 5 tests: valid token flips all email cells, expired token → 400, tampered → 400, unknown user → 404, malformed → 400 |

### Backend modifications

| File | Change |
|---|---|
| `Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj` | + `SendGrid` PackageReference (match backend version) |
| `Lovecraft.NotificationsWorker\Dispatchers\IEmailDispatcher.cs` | + `Task<DispatchResult> DispatchDigestAsync(DigestModel digest, CancellationToken ct)` |
| `Lovecraft.NotificationsWorker\Dispatchers\StubEmailDispatcher.cs` | Implement the new `DispatchDigestAsync` (still a stub: log + return Delivered) — keeps fallback working when SENDGRID_API_KEY missing |
| `Lovecraft.NotificationsWorker\Services\DigestProcessor.cs` | When channel == Email, call `_email.DispatchDigestAsync(digestModel)` instead of single-member `DispatchAsync` |
| `Lovecraft.NotificationsWorker\Services\OutboxProcessor.cs` | (no change — still calls `_email.DispatchAsync(NotificationModel)` for Immediate-frequency emails; same as Phase C) |
| `Lovecraft.NotificationsWorker\Program.cs` | If `SENDGRID_API_KEY` set: register `IEmailSendClient`, `IEmailDigestRenderer`, swap `StubEmailDispatcher` → `EmailDispatcher`. Else: keep stub. |
| `Lovecraft.NotificationsWorker\TableNames.cs` | (no change — `Users` already added in Phase D) |
| `Lovecraft.NotificationsWorker\Dispatchers\TelegramDispatcher.cs` | Update to use `UserContactEntity` instead of `UserTelegramContactEntity` (same fields, just renamed) |
| `Lovecraft.UnitTests\NotificationsWorker\TelegramDispatcherTests.cs` | Update mock setup to use `UserContactEntity` |

### Frontend modifications

| File | Change |
|---|---|
| `docker-compose.yml` | Comment update on `notifications-worker.env_file` mentioning SENDGRID_API_KEY now in scope |

### Docs

| File | Change |
|---|---|
| `lovecraft\Lovecraft\docs\NOTIFICATIONS.md` | Append Phase F section (email dispatcher, digest renderer, unsubscribe flow) |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | One-line entry |
| `aloevera-harmony-meet\docs\ISSUES.md` | Update MCF.4: A/B/C/D/E/F shipped; G/H pending |
| `aloevera-harmony-meet\AGENTS.md` | Email channel bullet |

---

## Task ordering

Backend foundations first: 1 = unsubscribe token + endpoint (small surface, no worker dep); 2 = `UserContactEntity` rename + Telegram updates (worker change before adding email dispatcher); 3 = SendGrid package + renderer; 4 = real EmailDispatcher; 5 = DigestProcessor change; 6 = DI swap. Tasks 7 = docs/compose, 8 = final verification.

---

## Task 0: Create feature branches

**Files:** none.

- [ ] **Step 1: Backend branch**

```bash
git -C 'D:\src\lovecraft' checkout main
git -C 'D:\src\lovecraft' pull --ff-only
git -C 'D:\src\lovecraft' checkout -b feat/notifications-phase-f
```

- [ ] **Step 2: Frontend branch**

```bash
git -C 'D:\src\aloevera-harmony-meet' checkout main
git -C 'D:\src\aloevera-harmony-meet' pull --ff-only
git -C 'D:\src\aloevera-harmony-meet' checkout -b feat/notifications-phase-f
```

No commit.

---

## Task 1: Unsubscribe token + backend endpoint

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\UnsubscribeToken.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\UnsubscribeTokenTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\NotificationsController.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\NotificationsControllerTests.cs`

A small `UnsubscribeToken` static class generates and verifies a self-contained signed token. Format: `{userIdBase64Url}.{expiresAtUnixSeconds}.{hmacSha256Base64Url}`. The HMAC covers `{userIdBase64Url}.{expiresAtUnixSeconds}` and is computed with `JWT_SECRET_KEY` (already in env for the JWT service).

Both worker (will use this in Task 4 for email footers) and backend (will use this in this task for the unsubscribe endpoint) reference `Lovecraft.Common`.

- [ ] **Step 1: Write the failing tests**

`D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\UnsubscribeTokenTests.cs`:

```csharp
using Lovecraft.Common;
using Xunit;

namespace Lovecraft.UnitTests;

public class UnsubscribeTokenTests
{
    private const string TestSecret = "test-secret-32-chars-or-more-aaaa";

    [Fact]
    public void Generate_then_TryVerify_returns_original_userId()
    {
        var token = UnsubscribeToken.Generate("user-abc", TestSecret, DateTime.UtcNow.AddHours(1));

        Assert.True(UnsubscribeToken.TryVerify(token, TestSecret, out var userId));
        Assert.Equal("user-abc", userId);
    }

    [Fact]
    public void Tampered_token_fails_verification()
    {
        var token = UnsubscribeToken.Generate("user-abc", TestSecret, DateTime.UtcNow.AddHours(1));
        // Flip a char in the middle (in the signature portion)
        var tampered = token.Substring(0, token.Length - 5) + "xxxxx";

        Assert.False(UnsubscribeToken.TryVerify(tampered, TestSecret, out _));
    }

    [Fact]
    public void Expired_token_fails_verification()
    {
        var token = UnsubscribeToken.Generate("user-abc", TestSecret, DateTime.UtcNow.AddHours(-1));

        Assert.False(UnsubscribeToken.TryVerify(token, TestSecret, out _));
    }

    [Fact]
    public void Wrong_secret_fails_verification()
    {
        var token = UnsubscribeToken.Generate("user-abc", TestSecret, DateTime.UtcNow.AddHours(1));

        Assert.False(UnsubscribeToken.TryVerify(token, "different-secret-32-chars-or-more!", out _));
    }

    [Fact]
    public void Malformed_token_fails_verification()
    {
        Assert.False(UnsubscribeToken.TryVerify("not-a-token", TestSecret, out _));
        Assert.False(UnsubscribeToken.TryVerify("only.two", TestSecret, out _));
        Assert.False(UnsubscribeToken.TryVerify("", TestSecret, out _));
    }
}
```

- [ ] **Step 2: Run, verify fail**

Expected: compile error.

- [ ] **Step 3: Write `UnsubscribeToken.cs`**

```csharp
using System.Security.Cryptography;
using System.Text;

namespace Lovecraft.Common;

/// <summary>
/// Compact HMAC-SHA256 signed token used to authorize one-click email unsubscribe.
/// Format: {userIdBase64Url}.{expiresAtUnixSeconds}.{signatureBase64Url}
/// Signature = HMAC-SHA256(secret, "{userIdBase64Url}.{expiresAtUnixSeconds}")
/// </summary>
public static class UnsubscribeToken
{
    public static string Generate(string userId, string secret, DateTime expiresAtUtc)
    {
        var userIdEncoded = Base64UrlEncode(Encoding.UTF8.GetBytes(userId));
        var expiresUnix = new DateTimeOffset(expiresAtUtc, TimeSpan.Zero).ToUnixTimeSeconds().ToString();
        var payload = $"{userIdEncoded}.{expiresUnix}";
        var signature = ComputeHmac(payload, secret);
        return $"{payload}.{signature}";
    }

    public static bool TryVerify(string token, string secret, out string userId)
    {
        userId = string.Empty;
        if (string.IsNullOrEmpty(token)) return false;

        var parts = token.Split('.');
        if (parts.Length != 3) return false;

        var userIdEncoded = parts[0];
        var expiresUnix = parts[1];
        var providedSignature = parts[2];
        var payload = $"{userIdEncoded}.{expiresUnix}";
        var expectedSignature = ComputeHmac(payload, secret);

        // Constant-time compare
        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedSignature), Encoding.UTF8.GetBytes(providedSignature)))
            return false;

        if (!long.TryParse(expiresUnix, out var expires)) return false;
        if (DateTimeOffset.FromUnixTimeSeconds(expires).UtcDateTime < DateTime.UtcNow) return false;

        try
        {
            userId = Encoding.UTF8.GetString(Base64UrlDecode(userIdEncoded));
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string ComputeHmac(string payload, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Base64UrlEncode(hash);
    }

    private static string Base64UrlEncode(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
```

- [ ] **Step 4: Run, verify pass**

Expected: 5 tests pass.

- [ ] **Step 5: Add unsubscribe endpoint failing test**

Append to `NotificationsControllerTests.cs`:

```csharp
[Fact]
public async Task GET_unsubscribe_with_valid_token_flips_all_email_cells()
{
    Environment.SetEnvironmentVariable("JWT_SECRET_KEY", "test-jwt-secret-32-chars-or-more!");
    var userId = "test-user-1";

    // Seed prefs with at least one email cell enabled
    var prefSvc = (INotificationPreferenceService)_factory.Services.GetRequiredService(typeof(INotificationPreferenceService));
    var prefs = await prefSvc.GetPreferencesAsync(userId);
    foreach (var (_, row) in prefs.Matrix) row["email"] = true;
    await prefSvc.UpdatePreferencesAsync(userId, prefs);

    var token = Lovecraft.Common.UnsubscribeToken.Generate(userId,
        "test-jwt-secret-32-chars-or-more!", DateTime.UtcNow.AddHours(1));

    var client = _factory.CreateClient();
    var resp = await client.GetAsync($"/api/v1/notifications/unsubscribe?token={Uri.EscapeDataString(token)}");
    resp.EnsureSuccessStatusCode();

    var after = await prefSvc.GetPreferencesAsync(userId);
    foreach (var (_, row) in after.Matrix)
        Assert.False(row["email"], $"Email cell should be false after unsubscribe; type unknown but matrix iterated");
}

[Fact]
public async Task GET_unsubscribe_with_invalid_token_returns_400()
{
    Environment.SetEnvironmentVariable("JWT_SECRET_KEY", "test-jwt-secret-32-chars-or-more!");
    var client = _factory.CreateClient();
    var resp = await client.GetAsync("/api/v1/notifications/unsubscribe?token=garbage");
    Assert.Equal(System.Net.HttpStatusCode.BadRequest, resp.StatusCode);
}

[Fact]
public async Task GET_unsubscribe_with_expired_token_returns_400()
{
    Environment.SetEnvironmentVariable("JWT_SECRET_KEY", "test-jwt-secret-32-chars-or-more!");
    var token = Lovecraft.Common.UnsubscribeToken.Generate("user-x",
        "test-jwt-secret-32-chars-or-more!", DateTime.UtcNow.AddHours(-1));

    var client = _factory.CreateClient();
    var resp = await client.GetAsync($"/api/v1/notifications/unsubscribe?token={Uri.EscapeDataString(token)}");
    Assert.Equal(System.Net.HttpStatusCode.BadRequest, resp.StatusCode);
}
```

- [ ] **Step 6: Run, verify fail (endpoint doesn't exist yet)**

Expected: 404.

- [ ] **Step 7: Add the endpoint to `NotificationsController.cs`**

```csharp
[AllowAnonymous]
[HttpGet("notifications/unsubscribe")]
public async Task<IActionResult> Unsubscribe([FromQuery] string token)
{
    var secret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
    if (string.IsNullOrEmpty(secret))
        return StatusCode(503, "Server not configured");

    if (!UnsubscribeToken.TryVerify(token, secret, out var userId))
        return BadRequest("Invalid or expired link");

    // Flip every email cell to false
    var prefs = await _preferenceService.GetPreferencesAsync(userId);
    foreach (var row in prefs.Matrix.Values)
        row["email"] = false;
    await _preferenceService.UpdatePreferencesAsync(userId, prefs);

    return Content(
        "<!DOCTYPE html><html><head><title>Unsubscribed</title></head><body style=\"font-family: sans-serif; text-align: center; padding: 40px;\">" +
        "<h1>You're unsubscribed</h1>" +
        "<p>You won't receive notification emails anymore. You can re-enable them anytime in your account settings.</p>" +
        $"<p><a href=\"{Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "https://aloeve.club"}/settings\">Open Settings</a></p>" +
        "</body></html>",
        "text/html");
}
```

Add `using Lovecraft.Common;` at the top if not present.

- [ ] **Step 8: Run, verify pass**

Expected: 3 unsubscribe tests pass; full suite no regressions.

- [ ] **Step 9: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.Common/UnsubscribeToken.cs' 'Lovecraft/Lovecraft.UnitTests/UnsubscribeTokenTests.cs' 'Lovecraft/Lovecraft.Backend/Controllers/V1/NotificationsController.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsControllerTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications: UnsubscribeToken helper + signed-link unsubscribe endpoint"
```

---

## Task 2: Rename `UserTelegramContactEntity` → `UserContactEntity` + add Email fields

**Files:**
- Rename: `Lovecraft.NotificationsWorker\Entities\UserTelegramContactEntity.cs` → `UserContactEntity.cs`
- Modify: `Lovecraft.NotificationsWorker\Dispatchers\TelegramDispatcher.cs`
- Modify: `Lovecraft.UnitTests\NotificationsWorker\TelegramDispatcherTests.cs`

Add `Email` and `EmailVerified` to the entity. Azure deserializes any matching columns; the entity becomes the unified contact lookup for Phase F dispatchers.

- [ ] **Step 1: Rename file + class**

Delete `UserTelegramContactEntity.cs`. Create `Entities/UserContactEntity.cs`:

```csharp
using Azure;
using Azure.Data.Tables;

namespace Lovecraft.NotificationsWorker.Entities;

/// <summary>
/// Partial mirror of Lovecraft.Backend.Storage.Entities.UserEntity — worker-side
/// dispatchers only need contact-channel fields.
/// </summary>
public class UserContactEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string TelegramUserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }

    public static string GetPartitionKey(string userId)
    {
        if (string.IsNullOrEmpty(userId)) return "user-?";
        return $"user-{char.ToLowerInvariant(userId[0])}";
    }
}
```

- [ ] **Step 2: Update `TelegramDispatcher.cs` to use the new type name**

Change every `UserTelegramContactEntity` → `UserContactEntity`. The `TelegramUserId` access stays the same.

- [ ] **Step 3: Update `TelegramDispatcherTests.cs`**

Same rename in the test fixture setups.

- [ ] **Step 4: Build + test**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Target: no regressions (Telegram dispatcher tests still pass).

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Entities/' 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/TelegramDispatcher.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/TelegramDispatcherTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: rename UserTelegramContactEntity → UserContactEntity + Email columns"
```

---

## Task 3: SendGrid package + EmailDigestRenderer

**Files:**
- Modify: `Lovecraft.NotificationsWorker\Lovecraft.NotificationsWorker.csproj`
- Create: `Lovecraft.Common\DTOs\Notifications\EmailDigestSectionDto.cs`
- Create: `Lovecraft.Common\DTOs\Notifications\EmailRenderResultDto.cs`
- Create: `Lovecraft.NotificationsWorker\Renderers\IEmailDigestRenderer.cs`
- Create: `Lovecraft.NotificationsWorker\Renderers\EmailDigestRenderer.cs`
- Create: `Lovecraft.UnitTests\NotificationsWorker\EmailDigestRendererTests.cs`

- [ ] **Step 1: Add SendGrid package**

In `Lovecraft.NotificationsWorker.csproj`, inside the `<ItemGroup>` with other package refs:

```xml
<PackageReference Include="SendGrid" Version="9.29.3" />
```

(Match the version already used in `Lovecraft.Backend.csproj`. Check with `Get-Content 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj' | Select-String SendGrid` — use that version.)

- [ ] **Step 2: Write `EmailRenderResultDto.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Notifications;

public class EmailRenderResultDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string PlainTextBody { get; set; } = string.Empty;
}
```

- [ ] **Step 3: Write `EmailDigestSectionDto.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Notifications;

/// <summary>
/// One section of a digest email — all notifications of a single type.
/// </summary>
public class EmailDigestSectionDto
{
    /// <summary>Notification type (PascalCase enum name).</summary>
    public string Type { get; set; } = string.Empty;
    /// <summary>Human-readable section header, e.g. "New matches (1)".</summary>
    public string Header { get; set; } = string.Empty;
    /// <summary>Per-notification lines.</summary>
    public List<EmailDigestItemDto> Items { get; set; } = new();
}

public class EmailDigestItemDto
{
    public string Text { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}
```

- [ ] **Step 4: Write the failing tests**

`Lovecraft.UnitTests/NotificationsWorker/EmailDigestRendererTests.cs`:

```csharp
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class EmailDigestRendererTests
{
    private readonly EmailDigestRenderer _renderer = new(
        unsubscribeBaseUrl: "https://aloeve.club",
        appBaseUrl: "https://aloeve.club",
        NullLogger<EmailDigestRenderer>.Instance);

    private static NotificationModel MakeNotification(string type, string payloadJson, string? actorId = null) =>
        new("n1", "u1", type, actorId, payloadJson, DateTime.UtcNow);

    [Fact]
    public void RenderSingle_MessageReceived_includes_preview_in_body()
    {
        var notif = MakeNotification("MessageReceived",
            "{\"chatId\":\"c1\",\"messageId\":\"m1\",\"preview\":\"hello there\"}");

        var result = _renderer.RenderSingle(notif, "unsub-token-abc");

        Assert.Contains("hello there", result.HtmlBody);
        Assert.Contains("hello there", result.PlainTextBody);
        Assert.NotEmpty(result.Subject);
    }

    [Fact]
    public void RenderDigest_groups_by_type_with_section_headers()
    {
        var digest = new DigestModel("u1", new List<NotificationModel>
        {
            MakeNotification("LikeReceived", "{\"likeId\":\"l1\",\"anonymous\":false}"),
            MakeNotification("LikeReceived", "{\"likeId\":\"l2\",\"anonymous\":true}"),
            MakeNotification("MatchCreated", "{\"matchId\":\"m1\"}", actorId: "actor-1"),
        });

        var result = _renderer.RenderDigest(digest, "unsub-token-abc");

        Assert.Contains("New likes", result.HtmlBody);
        Assert.Contains("New matches", result.HtmlBody);
        Assert.Contains("New likes", result.PlainTextBody);
    }

    [Fact]
    public void RenderDigest_subject_includes_total_count()
    {
        var digest = new DigestModel("u1", new List<NotificationModel>
        {
            MakeNotification("LikeReceived", "{\"likeId\":\"l1\"}"),
            MakeNotification("LikeReceived", "{\"likeId\":\"l2\"}"),
            MakeNotification("MessageReceived", "{\"chatId\":\"c1\",\"preview\":\"hi\"}"),
        });

        var result = _renderer.RenderDigest(digest, "unsub-token-abc");

        Assert.Contains("3", result.Subject);
    }

    [Fact]
    public void RenderSingle_includes_unsubscribe_link_in_footer()
    {
        var notif = MakeNotification("LikeReceived", "{\"likeId\":\"l1\"}");

        var result = _renderer.RenderSingle(notif, "unsub-token-xyz");

        Assert.Contains("unsubscribe", result.HtmlBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("token=unsub-token-xyz", result.HtmlBody);
        Assert.Contains("token=unsub-token-xyz", result.PlainTextBody);
    }

    [Fact]
    public void RenderSingle_with_malformed_payload_does_not_throw()
    {
        var notif = MakeNotification("MessageReceived", "not-valid-json");

        var result = _renderer.RenderSingle(notif, "unsub-token-abc");

        Assert.NotEmpty(result.Subject);
        Assert.NotEmpty(result.HtmlBody);
        Assert.NotEmpty(result.PlainTextBody);
    }
}
```

- [ ] **Step 5: Run, verify fail**

Expected: compile error.

- [ ] **Step 6: Write `IEmailDigestRenderer.cs`**

```csharp
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.NotificationsWorker.Models;

namespace Lovecraft.NotificationsWorker.Renderers;

public interface IEmailDigestRenderer
{
    EmailRenderResultDto RenderSingle(NotificationModel notification, string unsubscribeToken);
    EmailRenderResultDto RenderDigest(DigestModel digest, string unsubscribeToken);
}
```

- [ ] **Step 7: Write `EmailDigestRenderer.cs`**

```csharp
using System.Text;
using System.Text.Json;
using System.Web;
using Lovecraft.Common.DTOs.Notifications;
using Lovecraft.NotificationsWorker.Models;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Renderers;

public class EmailDigestRenderer : IEmailDigestRenderer
{
    private readonly string _unsubscribeBaseUrl;
    private readonly string _appBaseUrl;
    private readonly ILogger<EmailDigestRenderer> _logger;

    public EmailDigestRenderer(string unsubscribeBaseUrl, string appBaseUrl, ILogger<EmailDigestRenderer> logger)
    {
        _unsubscribeBaseUrl = unsubscribeBaseUrl.TrimEnd('/');
        _appBaseUrl = appBaseUrl.TrimEnd('/');
        _logger = logger;
    }

    public EmailRenderResultDto RenderSingle(NotificationModel notification, string unsubscribeToken)
    {
        var (subject, sections) = BuildSections(new List<NotificationModel> { notification });
        return Build(subject, sections, unsubscribeToken);
    }

    public EmailRenderResultDto RenderDigest(DigestModel digest, string unsubscribeToken)
    {
        var (subject, sections) = BuildSections(digest.Members);
        return Build(subject, sections, unsubscribeToken);
    }

    private (string Subject, List<EmailDigestSectionDto> Sections) BuildSections(IReadOnlyList<NotificationModel> notifications)
    {
        // Group by type
        var byType = notifications
            .GroupBy(n => n.Type)
            .ToDictionary(g => g.Key, g => g.ToList());

        var sections = new List<EmailDigestSectionDto>();
        foreach (var (type, items) in byType)
        {
            var section = new EmailDigestSectionDto
            {
                Type = type,
                Header = SectionHeader(type, items.Count),
                Items = items.Select(BuildItem).ToList(),
            };
            sections.Add(section);
        }

        var subject = BuildSubject(notifications.Count, byType);
        return (subject, sections);
    }

    private static string SectionHeader(string type, int count) => type switch
    {
        "LikeReceived"        => $"New likes ({count})",
        "MatchCreated"        => $"New matches ({count})",
        "MessageReceived"     => $"New messages ({count})",
        "ForumReplyToThread"  => $"New replies ({count})",
        "CommunityBroadcast"  => $"Community updates ({count})",
        "EventPublished"      => $"New events ({count})",
        "EventReminder"       => $"Event reminders ({count})",
        "EventInviteReceived" => $"Event invites ({count})",
        "RankUp"              => $"Rank up ({count})",
        _ => $"{type} ({count})",
    };

    private EmailDigestItemDto BuildItem(NotificationModel n)
    {
        Dictionary<string, object?> payload;
        try { payload = JsonSerializer.Deserialize<Dictionary<string, object?>>(n.PayloadJson) ?? new(); }
        catch { payload = new(); _logger.LogWarning("Malformed payload in notification {Id}", n.NotificationId); }

        var text = n.Type switch
        {
            "LikeReceived"        => IsAnonymous(payload) ? "Someone liked your profile" : "Someone liked your profile",
            "MatchCreated"        => "You have a new match!",
            "MessageReceived"     => $"{GetString(payload, "preview")}",
            "ForumReplyToThread"  => "Someone replied in a thread",
            "CommunityBroadcast"  => $"{GetString(payload, "title")} — {GetString(payload, "body")}",
            "EventPublished"      => GetString(payload, "eventTitle", "New event"),
            "EventReminder"       => GetString(payload, "eventTitle", "Event tomorrow"),
            "EventInviteReceived" => GetString(payload, "eventTitle", "You're invited"),
            "RankUp"              => $"You're now {GetString(payload, "newRank")}",
            _ => $"Notification {n.NotificationId}",
        };

        var url = _appBaseUrl + (n.Type switch
        {
            "LikeReceived" or "MatchCreated" => n.ActorId is not null ? $"/friends?userId={Uri.EscapeDataString(n.ActorId)}" : "/friends",
            "MessageReceived"     => $"/talks?chat={Uri.EscapeDataString(GetString(payload, "chatId"))}",
            "ForumReplyToThread"  => $"/talks?topic={Uri.EscapeDataString(GetString(payload, "topicId"))}",
            "EventPublished" or "EventReminder" or "EventInviteReceived" =>
                $"/aloevera/events/{Uri.EscapeDataString(GetString(payload, "eventId"))}",
            "CommunityBroadcast"  => ResolveBroadcastPath(GetString(payload, "link")),
            "RankUp"              => "/settings",
            _ => "/notifications",
        });

        return new EmailDigestItemDto { Text = text, Url = url };
    }

    private static string ResolveBroadcastPath(string link)
    {
        if (string.IsNullOrEmpty(link)) return "/aloevera";
        if (Uri.TryCreate(link, UriKind.Absolute, out var abs))
        {
            if (abs.Scheme == Uri.UriSchemeHttps
                && (abs.Host.Equals("aloeve.club", StringComparison.OrdinalIgnoreCase)
                    || abs.Host.Equals("www.aloeve.club", StringComparison.OrdinalIgnoreCase)))
                return abs.PathAndQuery;
            return "/aloevera";
        }
        return link.StartsWith('/') ? link : "/" + link;
    }

    private static string BuildSubject(int total, Dictionary<string, List<NotificationModel>> byType)
    {
        if (total == 1) return "You have a new notification on AloeVera";
        var summary = string.Join(", ", byType.Select(kv => $"{kv.Value.Count} {ShortName(kv.Key)}"));
        return $"{total} updates: {summary}";
    }

    private static string ShortName(string type) => type switch
    {
        "LikeReceived" => "likes",
        "MatchCreated" => "matches",
        "MessageReceived" => "messages",
        "ForumReplyToThread" => "replies",
        "CommunityBroadcast" => "community updates",
        "EventPublished" => "new events",
        "EventReminder" => "event reminders",
        "EventInviteReceived" => "event invites",
        "RankUp" => "rank ups",
        _ => "notifications",
    };

    private EmailRenderResultDto Build(string subject, List<EmailDigestSectionDto> sections, string unsubscribeToken)
    {
        var unsubscribeUrl = $"{_unsubscribeBaseUrl}/api/v1/notifications/unsubscribe?token={Uri.EscapeDataString(unsubscribeToken)}";
        var settingsUrl = $"{_appBaseUrl}/settings";

        var html = new StringBuilder();
        html.AppendLine("<!DOCTYPE html><html><body style=\"font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">");
        html.AppendLine("<h2 style=\"color: #c84f00; margin-bottom: 16px;\">AloeVera</h2>");
        foreach (var section in sections)
        {
            html.AppendLine($"<h3 style=\"margin-top: 24px; margin-bottom: 8px;\">{HttpUtility.HtmlEncode(section.Header)}</h3>");
            html.AppendLine("<ul style=\"padding-left: 20px;\">");
            foreach (var item in section.Items)
                html.AppendLine($"<li style=\"margin-bottom: 8px;\">{HttpUtility.HtmlEncode(item.Text)} <a href=\"{HttpUtility.HtmlEncode(item.Url)}\">Open</a></li>");
            html.AppendLine("</ul>");
        }
        html.AppendLine("<hr style=\"border: none; border-top: 1px solid #ddd; margin-top: 32px;\">");
        html.AppendLine($"<p style=\"color: #888; font-size: 12px;\">");
        html.AppendLine($"<a href=\"{HttpUtility.HtmlEncode(settingsUrl)}\" style=\"color: #888;\">Manage notifications</a> &middot; ");
        html.AppendLine($"<a href=\"{HttpUtility.HtmlEncode(unsubscribeUrl)}\" style=\"color: #888;\">Unsubscribe from email digests</a>");
        html.AppendLine("</p></body></html>");

        var plain = new StringBuilder();
        plain.AppendLine("AloeVera Harmony Meet");
        plain.AppendLine();
        foreach (var section in sections)
        {
            plain.AppendLine(section.Header);
            foreach (var item in section.Items)
                plain.AppendLine($"  - {item.Text} ({item.Url})");
            plain.AppendLine();
        }
        plain.AppendLine("---");
        plain.AppendLine($"Manage notifications: {settingsUrl}");
        plain.AppendLine($"Unsubscribe: {unsubscribeUrl}");

        return new EmailRenderResultDto
        {
            Subject = subject,
            HtmlBody = html.ToString(),
            PlainTextBody = plain.ToString(),
        };
    }

    private static bool IsAnonymous(Dictionary<string, object?> payload)
    {
        if (!payload.TryGetValue("anonymous", out var v) || v is null) return false;
        var s = v.ToString();
        return s == "True" || s == "true";
    }

    private static string GetString(Dictionary<string, object?> payload, string key, string fallback = "")
    {
        if (!payload.TryGetValue(key, out var v) || v is null) return fallback;
        return v.ToString() ?? fallback;
    }
}
```

- [ ] **Step 8: Run, verify pass**

Expected: 5 new tests pass; full suite no regressions.

- [ ] **Step 9: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Lovecraft.NotificationsWorker.csproj' 'Lovecraft/Lovecraft.Common/DTOs/Notifications/EmailDigestSectionDto.cs' 'Lovecraft/Lovecraft.Common/DTOs/Notifications/EmailRenderResultDto.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Renderers/IEmailDigestRenderer.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Renderers/EmailDigestRenderer.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/EmailDigestRendererTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: SendGrid pkg + EmailDigestRenderer + tests"
```

---

## Task 4: Real `EmailDispatcher` + IEmailSendClient

**Files:**
- Create: `Lovecraft.NotificationsWorker\Dispatchers\IEmailSendClient.cs`
- Create: `Lovecraft.NotificationsWorker\Dispatchers\SendGridEmailSendClient.cs`
- Modify: `Lovecraft.NotificationsWorker\Dispatchers\IEmailDispatcher.cs` (add `DispatchDigestAsync` method)
- Modify: `Lovecraft.NotificationsWorker\Dispatchers\StubEmailDispatcher.cs` (implement the new method)
- Create: `Lovecraft.NotificationsWorker\Dispatchers\EmailDispatcher.cs`
- Create: `Lovecraft.UnitTests\NotificationsWorker\EmailDispatcherTests.cs`

`IEmailSendClient` wraps the SendGrid SDK for testability — same pattern as Phase D `ITelegramSendClient` and Phase E (using package's own `IWebPushClient`).

`EmailDispatcher` workflow:
1. Look up user's `Email` + `EmailVerified` via `UserContactEntity` from users table.
2. If user not found, email empty, or `EmailVerified == false` → `PermanentError`.
3. Generate unsubscribe token via `UnsubscribeToken.Generate(userId, jwtSecret, expiresAtUtc=now+30d)`.
4. Render via `IEmailDigestRenderer.RenderSingle` or `RenderDigest`.
5. Send via `IEmailSendClient.SendAsync(to, subject, html, plainText)`.
6. Map SendGrid response: 2xx → Delivered; 4xx → PermanentError; 5xx → RetryableError; exception → RetryableError.

- [ ] **Step 1: Extend `IEmailDispatcher.cs`**

```csharp
using Lovecraft.NotificationsWorker.Models;

namespace Lovecraft.NotificationsWorker.Dispatchers;

public interface IEmailDispatcher
{
    Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct);
    Task<DispatchResult> DispatchDigestAsync(DigestModel digest, CancellationToken ct);
}
```

- [ ] **Step 2: Update `StubEmailDispatcher.cs`**

Add the new method. Log the digest member count, return `Delivered`.

```csharp
public Task<DispatchResult> DispatchDigestAsync(DigestModel digest, CancellationToken ct)
{
    _logger.LogInformation(
        "[STUB Email] would dispatch digest with {Count} notifications to user {UserId}",
        digest.Members.Count, digest.UserId);
    return Task.FromResult(DispatchResult.Delivered);
}
```

- [ ] **Step 3: Write `IEmailSendClient.cs`**

```csharp
namespace Lovecraft.NotificationsWorker.Dispatchers;

public interface IEmailSendClient
{
    /// <summary>
    /// Sends an email. Returns SendGrid HTTP status code.
    /// Implementations: SendGridEmailSendClient (production), or test stub.
    /// </summary>
    Task<int> SendAsync(string toEmail, string subject, string htmlBody, string plainTextBody, CancellationToken ct);
}
```

- [ ] **Step 4: Write `SendGridEmailSendClient.cs`**

```csharp
using SendGrid;
using SendGrid.Helpers.Mail;

namespace Lovecraft.NotificationsWorker.Dispatchers;

public class SendGridEmailSendClient : IEmailSendClient
{
    private readonly ISendGridClient _client;
    private readonly EmailAddress _from;

    public SendGridEmailSendClient(string apiKey, string fromEmail, string fromName = "AloeVera")
    {
        _client = new SendGridClient(apiKey);
        _from = new EmailAddress(fromEmail, fromName);
    }

    public async Task<int> SendAsync(string toEmail, string subject, string htmlBody, string plainTextBody, CancellationToken ct)
    {
        var msg = MailHelper.CreateSingleEmail(
            _from,
            new EmailAddress(toEmail),
            subject,
            plainTextBody,
            htmlBody);
        var response = await _client.SendEmailAsync(msg, ct);
        return (int)response.StatusCode;
    }
}
```

- [ ] **Step 5: Write failing `EmailDispatcherTests.cs`**

```csharp
using System.Net;
using Azure;
using Azure.Data.Tables;
using Lovecraft.NotificationsWorker.Dispatchers;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Lovecraft.UnitTests.NotificationsWorker;

public class EmailDispatcherTests
{
    private static NotificationModel Sample() =>
        new("n1", "u1", "LikeReceived", "actor", "{\"likeId\":\"l1\"}", DateTime.UtcNow);

    private static (EmailDispatcher dispatcher, Mock<TableClient> users, Mock<IEmailSendClient> client) Build(
        UserContactEntity? contact, int sendStatus = 202)
    {
        var users = new Mock<TableClient>();
        if (contact is not null)
            users.Setup(t => t.GetEntityAsync<UserContactEntity>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response.FromValue(contact, new Mock<Response>().Object));
        else
            users.Setup(t => t.GetEntityAsync<UserContactEntity>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(404, "not found"));

        var client = new Mock<IEmailSendClient>();
        client.Setup(c => c.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(sendStatus);

        var renderer = new EmailDigestRenderer("https://aloeve.club", "https://aloeve.club", NullLogger<EmailDigestRenderer>.Instance);
        var dispatcher = new EmailDispatcher(
            client.Object, users.Object, renderer,
            jwtSecret: "test-secret-32-chars-or-more-aaaa",
            NullLogger<EmailDispatcher>.Instance);
        return (dispatcher, users, client);
    }

    [Fact]
    public async Task Successful_send_returns_Delivered()
    {
        var (d, _, _) = Build(new UserContactEntity { Email = "u@example.com", EmailVerified = true }, sendStatus: 202);
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.Delivered, r);
    }

    [Fact]
    public async Task Missing_user_returns_PermanentError()
    {
        var (d, _, _) = Build(contact: null);
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.PermanentError, r);
    }

    [Fact]
    public async Task Empty_email_returns_PermanentError()
    {
        var (d, _, _) = Build(new UserContactEntity { Email = "", EmailVerified = true });
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.PermanentError, r);
    }

    [Fact]
    public async Task Unverified_email_returns_PermanentError()
    {
        var (d, _, _) = Build(new UserContactEntity { Email = "u@example.com", EmailVerified = false });
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.PermanentError, r);
    }

    [Fact]
    public async Task SendGrid_5xx_returns_RetryableError()
    {
        var (d, _, _) = Build(new UserContactEntity { Email = "u@example.com", EmailVerified = true }, sendStatus: 503);
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.RetryableError, r);
    }

    [Fact]
    public async Task SendGrid_4xx_returns_PermanentError()
    {
        var (d, _, _) = Build(new UserContactEntity { Email = "u@example.com", EmailVerified = true }, sendStatus: 400);
        var r = await d.DispatchAsync(Sample(), CancellationToken.None);
        Assert.Equal(DispatchResult.PermanentError, r);
    }

    [Fact]
    public async Task Digest_dispatch_uses_RenderDigest()
    {
        var (d, _, client) = Build(new UserContactEntity { Email = "u@example.com", EmailVerified = true }, sendStatus: 202);

        var digest = new DigestModel("u1", new List<NotificationModel> { Sample(), Sample() });
        var r = await d.DispatchDigestAsync(digest, CancellationToken.None);

        Assert.Equal(DispatchResult.Delivered, r);
        client.Verify(c => c.SendAsync(
            "u@example.com",
            It.Is<string>(s => s.Contains("2")),    // subject mentions count
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 6: Run, verify fail**

Expected: compile error.

- [ ] **Step 7: Write `EmailDispatcher.cs`**

```csharp
using Azure;
using Azure.Data.Tables;
using Lovecraft.Common;
using Lovecraft.NotificationsWorker.Entities;
using Lovecraft.NotificationsWorker.Models;
using Lovecraft.NotificationsWorker.Renderers;
using Microsoft.Extensions.Logging;

namespace Lovecraft.NotificationsWorker.Dispatchers;

public class EmailDispatcher : IEmailDispatcher
{
    private static readonly TimeSpan UnsubscribeTokenLifetime = TimeSpan.FromDays(30);

    private readonly IEmailSendClient _client;
    private readonly TableClient _users;
    private readonly IEmailDigestRenderer _renderer;
    private readonly string _jwtSecret;
    private readonly ILogger<EmailDispatcher> _logger;

    public EmailDispatcher(
        IEmailSendClient client,
        TableClient users,
        IEmailDigestRenderer renderer,
        string jwtSecret,
        ILogger<EmailDispatcher> logger)
    {
        _client = client;
        _users = users;
        _renderer = renderer;
        _jwtSecret = jwtSecret;
        _logger = logger;
    }

    public async Task<DispatchResult> DispatchAsync(NotificationModel notification, CancellationToken ct)
    {
        var contact = await LookupContactAsync(notification.UserId, ct);
        if (contact is null) return DispatchResult.PermanentError;

        var unsubscribeToken = UnsubscribeToken.Generate(notification.UserId, _jwtSecret, DateTime.UtcNow + UnsubscribeTokenLifetime);
        var rendered = _renderer.RenderSingle(notification, unsubscribeToken);

        return await SendAsync(contact.Email, rendered.Subject, rendered.HtmlBody, rendered.PlainTextBody, notification.NotificationId, ct);
    }

    public async Task<DispatchResult> DispatchDigestAsync(DigestModel digest, CancellationToken ct)
    {
        var contact = await LookupContactAsync(digest.UserId, ct);
        if (contact is null) return DispatchResult.PermanentError;

        var unsubscribeToken = UnsubscribeToken.Generate(digest.UserId, _jwtSecret, DateTime.UtcNow + UnsubscribeTokenLifetime);
        var rendered = _renderer.RenderDigest(digest, unsubscribeToken);

        return await SendAsync(contact.Email, rendered.Subject, rendered.HtmlBody, rendered.PlainTextBody,
            digestKey: $"digest-user-{digest.UserId}", ct);
    }

    private async Task<UserContactEntity?> LookupContactAsync(string userId, CancellationToken ct)
    {
        try
        {
            var pk = UserContactEntity.GetPartitionKey(userId);
            var resp = await _users.GetEntityAsync<UserContactEntity>(pk, userId, cancellationToken: ct);
            var contact = resp.Value;
            if (string.IsNullOrEmpty(contact.Email))
            {
                _logger.LogInformation("User {UserId} has no email on file; skipping email dispatch", userId);
                return null;
            }
            if (!contact.EmailVerified)
            {
                _logger.LogInformation("User {UserId} email not verified; skipping email dispatch", userId);
                return null;
            }
            return contact;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            _logger.LogWarning("User {UserId} not found in users table; skipping email dispatch", userId);
            return null;
        }
    }

    private async Task<DispatchResult> SendAsync(string toEmail, string subject, string html, string plain, string digestKey, CancellationToken ct)
    {
        try
        {
            var status = await _client.SendAsync(toEmail, subject, html, plain, ct);
            if (status >= 200 && status < 300) return DispatchResult.Delivered;
            if (status >= 500) return DispatchResult.RetryableError;
            return DispatchResult.PermanentError;
        }
        catch (TaskCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Email send failed for {DigestKey} → {Email}; retryable", digestKey, toEmail);
            return DispatchResult.RetryableError;
        }
    }
}
```

- [ ] **Step 8: Run, verify pass**

Expected: 7 new tests pass; full suite no regressions.

- [ ] **Step 9: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/IEmailSendClient.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/SendGridEmailSendClient.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/IEmailDispatcher.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/StubEmailDispatcher.cs' 'Lovecraft/Lovecraft.NotificationsWorker/Dispatchers/EmailDispatcher.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/EmailDispatcherTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: real EmailDispatcher (SendGrid send + render + token) + tests"
```

---

## Task 5: DigestProcessor uses real digest path for email

**Files:**
- Modify: `Lovecraft.NotificationsWorker\Services\DigestProcessor.cs`
- Modify: `Lovecraft.UnitTests\NotificationsWorker\DigestProcessorTests.cs`

`DigestProcessor.ProcessAsync` currently calls `_email.DispatchAsync(first)` for email channel (Phase C stub-compatible trick). Phase F: call `_email.DispatchDigestAsync(digestModel)` for email; keep the single-member trick for telegram (it stays stubbed).

Specifically, replace this block in `DigestProcessor`:
```csharp
var result = channel switch
{
    "Telegram" => await _telegram.DispatchAsync(first, ct),
    "Email" => await _email.DispatchAsync(first, ct),
    _ => DispatchResult.PermanentError,
};
```

With:
```csharp
DispatchResult result;
if (channel == "Email")
{
    result = await _email.DispatchDigestAsync(digest, ct);
}
else if (channel == "Telegram")
{
    // Phase F: Telegram digests still use single-member trick (real digest impl deferred).
    result = await _telegram.DispatchAsync(first, ct);
}
else
{
    result = DispatchResult.PermanentError;
}
```

- [ ] **Step 1: Update `DigestProcessor.cs`** — make the change above. The `digest` variable already exists from `new DigestModel(userId, members)`.

- [ ] **Step 2: Update `DigestProcessorTests.cs`**

The existing `Daily_rows_dispatched_only_on_user_hour` test stubs `_email.DispatchAsync`. It needs to stub `DispatchDigestAsync` instead:

```csharp
email.Setup(d => d.DispatchDigestAsync(It.IsAny<DigestModel>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(DispatchResult.Delivered);
// ...
email.Verify(d => d.DispatchDigestAsync(It.IsAny<DigestModel>(), It.IsAny<CancellationToken>()), Times.Once);
```

Update all email-channel assertions in the test file to expect `DispatchDigestAsync` instead of `DispatchAsync`.

- [ ] **Step 3: Run, verify pass**

Expected: full suite passes including the updated DigestProcessor tests.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Services/DigestProcessor.cs' 'Lovecraft/Lovecraft.UnitTests/NotificationsWorker/DigestProcessorTests.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: DigestProcessor uses DispatchDigestAsync for email channel"
```

---

## Task 6: Wire `EmailDispatcher` in worker `Program.cs`

**Files:**
- Modify: `Lovecraft.NotificationsWorker\Program.cs`

If `SENDGRID_API_KEY` set: register `IEmailSendClient` → `SendGridEmailSendClient` (factory passing api key + FROM_EMAIL), `IEmailDigestRenderer` → `EmailDigestRenderer` (factory passing FRONTEND_BASE_URL twice, used for both `unsubscribeBaseUrl` and `appBaseUrl`), `IEmailDispatcher` → `EmailDispatcher` (factory with JWT_SECRET_KEY). Otherwise keep `StubEmailDispatcher`.

Read existing Program.cs (Phases C + D + E pattern) to find the right insertion point — adjacent to the Telegram conditional registration.

```csharp
var sendgridKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
var fromEmail = Environment.GetEnvironmentVariable("FROM_EMAIL") ?? "noreply@aloeband.ru";
var frontendBaseUrl = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "https://aloeve.club";
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");

if (!string.IsNullOrEmpty(sendgridKey) && !string.IsNullOrEmpty(jwtSecret))
{
    var usersTableForEmail = serviceClient.GetTableClient(TableNames.Users);  // may already be defined for Telegram block — reuse if so
    builder.Services.AddSingleton<IEmailSendClient>(_ => new SendGridEmailSendClient(sendgridKey, fromEmail));
    builder.Services.AddSingleton<IEmailDigestRenderer>(sp => new EmailDigestRenderer(
        frontendBaseUrl, frontendBaseUrl, sp.GetRequiredService<ILogger<EmailDigestRenderer>>()));
    builder.Services.AddSingleton<IEmailDispatcher>(sp => new EmailDispatcher(
        sp.GetRequiredService<IEmailSendClient>(),
        usersTableForEmail,
        sp.GetRequiredService<IEmailDigestRenderer>(),
        jwtSecret,
        sp.GetRequiredService<ILogger<EmailDispatcher>>()));
}
else
{
    Console.Error.WriteLine("SENDGRID_API_KEY or JWT_SECRET_KEY not set; using StubEmailDispatcher.");
    builder.Services.AddSingleton<IEmailDispatcher, StubEmailDispatcher>();
}
```

**Important:** if the existing `Program.cs` Telegram block already creates `usersTable`, hoist its declaration outside the Telegram if-branch so it's accessible to the email block too. Or capture `serviceClient` and create both table clients in one place above both conditional blocks.

After Phase E's TableClient DI cleanup fix, only `usersTable` should remain registered. Make sure this task doesn't accidentally double-register `TableClient`. The email block should reuse the same `usersTable` via factory capture, NOT via `AddSingleton(usersTable)`.

- [ ] **Step 1: Read existing `Program.cs`** to find the Telegram conditional and the `usersTable` declaration.

- [ ] **Step 2: Restructure if necessary** so `usersTable` is created once above both Telegram and Email conditional blocks.

- [ ] **Step 3: Add the Email block** matching the snippet above.

- [ ] **Step 4: Build + full test**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: full suite passes (no regressions). New tests from Tasks 1, 3, 4, 5 should all be green.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/Lovecraft.NotificationsWorker/Program.cs'
git -C 'D:\src\lovecraft' commit -m "notifications-worker: DI wiring for real EmailDispatcher (stub fallback when SENDGRID/JWT secret missing)"
```

---

## Task 7: Docs + docker-compose

**Files:**
- Modify: `Lovecraft/docs/NOTIFICATIONS.md`
- Modify: `Lovecraft/docs/IMPLEMENTATION_SUMMARY.md`
- Modify: `aloevera-harmony-meet/docs/ISSUES.md`
- Modify: `aloevera-harmony-meet/AGENTS.md`
- Modify: `aloevera-harmony-meet/docker-compose.yml`

Today's date: 2026-05-18.

- [ ] **Step 1: Append Phase F section to `NOTIFICATIONS.md`**

```markdown
## Phase F — shipped 2026-MM-DD

**Email digest** is a real delivery channel. Architecture:
- `EmailDispatcher` (`Lovecraft.NotificationsWorker.Dispatchers`) replaces Phase C's `StubEmailDispatcher` when `SENDGRID_API_KEY` + `JWT_SECRET_KEY` are set.
- Worker calls SendGrid directly via `IEmailSendClient` (wraps the SendGrid SDK).
- `IEmailDigestRenderer` produces `{Subject, HtmlBody, PlainTextBody}` for both single emails (rare; Immediate frequency) and grouped digests (Hourly/Daily).
- `DigestProcessor` now calls `IEmailDispatcher.DispatchDigestAsync(DigestModel)` for the Email channel — passes the full grouped notification list, no longer just the first member.
- Telegram digests still use the Phase C single-member trick (rare UX; real Telegram digest support deferred).

**Unsubscribe flow:**
- `UnsubscribeToken` (in `Lovecraft.Common`) is a compact HMAC-SHA256 signed token: `{userIdBase64Url}.{expiresAtUnix}.{base64hmac}`. Worker generates one per email send with a 30-day expiration.
- Email footer contains `https://aloeve.club/api/v1/notifications/unsubscribe?token=...`.
- Backend `[AllowAnonymous] GET /api/v1/notifications/unsubscribe?token=...` verifies the token, flips all `prefs.matrix.*.email = false` for the user, returns an HTML confirmation page with a "Open Settings" link.
- One-click kill switch for all 9 notification types via email channel. User re-enables in Settings.

**Required env vars (Phase F — already exist in backend, now used by worker):**
```
SENDGRID_API_KEY=...               # required for real EmailDispatcher (stub fallback if absent)
FROM_EMAIL=noreply@aloeband.ru     # default if unset
FRONTEND_BASE_URL=https://aloeve.club
JWT_SECRET_KEY=...                 # required for unsubscribe-token signing
```

**Known follow-ups (Phase F):**
- English-only templates (same trade-off as previous channels). Locale-aware rendering deferred.
- Telegram digest support — `_telegram.DispatchAsync(first)` in `DigestProcessor` is a Phase C carryover; if a user opts Telegram + Hourly/Daily frequency, only the first notification is sent. Fix when ITelegramDigestRenderer + per-channel DispatchDigestAsync support is added to `ITelegramDispatcher`.
- No per-user email rate limiting — relies on SendGrid's own rate limits + outbox retry/backoff path.
- Actor name still rendered as "Someone" — actor-name denormalization is a cross-channel follow-up tracked from Phase D.
```

- [ ] **Step 2: Append IMPLEMENTATION_SUMMARY.md line**

```
- ✅ Notifications Phase F: real EmailDispatcher (SendGrid send + EmailDigestRenderer producing HTML + plaintext); signed unsubscribe link via UnsubscribeToken (HMAC-SHA256); /api/v1/notifications/unsubscribe endpoint; DigestProcessor passes full DigestModel to DispatchDigestAsync for email channel.
```

- [ ] **Step 3: Update `ISSUES.md`**

In MCF.4 Resolution block, append: `Phase F (email digest + unsubscribe) shipped 2026-MM-DD. Phases G (event reminders + admin broadcast), H (rank-up) pending.`

- [ ] **Step 4: Update `AGENTS.md`**

Add a bullet under notifications:
```
- Email digest channel: opt-in per type in Settings → Notifications → Email. Worker (Lovecraft.NotificationsWorker) sends via SendGrid; digest renderer groups Hourly/Daily by type with deep links. Every email footer has a signed one-click unsubscribe link (GET /api/v1/notifications/unsubscribe?token=...) that flips all email cells to false.
```

- [ ] **Step 5: Update `docker-compose.yml`**

In the `notifications-worker` service block, expand the `env_file:` comment to mention Phase F env vars:
```yaml
    env_file:
      # Picks up: AZURE_STORAGE_CONNECTION_STRING, USE_AZURE_STORAGE,
      # TELEGRAM_BOT_TOKEN (Phase D), SENDGRID_API_KEY + FROM_EMAIL + FRONTEND_BASE_URL
      # + JWT_SECRET_KEY (Phase F)
      - ../lovecraft/Lovecraft/.env
```

- [ ] **Step 6: Commit (split per repo)**

```bash
git -C 'D:\src\lovecraft' add 'Lovecraft/docs/NOTIFICATIONS.md' 'Lovecraft/docs/IMPLEMENTATION_SUMMARY.md'
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase F (email digest + unsubscribe)"

git -C 'D:\src\aloevera-harmony-meet' add 'docs/ISSUES.md' 'AGENTS.md' 'docker-compose.yml'
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase F (email digest)"
```

---

## Task 8: Final verification

**Files:** none.

- [ ] **Step 1: Build backend**

```
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```
Expected: 7 projects build (VapidKeygen from Phase E + 6 existing), 0 errors.

- [ ] **Step 2: Run full backend test suite**

```
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --nologo
```
Expected: 406 (Phase E) + 5 (UnsubscribeToken) + 3 (Unsubscribe endpoint) + 5 (EmailDigestRenderer) + 7 (EmailDispatcher) = 426 tests pass.

- [ ] **Step 3: Run frontend test suite (no new tests in Phase F, just verify nothing breaks)**

```
npm --prefix 'D:/src/aloevera-harmony-meet' run test:run
```
Expected: 234/234 (unchanged).

- [ ] **Step 4: Verify git state**

```
git -C 'D:\src\lovecraft' log --oneline main..HEAD
git -C 'D:\src\aloevera-harmony-meet' log --oneline main..HEAD
```

Backend: ~7 commits. Frontend: 1 commit.

- [ ] **Step 5: Marker commits (optional)**

```bash
git -C 'D:\src\lovecraft' commit --allow-empty -m "notifications: phase F complete"
git -C 'D:\src\aloevera-harmony-meet' commit --allow-empty -m "notifications: phase F complete"
```

---

## After Phase F

Follow-ups:
1. **Telegram digest support** — currently if a user opts Telegram + Hourly/Daily, only the first notification is sent (`DispatchAsync(first)` in `DigestProcessor`). Add `ITelegramDispatcher.DispatchDigestAsync(DigestModel)` + a digest renderer for Telegram message format. Or document that Telegram is always Immediate (validator-enforced).
2. **Actor name resolution** — cross-channel follow-up tracked from Phase D. All three channels (Telegram, WebPush, Email) currently render "Someone" instead of actor's name. Producer should denormalize `User.Name` into the outbox or notification payload at enqueue time.
3. **Locale-aware rendering** — same trade-off across all renderers. Worth tackling now since Email is the most prominent surface for non-English users.
4. **`AppBaseUrl` central config** — Telegram, Web Push, Email renderers all need it. Move to typed options pattern shared via DI.
5. **Per-user email rate cap** — SendGrid has account-level limits but no per-user. If a buggy producer fires 100 likes from one user, the recipient gets 100 immediate emails (if they opted Immediate). Add a soft cap (e.g. max 1 immediate-email per user per 5 minutes) when this becomes an issue.

**Phase G (event reminders + admin broadcast)** is next. Adds 3 new producers:
- `EventReminder` via new `EventReminderWorker` (5-minute scan loop scanning `events` for 24h-ahead).
- `EventInviteReceived` via extending `EventInviteEntity` with `targetUserId` + extending admin invite-issuance.
- `CommunityBroadcast` via new `POST /api/v1/admin/notifications/broadcast` endpoint + `broadcasts` table + audience expansion.
- Admin UI: new `/admin/broadcasts` page with compose form + history list.
- `EventPublished` producer wired into `AdminController.CreateEvent` when visibility=Public.
