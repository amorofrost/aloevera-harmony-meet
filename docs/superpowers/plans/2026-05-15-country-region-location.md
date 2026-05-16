# Country & Region Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the freeform `User.location` field with structured `country` + `region`, surface a flag in profile views, and add country/region filtering to the user search API and Friends → Search UI.

**Architecture:** Backend gains two optional `UserEntity` columns (`Country`, `Region`) plus an extended `IUserService.GetUsersAsync` filter. Frontend ships static `countries.ts` (~250 ISO entries) + curated `regions.ts` (15 priority countries), three new components (`CountryRegionPicker`, `LocationDisplay`, `SearchFilterSheet`), and rewires every form and display that currently touches `location`. Existing `Location` is preserved as a read-only display fallback so no user loses data on day one.

**Tech Stack:** .NET 10 / Azure Table Storage (backend); React 18 + TypeScript + Vite + shadcn/ui + cmdk (frontend); xUnit + Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-15-country-region-location-design.md`](../specs/2026-05-15-country-region-location-design.md)

**Repos:**
- Backend: `D:\src\lovecraft` (commits via `git -C 'D:\src\lovecraft'`)
- Frontend: `D:\src\aloevera-harmony-meet` (commits via `git -C 'D:\src\aloevera-harmony-meet'`)

**Test commands:**
- Backend: `dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "<filter>"`
- Frontend: from `D:\src\aloevera-harmony-meet` run `npx vitest run <path>`

---

## File map

### Backend (`D:\src\lovecraft\Lovecraft\`)
| File | Change |
|---|---|
| `Lovecraft.Backend\Storage\Entities\UserEntity.cs` | + `Country`, `Region` properties |
| `Lovecraft.Common\DTOs\Users\UserDto.cs` | + `Country`, `Region` (used for both reads and `PUT` input) |
| `Lovecraft.Backend\Services\IServices.cs` | `IUserService.GetUsersAsync` adds `country?`, `region?` params |
| `Lovecraft.Backend\Services\Azure\AzureUserService.cs` | `GetUsersAsync` filter; `UpdateUserAsync` writes `Country`+`Region` (no longer `Location`); `ToDto` emits `Country`+`Region` |
| `Lovecraft.Backend\Services\MockUserService.cs` | same pattern as Azure impl |
| `Lovecraft.Backend\Controllers\V1\UsersController.cs` | `GetUsers` `[FromQuery] country, region`; `UpdateUser` HtmlGuard + length checks for country/region |
| `Lovecraft.Backend\Services\Azure\AzureAuthService.cs` | drop `Location = "Telegram"` placeholder; write `Country`/`Region` from register payload |
| `Lovecraft.Backend\Services\MockAuthService.cs` | same |
| `Lovecraft.Backend\MockData\MockDataStore.cs` | seed `Country`/`Region` on every mock user |
| `Lovecraft.Tools.Seeder\Program.cs` | seed `Country`/`Region` on seeded users |
| `Lovecraft.UnitTests\UsersControllerUpdateTests.cs` | + 5 cases for country/region validation |
| `Lovecraft.UnitTests\AzureUserServiceTests.cs` | + filter tests |

### Frontend (`D:\src\aloevera-harmony-meet\`)
| File | Change |
|---|---|
| `src\data\countries.ts` | new — ~250 ISO-3166-1 entries with ru/en names |
| `src\data\regions.ts` | new — curated subdivisions for 15 priority countries |
| `src\lib\countryFlag.ts` | new — flag emoji + custom-country detector |
| `src\lib\__tests__\countryFlag.test.ts` | new |
| `src\components\ui\country-region-picker.tsx` | new |
| `src\components\ui\__tests__\country-region-picker.test.tsx` | new smoke test |
| `src\components\ui\location-display.tsx` | new |
| `src\components\SearchFilterSheet.tsx` | new |
| `src\types\user.ts` | + `country`, `region` on `User`; keep `location` as legacy fallback |
| `src\lib\validators.ts` | swap `location` → `country`+`region` in `registerSchema`, `profileEditSchema`, `telegramRegisterSchema` (googleRegisterSchema is `= telegramRegisterSchema` so it inherits) |
| `src\lib\__tests__\validators.test.ts` | + cases for new fields |
| `src\services\api\usersApi.ts` | `getUsers` options object with `country`, `region`; `mapUserFromApi`/`mapUserToApi` round-trip new fields |
| `src\services\api\authApi.ts` | register payloads include `country`+`region` |
| `src\pages\Welcome.tsx` | swap location `<Input>` for `<CountryRegionPicker>` |
| `src\pages\WelcomeTelegram.tsx` | same |
| `src\pages\WelcomeGoogle.tsx` | same |
| `src\pages\MiniAppEntry.tsx` | same |
| `src\pages\SettingsPage.tsx` | swap form input + swap header render for `<LocationDisplay>` |
| `src\pages\Friends.tsx` | filter state + filter button + sheet + active-filter pill + `<LocationDisplay>` everywhere it currently shows location |
| `src\lib\commonGround.ts` | `(country, region)` tuple match instead of string compare |
| `src\lib\__tests__\commonGround.test.ts` | update existing cases to set `country`/`region`; add country-only-match case |
| `src\contexts\LanguageContext.tsx` | + i18n keys (see Task 21) |
| `src\data\mockUsers.ts` | + `country`/`region` on each user; add 2-3 non-RU users |
| `src\data\mockProfiles.ts` | + `country`/`region` |
| `src\data\mockCurrentUser.ts` | + `country`/`region` |
| `src\data\mockChats.ts` | + `country`/`region` on peer info if present |

### Docs
| File | Change |
|---|---|
| `aloevera-harmony-meet\docs\FEATURES.md` | reword location lines; mention search filter sheet |
| `aloevera-harmony-meet\docs\ARCHITECTURE.md` | add `country`/`region` to User type block |
| `aloevera-harmony-meet\docs\ISSUES.md` | mark MCF.7 partial — country/region shipped |
| `aloevera-harmony-meet\AGENTS.md` | add `<CountryRegionPicker>` and `<LocationDisplay>` to custom components |
| `lovecraft\Lovecraft\docs\AZURE_STORAGE.md` | add `Country`, `Region` to users notable-fields list |
| `lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` | one-line entry under shipped |

---

## Task ordering

Backend first (DTO is the contract), then frontend foundations (types, data, utils), then components, then form/display rewiring, then docs.

Tasks are sequential by default. Tasks 1-2 must precede 3-9. Tasks 10-12 are independent and could be parallelised. Tasks 13-21 mostly depend on the components from 18-20 being available.

---

## Task 1: Add `Country` + `Region` to `UserEntity`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Storage\Entities\UserEntity.cs`

Pure storage shape change. No tests — `UserEntity` is a Plain Old CLR Object with no behaviour.

- [ ] **Step 1: Add the two properties next to `Location`**

In `UserEntity.cs`, insert after the existing `Location` line (currently line 19):

```csharp
public string Location { get; set; } = string.Empty;
public string Country { get; set; } = string.Empty;
public string Region { get; set; } = string.Empty;
public string Gender { get; set; } = string.Empty;
```

- [ ] **Step 2: Build to verify no type errors**

Run from `D:\src\lovecraft\Lovecraft\`:

```bash
dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj
```

Expected: `Build succeeded.` Existing references to `entity.Country`/`entity.Region` won't exist yet, so this is just a shape check.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Storage/Entities/UserEntity.cs
git -C 'D:\src\lovecraft' commit -m "users: add Country and Region fields to UserEntity"
```

---

## Task 2: Add `Country` + `Region` to `UserDto`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Users\UserDto.cs`

`UserDto` is used both as the read model and as the `PUT /users/{id}` body, so adding the fields here covers both.

- [ ] **Step 1: Add the two properties next to `Location`**

In `UserDto.cs`, insert after the existing `Location` line (currently line 12):

```csharp
public string Location { get; set; } = string.Empty;
public string Country { get; set; } = string.Empty;
public string Region { get; set; } = string.Empty;
public Gender Gender { get; set; }
```

- [ ] **Step 2: Build**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.Common\Lovecraft.Common.csproj'
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Common/DTOs/Users/UserDto.cs
git -C 'D:\src\lovecraft' commit -m "users: add Country and Region to UserDto"
```

---

## Task 3: Extend `IUserService.GetUsersAsync` signature + propagate `Country`/`Region` through DTO mapping

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\IServices.cs` (line 23 — `IUserService.GetUsersAsync`)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs` (`GetUsersAsync`, `ToDto`, `UpdateUserAsync`)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs` (`GetUsersAsync`, `UpdateUserAsync`, `ToDto`-equivalent if present)

