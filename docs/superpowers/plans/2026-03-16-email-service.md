# Email Service & Account Recovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up SendGrid email delivery so that email verification and password reset work end-to-end, across both backend auth services and three new frontend surfaces.

**Architecture:** `IEmailService` abstraction with `NullEmailService` (dev no-op) and `SendGridEmailService` (prod) — selected at startup via DI in `Program.cs`. Both `MockAuthService` and `AzureAuthService` gain an `IEmailService` constructor dependency and call it after writing auth tokens. Three new public frontend routes (`/verify-email`, `/reset-password`) and a modal on the login page complete the flow.

**Tech Stack:** C# / .NET 10, SendGrid NuGet (`SendGrid`), React 18, TypeScript, shadcn `<Dialog>`, react-hook-form + Zod, sonner toasts, react-router-dom v6.

---

## Chunk 1: Backend Email Infrastructure

### Task 1: Add SendGrid NuGet package and config keys

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Lovecraft.Backend.csproj`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\appsettings.json`
- Modify: `D:\src\lovecraft\Lovecraft\.env`

- [ ] **Step 1: Add SendGrid package reference**

Edit `Lovecraft.Backend.csproj` — add inside the first `<ItemGroup>`:

```xml
<PackageReference Include="SendGrid" Version="9.*" />
```

- [ ] **Step 2: Restore packages**

Run from `D:\src\lovecraft\Lovecraft\`:
```bash
dotnet restore
```
Expected: `Restore succeeded.` (no errors)

- [ ] **Step 3: Add config keys to appsettings.json**

Current content is:
```json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*",
  "USE_AZURE_STORAGE": false,
  "AZURE_STORAGE_CONNECTION_STRING": ""
}
```

Replace with:
```json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*",
  "USE_AZURE_STORAGE": false,
  "AZURE_STORAGE_CONNECTION_STRING": "",
  "SENDGRID_API_KEY": "",
  "FROM_EMAIL": "noreply@aloeband.ru",
  "FRONTEND_BASE_URL": "http://localhost:8080"
}
```

- [ ] **Step 4: Add keys to .env**

Append to `D:\src\lovecraft\Lovecraft\.env`:
```
SENDGRID_API_KEY=
FROM_EMAIL=noreply@aloeband.ru
FRONTEND_BASE_URL=http://20.153.164.3:8080
```

- [ ] **Step 5: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Lovecraft.Backend.csproj Lovecraft/Lovecraft.Backend/appsettings.json
git commit -m "chore: add SendGrid package and email config keys"
```

Do NOT commit `.env` (already in `.gitignore`).

---

### Task 2: Create IEmailService and NullEmailService

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IEmailService.cs`
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\NullEmailService.cs`

- [ ] **Step 1: Write failing test for NullEmailService**

Create `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\EmailServiceTests.cs`:

```csharp
using Xunit;
using Lovecraft.Backend.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Lovecraft.UnitTests;

public class EmailServiceTests
{
    [Fact]
    public async Task NullEmailService_SendVerification_CompletesWithoutThrowing()
    {
        var svc = new NullEmailService(NullLogger<NullEmailService>.Instance);
        // Should not throw
        await svc.SendVerificationEmailAsync("user@example.com", "Alice", "token-123");
    }

    [Fact]
    public async Task NullEmailService_SendPasswordReset_CompletesWithoutThrowing()
    {
        var svc = new NullEmailService(NullLogger<NullEmailService>.Instance);
        await svc.SendPasswordResetEmailAsync("user@example.com", "Alice", "token-456");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test --filter "EmailServiceTests" -v minimal
```
Expected: FAIL — `NullEmailService` not found.

- [ ] **Step 3: Create IEmailService.cs**

```csharp
namespace Lovecraft.Backend.Services;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string name, string verificationToken);
    Task SendPasswordResetEmailAsync(string toEmail, string name, string resetToken);
}
```

- [ ] **Step 4: Create NullEmailService.cs**

