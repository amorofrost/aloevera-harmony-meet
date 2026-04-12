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
        return HtmlTagPattern.IsMatch(value);
    }
}
```

**Regex behaviour:**
- Matches: `<script>`, `</b>`, `<img src="x"/>`, `<!DOCTYPE html>`, `<!--comment-->`
- Does NOT match: `<3`, `5 < 10`, `a < b` (no false positives on common plain text)
- 100 ms timeout prevents ReDoS on pathological inputs

---

## Modified Controllers

All checks use error code `"HTML_NOT_ALLOWED"` for uniform frontend handling.

### `ForumController` — `CreateTopic`

Insert after the existing `ModelState.IsValid` check:

```csharp
if (HtmlGuard.ContainsHtml(request.Title))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic title"));
if (HtmlGuard.ContainsHtml(request.Content))
    return BadRequest(ApiResponse<ForumTopicDto>.ErrorResponse("HTML_NOT_ALLOWED", "HTML tags are not permitted in topic content"));
```

### `ForumController` — `CreateReply`

Insert before the service call:

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

Insert before the service call:

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

| Input | Expected |
|---|---|
| `null` | `false` |
| `""` | `false` |
| `"Hello world"` | `false` |
| `"5 < 10"` | `false` |
| `"<3"` | `false` |
| `"<b>bold</b>"` | `true` |
| `"<script>alert(1)</script>"` | `true` |
| `"<img src='x' onerror='alert(1)'>"` | `true` |
| `"</div>"` | `true` |
| `"<!DOCTYPE html>"` | `true` |
| `"<!--comment-->"` | `true` |

No controller tests needed for the guard calls — they are a single `if` delegating entirely to `HtmlGuard`, which is fully covered above.

---

## Out of Scope

- HTML stripping / sanitization (deferred to MCF.11 when rich text is introduced)
- Frontend error handling for `HTML_NOT_ALLOWED` (frontend currently uses plain text inputs only; no user can accidentally trigger this through normal use)
- Length limits on fields (separate concern)
- SignalR hub `SendMessage` path — the REST `ChatsController.SendMessage` is the authoritative write path; the hub's `SendMessage` calls `IChatService.SendMessageAsync` directly without going through the controller. This is a known gap: the hub path bypasses controller-layer validation.

---

## Files Changed

| File | Change |
|---|---|
| `Lovecraft.Backend/Helpers/HtmlGuard.cs` | New |
| `Lovecraft.Backend/Controllers/V1/ForumController.cs` | Modified |
| `Lovecraft.Backend/Controllers/V1/ChatsController.cs` | Modified |
| `Lovecraft.Backend/Controllers/V1/UsersController.cs` | Modified |
| `Lovecraft.UnitTests/HtmlGuardTests.cs` | New |
