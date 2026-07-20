# Attendee Pre-Registration & Claim-on-First-Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import an event's attendee list (name / gender / photo URL / Telegram username) into pre-created "shell" user accounts, and automatically link a real Telegram auth method onto the matching shell the first time that person signs in via Telegram.

**Architecture:** A shell is a real `users` row with `PreRegistered = true`, `AuthMethodsJson = []` and an empty `TelegramUserId`, whose `userId` is the normalized Telegram username. An admin endpoint creates shells and registers them as event attendees. On a Telegram sign-in with an *unknown numeric id*, both login flows normalize the payload's `username`, point-read that `userId`, and — **only if the row is an unclaimed shell** — attach Telegram and sign in.

**Tech Stack:** .NET 10 / ASP.NET Core, Azure Table Storage, xUnit; React 18 + TypeScript + Vite + shadcn/ui, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-19-attendee-preregistration-design.md`

> **Refinement vs. spec (deliberate):** The spec proposed a separate `IUserPreRegistrationService`. During planning we confirmed that **both** `AzureAuthService` and `MockAuthService` already inject `IEventService` and own all the user-creation machinery (users table / `_users` dict, email index, `NormalizeGender`, `FetchExternalPhotoAsync`, `AttachTelegramToUserAsync`). `MockAuthService._users` is a **private static** dict, so an external service could not create claimable mock users. Therefore `PreRegisterAttendeesAsync` lives on **`IAuthService`**. Everything else follows the spec exactly.

## Global Constraints

- Target framework .NET 10; C# nullable-aware style matching surrounding code.
- All C# enums serialize as camelCase strings (existing global JSON config) — the per-row `status` is a plain `string`, not an enum.
- Every `IAuthService` change must be implemented in **both** `AzureAuthService` and `MockAuthService` (mode switch is `USE_AZURE_STORAGE`).
- Behavioral backend tests run against `MockAuthService` (existing pattern — see `Lovecraft.UnitTests/TelegramMiniAppFlowTests.cs`). Azure implementations mirror mock logic.
- `Lovecraft.UnitTests` has assembly-level `[CollectionBehavior(DisableTestParallelization = true)]` because `MockDataStore` is static. Auth tests use `[Collection("AuthTests")]`.
- Account names/usernames: `AccountNameValidator` — 5–32 chars, starts with a letter, `[A-Za-z0-9_]`, not in the reserved list. `Normalize` = trim + lowercase.
- User-supplied free text (`name`) must pass `HtmlGuard.ContainsHtml(...) == false`.
- Admin endpoints live on `AdminController`, which is already class-guarded with `[Authorize]` + `[RequireStaffRole("admin")]` — **do not** add a new permission key.
- Frontend admin pages are **English-only** (no `t()` / i18n), matching existing admin pages.
- All `adminApi` methods are dual-mode: in mock mode return `ADMIN_REQUIRES_API` error; in api mode call `apiClient`.

---

## File Structure

**Backend (`/home/amorofrost/src/lovecraft/Lovecraft`)**

| File | Responsibility |
|---|---|
| `Lovecraft.Common/DTOs/Admin/PreRegisterDtos.cs` | **Create** — request/result DTOs for the import |
| `Lovecraft.Backend/Storage/Entities/UserEntity.cs` | **Modify** — add `PreRegistered` column |
| `Lovecraft.Backend/Services/IAuthService.cs` | **Modify** — add `PreRegisterAttendeesAsync` |
| `Lovecraft.Backend/Services/MockAuthService.cs` | **Modify** — `MockUser.PreRegistered`, import impl, claim helper, wire into 2 login flows |
| `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` | **Modify** — import impl, claim helper, wire into 2 login flows |
| `Lovecraft.Backend/Controllers/V1/AdminController.cs` | **Modify** — `POST events/{eventId}/preregister` |
| `Lovecraft.UnitTests/PreRegistrationTests.cs` | **Create** — import behavior |
| `Lovecraft.UnitTests/PreRegistrationClaimTests.cs` | **Create** — claim behavior (widget + Mini App) |

**Frontend (`/home/amorofrost/src/aloevera-harmony-meet`)**

| File | Responsibility |
|---|---|
| `src/services/api/adminApi.ts` | **Modify** — types + `preRegisterAttendees` |
| `src/admin/components/PreRegisterAttendeesCard.tsx` | **Create** — parse/preview/submit/results UI (keeps the 1005-line editor page from growing) |
| `src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx` | **Create** — component tests |
| `src/services/api/__tests__/adminApi.preRegister.test.ts` | **Create** — dual-mode service test |
| `src/admin/pages/AdminEventEditorPage.tsx` | **Modify** — mount the card |

---

### Task 1: DTOs, entity column, and interface signature

Scaffolding for everything that follows. Deliverable: solution compiles with a stubbed method.

**Files:**
- Create: `Lovecraft.Common/DTOs/Admin/PreRegisterDtos.cs`
- Modify: `Lovecraft.Backend/Storage/Entities/UserEntity.cs`
- Modify: `Lovecraft.Backend/Services/IAuthService.cs`
- Modify: `Lovecraft.Backend/Services/MockAuthService.cs` (add `PreRegistered` to `MockUser` at line ~949; add stub)
- Modify: `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` (add stub)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `PreRegisterAttendeeDto`, `PreRegisterAttendeesRequestDto`, `PreRegisterRowResultDto`, `PreRegisterSummaryDto`, `PreRegisterResultDto`; `UserEntity.PreRegistered` (bool); `MockUser.PreRegistered` (bool); `Task<PreRegisterResultDto> IAuthService.PreRegisterAttendeesAsync(string eventId, List<PreRegisterAttendeeDto> attendees)`.

- [ ] **Step 1: Create the DTO file**

Create `Lovecraft.Common/DTOs/Admin/PreRegisterDtos.cs`:

```csharp
namespace Lovecraft.Common.DTOs.Admin;

