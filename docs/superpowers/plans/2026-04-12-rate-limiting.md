# Rate Limiting on Auth Endpoints (PB.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Throttle `POST /auth/login`, `POST /auth/register`, and `POST /auth/forgot-password` to 5 requests per 15 minutes per IP, returning 429 with `HTML_NOT_ALLOWED`-style error body on excess.

**Architecture:** ASP.NET Core built-in `AddRateLimiter` (no new NuGet packages). Sliding window policy partitioned by remote IP, applied opt-in via `[EnableRateLimiting("AuthRateLimit")]` on three action methods. `UseForwardedHeaders` runs first so the limiter sees the real client IP behind nginx/Cloudflare. Integration tests use `WebApplicationFactory<Program>`; `Microsoft.AspNetCore.Mvc.Testing` is added to the test project.

**Tech Stack:** .NET 10, ASP.NET Core built-in rate limiting, xUnit + WebApplicationFactory. No new backend NuGet packages except `Microsoft.AspNetCore.Mvc.Testing` in the test project.

---

## File Map

| File | Change |
|---|---|
| `Lovecraft.UnitTests/Lovecraft.UnitTests.csproj` | **Modify** — add `Microsoft.AspNetCore.Mvc.Testing` package reference |
| `Lovecraft.UnitTests/RateLimitingTests.cs` | **Create** — integration tests (written first, fail until Task 2) |
| `Lovecraft.Backend/Program.cs` | **Modify** — add `UseForwardedHeaders` + `AddRateLimiter` + `UseRateLimiter` + `public partial class Program {}` |
| `Lovecraft.Backend/Controllers/V1/AuthController.cs` | **Modify** — add `[EnableRateLimiting("AuthRateLimit")]` to Login, Register, ForgotPassword |

All files are in `D:\src\lovecraft\Lovecraft\`. All commands run from that directory.

---

## Task 1: Write failing integration tests

**Files:**
- Modify: `Lovecraft.UnitTests/Lovecraft.UnitTests.csproj`
- Create: `Lovecraft.UnitTests/RateLimitingTests.cs`

- [ ] **Step 1.1: Add `Microsoft.AspNetCore.Mvc.Testing` to the test project**

In `Lovecraft.UnitTests/Lovecraft.UnitTests.csproj`, add inside the first `<ItemGroup>` alongside existing package references:

```xml
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
```

Also ensure the test project's SDK can find ASP.NET Core types — add inside `<PropertyGroup>`:

```xml
<PreserveCompilationContext>true</PreserveCompilationContext>
```

- [ ] **Step 1.2: Add `public partial class Program {}` to bottom of `Program.cs`**

Append at the very end of `Lovecraft.Backend/Program.cs` (after `app.Run();`):

```csharp
// Required for WebApplicationFactory<Program> in integration tests
public partial class Program { }
```

- [ ] **Step 1.3: Create the integration test file**

```csharp
// Lovecraft.UnitTests/RateLimitingTests.cs
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Lovecraft.UnitTests;

public class RateLimitingTests
{
    // Each test creates its own factory so rate-limiter in-memory state is isolated.

    [Fact]
    public async Task Login_ExceedingRateLimit_Returns429()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        HttpResponseMessage? last = null;
        for (int i = 0; i <= 5; i++) // 6 requests — one over the 5-per-15-min limit
        {
            last = await client.PostAsJsonAsync("/api/v1/auth/login",
                new { email = "attacker@evil.com", password = "wrong" });
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }

    [Fact]
    public async Task Login_WithinRateLimit_DoesNotReturn429()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        HttpResponseMessage? last = null;
        for (int i = 0; i < 5; i++) // exactly 5 — at the limit, not over
        {
            last = await client.PostAsJsonAsync("/api/v1/auth/login",
                new { email = "attacker@evil.com", password = "wrong" });
        }

        Assert.NotEqual(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }

    [Fact]
    public async Task Register_ExceedingRateLimit_Returns429()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        HttpResponseMessage? last = null;
        for (int i = 0; i <= 5; i++)
        {
            last = await client.PostAsJsonAsync("/api/v1/auth/register",
                new { email = $"user{i}@evil.com", password = "wrong", name = "Evil" });
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }

    [Fact]
    public async Task ForgotPassword_ExceedingRateLimit_Returns429()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        HttpResponseMessage? last = null;
        for (int i = 0; i <= 5; i++)
        {
            last = await client.PostAsJsonAsync("/api/v1/auth/forgot-password",
                new { email = "victim@example.com" });
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }

    [Fact]
    public async Task RateLimitResponse_HasCorrectErrorCode()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        for (int i = 0; i < 6; i++)
            await client.PostAsJsonAsync("/api/v1/auth/login",
                new { email = "x@x.com", password = "wrong" });

        var response = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "x@x.com", password = "wrong" });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.False(body!.Success);
        Assert.Equal("TOO_MANY_REQUESTS", body.Error?.Code);
    }

    // Minimal shape to deserialise the ApiResponse error without pulling in the full DTO
    private sealed record ErrorBody(bool Success, ErrorDetail? Error);
    private sealed record ErrorDetail(string Code, string Message);
}
```

- [ ] **Step 1.4: Run the new tests — expect failure (rate limiting not wired yet)**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~RateLimitingTests" 2>&1 | tail -20
```

