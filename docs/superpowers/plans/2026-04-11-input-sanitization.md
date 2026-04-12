# Input Sanitization (PB.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject user-submitted content containing HTML tags with a 400 response, protecting against XSS when rich text rendering is added later.

**Architecture:** A shared static `HtmlGuard` helper performs regex-based HTML detection. Each affected controller calls it before the service call and returns `BadRequest` with error code `HTML_NOT_ALLOWED` if a tag is found. No service-layer changes needed.

**Tech Stack:** .NET 10, ASP.NET Core, xUnit. No new NuGet packages.

**Spec:** `docs/superpowers/specs/2026-04-11-input-sanitization-design.md`

---

## File Map

| File | Change |
|---|---|
| `Lovecraft/Lovecraft.Backend/Helpers/HtmlGuard.cs` | **Create** — static HTML detection helper |
| `Lovecraft/Lovecraft.UnitTests/HtmlGuardTests.cs` | **Create** — 14 theory test cases |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/ForumController.cs` | **Modify** — guard in `CreateTopic` and `CreateReply` |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/ChatsController.cs` | **Modify** — guard in `SendMessage` |
| `Lovecraft/Lovecraft.Backend/Controllers/V1/UsersController.cs` | **Modify** — guard in `UpdateUser` |

All files are in `D:\src\lovecraft\Lovecraft\`. All commands run from that directory.

---

## Task 1: Write failing tests for HtmlGuard

**Files:**
- Create: `Lovecraft.UnitTests/HtmlGuardTests.cs`

- [ ] **Step 1.1: Create the test file**

```csharp
// Lovecraft.UnitTests/HtmlGuardTests.cs
using Lovecraft.Backend.Helpers;

namespace Lovecraft.UnitTests;

public class HtmlGuardTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("Hello world", false)]
    [InlineData("5 < 10", false)]
    [InlineData("price < ", false)]
    [InlineData("<3", false)]
    [InlineData("<b>bold</b>", true)]
    [InlineData("<script>alert(1)</script>", true)]
    [InlineData("<SCRIPT>alert(1)</SCRIPT>", true)]
    [InlineData("<img src='x' onerror='alert(1)'>", true)]
    [InlineData("<br/>", true)]
    [InlineData("</div>", true)]
    [InlineData("<!DOCTYPE html>", true)]
    [InlineData("<!--comment-->", true)]
    public void ContainsHtml_ReturnsExpected(string? input, bool expected)
    {
        Assert.Equal(expected, HtmlGuard.ContainsHtml(input));
    }
}
```

- [ ] **Step 1.2: Run tests to confirm they fail (class does not exist yet)**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~HtmlGuardTests" -v
```

Expected: build error — `The type or namespace name 'HtmlGuard' could not be found`.

---

## Task 2: Implement HtmlGuard

**Files:**
- Create: `Lovecraft.Backend/Helpers/HtmlGuard.cs`

- [ ] **Step 2.1: Create the Helpers directory and HtmlGuard class**

```csharp
// Lovecraft.Backend/Helpers/HtmlGuard.cs
using System.Text.RegularExpressions;

namespace Lovecraft.Backend.Helpers;

public static class HtmlGuard
{
    private static readonly Regex HtmlTagPattern = new(
        @"<[a-zA-Z!/?][^>]*>",
        RegexOptions.Compiled | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(100)  // ReDoS guard
    );

    /// <summary>
    /// Returns true if <paramref name="value"/> contains any HTML tag.
    /// Returns true on regex timeout (treat pathological input as unsafe).
    /// </summary>
    public static bool ContainsHtml(string? value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        try
        {
            return HtmlTagPattern.IsMatch(value);
        }
        catch (RegexMatchTimeoutException)
        {
            return true;
        }
    }
}
```

- [ ] **Step 2.2: Run the tests — all 14 should pass**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test Lovecraft.UnitTests --filter "FullyQualifiedName~HtmlGuardTests" -v
```

Expected output:
```
Test run for Lovecraft.UnitTests
...
Passed! - Failed: 0, Passed: 14, Skipped: 0
```

- [ ] **Step 2.3: Commit**

```bash
cd /d/src/lovecraft/Lovecraft && git add Lovecraft.Backend/Helpers/HtmlGuard.cs Lovecraft.UnitTests/HtmlGuardTests.cs && git commit -m "feat: add HtmlGuard helper with tests (PB.5)"
```

---

## Task 3: Guard ForumController

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/ForumController.cs`