```csharp
namespace Lovecraft.Backend.Services;

public class NullEmailService : IEmailService
{
    private readonly ILogger<NullEmailService> _logger;

    public NullEmailService(ILogger<NullEmailService> logger)
    {
        _logger = logger;
    }

    public Task SendVerificationEmailAsync(string toEmail, string name, string verificationToken)
    {
        _logger.LogInformation(
            "[NullEmailService] Verification email suppressed. To: {Email}, Token: {Token}, Link: http://localhost:8080/verify-email?token={Token}",
            toEmail, verificationToken, verificationToken);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string name, string resetToken)
    {
        _logger.LogInformation(
            "[NullEmailService] Password reset email suppressed. To: {Email}, Token: {Token}, Link: http://localhost:8080/reset-password?token={Token}",
            toEmail, resetToken, resetToken);
        return Task.CompletedTask;
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test --filter "EmailServiceTests" -v minimal
```
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Services/IEmailService.cs Lovecraft/Lovecraft.Backend/Services/NullEmailService.cs Lovecraft/Lovecraft.UnitTests/EmailServiceTests.cs
git commit -m "feat: add IEmailService interface and NullEmailService"
```

---

### Task 3: Create SendGridEmailService

**Files:**
- Create: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\SendGridEmailService.cs`

- [ ] **Step 1: Create SendGridEmailService.cs**

```csharp
using SendGrid;
using SendGrid.Helpers.Mail;

namespace Lovecraft.Backend.Services;

public class SendGridEmailService : IEmailService
{
    private readonly SendGridClient _client;
    private readonly string _fromEmail;
    private readonly string _frontendBaseUrl;
    private readonly ILogger<SendGridEmailService> _logger;

    public SendGridEmailService(IConfiguration configuration, ILogger<SendGridEmailService> logger)
    {
        _logger = logger;
        var apiKey = configuration["SENDGRID_API_KEY"]
            ?? throw new InvalidOperationException("SENDGRID_API_KEY not configured");
        _fromEmail = configuration["FROM_EMAIL"] ?? "noreply@aloeband.ru";
        _frontendBaseUrl = configuration["FRONTEND_BASE_URL"] ?? "http://localhost:8080";
        _client = new SendGridClient(apiKey);
    }

    public async Task SendVerificationEmailAsync(string toEmail, string name, string verificationToken)
    {
        var link = $"{_frontendBaseUrl}/verify-email?token={verificationToken}";
        var msg = MailHelper.CreateSingleEmail(
            from: new EmailAddress(_fromEmail, "AloeVera"),
            to: new EmailAddress(toEmail, name),
            subject: "Verify your AloeVera email",
            plainTextContent: $"Hi {name},\n\nVerify your email: {link}\n\nThis link expires in 7 days.",
            htmlContent: $"<p>Hi {name},</p><p>Click to verify your email:<br><a href=\"{link}\">{link}</a></p><p>This link expires in 7 days.</p>"
        );

        var response = await _client.SendEmailAsync(msg);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Body.ReadAsStringAsync();
            throw new InvalidOperationException($"SendGrid error {(int)response.StatusCode}: {body}");
        }

        _logger.LogInformation("Verification email sent to {Email}", toEmail);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string name, string resetToken)
    {
        var link = $"{_frontendBaseUrl}/reset-password?token={resetToken}";
        var msg = MailHelper.CreateSingleEmail(
            from: new EmailAddress(_fromEmail, "AloeVera"),
            to: new EmailAddress(toEmail, name),
            subject: "Reset your AloeVera password",
            plainTextContent: $"Hi {name},\n\nReset your password: {link}\n\nThis link expires in 1 hour.",
            htmlContent: $"<p>Hi {name},</p><p>Click to reset your password:<br><a href=\"{link}\">{link}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>"
        );

        var response = await _client.SendEmailAsync(msg);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Body.ReadAsStringAsync();
            throw new InvalidOperationException($"SendGrid error {(int)response.StatusCode}: {body}");
        }

        _logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }
}
```

- [ ] **Step 2: Build to verify no compilation errors**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.Backend --no-restore
```
Expected: Build succeeded, 0 error(s).

- [ ] **Step 3: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Services/SendGridEmailService.cs
git commit -m "feat: add SendGridEmailService implementation"
```

---

### Task 4: Register IEmailService in Program.cs

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Program.cs`

- [ ] **Step 1: Add IEmailService DI registration**

In `Program.cs`, find the block (line ~95–100):
```csharp
// Register services
builder.Services.AddMemoryCache();
builder.Services.AddSingleton(jwtSettings);
builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();