/// <summary>One imported attendee. Only the Telegram username and name are required.</summary>
public class PreRegisterAttendeeDto
{
    public string TelegramUsername { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string? PhotoUrl { get; set; }
}

public class PreRegisterAttendeesRequestDto
{
    public List<PreRegisterAttendeeDto> Attendees { get; set; } = new();
}

/// <summary>Per-row outcome. Status is one of:
/// "created" | "skippedExists" | "invalidUsername" | "invalidName" | "error".</summary>
public class PreRegisterRowResultDto
{
    public string TelegramUsername { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? Message { get; set; }
}

public class PreRegisterSummaryDto
{
    public int Created { get; set; }
    public int SkippedExists { get; set; }
    public int InvalidUsername { get; set; }
    public int InvalidName { get; set; }
    public int Error { get; set; }
}

public class PreRegisterResultDto
{
    public PreRegisterSummaryDto Summary { get; set; } = new();
    public List<PreRegisterRowResultDto> Results { get; set; } = new();
}
```

- [ ] **Step 2: Add the `PreRegistered` column to `UserEntity`**

In `Lovecraft.Backend/Storage/Entities/UserEntity.cs`, add after the `GoogleUserId` property:

```csharp
    /// <summary>True when the row was created by admin attendee pre-registration.
    /// Combined with an empty <see cref="TelegramUserId"/> this marks an unclaimed shell
    /// account that may be claimed by a matching Telegram username on first sign-in.</summary>
    public bool PreRegistered { get; set; }
```

- [ ] **Step 3: Add `PreRegistered` to `MockUser`**

In `Lovecraft.Backend/Services/MockAuthService.cs`, inside `private class MockUser` (starts line ~949), add:

```csharp
        public bool PreRegistered { get; set; }
```

- [ ] **Step 4: Add the interface method**

In `Lovecraft.Backend/Services/IAuthService.cs`, add (with the `using Lovecraft.Common.DTOs.Admin;` import at the top):

```csharp
    /// <summary>Admin bulk import: create shell accounts for event attendees keyed by Telegram
    /// username, and register each created account as an attendee of <paramref name="eventId"/>.
    /// Idempotent — rows whose username already resolves to an account are skipped.</summary>
    Task<PreRegisterResultDto> PreRegisterAttendeesAsync(string eventId, List<PreRegisterAttendeeDto> attendees);
```

- [ ] **Step 5: Add compiling stubs to both implementations**

In **both** `MockAuthService.cs` and `Azure/AzureAuthService.cs`, add (with `using Lovecraft.Common.DTOs.Admin;`):

```csharp
    public Task<PreRegisterResultDto> PreRegisterAttendeesAsync(string eventId, List<PreRegisterAttendeeDto> attendees)
        => throw new NotImplementedException();
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet build`
Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Common/DTOs/Admin/PreRegisterDtos.cs Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs Lovecraft/Lovecraft.Backend/Services/IAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs
git commit -m "feat(preregister): add DTOs, PreRegistered column, and IAuthService signature"
```

---

### Task 2: Mock import implementation (TDD)

**Files:**
- Create: `Lovecraft.UnitTests/PreRegistrationTests.cs`
- Modify: `Lovecraft.Backend/Services/MockAuthService.cs`

**Interfaces:**
- Consumes: `PreRegisterAttendeeDto`, `PreRegisterResultDto`, `MockUser.PreRegistered` (Task 1).
- Produces: working `MockAuthService.PreRegisterAttendeesAsync`; shells stored in `_users` keyed by synthetic email `prereg_{userId}@telegram.local`, discoverable by `u.Id == userId`.

- [ ] **Step 1: Write the failing tests**

Create `Lovecraft.UnitTests/PreRegistrationTests.cs`:

```csharp
using Lovecraft.Backend.Auth;
using Lovecraft.Backend.Configuration;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Admin;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Lovecraft.UnitTests;

[Collection("AuthTests")]
public class PreRegistrationTests
{
    private const string BotToken = "1234567:TEST-BOT-TOKEN-FOR-PREREGISTRATION";
    private const string EventId = "1";

    private readonly MockAuthService _auth;

    public PreRegistrationTests()
    {
        var jwtSettings = new JwtSettings
        {
            SecretKey = "test-secret-key-min-32-characters!",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            AccessTokenLifetimeMinutes = 15,
            RefreshTokenLifetimeDays = 7
        };
        var jwt = new JwtService(jwtSettings, NullLogger<JwtService>.Instance);
        var (app, invites, events) = TestAuthDependencies.CreateMockStack();
        _auth = new MockAuthService(
            jwt,
            new PasswordHasher(),
            NullLogger<MockAuthService>.Instance,
            new NullEmailService(NullLogger<NullEmailService>.Instance),
            app,
            invites,
            events,
            Options.Create(new TelegramAuthOptions { BotToken = BotToken, BotUsername = "testbot" }),
            Options.Create(new GoogleAuthOptions()));
    }

    private static PreRegisterAttendeeDto Row(string username, string name = "Test Person") =>
        new() { TelegramUsername = username, Name = name, Gender = "female" };

    [Fact]
    public async Task PreRegister_CreatesShellAccount_WithNormalizedUsernameAsUserId()
    {
        var result = await _auth.PreRegisterAttendeesAsync(EventId, new() { Row("Anna_Petrova") });

        Assert.Equal(1, result.Summary.Created);
        var row = Assert.Single(result.Results);
        Assert.Equal("created", row.Status);
        Assert.Equal("anna_petrova", row.UserId);
    }

    [Fact]
    public async Task PreRegister_IsIdempotent_SecondImportSkips()
    {
        await _auth.PreRegisterAttendeesAsync(EventId, new() { Row("Repeat_User") });
        var second = await _auth.PreRegisterAttendeesAsync(EventId, new() { Row("Repeat_User") });

        Assert.Equal(0, second.Summary.Created);
        Assert.Equal(1, second.Summary.SkippedExists);
        Assert.Equal("skippedExists", second.Results[0].Status);
    }

    [Fact]
    public async Task PreRegister_DuplicateWithinBatch_CreatesOnce()
    {
        var result = await _auth.PreRegisterAttendeesAsync(
            EventId, new() { Row("Dup_User"), Row("dup_user") });

        Assert.Equal(1, result.Summary.Created);
        Assert.Equal(1, result.Summary.SkippedExists);
    }

    [Theory]
    [InlineData("abc")]        // too short (min 5)
    [InlineData("1nvalid")]    // must start with a letter
    [InlineData("bad-name")]   // hyphen not allowed
    [InlineData("official")]   // reserved
    public async Task PreRegister_InvalidUsername_IsReportedNotCreated(string username)
    {
        var result = await _auth.PreRegisterAttendeesAsync(EventId, new() { Row(username) });

        Assert.Equal(0, result.Summary.Created);
        Assert.Equal(1, result.Summary.InvalidUsername);
        Assert.Equal("invalidUsername", result.Results[0].Status);
    }

    [Fact]
    public async Task PreRegister_NameContainingHtml_IsRejected()
    {
        var result = await _auth.PreRegisterAttendeesAsync(
            EventId, new() { Row("Html_User", "<b>bold</b>") });

        Assert.Equal(0, result.Summary.Created);
        Assert.Equal(1, result.Summary.InvalidName);
        Assert.Equal("invalidName", result.Results[0].Status);
    }

    [Fact]
    public async Task PreRegister_ShellIsNotLoggableUntilClaimed_HasNoAuthMethods()
    {
        await _auth.PreRegisterAttendeesAsync(EventId, new() { Row("Shell_User") });

        // IAuthService.GetAuthMethodsAsync returns List<AuthMethodDto> (Provider/LinkedAt/LastUsedAt).
        var methods = await _auth.GetAuthMethodsAsync("shell_user");
        Assert.Empty(methods);
    }

    [Fact]
    public async Task PreRegister_MixedBatch_ReportsEachRowIndependently()
    {
        var result = await _auth.PreRegisterAttendeesAsync(
            EventId, new() { Row("Good_User"), Row("bad"), Row("Other_User") });

        Assert.Equal(2, result.Summary.Created);
        Assert.Equal(1, result.Summary.InvalidUsername);
        Assert.Equal(3, result.Results.Count);
    }
}
```

> `IAuthService.GetAuthMethodsAsync(string userId)` returns `Task<List<AuthMethodDto>>`, where `AuthMethodDto.Provider` is the `"local"`/`"google"`/`"telegram"` string.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter FullyQualifiedName~PreRegistrationTests`
Expected: FAIL — `System.NotImplementedException` from the Task 1 stub.

- [ ] **Step 3: Implement in `MockAuthService`**

Replace the stub in `Lovecraft.Backend/Services/MockAuthService.cs` with:

```csharp
    public async Task<PreRegisterResultDto> PreRegisterAttendeesAsync(
        string eventId, List<PreRegisterAttendeeDto> attendees)
    {
        var result = new PreRegisterResultDto();

        foreach (var row in attendees ?? new List<PreRegisterAttendeeDto>())
        {
            var rawUsername = (row.TelegramUsername ?? string.Empty).Trim().TrimStart('@');
            var rowResult = new PreRegisterRowResultDto { TelegramUsername = rawUsername };

            var validation = AccountNameValidator.Validate(rawUsername);
            if (validation != AccountNameValidationResult.Ok)
            {
                rowResult.Status = "invalidUsername";
                rowResult.Message = validation == AccountNameValidationResult.Reserved
                    ? "reserved" : "invalidFormat";
                result.Summary.InvalidUsername++;
                result.Results.Add(rowResult);
                continue;
            }

            var name = (row.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || HtmlGuard.ContainsHtml(name))
            {
                rowResult.Status = "invalidName";
                rowResult.Message = "name is required and must not contain HTML";
                result.Summary.InvalidName++;
                result.Results.Add(rowResult);
                continue;
            }

            var userId = AccountNameValidator.Normalize(rawUsername);
            rowResult.UserId = userId;

            if (_users.Values.Any(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase)))
            {
                rowResult.Status = "skippedExists";
                rowResult.Message = "an account with this username already exists";
                result.Summary.SkippedExists++;
                result.Results.Add(rowResult);
                continue;
            }

            try
            {
                var syntheticEmail = $"prereg_{userId}@telegram.local";
                var user = new MockUser
                {
                    Id = userId,
                    AccountNameDisplay = rawUsername,
                    Email = syntheticEmail,
                    Name = name,
                    PasswordHash = _passwordHasher.HashPassword(Guid.NewGuid().ToString("N")),
                    EmailVerified = true,
                    AuthMethods = new List<string>(),
                    PreRegistered = true,
                    TelegramUserId = null,
                    Gender = NormalizeGender(row.Gender),
                    ProfileImage = row.PhotoUrl ?? string.Empty,
                    CreatedAt = DateTime.UtcNow,
                };

                _users[syntheticEmail.ToLowerInvariant()] = user;
                SyncAuthContactState(user);

                await _events.RegisterForEventAsync(userId, eventId);

                rowResult.Status = "created";
                result.Summary.Created++;
                _logger.LogInformation("Pre-registered shell account {UserId} for event {EventId}", userId, eventId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Pre-registration failed for {Username}", rawUsername);
                rowResult.Status = "error";
                rowResult.Message = ex.Message;
                result.Summary.Error++;
            }

            result.Results.Add(rowResult);
        }

        return result;
    }
```

Add `using Lovecraft.Backend.Helpers;` at the top of the file if `AccountNameValidator` / `HtmlGuard` are not already imported.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter FullyQualifiedName~PreRegistrationTests`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.UnitTests/PreRegistrationTests.cs
git commit -m "feat(preregister): mock implementation of attendee pre-registration"
```

---

### Task 3: Azure import implementation

Mirrors Task 2 against Azure Tables. Behavioral coverage comes from the mock tests; this task's gate is a clean build plus a careful line-by-line parity read.

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureAuthService.cs`

**Interfaces:**
- Consumes: `UserEntity.PreRegistered`, DTOs (Task 1); existing private members `_usersTable`, `_emailIndexTable`, `_userCache`, `_events`, `_passwordHasher`, `_logger`, `FetchExternalPhotoAsync(string, string?)`, `NormalizeGender(string?)`.
- Produces: working `AzureAuthService.PreRegisterAttendeesAsync` writing `users` + `useremailindex` rows.

- [ ] **Step 1: Implement**

Replace the stub in `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` with:

```csharp
    public async Task<PreRegisterResultDto> PreRegisterAttendeesAsync(
        string eventId, List<PreRegisterAttendeeDto> attendees)
    {
        var result = new PreRegisterResultDto();

        foreach (var row in attendees ?? new List<PreRegisterAttendeeDto>())
        {
            var rawUsername = (row.TelegramUsername ?? string.Empty).Trim().TrimStart('@');
            var rowResult = new PreRegisterRowResultDto { TelegramUsername = rawUsername };

            var validation = AccountNameValidator.Validate(rawUsername);
            if (validation != AccountNameValidationResult.Ok)
            {
                rowResult.Status = "invalidUsername";
                rowResult.Message = validation == AccountNameValidationResult.Reserved
                    ? "reserved" : "invalidFormat";
                result.Summary.InvalidUsername++;
                result.Results.Add(rowResult);
                continue;
            }

            var name = (row.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || HtmlGuard.ContainsHtml(name))
            {
                rowResult.Status = "invalidName";
                rowResult.Message = "name is required and must not contain HTML";
                result.Summary.InvalidName++;
                result.Results.Add(rowResult);
                continue;
            }

            var userId = AccountNameValidator.Normalize(rawUsername);
            rowResult.UserId = userId;

            // Dedup: any existing account (shell or real) with this userId wins.
            try
            {
                await _usersTable.GetEntityAsync<UserEntity>(UserEntity.GetPartitionKey(userId), userId);
                rowResult.Status = "skippedExists";
                rowResult.Message = "an account with this username already exists";
                result.Summary.SkippedExists++;
                result.Results.Add(rowResult);
                continue;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                // free to create
            }

            try
            {
                // Photo is best-effort: a download/upload failure must NOT fail the row.
                var profileImage = string.Empty;
                try
                {
                    profileImage = await FetchExternalPhotoAsync(userId, row.PhotoUrl);
                }
                catch (Exception photoEx)
                {
                    _logger.LogWarning(photoEx,
                        "Pre-registration: photo fetch failed for {UserId}; continuing without it", userId);
                }

                var syntheticEmail = $"prereg_{userId}@telegram.local";
                var emailLower = syntheticEmail.ToLowerInvariant();
                var now = DateTime.UtcNow;

                var userEntity = new UserEntity
                {
                    PartitionKey = UserEntity.GetPartitionKey(userId),
                    RowKey = userId,
                    AccountNameDisplay = rawUsername,
                    Email = syntheticEmail,
                    PasswordHash = _passwordHasher.HashPassword(
                        Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))),
                    Name = name,
                    Gender = NormalizeGender(row.Gender),
                    ProfileImage = profileImage,
                    ImagesJson = JsonSerializer.Serialize(
                        !string.IsNullOrEmpty(profileImage)
                            ? new List<string> { profileImage }
                            : new List<string>()),
                    EmailVerified = true,
                    AuthMethodsJson = JsonSerializer.Serialize(new List<string>()),
                    TelegramUserId = string.Empty,
                    PreRegistered = true,
                    PreferencesJson = JsonSerializer.Serialize(new { AgeRangeMin = 18, AgeRangeMax = 65, MaxDistance = 50, ShowMe = "everyone" }),
                    SettingsJson = JsonSerializer.Serialize(new { ProfileVisibility = "public", AnonymousLikes = false, Language = "ru", Notifications = true }),
                    CreatedAt = now,
                    UpdatedAt = now,
                    IsOnline = false,
                    LastSeen = now,
                };

                try
                {
                    await _usersTable.AddEntityAsync(userEntity);
                }
                catch (RequestFailedException ex) when (ex.Status == 409)
                {
                    rowResult.Status = "skippedExists";
                    rowResult.Message = "an account with this username already exists";
                    result.Summary.SkippedExists++;
                    result.Results.Add(rowResult);
                    continue;
                }

                try
                {
                    await _emailIndexTable.AddEntityAsync(new UserEmailIndexEntity
                    {
                        PartitionKey = emailLower,
                        RowKey = "INDEX",
                        UserId = userId
                    });
                }
                catch (RequestFailedException ex) when (ex.Status == 409)
                {
                    // Index already present for this synthetic address — harmless.
                }

                _userCache.Set(userEntity);
                await _events.RegisterForEventAsync(userId, eventId);

                rowResult.Status = "created";
                result.Summary.Created++;
                _logger.LogInformation("Pre-registered shell account {UserId} for event {EventId}", userId, eventId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Pre-registration failed for {Username}", rawUsername);
                rowResult.Status = "error";
                rowResult.Message = ex.Message;
                result.Summary.Error++;
            }

            result.Results.Add(rowResult);
        }

        return result;
    }
```

- [ ] **Step 2: Verify build + full suite still green**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet build && dotnet test`
Expected: Build succeeded; all existing tests still pass.

- [ ] **Step 3: Parity read**

Diff the Azure method against the mock method from Task 2 line by line. Confirm identical: username trim/`@`-strip, validation order (username → name → dedup), status strings, and summary counter increments. Fix any divergence.

- [ ] **Step 4: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs
git commit -m "feat(preregister): azure implementation of attendee pre-registration"
```

---

### Task 4: Claim on first Telegram sign-in — mock (TDD)

**Files:**
- Create: `Lovecraft.UnitTests/PreRegistrationClaimTests.cs`
- Modify: `Lovecraft.Backend/Services/MockAuthService.cs` (`TelegramLoginAsync` ~line 177, `MiniAppLoginAsync` ~line 323)

**Interfaces:**
- Consumes: `MockAuthService.PreRegisterAttendeesAsync` (Task 2), existing `AttachTelegramToUser(MockUser, TelegramUserInfoDto)` (line ~572), `IssueJwtPairAsync(MockUser)`.
- Produces: `private MockUser? TryClaimPreRegistered(TelegramUserInfoDto tgInfo)` used by both login flows.

- [ ] **Step 1: Write the failing tests**

Create `Lovecraft.UnitTests/PreRegistrationClaimTests.cs`:

```csharp
using Lovecraft.Backend.Auth;
using Lovecraft.Backend.Configuration;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Admin;
using Lovecraft.Common.DTOs.Auth;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Lovecraft.UnitTests;

[Collection("AuthTests")]
public class PreRegistrationClaimTests
{
    private const string BotToken = "1234567:TEST-BOT-TOKEN-FOR-CLAIM-TESTS";
    private const string EventId = "1";

    private readonly MockAuthService _auth;

    public PreRegistrationClaimTests()
    {
        var jwtSettings = new JwtSettings
        {
            SecretKey = "test-secret-key-min-32-characters!",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            AccessTokenLifetimeMinutes = 15,
            RefreshTokenLifetimeDays = 7
        };
        var jwt = new JwtService(jwtSettings, NullLogger<JwtService>.Instance);
        var (app, invites, events) = TestAuthDependencies.CreateMockStack();
        _auth = new MockAuthService(
            jwt,
            new PasswordHasher(),
            NullLogger<MockAuthService>.Instance,
            new NullEmailService(NullLogger<NullEmailService>.Instance),
            app,
            invites,
            events,
            Options.Create(new TelegramAuthOptions { BotToken = BotToken, BotUsername = "testbot" }),
            Options.Create(new GoogleAuthOptions()));
    }

    private static TelegramLoginRequestDto SignedWidgetPayload(long id, string? username)
    {
        var dto = new TelegramLoginRequestDto
        {
            Id = id,
            FirstName = "Tg",
            Username = username,
            AuthDate = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
        };
        dto.Hash = TelegramLoginVerifier.ComputeHashForTest(BotToken, dto);
        return dto;
    }

    private static string SignedInitData(long id, string? username) =>
        TelegramInitDataValidator.BuildSigned(
            BotToken,
            new TelegramUserInfoDto { Id = id, FirstName = "Tg", Username = username },
            DateTimeOffset.UtcNow.ToUnixTimeSeconds());

    [Fact]
    public async Task WidgetLogin_MatchingUsername_ClaimsShellAndSignsIn()
    {
        await _auth.PreRegisterAttendeesAsync(EventId,
            new() { new PreRegisterAttendeeDto { TelegramUsername = "Claim_Me", Name = "Claim Me" } });

        var result = await _auth.TelegramLoginAsync(SignedWidgetPayload(50001, "Claim_Me"));

        Assert.NotNull(result);
        Assert.Equal("signedIn", result!.Status);
        Assert.NotNull(result.Auth);

        var methods = await _auth.GetAuthMethodsAsync("claim_me");
        Assert.Contains(methods, m => string.Equals(m.Provider, "telegram", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task WidgetLogin_ClaimedShell_SecondLoginResolvesByTelegramId()
    {
        await _auth.PreRegisterAttendeesAsync(EventId,
            new() { new PreRegisterAttendeeDto { TelegramUsername = "Twice_User", Name = "Twice" } });

        await _auth.TelegramLoginAsync(SignedWidgetPayload(50002, "Twice_User"));
        // Username omitted the second time — must still sign in via the linked numeric id.
        var second = await _auth.TelegramLoginAsync(SignedWidgetPayload(50002, null));

        Assert.NotNull(second);
        Assert.Equal("signedIn", second!.Status);
    }

    [Fact]
    public async Task WidgetLogin_UsernameMatchesNonShellAccount_DoesNotClaim()
    {
        // A normal account whose account name happens to equal a Telegram username.
        await _auth.RegisterAsync(new RegisterRequestDto
        {
            AccountName = "Real_User",
            Email = "real@example.com",
            Password = "Str0ng!Passw0rd",
            Name = "Real User",
            Age = 30,
            Gender = "male",
        });

        var result = await _auth.TelegramLoginAsync(SignedWidgetPayload(50003, "Real_User"));

        Assert.NotNull(result);
        Assert.Equal("pending", result!.Status);

        var methods = await _auth.GetAuthMethodsAsync("real_user");
        Assert.DoesNotContain(methods, m => string.Equals(m.Provider, "telegram", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task WidgetLogin_NoMatchingShell_FallsThroughToPending()
    {
        var result = await _auth.TelegramLoginAsync(SignedWidgetPayload(50004, "nobody_here"));

        Assert.NotNull(result);
        Assert.Equal("pending", result!.Status);
    }

    [Fact]
    public async Task WidgetLogin_NoUsernameInPayload_FallsThroughToPending()
    {
        var result = await _auth.TelegramLoginAsync(SignedWidgetPayload(50005, null));

        Assert.NotNull(result);
        Assert.Equal("pending", result!.Status);
    }

    [Fact]
    public async Task MiniAppLogin_MatchingUsername_ClaimsShellAndSignsIn()
    {
        await _auth.PreRegisterAttendeesAsync(EventId,
            new() { new PreRegisterAttendeeDto { TelegramUsername = "Mini_Claim", Name = "Mini Claim" } });

        var result = await _auth.MiniAppLoginAsync(new TelegramMiniAppLoginRequestDto
        {
            InitData = SignedInitData(50006, "Mini_Claim")
        });

        Assert.NotNull(result);
        Assert.Equal("signedIn", result!.Status);

        var methods = await _auth.GetAuthMethodsAsync("mini_claim");
        Assert.Contains(methods, m => string.Equals(m.Provider, "telegram", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task MiniAppLogin_NoMatchingShell_FallsThroughToNeedsRegistration()
    {
        var result = await _auth.MiniAppLoginAsync(new TelegramMiniAppLoginRequestDto
        {
            InitData = SignedInitData(50007, "unknown_person")
        });

        Assert.NotNull(result);
        Assert.Equal("needsRegistration", result!.Status);
    }
}
```

> **Signing helpers:** `TelegramInitDataValidator.BuildSigned(...)` already exists (used by `TelegramMiniAppFlowTests`). For the widget payload, check `Lovecraft.Backend/Auth/TelegramLoginVerifier.cs` for an existing test-signing helper; if none exists, add a small `internal static string ComputeHashForTest(string botToken, TelegramLoginRequestDto dto)` that reuses the verifier's own data-check-string builder, so tests sign exactly the way `Verify` checks. Do **not** duplicate the HMAC logic — extract and share it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter FullyQualifiedName~PreRegistrationClaimTests`
Expected: FAIL — claim tests return `"pending"` / `"needsRegistration"` instead of `"signedIn"`.

- [ ] **Step 3: Add the claim helper to `MockAuthService`**

Add near `AttachTelegramToUser` (line ~572) in `Lovecraft.Backend/Services/MockAuthService.cs`:

```csharp
    /// <summary>Finds an unclaimed pre-registered shell whose userId equals the normalized
    /// Telegram username and links this Telegram identity to it. Returns null when there is
    /// no claimable shell — callers then fall through to the normal pending/registration path.
    /// Only rows with PreRegistered == true and no TelegramUserId are eligible, so a normal
    /// account whose name merely matches a Telegram username is never taken over.</summary>
    private MockUser? TryClaimPreRegistered(TelegramUserInfoDto tgInfo)
    {
        if (string.IsNullOrWhiteSpace(tgInfo.Username)) return null;

        var userId = AccountNameValidator.Normalize(tgInfo.Username.Trim().TrimStart('@'));
        if (string.IsNullOrEmpty(userId)) return null;

        var shell = _users.Values.FirstOrDefault(u =>
            string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase)
            && u.PreRegistered
            && string.IsNullOrEmpty(u.TelegramUserId));

        if (shell is null) return null;
        if (!AttachTelegramToUser(shell, tgInfo)) return null;

        _logger.LogInformation("Claimed pre-registered account {UserId} for tg {TgId}", shell.Id, tgInfo.Id);
        return shell;
    }
```

- [ ] **Step 4: Wire the helper into `TelegramLoginAsync`**

In `MockAuthService.TelegramLoginAsync` (~line 177), in the branch reached when the Telegram id is **not** found in `_telegramToUserKey` — immediately **before** the code that mints the pending ticket — insert:

```csharp
        var claimed = TryClaimPreRegistered(tgInfo);
        if (claimed is not null)
        {
            return new TelegramLoginResultDto
            {
                Status = "signedIn",
                Auth = await IssueJwtPairAsync(claimed),
            };
        }
```

Use whatever local `TelegramUserInfoDto` the method already builds for the ticket; if it is constructed after this point, move its construction above the inserted block.

- [ ] **Step 5: Wire the helper into `MiniAppLoginAsync`**

In `MockAuthService.MiniAppLoginAsync` (~line 323), immediately **before** returning `needsRegistration`, insert:

```csharp
        var claimed = TryClaimPreRegistered(tgInfo);
        if (claimed is not null)
        {
            return new TelegramMiniAppLoginResultDto
            {
                Status = "signedIn",
                Auth = await IssueJwtPairAsync(claimed),
                Telegram = tgInfo,
            };
        }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test --filter FullyQualifiedName~PreRegistrationClaimTests`
Expected: PASS — all 7 tests green.

- [ ] **Step 7: Run the full suite for regressions**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet test`
Expected: all tests pass — especially `TelegramPendingFlowTests` and `TelegramMiniAppFlowTests`, which must be unaffected because their fixtures have no pre-registered shells.

- [ ] **Step 8: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/Auth/TelegramLoginVerifier.cs Lovecraft/Lovecraft.UnitTests/PreRegistrationClaimTests.cs
git commit -m "feat(preregister): claim shell account on first telegram sign-in (mock)"
```

---

### Task 5: Claim on first Telegram sign-in — Azure

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` (`TelegramLoginAsync` line 246, `MiniAppLoginAsync` line 535)

**Interfaces:**
- Consumes: existing `AttachTelegramToUserAsync(UserEntity, TelegramUserInfoDto)` (line ~987), `IssueJwtPairAsync(UserEntity)`, `_usersTable`.
- Produces: `private async Task<UserEntity?> TryClaimPreRegisteredAsync(TelegramUserInfoDto tgInfo)`.

- [ ] **Step 1: Add the claim helper**

Add directly above `AttachTelegramToUserAsync` in `Lovecraft.Backend/Services/Azure/AzureAuthService.cs`:

```csharp
    /// <summary>Finds an unclaimed pre-registered shell whose userId equals the normalized
    /// Telegram username and links this Telegram identity to it. Returns null when there is no
    /// claimable shell — callers then fall through to the normal pending/registration path.
    /// Only rows with PreRegistered == true and an empty TelegramUserId are eligible, so a normal
    /// account whose name merely matches a Telegram username is never taken over.</summary>
    private async Task<UserEntity?> TryClaimPreRegisteredAsync(TelegramUserInfoDto tgInfo)
    {
        if (string.IsNullOrWhiteSpace(tgInfo.Username)) return null;

        var userId = AccountNameValidator.Normalize(tgInfo.Username.Trim().TrimStart('@'));
        if (string.IsNullOrEmpty(userId)) return null;

        UserEntity shell;
        try
        {
            var resp = await _usersTable.GetEntityAsync<UserEntity>(
                UserEntity.GetPartitionKey(userId), userId);
            shell = resp.Value;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }

        if (!shell.PreRegistered || !string.IsNullOrEmpty(shell.TelegramUserId))
            return null;

        if (!await AttachTelegramToUserAsync(shell, tgInfo))
            return null;

        _logger.LogInformation("Claimed pre-registered account {UserId} for tg {TgId}", userId, tgInfo.Id);
        return shell;
    }
```

- [ ] **Step 2: Wire into `TelegramLoginAsync`**

In `AzureAuthService.TelegramLoginAsync`, inside `if (userEntity is null) { ... }` (line ~276), **after** the `tgInfo` object is built and **before** `var ticket = _jwtService.GenerateTelegramPendingTicket(tgInfo);`, insert:

```csharp
            var claimed = await TryClaimPreRegisteredAsync(tgInfo);
            if (claimed is not null)
            {
                return new TelegramLoginResultDto
                {
                    Status = "signedIn",
                    Auth = await IssueJwtPairAsync(claimed),
                };
            }
```

- [ ] **Step 3: Wire into `MiniAppLoginAsync`**

In `AzureAuthService.MiniAppLoginAsync`, inside `if (userEntity is null) { ... }` (line ~564), **before** the `needsRegistration` return, insert:

```csharp
            var claimed = await TryClaimPreRegisteredAsync(tgInfo);
            if (claimed is not null)
            {
                return new TelegramMiniAppLoginResultDto
                {
                    Status = "signedIn",
                    Auth = await IssueJwtPairAsync(claimed),
                    Telegram = tgInfo,
                };
            }
```

- [ ] **Step 4: Build + full suite**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet build && dotnet test`
Expected: Build succeeded; all tests pass.

- [ ] **Step 5: Parity read**

Compare against the mock helper from Task 4: same username normalization (`TrimStart('@')`), same eligibility predicate (`PreRegistered && TelegramUserId empty`), same fall-through-on-null semantics in both login flows.

- [ ] **Step 6: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs
git commit -m "feat(preregister): claim shell account on first telegram sign-in (azure)"
```

---

### Task 6: Admin endpoint

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/AdminController.cs`

**Interfaces:**
- Consumes: `IAuthService.PreRegisterAttendeesAsync` (Tasks 2–3), `PreRegisterAttendeesRequestDto`, `PreRegisterResultDto`.
- Produces: `POST /api/v1/admin/events/{eventId}/preregister` → `ApiResponse<PreRegisterResultDto>`.

- [ ] **Step 1: Inject `IAuthService`**

`AdminController`'s constructor currently takes `(IAppConfigService appConfig, IEventInviteService eventInvites, IEventService events, IForumService forum, IStoreService store, IBlogService blog)` — `IAuthService` is **not** injected. Add it:

```csharp
    private readonly IAuthService _auth;
```

Add `IAuthService auth` as a constructor parameter and assign `_auth = auth;` alongside the existing assignments.

- [ ] **Step 2: Add the endpoint**

Add to `Lovecraft.Backend/Controllers/V1/AdminController.cs`, near the other `events/{eventId}/...` actions (with `using Lovecraft.Common.DTOs.Admin;` present):

```csharp
    /// <summary>Bulk pre-registration of event attendees by Telegram username. Admin-only
    /// (inherited from the controller-level [RequireStaffRole("admin")]).</summary>
    [HttpPost("events/{eventId}/preregister")]
    public async Task<ActionResult<ApiResponse<PreRegisterResultDto>>> PreRegisterAttendees(
        string eventId, [FromBody] PreRegisterAttendeesRequestDto request)
    {
        if (request?.Attendees is null || request.Attendees.Count == 0)
            return BadRequest(ApiResponse<PreRegisterResultDto>.ErrorResponse(
                "ATTENDEES_REQUIRED", "At least one attendee is required"));

        if (request.Attendees.Count > 500)
            return BadRequest(ApiResponse<PreRegisterResultDto>.ErrorResponse(
                "TOO_MANY_ATTENDEES", "At most 500 attendees per request"));

        var result = await _auth.PreRegisterAttendeesAsync(eventId, request.Attendees);
        return Ok(ApiResponse<PreRegisterResultDto>.SuccessResponse(result));
    }
```

> `ApiResponse<T>` exposes `SuccessResponse(T data)` and `ErrorResponse(string code, string message)` — these are the helpers used above.

- [ ] **Step 3: Build**

Run: `cd /home/amorofrost/src/lovecraft/Lovecraft && dotnet build`
Expected: Build succeeded.

- [ ] **Step 4: Verify manually against the running backend**

```bash
cd /home/amorofrost/src/lovecraft/Lovecraft/Lovecraft.Backend && dotnet run
```

In another shell, obtain an admin JWT, then:

```bash
curl -X POST http://localhost:5000/api/v1/admin/events/1/preregister \
  -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"attendees":[{"telegramUsername":"Anna_Petrova","name":"Anna Petrova","gender":"female"},{"telegramUsername":"bad","name":"Bad Row"}]}'
```

Expected: HTTP 200 with `summary.created == 1`, `summary.invalidUsername == 1`, and two entries in `results`.
Also confirm a non-admin token returns 403.

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/Lovecraft.Backend/Controllers/V1/AdminController.cs
git commit -m "feat(preregister): admin endpoint for attendee pre-registration"
```

---

### Task 7: Frontend service method

**Files:**
- Modify: `src/services/api/adminApi.ts`
- Create: `src/services/api/__tests__/adminApi.preRegister.test.ts`

**Interfaces:**
- Consumes: `POST /api/v1/admin/events/{eventId}/preregister` (Task 6).
- Produces: exported types `PreRegisterAttendeeInput`, `PreRegisterRowResult`, `PreRegisterSummary`, `PreRegisterResult`; method `adminApi.preRegisterAttendees(eventId, attendees)`.

- [ ] **Step 1: Write the failing test**

Create `src/services/api/__tests__/adminApi.preRegister.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminApi } from '../adminApi';
import { apiClient } from '../apiClient';
import * as apiConfig from '@/config/api.config';

describe('adminApi.preRegisterAttendees', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns ADMIN_REQUIRES_API in mock mode', async () => {
    vi.spyOn(apiConfig, 'isApiMode').mockReturnValue(false);

    const res = await adminApi.preRegisterAttendees('1', [
      { telegramUsername: 'anna_p', name: 'Anna' },
    ]);

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('ADMIN_REQUIRES_API');
  });

  it('posts to the preregister endpoint in api mode', async () => {
    vi.spyOn(apiConfig, 'isApiMode').mockReturnValue(true);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { summary: { created: 1, skippedExists: 0, invalidUsername: 0, invalidName: 0, error: 0 }, results: [] },
      timestamp: new Date().toISOString(),
    } as never);

    const res = await adminApi.preRegisterAttendees('42', [
      { telegramUsername: 'anna_p', name: 'Anna', gender: 'female' },
    ]);

    expect(post).toHaveBeenCalledWith('/api/v1/admin/events/42/preregister', {
      attendees: [{ telegramUsername: 'anna_p', name: 'Anna', gender: 'female' }],
    });
    expect(res.success).toBe(true);
    expect(res.data?.summary.created).toBe(1);
  });
});
```

> `isApiMode` is imported by `adminApi.ts` from `@/config/api.config`. If the existing admin tests stub api-mode differently (check `src/admin/pages/__tests__/AdminBroadcastsPage.test.tsx`), follow that established pattern instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/services/api/__tests__/adminApi.preRegister.test.ts`
Expected: FAIL — `adminApi.preRegisterAttendees is not a function`.

