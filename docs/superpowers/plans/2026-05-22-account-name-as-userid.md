# Account-name-as-userId Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required account-name field to every registration path. For new accounts, the lowercased account name becomes `userId` (replacing the auto-generated GUID). Account names are immutable, Telegram-style, unique case-insensitively, exposed as public `@handles` and at `/u/:accountName` profile URLs.

**Architecture:** Backend stores `userId` (== `users.RowKey`) as the lowercased account name, plus a new `AccountNameDisplay` column on `UserEntity` for original casing. No new index table — partition key is derivable from the name itself. Switch register writes from `UpsertEntityAsync` to `AddEntityAsync` for race-safe uniqueness. Live availability check via a new public endpoint with the existing AuthRateLimit. Existing GUID-userId accounts coexist forever — they have empty `AccountNameDisplay` and are excluded from `/u/...` lookups.

**Tech Stack:** Backend: .NET 10, Azure Table Storage, xUnit. Frontend: React 18, TypeScript, Vite, Zod, react-hook-form, Vitest + RTL.

**Spec reference:** `docs/superpowers/specs/2026-05-22-account-name-as-userid-design.md`

**Working directories:**
- Backend: `D:\src\lovecraft`
- Frontend: `D:\src\aloevera-harmony-meet`

---

## Phase 1 — Backend foundation

### Task 1: AccountNameValidator helper

Foundational validation logic used by every register path and the availability endpoint.

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Helpers/AccountNameValidator.cs`
- Create: `Lovecraft/Lovecraft.UnitTests/AccountNameValidatorTests.cs`

- [ ] **Step 1: Write the failing test**

`Lovecraft/Lovecraft.UnitTests/AccountNameValidatorTests.cs`:

```csharp
using Lovecraft.Backend.Helpers;
using Xunit;

namespace Lovecraft.UnitTests;

public class AccountNameValidatorTests
{
    [Theory]
    [InlineData("alice")]
    [InlineData("alice123")]
    [InlineData("Alice_Doe")]
    [InlineData("a1234")] // exactly 5 chars
    [InlineData("abcdefghijklmnopqrstuvwxyz012345")] // exactly 32 chars
    public void Validate_AcceptsValidNames(string name)
    {
        Assert.Equal(AccountNameValidationResult.Ok, AccountNameValidator.Validate(name));
    }

    [Theory]
    [InlineData("")]
    [InlineData("ab")]               // too short
    [InlineData("abcd")]              // 4 chars, still too short
    [InlineData("a")]
    [InlineData("1alice")]            // starts with digit
    [InlineData("_alice")]            // starts with underscore
    [InlineData("alice-doe")]         // hyphen not allowed
    [InlineData("alice.doe")]         // dot not allowed
    [InlineData("alice doe")]         // space
    [InlineData("alice@doe")]         // @
    [InlineData("abcdefghijklmnopqrstuvwxyz0123456")] // 33 chars
    public void Validate_RejectsInvalidFormat(string name)
    {
        Assert.Equal(AccountNameValidationResult.InvalidFormat, AccountNameValidator.Validate(name));
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("ADMIN")]
    [InlineData("Admin")]
    [InlineData("aloevera")]
    [InlineData("telegram")]
    [InlineData("system")]
    [InlineData("anonymous")]
    public void Validate_RejectsReservedNames(string name)
    {
        Assert.Equal(AccountNameValidationResult.Reserved, AccountNameValidator.Validate(name));
    }