var useAzure = builder.Configuration.GetValue<bool>("USE_AZURE_STORAGE");
```

Insert before `var useAzure` line:
```csharp
var sendGridKey = builder.Configuration["SENDGRID_API_KEY"];
if (!string.IsNullOrEmpty(sendGridKey))
    builder.Services.AddSingleton<IEmailService, SendGridEmailService>();
else
    builder.Services.AddSingleton<IEmailService, NullEmailService>();

```

- [ ] **Step 2: Build and run tests to verify DI works**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
dotnet test --filter "EmailServiceTests" -v minimal
```
Expected: Build succeeded. 2 tests pass.

- [ ] **Step 3: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Program.cs
git commit -m "feat: register IEmailService in DI (NullEmailService by default)"
```

---

## Chunk 2: Backend Auth Service Wiring

> **Pre-condition:** Tasks 1–4 must be fully committed before starting Chunk 2. `IEmailService.cs`, `NullEmailService.cs`, `SendGridEmailService.cs`, and the `Program.cs` DI registration must all exist so that test files that reference `NullEmailService` will compile.

### Task 5: Write email behavior tests and wire MockAuthService

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\EmailServiceTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AuthenticationTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockAuthService.cs`

- [ ] **Step 1: Add CapturingEmailService spy and MockAuthServiceEmailTests class to EmailServiceTests.cs**

`MockAuthService` uses static dictionaries shared across all instances in a test run. The behavioral tests for email-calling behavior must live in a class marked `[Collection("AuthTests")]` so they are serialised with `AuthenticationTests` and `RefreshTokenTests`. Each `[Fact]` creates its own independent `CapturingEmailService` and `MockAuthService` instances — never share a single spy across test methods via a class field.

Add to the bottom of `EmailServiceTests.cs` (outside/after the `EmailServiceTests` class, but still inside the namespace):

```csharp
// Spy used to verify MockAuthService calls IEmailService correctly.
// Lives in EmailServiceTests.cs but is internal so it is available to
// MockAuthServiceEmailTests below.
internal class CapturingEmailService : IEmailService
{
    public List<(string email, string name, string token)> VerificationsSent = new();
    public List<(string email, string name, string token)> ResetsSent = new();
    public bool ShouldThrow { get; set; }

    public Task SendVerificationEmailAsync(string email, string name, string token)
    {
        if (ShouldThrow) throw new InvalidOperationException("SendGrid unavailable");
        VerificationsSent.Add((email, name, token));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string email, string name, string token)
    {
        if (ShouldThrow) throw new InvalidOperationException("SendGrid unavailable");
        ResetsSent.Add((email, name, token));
        return Task.CompletedTask;
    }
}

// MockAuthService uses static dictionaries — must be in [Collection("AuthTests")]
// to be serialised with AuthenticationTests and RefreshTokenTests.
[Collection("AuthTests")]
public class MockAuthServiceEmailTests
{
    private static MockAuthService BuildAuthSvc(IEmailService emailSvc)
    {
        var jwtSettings = new JwtSettings
        {
            SecretKey = "test-secret-key-min-32-characters!",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            AccessTokenLifetimeMinutes = 15,
            RefreshTokenLifetimeDays = 7
        };
        return new MockAuthService(
            new JwtService(jwtSettings, NullLogger<JwtService>.Instance),
            new PasswordHasher(),
            NullLogger<MockAuthService>.Instance,
            emailSvc);
    }

    [Fact]
    public async Task Register_SendsVerificationEmail()
    {
        // Each test creates fresh instances — never share CapturingEmailService across tests
        var emailSvc = new CapturingEmailService();
        var authSvc = BuildAuthSvc(emailSvc);

        await authSvc.RegisterAsync(new Lovecraft.Common.DTOs.Auth.RegisterRequestDto
        {
            Email = "alice@example.com",
            Password = "Password1!",
            Name = "Alice",
            Age = 25,
            Location = "Moscow",
            Gender = "female"
        });

        Assert.Single(emailSvc.VerificationsSent);
        Assert.Equal("alice@example.com", emailSvc.VerificationsSent[0].email);
        Assert.Equal("Alice", emailSvc.VerificationsSent[0].name);
    }

    [Fact]
    public async Task ForgotPassword_ExistingUser_SendsResetEmail()
    {
        var emailSvc = new CapturingEmailService();
        var authSvc = BuildAuthSvc(emailSvc);

        // Register so the user exists
        await authSvc.RegisterAsync(new Lovecraft.Common.DTOs.Auth.RegisterRequestDto
        {
            Email = "bob@example.com", Password = "Password1!", Name = "Bob",
            Age = 30, Location = "Berlin", Gender = "male"
        });
        emailSvc.VerificationsSent.Clear();

        var result = await authSvc.ForgotPasswordAsync("bob@example.com");

        Assert.True(result);
        Assert.Single(emailSvc.ResetsSent);
        Assert.Equal("bob@example.com", emailSvc.ResetsSent[0].email);
        Assert.Equal("Bob", emailSvc.ResetsSent[0].name);
    }

    [Fact]
    public async Task ForgotPassword_NonExistentUser_ReturnsTrueAndSendsNoEmail()
    {
        var emailSvc = new CapturingEmailService();
        var authSvc = BuildAuthSvc(emailSvc);

        var result = await authSvc.ForgotPasswordAsync("nobody@example.com");

        Assert.True(result); // anti-enumeration
        Assert.Empty(emailSvc.ResetsSent);
    }

    [Fact]
    public async Task Register_EmailServiceThrows_DoesNotRethrow()
    {
        var emailSvc = new CapturingEmailService { ShouldThrow = true };
        var authSvc = BuildAuthSvc(emailSvc);

        // Must not throw — email failure is swallowed; token remains valid
        var result = await authSvc.RegisterAsync(new Lovecraft.Common.DTOs.Auth.RegisterRequestDto
        {
            Email = "carol@example.com", Password = "Password1!", Name = "Carol",
            Age = 22, Location = "Paris", Gender = "female"
        });

        Assert.NotNull(result);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test --filter "EmailServiceTests" -v minimal
```
Expected: FAIL — `MockAuthService` constructor doesn't accept `IEmailService` yet.

