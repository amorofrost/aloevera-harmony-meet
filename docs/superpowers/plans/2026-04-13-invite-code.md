# Invite Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate registration behind an optional invite code stored in the backend `.env`, with the input field hidden when no code is configured.

**Architecture:** Backend reads `INVITE_CODE` from `IConfiguration`; a new public endpoint exposes whether a code is required; the register endpoint validates the submitted code and throws a typed exception for wrong codes; the frontend fetches config on mount and shows/hides the field + swaps Zod schemas dynamically.

**Tech Stack:** .NET 10 ASP.NET Core, xUnit, React 18, TypeScript, Zod, react-hook-form, Vitest + RTL

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `Lovecraft.Common/DTOs/Auth/AuthDtos.cs` | Modify | Add `InviteCode?` to `RegisterRequestDto`; add `RegistrationConfigDto` |
| `Lovecraft.Backend/Services/InvalidInviteCodeException.cs` | Create | Typed exception for wrong invite code |
| `Lovecraft.Backend/Services/MockAuthService.cs` | Modify | Accept `IConfiguration`, validate invite code |
| `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` | Modify | Accept `IConfiguration`, validate invite code |
| `Lovecraft.Backend/Controllers/V1/AuthController.cs` | Modify | Accept `IConfiguration`, add `GetRegistrationConfig`, catch `InvalidInviteCodeException` |
| `Lovecraft.UnitTests/AuthenticationTests.cs` | Modify | New invite-code test cases |
| `Lovecraft/Lovecraft/.env` | Modify | Add `INVITE_CODE=` (empty = open) |
| `src/lib/validators.ts` | Modify | Add `registerSchemaWithInvite` |
| `src/services/api/authApi.ts` | Modify | Add `getRegistrationConfig`, add `inviteCode?` to `RegisterRequest` |
| `src/contexts/LanguageContext.tsx` | Modify | Add two i18n keys |
| `src/pages/Welcome.tsx` | Modify | Fetch config, conditional schema + field, handle `INVALID_INVITE_CODE` |
| `src/pages/__tests__/Welcome.test.tsx` | Modify | Update mock, add invite-code test cases |

---

### Task 1: DTO changes

**Files:**
- Modify: `Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs`

- [ ] **Step 1: Add `InviteCode` property and new response DTO**

  In `AuthDtos.cs`, add `InviteCode` to `RegisterRequestDto` and append `RegistrationConfigDto` at the bottom:

  ```csharp
  public class RegisterRequestDto
  {
      public string Email { get; set; } = string.Empty;
      public string Password { get; set; } = string.Empty;
      public string Name { get; set; } = string.Empty;
      public int Age { get; set; }
      public string Location { get; set; } = string.Empty;
      public string Gender { get; set; } = string.Empty;
      public string Bio { get; set; } = string.Empty;
      public string? InviteCode { get; set; }  // nullable — omitted when not required
  }
  ```

  At the end of the file add:

  ```csharp
  public record RegistrationConfigDto(bool InviteCodeRequired);
  ```

- [ ] **Step 2: Build to verify**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet build
  ```
  Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs
  git commit -m "feat: add InviteCode to RegisterRequestDto and RegistrationConfigDto"
  ```

---

### Task 2: InvalidInviteCodeException

**Files:**
- Create: `Lovecraft/Lovecraft.Backend/Services/InvalidInviteCodeException.cs`

- [ ] **Step 1: Create exception class**

  ```csharp
  namespace Lovecraft.Backend.Services;

  public class InvalidInviteCodeException : Exception
  {
      public InvalidInviteCodeException() : base("Invalid invite code") { }
  }
  ```

- [ ] **Step 2: Build to verify**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet build
  ```
  Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.Backend/Services/InvalidInviteCodeException.cs
  git commit -m "feat: add InvalidInviteCodeException"
  ```

---