- [ ] **Step 3: Implement**

In `src/services/api/adminApi.ts`, add the types near the other exported admin types:

```ts
export interface PreRegisterAttendeeInput {
  telegramUsername: string;
  name: string;
  gender?: string;
  photoUrl?: string;
}

export type PreRegisterRowStatus =
  | 'created'
  | 'skippedExists'
  | 'invalidUsername'
  | 'invalidName'
  | 'error';

export interface PreRegisterRowResult {
  telegramUsername: string;
  status: PreRegisterRowStatus;
  userId?: string;
  message?: string;
}

export interface PreRegisterSummary {
  created: number;
  skippedExists: number;
  invalidUsername: number;
  invalidName: number;
  error: number;
}

export interface PreRegisterResult {
  summary: PreRegisterSummary;
  results: PreRegisterRowResult[];
}
```

And add the method to the `adminApi` object, next to the other event methods:

```ts
  async preRegisterAttendees(
    eventId: string,
    attendees: PreRegisterAttendeeInput[],
  ): Promise<ApiResponse<PreRegisterResult | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.post<PreRegisterResult>(
      `/api/v1/admin/events/${eventId}/preregister`,
      { attendees },
    );
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/services/api/__tests__/adminApi.preRegister.test.ts`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/aloevera-harmony-meet
git add src/services/api/adminApi.ts src/services/api/__tests__/adminApi.preRegister.test.ts
git commit -m "feat(preregister): adminApi.preRegisterAttendees dual-mode service method"
```

---

### Task 8: Admin import UI component

A standalone card so the already-1005-line `AdminEventEditorPage` does not grow further.

**Files:**
- Create: `src/admin/components/PreRegisterAttendeesCard.tsx`
- Create: `src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx`

**Interfaces:**
- Consumes: `adminApi.preRegisterAttendees`, `PreRegisterAttendeeInput`, `PreRegisterResult` (Task 7).
- Produces: `export default function PreRegisterAttendeesCard({ eventId, onImported }: { eventId: string; onImported?: () => void })`.

- [ ] **Step 1: Write the failing test**

Create `src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreRegisterAttendeesCard from '../PreRegisterAttendeesCard';
import { adminApi } from '@/services/api/adminApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const VALID_JSON = JSON.stringify([
  { telegramUsername: 'anna_p', name: 'Anna' },
  { telegramUsername: 'bad', name: 'Bad Row' },
]);