Expected: tests compile but **fail** — all 5 tests return non-429 status codes because the rate limiter is not yet registered.

---

## Task 2: Implement rate limiting

**Files:**
- Modify: `Lovecraft.Backend/Program.cs`
- Modify: `Lovecraft.Backend/Controllers/V1/AuthController.cs`

- [ ] **Step 2.1: Add using directives to Program.cs**

At the top of `Program.cs`, add:

```csharp
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Lovecraft.Common.Models;
```

- [ ] **Step 2.2: Register ForwardedHeaders options**

After `builder.Services.AddAuthorization();` (around line 87), insert:

```csharp
// Trust X-Forwarded-For from nginx/Cloudflare so rate limiter sees the real client IP
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Clear default restrictions — all proxies trusted (nginx sits in front)
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
```

- [ ] **Step 2.3: Register the rate limiter**

After the `ForwardedHeaders` block, insert:

```csharp
// Rate limiting — sliding window, 5 requests / 15 min per IP, applied to auth endpoints
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("AuthRateLimit", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                SegmentsPerWindow = 3,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    options.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        ctx.HttpContext.Response.ContentType = "application/json";

        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            ctx.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString();

        await ctx.HttpContext.Response.WriteAsJsonAsync(
            ApiResponse<object>.ErrorResponse(
                "TOO_MANY_REQUESTS",
                "Too many requests. Please try again later."),
            ct);
    };
});
```

- [ ] **Step 2.4: Insert middleware into the pipeline**

In the pipeline section (after `var app = builder.Build();`), before `app.UseCors(...)`, insert:

```csharp
app.UseForwardedHeaders();
app.UseRateLimiter();
```

The pipeline order should be:
```csharp
app.UseForwardedHeaders();
app.UseRateLimiter();
app.UseCors("AllowFrontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

- [ ] **Step 2.5: Apply the rate limit policy to AuthController endpoints**

Open `Lovecraft.Backend/Controllers/V1/AuthController.cs`.

Add to the using block:
```csharp
using Microsoft.AspNetCore.RateLimiting;
```

Add `[EnableRateLimiting("AuthRateLimit")]` to the `Login`, `Register`, and `ForgotPassword` action methods only. Leave all other endpoints unchanged.

The three decorated actions should look like:

```csharp
[HttpPost("login")]
[AllowAnonymous]
[EnableRateLimiting("AuthRateLimit")]
public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Login(...)

[HttpPost("register")]
[AllowAnonymous]
[EnableRateLimiting("AuthRateLimit")]
public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Register(...)

[HttpPost("forgot-password")]
[AllowAnonymous]
[EnableRateLimiting("AuthRateLimit")]
public async Task<ActionResult<ApiResponse<bool>>> ForgotPassword(...)
```

- [ ] **Step 2.6: Build to verify no errors**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet build Lovecraft.Backend
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 2.7: Run the rate limiting tests — all 5 should pass**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~RateLimitingTests" 2>&1 | tail -10
```

Expected:
```
Passed! - Failed: 0, Passed: 5, Skipped: 0
```

- [ ] **Step 2.8: Commit**

```bash
cd /d/src/lovecraft/Lovecraft && git add Lovecraft.Backend/Program.cs Lovecraft.Backend/Controllers/V1/AuthController.cs Lovecraft.UnitTests/RateLimitingTests.cs Lovecraft.UnitTests/Lovecraft.UnitTests.csproj && git commit -m "feat: add per-IP sliding window rate limiting on auth endpoints (PB.3)"
```

---

## Task 3: Full test run and verification

- [ ] **Step 3.1: Run the full test suite**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test 2>&1 | tail -5
```

Expected: all 118 tests pass (113 existing + 5 new `RateLimitingTests`).

```
Passed! - Failed: 0, Passed: 118, Skipped: 0
```

- [ ] **Step 3.2: Update ISSUES.md — mark PB.3 resolved**

In `D:\src\aloevera-harmony-meet\docs\ISSUES.md`:
- Remove the `PB.3. No Rate Limiting on Auth Endpoints` section entirely
- Add to `## 📝 Changelog` at the bottom:

```markdown
**April 12, 2026** — PB.3 (rate limiting) resolved. Sliding window rate limiter (5 req / 15 min / IP) applied to `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password`. Returns 429 `TOO_MANY_REQUESTS` with `Retry-After` header. `UseForwardedHeaders` added so real client IP is used behind nginx/Cloudflare. `refresh`, `logout`, and other auth endpoints are intentionally not rate-limited.
```

- Update summary table: `🔴 Production Blockers` drops from `3` to `2`.

- [ ] **Step 3.3: Final commit**

```bash
cd /d/src/aloevera-harmony-meet && git add docs/ISSUES.md && git commit -m "docs: mark PB.3 rate limiting as resolved"
```