Add `using Lovecraft.Backend.Helpers;` to the top of the file, then add the two guards below.

- [ ] **Step 3.1: Add the using directive**

Open `Lovecraft.Backend/Controllers/V1/ForumController.cs`. Add this line to the existing `using` block at the top:

```csharp
using Lovecraft.Backend.Helpers;
```

- [ ] **Step 3.2: Guard CreateTopic**

In `CreateTopic`, after the existing `ModelState.IsValid` check and before the `try` block, insert:

```csharp
if (HtmlGuard.ContainsHtml(request.Title))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic title"));
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic content"));
```

The method should look like this after the edit (the `authorId`/`authorName` lines are already in the file between the `ModelState` check and the `try` — the HTML guards go after `ModelState` but before those extractions):

```csharp
[HttpPost("sections/{sectionId}/topics")]
public async Task<IActionResult> CreateTopic(
    string sectionId, [FromBody] CreateTopicRequestDto request)
{
    if (!ModelState.IsValid)
        return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse(
            "VALIDATION_ERROR", "Validation failed"));

    if (HtmlGuard.ContainsHtml(request.Title))
        return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic title"));
    if (HtmlGuard.ContainsHtml(request.Content))
        return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic content"));

    var authorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var authorName = User.FindFirst(ClaimTypes.Name)?.Value;

    try
    {
        var result = await _forumService.CreateTopicAsync(
            sectionId, authorId!, authorName!, request.Title, request.Content);
        return Ok(ApiResponse<ForumTopicDto>.SuccessResponse(result));
    }
    catch (KeyNotFoundException)
    {
        return NotFound(ApiResponse<ForumTopicDto>.ErrorResponse(
            "NOT_FOUND", "Section not found"));
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error creating topic in section {SectionId}", sectionId);
        return StatusCode(500, ApiResponse<ForumTopicDto>.ErrorResponse(
            "INTERNAL_ERROR", "An error occurred while creating the topic"));
    }
}
```

- [ ] **Step 3.3: Guard CreateReply**

In `CreateReply`, after extracting `authorId`/`authorName` and before the `try` block, insert:

```csharp
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<ForumReplyDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in reply content"));
```

The method should look like this after the edit:

```csharp
[HttpPost("topics/{topicId}/replies")]
public async Task<ActionResult<ApiResponse<ForumReplyDto>>> CreateReply(string topicId, [FromBody] CreateReplyRequestDto request)
{
    var authorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var authorName = User.FindFirst(ClaimTypes.Name)?.Value;

    if (HtmlGuard.ContainsHtml(request.Content))
        return BadRequest(ApiResponse<ForumReplyDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in reply content"));

    try
    {
        // ... existing code unchanged
    }
```

- [ ] **Step 3.4: Build to verify no errors**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet build Lovecraft.Backend
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 3.5: Commit**

```bash
cd /d/src/lovecraft/Lovecraft && git add Lovecraft.Backend/Controllers/V1/ForumController.cs && git commit -m "feat: reject HTML in forum topic and reply content (PB.5)"
```

---