- [ ] **Step 3: Update MockAuthService constructor calls in existing test files**

Both `AuthenticationTests.cs` and `RefreshTokenTests.cs` construct `MockAuthService` directly and will fail to compile once the constructor requires `IEmailService`.

In `AuthenticationTests.cs` (line ~35), change:
```csharp
_authService = new MockAuthService(_jwtService, _passwordHasher, authLogger);
```
to:
```csharp
_authService = new MockAuthService(_jwtService, _passwordHasher, authLogger, new NullEmailService(NullLogger<NullEmailService>.Instance));
```

In `RefreshTokenTests.cs` (line ~34–35), change:
```csharp
_authService = new MockAuthService(_jwtService, new PasswordHasher(),
                                   NullLogger<MockAuthService>.Instance);
```
to:
```csharp
_authService = new MockAuthService(_jwtService, new PasswordHasher(),
                                   NullLogger<MockAuthService>.Instance,
                                   new NullEmailService(NullLogger<NullEmailService>.Instance));
```

- [ ] **Step 4: Wire IEmailService into MockAuthService**

In `MockAuthService.cs`:

**Add field (after existing private fields):**
```csharp
private readonly IEmailService _emailService;
```

**Update constructor signature** (add `IEmailService emailService` parameter after `ILogger<MockAuthService> logger`):
```csharp
public MockAuthService(
    IJwtService jwtService,
    IPasswordHasher passwordHasher,
    ILogger<MockAuthService> logger,
    IEmailService emailService)
```

**Add field assignment in constructor body** (after `_logger = logger;`):
```csharp
_emailService = emailService;
```

**Update RegisterAsync** — find the comment block immediately after the `_logger.LogInformation("User registered: {UserId}...")` line. It currently reads `// In a real implementation, send email here` followed by `// For mock, just log the token`. Replace both comment lines with the following try/catch, which must appear before the `// Generate tokens (but user can't use them until email verified)` comment that follows:
```csharp
try
{
    await _emailService.SendVerificationEmailAsync(user.Email, user.Name, verificationToken);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to send verification email to {Email}; token remains valid", user.Email);
}
```

**Update ForgotPasswordAsync** — after `_logger.LogInformation("Password reset token generated...")` line, replace the `// In real implementation, send email` comment with:
```csharp
try
{
    await _emailService.SendPasswordResetEmailAsync(email, user.Name, resetToken);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to send password reset email to {Email}; token remains valid", email);
}
```

