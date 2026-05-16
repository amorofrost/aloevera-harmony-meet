# Secondary Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional secondary `country`/`region` slot to user profiles, with inline both-locations display, boolean-OR search/filter matching, and cross-slot common-ground detection.

**Architecture:** Mirror the existing primary `Country`/`Region` shape: two more nullable storage columns, two more DTO fields, two more Zod-validated form fields. New `<DualLocationPicker>` wrapper composes two existing `<CountryRegionPicker>`s with a collapsed-by-default UX. `<LocationDisplay>` accepts secondary props and renders `primary · secondary` inline. Filter predicate broadens to OR-match either slot; `commonGround.ts` scans all four cross-slot pairings.

**Tech Stack:** .NET 10 / Azure Table Storage (backend); React 18 + TypeScript + Vite + shadcn/ui + cmdk (frontend); xUnit + Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-16-secondary-location-design.md`](../specs/2026-05-16-secondary-location-design.md)

**Predecessor:** [`docs/superpowers/plans/2026-05-15-country-region-location.md`](./2026-05-15-country-region-location.md)

**Repos:**
- Backend: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)
- Frontend: `D:\src\aloevera-harmony-meet` (commits via `git -C 'D:\src\aloevera-harmony-meet'`)

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'`
- Frontend (from `D:\src\aloevera-harmony-meet`): `npx vitest run <path>` or `npm run test:run`

---

## File map

### Backend (`D:\src\lovecraft\Lovecraft\`)
| File | Change |
|---|---|
| `Lovecraft.Backend\Storage\Entities\UserEntity.cs` | + `SecondaryCountry`, `SecondaryRegion` |
| `Lovecraft.Common\DTOs\Users\UserDto.cs` | + `SecondaryCountry`, `SecondaryRegion` |
| `Lovecraft.Common\DTOs\Auth\AuthDtos.cs` | + `SecondaryCountry?`, `SecondaryRegion?` on 4 register-request DTOs |
| `Lovecraft.Backend\Controllers\V1\UsersController.cs` | + length + HtmlGuard checks for secondary fields |
| `Lovecraft.Backend\Services\Azure\AzureUserService.cs` | OR-match filter; write secondary in `UpdateUserAsync`; emit secondary in `ToDto` |
| `Lovecraft.Backend\Services\MockUserService.cs` | same |
| `Lovecraft.Backend\Services\Azure\AzureAuthService.cs` | write secondary on every register path |
| `Lovecraft.Backend\Services\MockAuthService.cs` | same |
| `Lovecraft.Backend\MockData\MockDataStore.cs` | give 2 mocks secondary locations |
| `Lovecraft.Tools.Seeder\Program.cs` | propagate secondary fields |
| `Lovecraft.UnitTests\UsersControllerUpdateTests.cs` | + 5 cases |
| `Lovecraft.UnitTests\AzureUserServiceFilterTests.cs` | + 3 OR-match cases |

### Frontend (`D:\src\aloevera-harmony-meet\`)
| File | Change |
|---|---|
| `src\components\ui\dual-location-picker.tsx` | new wrapper |
| `src\components\ui\__tests__\dual-location-picker.test.tsx` | new smoke test |
| `src\components\ui\location-display.tsx` | + secondary props + inline separator render |
| `src\types\user.ts` | + `secondaryCountry?`, `secondaryRegion?` |
| `src\lib\validators.ts` | + secondary fields in 3 schemas |
| `src\lib\__tests__\validators.test.ts` | + cases |
| `src\lib\commonGround.ts` | 4-way slot scan |
| `src\lib\__tests__\commonGround.test.ts` | + cross-slot cases |
| `src\services\api\usersApi.ts` | round-trip secondary; mock-mode OR filter |
| `src\services\api\authApi.ts` | register-request types gain secondary fields |
| `src\pages\Welcome.tsx` | swap to DualLocationPicker; defaults + errors |
| `src\pages\WelcomeTelegram.tsx` | same |
| `src\pages\WelcomeGoogle.tsx` | same |
| `src\pages\MiniAppEntry.tsx` | same |
| `src\pages\SettingsPage.tsx` | DualLocationPicker in edit; LocationDisplay with secondary in header |
| `src\pages\__tests__\Welcome.test.tsx` | swap the `country-region-picker` mock to `dual-location-picker` |
| `src\pages\Friends.tsx` | LocationDisplay calls pass secondary props (3 spots) |
| `src\contexts\LanguageContext.tsx` | + 3 i18n keys |
| `src\data\mockUsers.ts` | + secondary on Анна (TH/Пхукет); Sarah (RU/Москва) |
| `src\data\mockProfiles.ts` | mirror mockUsers |

### Docs
| File | Change |
|---|---|
| `aloevera-harmony-meet\docs\FEATURES.md` | mention secondary location in profile + filter behavior |
| `aloevera-harmony-meet\docs\ARCHITECTURE.md` | add `secondaryCountry`/`secondaryRegion` to User block; mention `<DualLocationPicker>` |
| `aloevera-harmony-meet\AGENTS.md` | add `<DualLocationPicker>` to custom-components list |
| `lovecraft\Lovecraft\docs\AZURE_STORAGE.md` | add `SecondaryCountry`, `SecondaryRegion` to users notable-fields |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | one-line entry |

---

## Task ordering

Backend first, then frontend foundations, then components, then form/display rewires, then docs.

Tasks 1-6 are backend. Tasks 7-17 are frontend. Task 18 is docs. Task 19 is final verification.

---

## Task 1: Add `SecondaryCountry` + `SecondaryRegion` to `UserEntity` and `UserDto`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\UserEntity.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Users\UserDto.cs`

Pure shape change. No tests.

- [ ] **Step 1: Add the two properties to UserEntity**

In `UserEntity.cs`, insert after the existing `Region` line:

```csharp
public string Country { get; set; } = string.Empty;
public string Region { get; set; } = string.Empty;
public string SecondaryCountry { get; set; } = string.Empty;
public string SecondaryRegion { get; set; } = string.Empty;
```

- [ ] **Step 2: Add the two properties to UserDto**

In `UserDto.cs`, insert after the existing `Region` line:

```csharp
public string Country { get; set; } = string.Empty;
public string Region { get; set; } = string.Empty;
public string SecondaryCountry { get; set; } = string.Empty;
public string SecondaryRegion { get; set; } = string.Empty;
```

