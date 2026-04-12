# Input Sanitization Design (PB.5)

**Date**: 2026-04-11
**Status**: Approved
**Scope**: Backend — `Lovecraft.Backend`

---

## Problem

Forum replies, chat messages, and user profile fields (name, location, bio) are stored without any HTML check. React escapes plain string output by default, so there is no active XSS vector today. However, when rich text rendering (MCF.11) is implemented, unsanitized stored content becomes a direct XSS vulnerability. This must be resolved before MCF.11 ships.

---

## Decision

**Reject** inputs that contain HTML tags with a `400 Bad Request` response. Do not strip or transform — return an error and let the client correct the input. Validation lives in the **controller layer** (HTTP boundary), keeping the service layer unaware of HTTP concerns.

HTML detection is handled by a shared static helper (`HtmlGuard`) to avoid duplicating the regex across controllers.

---

## New File

### `Lovecraft.Backend/Helpers/HtmlGuard.cs`

```csharp
public static class HtmlGuard
{
    private static readonly Regex HtmlTagPattern = new(
        @"<[a-zA-Z!/?][^>]*>",
        RegexOptions.Compiled | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(100)  // ReDoS guard
    );

    public static bool ContainsHtml(string? value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        try
        {
            return HtmlTagPattern.IsMatch(value);
        }
        catch (RegexMatchTimeoutException)
        {
            // Pathological input triggered the timeout — treat as containing HTML and reject.
            return true;
        }
    }
}
```

**Regex behaviour:**
- Matches: `<script>`, `<SCRIPT>`, `</b>`, `<br/>`, `<img src="x"/>`, `<!DOCTYPE html>`
- Matches HTML comments: `<!--comment-->`. Note: for comments containing a `>` in the body (e.g. `<!-- a > b -->`), the pattern matches only up to the first `>`, which still produces a match and correctly rejects the input.
- Does NOT match: `<3`, `5 < 10`, `a < b`, `"price < "` (no closing `>`) — no false positives on common plain text.
- 100 ms timeout prevents ReDoS on pathological inputs. `RegexMatchTimeoutException` is caught and treated as a positive match (reject).

---

## Modified Controllers

All checks use error code `"HTML_NOT_ALLOWED"` for uniform frontend handling.

### `ForumController` — `CreateTopic`

Insert after the existing `ModelState.IsValid` check, before the `try` block:

```csharp
if (HtmlGuard.ContainsHtml(request.Title))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic title"));
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic content"));
```

### `ForumController` — `CreateReply`

Insert before the `try` block (the current action has no early-return zone — insert before `try` on line 144, outside it):

```csharp
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<ForumReplyDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in reply content"));
```

### `ChatsController` — `SendMessage`

Insert after the existing empty-content check:

```csharp
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<MessageDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in messages"));
```

### `UsersController` — `UpdateUser`

Insert before the `try` block:

```csharp
if (HtmlGuard.ContainsHtml(user.Name))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in name"));
if (HtmlGuard.ContainsHtml(user.Location))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in location"));
if (HtmlGuard.ContainsHtml(user.Bio))
    return BadRequest(ApiResponse<UserDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in bio"));
```

---

## Tests

**File**: `Lovecraft.UnitTests/HtmlGuardTests.cs`

| Input | Expected | Notes |
|---|---|---|
| `null` | `false` | |
| `""` | `false` | |
| `"Hello world"` | `false` | |
| `"5 < 10"` | `false` | comparison operator, no closing `>` |
| `"price < "` | `false` | `<` at end, no closing `>` |
| `"<3"` | `false` | digit after `<`, not a tag |
| `"<b>bold</b>"` | `true` | |
| `"<script>alert(1)</script>"` | `true` | |
| `"<SCRIPT>alert(1)</SCRIPT>"` | `true` | uppercase tags |
| `"<img src='x' onerror='alert(1)'>"` | `true` | attribute injection |
| `"<br/>"` | `true` | self-closing tag |
| `"</div>"` | `true` | closing tag |
| `"<!DOCTYPE html>"` | `true` | |
| `"<!--comment-->"` | `true` | |

No controller tests needed for the guard calls — they are a single `if` delegating entirely to `HtmlGuard`, which is fully covered above. Controller wiring is validated manually via Swagger or end-to-end testing.

---

## Out of Scope

- HTML stripping / sanitization (deferred to MCF.11 when rich text is introduced)
- Frontend error handling for `HTML_NOT_ALLOWED` (frontend currently uses plain text inputs only; no user can accidentally trigger this through normal use)
- Length limits on fields (separate concern)
- **SignalR hub `SendMessage` path** — `ChatHub.SendMessage` is the active real-time write path: it persists messages via `IChatService.SendMessageAsync` and broadcasts to `OthersInGroup`. It bypasses the controller entirely, so the guard added to `ChatsController.SendMessage` provides **no protection for real-time messages**. This gap must be closed before MCF.11 ships — either by moving the guard into `IChatService.SendMessageAsync` (both Mock and Azure) or by adding an equivalent check inside the hub method. It is deferred here only because the chat backend is not yet wired to the frontend in production. **Do not treat the REST guard as sufficient chat protection.**

---

## Files Changed

| File | Change |
|---|---|
| `Lovecraft.Backend/Helpers/HtmlGuard.cs` | New |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | Modified |
| `Lovecraft.Backend/Controllers/V1/ChatsController.cs` | Modified |
| `Lovecraft.Backend/Controllers/V1/UsersController.cs` | Modified |
| `Lovecraft.UnitTests/HtmlGuardTests.cs` | New |