- [ ] **Step 5: Run all backend tests**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test -v minimal
```
Expected: All tests pass (existing 81 + new email tests = 87+ passing).

- [ ] **Step 6: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.UnitTests/EmailServiceTests.cs Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs Lovecraft/Lovecraft.UnitTests/RefreshTokenTests.cs
git commit -m "feat: wire IEmailService into MockAuthService (register + forgot password)"
```

---

### Task 6: Wire IEmailService into AzureAuthService

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureAuthService.cs`

> **DI note:** `AzureAuthService` is registered in `Program.cs` as `builder.Services.AddSingleton<IAuthService, AzureAuthService>()` — standard type-based DI. No factory lambda passes positional constructor arguments, so adding a new parameter to the constructor requires no change in `Program.cs`; the container resolves `IEmailService` automatically from the already-registered singleton. Confirm this before proceeding: `Program.cs` line 107 should read `AddSingleton<IAuthService, AzureAuthService>()` with no lambda. If it does use a lambda (`sp => new AzureAuthService(...)`), update the lambda to pass `sp.GetRequiredService<IEmailService>()` as the last argument.

- [ ] **Step 1: Add IEmailService field and constructor parameter**

In `AzureAuthService.cs`:

Add field after `private readonly ILogger<AzureAuthService> _logger;`:
```csharp
private readonly IEmailService _emailService;
```

Update constructor signature — add `IEmailService emailService` after `ILogger<AzureAuthService> logger`:
```csharp
public AzureAuthService(
    TableServiceClient tableServiceClient,
    IJwtService jwtService,
    IPasswordHasher passwordHasher,
    JwtSettings jwtSettings,
    ILogger<AzureAuthService> logger,
    IEmailService emailService)
```

Add field assignment after `_logger = logger;`:
```csharp
_emailService = emailService;
```

- [ ] **Step 2: Call IEmailService in RegisterAsync**

In `AzureAuthService.RegisterAsync`, after the `_logger.LogInformation("User registered...")` line (just before `// Generate tokens`), add:
```csharp
try
{
    await _emailService.SendVerificationEmailAsync(request.Email, request.Name, verificationToken);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to send verification email to {Email}; token remains valid", request.Email);
}
```

- [ ] **Step 3: Restructure ForgotPasswordAsync to load user Name and call IEmailService**

Replace the entire `ForgotPasswordAsync` method body with:

```csharp
public async Task<bool> ForgotPasswordAsync(string email)
{
    var emailLower = email.ToLower();
    string userId;
    try
    {
        var indexResponse = await _emailIndexTable.GetEntityAsync<UserEmailIndexEntity>(emailLower, "INDEX");
        userId = indexResponse.Value.UserId;
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        _logger.LogWarning("Password reset requested for non-existent email {Email}", email);
        return true;
    }

    // Load the full user entity to get Name for the personalised email
    UserEntity userEntity;
    try
    {
        var userResponse = await _usersTable.GetEntityAsync<UserEntity>(
            UserEntity.GetPartitionKey(userId), userId);
        userEntity = userResponse.Value;
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        _logger.LogWarning("Password reset: index entry exists for {Email} but user row missing (data inconsistency)", email);
        return true; // anti-enumeration
    }

    var resetToken = Guid.NewGuid().ToString();
    var authTokenEntity = new AuthTokenEntity
    {
        PartitionKey = resetToken,
        RowKey = "RESET",
        UserId = userId,
        Email = email,
        ExpiresAt = DateTime.UtcNow.AddHours(1),
        Used = false
    };
    await _authTokensTable.UpsertEntityAsync(authTokenEntity);

    _logger.LogInformation("Password reset token generated for {Email}: {Token}", email, resetToken);

    try
    {
        await _emailService.SendPasswordResetEmailAsync(email, userEntity.Name, resetToken);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Failed to send password reset email to {Email}; token remains valid", email);
    }

    return true;
}
```

- [ ] **Step 4: Build and run all tests**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build
dotnet test -v minimal
```
Expected: Build succeeded. All tests pass.

- [ ] **Step 5: Commit**

```bash
cd D:\src\lovecraft
git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs
git commit -m "feat: wire IEmailService into AzureAuthService (register + forgot password)"
```

---

## Chunk 3: Frontend API, Validation, and i18n

### Task 7: Add authApi methods

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\authApi.ts`

- [ ] **Step 1: Add forgotPassword, verifyEmail, and resetPassword to authApi**

Append after the `getCurrentUser` method (before the closing `};`):