### Task 3: MockAuthService — invite code validation

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs`

- [ ] **Step 1: Add `IConfiguration` field and constructor parameter**

  Add the field alongside the others:
  ```csharp
  private readonly IConfiguration _configuration;
  ```

  Update the constructor signature and body:
  ```csharp
  public MockAuthService(
      IJwtService jwtService,
      IPasswordHasher passwordHasher,
      ILogger<MockAuthService> logger,
      IEmailService emailService,
      IConfiguration configuration)
  {
      _jwtService = jwtService;
      _passwordHasher = passwordHasher;
      _logger = logger;
      _emailService = emailService;
      _configuration = configuration;

      SeedTestUsers();
  }
  ```

- [ ] **Step 2: Add invite code check at the top of `RegisterAsync`**

  Insert this block immediately after `await Task.Delay(100);` and before the duplicate-email check:

  ```csharp
  // Invite code validation
  var configuredCode = _configuration["INVITE_CODE"];
  if (!string.IsNullOrEmpty(configuredCode))
  {
      if (request.InviteCode != configuredCode)
          throw new InvalidInviteCodeException();
  }
  ```

- [ ] **Step 3: Build to verify**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet build
  ```
  Expected: Build succeeded. `Program.cs` DI registration will now fail to compile — that's expected and fixed in Task 5.

  If it fails only on DI-related errors in `Program.cs` (since `MockAuthService` now requires a 5th arg), note that and proceed — `Program.cs` is fixed in Task 5.

- [ ] **Step 4: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs
  git commit -m "feat: MockAuthService validates invite code from IConfiguration"
  ```

---

### Task 4: AzureAuthService — invite code validation

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs`

- [ ] **Step 1: Add `IConfiguration` field and constructor parameter**

  Add field:
  ```csharp
  private readonly IConfiguration _configuration;
  ```

  The existing constructor signature is:
  ```csharp
  public AzureAuthService(
      TableServiceClient tableServiceClient,
      IJwtService jwtService,
      IPasswordHasher passwordHasher,
      JwtSettings jwtSettings,
      ILogger<AzureAuthService> logger,
      IEmailService emailService)
  ```

  Update to:
  ```csharp
  public AzureAuthService(
      TableServiceClient tableServiceClient,
      IJwtService jwtService,
      IPasswordHasher passwordHasher,
      JwtSettings jwtSettings,
      ILogger<AzureAuthService> logger,
      IEmailService emailService,
      IConfiguration configuration)
  ```

  Add in the constructor body (after `_emailService = emailService;`):
  ```csharp
  _configuration = configuration;
  ```

- [ ] **Step 2: Add invite code check at the top of `RegisterAsync`**

  Insert immediately before the `// Check if email already exists` comment:

  ```csharp
  // Invite code validation
  var configuredCode = _configuration["INVITE_CODE"];
  if (!string.IsNullOrEmpty(configuredCode))
  {
      if (request.InviteCode != configuredCode)
          throw new InvalidInviteCodeException();
  }
  ```

- [ ] **Step 3: Build to verify**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet build
  ```
  Expected: Build succeeded (or only DI errors in `Program.cs` pending Task 5).

- [ ] **Step 4: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs
  git commit -m "feat: AzureAuthService validates invite code from IConfiguration"
  ```

---

### Task 5: AuthController — new endpoint + exception handling + DI fix

**Files:**
- Modify: `Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs`
- Modify: `Lovecraft/Lovecraft.Backend/Program.cs`

- [ ] **Step 1: Inject `IConfiguration` into `AuthController`**

  Add the field:
  ```csharp
  private readonly IConfiguration _configuration;
  ```

  Update the constructor:
  ```csharp
  public AuthController(IAuthService authService, ILogger<AuthController> logger, IConfiguration configuration)
  {
      _authService = authService;
      _logger = logger;
      _configuration = configuration;
  }
  ```

- [ ] **Step 2: Add `GetRegistrationConfig` action**

  Add this action after the `Register` action:

  ```csharp
  /// <summary>
  /// Returns whether an invite code is required for registration
  /// </summary>
  [HttpGet("registration-config")]
  [AllowAnonymous]
  public ActionResult<ApiResponse<RegistrationConfigDto>> GetRegistrationConfig()
  {
      var inviteCodeRequired = !string.IsNullOrEmpty(_configuration["INVITE_CODE"]);
      return Ok(ApiResponse<RegistrationConfigDto>.SuccessResponse(new RegistrationConfigDto(inviteCodeRequired)));
  }
  ```

  Add the using at the top of the file:
  ```csharp
  using Lovecraft.Common.DTOs.Auth;
  ```
  (Already present — verify it is.)