    [Theory]
    [InlineData("Alice_Doe", "alice_doe")]
    [InlineData("  alice  ", "alice")]
    [InlineData("USER1", "user1")]
    public void Normalize_LowercasesAndTrims(string input, string expected)
    {
        Assert.Equal(expected, AccountNameValidator.Normalize(input));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run from `D:\src\lovecraft\Lovecraft`:

```bash
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AccountNameValidator" --no-build
```

Expected: FAIL — `AccountNameValidator` / `AccountNameValidationResult` don't exist.

- [ ] **Step 3: Implement the helper**

`Lovecraft/Lovecraft.Backend/Helpers/AccountNameValidator.cs`:

```csharp
using System.Text.RegularExpressions;

namespace Lovecraft.Backend.Helpers;

public enum AccountNameValidationResult
{
    Ok,
    InvalidFormat,
    Reserved,
}

public static class AccountNameValidator
{
    private static readonly Regex Pattern = new(
        @"^[A-Za-z][A-Za-z0-9_]{4,31}$",
        RegexOptions.Compiled);

    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin", "root", "system", "support", "help", "api", "auth", "login", "logout",
        "register", "settings", "profile", "user", "users", "me", "you", "search", "feed",
        "friends", "talks", "aloevera", "aloeve", "aloeband", "telegram", "google",
        "official", "mod", "moderator", "staff", "undefined", "null", "anonymous", "bot",
    };

    public static AccountNameValidationResult Validate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return AccountNameValidationResult.InvalidFormat;
        var trimmed = raw.Trim();
        if (!Pattern.IsMatch(trimmed)) return AccountNameValidationResult.InvalidFormat;
        if (Reserved.Contains(trimmed)) return AccountNameValidationResult.Reserved;
        return AccountNameValidationResult.Ok;
    }

    public static string Normalize(string raw) => raw.Trim().ToLowerInvariant();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~AccountNameValidator"
```

Expected: PASS (24 cases).

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Helpers/AccountNameValidator.cs Lovecraft/Lovecraft.UnitTests/AccountNameValidatorTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): add AccountNameValidator helper + reserved names"
```

---

### Task 2: New exceptions + DTO field + UserEntity column

Data model + error types. No tests in this task — just contract additions consumed by later tasks.

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/InvalidAccountNameException.cs`
- Create: `Lovecraft/Lovecraft.Backend/Services/AccountNameTakenException.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs`
- Modify: `Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs`

- [ ] **Step 1: Create the exception types**

`Lovecraft/Lovecraft.Backend/Services/InvalidAccountNameException.cs`:

```csharp
namespace Lovecraft.Backend.Services;

public class InvalidAccountNameException : Exception
{
    /// <summary>"invalidFormat" or "reserved"</summary>
    public string Reason { get; }
    public InvalidAccountNameException(string reason) : base($"Invalid account name: {reason}")
    {
        Reason = reason;
    }
}
```

`Lovecraft/Lovecraft.Backend/Services/AccountNameTakenException.cs`:

```csharp
namespace Lovecraft.Backend.Services;

public class AccountNameTakenException : Exception
{
    public AccountNameTakenException() : base("Account name is already taken.") { }
}
```

- [ ] **Step 2: Add the `AccountNameDisplay` column to UserEntity**

In `Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs`, add this field next to the other identity fields (e.g. after `Email`):

```csharp
    /// <summary>Original-case account name as typed at registration. Empty for legacy GUID-userId rows.</summary>
    public string AccountNameDisplay { get; set; } = string.Empty;
```

- [ ] **Step 3: Add `AccountName` to the four register DTOs and `UserInfo`**

In `Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs`:

Add to `RegisterRequestDto` (after `Email`):
```csharp
    public string AccountName { get; set; } = string.Empty;
```

Add to `TelegramRegisterRequestDto` (after `Ticket`):
```csharp
    public string AccountName { get; set; } = string.Empty;
```

Add to `TelegramMiniAppRegisterRequestDto` (after `InitData`):
```csharp
    public string AccountName { get; set; } = string.Empty;
```

Add to `GoogleRegisterRequestDto` (after `Ticket`, with the existing data-annotation style):
```csharp
    [Required] public string AccountName { get; set; } = string.Empty;
```

Add to `UserInfo`:
```csharp
    public string? AccountName { get; set; }
```

Add a new DTO at the bottom of the file:
```csharp
/// <summary>Result of <c>GET /auth/account-name-availability</c>.</summary>
public class AccountNameAvailabilityDto
{
    public bool Available { get; set; }
    /// <summary>One of "invalidFormat" | "reserved" | "taken"; null when Available.</summary>
    public string? Reason { get; set; }
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
dotnet build D:/src/lovecraft/Lovecraft/Lovecraft.slnx
```

Expected: BUILD SUCCESS (only the contract additions; no behaviour changed yet).

- [ ] **Step 5: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/InvalidAccountNameException.cs Lovecraft/Lovecraft.Backend/Services/AccountNameTakenException.cs Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs
git -C D:/src/lovecraft commit -m "feat(auth): add account-name DTO field + UserEntity column + exceptions"
```

---

## Phase 2 — Availability endpoint

### Task 3: CheckAccountNameAvailabilityAsync service method

Implement on `IAuthService`, both `AzureAuthService` and `MockAuthService`.

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/IAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs` (extend with availability cases)

- [ ] **Step 1: Write failing tests in AuthenticationTests.cs**

Append these test methods to the existing `AuthenticationTests` class. They exercise the mock implementation through the full DI graph (via the existing `WebApplicationFactory<Program>` setup):

```csharp
    [Fact]
    public async Task CheckAccountName_AvailableForFreshName()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/auth/account-name-availability?name=fresh_user_001");
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AccountNameAvailabilityDto>>();
        Assert.True(dto!.Success);
        Assert.True(dto.Data!.Available);
        Assert.Null(dto.Data.Reason);
    }

    [Fact]
    public async Task CheckAccountName_RejectsInvalidFormat()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/auth/account-name-availability?name=ab");
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AccountNameAvailabilityDto>>();
        Assert.True(dto!.Success);
        Assert.False(dto.Data!.Available);
        Assert.Equal("invalidFormat", dto.Data.Reason);
    }

    [Fact]
    public async Task CheckAccountName_RejectsReserved()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/auth/account-name-availability?name=admin");
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AccountNameAvailabilityDto>>();
        Assert.True(dto!.Success);
        Assert.False(dto.Data!.Available);
        Assert.Equal("reserved", dto.Data.Reason);
    }
```

(Note: the controller endpoint is added in Task 4; these tests will compile but 404 until then. That's fine — they fail for the right reason after step 2 below, then pass after Task 4.)

- [ ] **Step 2: Add the method to IAuthService**

In `Lovecraft/Lovecraft.Backend/Services/IAuthService.cs`, add to the interface:

```csharp
    /// <summary>Returns availability of a chosen account name. See AccountNameAvailabilityDto for reason codes.</summary>
    Task<AccountNameAvailabilityDto> CheckAccountNameAvailabilityAsync(string name);
```

- [ ] **Step 3: Implement in AzureAuthService**

Add to `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs` (near the other public methods; recommend after `LoginAsync`):

```csharp
    public async Task<AccountNameAvailabilityDto> CheckAccountNameAvailabilityAsync(string name)
    {
        var validation = AccountNameValidator.Validate(name);
        if (validation == AccountNameValidationResult.InvalidFormat)
            return new AccountNameAvailabilityDto { Available = false, Reason = "invalidFormat" };
        if (validation == AccountNameValidationResult.Reserved)
            return new AccountNameAvailabilityDto { Available = false, Reason = "reserved" };

        var canonical = AccountNameValidator.Normalize(name);
        var partitionKey = UserEntity.GetPartitionKey(canonical);
        try
        {
            await _usersTable.GetEntityAsync<UserEntity>(partitionKey, canonical);
            return new AccountNameAvailabilityDto { Available = false, Reason = "taken" };
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
        {
            return new AccountNameAvailabilityDto { Available = true };
        }
    }
```

Add `using Lovecraft.Backend.Helpers;` at the top of the file if not present.

- [ ] **Step 4: Implement in MockAuthService**

Add to `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs` (near `LoginAsync`):

```csharp
    public Task<AccountNameAvailabilityDto> CheckAccountNameAvailabilityAsync(string name)
    {
        var validation = AccountNameValidator.Validate(name);
        if (validation == AccountNameValidationResult.InvalidFormat)
            return Task.FromResult(new AccountNameAvailabilityDto { Available = false, Reason = "invalidFormat" });
        if (validation == AccountNameValidationResult.Reserved)
            return Task.FromResult(new AccountNameAvailabilityDto { Available = false, Reason = "reserved" });

        var canonical = AccountNameValidator.Normalize(name);
        var taken = _users.Values.Any(u => string.Equals(u.Id, canonical, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(taken
            ? new AccountNameAvailabilityDto { Available = false, Reason = "taken" }
            : new AccountNameAvailabilityDto { Available = true });
    }
```

Add `using Lovecraft.Backend.Helpers;` at top if not present.

- [ ] **Step 5: Verify the build**

```bash
dotnet build D:/src/lovecraft/Lovecraft/Lovecraft.slnx
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/IAuthService.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): IAuthService.CheckAccountNameAvailabilityAsync (azure + mock)"
```

---

### Task 4: AuthController availability endpoint

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`

- [ ] **Step 1: Add the action**

In `AuthController.cs`, find the existing actions and add a new one near `GetRegistrationConfig`:

```csharp
    [HttpGet("account-name-availability")]
    [AllowAnonymous]
    [EnableRateLimiting("AuthRateLimit")]
    public async Task<IActionResult> CheckAccountNameAvailability([FromQuery] string name)
    {
        var result = await _authService.CheckAccountNameAvailabilityAsync(name ?? string.Empty);
        return Ok(ApiResponse<AccountNameAvailabilityDto>.SuccessResponse(result));
    }
```

(Use whichever `ApiResponse` factory pattern the existing endpoints use — copy it from one of the neighboring actions in the same controller.)

- [ ] **Step 2: Run the previously-written tests**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~AuthenticationTests.CheckAccountName"
```

Expected: PASS (all 3 cases).

- [ ] **Step 3: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs
git -C D:/src/lovecraft commit -m "feat(auth): GET /auth/account-name-availability endpoint"
```

---

## Phase 3 — Wire account-name into all four register paths

### Task 5: Local register (Azure + Mock)

Switch `RegisterAsync` to use the account name as `userId`, validate format, race-safe insert.

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs` (exception mapping)
- Modify: `Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs`

- [ ] **Step 1: Write failing tests**

Append to `AuthenticationTests.cs`:

```csharp
    [Fact]
    public async Task Register_UsesAccountNameAsUserId()
    {
        using var client = _factory.CreateClient();
        var body = new {
            email = "newalice@example.com",
            password = "Test123!@#",
            accountName = "newAlice99",
            name = "Alice",
            age = 22,
            country = "RU",
            gender = "female",
        };
        var resp = await client.PostAsJsonAsync("/api/v1/auth/register", body);
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.True(dto!.Success, dto.Error?.Message);
        Assert.Equal("newalice99", dto.Data!.User.Id);
        Assert.Equal("newAlice99", dto.Data.User.AccountName);
    }

    [Fact]
    public async Task Register_RejectsInvalidAccountName()
    {
        using var client = _factory.CreateClient();
        var body = new {
            email = "x@example.com", password = "Test123!@#",
            accountName = "ab", name = "X", age = 22, country = "RU", gender = "male",
        };
        var resp = await client.PostAsJsonAsync("/api/v1/auth/register", body);
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.False(dto!.Success);
        Assert.Equal("INVALID_ACCOUNT_NAME", dto.Error!.Code);
    }

    [Fact]
    public async Task Register_RejectsTakenAccountName()
    {
        using var client = _factory.CreateClient();
        // First registration — claims "duplicateClaim".
        await client.PostAsJsonAsync("/api/v1/auth/register", new {
            email = "first@example.com", password = "Test123!@#",
            accountName = "duplicateClaim", name = "First", age = 22, country = "RU", gender = "male",
        });
        // Second attempt with the same account name.
        var resp = await client.PostAsJsonAsync("/api/v1/auth/register", new {
            email = "second@example.com", password = "Test123!@#",
            accountName = "duplicateClaim", name = "Second", age = 22, country = "RU", gender = "female",
        });
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.False(dto!.Success);
        Assert.Equal("ACCOUNT_NAME_TAKEN", dto.Error!.Code);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~AuthenticationTests.Register_"
```

Expected: FAIL (the new fields are ignored; `Id` is still a GUID; no validation).

- [ ] **Step 3: Update `AzureAuthService.RegisterAsync`**

In `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`, modify `RegisterAsync`. Replace the existing body so that:

1. Account name is validated before any DB work.
2. `userId` = `AccountNameValidator.Normalize(request.AccountName)`.
3. `userEntity.AccountNameDisplay = request.AccountName.Trim()`.
4. The two writes are sequenced (users first, then email index) — both `AddEntityAsync`.
5. 409 from users → `AccountNameTakenException`. 409 from email index → existing behaviour (`null` return, with users-row cleanup).
6. `UserInfo.AccountName = userEntity.AccountNameDisplay` in the response.

Concretely, replace the section between the existing email-index pre-check and the `_logger.LogInformation("User registered…")` line with:

```csharp
        // Validate account name FIRST so we fail fast before any I/O.
        var nameValidation = AccountNameValidator.Validate(request.AccountName);
        if (nameValidation == AccountNameValidationResult.InvalidFormat)
            throw new InvalidAccountNameException("invalidFormat");
        if (nameValidation == AccountNameValidationResult.Reserved)
            throw new InvalidAccountNameException("reserved");

        var userId = AccountNameValidator.Normalize(request.AccountName);
        var now = DateTime.UtcNow;

        var userEntity = new UserEntity
        {
            PartitionKey = UserEntity.GetPartitionKey(userId),
            RowKey = userId,
            AccountNameDisplay = request.AccountName.Trim(),
            Email = request.Email,
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            Name = request.Name,
            Age = request.Age ?? 0,
            Country = request.Country ?? string.Empty,
            Region = request.Region ?? string.Empty,
            SecondaryCountry = request.SecondaryCountry ?? string.Empty,
            SecondaryRegion = request.SecondaryRegion ?? string.Empty,
            Gender = NormalizeGender(request.Gender),
            Bio = request.Bio,
            EmailVerified = false,
            AuthMethodsJson = JsonSerializer.Serialize(new List<string> { "local" }),
            PreferencesJson = JsonSerializer.Serialize(new { AgeRangeMin = 18, AgeRangeMax = 65, MaxDistance = 50, ShowMe = "everyone" }),
            SettingsJson = JsonSerializer.Serialize(new { ProfileVisibility = "public", AnonymousLikes = false, Language = "ru", Notifications = true }),
            CreatedAt = now,
            UpdatedAt = now,
            IsOnline = false,
            LastSeen = now,
            RegistrationSourceEventId = sourceEventId,
            RegistrationSourceRedeemedAtUtc = sourceEventId is not null ? DateTime.UtcNow : null,
        };

        var emailIndexEntity = new UserEmailIndexEntity
        {
            PartitionKey = emailLower,
            RowKey = "INDEX",
            UserId = userId
        };

        // Users first — wins/loses the account-name race atomically.
        try
        {
            await _usersTable.AddEntityAsync(userEntity);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            _logger.LogWarning("Registration failed: account name already taken {AccountName}", request.AccountName);
            throw new AccountNameTakenException();
        }

        // Then email index — already pre-checked; 409 here would be a near-impossible race.
        try
        {
            await _emailIndexTable.AddEntityAsync(emailIndexEntity);
            _userCache.Set(userEntity);

            if (sourceEventId is not null && !EventInviteHelpers.IsCampaignEventId(sourceEventId))
                await _events.RegisterForEventAsync(userId, sourceEventId);

            if (!string.IsNullOrWhiteSpace(request.InviteCode))
                await _eventInvites.IncrementRegistrationCountAsync(request.InviteCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration failed after users-row write for {Email}", request.Email);
            _userCache.Remove(userId);
            try { await _usersTable.DeleteEntityAsync(userEntity.PartitionKey, userId); } catch { /* ignore */ }
            try { await _emailIndexTable.DeleteEntityAsync(emailLower, "INDEX"); } catch { /* ignore */ }
            throw;
        }
```

Also update the final `return new AuthResponseDto { … User = new UserInfo { … } … }` to include:

```csharp
                AccountName = userEntity.AccountNameDisplay,
```

inside the `User = new UserInfo { … }` initializer.

- [ ] **Step 4: Update `MockAuthService.RegisterAsync`**

In `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`, modify `RegisterAsync` similarly:

```csharp
        // Validate account name first.
        var nameValidation = AccountNameValidator.Validate(request.AccountName);
        if (nameValidation == AccountNameValidationResult.InvalidFormat)
            throw new InvalidAccountNameException("invalidFormat");
        if (nameValidation == AccountNameValidationResult.Reserved)
            throw new InvalidAccountNameException("reserved");

        var userId = AccountNameValidator.Normalize(request.AccountName);
        if (_users.Values.Any(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase)))
            throw new AccountNameTakenException();
```

(Place this block right after the existing email collision check and before the existing `Guid.NewGuid()` line, which you then delete. Replace `var userId = Guid.NewGuid().ToString();` with `// userId already set above`.)

In the user construction, add `AccountNameDisplay = request.AccountName.Trim()` to the `MockUser` initializer. (If `MockUser` doesn't have that field yet, add it as a default-empty string.)

Update `IssueJwtPairAsync` / the constructor of `UserInfo` to set `AccountName = user.AccountNameDisplay` wherever `UserInfo` is built in this file. Search the file for `new UserInfo` and add the field in each occurrence.

- [ ] **Step 5: Add `AccountNameDisplay` to MockUser**

Find `MockUser` (likely in `Lovecraft/Lovecraft.Backend/MockData/` or as a private class in `MockAuthService.cs`):

```csharp
    public string AccountNameDisplay { get; set; } = string.Empty;
```

Add adjacent to `Id`.

- [ ] **Step 6: Map the exceptions in AuthController**

In `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`, locate the `Register` action's exception handling. Add to the catch block (or add new catch blocks) before the existing `InvalidInviteCodeException` / `InviteRequiredException` handlers:

```csharp
        catch (InvalidAccountNameException ex)
        {
            return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse("INVALID_ACCOUNT_NAME", $"Invalid account name: {ex.Reason}"));
        }
        catch (AccountNameTakenException)
        {
            return Conflict(ApiResponse<AuthResponseDto>.ErrorResponse("ACCOUNT_NAME_TAKEN", "Account name is already taken."));
        }
```

(Match the exact `ApiResponse` static helper signatures already in use — copy from existing exception handlers in the file.)

- [ ] **Step 7: Run tests to verify they pass**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~AuthenticationTests.Register_"
```

Expected: PASS (3 new cases plus the existing register tests still passing).

- [ ] **Step 8: Run the full auth test class to confirm no regressions**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~AuthenticationTests"
```

Expected: ALL PASS.

- [ ] **Step 9: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/MockData Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): account name as userId on local register (azure + mock)"
```

---

### Task 6: Telegram register (Azure + Mock)

Same pattern for `TelegramRegisterAsync`.

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs` (exception mapping if the action has its own try/catch)
- Modify: `Lovecraft/Lovecraft.UnitTests/TelegramPendingFlowTests.cs`

- [ ] **Step 1: Write a failing test**

Append to `TelegramPendingFlowTests.cs`:

```csharp
    [Fact]
    public async Task TelegramRegister_UsesAccountNameAsUserId()
    {
        using var client = _factory.CreateClient();
        var ticket = MintTelegramTicket(_factory, telegramId: 99777, firstName: "Alice");
        var resp = await client.PostAsJsonAsync("/api/v1/auth/telegram-register", new {
            ticket,
            accountName = "tgAlice99",
            name = "Alice", age = 22, country = "RU", gender = "female",
        });
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.True(dto!.Success, dto.Error?.Message);
        Assert.Equal("tgalice99", dto.Data!.User.Id);
        Assert.Equal("tgAlice99", dto.Data.User.AccountName);
    }
```

If `MintTelegramTicket` doesn't exist as a helper, copy the existing ticket-minting pattern from another test in the same file.

- [ ] **Step 2: Run to verify it fails**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~TelegramPendingFlowTests.TelegramRegister_UsesAccountNameAsUserId"
```

Expected: FAIL.

- [ ] **Step 3: Update AzureAuthService.TelegramRegisterAsync**

In the existing method, immediately after the ticket validation block, add:

```csharp
        var nameValidation = AccountNameValidator.Validate(request.AccountName);
        if (nameValidation == AccountNameValidationResult.InvalidFormat)
            throw new InvalidAccountNameException("invalidFormat");
        if (nameValidation == AccountNameValidationResult.Reserved)
            throw new InvalidAccountNameException("reserved");
```

Replace `var userId = Guid.NewGuid().ToString();` with:

```csharp
        var userId = AccountNameValidator.Normalize(request.AccountName);
```

In the `userEntity` initializer, add:

```csharp
            AccountNameDisplay = request.AccountName.Trim(),
```

Change `_usersTable.UpsertEntityAsync(userEntity)` to `_usersTable.AddEntityAsync(userEntity)`. The existing telegram-index `AddEntityAsync` race-protection stays — but we now also need a race rollback if the users insert is the one that loses.

Replace the existing `try { await Task.WhenAll(_usersTable.UpsertEntityAsync(userEntity), _emailIndexTable.UpsertEntityAsync(emailIndexEntity)); … } catch (Exception signupEx) { … }` block with:

```csharp
        try
        {
            await _usersTable.AddEntityAsync(userEntity);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            // Roll back the tg index we just claimed.
            try { await _telegramIndexTable.DeleteEntityAsync(tgKey, "INDEX"); } catch { /* ignore */ }
            throw new AccountNameTakenException();
        }

        try
        {
            await _emailIndexTable.AddEntityAsync(emailIndexEntity);
            _userCache.Set(userEntity);

            if (sourceEventId is not null && !EventInviteHelpers.IsCampaignEventId(sourceEventId))
                await _events.RegisterForEventAsync(userId, sourceEventId);

            if (!string.IsNullOrWhiteSpace(request.InviteCode))
                await _eventInvites.IncrementRegistrationCountAsync(request.InviteCode);
        }
        catch (Exception signupEx)
        {
            _logger.LogError(signupEx, "Telegram register failed after users write for tg {TgId}", tgKey);
            _userCache.Remove(userId);
            try { await _telegramIndexTable.DeleteEntityAsync(tgKey, "INDEX"); } catch { /* ignore */ }
            try { await _emailIndexTable.DeleteEntityAsync(emailLower, "INDEX"); } catch { /* ignore */ }
            try { await _usersTable.DeleteEntityAsync(userEntity.PartitionKey, userId); } catch { /* ignore */ }
            throw;
        }
```

In the response (`return await IssueJwtPairAsync(userEntity)`), the `IssueJwtPairAsync` method must populate `UserInfo.AccountName`. Open that method and add:

```csharp
                AccountName = userEntity.AccountNameDisplay,
```

inside the `User = new UserInfo { … }` initializer (do this once; it benefits every flow that calls `IssueJwtPairAsync`).

- [ ] **Step 4: Update MockAuthService.TelegramRegisterAsync**

Apply analogous validation + replace `Guid.NewGuid()` userId + add `AccountNameDisplay`. Translation:

```csharp
        var nameValidation = AccountNameValidator.Validate(request.AccountName);
        if (nameValidation == AccountNameValidationResult.InvalidFormat)
            throw new InvalidAccountNameException("invalidFormat");
        if (nameValidation == AccountNameValidationResult.Reserved)
            throw new InvalidAccountNameException("reserved");

        var userId = AccountNameValidator.Normalize(request.AccountName);
        if (_users.Values.Any(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase)))
            throw new AccountNameTakenException();
```

Add `AccountNameDisplay = request.AccountName.Trim()` to the MockUser initializer in this method.

- [ ] **Step 5: Map exceptions in AuthController.TelegramRegister**

Find the `TelegramRegister` action and add the same exception-to-status-code mapping as Task 5 step 6 (catch `InvalidAccountNameException` → 400 / `AccountNameTakenException` → 409).

- [ ] **Step 6: Run the test**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~TelegramPendingFlowTests"
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.UnitTests/TelegramPendingFlowTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): account name on /telegram-register"
```

---

### Task 7: Mini App register

`MiniAppRegisterAsync` bridges to `TelegramRegisterAsync` — just pass the field through.

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/TelegramMiniAppFlowTests.cs`

- [ ] **Step 1: Write a failing test**

Append to `TelegramMiniAppFlowTests.cs`:

```csharp
    [Fact]
    public async Task MiniAppRegister_UsesAccountNameAsUserId()
    {
        using var client = _factory.CreateClient();
        var initData = MintMiniAppInitData(_factory, telegramId: 88555, firstName: "Mia");
        var resp = await client.PostAsJsonAsync("/api/v1/auth/telegram-miniapp-register", new {
            initData,
            accountName = "miniMia55",
            name = "Mia", age = 23, country = "RU", gender = "female",
        });
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.True(dto!.Success, dto.Error?.Message);
        Assert.Equal("minimia55", dto.Data!.User.Id);
        Assert.Equal("miniMia55", dto.Data.User.AccountName);
    }
```

(If a helper to mint Mini App initData doesn't exist, copy from an existing test in the same file.)

- [ ] **Step 2: Run to verify it fails**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~TelegramMiniAppFlowTests.MiniAppRegister_UsesAccountNameAsUserId"
```

Expected: FAIL.

- [ ] **Step 3: Wire `AccountName` through in AzureAuthService.MiniAppRegisterAsync**

Find the line in `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`:

```csharp
return await TelegramRegisterAsync(new TelegramRegisterRequestDto
{
    Ticket = ticket,
    Name = request.Name,
    …
```

Add the field:

```csharp
    AccountName = request.AccountName,
```

(Place adjacent to `Ticket`.)

- [ ] **Step 4: Wire `AccountName` through in MockAuthService.MiniAppRegisterAsync**

Same change in `MockAuthService.cs` — find the bridge call and add `AccountName = request.AccountName,` to the `TelegramRegisterRequestDto` initializer.

- [ ] **Step 5: Map exceptions in AuthController.MiniAppRegister**

Add the same exception mapping (InvalidAccountNameException → 400, AccountNameTakenException → 409) to the `MiniAppRegister` action.

- [ ] **Step 6: Run the test**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~TelegramMiniAppFlowTests"
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.UnitTests/TelegramMiniAppFlowTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): account name on /telegram-miniapp-register"
```

---

### Task 8: Google register (Azure + Mock)

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/GooglePendingFlowTests.cs`