```typescript
  // Forgot password — sends reset email; always returns success (anti-enumeration)
  async forgotPassword(email: string) {
    if (isApiMode()) {
      return apiClient.post<{ success: boolean }>('/api/v1/auth/forgot-password', { email });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },

  // Verify email — GET with token as query param (matches backend [HttpGet])
  async verifyEmail(token: string) {
    if (isApiMode()) {
      return apiClient.get<{ success: boolean }>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },

  // Reset password — submits new password using the token from the reset email
  async resetPassword(token: string, newPassword: string) {
    if (isApiMode()) {
      return apiClient.post<{ success: boolean }>('/api/v1/auth/reset-password', { token, newPassword });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },
```

- [ ] **Step 2: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/services/api/authApi.ts
git commit -m "feat: add forgotPassword, verifyEmail, resetPassword to authApi"
```

---

### Task 8: Add Zod schemas

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\lib\validators.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`

- [ ] **Step 1: Write failing tests for new schemas**

Add to the bottom of `validators.test.ts`:

```typescript
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators';

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------
describe('forgotPasswordSchema', () => {
  it('passes with a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email format', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('fails with empty email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
const validReset = { password: 'Password1!', confirmPassword: 'anything' };

describe('resetPasswordSchema', () => {
  it('passes with a strong password and non-empty confirmPassword', () => {
    const result = resetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
  });

  it('fails when password is too short', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Aa1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no uppercase letter', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'password1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no lowercase letter', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'PASSWORD1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no digit', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Password!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no special character', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Password1' });
    expect(result.success).toBe(false);
  });

  it('fails with empty confirmPassword', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, confirmPassword: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd D:\src\aloevera-harmony-meet
npm run test:run -- validators
```
Expected: FAIL — `forgotPasswordSchema` and `resetPasswordSchema` not exported.

- [ ] **Step 3: Add schemas to validators.ts**

Append to `validators.ts` (after the `createTopicSchema` block, before the type exports):

```typescript
export const forgotPasswordSchema = z.object({
  // NOTE: spec shows bare .email() but existing loginSchema/registerSchema use .email('Enter a valid email').
  // Using the message form here for consistency with existing codebase patterns.
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/[0-9]/, 'One number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'One special character'),
  // No hardcoded message — Zod default is fine here; actual user-visible mismatch
  // error is set via form.setError with t() in the submit handler.
  confirmPassword: z.string().min(1),
});
```

Add type exports after the existing type exports (after `export type CreateTopicFormData`):
```typescript
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd D:\src\aloevera-harmony-meet
npm run test:run -- validators
```
Expected: All validator tests pass (existing + 10 new = 38+ total).

- [ ] **Step 5: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/lib/validators.ts src/lib/__tests__/validators.test.ts
git commit -m "feat: add forgotPasswordSchema and resetPasswordSchema with tests"
```

---

### Task 9: Add i18n keys to LanguageContext

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\contexts\LanguageContext.tsx`

- [ ] **Step 1: Add translation keys**

Find the `ru` translations object and add (place near related auth keys):

```typescript
// ForgotPassword modal
'forgotPassword.title': 'Восстановление пароля',
'forgotPassword.emailLabel': 'Email',
'forgotPassword.submitButton': 'Отправить ссылку',
'forgotPassword.successMessage': 'Если этот email зарегистрирован, вы получите ссылку для сброса пароля.',
'forgotPassword.closeButton': 'Закрыть',
// VerifyEmail page
'verifyEmail.loading': 'Подтверждаем email...',
'verifyEmail.success': 'Email подтверждён! Теперь вы можете войти.',
'verifyEmail.successButton': 'Войти',
'verifyEmail.error': 'Ссылка недействительна или устарела.',
'verifyEmail.errorButton': 'На главную',
// ResetPassword page
'resetPassword.title': 'Новый пароль',
'resetPassword.passwordLabel': 'Новый пароль',
'resetPassword.confirmLabel': 'Подтвердите пароль',
'resetPassword.submitButton': 'Сохранить пароль',
'resetPassword.successToast': 'Пароль изменён. Войдите с новым паролем.',
'resetPassword.errorFallback': 'Не удалось изменить пароль',
'resetPassword.passwordMismatch': 'Пароли не совпадают',
```

Find the `en` translations object and add:

```typescript
// ForgotPassword modal
'forgotPassword.title': 'Reset Password',
'forgotPassword.emailLabel': 'Email',
'forgotPassword.submitButton': 'Send Reset Link',
'forgotPassword.successMessage': "If that email is registered, you'll receive a reset link shortly.",
'forgotPassword.closeButton': 'Close',
// VerifyEmail page
'verifyEmail.loading': 'Verifying your email...',
'verifyEmail.success': 'Email verified! You can now sign in.',
'verifyEmail.successButton': 'Sign In',
'verifyEmail.error': 'This link is invalid or has expired.',
'verifyEmail.errorButton': 'Go Home',
// ResetPassword page
'resetPassword.title': 'Set New Password',
'resetPassword.passwordLabel': 'New Password',
'resetPassword.confirmLabel': 'Confirm Password',
'resetPassword.submitButton': 'Save Password',
'resetPassword.successToast': 'Password changed. Sign in with your new password.',
'resetPassword.errorFallback': 'Failed to reset password',
'resetPassword.passwordMismatch': 'Passwords do not match',
```

- [ ] **Step 2: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/contexts/LanguageContext.tsx
git commit -m "feat: add i18n keys for email verification and password reset flows"
```

---

## Chunk 4: Frontend UI Components

### Task 10: Create ForgotPasswordModal

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\ForgotPasswordModal.tsx`

- [ ] **Step 1: Create ForgotPasswordModal.tsx**

```tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { forgotPasswordSchema, type ForgotPasswordSchema } from '@/lib/validators';
import { authApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
}

const ForgotPasswordModal = ({ open, onOpenChange, email, onEmailChange }: ForgotPasswordModalProps) => {
  const { t } = useLanguage();
  // showSuccess is local: shadcn Dialog unmounts its children on close, so this state
  // is automatically destroyed when the modal closes. On reopen the component remounts
  // fresh with showSuccess=false — which is exactly the spec's required reset behavior.
  // The spec says to lift this state, but local state achieves the same outcome here
  // because unmount-on-close provides the reset for free.
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowSuccess(false);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await authApi.forgotPassword(data.email);
      setShowSuccess(true);
    } catch (err) {
      showApiError(err, 'Failed to send reset link');
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forgotPassword.title')}</DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('forgotPassword.successMessage')}</p>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              {t('forgotPassword.closeButton')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t('forgotPassword.emailLabel')}</Label>
              <Input
                id="forgot-email"
                type="email"
                {...form.register('email', {
                  onChange: (e) => onEmailChange(e.target.value),
                })}
                defaultValue={email}
              />
              {form.formState.errors.email && (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('forgotPassword.submitButton')}</>
              ) : (
                t('forgotPassword.submitButton')
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordModal;
```

- [ ] **Step 2: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/components/ForgotPasswordModal.tsx
git commit -m "feat: create ForgotPasswordModal with success state"
```

---

### Task 11: Update Welcome.tsx — wire ForgotPasswordModal

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Welcome.tsx`

- [ ] **Step 1: Add import for ForgotPasswordModal**

At the top of `Welcome.tsx`, add after the existing imports:
```tsx
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
```

- [ ] **Step 2: Add state for the modal**

Inside the `Welcome` component, after the existing `useState` declarations (`showRegister`, `isLoading`), add:
```tsx
const [forgotOpen, setForgotOpen] = useState(false);
const [forgotEmail, setForgotEmail] = useState('');
```

- [ ] **Step 3: Wire the "Forgot password?" button**

Find this existing button in the JSX (around line 193–195):
```tsx
<button className="text-white/60 hover:text-white/80 text-xs block w-full">
  Forgot password?
</button>
```

Replace with:
```tsx
<button
  type="button"
  onClick={() => setForgotOpen(true)}
  className="text-white/60 hover:text-white/80 text-xs block w-full"
>
  {t('auth.forgotPassword')}
</button>
```

- [ ] **Step 4: Add ForgotPasswordModal to JSX**

Just before the closing `</div>` of the component's return (before the `{/* Music Notes Animation */}` block), add:
```tsx
<ForgotPasswordModal
  open={forgotOpen}
  onOpenChange={setForgotOpen}
  email={forgotEmail}
  onEmailChange={setForgotEmail}
/>
```

- [ ] **Step 5: Add auth.forgotPassword translation key to LanguageContext**