- [ ] **Step 3: Handle `InvalidInviteCodeException` in `Register`**

  In the `Register` action, add a specific catch before the generic `Exception` catch:

  ```csharp
  catch (InvalidInviteCodeException)
  {
      return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse(
          "INVALID_INVITE_CODE",
          "Invalid invite code"));
  }
  catch (Exception ex)
  {
      _logger.LogError(ex, "Error during registration");
      return StatusCode(500, ApiResponse<AuthResponseDto>.ErrorResponse(
          "INTERNAL_ERROR",
          "Registration failed"));
  }
  ```

- [ ] **Step 4: Fix DI registration in `Program.cs`**

  The DI container auto-resolves `IConfiguration` — ASP.NET Core registers it by default, so no explicit registration is needed for the controller or the Azure service.

  For `MockAuthService`, it's registered as `AddSingleton<IAuthService, MockAuthService>()`. ASP.NET Core's DI will inject `IConfiguration` automatically since it is registered in the container.

  Verify `Program.cs` still builds (no manual constructor calls, pure DI). Run:

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet build
  ```
  Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.Backend/Controllers/V1/AuthController.cs
  git commit -m "feat: add GetRegistrationConfig endpoint and handle INVALID_INVITE_CODE in Register"
  ```

---

### Task 6: Backend unit tests

**Files:**
- Modify: `Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs`

- [ ] **Step 1: Add `IConfiguration` helpers and update existing constructor**

  Add `using Microsoft.Extensions.Configuration;` at the top.

  Add two static helper methods to `AuthenticationTests` class:

  ```csharp
  private static IConfiguration EmptyConfig() =>
      new ConfigurationBuilder().Build();

  private static IConfiguration WithInviteCode(string code) =>
      new ConfigurationBuilder()
          .AddInMemoryCollection(new Dictionary<string, string?> { ["INVITE_CODE"] = code })
          .Build();
  ```

  Update the existing constructor to pass `EmptyConfig()` as the 5th argument:

  ```csharp
  _authService = new MockAuthService(
      _jwtService,
      _passwordHasher,
      authLogger,
      new NullEmailService(NullLogger<NullEmailService>.Instance),
      EmptyConfig());
  ```