- [ ] **Step 1: Write a failing test**

Append to `GooglePendingFlowTests.cs`:

```csharp
    [Fact]
    public async Task GoogleRegister_UsesAccountNameAsUserId()
    {
        using var client = _factory.CreateClient();
        var ticket = MintGoogleTicket(_factory, sub: "gsub-555", email: "gus@example.com", name: "Gus");
        var resp = await client.PostAsJsonAsync("/api/v1/auth/google-register", new {
            ticket,
            accountName = "googleGus5",
            name = "Gus", age = 25, country = "RU", gender = "male",
        });
        var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        Assert.True(dto!.Success, dto.Error?.Message);
        Assert.Equal("googlegus5", dto.Data!.User.Id);
        Assert.Equal("googleGus5", dto.Data.User.AccountName);
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~GooglePendingFlowTests.GoogleRegister_UsesAccountNameAsUserId"
```

Expected: FAIL.

- [ ] **Step 3: Update AzureAuthService.GoogleRegisterAsync**

Same pattern as Task 6:

1. Validate account name right after ticket validation.
2. Replace `Guid.NewGuid()` userId with `AccountNameValidator.Normalize(request.AccountName)`.
3. Add `AccountNameDisplay = request.AccountName.Trim()` to the `userEntity` initializer.
4. Switch users-table write to `AddEntityAsync`. On 409, roll back the google-index row we already wrote, then throw `AccountNameTakenException`.