In `LanguageContext.tsx`, add to both `ru` and `en` objects:
```typescript
// ru
'auth.forgotPassword': 'Забыли пароль?',
// en
'auth.forgotPassword': 'Forgot password?',
```

- [ ] **Step 6: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/pages/Welcome.tsx src/contexts/LanguageContext.tsx
git commit -m "feat: wire ForgotPasswordModal into Welcome page"
```

---

### Task 12: Create VerifyEmail page

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\pages\VerifyEmail.tsx`

- [ ] **Step 1: Create VerifyEmail.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi } from '@/services/api';

type State = 'loading' | 'success' | 'error';

const VerifyEmail = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState('error');
      return;
    }

    authApi
      .verifyEmail(token)
      .then((res) => {
        setState(res.success ? 'success' : 'error');
      })
      .catch(() => {
        setState('error');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-sm">
        {state === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">{t('verifyEmail.loading')}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <p className="text-lg font-medium">{t('verifyEmail.success')}</p>
            <Button onClick={() => navigate('/')}>{t('verifyEmail.successButton')}</Button>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <p className="text-lg font-medium">{t('verifyEmail.error')}</p>
            <Button variant="outline" onClick={() => navigate('/')}>{t('verifyEmail.errorButton')}</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
```

- [ ] **Step 2: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/pages/VerifyEmail.tsx
git commit -m "feat: create VerifyEmail page"
```

---

### Task 13: Create ResetPassword page

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\pages\ResetPassword.tsx`

- [ ] **Step 1: Create ResetPassword.tsx**

```tsx
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { resetPasswordSchema, type ResetPasswordSchema } from '@/lib/validators';
import { authApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';

const ResetPassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (data.password !== data.confirmPassword) {
      form.setError('confirmPassword', { message: t('resetPassword.passwordMismatch') });
      return;
    }

    try {
      const res = await authApi.resetPassword(token!, data.password);
      if (!res.success) {
        showApiError(res, t('resetPassword.errorFallback'));
        return;
      }
      toast.success(t('resetPassword.successToast'));
      navigate('/');
    } catch (err) {
      showApiError(err, t('resetPassword.errorFallback'));
    }
  });

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('resetPassword.title')}</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('resetPassword.passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p role="alert" className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('resetPassword.confirmLabel')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <p role="alert" className="text-xs text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('resetPassword.submitButton')}</>
            ) : (
              t('resetPassword.submitButton')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
```

- [ ] **Step 2: Build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/pages/ResetPassword.tsx
git commit -m "feat: create ResetPassword page"
```

---

### Task 14: Register routes in App.tsx

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\App.tsx`

- [ ] **Step 1: Add imports**

Add to imports at the top of `App.tsx`:
```tsx
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
```

- [ ] **Step 2: Add public routes**

After the `<Route path="/" element={<Welcome />} />` line, add:
```tsx
{/* Public — email flows (no auth required) */}
<Route path="/verify-email" element={<VerifyEmail />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 3: Run all frontend tests**

```bash
cd D:\src\aloevera-harmony-meet
npm run test:run
```
Expected: All tests pass (existing 50+ new validator tests = 60+ total).

- [ ] **Step 4: Final build check**

```bash
cd D:\src\aloevera-harmony-meet
npm run build
```
Expected: Build succeeded with no errors.

- [ ] **Step 5: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/App.tsx
git commit -m "feat: register /verify-email and /reset-password as public routes"
```

---

## End-to-End Smoke Test Checklist

After all tasks complete, manually verify in mock mode (`VITE_API_MODE=mock`):

- [ ] Click "Forgot password?" on login form → modal opens
- [ ] Enter invalid email → validation error shown
- [ ] Enter valid email → submit → success state shown with anti-enumeration message
- [ ] Close modal → reopen → email field retains previous value
- [ ] Navigate to `/verify-email` (no token) → error state shown with home button
- [ ] Navigate to `/verify-email?token=anything` → success state shown → "Sign In" navigates to `/`
- [ ] Navigate to `/reset-password` (no token) → redirected to `/`
- [ ] Navigate to `/reset-password?token=anything` → form shown
- [ ] Submit with weak password → validation errors shown
- [ ] Submit with mismatched passwords → "Passwords do not match" error shown on confirm field
- [ ] Submit valid form → success toast → redirected to `/`
- [ ] `/verify-email` and `/reset-password` are accessible without JWT (not wrapped in ProtectedRoute)