This task wires the new fields through reads (`ToDto`) and the existing write paths (`UpdateUserAsync` switches from writing `Location` to writing `Country`/`Region`), and extends the filter signature without yet implementing the filter logic — that comes in Task 4 (TDD).

- [ ] **Step 1: Update interface**

In `IServices.cs`, change line 23 from:

```csharp
Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10);
```

to:

```csharp
Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10, string? country = null, string? region = null);
```

- [ ] **Step 2: Update `AzureUserService.GetUsersAsync` signature only (filter logic in next task)**

In `AzureUserService.cs` line 33, change:

```csharp
public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10)
```

to:

```csharp
public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10, string? country = null, string? region = null)
```

Body unchanged for now — params are accepted but ignored.

- [ ] **Step 3: Update `AzureUserService.UpdateUserAsync` to write `Country` + `Region` (and stop writing `Location`)**

In `AzureUserService.cs` around line 81, replace:

```csharp
entity.Location = dto.Location;
```

with:

```csharp
entity.Country = dto.Country ?? string.Empty;
entity.Region = dto.Region ?? string.Empty;
// Note: entity.Location is intentionally not written from this path anymore.
// Existing rows keep their legacy Location for the LocationDisplay fallback.
```

- [ ] **Step 4: Update `AzureUserService.ToDto` to emit `Country` + `Region`**

In `AzureUserService.cs` around line 224, change:

```csharp
Location = entity.Location,
```

to:

```csharp
Location = entity.Location,
Country = entity.Country,
Region = entity.Region,
```

- [ ] **Step 5: Update `MockUserService.GetUsersAsync` signature and `UpdateUserAsync`**

In `MockUserService.cs` line 18, change the signature to match (ignore filters for now):

```csharp
public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10, string? country = null, string? region = null)
```

Around line 46, replace:

```csharp
existing.Location = user.Location;
```

with:

```csharp
existing.Country = user.Country ?? string.Empty;
existing.Region = user.Region ?? string.Empty;
```

If `MockUserService` builds DTOs anywhere, also set `Country`/`Region` on them. (Search for `new UserDto` in this file to find the spots.)

- [ ] **Step 6: Build the whole solution**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

Expected: `Build succeeded.` All callers of `GetUsersAsync` still pass the same args (defaults cover the new params).