Concretely, after the `_googleIndexTable.AddEntityAsync(googleIndexEntity)` block, replace the `Task.WhenAll(_usersTable.UpsertEntityAsync(...), _emailIndexTable.AddEntityAsync(...))` block with:

```csharp
        try
        {
            await _usersTable.AddEntityAsync(userEntity);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            _logger.LogWarning("Google register: account name {AccountName} already taken", request.AccountName);
            try { await _googleIndexTable.DeleteEntityAsync(gInfo.Sub, "INDEX"); } catch { /* ignore */ }
            throw new AccountNameTakenException();
        }

        try
        {
            await _emailIndexTable.AddEntityAsync(emailIndexEntity);

            if (sourceEventId is not null && !EventInviteHelpers.IsCampaignEventId(sourceEventId))
                await _events.RegisterForEventAsync(userId, sourceEventId);

            if (!string.IsNullOrWhiteSpace(request.InviteCode))
                await _eventInvites.IncrementRegistrationCountAsync(request.InviteCode);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            _logger.LogWarning("Google register: email index conflict for {Email}", emailLower);
            _userCache.Remove(userId);
            try { await _googleIndexTable.DeleteEntityAsync(gInfo.Sub, "INDEX"); } catch { /* */ }
            try { await _usersTable.DeleteEntityAsync(userEntity.PartitionKey, userId); } catch { /* */ }
            return null;
        }
        catch (Exception signupEx)
        {
            _logger.LogError(signupEx, "Google register failed after users write for sub {Sub}", gInfo.Sub);
            _userCache.Remove(userId);
            try { await _googleIndexTable.DeleteEntityAsync(gInfo.Sub, "INDEX"); } catch { /* */ }
            try { await _emailIndexTable.DeleteEntityAsync(emailLower, "INDEX"); } catch { /* */ }
            try { await _usersTable.DeleteEntityAsync(userEntity.PartitionKey, userId); } catch { /* */ }
            throw;
        }
```

- [ ] **Step 4: Update MockAuthService.GoogleRegisterAsync**

Apply the same account-name validation + userId replacement + `AccountNameDisplay` set.

- [ ] **Step 5: Map exceptions in AuthController.GoogleRegister**

Add `InvalidAccountNameException` and `AccountNameTakenException` catches.

- [ ] **Step 6: Run all auth-related tests**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~Authentication|FullyQualifiedName~Pending|FullyQualifiedName~MiniApp"
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft/Lovecraft.UnitTests/GooglePendingFlowTests.cs
git -C D:/src/lovecraft commit -m "feat(auth): account name on /google-register"
```

---

## Phase 4 — Public user lookup by account name

### Task 9: GET /users/by-account-name/{name}

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockUserService.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Services/IServices.cs` (or wherever `IUserService` is defined)
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs`
- Modify: `Lovecraft/Lovecraft.UnitTests/AzureUserServiceTests.cs`

- [ ] **Step 1: Add method to IUserService**

Find `IUserService` (in `IServices.cs` per the existing folder layout). Add:

```csharp
    /// <summary>
    /// Find a user by account name (case-insensitive). Returns null if the name is invalid,
    /// no user has that name, or the matched row is a legacy GUID-userId row (i.e. AccountNameDisplay is empty).
    /// </summary>
    Task<UserDto?> GetUserByAccountNameAsync(string accountName);