describe('PreRegisterAttendeesCard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows a parse error for malformed JSON', () => {
    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: '{not json' },
    });
    expect(screen.getByText(/could not parse/i)).toBeInTheDocument();
  });

  it('previews parsed rows before import', () => {
    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: VALID_JSON },
    });
    expect(screen.getByText('anna_p')).toBeInTheDocument();
    expect(screen.getByText(/2 attendees? ready/i)).toBeInTheDocument();
  });

  it('submits and renders per-row results', async () => {
    const spy = vi.spyOn(adminApi, 'preRegisterAttendees').mockResolvedValue({
      success: true,
      data: {
        summary: { created: 1, skippedExists: 0, invalidUsername: 1, invalidName: 0, error: 0 },
        results: [
          { telegramUsername: 'anna_p', status: 'created', userId: 'anna_p' },
          { telegramUsername: 'bad', status: 'invalidUsername', message: 'invalidFormat' },
        ],
      },
      timestamp: new Date().toISOString(),
    } as never);

    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: VALID_JSON },
    });
    fireEvent.click(screen.getByRole('button', { name: /import/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('1', [
      { telegramUsername: 'anna_p', name: 'Anna' },
      { telegramUsername: 'bad', name: 'Bad Row' },
    ]));
    expect(await screen.findByText('created')).toBeInTheDocument();
    expect(await screen.findByText('invalidUsername')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx`
Expected: FAIL — cannot resolve `../PreRegisterAttendeesCard`.

- [ ] **Step 3: Implement the component**

Create `src/admin/components/PreRegisterAttendeesCard.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { showApiError } from '@/lib/apiError';
import {
  adminApi,
  type PreRegisterAttendeeInput,
  type PreRegisterResult,
} from '@/services/api/adminApi';

interface Props {
  eventId: string;
  onImported?: () => void;
}

/** Parses the pasted JSON array into attendee rows. Returns an error string instead of throwing. */
function parseAttendees(raw: string): { rows: PreRegisterAttendeeInput[]; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { rows: [], error: 'Could not parse JSON. Expected an array of attendee objects.' };
  }
  if (!Array.isArray(parsed)) {
    return { rows: [], error: 'Could not parse JSON. Expected an array of attendee objects.' };
  }

  const rows: PreRegisterAttendeeInput[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      return { rows: [], error: 'Every entry must be an object.' };
    }
    const e = entry as Record<string, unknown>;
    const telegramUsername = typeof e.telegramUsername === 'string' ? e.telegramUsername.trim() : '';
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!telegramUsername || !name) {
      return { rows: [], error: 'Every entry needs a telegramUsername and a name.' };
    }
    const row: PreRegisterAttendeeInput = { telegramUsername, name };
    if (typeof e.gender === 'string' && e.gender.trim()) row.gender = e.gender.trim();
    if (typeof e.photoUrl === 'string' && e.photoUrl.trim()) row.photoUrl = e.photoUrl.trim();
    rows.push(row);
  }
  return { rows, error: null };
}