- [ ] **Step 2: Run existing tests to verify no regressions**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet test Lovecraft.UnitTests --verbosity normal
  ```
  Expected: All existing tests pass.

- [ ] **Step 3: Add invite code test cases**

  Add the following tests to the `AuthenticationTests` class:

  ```csharp
  [Fact]
  public async Task Register_WithNoInviteCodeConfigured_SucceedsRegardlessOfSubmittedCode()
  {
      // Arrange — empty config means validation is skipped
      var service = new MockAuthService(
          _jwtService, _passwordHasher,
          NullLogger<MockAuthService>.Instance,
          new NullEmailService(NullLogger<NullEmailService>.Instance),
          EmptyConfig());

      var request = new RegisterRequestDto
      {
          Email = "open-reg@example.com",
          Password = "Test123!@#",
          Name = "Open User",
          Age = 25, Location = "City", Gender = "Male", Bio = "",
          InviteCode = "anything"
      };

      // Act
      var result = await service.RegisterAsync(request);

      // Assert
      Assert.NotNull(result);
      Assert.Equal(request.Email, result.User.Email);
  }

  [Fact]
  public async Task Register_WithValidInviteCode_Succeeds()
  {
      // Arrange
      var service = new MockAuthService(
          _jwtService, _passwordHasher,
          NullLogger<MockAuthService>.Instance,
          new NullEmailService(NullLogger<NullEmailService>.Instance),
          WithInviteCode("SECRET123"));

      var request = new RegisterRequestDto
      {
          Email = "valid-invite@example.com",
          Password = "Test123!@#",
          Name = "Invited User",
          Age = 25, Location = "City", Gender = "Male", Bio = "",
          InviteCode = "SECRET123"
      };

      // Act
      var result = await service.RegisterAsync(request);

      // Assert
      Assert.NotNull(result);
      Assert.Equal(request.Email, result.User.Email);
  }

  [Fact]
  public async Task Register_WithWrongInviteCode_ThrowsInvalidInviteCodeException()
  {
      // Arrange
      var service = new MockAuthService(
          _jwtService, _passwordHasher,
          NullLogger<MockAuthService>.Instance,
          new NullEmailService(NullLogger<NullEmailService>.Instance),
          WithInviteCode("SECRET123"));

      var request = new RegisterRequestDto
      {
          Email = "wrong-invite@example.com",
          Password = "Test123!@#",
          Name = "Bad User",
          Age = 25, Location = "City", Gender = "Male", Bio = "",
          InviteCode = "WRONGCODE"
      };

      // Act & Assert
      await Assert.ThrowsAsync<InvalidInviteCodeException>(() => service.RegisterAsync(request));
  }

  [Fact]
  public async Task Register_WithNullInviteCodeWhenCodeConfigured_ThrowsInvalidInviteCodeException()
  {
      // Arrange
      var service = new MockAuthService(
          _jwtService, _passwordHasher,
          NullLogger<MockAuthService>.Instance,
          new NullEmailService(NullLogger<NullEmailService>.Instance),
          WithInviteCode("SECRET123"));

      var request = new RegisterRequestDto
      {
          Email = "null-invite@example.com",
          Password = "Test123!@#",
          Name = "Null Code User",
          Age = 25, Location = "City", Gender = "Male", Bio = "",
          InviteCode = null
      };

      // Act & Assert
      await Assert.ThrowsAsync<InvalidInviteCodeException>(() => service.RegisterAsync(request));
  }
  ```

- [ ] **Step 4: Run all tests**

  ```
  cd D:\src\lovecraft\Lovecraft
  dotnet test Lovecraft.UnitTests --verbosity normal
  ```
  Expected: All tests pass (16 existing + 4 new = 20 tests green).

- [ ] **Step 5: Commit**

  ```bash
  cd D:\src\lovecraft
  git add Lovecraft/Lovecraft.UnitTests/AuthenticationTests.cs
  git commit -m "test: add invite code test cases for MockAuthService"
  ```

---

### Task 7: Backend local `.env`

**Files:**
- Modify: `Lovecraft/Lovecraft/.env`

- [ ] **Step 1: Add `INVITE_CODE=` to local env**

  Open `D:\src\lovecraft\Lovecraft\.env` and append:

  ```env
  INVITE_CODE=
  ```

  Empty value → validation skipped locally. This matches the production default.

- [ ] **Step 2: Verify the backend starts correctly**

  ```
  cd D:\src\lovecraft\Lovecraft\Lovecraft.Backend
  dotnet run
  ```
  Expected: Application starts without error. `GET /api/v1/auth/registration-config` returns `{ "data": { "inviteCodeRequired": false } }`.

  Stop the server (Ctrl+C).

---

### Task 8: Frontend — Zod schema

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add `registerSchemaWithInvite` and its type**

  After the existing `export const registerSchema = ...` block (and its type export), add:

  ```typescript
  export const registerSchemaWithInvite = registerSchema.extend({
    inviteCode: z.string().min(1, 'Invite code is required'),
  });

  export type RegisterSchemaWithInvite = z.infer<typeof registerSchemaWithInvite>;
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git add src/lib/validators.ts
  git commit -m "feat: add registerSchemaWithInvite Zod schema"
  ```

---

### Task 9: Frontend — authApi changes

**Files:**
- Modify: `src/services/api/authApi.ts`

- [ ] **Step 1: Add `inviteCode?` to `RegisterRequest`**

  Find the `RegisterRequest` interface (or type) and add:

  ```typescript
  inviteCode?: string;
  ```

- [ ] **Step 2: Add `getRegistrationConfig` method**

  Add the following method to the `authApi` object (both mock and real implementations):

  ```typescript
  async getRegistrationConfig(): Promise<ApiResponse<{ inviteCodeRequired: boolean }>> {
    if (!isApiMode()) {
      return { success: true, data: { inviteCodeRequired: false }, timestamp: new Date().toISOString() };
    }
    return apiClient.get<{ inviteCodeRequired: boolean }>('/api/v1/auth/registration-config');
  },
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git add src/services/api/authApi.ts
  git commit -m "feat: add getRegistrationConfig to authApi and inviteCode to RegisterRequest"
  ```

---

### Task 10: i18n keys

**Files:**
- Modify: `src/contexts/LanguageContext.tsx`

- [ ] **Step 1: Add two translation keys**

  Find where `register.*` keys are defined in both the `ru` and `en` translation objects and add:

  **Russian:**
  ```
  'register.inviteCode': 'Инвайт-код',
  'register.inviteCodePlaceholder': 'Введите инвайт-код',
  ```

  **English:**
  ```
  'register.inviteCode': 'Invite code',
  'register.inviteCodePlaceholder': 'Enter invite code',
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git add src/contexts/LanguageContext.tsx
  git commit -m "feat: add invite code i18n keys"
  ```

---

### Task 11: Welcome.tsx — conditional invite code field

**Files:**
- Modify: `src/pages/Welcome.tsx`

- [ ] **Step 1: Add imports**

  Add to the existing imports:

  ```typescript
  import { registerSchemaWithInvite, type RegisterSchemaWithInvite } from '@/lib/validators';
  ```

- [ ] **Step 2: Add `inviteCodeRequired` state**

  Inside the `Welcome` component, alongside existing state, add:

  ```typescript
  const [inviteCodeRequired, setInviteCodeRequired] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  ```

- [ ] **Step 3: Fetch registration config when register form opens**

  The register tab visibility is controlled by `showRegister`. Add a `useEffect` that fires when `showRegister` becomes `true`:

  ```typescript
  useEffect(() => {
    if (!showRegister) return;
    setConfigLoading(true);
    authApi.getRegistrationConfig()
      .then((res) => {
        if (res.success && res.data) setInviteCodeRequired(res.data.inviteCodeRequired);
      })
      .catch(() => {
        // Fail open — field hidden, registration remains usable
        console.error('Failed to fetch registration config');
      })
      .finally(() => setConfigLoading(false));
  }, [showRegister]);
  ```

- [ ] **Step 4: Use dynamic schema in `useForm`**

  The `registerForm` is currently:
  ```typescript
  const registerForm = useForm<RegisterSchema>({ resolver: zodResolver(registerSchema), mode: 'onBlur' });
  ```

  Replace with a union type and dynamic resolver. Since `useForm` is called at the top of the component (before `showRegister` is known at render time), use a ref pattern — re-register the form when `inviteCodeRequired` changes:

  ```typescript
  const registerForm = useForm<RegisterSchema | RegisterSchemaWithInvite>({
    resolver: zodResolver(inviteCodeRequired ? registerSchemaWithInvite : registerSchema),
    mode: 'onBlur',
  });
  ```

  > **Note:** react-hook-form's `resolver` is read at form creation and not reactive. To make it reactive, call `registerForm.clearErrors()` and rely on Zod revalidation on submit. Since `inviteCodeRequired` changes before the user fills the form (it's fetched on mount of the register tab), the resolver will be correct. No extra action needed.

- [ ] **Step 5: Show loading spinner while config is loading**

  Find the register form JSX. Wrap the form body with a conditional:

  ```tsx
  {configLoading ? (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ) : (
    // ... existing form fields ...
  )}
  ```

- [ ] **Step 6: Add invite code field**

  Inside the form (after the location field, before the submit button), add:

  ```tsx
  {inviteCodeRequired && (
    <div>
      <Input
        placeholder={t('register.inviteCodePlaceholder')}
        {...registerForm.register('inviteCode')}
      />
      {registerForm.formState.errors.inviteCode && (
        <p className="text-xs text-destructive mt-1" role="alert">
          {registerForm.formState.errors.inviteCode.message}
        </p>
      )}
    </div>
  )}
  ```

- [ ] **Step 7: Handle `INVALID_INVITE_CODE` in submit handler**

  In `handleRegister`, find the existing error handling (currently only handles `EMAIL_TAKEN`). Update it:

  ```typescript
  if (!res.success) {
    if (res.error?.code === 'EMAIL_TAKEN') {
      registerForm.setError('email', { message: res.error.message ?? 'Email already in use' });
    } else if (res.error?.code === 'INVALID_INVITE_CODE') {
      registerForm.setError('inviteCode', { message: res.error.message ?? 'Invalid invite code' });
    } else {
      showApiError(res, 'Registration failed');
    }
    return;
  }
  ```

- [ ] **Step 8: Type-check**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run type-check
  ```
  Expected: No errors (adjust the form type annotation if TypeScript complains — `useForm<RegisterSchema & Partial<RegisterSchemaWithInvite>>` is a valid alternative if union causes issues).