- [ ] **Step 3: Build**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs
git -C 'D:\src\lovecraft' commit -m "users: add SecondaryCountry and SecondaryRegion fields"
```

---

## Task 2: Thread `SecondaryCountry`/`SecondaryRegion` through service layer

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs` (`UpdateUserAsync`, `ToDto`)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs` (`UpdateUserAsync`)

- [ ] **Step 1: Update `AzureUserService.UpdateUserAsync` to write secondary fields**

In `AzureUserService.cs`, find the block where `entity.Country = dto.Country ?? string.Empty;` is set (~line 81). After the `entity.Region = ...` line, add:

```csharp
entity.SecondaryCountry = dto.SecondaryCountry ?? string.Empty;
entity.SecondaryRegion = dto.SecondaryRegion ?? string.Empty;
```

- [ ] **Step 2: Update `AzureUserService.ToDto` to emit secondary fields**

In `AzureUserService.cs`, find the `ToDto` block where `Country = entity.Country, Region = entity.Region,` are set (~line 224). Add immediately after:

```csharp
Country = entity.Country,
Region = entity.Region,
SecondaryCountry = entity.SecondaryCountry,
SecondaryRegion = entity.SecondaryRegion,
```

- [ ] **Step 3: Update `MockUserService.UpdateUserAsync`**

In `MockUserService.cs`, find where `existing.Country = user.Country ?? string.Empty;` is set (~line 46). Add immediately after:

```csharp
existing.SecondaryCountry = user.SecondaryCountry ?? string.Empty;
existing.SecondaryRegion = user.SecondaryRegion ?? string.Empty;
```

If `MockUserService` builds `UserDto` anywhere, add `SecondaryCountry` / `SecondaryRegion` there too. (Grep for `new UserDto` in this file.)

- [ ] **Step 4: Build and run full test suite**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: build succeeds, all 283 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.Backend/Services/MockUserService.cs
git -C 'D:\src\lovecraft' commit -m "users: thread Secondary Country/Region through service layer"
```

---

## Task 3: OR-match filter via TDD

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AzureUserServiceFilterTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs` (`GetUsersAsync` body)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs` (`GetUsersAsync` body)

- [ ] **Step 1: Write 3 failing tests**

Read `AzureUserServiceFilterTests.cs` first to see the existing test pattern (`MakeUser` helper, `TestServiceFactory.CreateAzureUserService(cache)`). Extend `MakeUser` to accept optional secondary fields:

```csharp
private static UserEntity MakeUser(
    string id, string country, string region,
    string secondaryCountry = "", string secondaryRegion = "") => new()
{
    PartitionKey = UserEntity.GetPartitionKey(id),
    RowKey = id,
    Name = id,
    Country = country,
    Region = region,
    SecondaryCountry = secondaryCountry,
    SecondaryRegion = secondaryRegion,
    StaffRole = "none",
};
```

Append these three `[Fact]` tests:

```csharp
[Fact]
public async Task GetUsersAsync_MatchesUserViaSecondaryCountry()
{
    var cache = new UserCache();
    cache.Set(MakeUser("u1", "US", "California", "RU", "Москва"));
    cache.Set(MakeUser("u2", "DE", "Berlin"));

    var svc = TestServiceFactory.CreateAzureUserService(cache);

    var ru = await svc.GetUsersAsync(0, 100, country: "RU");
    Assert.Single(ru);
    Assert.Equal("u1", ru[0].Id);
}

[Fact]
public async Task GetUsersAsync_MatchesUserViaSecondaryCountryAndRegion()
{
    var cache = new UserCache();
    cache.Set(MakeUser("u1", "US", "California", "RU", "Москва"));
    cache.Set(MakeUser("u2", "RU", "Санкт-Петербург"));
    cache.Set(MakeUser("u3", "DE", "Berlin"));

    var svc = TestServiceFactory.CreateAzureUserService(cache);

    var moscow = await svc.GetUsersAsync(0, 100, country: "RU", region: "Москва");
    Assert.Single(moscow);
    Assert.Equal("u1", moscow[0].Id);
}

[Fact]
public async Task GetUsersAsync_DoesNotCrossSlotMix()
{
    // primary RU + secondary US/Москва. Filter for RU/Москва should NOT match
    // because RU is in slot A but Москва is in slot B.
    var cache = new UserCache();
    cache.Set(MakeUser("u1", "RU", "Санкт-Петербург", "US", "Москва"));

    var svc = TestServiceFactory.CreateAzureUserService(cache);

    var moscow = await svc.GetUsersAsync(0, 100, country: "RU", region: "Москва");
    Assert.Empty(moscow);
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureUserServiceFilterTests"
```

Expected: 3 new FAILs (existing 4 filter tests still pass).

- [ ] **Step 3: Implement OR-match in `AzureUserService.GetUsersAsync`**

Replace the existing filter body (the two single-slot `.Where` blocks) with three-branch logic:

```csharp
public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10, string? country = null, string? region = null)
{
    var config = await _appConfig.GetConfigAsync();
    var all = _cache.GetAll();

    var hasCountry = !string.IsNullOrWhiteSpace(country);
    var hasRegion = !string.IsNullOrWhiteSpace(region);

    if (hasCountry && hasRegion)
    {
        all = all.Where(e =>
            (string.Equals(e.Country, country, StringComparison.OrdinalIgnoreCase) &&
             string.Equals(e.Region,  region,  StringComparison.OrdinalIgnoreCase)) ||
            (string.Equals(e.SecondaryCountry, country, StringComparison.OrdinalIgnoreCase) &&
             string.Equals(e.SecondaryRegion,  region,  StringComparison.OrdinalIgnoreCase))
        ).ToList();
    }
    else if (hasCountry)
    {
        all = all.Where(e =>
            string.Equals(e.Country, country, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(e.SecondaryCountry, country, StringComparison.OrdinalIgnoreCase)
        ).ToList();
    }
    else if (hasRegion)
    {
        all = all.Where(e =>
            string.Equals(e.Region, region, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(e.SecondaryRegion, region, StringComparison.OrdinalIgnoreCase)
        ).ToList();
    }

    // Fisher-Yates shuffle so the swipe deck ordering is random per request
    for (int i = all.Count - 1; i > 0; i--)
    {
        int j = Random.Shared.Next(i + 1);
        (all[i], all[j]) = (all[j], all[i]);
    }
    return all.Skip(skip).Take(take).Select(e => ToDto(e, config.Ranks)).ToList();
}
```