const STATUS_VARIANT: Record<string, string> = {
  created: 'text-green-600',
  skippedExists: 'text-muted-foreground',
  invalidUsername: 'text-destructive',
  invalidName: 'text-destructive',
  error: 'text-destructive',
};

export default function PreRegisterAttendeesCard({ eventId, onImported }: Props) {
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PreRegisterResult | null>(null);

  const { rows, error } = useMemo(() => parseAttendees(raw), [raw]);

  const handleImport = async () => {
    if (!rows.length) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await adminApi.preRegisterAttendees(eventId, rows);
      if (!res.success || !res.data) throw res;
      setResult(res.data);
      toast.success(`Imported ${res.data.summary.created} of ${rows.length} attendees`);
      onImported?.();
    } catch (err) {
      showApiError(err, 'Failed to pre-register attendees');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-register attendees</CardTitle>
        <CardDescription>
          Paste a JSON array of attendees. Each needs <code>telegramUsername</code> and{' '}
          <code>name</code>; <code>gender</code> and <code>photoUrl</code> are optional. Accounts are
          created and registered as attendees. When a person first signs in with a matching Telegram
          username, their Telegram login is linked to the account automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="preregister-input">Attendee list (JSON)</Label>
          <Textarea
            id="preregister-input"
            rows={8}
            spellCheck={false}
            placeholder={'[\n  { "telegramUsername": "anna_p", "name": "Anna", "gender": "female" }\n]'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!error && rows.length > 0 && (
            <p className="text-xs text-muted-foreground">{rows.length} attendees ready to import</p>
          )}
        </div>

        {!error && rows.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Username</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Gender</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.telegramUsername} className="border-b last:border-0">
                    <td className="p-2 font-mono">{r.telegramUsername}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.gender ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <Button onClick={handleImport} disabled={submitting || !!error || rows.length === 0}>
            {submitting ? 'Importing…' : 'Import attendees'}
          </Button>
        </div>

        {result && (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Created: {result.summary.created}</Badge>
              <Badge variant="secondary">Skipped: {result.summary.skippedExists}</Badge>
              <Badge variant="secondary">Invalid username: {result.summary.invalidUsername}</Badge>
              <Badge variant="secondary">Invalid name: {result.summary.invalidName}</Badge>
              <Badge variant="secondary">Errors: {result.summary.error}</Badge>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Username</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.telegramUsername} className="border-b last:border-0">
                      <td className="p-2 font-mono">{r.telegramUsername}</td>
                      <td className={`p-2 ${STATUS_VARIANT[r.status] ?? ''}`}>{r.status}</td>
                      <td className="p-2 text-muted-foreground">{r.message ?? r.userId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npx vitest run src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/aloevera-harmony-meet
git add src/admin/components/PreRegisterAttendeesCard.tsx src/admin/components/__tests__/PreRegisterAttendeesCard.test.tsx
git commit -m "feat(preregister): admin attendee import card"
```

---

### Task 9: Mount the card in the event editor

**Files:**
- Modify: `src/admin/pages/AdminEventEditorPage.tsx`

**Interfaces:**
- Consumes: `PreRegisterAttendeesCard` (Task 8), the page's existing `eventId` param and its attendee-loading function.

- [ ] **Step 1: Import the component**

In `src/admin/pages/AdminEventEditorPage.tsx`, add next to the existing dialog imports (~line 53):

```tsx
import PreRegisterAttendeesCard from '../components/PreRegisterAttendeesCard';
```

- [ ] **Step 2: Render it after the attendees/invites section**

The page already has an extracted `useCallback` named **`loadExtras(id: string)`** (line ~175) which calls `adminApi.getAttendees(id)` / `getForumTopics(id)` / `listInvitesForEvent(id)` and sets state. Reuse it directly — no extraction needed and no duplicated fetch.

Insert after the "Invite codes" `<Card>` block (~line 678), inside the same conditional that only renders for a saved event (the card needs a real `eventId`):

```tsx
          <PreRegisterAttendeesCard
            eventId={eventId!}
            onImported={() => {
              void loadExtras(eventId!);
            }}
          />
```

- [ ] **Step 3: Verify the full frontend suite passes**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npm run test:run`
Expected: all tests pass, including the two new files.

- [ ] **Step 4: Verify lint and build**

Run: `cd /home/amorofrost/src/aloevera-harmony-meet && npm run lint && npm run build`
Expected: no new lint errors; build succeeds (emits `dist/admin.html`).

- [ ] **Step 5: Commit**

```bash
cd /home/amorofrost/src/aloevera-harmony-meet
git add src/admin/pages/AdminEventEditorPage.tsx
git commit -m "feat(preregister): mount attendee import card in event editor"
```

---

### Task 10: End-to-end verification and documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-attendee-preregistration-design.md` (frontend repo)
- Modify: `docs/ISSUES.md` (frontend repo)
- Modify: `lovecraft/Lovecraft/docs/AUTHENTICATION.md` (backend repo)
- Modify: `lovecraft/Lovecraft/docs/AZURE_STORAGE.md` (backend repo)

- [ ] **Step 1: Full-stack manual verification**

Start the backend with `USE_AZURE_STORAGE=false` and the frontend with `VITE_API_MODE=api npm run dev`. Then:

1. Sign in at `/admin` with an admin account; open an event in the editor.
2. Paste `[{"telegramUsername":"claim_demo","name":"Claim Demo","gender":"female"}]` and click **Import attendees**.
3. Confirm the results table shows `created` and the attendee roster refreshes to include `claim_demo`.
4. Re-import the same list; confirm `skippedExists`.
5. Import `[{"telegramUsername":"bad","name":"Bad"}]`; confirm `invalidUsername`.
6. Simulate a first Telegram sign-in for username `claim_demo` (Mini App or widget path against the mock backend) and confirm the response is `signedIn` — **not** `pending`/`needsRegistration` — and that no registration wizard appears.

Record the actual observed output for each step. Do not mark this step complete on the basis of expected behavior.

- [ ] **Step 2: Sync the spec's architecture note**

In `docs/superpowers/specs/2026-07-19-attendee-preregistration-design.md`, update the "New service" bullet in Section 2 to state that `PreRegisterAttendeesAsync` lives on `IAuthService` (Azure + Mock), and why (both auth services already own the user-creation machinery and `IEventService`; `MockAuthService._users` is private static). Keep the rest of the spec as-is.

- [ ] **Step 3: Document the new behavior**

- `lovecraft/Lovecraft/docs/AUTHENTICATION.md` — under the Telegram sections, add a short "Pre-registered account claim" subsection: unknown numeric id → normalized `username` lookup → claim only when `PreRegistered && TelegramUserId == ""` → `signedIn`; note that a normal same-named account is never claimed.
- `lovecraft/Lovecraft/docs/AZURE_STORAGE.md` — in the `users` table field list, add `PreRegistered` with a one-line description.
- `docs/ISSUES.md` (frontend) — add a changelog entry dated **July 19, 2026** describing attendee pre-registration + claim-on-first-login, and note the known limitation: if a person changes their Telegram username between import and first sign-in, no claim occurs and the shell is orphaned.

- [ ] **Step 4: Commit the docs**

```bash
cd /home/amorofrost/src/lovecraft
git add Lovecraft/docs/AUTHENTICATION.md Lovecraft/docs/AZURE_STORAGE.md
git commit -m "docs: document pre-registered account claim on telegram sign-in"

cd /home/amorofrost/src/aloevera-harmony-meet
git add docs/ISSUES.md docs/superpowers/specs/2026-07-19-attendee-preregistration-design.md
git commit -m "docs: record attendee pre-registration feature and spec refinement"
```

---

## Known limitations (intentional, per spec)

- If a person's Telegram username changes between import and first sign-in, no claim occurs; they register a fresh account and the shell is orphaned. Admin can re-import a corrected list.
- Mock mode does not project auth-created users into `MockDataStore.Users`, so pre-registered shells are not visible in the mock swipe deck. This is a **pre-existing** mock limitation (Telegram-registered mock users behave the same) and does not affect Azure/production, where shells are visible immediately.
- `RegisterForEventAsync` increments `EventsAttended`, which can fire a `RankUp` notification for a shell. Harmless — the shell has no linked delivery channel, and the in-app row is simply visible after the account is claimed.