```

- [ ] **Step 2: Implement in AzureUserService**

In `AzureUserService.cs`, add (place near `GetUserAsync`):

```csharp
    public async Task<UserDto?> GetUserByAccountNameAsync(string accountName)
    {
        if (AccountNameValidator.Validate(accountName) == AccountNameValidationResult.InvalidFormat)
            return null;
        var canonical = AccountNameValidator.Normalize(accountName);
        var partitionKey = UserEntity.GetPartitionKey(canonical);
        try
        {
            var resp = await _usersTable.GetEntityAsync<UserEntity>(partitionKey, canonical);
            var entity = resp.Value;
            // Legacy GUID-userId rows never have AccountNameDisplay set; refuse to leak them via this endpoint.
            if (string.IsNullOrEmpty(entity.AccountNameDisplay)) return null;
            return MapToDto(entity);  // use whatever existing entity-to-DTO mapper the service uses
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
```

(Inspect `AzureUserService.cs` for the exact entity-to-DTO mapping function name in use — it's typically `MapToDto` or similar. Use that.)

Add `using Lovecraft.Backend.Helpers;` if not present.

- [ ] **Step 3: Implement in MockUserService**

In `MockUserService.cs`:

```csharp
    public Task<UserDto?> GetUserByAccountNameAsync(string accountName)
    {
        if (AccountNameValidator.Validate(accountName) == AccountNameValidationResult.InvalidFormat)
            return Task.FromResult<UserDto?>(null);
        var canonical = AccountNameValidator.Normalize(accountName);
        var match = MockDataStore.Users.FirstOrDefault(u =>
            string.Equals(u.Id, canonical, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(u.AccountNameDisplay));
        return Task.FromResult(match is null ? null : MapMockUserToDto(match));
    }
```

(Inspect the existing mock service for the user-collection accessor and the mock-to-DTO mapper; use whatever pattern is already established.)

- [ ] **Step 4: Add the controller action**

In `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs`:

```csharp
    [HttpGet("by-account-name/{name}")]
    public async Task<IActionResult> GetByAccountName(string name)
    {
        var user = await _userService.GetUserByAccountNameAsync(name);
        if (user is null)
            return NotFound(ApiResponse<UserDto>.ErrorResponse("USER_NOT_FOUND", "User not found."));
        return Ok(ApiResponse<UserDto>.SuccessResponse(user));
    }
```

Use the existing `ApiResponse` static helper style from neighbouring actions in this controller.

- [ ] **Step 5: Write a test**

Append to `AzureUserServiceTests.cs` (or a similar existing file that tests user lookup against the mock factory; if `UsersControllerTests` exists, use that instead):

```csharp
    [Fact]
    public async Task GetByAccountName_FindsNewUserAfterRegister()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/v1/auth/register", new {
            email = "lookup@example.com", password = "Test123!@#",
            accountName = "lookupTarget",
            name = "Look", age = 22, country = "RU", gender = "male",
        });
        var resp = await client.GetAsync("/api/v1/users/by-account-name/lookupTarget");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task GetByAccountName_ReturnsNotFoundForUnknown()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/users/by-account-name/nobody_here_xx");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, resp.StatusCode);
    }
```

- [ ] **Step 6: Run tests**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests --filter "FullyQualifiedName~GetByAccountName"
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git -C D:/src/lovecraft add Lovecraft/Lovecraft.Backend/Services Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs Lovecraft/Lovecraft.UnitTests
git -C D:/src/lovecraft commit -m "feat(users): GET /users/by-account-name/{name}"
```

---

## Phase 5 — Frontend foundation

### Task 10: Mirror validators + reserved-name set

**Files:**
- Modify: `aloevera-harmony-meet/src/lib/validators.ts`
- Create: `aloevera-harmony-meet/src/lib/__tests__/validators.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { accountNameSchema } from '@/lib/validators';

describe('accountNameSchema', () => {
  it.each(['alice', 'alice99', 'Alice_Doe', 'a1234', 'abcdefghijklmnopqrstuvwxyz012345'])(
    'accepts valid name %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(true);
    });

  it.each(['', 'ab', 'abcd', '1alice', '_alice', 'alice-doe', 'alice.doe', 'alice doe', 'a'.repeat(33)])(
    'rejects invalid format %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(false);
    });

  it.each(['admin', 'ADMIN', 'aloevera', 'telegram', 'system'])(
    'rejects reserved name %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

From `D:\src\aloevera-harmony-meet`:

```bash
npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: FAIL (`accountNameSchema` not exported).

- [ ] **Step 3: Add the schema + reserved set**

In `D:\src\aloevera-harmony-meet\src\lib\validators.ts`, add near the top (after the `import` statements):

```ts
const ACCOUNT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
export const RESERVED_ACCOUNT_NAMES = new Set<string>([
  'admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
  'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
  'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
  'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot',
]);

export const accountNameSchema = z.string()
  .regex(ACCOUNT_NAME_RE, 'Invalid format')
  .refine((v) => !RESERVED_ACCOUNT_NAMES.has(v.toLowerCase()), 'Reserved name');
```

Then extend the existing register schemas — modify each `z.object({ ... })` to include `accountName: accountNameSchema`:

```ts
export const registerSchema = z.object({
  accountName: accountNameSchema,
  email: z.string().email('Enter a valid email'),
  // ... rest unchanged
});
```

```ts
export const telegramRegisterSchema = z.object({
  accountName: accountNameSchema,
  name: z.string().min(1, 'Name is required'),
  // ... rest unchanged
});
```

(`googleRegisterSchema` already aliases `telegramRegisterSchema`, so it inherits automatically. Same for the `*WithInvite` variants — they `extend` the base.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/lib/validators.ts src/lib/__tests__/validators.test.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(validators): add accountNameSchema + reserved set"
```

---

### Task 11: API types + authApi methods + usersApi method

**Files:**
- Modify: `aloevera-harmony-meet/src/services/api/authApi.ts`
- Modify: `aloevera-harmony-meet/src/services/api/usersApi.ts`

- [ ] **Step 1: Extend the request DTO types in authApi.ts**

Add `accountName: string` to:
- `RegisterRequest` interface (after `email`)
- `TelegramRegisterRequest` interface (after `ticket`)
- `TelegramMiniAppRegisterRequest` interface (after `initData`)
- `GoogleRegisterRequest` interface (after `ticket`)

Add `accountName?: string` to the `user` shape inside `AuthResponse`:

```ts
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    accountName?: string;
    emailVerified: boolean;
    authMethods: string[];
    profileImage: string;
  };
  expiresAt: string;
}
```

- [ ] **Step 2: Add the availability check method**

In `authApi.ts`, alongside the other `authApi` methods, add:

```ts
  async checkAccountNameAvailability(name: string): Promise<{ available: boolean; reason?: 'invalidFormat' | 'reserved' | 'taken' }> {
    if (isApiMode()) {
      const resp = await apiClient.get<{ available: boolean; reason?: 'invalidFormat' | 'reserved' | 'taken' }>(
        `/api/v1/auth/account-name-availability?name=${encodeURIComponent(name)}`
      );
      if (resp.success && resp.data) return resp.data;
      return { available: false, reason: 'invalidFormat' };
    }

    // Mock implementation: format check, reserved check, then mockUsers collision check.
    await new Promise((r) => setTimeout(r, 150));
    const RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
    if (!RE.test(name)) return { available: false, reason: 'invalidFormat' };
    const reserved = new Set(['admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
      'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
      'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
      'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot']);
    if (reserved.has(name.toLowerCase())) return { available: false, reason: 'reserved' };
    const taken = mockUsers.some(u => (u.accountName ?? '').toLowerCase() === name.toLowerCase());
    return taken ? { available: false, reason: 'taken' } : { available: true };
  },