## Task 4: Guard ChatsController

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/ChatsController.cs`

- [ ] **Step 4.1: Add the using directive**

Open `Lovecraft.Backend/Controllers/V1/ChatsController.cs`. Add to the existing `using` block:

```csharp
using Lovecraft.Backend.Helpers;
```

- [ ] **Step 4.2: Guard SendMessage**

In `SendMessage`, after the existing empty-content check (`IsNullOrWhiteSpace`), insert:

```csharp
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<MessageDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in messages"));
```

The block should look like this after the edit:

```csharp
[HttpPost("{id}/messages")]
public async Task<ActionResult<ApiResponse<MessageDto>>> SendMessage(
    string id, [FromBody] SendMessageRequestDto request)
{
    if (string.IsNullOrWhiteSpace(request.Content))
        return BadRequest(ApiResponse<MessageDto>.ErrorResponse("CONTENT_REQUIRED", "Message content cannot be empty"));

    if (HtmlGuard.ContainsHtml(request.Content))
        return BadRequest(ApiResponse<MessageDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in messages"));

    if (!await _chatService.ValidateAccessAsync(id, CurrentUserId))
        return Forbid();

    // ... existing code unchanged
```

- [ ] **Step 4.3: Build to verify no errors**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet build Lovecraft.Backend
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 4.4: Commit**

```bash
cd /d/src/lovecraft/Lovecraft && git add Lovecraft.Backend/Controllers/V1/ChatsController.cs && git commit -m "feat: reject HTML in chat messages (PB.5)"
```

---

## Task 5: Guard UsersController

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/UsersController.cs`

- [ ] **Step 5.1: Add the using directive**

Open `Lovecraft.Backend/Controllers/V1/UsersController.cs`. Add to the existing `using` block:

```csharp
using Lovecraft.Backend.Helpers;
```

- [ ] **Step 5.2: Guard UpdateUser**

In `UpdateUser`, before the `try` block, insert:

```csharp
if (HtmlGuard.ContainsHtml(user.Name))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in name"));
if (HtmlGuard.ContainsHtml(user.Location))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in location"));
if (HtmlGuard.ContainsHtml(user.Bio))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in bio"));
```

The method should look like this after the edit:

```csharp
[HttpPut("{id}")]
public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(string id, [FromBody] UserDto user)
{
    if (HtmlGuard.ContainsHtml(user.Name))
        return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in name"));
    if (HtmlGuard.ContainsHtml(user.Location))
        return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in location"));
    if (HtmlGuard.ContainsHtml(user.Bio))
        return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in bio"));

    try
    {
        var updatedUser = await _userService.UpdateUserAsync(id, user);
        return Ok(ApiResponse<UserDto>.SuccessResponse(updatedUser));
    }
    // ... existing catch unchanged
```

- [ ] **Step 5.3: Build to verify no errors**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet build Lovecraft.Backend
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 5.4: Commit**

```bash
cd /d/src/lovecraft/Lovecraft && git add Lovecraft.Backend/Controllers/V1/UsersController.cs && git commit -m "feat: reject HTML in user profile fields (PB.5)"
```

---

## Task 6: Full test run and verification

- [ ] **Step 6.1: Run the full test suite**

```bash
cd /d/src/lovecraft/Lovecraft && dotnet test -v
```

Expected: all 95 tests pass (81 existing + 14 new `HtmlGuardTests`).

```
Passed! - Failed: 0, Passed: 95, Skipped: 0
```

- [ ] **Step 6.2: Manual smoke test via Swagger**

Start the backend:
```bash
cd /d/src/lovecraft/Lovecraft/Lovecraft.Backend && dotnet run
```

Open `http://localhost:5000/swagger`. Authenticate with `test@example.com` / `Test123!@#`.

Test the following — each should return `400 HTML_NOT_ALLOWED`:

| Endpoint | Field | Payload |
|---|---|---|
| `POST /api/v1/forum/sections/{id}/topics` | `title` | `{"title": "<b>test</b>", "content": "ok"}` |
| `POST /api/v1/forum/sections/{id}/topics` | `content` | `{"title": "ok", "content": "<script>alert(1)</script>"}` |
| `POST /api/v1/forum/topics/{id}/replies` | `content` | `{"content": "<img src=x onerror=alert(1)>"}` |
| `POST /api/v1/chats/{id}/messages` | `content` | `{"content": "<b>hello</b>"}` |
| `PUT /api/v1/users/{id}` | `name` | UserDto with `"name": "<b>evil</b>"` |
| `PUT /api/v1/users/{id}` | `bio` | UserDto with `"bio": "<script>x</script>"` |

Also confirm clean inputs (no HTML) still return `200 OK`.

- [ ] **Step 6.3: Update ISSUES.md — mark PB.5 resolved**

In `D:\src\aloevera-harmony-meet\docs\ISSUES.md`:
- Remove the `PB.5. No Input Sanitization on User-Generated Content` section
- Add an entry to the `## 📝 Changelog` at the bottom:

```markdown
**April 11, 2026** — PB.5 (input sanitization) resolved. `HtmlGuard` static helper rejects inputs containing HTML tags with 400 `HTML_NOT_ALLOWED`. Guards added to `ForumController` (CreateTopic, CreateReply), `ChatsController` (SendMessage), and `UsersController` (UpdateUser: name, location, bio). Note: SignalR hub `SendMessage` path is not covered — must be addressed before MCF.11 ships.
```

- Also update the summary table count: `🔴 Production Blockers` drops from `4` to `3`.

- [ ] **Step 6.4: Final commit**

```bash
cd /d/src/aloevera-harmony-meet && git add docs/ISSUES.md && git commit -m "docs: mark PB.5 input sanitization as resolved"
```