- [ ] **Step 9: Commit**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git add src/pages/Welcome.tsx
  git commit -m "feat: conditionally show invite code field in registration form"
  ```

---

### Task 12: Frontend tests

**Files:**
- Modify: `src/pages/__tests__/Welcome.test.tsx`

- [ ] **Step 1: Add `getRegistrationConfig` to the `authApi` mock**

  Update the existing `vi.mock('@/services/api', ...)` block:

  ```typescript
  vi.mock('@/services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/api')>();
    return {
      ...actual,
      authApi: { login: vi.fn(), register: vi.fn(), getRegistrationConfig: vi.fn() },
    };
  });
  ```

- [ ] **Step 2: Set default mock return value in `beforeEach`**

  In the existing `beforeEach` block, add:

  ```typescript
  vi.mocked(authApi.getRegistrationConfig).mockResolvedValue({
    success: true,
    data: { inviteCodeRequired: false },
    timestamp: new Date().toISOString(),
  });
  ```

  This ensures existing register tests see no invite field by default.

- [ ] **Step 3: Run existing tests to confirm no regressions**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run test:run -- src/pages/__tests__/Welcome.test.tsx
  ```
  Expected: All existing tests pass.

- [ ] **Step 4: Add invite code test cases**

  Add a new `describe` block after the existing `'Welcome — register form'` block:

  ```typescript
  describe('Welcome — register form — invite code', () => {
    async function openRegisterForm(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /auth\.noAccount/i }));
      // Wait for the config fetch to complete
      await waitFor(() => {
        expect(authApi.getRegistrationConfig).toHaveBeenCalled();
      });
    }

    it('does not render invite code field when inviteCodeRequired is false', async () => {
      vi.mocked(authApi.getRegistrationConfig).mockResolvedValueOnce({
        success: true,
        data: { inviteCodeRequired: false },
        timestamp: new Date().toISOString(),
      });
      const user = userEvent.setup();
      renderWithProviders(<Welcome />);
      await openRegisterForm(user);
      expect(screen.queryByPlaceholderText(/register\.inviteCodePlaceholder/i)).not.toBeInTheDocument();
    });

    it('renders invite code field when inviteCodeRequired is true', async () => {
      vi.mocked(authApi.getRegistrationConfig).mockResolvedValueOnce({
        success: true,
        data: { inviteCodeRequired: true },
        timestamp: new Date().toISOString(),
      });
      const user = userEvent.setup();
      renderWithProviders(<Welcome />);
      await openRegisterForm(user);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/register\.inviteCodePlaceholder/i)).toBeInTheDocument();
      });
    });

    it('shows inline Zod error when invite code field is visible but empty on submit', async () => {
      vi.mocked(authApi.getRegistrationConfig).mockResolvedValueOnce({
        success: true,
        data: { inviteCodeRequired: true },
        timestamp: new Date().toISOString(),
      });
      const user = userEvent.setup();
      renderWithProviders(<Welcome />);
      await openRegisterForm(user);
      // Fill all fields except invite code
      await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
      await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'Secure1!');
      await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
      await user.selectOptions(screen.getByTestId('gender-select'), 'female');
      await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
      await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(authApi.register).not.toHaveBeenCalled();
      });
    });

    it('includes inviteCode in payload when field is visible and filled', async () => {
      vi.mocked(authApi.getRegistrationConfig).mockResolvedValueOnce({
        success: true,
        data: { inviteCodeRequired: true },
        timestamp: new Date().toISOString(),
      });
      vi.mocked(authApi.register).mockResolvedValueOnce({ success: true });
      const user = userEvent.setup();
      renderWithProviders(<Welcome />);
      await openRegisterForm(user);
      await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
      await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'Secure1!');
      await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
      await user.selectOptions(screen.getByTestId('gender-select'), 'female');
      await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/register\.inviteCodePlaceholder/i)).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText(/register\.inviteCodePlaceholder/i), 'MYCODE');
      await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith(
          expect.objectContaining({ inviteCode: 'MYCODE' })
        );
      });
    });

    it('sets inline error on invite code field for INVALID_INVITE_CODE response', async () => {
      vi.mocked(authApi.getRegistrationConfig).mockResolvedValueOnce({
        success: true,
        data: { inviteCodeRequired: true },
        timestamp: new Date().toISOString(),
      });
      vi.mocked(authApi.register).mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_INVITE_CODE', message: 'Invalid invite code' },
      });
      const user = userEvent.setup();
      renderWithProviders(<Welcome />);
      await openRegisterForm(user);
      await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
      await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'Secure1!');
      await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
      await user.selectOptions(screen.getByTestId('gender-select'), 'female');
      await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/register\.inviteCodePlaceholder/i)).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText(/register\.inviteCodePlaceholder/i), 'WRONG');
      await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalled();
      });
    });
  });
  ```