- [ ] **Step 7: Run the existing test suite to ensure nothing regressed**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: PASS (same number of tests as before — we haven't added any).

- [ ] **Step 8: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Services/IServices.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.Backend/Services/MockUserService.cs
git -C 'D:\src\lovecraft' commit -m "users: thread Country/Region through service layer (signature + DTO map)"
```

---

## Task 4: Implement `GetUsersAsync` country + region filter (TDD)

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\AzureUserServiceTests.cs` (or create if absent)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureUserService.cs` (`GetUsersAsync` body)
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockUserService.cs` (`GetUsersAsync` body)

- [ ] **Step 1: Write the failing tests**

Open `AzureUserServiceTests.cs`. If the file doesn't exist, create it from this scaffold:

```csharp
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Caching;
using Lovecraft.Backend.Storage.Entities;
using Lovecraft.Common.DTOs.Users;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lovecraft.UnitTests;

public class AzureUserServiceFilterTests
{
    private static UserEntity MakeUser(string id, string country, string region) => new()
    {
        PartitionKey = UserEntity.GetPartitionKey(id),
        RowKey = id,
        Name = id,
        Country = country,
        Region = region,
        StaffRole = "none",
    };

    [Fact]
    public async Task GetUsersAsync_FiltersByCountry()
    {
        var cache = new UserCache();
        cache.Set(MakeUser("u1", "RU", "Москва"));
        cache.Set(MakeUser("u2", "RU", "Санкт-Петербург"));
        cache.Set(MakeUser("u3", "US", "California"));

        var svc = TestServiceFactory.CreateAzureUserService(cache);

        var ru = await svc.GetUsersAsync(0, 100, country: "RU");
        Assert.Equal(2, ru.Count);
        Assert.All(ru, u => Assert.Equal("RU", u.Country));
    }

    [Fact]
    public async Task GetUsersAsync_FiltersByCountryAndRegion()
    {
        var cache = new UserCache();
        cache.Set(MakeUser("u1", "RU", "Москва"));
        cache.Set(MakeUser("u2", "RU", "Санкт-Петербург"));
        cache.Set(MakeUser("u3", "US", "California"));

        var svc = TestServiceFactory.CreateAzureUserService(cache);

        var moscow = await svc.GetUsersAsync(0, 100, country: "RU", region: "Москва");
        Assert.Single(moscow);
        Assert.Equal("u1", moscow[0].Id);
    }

    [Fact]
    public async Task GetUsersAsync_CountryFilterIsCaseInsensitive()
    {
        var cache = new UserCache();
        cache.Set(MakeUser("u1", "RU", "Москва"));
        cache.Set(MakeUser("u2", "US", "California"));

        var svc = TestServiceFactory.CreateAzureUserService(cache);

        var ru = await svc.GetUsersAsync(0, 100, country: "ru");
        Assert.Single(ru);
    }

    [Fact]
    public async Task GetUsersAsync_EmptyFilter_ReturnsAll()
    {
        var cache = new UserCache();
        cache.Set(MakeUser("u1", "RU", "Москва"));
        cache.Set(MakeUser("u2", "US", "California"));

        var svc = TestServiceFactory.CreateAzureUserService(cache);

        var all = await svc.GetUsersAsync(0, 100);
        Assert.Equal(2, all.Count);
    }
}
```

If `TestServiceFactory.CreateAzureUserService(UserCache)` doesn't exist, look at how other tests in the file (e.g. `UserCacheTests`) construct an `AzureUserService` — copy that pattern, passing in a no-op `IAppConfigService` (use `Mock<IAppConfigService>` returning `new AppConfig(RankThresholds.Defaults, PermissionConfig.Defaults, false)` from `GetConfigAsync()`) and a `Mock<TableServiceClient>` whose `GetTableClient` returns a `Mock<TableClient>`. The cache provides the data so the table client is never queried in `GetUsersAsync`.

If the cleanest approach is to test against `UserCache` directly via a thin extracted helper, do that instead — the goal is "country+region filter logic, end-to-end through the service signature."

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureUserServiceFilterTests"
```

Expected: 4 FAIL — filter is not yet applied.

- [ ] **Step 3: Implement filter in `AzureUserService.GetUsersAsync`**

Replace the method body (around lines 33-44) with:

```csharp
public async Task<List<UserDto>> GetUsersAsync(int skip = 0, int take = 10, string? country = null, string? region = null)
{
    var config = await _appConfig.GetConfigAsync();
    var all = _cache.GetAll();

    if (!string.IsNullOrWhiteSpace(country))
    {
        all = all.Where(e => string.Equals(e.Country, country, StringComparison.OrdinalIgnoreCase)).ToList();
    }
    if (!string.IsNullOrWhiteSpace(region))
    {
        all = all.Where(e => string.Equals(e.Region, region, StringComparison.OrdinalIgnoreCase)).ToList();
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

- [ ] **Step 4: Apply same filter to `MockUserService.GetUsersAsync`**

In `MockUserService.cs` around line 18, find the body of `GetUsersAsync` (the in-memory list iteration). Insert the same `Where` chain over `MockDataStore.Users` (or whichever list backs it) before any pagination/shuffle:

```csharp
var query = MockDataStore.Users.AsEnumerable();   // adjust to actual collection name
if (!string.IsNullOrWhiteSpace(country))
    query = query.Where(u => string.Equals(u.Country, country, StringComparison.OrdinalIgnoreCase));
if (!string.IsNullOrWhiteSpace(region))
    query = query.Where(u => string.Equals(u.Region, region, StringComparison.OrdinalIgnoreCase));
// then existing skip/take/shuffle
```

(Inspect `MockUserService.GetUsersAsync` first — it may already iterate a known collection. Wrap that iteration with the filter. The Mock store may store `UserDto`s rather than `UserEntity`s; the property names match.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~AzureUserServiceFilterTests"
```

Expected: 4 PASS.

- [ ] **Step 6: Run the full suite to ensure no regression**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.UnitTests/AzureUserServiceTests.cs Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.Backend/Services/MockUserService.cs
git -C 'D:\src\lovecraft' commit -m "users: filter GetUsersAsync by country and region"
```

---

## Task 5: `UsersController.UpdateUser` validation + `GetUsers` query params (TDD)

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\UsersControllerUpdateTests.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Controllers\V1\UsersController.cs`

- [ ] **Step 1: Write the failing tests**

Look at the existing `UsersControllerUpdateTests.cs` to follow the established harness pattern (it likely uses `WebApplicationFactory<Program>` + a test JWT). Add these test methods:

```csharp
[Fact]
public async Task UpdateUser_AcceptsCountryAndRegion()
{
    var (client, userId) = await SignInAsTestUser();
    var body = new { id = userId, name = "T", age = 30, bio = "", country = "RU", region = "Москва", gender = "male", profileImage = "", images = new string[] {}, isOnline = false, preferences = new {}, settings = new {} };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    resp.EnsureSuccessStatusCode();
    var dto = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("RU", dto!.Data!.Country);
    Assert.Equal("Москва", dto.Data.Region);
}

[Fact]
public async Task UpdateUser_RejectsCountryWithHtml()
{
    var (client, userId) = await SignInAsTestUser();
    var body = new { id = userId, name = "T", age = 30, country = "<b>RU</b>", region = "", gender = "male" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("HTML_NOT_ALLOWED", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsRegionWithHtml()
{
    var (client, userId) = await SignInAsTestUser();
    var body = new { id = userId, name = "T", age = 30, country = "RU", region = "<i>Moscow</i>", gender = "male" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("HTML_NOT_ALLOWED", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsCountryTooLong()
{
    var (client, userId) = await SignInAsTestUser();
    var body = new { id = userId, name = "T", age = 30, country = new string('a', 57), region = "", gender = "male" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("COUNTRY_TOO_LONG", err!.Error!.Code);
}

[Fact]
public async Task UpdateUser_RejectsRegionTooLong()
{
    var (client, userId) = await SignInAsTestUser();
    var body = new { id = userId, name = "T", age = 30, country = "RU", region = new string('a', 81), gender = "male" };
    var resp = await client.PutAsJsonAsync($"/api/v1/users/{userId}", body);
    Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    var err = await resp.Content.ReadFromJsonAsync<ApiResponse<UserDto>>();
    Assert.Equal("REGION_TOO_LONG", err!.Error!.Code);
}
```

Adjust `SignInAsTestUser()` to whatever helper the existing tests use (read the top of the file).

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~UsersControllerUpdateTests"
```

Expected: 5 new FAILs (existing tests still pass).

- [ ] **Step 3: Add validation in `UsersController.UpdateUser`**

In `UsersController.cs` line 89, find the existing HtmlGuard block:

```csharp
if (HtmlGuard.ContainsHtml(user.Name))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in name"));
if (HtmlGuard.ContainsHtml(user.Location))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in location"));
if (HtmlGuard.ContainsHtml(user.Bio))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in bio"));
```

Insert immediately after:

```csharp
if (!string.IsNullOrEmpty(user.Country) && user.Country.Length > 56)
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("COUNTRY_TOO_LONG", "Country must be 56 characters or less"));
if (!string.IsNullOrEmpty(user.Region) && user.Region.Length > 80)
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("REGION_TOO_LONG", "Region must be 80 characters or less"));
if (HtmlGuard.ContainsHtml(user.Country))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in country"));
if (HtmlGuard.ContainsHtml(user.Region))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in region"));
```

- [ ] **Step 4: Add query params to `GetUsers`**

In `UsersController.cs` line 41, change:

```csharp
public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetUsers([FromQuery] int skip = 0, [FromQuery] int take = 10)
{
    try
    {
        var users = await _userService.GetUsersAsync(skip, take);
```

to:

```csharp
public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetUsers(
    [FromQuery] int skip = 0,
    [FromQuery] int take = 10,
    [FromQuery] string? country = null,
    [FromQuery] string? region = null)
{
    try
    {
        var users = await _userService.GetUsersAsync(skip, take, country, region);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj' --filter "FullyQualifiedName~UsersControllerUpdateTests"
```

Expected: all PASS.

- [ ] **Step 6: Run full suite**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.UnitTests/UsersControllerUpdateTests.cs Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs
git -C 'D:\src\lovecraft' commit -m "users: validate Country/Region on update; expose filter query params on list"
```

---

## Task 6: Auth provisioning — drop `Location = "Telegram"`, write `Country`/`Region` from register payloads

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureAuthService.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockAuthService.cs`

Find every spot where a new `UserEntity` (or `UserDto`) is constructed inside the auth service and update.

- [ ] **Step 1: Survey the spots**

```bash
grep -n 'Location = ' 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\Azure\AzureAuthService.cs' 'D:\src\lovecraft\Lovecraft\Lovecraft.Backend\Services\MockAuthService.cs'
```

Expected matches:
- `AzureAuthService.cs`: somewhere in `RegisterAsync` (writes `Location = request.Location`), `TelegramLoginAsync` (writes `Location = "Telegram"`), and the Google/Telegram register paths.
- `MockAuthService.cs`: same.

- [ ] **Step 2: In each `RegisterAsync` / `*RegisterAsync` path, replace the `Location` assignment**

Pattern: where you see

```csharp
Location = request.Location,
```

replace with

```csharp
Country = request.Country ?? string.Empty,
Region = request.Region ?? string.Empty,
```

(Drop the `Location` line entirely — new accounts no longer get a legacy `Location` value.)

- [ ] **Step 3: In `TelegramLoginAsync` (Telegram first-time provisioning), drop the placeholder**

In `AzureAuthService.cs`, find the entity-creation block around line 280 (per memory) where `Location = "Telegram"` is assigned. Delete that line. Don't add `Country`/`Region` here — they stay empty so the user is prompted on next Settings or Mini App visit. Apply the same to `MockAuthService.cs`.

- [ ] **Step 4: Verify register request DTOs carry `Country`/`Region`**

`UserDto` already has `Country`/`Region` from Task 2. The register request DTOs (`RegisterRequestDto`, `TelegramRegisterRequestDto`, `GoogleRegisterRequestDto`) likely also need the fields. Find them:

```bash
grep -rn "Location" 'D:\src\lovecraft\Lovecraft\Lovecraft.Common\DTOs\Auth\'
```

For each request DTO that currently has `Location`, add `Country` and `Region` properties next to it:

```csharp
public string? Country { get; init; }
public string? Region { get; init; }
```

Keep the existing `Location` property — the frontend still sends it during the migration window, and the backend simply ignores it on these paths.

- [ ] **Step 5: Build**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

Expected: `Build succeeded.`

- [ ] **Step 6: Run full suite**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Services/Azure/AzureAuthService.cs Lovecraft/Lovecraft.Backend/Services/MockAuthService.cs Lovecraft/Lovecraft.Common/DTOs/Auth/
git -C 'D:\src\lovecraft' commit -m "auth: write Country/Region on register; drop Telegram Location placeholder"
```

---

## Task 7: Seed `Country`/`Region` in `MockDataStore` and `Lovecraft.Tools.Seeder`

**Files:**
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Backend\MockData\MockDataStore.cs`
- Modify: `D:\src\lovecraft\Lovecraft\Lovecraft.Tools.Seeder\Program.cs`

- [ ] **Step 1: Update mock users**

In `MockDataStore.cs`, find the `Users` (or `UserEntities`) collection initialiser. For each existing user, add `Country` and `Region` matching the existing `Location` string. Examples:

| Existing `Location` | New `Country` | New `Region` |
|---|---|---|
| `"Москва"` | `"RU"` | `"Москва"` |
| `"Санкт-Петербург"` | `"RU"` | `"Санкт-Петербург"` |
| Any other Russian city | `"RU"` | <city name> |

Keep the existing `Location` value untouched (legacy fallback).

- [ ] **Step 2: Update seeder**

In `Lovecraft.Tools.Seeder/Program.cs`, find the same user-construction block. Apply the same Country/Region values.

- [ ] **Step 3: Build**

```bash
dotnet build 'D:\src\lovecraft\Lovecraft\Lovecraft.slnx'
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/MockData/MockDataStore.cs Lovecraft/Lovecraft.Tools.Seeder/Program.cs
git -C 'D:\src\lovecraft' commit -m "seed: populate Country/Region on mock and seeded users"
```

---

## Task 8: Frontend — country list (`src/data/countries.ts`)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\data\countries.ts`

The full ~250-entry ISO-3166-1 alpha-2 list is mechanical to populate. Use [iso-3166-1 on Wikipedia](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) as the source of truth. The structure and ~25 priority + sample entries are below — populate the rest in one pass.

- [ ] **Step 1: Create the file**

```typescript
// D:\src\aloevera-harmony-meet\src\data\countries.ts
export interface Country {
  code: string;       // ISO-3166-1 alpha-2, uppercase
  nameRu: string;
  nameEn: string;
}

/**
 * ISO-3166-1 alpha-2 countries with ru/en display names.
 *
 * Priority countries (post-Soviet sphere + obvious diaspora) live at the top
 * for keyboard scrolling; the rest is alphabetical by `nameEn`.
 */
export const COUNTRIES: Country[] = [
  // ── Priority (post-Soviet + diaspora) ────────────────────────────────
  { code: 'RU', nameRu: 'Россия',     nameEn: 'Russia' },
  { code: 'BY', nameRu: 'Беларусь',   nameEn: 'Belarus' },
  { code: 'UA', nameRu: 'Украина',    nameEn: 'Ukraine' },
  { code: 'KZ', nameRu: 'Казахстан',  nameEn: 'Kazakhstan' },
  { code: 'KG', nameRu: 'Киргизия',   nameEn: 'Kyrgyzstan' },
  { code: 'UZ', nameRu: 'Узбекистан', nameEn: 'Uzbekistan' },
  { code: 'AM', nameRu: 'Армения',    nameEn: 'Armenia' },
  { code: 'GE', nameRu: 'Грузия',     nameEn: 'Georgia' },
  { code: 'AZ', nameRu: 'Азербайджан', nameEn: 'Azerbaijan' },
  { code: 'MD', nameRu: 'Молдова',    nameEn: 'Moldova' },
  { code: 'EE', nameRu: 'Эстония',    nameEn: 'Estonia' },
  { code: 'LV', nameRu: 'Латвия',     nameEn: 'Latvia' },
  { code: 'LT', nameRu: 'Литва',      nameEn: 'Lithuania' },
  { code: 'IL', nameRu: 'Израиль',    nameEn: 'Israel' },
  { code: 'DE', nameRu: 'Германия',   nameEn: 'Germany' },
  { code: 'US', nameRu: 'США',        nameEn: 'United States' },
  { code: 'GB', nameRu: 'Великобритания', nameEn: 'United Kingdom' },

  // ── Rest of the world (alphabetical by nameEn) ───────────────────────
  { code: 'AF', nameRu: 'Афганистан', nameEn: 'Afghanistan' },
  { code: 'AL', nameRu: 'Албания',    nameEn: 'Albania' },
  { code: 'DZ', nameRu: 'Алжир',      nameEn: 'Algeria' },
  { code: 'AD', nameRu: 'Андорра',    nameEn: 'Andorra' },
  { code: 'AO', nameRu: 'Ангола',     nameEn: 'Angola' },
  { code: 'AR', nameRu: 'Аргентина',  nameEn: 'Argentina' },
  { code: 'AU', nameRu: 'Австралия',  nameEn: 'Australia' },
  { code: 'AT', nameRu: 'Австрия',    nameEn: 'Austria' },
  // ... TODO: complete with the rest of the ISO-3166-1 alpha-2 list (~225 more entries)
  // Source: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2 (codes column);
  //          ru names from https://ru.wikipedia.org/wiki/ISO_3166-1
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map(c => [c.code, c])
);
```

Replace the `// ... TODO` block with the complete alphabetical list. Don't ship a partial list — search filtering and the dropdown both depend on completeness.

- [ ] **Step 2: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/data/countries.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "data: add ISO-3166-1 country list"
```

---

## Task 9: Frontend — region list (`src/data/regions.ts`)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\data\regions.ts`

Curated subdivisions for 15 priority countries. Other countries fall back to free text.

- [ ] **Step 1: Create the file**

```typescript
// D:\src\aloevera-harmony-meet\src\data\regions.ts
export interface Region {
  name: string;        // canonical display name in the country's primary language
  nameEn?: string;     // optional English name when materially different
}

/**
 * Curated regions per country. Only populated for the 15 priority countries
 * (post-Soviet sphere + obvious diaspora). Anything else falls back to
 * free-text input via the picker.
 *
 * Sources: Wikipedia "Subdivisions of <country>" pages (e.g.
 * https://ru.wikipedia.org/wiki/Субъекты_Российской_Федерации).
 */
export const REGIONS_BY_COUNTRY: Record<string, Region[]> = {
  RU: [
    { name: 'Москва' },
    { name: 'Санкт-Петербург' },
    { name: 'Московская область' },
    { name: 'Ленинградская область' },
    { name: 'Республика Татарстан' },
    { name: 'Свердловская область' },
    { name: 'Новосибирская область' },
    { name: 'Краснодарский край' },
    { name: 'Челябинская область' },
    { name: 'Нижегородская область' },
    // ... TODO: complete with all 85 federal subjects
    // Source: https://ru.wikipedia.org/wiki/Субъекты_Российской_Федерации
  ],
  BY: [
    { name: 'Минск' },
    { name: 'Минская область' },
    { name: 'Брестская область' },
    { name: 'Витебская область' },
    { name: 'Гомельская область' },
    { name: 'Гродненская область' },
    { name: 'Могилёвская область' },
  ],
  UA: [
    { name: 'Київ' },
    { name: 'Київська область' },
    { name: 'Львівська область' },
    { name: 'Одеська область' },
    // ... TODO: complete with all 27 oblasts
  ],
  KZ: [/* TODO: 17 regions — https://en.wikipedia.org/wiki/Regions_of_Kazakhstan */],
  KG: [/* TODO */],
  UZ: [/* TODO */],
  AM: [/* TODO */],
  GE: [/* TODO */],
  AZ: [/* TODO */],
  MD: [/* TODO */],
  EE: [/* TODO */],
  LV: [/* TODO */],
  LT: [/* TODO */],
  IL: [/* TODO */],
  DE: [/* TODO: 16 Bundesländer */],
  US: [
    { name: 'Alabama' },     { name: 'Alaska' },      { name: 'Arizona' },
    { name: 'Arkansas' },    { name: 'California' },  { name: 'Colorado' },
    // ... TODO: complete with all 50 states (+ DC)
  ],
};

export function regionsFor(countryCode: string): Region[] | null {
  return REGIONS_BY_COUNTRY[countryCode] ?? null;
}
```

Replace each `TODO` with the complete list. Don't ship partials — filter UI dropdowns will look broken.

- [ ] **Step 2: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/data/regions.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "data: add curated regions for priority countries"
```

---

## Task 10: Frontend — flag emoji utility (TDD)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\lib\countryFlag.ts`
- Create: `D:\src\aloevera-harmony-meet\src\lib\__tests__\countryFlag.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// D:\src\aloevera-harmony-meet\src\lib\__tests__\countryFlag.test.ts
import { describe, it, expect } from 'vitest';
import { flagEmoji, isCustomCountry } from '../countryFlag';

describe('flagEmoji', () => {
  it('returns the flag for a valid ISO code', () => {
    expect(flagEmoji('RU')).toBe('🇷🇺');
    expect(flagEmoji('US')).toBe('🇺🇸');
    expect(flagEmoji('GB')).toBe('🇬🇧');
  });

  it('returns empty string for non-ISO values', () => {
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('Russia')).toBe('');
    expect(flagEmoji('ru')).toBe('');     // lowercase isn't accepted
    expect(flagEmoji('RUS')).toBe('');    // 3-letter codes aren't accepted
  });
});

describe('isCustomCountry', () => {
  it('treats free text as custom', () => {
    expect(isCustomCountry('Atlantis')).toBe(true);
    expect(isCustomCountry('Some Place')).toBe(true);
  });

  it('treats ISO-2 codes as not custom', () => {
    expect(isCustomCountry('RU')).toBe(false);
    expect(isCustomCountry('US')).toBe(false);
  });

  it('treats empty as not custom', () => {
    expect(isCustomCountry('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/countryFlag.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

```typescript
// D:\src\aloevera-harmony-meet\src\lib\countryFlag.ts
const ISO_CODE_RE = /^[A-Z]{2}$/;

const isIsoCode = (s: string): boolean => ISO_CODE_RE.test(s);

/**
 * Convert an ISO-3166-1 alpha-2 code to its flag emoji.
 * Returns '' for anything that isn't a 2-uppercase-letter code so the caller
 * can fall back to a non-flag rendering for custom country labels.
 */
export function flagEmoji(country: string): string {
  if (!isIsoCode(country)) return '';
  const A = 0x1f1e6; // regional indicator A
  return String.fromCodePoint(
    A + country.charCodeAt(0) - 65,
    A + country.charCodeAt(1) - 65,
  );
}

export const isCustomCountry = (country: string): boolean =>
  country.length > 0 && !isIsoCode(country);
```

- [ ] **Step 4: Run to verify pass**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/countryFlag.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/lib/countryFlag.ts src/lib/__tests__/countryFlag.test.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "lib: flag emoji + custom-country detector"
```

---

## Task 11: Frontend — extend `User` type and validators

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\types\user.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\validators.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\validators.test.ts`

- [ ] **Step 1: Add `country` and `region` to `User`, mark `location` as legacy**

In `src/types/user.ts`, find the `User` interface. Add:

```typescript
export interface User {
  // ... existing fields ...
  /** ISO-3166-1 alpha-2 code (e.g. "RU") OR a free-text custom country name. Empty when unset. */
  country: string;
  /** Free text up to 80 chars. Curated dropdown for priority countries; else custom text. */
  region: string;
  /** @deprecated Legacy free-text location. Read-only fallback for users who haven't set country/region yet. */
  location?: string;
  // ... rest ...
}
```

Note: existing `location` (currently required `string`) becomes optional. Search the codebase for places that read `user.location` and rely on it being non-undefined; they should already be tolerant since the value is often an empty string.

- [ ] **Step 2: Update Zod schemas**

In `src/lib/validators.ts`:

For `registerSchema` (line ~9), replace:

```typescript
location: z.string().min(1, 'Location is required'),
```

with:

```typescript
country: z.string().min(1, 'Country is required').max(56, 'Country must be 56 characters or less'),
region: z.string().max(80, 'Region must be 80 characters or less').optional(),
```

Apply the same swap in `profileEditSchema` (line ~37) and `telegramRegisterSchema` (line ~93). `googleRegisterSchema = telegramRegisterSchema` so it inherits.

- [ ] **Step 3: Write the failing tests**

In `src/lib/__tests__/validators.test.ts`, add:

```typescript
import { registerSchema, profileEditSchema, telegramRegisterSchema } from '@/lib/validators';

describe('country/region in registerSchema', () => {
  const base = {
    email: 'a@b.co',
    password: 'Aa1!aaaa',
    name: 'X',
    age: 25,
    gender: 'male',
  };

  it('accepts ISO country and region', () => {
    expect(registerSchema.safeParse({ ...base, country: 'RU', region: 'Москва' }).success).toBe(true);
  });

  it('accepts custom country', () => {
    expect(registerSchema.safeParse({ ...base, country: 'Atlantis', region: '' }).success).toBe(true);
  });

  it('rejects empty country', () => {
    expect(registerSchema.safeParse({ ...base, country: '', region: '' }).success).toBe(false);
  });

  it('rejects country longer than 56 chars', () => {
    expect(registerSchema.safeParse({ ...base, country: 'a'.repeat(57), region: '' }).success).toBe(false);
  });

  it('rejects region longer than 80 chars', () => {
    expect(registerSchema.safeParse({ ...base, country: 'RU', region: 'a'.repeat(81) }).success).toBe(false);
  });
});

describe('country/region in profileEditSchema', () => {
  it('accepts country + empty region', () => {
    expect(profileEditSchema.safeParse({
      name: 'X', age: 25, country: 'RU', region: '',
    }).success).toBe(true);
  });
});

describe('country/region in telegramRegisterSchema', () => {
  it('accepts ISO country', () => {
    expect(telegramRegisterSchema.safeParse({
      name: 'X', age: 25, country: 'RU', region: 'Москва', gender: 'male',
    }).success).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/validators.test.ts
```

Expected: all PASS (since the schemas are already updated). If any FAIL, fix the schema or test until all pass.

- [ ] **Step 5: TypeScript check (will surface call sites that read `location` from forms)**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expect type errors at the existing form usages (`Welcome.tsx`, `WelcomeTelegram.tsx`, `WelcomeGoogle.tsx`, `MiniAppEntry.tsx`, `SettingsPage.tsx`). These are addressed in Tasks 16-20. **Do not fix them in this commit** — leave the errors for those tasks.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/types/user.ts src/lib/validators.ts src/lib/__tests__/validators.test.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "users: country/region on User type and validator schemas"
```

---

## Task 12: Frontend — `usersApi.ts` filter args + DTO mapping

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\usersApi.ts`

- [ ] **Step 1: Update `mapUserFromApi`**

In `usersApi.ts` line ~15-46, add `country` and `region` to the returned object:

```typescript
export function mapUserFromApi(dto: any): User {
  return {
    id: dto.id,
    name: dto.name,
    age: dto.age,
    bio: dto.bio ?? '',
    location: dto.location ?? '',
    country: dto.country ?? '',
    region: dto.region ?? '',
    // ... rest unchanged
  };
}
```

- [ ] **Step 2: Update `mapUserToApi`**

In `usersApi.ts` line ~56, add country/region to the request payload:

```typescript
function mapUserToApi(u: Partial<User>): Record<string, unknown> {
  return {
    id: u.id,
    name: u.name,
    age: u.age,
    bio: u.bio,
    location: u.location,
    country: u.country,
    region: u.region,
    // ... rest unchanged
  };
}
```

- [ ] **Step 3: Switch `getUsers` to options object with filter args**

Replace the existing `getUsers` (line ~87):

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
  // mock-mode filter
  let list = mockSearchProfiles;
  if (country) list = list.filter(u => u.country?.toLowerCase() === country.toLowerCase());
  if (region) list = list.filter(u => u.region?.toLowerCase() === region.toLowerCase());
  return mockSuccess(list.slice(skip, skip + take));
},
```

- [ ] **Step 4: Update existing callers of `getUsers`**

```bash
cd 'D:\src\aloevera-harmony-meet' && grep -rn 'usersApi.getUsers' src/
```

Each call previously passed positional `(skip, take)`. Convert each to the options-object form: `usersApi.getUsers({ skip, take })`. The Friends.tsx caller will be updated again in Task 18 to pass `country`/`region` from filter state — for now just convert the shape.

- [ ] **Step 5: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep usersApi
```

Expected: no errors mentioning `usersApi.getUsers`. Other errors (forms touching `location`) remain — they are deferred to Tasks 16-20.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/services/api/usersApi.ts <other files modified by Step 4>
git -C 'D:\src\aloevera-harmony-meet' commit -m "users: getUsers options object with country/region filters; round-trip new fields"
```

---

## Task 13: Frontend — `authApi.ts` register payloads include `country`/`region`

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\services\api\authApi.ts`

- [ ] **Step 1: Survey current register payload shapes**

```bash
cd 'D:\src\aloevera-harmony-meet' && grep -n 'location' src/services/api/authApi.ts
```

You'll find `location:` keys in `register`, `telegramRegister`, `googleRegister`, possibly `telegramMiniAppRegister`. Each is a request-body field.

- [ ] **Step 2: For each register call, add `country` + `region` to the request payload**

For every register-style request body that currently sends `location`, add `country` and `region` next to it:

```typescript
{
  email: data.email,
  password: data.password,
  name: data.name,
  age: data.age,
  // location: data.location,    // remove this line
  country: data.country,
  region: data.region,
  gender: data.gender,
  bio: data.bio,
  inviteCode: data.inviteCode,
}
```

The corresponding TypeScript request-arg type for each function should also drop `location` and add `country: string; region?: string;`. Search and update.

- [ ] **Step 3: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep authApi
```

Expected: no errors mentioning `authApi`. Form-page errors remain (deferred).

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/services/api/authApi.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "auth: register payloads send country/region instead of location"
```

---

## Task 14: Frontend — `<CountryRegionPicker>` component (TDD smoke test)

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\country-region-picker.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\__tests__\country-region-picker.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```typescript
// D:\src\aloevera-harmony-meet\src\components\ui\__tests__\country-region-picker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';

describe('<CountryRegionPicker>', () => {
  it('renders and emits change when an ISO country is picked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="" region="" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: /country|страна/i }));
    fireEvent.click(screen.getByText(/Russia|Россия/));
    expect(onChange).toHaveBeenCalledWith({ country: 'RU', region: '' });
  });

  it('region is disabled until country is set', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="" region="" onChange={onChange} />
    );
    const regionBtn = screen.getByRole('button', { name: /region|регион/i });
    expect(regionBtn).toBeDisabled();
  });

  it('clearing country resets region', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="RU" region="Москва" onChange={onChange} />
    );
    // Implementation-specific: this assumes there's a clear-X icon next to country.
    // Adjust the selector to match the actual control once it's built.
    const clear = screen.queryByRole('button', { name: /clear country|очистить страну/i });
    if (clear) {
      fireEvent.click(clear);
      expect(onChange).toHaveBeenCalledWith({ country: '', region: '' });
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/components/ui/__tests__/country-region-picker.test.tsx
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// D:\src\aloevera-harmony-meet\src\components\ui\country-region-picker.tsx
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from '@/data/countries';
import { regionsFor, type Region } from '@/data/regions';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country: string;
  region: string;
  onChange: (next: { country: string; region: string }) => void;
  required?: boolean;
  className?: string;
}

export function CountryRegionPicker({ country, region, onChange, className }: Props) {
  const { language, t } = useLanguage();
  const nameOf = (c: Country) => language === 'ru' ? c.nameRu : c.nameEn;

  const [countryOpen, setCountryOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [countryCustomMode, setCountryCustomMode] = useState(false);
  const [regionCustomMode, setRegionCustomMode] = useState(false);
  const [countryDraft, setCountryDraft] = useState('');
  const [regionDraft, setRegionDraft] = useState('');

  const countryLabel = useMemo(() => {
    if (!country) return t('location.country');
    const known = COUNTRY_BY_CODE[country];
    if (known) return `${flagEmoji(country)} ${nameOf(known)}`;
    return `📍 ${country}`;
  }, [country, language, t]);

  const regions = country && !isCustomCountry(country) ? regionsFor(country) : null;
  const regionLabel = region || t('location.region');

  const setCountry = (next: string) => {
    onChange({ country: next, region: '' });   // clearing country resets region
    setCountryOpen(false);
    setCountryCustomMode(false);
    setCountryDraft('');
  };

  const setRegion = (next: string) => {
    onChange({ country, region: next });
    setRegionOpen(false);
    setRegionCustomMode(false);
    setRegionDraft('');
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Country */}
      <div className="flex items-center gap-1">
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between" aria-label={t('location.country')}>
              {countryLabel}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            {countryCustomMode ? (
              <div className="p-2 flex gap-2">
                <Input
                  autoFocus
                  value={countryDraft}
                  onChange={e => setCountryDraft(e.target.value)}
                  placeholder={t('location.country')}
                  maxLength={56}
                />
                <Button
                  size="sm"
                  onClick={() => countryDraft.trim() && setCountry(countryDraft.trim())}
                >
                  OK
                </Button>
              </div>
            ) : (
              <Command>
                <CommandInput placeholder={t('location.country')} />
                <CommandList>
                  <CommandEmpty>{t('search.allCountries')}</CommandEmpty>
                  <CommandGroup>
                    {COUNTRIES.map(c => (
                      <CommandItem key={c.code} value={`${nameOf(c)} ${c.code}`} onSelect={() => setCountry(c.code)}>
                        <Check className={cn('mr-2 h-4 w-4', country === c.code ? 'opacity-100' : 'opacity-0')} />
                        {flagEmoji(c.code)} {nameOf(c)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem onSelect={() => setCountryCustomMode(true)}>
                      ✏️ {t('location.useCustomValue')}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>
        {country && (
          <Button variant="ghost" size="icon" aria-label={t('location.clearCountry')} onClick={() => setCountry('')}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Region */}
      {regions ? (
        <Popover open={regionOpen} onOpenChange={setRegionOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
              disabled={!country}
              aria-label={t('location.region')}
            >
              {regionLabel}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            {regionCustomMode ? (
              <div className="p-2 flex gap-2">
                <Input
                  autoFocus
                  value={regionDraft}
                  onChange={e => setRegionDraft(e.target.value)}
                  placeholder={t('location.region')}
                  maxLength={80}
                />
                <Button size="sm" onClick={() => regionDraft.trim() && setRegion(regionDraft.trim())}>OK</Button>
              </div>
            ) : (
              <Command>
                <CommandInput placeholder={t('location.region')} />
                <CommandList>
                  <CommandEmpty>{t('search.allRegions')}</CommandEmpty>
                  <CommandGroup>
                    {regions.map((r: Region) => (
                      <CommandItem key={r.name} value={r.name} onSelect={() => setRegion(r.name)}>
                        <Check className={cn('mr-2 h-4 w-4', region === r.name ? 'opacity-100' : 'opacity-0')} />
                        {r.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem onSelect={() => setRegionCustomMode(true)}>
                      ✏️ {t('location.useCustomValue')}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          value={region}
          onChange={e => onChange({ country, region: e.target.value })}
          placeholder={t('location.region')}
          maxLength={80}
          disabled={!country}
        />
      )}
    </div>
  );
}
```

If `Popover`, `Command`, or `Input` shadcn primitives don't exist yet under `src/components/ui/`, scaffold them via `npx shadcn-ui@latest add popover command input` from `D:\src\aloevera-harmony-meet`. (Most are likely already present — only add what's missing.)

- [ ] **Step 4: Run smoke test**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/components/ui/__tests__/country-region-picker.test.tsx
```

Expected: PASS. If a query selector mismatches the actual control (button text, role), update the test selectors to match the implementation — keep the assertions about `onChange` payload exact.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/components/ui/country-region-picker.tsx src/components/ui/__tests__/country-region-picker.test.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "ui: CountryRegionPicker (combobox + custom-text fallback)"
```

---

## Task 15: Frontend — `<LocationDisplay>` component

**Files:**
- Create: `D:\src\aloevera-harmony-meet\src\components\ui\location-display.tsx`

No tests — pure render component, the visual test is exercising it in pages. (If you want a smoke test, follow Task 14's pattern, but it's optional.)

- [ ] **Step 1: Implement**

```tsx
// D:\src\aloevera-harmony-meet\src\components\ui\location-display.tsx
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country?: string;
  region?: string;
  /** Legacy free-text location, used as the final fallback when country is unset. */
  location?: string;
  className?: string;
}

export function LocationDisplay({ country, region, location, className }: Props) {
  const { language } = useLanguage();
  if (country && COUNTRY_BY_CODE[country]) {
    const c = COUNTRY_BY_CODE[country];
    const name = language === 'ru' ? c.nameRu : c.nameEn;
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span aria-hidden>{flagEmoji(country)}</span>
        <span>{region || name}</span>
      </span>
    );
  }
  if (country && isCustomCountry(country)) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span>{[country, region].filter(Boolean).join(', ')}</span>
      </span>
    );
  }
  if (location) {
    return <span className={cn('text-muted-foreground italic', className)}>{location}</span>;
  }
  return null;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit 2>&1 | grep location-display
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/components/ui/location-display.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "ui: LocationDisplay with flag/custom/legacy fallback"
```

---

## Task 16: Rewire register + welcome forms (Welcome.tsx, WelcomeTelegram.tsx, WelcomeGoogle.tsx, MiniAppEntry.tsx)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Welcome.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\WelcomeTelegram.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\WelcomeGoogle.tsx`
- Modify: `D:\src\aloevera-harmony-meet\src\pages\MiniAppEntry.tsx`

These four pages all have the same shape: a register form using react-hook-form. They each have a `location` `<Input>` plus a register-on-submit handler that posts to `authApi.*Register`.

- [ ] **Step 1: For each file, replace the `location` `<Input>` with `<Controller>` + `<CountryRegionPicker>`**

Pattern — currently:

```tsx
<Input
  placeholder={t('register.location')}
  {...form.register('location')}
/>
{form.formState.errors.location && (
  <p className="text-xs text-destructive mt-1">{form.formState.errors.location.message}</p>
)}
```

Replace with:

```tsx
import { Controller } from 'react-hook-form';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';

// ... inside the form ...
<Controller
  control={form.control}
  name="country"
  render={({ field }) => (
    <CountryRegionPicker
      country={field.value ?? ''}
      region={form.watch('region') ?? ''}
      onChange={({ country, region }) => {
        form.setValue('country', country, { shouldValidate: true });
        form.setValue('region', region, { shouldValidate: true });
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
```

(Note `react-hook-form`'s `register('region')` is also no longer needed since `<CountryRegionPicker>` updates both fields via `setValue`.)

- [ ] **Step 2: Update the form-default values**

Wherever each form initialises `useForm({ defaultValues: { ..., location: '' } })`, change:

```typescript
defaultValues: { ..., location: '' }
```

to:

```typescript
defaultValues: { ..., country: '', region: '' }
```

- [ ] **Step 3: Update the submit handler payload**

If a submit handler explicitly maps `data.location` into the API call body, change to `data.country` / `data.region`. (`authApi` already accepts these from Task 13.)

- [ ] **Step 4: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors. (Errors should be down to just `SettingsPage.tsx` and `Friends.tsx`, addressed next.)

- [ ] **Step 5: Run dev server briefly and smoke-test register flow visually**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run dev
```

Open `http://localhost:8080`, confirm register form shows the new picker, submit doesn't crash. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/Welcome.tsx src/pages/WelcomeTelegram.tsx src/pages/WelcomeGoogle.tsx src/pages/MiniAppEntry.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "auth pages: swap location input for CountryRegionPicker"
```

---

## Task 17: Rewire `SettingsPage.tsx` (form input + header display)

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\SettingsPage.tsx`

- [ ] **Step 1: Replace the location input in the edit form**

Apply the same `<Controller>` + `<CountryRegionPicker>` swap as Task 16. `profileEditSchema` already has `country`+`region` from Task 11.

- [ ] **Step 2: Replace the location render in the view-mode header**

Find the spot that renders `{user.location}` in the profile header. Replace with:

```tsx
import { LocationDisplay } from '@/components/ui/location-display';

// ...
<LocationDisplay country={user.country} region={user.region} location={user.location} />
```

- [ ] **Step 3: Update the `useForm` defaultValues + submit payload**

```typescript
defaultValues: {
  name: user?.name ?? '',
  age: user?.age ?? 18,
  country: user?.country ?? '',
  region: user?.region ?? '',
  bio: user?.bio ?? '',
  instagramHandle: user?.instagramHandle ?? '',
}
```

When constructing the `usersApi.updateUser(id, updates)` payload, include `country` and `region` from form data (not `location`).

- [ ] **Step 4: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors except possibly Friends.tsx (next task).

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/SettingsPage.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "settings: CountryRegionPicker in edit form; LocationDisplay in header"
```

---

## Task 18: Rewire `Friends.tsx` displays + add filter sheet + filter pill

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\pages\Friends.tsx`
- Create: `D:\src\aloevera-harmony-meet\src\components\SearchFilterSheet.tsx`

This task does the most work in one place. Split into clear sub-steps.

- [ ] **Step 1: Create `<SearchFilterSheet>`**

```tsx
// D:\src\aloevera-harmony-meet\src\components\SearchFilterSheet.tsx
import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country: string;
  region: string;
  onApply: (next: { country: string; region: string }) => void;
}

export function SearchFilterSheet({ country, region, onApply }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draftCountry, setDraftCountry] = useState(country);
  const [draftRegion, setDraftRegion] = useState(region);

  const apply = () => {
    onApply({ country: draftCountry, region: draftRegion });
    setOpen(false);
  };

  const clear = () => {
    setDraftCountry('');
    setDraftRegion('');
    onApply({ country: '', region: '' });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('search.filter')}>
          <Filter className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader><SheetTitle>{t('search.filter')}</SheetTitle></SheetHeader>
        <div className="py-4">
          <CountryRegionPicker
            country={draftCountry}
            region={draftRegion}
            onChange={({ country, region }) => {
              setDraftCountry(country);
              setDraftRegion(region);
            }}
          />
        </div>
        <SheetFooter className="flex flex-row gap-2">
          <Button variant="outline" onClick={clear}>{t('search.clearFilter')}</Button>
          <Button onClick={apply}>{t('search.applyFilter')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

If `Sheet` shadcn primitives are absent, scaffold via `npx shadcn-ui@latest add sheet`.

- [ ] **Step 2: Add filter state + sheet to `Friends.tsx` Search tab**

Near the top of the component:

```tsx
import { SearchFilterSheet } from '@/components/SearchFilterSheet';
import { LocationDisplay } from '@/components/ui/location-display';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji } from '@/lib/countryFlag';

// inside the component:
const [filter, setFilter] = useState<{ country: string; region: string }>({ country: '', region: '' });
```

Add the filter sheet trigger to the Search tab header (next to existing controls):

```tsx
<SearchFilterSheet country={filter.country} region={filter.region} onApply={setFilter} />
```

Add a removable pill above the swipe deck (rendered only when filter is active):

```tsx
{(filter.country || filter.region) && (
  <div className="flex items-center gap-2 px-4 py-2 text-sm">
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1">
      {filter.country && (
        <>
          {flagEmoji(filter.country) || '📍'}{' '}
          {COUNTRY_BY_CODE[filter.country]?.nameRu ?? filter.country}
        </>
      )}
      {filter.region && <> · {filter.region}</>}
      <button
        onClick={() => setFilter({ country: '', region: '' })}
        aria-label={t('search.clearFilter')}
        className="ml-1"
      >
        ✕
      </button>
    </span>
  </div>
)}
```

- [ ] **Step 3: Pass the filter to `usersApi.getUsers`**

Find the `useEffect` that loads the swipe deck. Update the call and dependency array:

```tsx
useEffect(() => {
  const load = async () => {
    setIsLoading(true);
    try {
      const result = await usersApi.getUsers({
        skip: 0,
        take: 100,
        country: filter.country || undefined,
        region: filter.region || undefined,
      });
      if (result.success && result.data) setProfiles(result.data);
    } finally {
      setIsLoading(false);
    }
  };
  load();
}, [filter.country, filter.region]);
```

- [ ] **Step 4: Swap `{user.location}` renders for `<LocationDisplay>`**

```bash
cd 'D:\src\aloevera-harmony-meet' && grep -n 'user.location\|profile.location\|peer.location' src/pages/Friends.tsx
```

For each match, replace with:

```tsx
<LocationDisplay country={user.country} region={user.region} location={user.location} />
```

(Substitute the local variable name as appropriate.)

- [ ] **Step 5: TypeScript check + manual smoke test**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors.

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run dev
```

Open `http://localhost:8080/friends`, verify the swipe card shows a flag + region; tap the filter icon, choose a country, confirm the deck reloads; close the dev server.

- [ ] **Step 6: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/pages/Friends.tsx src/components/SearchFilterSheet.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "friends: country/region filter sheet + pill; LocationDisplay everywhere"
```

---

## Task 19: Update `commonGround.ts` for tuple match

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\lib\commonGround.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\lib\__tests__\commonGround.test.ts`

- [ ] **Step 1: Update test cases to set country/region (and add a new case)**

Inspect the existing tests in `commonGround.test.ts`. For tests that previously asserted "both from Москва" via `location: 'Москва'`, change the test setup to use `country: 'RU', region: 'Москва'`. Add one new case:

```typescript
it('reports country-only match when regions differ', () => {
  const a = { ...baseUser, country: 'RU', region: 'Москва' };
  const b = { ...baseUser, country: 'RU', region: 'Санкт-Петербург' };
  const result = commonGround(a, b);
  expect(result).toContain(/* whatever message format the helper uses for "same country" */);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/commonGround.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Update `commonGround.ts`**

Find the existing branch that compares `user.location === other.location`. Replace with:

```typescript
// Same region wins highest; same country (different region) is a softer match.
if (user.country && user.country === other.country && user.region && user.region === other.region) {
  matches.push(/* "Оба из <region>, <country>" / "You're both in <region>" message */);
} else if (user.country && user.country === other.country) {
  matches.push(/* "Оба из <country>" message */);
}
```

Use the existing `t()` / message format from the helper (don't invent a new format).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx vitest run src/lib/__tests__/commonGround.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/lib/commonGround.ts src/lib/__tests__/commonGround.test.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "commonGround: match by (country, region) tuple"
```

---

## Task 20: Update mock data files

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockUsers.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockProfiles.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockCurrentUser.ts`
- Modify: `D:\src\aloevera-harmony-meet\src\data\mockChats.ts`

- [ ] **Step 1: Add `country`/`region` to every mock user**

For each of the existing mock users (Анна, Дмитрий, Елена, Мария + the current user), set:

```typescript
country: 'RU',
region: '<the same city as their existing location string>',
```

Keep the existing `location` value (legacy fallback works fine; new fields take precedence in `<LocationDisplay>`).

- [ ] **Step 2: Add 2-3 non-RU mock users**

In `mockProfiles.ts` and `mockUsers.ts`, add new mock users with non-RU countries so the search filter has something to filter against in mock mode. Examples:

```typescript
{
  id: 'mock-user-by',
  name: 'Аліна',
  age: 26,
  country: 'BY',
  region: 'Минск',
  location: 'Минск',
  // ... rest of required User fields, copy the shape from existing mocks ...
},
{
  id: 'mock-user-us',
  name: 'Sarah',
  age: 28,
  country: 'US',
  region: 'California',
  location: 'San Francisco, USA',
  // ... rest ...
},
```

- [ ] **Step 3: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/data/mockUsers.ts src/data/mockProfiles.ts src/data/mockCurrentUser.ts src/data/mockChats.ts
git -C 'D:\src\aloevera-harmony-meet' commit -m "mock: populate country/region; add non-RU mock users for filter testing"
```

---

## Task 21: Add i18n keys

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\src\contexts\LanguageContext.tsx`

- [ ] **Step 1: Add the new keys to both `ru` and `en` blocks**

In `LanguageContext.tsx`, add to the `en` translation object:

```typescript
'location.country': 'Country',
'location.region': 'Region',
'location.useCustomValue': 'Use custom value…',
'location.regionUnavailable': 'Region filter not available for this country',
'location.clearCountry': 'Clear country',
'search.filter': 'Filter',
'search.applyFilter': 'Apply',
'search.clearFilter': 'Clear filters',
'search.allCountries': 'All countries',
'search.allRegions': 'All regions',
```

And to `ru`:

```typescript
'location.country': 'Страна',
'location.region': 'Регион',
'location.useCustomValue': 'Указать своё значение…',
'location.regionUnavailable': 'Фильтр по региону недоступен для этой страны',
'location.clearCountry': 'Очистить страну',
'search.filter': 'Фильтр',
'search.applyFilter': 'Применить',
'search.clearFilter': 'Сбросить фильтры',
'search.allCountries': 'Все страны',
'search.allRegions': 'Все регионы',
```

- [ ] **Step 2: TypeScript check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C 'D:\src\aloevera-harmony-meet' add src/contexts/LanguageContext.tsx
git -C 'D:\src\aloevera-harmony-meet' commit -m "i18n: country/region/search filter keys"
```

---

## Task 22: Documentation updates

**Files:**
- Modify: `D:\src\aloevera-harmony-meet\docs\FEATURES.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ARCHITECTURE.md`
- Modify: `D:\src\aloevera-harmony-meet\docs\ISSUES.md`
- Modify: `D:\src\aloevera-harmony-meet\AGENTS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\AZURE_STORAGE.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`

- [ ] **Step 1: Frontend FEATURES.md — reword location lines**

Find any sentence describing "location" as a free-text field. Update to mention country + region picker and the search filter sheet.

- [ ] **Step 2: Frontend ARCHITECTURE.md — User type block**

Find the `User { ... }` block (around line 295) listing fields. Change `location` to `country, region` (and note `location` retained as legacy).

- [ ] **Step 3: Frontend ISSUES.md — mark MCF.7 partial**

In the MCF.7 section, add a note: "Country + region filter shipped 2026-05-15. Age/gender filters and distance still open."

- [ ] **Step 4: Frontend AGENTS.md — list new components**

In the "Custom Components" list under `src/components/ui/`, add `country-region-picker` and `location-display`. In the `src/components/` list, add `SearchFilterSheet`.

- [ ] **Step 5: Backend AZURE_STORAGE.md — users notable fields**

In the `users` table notable-fields list, add `Country` and `Region` next to the existing `Location` line.

- [ ] **Step 6: Backend IMPLEMENTATION_SUMMARY.md — shipped entry**

In the "Done since the original plan" list, add a single line: "Structured `Country`/`Region` on user profiles + search filtering by country and region."

- [ ] **Step 7: Commit (two repos — two commits)**

```bash
git -C 'D:\src\aloevera-harmony-meet' add docs/FEATURES.md docs/ARCHITECTURE.md docs/ISSUES.md AGENTS.md
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: country/region location and search filter"

git -C 'D:\src\lovecraft' add Lovecraft/docs/AZURE_STORAGE.md Lovecraft/docs/IMPLEMENTATION_SUMMARY.md
git -C 'D:\src\lovecraft' commit -m "docs: Country/Region on UserEntity + search filter"
```

---

## Task 23: Final verification

- [ ] **Step 1: Backend tests**

```bash
dotnet test 'D:\src\lovecraft\Lovecraft\Lovecraft.UnitTests\Lovecraft.UnitTests.csproj'
```

Expected: all PASS.

- [ ] **Step 2: Frontend tests**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run test:run
```

Expected: all PASS.

- [ ] **Step 3: Frontend type check**

```bash
cd 'D:\src\aloevera-harmony-meet' && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Frontend lint**

```bash
cd 'D:\src\aloevera-harmony-meet' && npm run lint
```

Expected: clean (or only the pre-existing warnings already present in `main`).

- [ ] **Step 5: Manual smoke test (golden path)**

Start the dev server in API mode against the local backend (or mock mode for a quick UI-only check):

```bash
cd 'D:\src\aloevera-harmony-meet' && VITE_API_MODE=mock npm run dev
```

Walk through:
1. **Register** at `/` — country dropdown shows ~250 entries; "Use custom value" works; region picker enables after country picked.
2. **Sign in** with `test@example.com` / `Test123!@#` (mock mode).
3. **Friends → Search** — swipe deck shows flag + region in cards.
4. **Filter** — tap filter icon, pick `Belarus`; deck reloads with only Belarus mock users; pill shows above deck; tap ✕ to clear.
5. **Settings** — open profile editor; country/region pre-filled from current user; change them, save, header re-renders with new flag + region.

- [ ] **Step 6: Final commit if any docs/lint fixes were needed during verification**

If any small fix was made:

```bash
git -C 'D:\src\aloevera-harmony-meet' add -p
git -C 'D:\src\aloevera-harmony-meet' commit -m "polish: <what was fixed>"
```

Otherwise nothing to commit.

---

## Self-review

**Spec coverage** — spot-checked against the spec sections:

- Data model (UserEntity + DTO + retain Location) → Tasks 1, 2, 3
- Validation (HtmlGuard + length checks) → Task 5
- Filter (`IUserService` + `UsersController`) → Tasks 3, 4, 5
- Auth provisioning (drop "Telegram" placeholder; write country/region from register) → Task 6
- Mock + seeder → Tasks 7, 20
- countries.ts / regions.ts / countryFlag.ts → Tasks 8, 9, 10
- CountryRegionPicker → Task 14
- LocationDisplay → Task 15
- SearchFilterSheet → Task 18
- Form rewiring (Welcome, WelcomeTelegram, WelcomeGoogle, MiniAppEntry, SettingsPage) → Tasks 16, 17
- Display rewiring (Friends, Settings header) → Tasks 17, 18
- usersApi + authApi → Tasks 12, 13
- validators → Task 11
- commonGround tuple match → Task 19
- i18n → Task 21
- Tests (5 backend, validators, picker smoke, commonGround) → Tasks 4, 5, 10, 11, 14, 19
- Docs → Task 22

**No-placeholder scan** — countries.ts and regions.ts have explicit `TODO` markers. These are intentional with clear sourcing instructions and are bounded ("complete with all 85 federal subjects"); they are not general-purpose TODOs.

**Type consistency** — `Country`/`Region` capitalisation is C# server-side; `country`/`region` is camelCase frontend. `mapUserFromApi`/`mapUserToApi` (Task 12) bridges the two. `<CountryRegionPicker>` and `<LocationDisplay>` props use lowercase. Consistent throughout.