```

(`mockUsers` should already be imported at the top of the file; if not, `import { mockUsers } from '@/data/mockUsers';`.)

- [ ] **Step 3: Add `getUserByAccountName` to usersApi**

In `usersApi.ts`, add (mirroring the existing `getUserById` shape):

```ts
  async getUserByAccountName(accountName: string) {
    if (isApiMode()) {
      return apiClient.get<User>(`/api/v1/users/by-account-name/${encodeURIComponent(accountName)}`);
    }
    await new Promise((r) => setTimeout(r, 150));
    const user = mockUsers.find(u => (u.accountName ?? '').toLowerCase() === accountName.toLowerCase());
    if (!user) {
      return {
        success: false as const,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true as const,
      data: user,
      timestamp: new Date().toISOString(),
    };
  },
```

(Match the exact return-envelope shape used by `getUserById` — copy from that method.)

- [ ] **Step 4: Run the dev build to type-check**

```bash
cd D:/src/aloevera-harmony-meet && npx tsc --noEmit
```

Expected: 0 errors (will be 0 once Task 12 extends `User`, but this step alone should also succeed because the field on the request types is just `string`).

- [ ] **Step 5: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/services/api/authApi.ts src/services/api/usersApi.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(api): account-name request fields + availability + by-account-name lookup"
```

---

### Task 12: User type + mock data

**Files:**
- Modify: `aloevera-harmony-meet/src/types/user.ts`
- Modify: `aloevera-harmony-meet/src/data/mockUsers.ts`
- Modify: `aloevera-harmony-meet/src/data/mockProfiles.ts` (if mockProfiles also has user-shaped objects)

- [ ] **Step 1: Add `accountName?` to the User type**

In `src/types/user.ts`, find the `User` interface. Add:

```ts
  accountName?: string;
```

- [ ] **Step 2: Add `accountName` to each mock user**

In `src/data/mockUsers.ts`, add an `accountName` field to each user object. Stable values:

- user-1 → `accountName: 'alice99'`
- user-2 → `accountName: 'boris_p'`
- user-3 → (whatever the third user's name suggests, e.g. `accountName: 'masha_v'`)
- user-4 → similar

Add `accountName` for any additional mock users present.

If `mockProfiles.ts` also contains user-shaped objects exposed via `getUserById`, give those `accountName` values too (matching by `id` to mockUsers if duplicated, otherwise unique).

- [ ] **Step 3: Type-check**

```bash
cd D:/src/aloevera-harmony-meet && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/types/user.ts src/data/mockUsers.ts src/data/mockProfiles.ts
git -C D:/src/aloevera-harmony-meet commit -m "feat(data): User.accountName field + mockUsers handles"
```

---

## Phase 6 — Frontend shared input

### Task 13: <AccountNameInput> component

**Files:**
- Create: `aloevera-harmony-meet/src/components/ui/account-name-input.tsx`
- Create: `aloevera-harmony-meet/src/components/ui/__tests__/account-name-input.test.tsx`

- [ ] **Step 1: Write failing tests**

Create the test file:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountNameInput } from '@/components/ui/account-name-input';
import * as api from '@/services/api/authApi';

vi.mock('@/services/api/authApi', async () => {
  const actual = await vi.importActual<typeof api>('@/services/api/authApi');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      checkAccountNameAvailability: vi.fn(),
    },
  };
});

describe('<AccountNameInput>', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders an input', () => {
    render(<AccountNameInput value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows "available" for a valid free name (after debounce)', async () => {
    (api.authApi.checkAccountNameAvailability as any).mockResolvedValue({ available: true });
    const onValid = vi.fn();
    render(<AccountNameInput value="" onChange={() => {}} onValidityChange={onValid} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'free_name' } });
    await waitFor(() => expect(api.authApi.checkAccountNameAvailability).toHaveBeenCalledWith('free_name'), { timeout: 1500 });
    await waitFor(() => expect(onValid).toHaveBeenCalledWith(true));
  });

  it('shows "taken" reason', async () => {
    (api.authApi.checkAccountNameAvailability as any).mockResolvedValue({ available: false, reason: 'taken' });
    render(<AccountNameInput value="" onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'taken_name' } });
    await waitFor(() => expect(screen.getByText(/taken/i)).toBeInTheDocument(), { timeout: 1500 });
  });

  it('skips the API call when the format is invalid', async () => {
    render(<AccountNameInput value="" onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } });
    await new Promise(r => setTimeout(r, 600));
    expect(api.authApi.checkAccountNameAvailability).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failing**

```bash
cd D:/src/aloevera-harmony-meet && npx vitest run src/components/ui/__tests__/account-name-input.test.tsx
```

Expected: FAIL — `AccountNameInput` doesn't exist.

- [ ] **Step 3: Implement the component**

Create `D:\src\aloevera-harmony-meet\src\components\ui\account-name-input.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi } from '@/services/api/authApi';
import { Check, Loader2, X } from 'lucide-react';

type Status = 'idle' | 'checking' | 'available' | 'invalidFormat' | 'reserved' | 'taken';

interface AccountNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  prefillSuggestion?: string;
  id?: string;
}

const FORMAT_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const RESERVED = new Set([
  'admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
  'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
  'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
  'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot',
]);

export function AccountNameInput({
  value, onChange, onValidityChange, disabled, prefillSuggestion, id = 'accountName',
}: AccountNameInputProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const prefillApplied = useRef(false);

  // Prefill once if empty.
  useEffect(() => {
    if (!prefillApplied.current && !value && prefillSuggestion) {
      const sanitized = prefillSuggestion.replace(/[^A-Za-z0-9_]/g, '');
      if (FORMAT_RE.test(sanitized)) onChange(sanitized);
      prefillApplied.current = true;
    }
  }, [prefillSuggestion, value, onChange]);

  // Debounced live check.
  useEffect(() => {
    onValidityChange?.(false);
    if (!value) { setStatus('idle'); return; }
    if (!FORMAT_RE.test(value)) { setStatus('invalidFormat'); return; }
    if (RESERVED.has(value.toLowerCase())) { setStatus('reserved'); return; }

    setStatus('checking');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await authApi.checkAccountNameAvailability(value);
        if (abortRef.current?.signal.aborted) return;
        if (result.available) {
          setStatus('available');
          onValidityChange?.(true);
        } else {
          setStatus((result.reason ?? 'taken') as Status);
        }
      } catch {
        setStatus('idle');
      }
    }, 400);
    return () => { clearTimeout(timer); abortRef.current?.abort(); };
  }, [value, onValidityChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white font-medium">{t('auth.accountName')} *</Label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={t('auth.accountNamePlaceholder')}
        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
      />
      <p className="text-xs text-white/60">{t('auth.accountNameHint')}</p>
      <StatusRow status={status} t={t} />
    </div>
  );
}

function StatusRow({ status, t }: { status: Status; t: (k: string) => string }) {
  if (status === 'idle') return null;
  if (status === 'checking') return (
    <p className="text-xs text-white/70 flex items-center gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> {t('auth.accountNameChecking')}
    </p>
  );
  if (status === 'available') return (
    <p className="text-xs text-green-300 flex items-center gap-1">
      <Check className="w-3 h-3" /> {t('auth.accountNameAvailable')}
    </p>
  );
  const msgKey =
    status === 'invalidFormat' ? 'auth.accountNameInvalid' :
    status === 'reserved' ? 'auth.accountNameReserved' :
    'auth.accountNameTaken';
  return (
    <p role="alert" className="text-xs text-red-300 flex items-center gap-1">
      <X className="w-3 h-3" /> {t(msgKey)}
    </p>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/ui/__tests__/account-name-input.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/components/ui/account-name-input.tsx src/components/ui/__tests__/account-name-input.test.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(ui): <AccountNameInput> shared component"
```

---

### Task 14: i18n keys

**Files:**
- Modify: `aloevera-harmony-meet/src/contexts/LanguageContext.tsx`

- [ ] **Step 1: Add the keys**

In `LanguageContext.tsx`, add to both the `ru` and `en` translation objects.

English additions:
```ts
  'auth.accountName': 'Account name',
  'auth.accountNamePlaceholder': 'e.g. alice_99',
  'auth.accountNameHint': '5–32 letters, digits, or underscores. Must start with a letter.',
  'auth.accountNameAvailable': 'Available',
  'auth.accountNameTaken': 'This name is already taken',
  'auth.accountNameInvalid': 'Invalid format',
  'auth.accountNameReserved': 'This name is reserved',
  'auth.accountNameChecking': 'Checking…',
  'friends.findByHandle': 'Find by @handle',
  'friends.findByHandlePlaceholder': 'e.g. alice_99',
```

Russian additions:
```ts
  'auth.accountName': 'Логин',
  'auth.accountNamePlaceholder': 'например, alice_99',
  'auth.accountNameHint': '5–32 буквы, цифры или _, начинается с буквы',
  'auth.accountNameAvailable': 'Доступен',
  'auth.accountNameTaken': 'Этот логин уже занят',
  'auth.accountNameInvalid': 'Неверный формат',
  'auth.accountNameReserved': 'Это зарезервированный логин',
  'auth.accountNameChecking': 'Проверка…',
  'friends.findByHandle': 'Найти по @логину',
  'friends.findByHandlePlaceholder': 'например, alice_99',
```