- [ ] **Step 5: Run all frontend tests**

  ```bash
  cd D:\src\aloevera-harmony-meet
  npm run test:run -- src/pages/__tests__/Welcome.test.tsx
  ```
  Expected: All tests pass (existing + 5 new).

- [ ] **Step 6: Commit**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git add src/pages/__tests__/Welcome.test.tsx
  git commit -m "test: add invite code tests for Welcome registration form"
  ```

---

### Task 13: Push + redeploy to Azure VM

- [ ] **Step 1: Push backend**

  ```bash
  cd D:\src\lovecraft
  git push
  ```

- [ ] **Step 2: Push frontend**

  ```bash
  cd D:\src\aloevera-harmony-meet
  git push
  ```

- [ ] **Step 3: SSH to VM, pull both repos, add env var, rebuild**

  ```bash
  ssh -i D:\src\misc\vm\april2026key.pem amorofrost@20.153.164.3
  ```

  On the VM:
  ```bash
  cd ~/src/aloevera-harmony-meet && git pull
  cd ~/src/lovecraft && git pull
  # Add INVITE_CODE to .env (leave empty for open registration, or set a value)
  echo "INVITE_CODE=" >> ~/src/lovecraft/Lovecraft/.env
  # Rebuild and restart
  cd ~/src/aloevera-harmony-meet
  docker compose down && docker compose up --build -d
  ```

- [ ] **Step 4: Verify deployment**

  ```bash
  docker compose -f ~/src/aloevera-harmony-meet/docker-compose.yml ps
  curl -s https://aloeve.club/api/v1/auth/registration-config
  ```
  Expected: `{"success":true,"data":{"inviteCodeRequired":false},...}`

  Open `https://aloeve.club` in a browser, navigate to register — confirm the invite code field is **not** shown (since `INVITE_CODE` is empty on the VM).