- [ ] **Step 4: Apply same OR-match to `MockUserService.GetUsersAsync`**

In `MockUserService.cs`, replace the current single-slot filter chain (the two `.Where` clauses added by the predecessor) with the same three-branch logic over `MockDataStore.Users` (or whatever the mock service iterates). Property names match because `UserDto` and `UserEntity` both carry `SecondaryCountry`/`SecondaryRegion`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureUserServiceFilterTests"
```

Expected: 7 PASS (4 existing + 3 new).

- [ ] **Step 6: Run the full suite**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: 286 PASS (283 + 3 new).

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.UnitTests/AzureUserServiceFilterTests.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.Backend/Services/MockUserService.cs
git -C 'D:\src\lovecraft' commit -m "users: OR-match filter across primary and secondary slots"
```

---

## Task 4: Controller validation + tests for secondary fields

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\UsersControllerUpdateTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\UsersController.cs`

- [ ] **Step 1: Write 5 failing tests**

Append these tests using the existing `BaseValidDto()` helper pattern:

```csharp
[Fact]
public async Task UpdateUser_AcceptsSecondaryCountryAndRegion()
{
    var (client, userId) = await SignInAsTestUser();
    var body = BaseValidDto(userId) with { Country = "RU", Region = "Москва", SecondaryCountry = "TH", SecondaryRegion = "Пхукет" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    resp.EnsureSuccessStatusCode();
    var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("TH", dto!.Data!.SecondaryCountry);
    Assert.Equal("Пхукет", dto.Data.SecondaryRegion);
}

[Fact]
public async Task UpdateUser_RejectsSecondaryCountryWithHtml()
{
    var (client, userId) = await SignInAsTestUser();
    var body = BaseValidDto(userId) with { SecondaryCountry = "<b>TH</b>" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("HTML_NOT_ALLOWED", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsSecondaryRegionWithHtml()
{
    var (client, userId) = await SignInAsTestUser();
    var body = BaseValidDto(userId) with { SecondaryRegion = "<i>Phuket</i>" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("HTML_NOT_ALLOWED", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsSecondaryCountryTooLong()
{
    var (client, userId) = await SignInAsTestUser();
    var body = BaseValidDto(userId) with { SecondaryCountry = new string('a', 57) };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("SECONDARY_COUNTRY_TOO_LONG", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsSecondaryRegionTooLong()
{
    var (client, userId) = await SignInAsTestUser();
    var body = BaseValidDto(userId) with { SecondaryRegion = new string('a', 81) };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("SECONDARY_REGION_TOO_LONG", err!.Error!.Code);
}
```

Adjust `BaseValidDto` if it doesn't currently expose `Country`/`Region`/`SecondaryCountry`/`SecondaryRegion` as updatable fields (read the helper first; it likely uses `UserDto` directly, so the `with` pattern works automatically).

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~UsersControllerUpdateTests"
```

Expected: 5 new FAILs (existing tests still pass).

- [ ] **Step 3: Add validation in `UsersController.UpdateUser`**

In `UsersController.cs`, find the existing `COUNTRY_TOO_LONG` / `REGION_TOO_LONG` / `HTML_NOT_ALLOWED` block for primary country/region. Immediately after, add:

```csharp
if (!string.IsNullOrEmpty(user.SecondaryCountry) && user.SecondaryCountry.Length > 56)
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("SECONDARY_COUNTRY_TOO_LONG", "Secondary country must be 56 characters or less"));
if (!string.IsNullOrEmpty(user.SecondaryRegion) && user.SecondaryRegion.Length > 80)
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("SECONDARY_REGION_TOO_LONG", "Secondary region must be 80 characters or less"));
if (HtmlGuard.ContainsHtml(user.SecondaryCountry))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in secondary country"));
if (HtmlGuard.ContainsHtml(user.SecondaryRegion))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in secondary region"));
```

(Length checks before HTML checks so the more specific error wins.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~UsersControllerUpdateTests"
```

Expected: all PASS.

- [ ] **Step 5: Run full suite**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: 291 PASS (286 + 5 new).

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.UnitTests/UsersControllerUpdateTests.cs Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs
git -C 'D:\src\lovecraft' commit -m "users: validate SecondaryCountry/SecondaryRegion on update"
```

---

## Task 5: Auth provisioning + register-request DTOs

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Auth\AuthDtos.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureAuthService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockAuthService.cs`

- [ ] **Step 1: Add fields to register-request DTOs**

In `AuthDtos.cs`, find the four register-request DTOs (`RegisterRequestDto`, `TelegramRegisterRequestDto`, `TelegramMiniAppRegisterRequestDto`, `GoogleRegisterRequestDto`). Each currently has `Country?` and `Region?` properties (added by the predecessor). After each pair, add:

```csharp
public string? SecondaryCountry { get; init; }
public string? SecondaryRegion { get; init; }
```

(Match `{ get; set; }` vs `{ get; init; }` to whatever the existing `Country?` field uses in each DTO.)

- [ ] **Step 2: Update auth-service register paths**

Find every spot in `AzureAuthService.cs` and `MockAuthService.cs` that writes:

```csharp
Country = request.Country ?? string.Empty,
Region = request.Region ?? string.Empty,
```

Append two lines:

```csharp
Country = request.Country ?? string.Empty,
Region = request.Region ?? string.Empty,
SecondaryCountry = request.SecondaryCountry ?? string.Empty,
SecondaryRegion = request.SecondaryRegion ?? string.Empty,
```

Use Grep to find all occurrences:

```bash
grep -rn 'Country = request.Country' 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\'
```

You should find 4 spots in `AzureAuthService.cs` (Register, TelegramRegister, MiniAppRegister bridge, GoogleRegister) and 4 in `MockAuthService.cs`. Update all 8.

- [ ] **Step 3: Build and run tests**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: build clean, 291 tests pass.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Common/DTOs/Auth/AuthDtos.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs
git -C 'D:\src\lovecraft' commit -m "auth: write SecondaryCountry/SecondaryRegion on register"
```

---

## Task 6: Seed secondary locations in MockDataStore + Seeder

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\MockData\MockDataStore.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Tools.Seeder\Program.cs`

- [ ] **Step 1: Give Anna a secondary location in MockDataStore.cs**

Find the seed user Анна (id likely `1` or `mock-user-1`, has `Country = "RU"`, `Region = "Москва"`). Add to her seed:

```csharp
Country = "RU",
Region = "Москва",
SecondaryCountry = "TH",
SecondaryRegion = "Пхукет",
```

- [ ] **Step 2: Update Seeder Program.cs**

The `SeedUserAsync` helper currently takes `country` and `region` parameters (added by the predecessor). Extend it with optional secondary params:

```csharp
private static async Task SeedUserAsync(
    /* existing params */
    string country = "",
    string region = "",
    string secondaryCountry = "",
    string secondaryRegion = "")
{
    // Inside the UserEntity construction:
    Country = country,
    Region = region,
    SecondaryCountry = secondaryCountry,
    SecondaryRegion = secondaryRegion,
    // ...
}
```

At the Анна call site, pass `secondaryCountry: "TH", secondaryRegion: "Пхукет"`. Mock-users loop should pass through `u.SecondaryCountry` / `u.SecondaryRegion`.

- [ ] **Step 3: Build**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

Expected: `Build succeeded.`

- [ ] **Step 4: Run full test suite**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: 291 PASS.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs Lovecraft/Lovecraft.Tools.Seeder/Program.cs
git -C 'D:\src\lovecraft' commit -m "seed: give Anna a secondary location (TH/Пхукет)"
```

---

## Task 7: Frontend — extend `User` type and validator schemas

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\types\user.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\validators.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`

- [ ] **Step 1: Add `secondaryCountry`/`secondaryRegion` to `User` type**

In `src/types/user.ts`, find the `User` interface (already has `country` and `region`). Add immediately after `region`:

```typescript
country: string;
region: string;
/** ISO-3166-1 alpha-2 code or custom free-text label for the secondary slot; empty when unset. */
secondaryCountry?: string;
/** Free text up to 80 chars for the secondary slot; empty when unset. */
secondaryRegion?: string;
```

- [ ] **Step 2: Update Zod schemas in validators.ts**

In `src/lib/validators.ts`, find `registerSchema`, `profileEditSchema`, `telegramRegisterSchema`. After each pair of `country` + `region` fields, add:

```typescript
secondaryCountry: z.string().max(56, 'Secondary country must be 56 characters or less').optional(),
secondaryRegion: z.string().max(80, 'Secondary region must be 80 characters or less').optional(),
```

(The `googleRegisterSchema = telegramRegisterSchema` reference inherits automatically. Similarly for the `*WithInvite` extensions.)

- [ ] **Step 3: Add validator tests**

In `src/lib/__tests__/validators.test.ts`, append:

```typescript
describe('secondary country/region in registerSchema', () => {
  const base = {
    email: 'a@b.co',
    password: 'Aa1!aaaa',
    name: 'X',
    age: 25,
    country: 'RU',
    region: 'Москва',
    gender: 'male',
  };

  it('accepts secondary country and region', () => {
    expect(registerSchema.safeParse({ ...base, secondaryCountry: 'TH', secondaryRegion: 'Пхукет' }).success).toBe(true);
  });

  it('accepts absent secondary fields', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects secondaryCountry longer than 56 chars', () => {
    expect(registerSchema.safeParse({ ...base, secondaryCountry: 'a'.repeat(57) }).success).toBe(false);
  });

  it('rejects secondaryRegion longer than 80 chars', () => {
    expect(registerSchema.safeParse({ ...base, secondaryRegion: 'a'.repeat(81) }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: all tests pass (52 existing + 4 new = 56).

- [ ] **Step 5: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors related to types/validators. (Pre-existing errors elsewhere are fine — addressed by later tasks.)

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/types/user.ts src/lib/validators.ts src/lib/__tests__/validators.test.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "users: secondaryCountry/secondaryRegion on User + validator schemas"
```

---

## Task 8: Frontend — `usersApi.ts` round-trip + mock-mode OR filter

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\usersApi.ts`

- [ ] **Step 1: Update `mapUserFromApi`**

Add to the returned object (after `region`):

```typescript
country: dto.country ?? '',
region: dto.region ?? '',
secondaryCountry: dto.secondaryCountry ?? '',
secondaryRegion: dto.secondaryRegion ?? '',
```

- [ ] **Step 2: Update `mapUserToApi`**

Add to the payload (after `region`):

```typescript
country: u.country,
region: u.region,
secondaryCountry: u.secondaryCountry,
secondaryRegion: u.secondaryRegion,
```

- [ ] **Step 3: Update mock-mode filter in `getUsers`**

The current mock-mode filter is two single-slot `.filter` chains. Replace with three branches matching the backend OR-match logic:

```typescript
async getUsers(opts: { skip?: number; take?: number; country?: string; region?: string } = {}): Promise<ApiResponse<User[]>> {
  const { skip = 0, take = 100, country, region } = opts;
  if (isApiMode()) {
    const params = new URLSearchParams({ skip: String(skip), take: String(take) });
    if (country) params.set('country', country);
    if (region) params.set('region', region);
    const res = await apiClient.get<any[]>(`/api/v1/users?${params.toString()}`);
    if (res.success && res.data) {
      return { ...res, data: res.data.map(mapUserFromApi) };
    }
    return res as ApiResponse<User[]>;
  }
  // mock-mode OR-match filter
  const ci = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  let list = mockSearchProfiles;
  if (country && region) {
    list = list.filter(u =>
      (ci(u.country, country) && ci(u.region, region)) ||
      (ci(u.secondaryCountry, country) && ci(u.secondaryRegion, region))
    );
  } else if (country) {
    list = list.filter(u => ci(u.country, country) || ci(u.secondaryCountry, country));
  } else if (region) {
    list = list.filter(u => ci(u.region, region) || ci(u.secondaryRegion, region));
  }
  return mockSuccess(list.slice(skip, skip + take));
},
```

- [ ] **Step 4: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep -i usersApi | head -5
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/services/api/usersApi.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "users: round-trip secondary fields; mock-mode OR filter"
```

---

## Task 9: Frontend — `authApi.ts` register payloads include secondary fields

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\authApi.ts`

- [ ] **Step 1: Survey current register request types**

```bash
grep -n 'country:' D:\src\aloevera-harmony-meet\src\services\api\authApi.ts
```

You'll find 4 interfaces (`RegisterRequest`, `TelegramRegisterRequest`, `TelegramMiniAppRegisterRequest`, `GoogleRegisterRequest`) that each have `country` + `region?` fields.

- [ ] **Step 2: Add secondary fields to each interface**

For each of the 4 interfaces, immediately after `region?: string`, add:

```typescript
secondaryCountry?: string;
secondaryRegion?: string;
```

Since each register method passes `data` directly to `apiClient.post`, no body-literal edits needed.

- [ ] **Step 3: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep -i authApi | head -5
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/services/api/authApi.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "auth: register-request types gain secondary fields"
```

---

## Task 10: Add 3 i18n keys

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\contexts\LanguageContext.tsx`

- [ ] **Step 1: Add keys to en block**

Add next to the existing `location.*` keys:

```typescript
'location.addSecond': '+ Add second location',
'location.removeSecond': 'Remove',
'location.secondary': 'Secondary location',
```

- [ ] **Step 2: Add keys to ru block**

```typescript
'location.addSecond': '+ Добавить вторую локацию',
'location.removeSecond': 'Убрать',
'location.secondary': 'Дополнительная локация',
```

- [ ] **Step 3: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep -i LanguageContext | head -5
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/contexts/LanguageContext.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "i18n: secondary-location keys"
```

---

## Task 11: Extend `<LocationDisplay>` with secondary props

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\components\ui\location-display.tsx`

- [ ] **Step 1: Refactor to slot-fragment approach**

Replace the file contents with:

```tsx
import { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country?: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  /** Legacy free-text location, used as the final fallback when no slot is set. */
  location?: string;
  className?: string;
}

export function LocationDisplay({
  country, region, secondaryCountry, secondaryRegion, location, className,
}: Props) {
  const { language } = useLanguage();

  const primary = renderSlot(country, region, language);
  const secondary = renderSlot(secondaryCountry, secondaryRegion, language);

  if (!primary && !secondary && location) {
    return <span className={cn('text-muted-foreground italic', className)}>{location}</span>;
  }
  if (!primary && !secondary) return null;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {primary}
      {primary && secondary && <span aria-hidden> · </span>}
      {secondary}
    </span>
  );
}

function renderSlot(country: string | undefined, region: string | undefined, language: 'ru' | 'en'): ReactNode {
  if (country && COUNTRY_BY_CODE[country]) {
    const c = COUNTRY_BY_CODE[country];
    const name = language === 'ru' ? c.nameRu : c.nameEn;
    return (
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>{flagEmoji(country)}</span>
        <span>{region || name}</span>
      </span>
    );
  }
  if (country && isCustomCountry(country)) {
    return (
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span>{[country, region].filter(Boolean).join(', ')}</span>
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep -i location-display | head -5
```

Expected: empty.

- [ ] **Step 3: Verify no test regressions**

The component has no own tests. Other tests that snapshot/text-match the component will be affected only if they're now asserting against output that includes secondary — they aren't yet. Quick sanity check:

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run 2>&1 | tail -5
```

Expected: same pass count as before.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/components/ui/location-display.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "ui: LocationDisplay renders primary · secondary inline"
```

---

## Task 12: `<DualLocationPicker>` component (TDD smoke test)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\dual-location-picker.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\__tests__\dual-location-picker.test.tsx`

- [ ] **Step 1: Write failing smoke test**

```tsx
// D:\src\aloevera-harmony-meet\src\components\ui\__tests__\dual-location-picker.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DualLocationPicker } from '@/components/ui/dual-location-picker';

// cmdk/Radix Popover needs these in jsdom
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
  HTMLElement.prototype.scrollIntoView = () => {};
});

describe('<DualLocationPicker>', () => {
  it('shows "Add second location" link when no secondary is set', () => {
    renderWithProviders(
      <DualLocationPicker
        country=""
        region=""
        secondaryCountry=""
        secondaryRegion=""
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /add.*location|добавить/i })).toBeInTheDocument();
  });

  it('expands and renders second picker when the link is clicked', () => {
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry=""
        secondaryRegion=""
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add.*location|добавить/i }));
    // After expansion, the second CountryRegionPicker's country trigger should be in the DOM
    const triggers = screen.getAllByRole('combobox', { name: /country|страна/i });
    expect(triggers.length).toBe(2);
  });

  it('starts expanded when secondary fields are pre-populated', () => {
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry="TH"
        secondaryRegion="Пхукет"
        onChange={() => {}}
      />
    );
    const triggers = screen.getAllByRole('combobox', { name: /country|страна/i });
    expect(triggers.length).toBe(2);
  });

  it('Remove button collapses and clears secondary fields', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry="TH"
        secondaryRegion="Пхукет"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove|убрать/i }));
    expect(onChange).toHaveBeenCalledWith({
      country: 'RU', region: 'Москва',
      secondaryCountry: '', secondaryRegion: '',
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/components/ui/__tests__/dual-location-picker.test.tsx
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// D:\src\aloevera-harmony-meet\src\components\ui\dual-location-picker.tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country: string;
  region: string;
  secondaryCountry: string;
  secondaryRegion: string;
  onChange: (next: {
    country: string;
    region: string;
    secondaryCountry: string;
    secondaryRegion: string;
  }) => void;
  required?: boolean;
  className?: string;
}

export function DualLocationPicker({
  country, region, secondaryCountry, secondaryRegion, onChange, required, className,
}: Props) {
  const { t } = useLanguage();
  const hasSecondary = Boolean(secondaryCountry || secondaryRegion);
  const [expanded, setExpanded] = useState(hasSecondary);

  useEffect(() => {
    if (hasSecondary) setExpanded(true);
  }, [hasSecondary]);

  const updatePrimary = (next: { country: string; region: string }) =>
    onChange({
      country: next.country, region: next.region,
      secondaryCountry, secondaryRegion,
    });

  const updateSecondary = (next: { country: string; region: string }) =>
    onChange({
      country, region,
      secondaryCountry: next.country, secondaryRegion: next.region,
    });

  const removeSecondary = () => {
    onChange({ country, region, secondaryCountry: '', secondaryRegion: '' });
    setExpanded(false);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <CountryRegionPicker
        country={country}
        region={region}
        onChange={updatePrimary}
        required={required}
      />
      {expanded ? (
        <div className="flex flex-col gap-1 pl-3 border-l-2 border-muted">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('location.secondary')}</span>
            <Button variant="ghost" size="sm" onClick={removeSecondary} className="h-auto py-0 px-2 text-xs">
              <X className="h-3 w-3 mr-1" />
              {t('location.removeSecond')}
            </Button>
          </div>
          <CountryRegionPicker
            country={secondaryCountry}
            region={secondaryRegion}
            onChange={updateSecondary}
          />
        </div>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="self-start px-0 text-xs h-auto"
          onClick={() => setExpanded(true)}
        >
          {t('location.addSecond')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/components/ui/__tests__/dual-location-picker.test.tsx
```

Expected: 4 PASS. If a selector doesn't match (e.g., the "Add second location" trigger is rendered as a different role), adjust the test selector to match the implementation — keep the behavioral assertions exact.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/components/ui/dual-location-picker.tsx src/components/ui/__tests__/dual-location-picker.test.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "ui: DualLocationPicker (collapsed-by-default secondary)"
```

---

## Task 13: `commonGround.ts` — 4-way slot scan

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\lib\commonGround.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\commonGround.test.ts`

- [ ] **Step 1: Add failing tests**

In `commonGround.test.ts`, append:

```typescript
describe('commonGround cross-slot matching', () => {
  const baseUser = { /* same shape as existing baseUser in the file */ } as any;

  it('sharedCity matches when viewer.secondary equals target.primary', () => {
    const viewer = { ...baseUser, country: 'US', region: 'California', secondaryCountry: 'RU', secondaryRegion: 'Москва' };
    const target = { ...baseUser, country: 'RU', region: 'Москва' };
    const result = commonGround(viewer, target);
    expect(result.some(s => s.kind === 'sharedCity' && s.city === 'Москва')).toBe(true);
  });

  it('sharedCity matches when viewer.primary equals target.secondary', () => {
    const viewer = { ...baseUser, country: 'RU', region: 'Москва' };
    const target = { ...baseUser, country: 'US', region: 'California', secondaryCountry: 'RU', secondaryRegion: 'Москва' };
    const result = commonGround(viewer, target);
    expect(result.some(s => s.kind === 'sharedCity' && s.city === 'Москва')).toBe(true);
  });

  it('sharedCity beats sharedCountry when both pairings exist', () => {
    // viewer primary same country as target primary (sharedCountry candidate)
    // viewer secondary city = target secondary city (sharedCity candidate)
    const viewer = { ...baseUser, country: 'RU', region: 'Санкт-Петербург', secondaryCountry: 'US', secondaryRegion: 'Brooklyn' };
    const target = { ...baseUser, country: 'RU', region: 'Москва', secondaryCountry: 'US', secondaryRegion: 'Brooklyn' };
    const result = commonGround(viewer, target);
    // Only one signal — sharedCity (Brooklyn), not sharedCountry
    expect(result.filter(s => s.kind === 'sharedCity').length).toBe(1);
    expect(result.find(s => s.kind === 'sharedCity')?.city).toBe('Brooklyn');
    expect(result.some(s => s.kind === 'sharedCountry')).toBe(false);
  });
});
```

Match the actual `baseUser` shape and signal-result shape from the existing tests. Update fixture fields to whatever the existing `commonGround` signal kind uses (e.g., `kind` may be `'sharedCity' | 'sharedCountry'`, `city` may be `region`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/commonGround.test.ts
```

Expected: 3 new FAILs (existing tests still pass).

- [ ] **Step 3: Update `commonGround.ts` with 4-way scan**

Find the existing primary-only location-match branch in `commonGround.ts` (the two-branch logic added by the predecessor). Replace with:

```typescript
import { COUNTRY_BY_CODE } from '@/data/countries';
// ... rest of imports

// ... inside commonGround function, replace the existing same-region/same-country block:

const viewerSlots = [
  { country: viewer.country, region: viewer.region },
  { country: viewer.secondaryCountry ?? '', region: viewer.secondaryRegion ?? '' },
].filter(s => s.country);

const targetSlots = [
  { country: target.country, region: target.region },
  { country: target.secondaryCountry ?? '', region: target.secondaryRegion ?? '' },
].filter(s => s.country);

let cityMatch: { country: string; region: string } | null = null;
let countryMatch: { country: string; region: string } | null = null;

for (const v of viewerSlots) {
  for (const t of targetSlots) {
    if (v.country === t.country && v.region && v.region === t.region) {
      cityMatch = cityMatch ?? v;
    } else if (v.country === t.country) {
      countryMatch = countryMatch ?? v;
    }
  }
}

if (cityMatch) {
  matches.push({ kind: 'sharedCity', city: cityMatch.region });
} else if (countryMatch) {
  const countryName = COUNTRY_BY_CODE[countryMatch.country]?.nameRu ?? countryMatch.country;
  matches.push({ kind: 'sharedCountry', country: countryName });
}
```

(Match the actual signal-emit pattern from the existing code — the field names `city` / `country` on the signal object follow what the existing `sharedCity` / `sharedCountry` emit used.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/commonGround.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/lib/commonGround.ts src/lib/__tests__/commonGround.test.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "commonGround: 4-way cross-slot match"
```

---

## Task 14: Rewire register/welcome forms to use `<DualLocationPicker>`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Welcome.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\WelcomeTelegram.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\WelcomeGoogle.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\MiniAppEntry.tsx`

Each page currently uses `<Controller name="country" render={({ field }) => <CountryRegionPicker ... />}>`. Swap to `<DualLocationPicker>`.

- [ ] **Step 1: For each of the 4 files, replace the picker block**

Find the existing Controller wrapping `<CountryRegionPicker>`. Replace with:

```tsx
import { DualLocationPicker } from '@/components/ui/dual-location-picker';

// ... inside the form JSX ...
<Controller
  control={form.control}
  name="country"
  render={({ field }) => (
    <DualLocationPicker
      country={field.value ?? ''}
      region={form.watch('region') ?? ''}
      secondaryCountry={form.watch('secondaryCountry') ?? ''}
      secondaryRegion={form.watch('secondaryRegion') ?? ''}
      onChange={({ country, region, secondaryCountry, secondaryRegion }) => {
        form.setValue('country', country, { shouldValidate: true });
        form.setValue('region', region, { shouldValidate: true });
        form.setValue('secondaryCountry', secondaryCountry, { shouldValidate: true });
        form.setValue('secondaryRegion', secondaryRegion, { shouldValidate: true });
      }}
    />
  )}
/>
{form.formState.errors.country && (
  <p className="text-xs text-destructive mt-1">{form.formState.errors.country.message}</p>
)}
{form.formState.errors.region && (
  <p className="text-xs text-destructive mt-1">{form.formState.errors.region.message}</p>
)}
{form.formState.errors.secondaryCountry && (
  <p className="text-xs text-destructive mt-1">{form.formState.errors.secondaryCountry.message}</p>
)}
{form.formState.errors.secondaryRegion && (
  <p className="text-xs text-destructive mt-1">{form.formState.errors.secondaryRegion.message}</p>
)}
```

Remove the existing `CountryRegionPicker` import from each file (no longer used directly).

- [ ] **Step 2: Update form defaultValues in each file**

In each file, find `useForm({ defaultValues: { ..., country: '', region: '' } })`. Add:

```typescript
defaultValues: { ..., country: '', region: '', secondaryCountry: '', secondaryRegion: '' }
```

- [ ] **Step 3: Update submit handler payloads (if they explicitly map fields)**

If a submit handler constructs the API payload like `{ country: data.country, region: data.region }`, add `secondaryCountry: data.secondaryCountry, secondaryRegion: data.secondaryRegion`. If the handler passes `data` directly, no change needed.

Read each file's submit handler to determine which case applies.

- [ ] **Step 4: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors related to these 4 files.

- [ ] **Step 5: Build check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/Welcome.tsx src/pages/WelcomeTelegram.tsx src/pages/WelcomeGoogle.tsx src/pages/MiniAppEntry.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "auth pages: swap CountryRegionPicker for DualLocationPicker"
```

---

## Task 15: Update `Welcome.test.tsx` mock for `<DualLocationPicker>`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\__tests__\Welcome.test.tsx`

The existing test file mocks `@/components/ui/country-region-picker` to a plain `<input role="textbox" aria-label="country" />` (added when the predecessor's Task 16 changed the form). After Task 14, the form uses `<DualLocationPicker>` which internally renders TWO `<CountryRegionPicker>` instances when the secondary is expanded — both would render through the existing mock with the same role+name, causing test selectors to find multiple matches.

The cleanest fix: mock `@/components/ui/dual-location-picker` directly to a single text input. The internal `<CountryRegionPicker>` mock can stay or be removed (it just won't run any longer because the page never references that module directly after Task 14).

- [ ] **Step 1: Replace the existing mock**

Find this block in `Welcome.test.tsx`:

```typescript
vi.mock('@/components/ui/country-region-picker', () => ({
  CountryRegionPicker: ({ onChange }: any) => (
    <input
      role="textbox"
      aria-label="country"
      onChange={(e) => onChange({ country: e.target.value, region: '' })}
    />
  ),
}));
```

Replace with:

```typescript
vi.mock('@/components/ui/dual-location-picker', () => ({
  DualLocationPicker: ({ onChange }: any) => (
    <input
      role="textbox"
      aria-label="country"
      onChange={(e) => onChange({
        country: e.target.value,
        region: '',
        secondaryCountry: '',
        secondaryRegion: '',
      })}
    />
  ),
}));
```

(No other test changes needed — the existing `fillValidRegisterForm` helper still types `'RU'` into the `aria-label="country"` input, and the mock now emits a payload that matches DualLocationPicker's `onChange` shape.)

- [ ] **Step 2: Run the test file**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/pages/__tests__/Welcome.test.tsx
```

Expected: 22/22 pass.

- [ ] **Step 3: Run full suite**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run test:run 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/__tests__/Welcome.test.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "test(welcome): mock DualLocationPicker instead of CountryRegionPicker"
```

---

## Task 16: Rewire `SettingsPage.tsx` (edit form + header display)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\SettingsPage.tsx`

- [ ] **Step 1: Swap edit-form picker to DualLocationPicker**

Apply the same `<Controller>` + `<DualLocationPicker>` swap as Task 14 to the profile edit form. `profileEditSchema` already has the new fields from Task 7.

- [ ] **Step 2: Update form reset / defaults**

The page calls `profileForm.reset(...)` with `country: userRes.data.country ?? ''` and `region: userRes.data.region ?? ''`. Add:

```typescript
profileForm.reset({
  name: userRes.data.name,
  age: userRes.data.age,
  country: userRes.data.country ?? '',
  region: userRes.data.region ?? '',
  secondaryCountry: userRes.data.secondaryCountry ?? '',
  secondaryRegion: userRes.data.secondaryRegion ?? '',
  bio: userRes.data.bio ?? '',
  instagramHandle: userRes.data.instagramHandle ?? '',
});
```

(Add similar `secondaryCountry: ''`, `secondaryRegion: ''` to the initial `defaultValues` block if present.)

- [ ] **Step 3: Pass secondary props to `<LocationDisplay>` in the view-mode header**

Find the existing `<LocationDisplay country={user.country} region={user.region} location={user.location} ... />` call. Add:

```tsx
<LocationDisplay
  country={user.country}
  region={user.region}
  secondaryCountry={user.secondaryCountry}
  secondaryRegion={user.secondaryRegion}
  location={user.location}
  className="text-sm text-muted-foreground"
/>
```

Same for the non-edit branch inside the edit form (the page currently renders `<LocationDisplay>` in view mode and `<CountryRegionPicker>` in edit mode — the view mode call needs the secondary props).

- [ ] **Step 4: TypeScript + build check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/SettingsPage.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "settings: DualLocationPicker in edit; LocationDisplay shows secondary"
```

---

## Task 17: Pass secondary props to `<LocationDisplay>` in `Friends.tsx`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Friends.tsx`

- [ ] **Step 1: Locate the 3 LocationDisplay call sites**

```bash
cd 'D:\src\aloevera-harmony-meet' && grep -n 'LocationDisplay' src/pages/Friends.tsx
```

You'll find 2 sites added by the predecessor (likely lines around 370 and 404):
- `UserCard` component (Matches/Sent/Received lists)
- Deck card render inside the overlay

Plus possibly a condition guard at the deck-card level (`target.country || target.location ||...`).

- [ ] **Step 2: Add secondary props to each LocationDisplay call**

For each call, add `secondaryCountry` and `secondaryRegion`:

```tsx
<LocationDisplay
  country={user.country}
  region={user.region}
  secondaryCountry={user.secondaryCountry}
  secondaryRegion={user.secondaryRegion}
  location={user.location}
/>
```

Substitute the local variable name (`user`, `target`, `profile`) as appropriate.

The condition guard that decides whether to render the location row (something like `{(target.country || target.location || ...) && ...}`) should also account for the secondary: `(target.country || target.secondaryCountry || target.location || ...)`.

- [ ] **Step 3: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Build check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run build 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/Friends.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "friends: pass secondary location to LocationDisplay"
```

---

## Task 18: Update mock data (give 2 mocks a secondary location)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockUsers.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockProfiles.ts`

- [ ] **Step 1: Add secondary to Анна in both files**

Find the mock user Анна in `mockUsers.ts` and `mockProfiles.ts`. She currently has `country: 'RU', region: 'Москва'`. Add:

```typescript
country: 'RU',
region: 'Москва',
secondaryCountry: 'TH',
secondaryRegion: 'Пхукет',
```

- [ ] **Step 2: Add secondary to mock-user-us (Sarah) in both files**

Sarah currently has `country: 'US', region: 'California'`. Add:

```typescript
country: 'US',
region: 'California',
secondaryCountry: 'RU',
secondaryRegion: 'Москва',
```

(This ensures Sarah shows up when a Moscow searcher filters — testing the OR-match.)

- [ ] **Step 3: TypeScript check + test run**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit && npx vitest run src/data 2>&1 | tail -5
```

Expected: clean, mock-data shape tests pass.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/data/mockUsers.ts src/data/mockProfiles.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "mock: give Anna and Sarah secondary locations"
```

---

## Task 19: Documentation updates

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docs\FEATURES.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ARCHITECTURE.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\AZURE_STORAGE.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`

- [ ] **Step 1: Frontend FEATURES.md**

Find the section that describes location in profiles or settings. Add a sentence:

> Users can optionally add a secondary location (country + region); both are shown inline (`🇷🇺 Москва · 🇹🇭 Пхукет`) on profile cards. Search filters return users when either slot matches.

- [ ] **Step 2: Frontend ARCHITECTURE.md**

In the User type block, add `secondaryCountry?, secondaryRegion?` next to the existing `country, region` line. In the custom-components list, add `<DualLocationPicker>` next to `<CountryRegionPicker>`.

- [ ] **Step 3: Frontend AGENTS.md**

Add `dual-location-picker` to the `src/components/ui/` custom-components list.

- [ ] **Step 4: Backend AZURE_STORAGE.md**

In the `users` table notable-fields list, add a bullet:

> - `SecondaryCountry`, `SecondaryRegion` — optional secondary slot for users with two home regions; same shape and validation as primary.

- [ ] **Step 5: Backend IMPLEMENTATION_SUMMARY.md**

Under "Done since the original plan", append one line:

> Optional secondary `Country`/`Region` slot on user profiles; OR-match in `GetUsersAsync`.

- [ ] **Step 6: Commit (two separate commits, one per repo)**

```bash
git -C 'D:\src\aloevera-harmony-meet' add docs/FEATURES.md docs/ARCHITECTURE.md AGENTS.md
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: secondary location"

git -C 'D:\src\lovecraft' add Lovecraft/docs/AZURE_STORAGE.md Lovecraft/docs/IMPLEMENTATION_SUMMARY.md
git -C 'D:\src\lovecraft' commit -m "docs: secondary location"
```

---

## Task 20: Final verification

- [ ] **Step 1: Backend tests**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: 291 PASS.

- [ ] **Step 2: Frontend tests**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run test:run 2>&1 | tail -5
```

Expected: all PASS (≥ 194 — 187 existing + 7+ new).

- [ ] **Step 3: Frontend type check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Frontend lint (compare to baseline from main)**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run lint 2>&1 | tail -3
```

Expected: same count as `main` (~120 problems, all pre-existing).

- [ ] **Step 5: Frontend build**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 6: Manual smoke check (in mock mode)**

```bash
cd 'D:\src\aloevera-harmony-meet' && VITE_API_MODE=mock npm run dev
```

Walk through:
1. **Register at `/`** — form shows "+ Add second location" link below the primary picker. Click it → second picker appears. Click "Remove" → second picker collapses.
2. **Sign in** with `test@example.com` / `Test123!@#` (mock mode).
3. **Friends → Search** — swipe cards show `🇷🇺 Москва · 🇹🇭 Пхукет` for Анна. Filter by `RU/Москва` → Sarah (whose primary is California, secondary is Moscow) appears in results.
4. **Settings** — open profile editor; "Add second location" works; setting a secondary saves correctly; view-mode header shows both.

Stop dev server.

- [ ] **Step 7: Final commit if any polish was needed**

If verification surfaced small issues, fix them in a final commit. Otherwise nothing to commit.

---

## Self-review

**Spec coverage** spot-checked against each section of the spec:

- Data model (UserEntity + DTO + AuthDtos) → Tasks 1, 2, 5
- Validation (length + HtmlGuard for secondary) → Task 4
- Filter (OR-match across slots, pair-wise within slot) → Task 3
- Auth provisioning (register paths write secondary) → Task 5
- Mock + seeder → Tasks 6, 18
- `<DualLocationPicker>` → Task 12
- `<LocationDisplay>` with secondary props → Task 11
- Form rewiring (5 pages + Welcome test mock) → Tasks 14, 15, 16
- Display rewiring (Friends.tsx) → Task 17
- usersApi + authApi → Tasks 8, 9
- validators → Task 7
- commonGround 4-way → Task 13
- i18n → Task 10
- Docs → Task 19
- Final verification → Task 20

**No-placeholder scan** — code samples reference the actual `baseUser` shape / signal kinds from the existing tests; placeholders like "Match the actual…" are guidance about discovering existing shape, not unimplemented TODOs. No `TBD`/`TODO` in implementation steps.

**Type consistency** — `secondaryCountry`/`secondaryRegion` (frontend camelCase) vs `SecondaryCountry`/`SecondaryRegion` (C# PascalCase) are consistent throughout. `mapUserFromApi`/`mapUserToApi` (Task 8) bridges the two. The `onChange` payload shape for `DualLocationPicker` (`{ country, region, secondaryCountry, secondaryRegion }`) is used identically in Tasks 12, 14, 15, 16.