- [ ] **Step 2: Type-check + dev server smoke test**

```bash
cd D:/src/aloevera-harmony-meet && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/contexts/LanguageContext.tsx
git -C D:/src/aloevera-harmony-meet commit -m "i18n: account-name + find-by-handle translation keys"
```

---

## Phase 7 — Wire account-name into the four registration screens

### Task 15: Welcome.tsx (local register)

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/Welcome.tsx`

- [ ] **Step 1: Add the import**

In `Welcome.tsx`, near the other UI imports, add:

```ts
import { AccountNameInput } from '@/components/ui/account-name-input';
```

- [ ] **Step 2: Add account-name state for the form**

`registerForm` is already created via `useForm<RegisterSchema>`. Add `accountName: ''` to the form's `defaultValues`:

```ts
defaultValues: { accountName: '', inviteCode: pendingInviteCode, country: '', region: '', secondaryCountry: '', secondaryRegion: '' },
```

Also track availability validity locally:

```ts
const [accountNameValid, setAccountNameValid] = useState(false);
```

- [ ] **Step 3: Render the <AccountNameInput> in the registration form**

In the register-form JSX, place the new field above the email field (account name is the new primary identifier):

```tsx
<Controller
  control={registerForm.control}
  name="accountName"
  render={({ field }) => (
    <AccountNameInput
      value={field.value ?? ''}
      onChange={field.onChange}
      onValidityChange={setAccountNameValid}
      disabled={isLoading}
    />
  )}
/>
{registerForm.formState.errors.accountName && (
  <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.accountName.message}</p>
)}
```

- [ ] **Step 4: Include `accountName` in the register payload**

In `handleRegister`, extend the payload:

```ts
const response = await authApi.register({
  accountName: data.accountName,
  email: data.email,
  // ... rest unchanged
});
```

- [ ] **Step 5: Map server errors**

In the same `handleRegister`, extend the error mapping (alongside the existing `EMAIL_TAKEN` block):

```ts
if (apiErr?.code === 'ACCOUNT_NAME_TAKEN') {
  registerForm.setError('accountName', { message: apiErr.message || 'Account name is already taken' });
  return;
}
if (apiErr?.code === 'INVALID_ACCOUNT_NAME') {
  registerForm.setError('accountName', { message: apiErr.message || 'Invalid account name' });
  return;
}
```

- [ ] **Step 6: Gate the submit button on availability**

In the register submit button JSX, extend the `disabled` prop:

```tsx
disabled={isLoading || !accountNameValid}
```

- [ ] **Step 7: Manual smoke test**

```bash
cd D:/src/aloevera-harmony-meet && npm run dev
```

Open `http://localhost:8080/`, click "No account? Register", confirm the account-name field renders at the top of the register form, typing "ab" shows invalid-format, typing a long valid name shows "available", clicking Submit succeeds in mock mode.

- [ ] **Step 8: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/Welcome.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(welcome): account-name field on local register form"
```

---

### Task 16: WelcomeTelegram.tsx

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/WelcomeTelegram.tsx`

- [ ] **Step 1: Add the field + state**

Find the existing `useForm<TelegramRegisterSchema>` block. Add `accountName: ''` to `defaultValues`.

Add:
```ts
const [accountNameValid, setAccountNameValid] = useState(false);
```

- [ ] **Step 2: Compute the prefill suggestion from Telegram username**

The page already reads the verified `telegram` object (with `firstName`, `lastName`, `username`, `photoUrl`). Above the JSX render, compute:

```ts
const tgUsernamePrefill = (telegram?.username ?? '').replace(/[^A-Za-z0-9_]/g, '');
```

- [ ] **Step 3: Render the input**

Add the `<Controller>` block for `accountName` at the top of the form, before the existing fields:

```tsx
<Controller
  control={form.control}
  name="accountName"
  render={({ field }) => (
    <AccountNameInput
      value={field.value ?? ''}
      onChange={field.onChange}
      onValidityChange={setAccountNameValid}
      disabled={isSubmitting}
      prefillSuggestion={tgUsernamePrefill}
    />
  )}
/>
{form.formState.errors.accountName && (
  <p role="alert" className="text-xs text-red-300">{form.formState.errors.accountName.message}</p>
)}
```

Also add the `import { AccountNameInput } from '@/components/ui/account-name-input';` import.

- [ ] **Step 4: Include `accountName` in the submit payload**

In the submit handler, extend the `telegramRegister` payload:

```ts
await authApi.telegramRegister({
  ticket,
  accountName: data.accountName,
  name: data.name,
  // ... rest
});
```

- [ ] **Step 5: Map server errors**

In the catch/response-handling block, add the same INVALID_ACCOUNT_NAME / ACCOUNT_NAME_TAKEN mapping as in Welcome.tsx Task 15 step 5.

- [ ] **Step 6: Gate Submit**

Extend the Submit button's `disabled` with `|| !accountNameValid`.

- [ ] **Step 7: Smoke test (optional — requires API mode + bot configured)**

If you can sign in via Telegram Login Widget against a dev backend, verify the field renders, the suggestion prefills from `username`, and a successful register call goes through.

- [ ] **Step 8: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/WelcomeTelegram.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(welcome): account-name field on telegram-pending register form"
```

---

### Task 17: WelcomeGoogle.tsx

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/WelcomeGoogle.tsx`

- [ ] **Step 1: Add the field, mirroring WelcomeTelegram**

The form here uses `GoogleRegisterSchema` (which aliases the telegram schema). Apply the exact same changes as Task 16, with these differences:

- The prefill comes from the Google email's local-part:
  ```ts
  const googleEmailPrefix = (google?.email ?? '').split('@')[0].replace(/[^A-Za-z0-9_]/g, '');
  ```
- The submit handler calls `authApi.googleRegister({ ticket, accountName: data.accountName, ... })`.

Otherwise: same `<Controller>` JSX, same accountNameValid state, same error mapping, same Submit gate.

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/WelcomeGoogle.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(welcome): account-name field on google-pending register form"
```

---

### Task 18: MiniAppEntry.tsx

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/MiniAppEntry.tsx`

- [ ] **Step 1: Add the field to the inline register wizard**

The Mini App entry renders an inline form when `status === 'needsRegistration'`. Apply the same pattern as Task 16:

- `defaultValues` gets `accountName: ''`
- `accountNameValid` state
- Prefill from `telegram.username` (with the same regex sanitisation)
- `<Controller>` block at the top of the form
- Submit handler passes `accountName: data.accountName` to `authApi.miniAppRegister({ initData, accountName, ... })`
- Same error mapping + Submit gate

- [ ] **Step 2: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/MiniAppEntry.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(welcome): account-name field on Mini App register wizard"
```

---

## Phase 8 — Display @handle + profile page + search

### Task 19: UserBadges renders @handle

**Files:**
- Modify: `aloevera-harmony-meet/src/components/ui/user-badges.tsx`
- Modify: `aloevera-harmony-meet/src/components/ui/__tests__/user-badges.test.tsx`

- [ ] **Step 1: Write a failing test**

Append to the existing `user-badges.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

it('renders @accountName when provided', () => {
  render(<LanguageProvider><UserBadges accountName="alice_99" /></LanguageProvider>);
  expect(screen.getByText('@alice_99')).toBeInTheDocument();
});

it('omits @ when accountName is empty/undefined', () => {
  render(<LanguageProvider><UserBadges /></LanguageProvider>);
  expect(screen.queryByText(/@/)).not.toBeInTheDocument();
});
```

(Use whatever provider wrap the existing tests in the file use — copy the imports from neighbouring tests.)

- [ ] **Step 2: Run to verify failing**

```bash
npx vitest run src/components/ui/__tests__/user-badges.test.tsx
```

Expected: FAIL — `accountName` prop unknown.

- [ ] **Step 3: Add the prop + rendering**

In `user-badges.tsx`, extend the props interface:

```ts
interface UserBadgesProps {
  rank?: UserRank;
  staffRole?: StaffRole;
  accountName?: string;
  className?: string;
}
```

And inside the render, between the rank dot and the staff pill, render the @handle when present:

```tsx
{accountName && (
  <span className="text-xs text-muted-foreground">@{accountName}</span>
)}
```

If the component currently returns `null` when both `rank` and `staffRole` are unset, relax that to also render when `accountName` is set:

```ts
if (!rank && !staffRole && !accountName) return null;
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/ui/__tests__/user-badges.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/components/ui/user-badges.tsx src/components/ui/__tests__/user-badges.test.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(badges): render @accountName on UserBadges"
```

---

### Task 20: Pass accountName to UserBadges call sites

**Files:**
- Modify: any file that renders `<UserBadges>` — at minimum these per the spec:
  - `aloevera-harmony-meet/src/components/forum/TopicDetail.tsx`
  - `aloevera-harmony-meet/src/pages/SettingsPage.tsx`
  - `aloevera-harmony-meet/src/pages/Friends.tsx` (swipe card + chat list)

- [ ] **Step 1: Find all <UserBadges> usages**

```bash
cd D:/src/aloevera-harmony-meet && npx grep -l "UserBadges" src/
```

(or use the Grep tool with pattern `<UserBadges`)

- [ ] **Step 2: For each call site, add `accountName={user.accountName}`**

The user object whose `rank` and `staffRole` are already being threaded in is the same one whose `accountName` we want. Adjacent prop, drop-in addition. Example:

Before:
```tsx
<UserBadges rank={user.rank} staffRole={user.staffRole} />
```

After:
```tsx
<UserBadges rank={user.rank} staffRole={user.staffRole} accountName={user.accountName} />
```

If a call site uses a slim DTO (e.g. chat-list partner record) that doesn't already carry `accountName`, extend that record's source (the API mapping function in `chatsApi.ts` / `usersApi.ts`) to include it.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add -A src/
git -C D:/src/aloevera-harmony-meet commit -m "feat(badges): wire accountName to UserBadges call sites"
```