- [ ] **Step 5: Update `VM_DEPLOYMENT.md` with the new env var**

  In `D:\src\misc\VM_DEPLOYMENT.md`, in the **Backend `.env` File** section, add `INVITE_CODE=` to the example block:

  ```env
  USE_AZURE_STORAGE=true
  AZURE_STORAGE_CONNECTION_STRING=...
  JWT_SECRET_KEY=...
  SENDGRID_API_KEY=
  FROM_EMAIL=noreply@aloeband.ru
  FRONTEND_BASE_URL=https://aloeve.club
  INVITE_CODE=
  ```

  Also add a note under the env section:
  > `INVITE_CODE` — leave empty for open registration; set to a non-empty string to gate registration behind a single invite code.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `INVITE_CODE` env var, empty = open | Task 7 + Task 13 |
| `GET /api/v1/auth/registration-config` public endpoint | Task 5 |
| `inviteCodeRequired` bool in response | Task 5 |
| `InviteCode?` on `RegisterRequestDto` | Task 1 |
| `RegistrationConfigDto` | Task 1 |
| `MockAuthService` validates code | Task 3 |
| `AzureAuthService` validates code | Task 4 |
| `INVALID_INVITE_CODE` error code | Task 5 |
| `registerSchemaWithInvite` Zod schema | Task 8 |
| `getRegistrationConfig` in authApi | Task 9 |
| `inviteCode?` on `RegisterRequest` | Task 9 |
| i18n keys | Task 10 |
| Fetch config on register tab open | Task 11 |
| Spinner while loading | Task 11 |
| Conditional field render | Task 11 |
| `INVALID_INVITE_CODE` inline field error | Task 11 |
| Fail-open if config fetch fails | Task 11 |
| Backend tests (all 6 cases) | Task 6 |
| Frontend tests (all 5 cases) | Task 12 |
| Deploy + add env to VM | Task 13 |
| Update `VM_DEPLOYMENT.md` | Task 13 |

All requirements covered. No placeholders found.