---

### Task 21: <ProfileBody> shared component

Extract the existing swipe-card profile expanded view into a reusable component. Keeps Task 22 small.

**Files:**
- Create: `aloevera-harmony-meet/src/components/profile/profile-body.tsx`
- Modify: wherever the swipe card's expanded-profile content currently lives (likely `src/components/ui/swipe-card.tsx` or inside `Friends.tsx`)

- [ ] **Step 1: Locate the existing profile-display markup**

Search for the JSX block that renders bio + photos + events attended + favorite song. Common locations:

```bash
cd D:/src/aloevera-harmony-meet && npx grep -l "profileImage" src/components/ src/pages/
```

It's typically in a swipe-card variant. Read that file end-to-end before extracting.

- [ ] **Step 2: Create the shared component**

`D:\src\aloevera-harmony-meet\src\components\profile\profile-body.tsx`:

```tsx
import { User } from '@/types/user';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserBadges } from '@/components/ui/user-badges';

interface ProfileBodyProps {
  user: User;
}

export function ProfileBody({ user }: ProfileBodyProps) {
  const { t } = useLanguage();
  // Paste the JSX previously inline in the swipe card here, parameterized on `user`.
  // Keep all photo grid, bio, prompt list, favorite song, events-attended sections.
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">{user.name}</h2>
        <UserBadges rank={user.rank} staffRole={user.staffRole} accountName={user.accountName} />
      </div>
      {/* … paste the existing profile-display JSX, swapping any hardcoded references to use `user.X` … */}
    </div>
  );
}
```

(This is a structural extract — the exact JSX depends on what's already present. Aim to keep behaviour identical at all existing call sites by replacing the inline markup with `<ProfileBody user={user} />`.)

- [ ] **Step 3: Update the original call site**

Replace the inline markup with `<ProfileBody user={user} />`.

- [ ] **Step 4: Manual smoke test (mock mode)**

```bash
npm run dev
```

Open `/friends`, swipe a card to its expanded view. Verify the layout is unchanged.

- [ ] **Step 5: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/components/profile/profile-body.tsx src/components/ src/pages/
git -C D:/src/aloevera-harmony-meet commit -m "refactor(profile): extract <ProfileBody> from swipe card"
```

---

### Task 22: UserProfile.tsx page + /u/:accountName route

**Files:**
- Create: `aloevera-harmony-meet/src/pages/UserProfile.tsx`
- Modify: `aloevera-harmony-meet/src/App.tsx`

- [ ] **Step 1: Create the page**

`D:\src\aloevera-harmony-meet\src\pages\UserProfile.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '@/services/api';
import type { User } from '@/types/user';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProfileBody } from '@/components/profile/profile-body';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { Loader2, Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserProfile() {
  const { accountName } = useParams<{ accountName: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!accountName) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    usersApi.getUserByAccountName(accountName)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setUser(res.data);
        else setNotFound(true);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountName]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-semibold">@{accountName}</h1>
      </div>
      <div className="p-4 relative z-10">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {notFound && (
          <div className="text-center p-8 space-y-4">
            <Frown className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold">{t('profile.notFound')}</p>
            <Button onClick={() => navigate('/friends')}>{t('common.backToFriends')}</Button>
          </div>
        )}
        {user && <ProfileBody user={user} />}
      </div>
      <BottomNavigation />
    </div>
  );
}
```

Note: the `profile.notFound` and `common.backToFriends` keys are new — add them to `LanguageContext.tsx`:

- `profile.notFound`: "User not found" / "Пользователь не найден"
- `common.backToFriends`: "Back to Friends" / "Назад"

- [ ] **Step 2: Add the route**

In `App.tsx`, add (inside the `<ProtectedRoute>` group, alongside the other content routes):

```tsx
<Route path="/u/:accountName" element={
  <ProtectedRoute><UserProfile /></ProtectedRoute>
} />
```

…with the corresponding `import UserProfile from '@/pages/UserProfile';`.

- [ ] **Step 3: Manual smoke test (mock mode)**

```bash
npm run dev
```

Open `http://localhost:8080/u/alice99` (or whichever account name was given to a mock user in Task 12). Verify the profile renders. Then open `/u/no_such_user` and verify the friendly not-found state.

- [ ] **Step 4: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/UserProfile.tsx src/App.tsx src/contexts/LanguageContext.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(profile): /u/:accountName public profile route"
```

---

### Task 23: Find-by-handle on Friends.tsx

**Files:**
- Modify: `aloevera-harmony-meet/src/pages/Friends.tsx`

- [ ] **Step 1: Add the input**

Find the search-tab JSX section in `Friends.tsx`. Add a small form above the swipe deck:

```tsx
import { Search } from 'lucide-react';
// ...

const [handleQuery, setHandleQuery] = useState('');
const navigate = useNavigate(); // probably already exists

const handleFindByHandle = (e: React.FormEvent) => {
  e.preventDefault();
  const trimmed = handleQuery.trim().toLowerCase();
  if (trimmed) navigate(`/u/${trimmed}`);
};

// In the JSX, above the swipe deck:
<form onSubmit={handleFindByHandle} className="mb-4 flex gap-2">
  <Input
    type="text"
    placeholder={t('friends.findByHandlePlaceholder')}
    value={handleQuery}
    onChange={(e) => setHandleQuery(e.target.value)}
    className="flex-1"
  />
  <Button type="submit" size="icon" aria-label={t('friends.findByHandle')}>
    <Search className="w-4 h-4" />
  </Button>
</form>
```

(Match the existing component styling — use whichever `Input` / `Button` imports the file already uses.)

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open `/friends`, type a mock user's handle (e.g. `alice99`), submit — should navigate to `/u/alice99` and render the profile.

- [ ] **Step 3: Commit**

```bash
git -C D:/src/aloevera-harmony-meet add src/pages/Friends.tsx
git -C D:/src/aloevera-harmony-meet commit -m "feat(friends): find-by-handle input above the swipe deck"
```

---

## Phase 9 — Final verification

### Task 24: Full test sweeps + manual end-to-end

- [ ] **Step 1: Backend tests**

```bash
dotnet test D:/src/lovecraft/Lovecraft/Lovecraft.UnitTests
```

Expected: ALL PASS, no regressions.

- [ ] **Step 2: Frontend tests**

```bash
cd D:/src/aloevera-harmony-meet && npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 3: Type-check + lint**

```bash
cd D:/src/aloevera-harmony-meet && npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Manual end-to-end (mock mode)**

```bash
cd D:/src/aloevera-harmony-meet && npm run dev
```

Verify:
- Register a brand new account at `/`. The account-name field is the first field. Typing "ab" shows invalid-format. Typing a valid name shows green "Available". Submit succeeds; sign-in is automatic.
- Open `/friends`. See your own and other mock users' `@handles` rendered on their cards.
- Type a mock user's handle in the find-by-handle input. Press enter. Profile renders at `/u/<handle>`.
- Navigate to `/u/no_such_user`. See the friendly not-found state.

- [ ] **Step 5: Final commit (if anything stragglers)**

Nothing should be pending here. If there are uncommitted edits from manual touch-ups, commit them under a single tidy `chore` commit.

```bash
git -C D:/src/aloevera-harmony-meet status
git -C D:/src/lovecraft status
```

Both should report `working tree clean`.

---

## Done

All four registration paths take an account name. New users have `userId == accountName.ToLowerInvariant()`. Display retains original casing. `@handles` are visible across the app, public profiles live at `/u/:accountName`, and the registration form gives live availability feedback. Existing GUID-userId accounts continue to function unchanged.
