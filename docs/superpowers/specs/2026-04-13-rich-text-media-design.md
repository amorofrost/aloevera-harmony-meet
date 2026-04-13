# Rich Text & Media Attachments (MCF.11)

**Date**: 2026-04-13  
**Status**: Approved  
**Scope**: BB code formatting + photo attachments in forum replies and private chat messages

---

## Summary

Add basic text formatting (BB codes) and photo attachments (up to 4 images per message) to forum replies and private chat messages. BB codes are stored as raw strings and rendered on the frontend only. Images are uploaded to Azure Blob Storage via a new generic upload endpoint and stored as a URL list alongside the message content.

---

## Decisions Made

| Question | Decision |
|---|---|
| Formatting syntax | BB codes (`[b]`, `[i]`, etc.) — not HTML, not Markdown |
| Where formatting is parsed | Frontend only (client-side rendering) |
| Toolbar style | Floating popup on text selection; separate always-visible photo button |
| Image display | Attachment block below message text (not inline) |
| Max images per message/reply | 4 |
| Image upload destination | Azure Blob Storage `content-images` container |
| HtmlGuard | Unchanged — BB codes are not HTML |

---

## BB Code Tags

All 8 tags are implemented. Enabled/disabled state is controlled by `src/config/bbcode.config.ts`.

| Tag | Syntax | Default |
|---|---|---|
| Bold | `[b]text[/b]` | **enabled** |
| Italic | `[i]text[/i]` | **enabled** |
| Strikethrough | `[s]text[/s]` | **enabled** |
| Quote | `[quote]text[/quote]` | **enabled** |
| Spoiler | `[spoiler]text[/spoiler]` | **enabled** |
| Underline | `[u]text[/u]` | disabled |
| Link | `[url=https://...]label[/url]` | disabled |
| Code | `[code]text[/code]` | disabled |

Disabled tags render as plain text (the raw tag characters are shown, not stripped or rendered).

---

## Data Model Changes

### Backend DTOs (`Lovecraft.Common`)

```csharp
// MessageDto + SendMessageRequestDto
List<string> ImageUrls { get; set; } = new();

// ForumReplyDto + CreateReplyRequestDto
List<string> ImageUrls { get; set; } = new();
```

### Storage Entities (`Lovecraft.Backend`)

```csharp
// MessageEntity + ForumReplyEntity
public string ImageUrls { get; set; } = "[]"; // stored as JSON array
```

### Frontend Types

```typescript
// src/types/chat.ts — MessageDto
imageUrls?: string[];

// src/data/mockForumData.ts — ForumReply
imageUrls?: string[];
```

---

## Backend Architecture

### New endpoint: `POST /api/v1/images/upload`

- Controller: `ImagesController` (`[Authorize]`)
- Accepts: `multipart/form-data` with a `file` field
- Validates:
  - Content type: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - Max size: 10 MB
- Returns: `ApiResponse<{ Url: string }>`
- Error codes: `INVALID_CONTENT_TYPE`, `FILE_TOO_LARGE`, `UPLOAD_FAILED`

### `IImageService` extension

```csharp
Task<string> UploadContentImageAsync(string userId, Stream imageStream, string contentType);
```

- `AzureImageService`: resize to max 1200px, JPEG 85%, upload to `content-images` blob container as `{userId}/{guid}.jpg`, return blob URL
- `MockImageService`: returns `"https://placehold.co/600x400"` immediately

### Service interface updates

```csharp
// IChatService
Task<MessageDto> SendMessageAsync(string chatId, string userId, string content, List<string>? imageUrls = null);

// IForumService
Task<ForumReplyDto> CreateReplyAsync(string topicId, string authorId, string authorName, string content, List<string>? imageUrls = null);
```

Both mock and Azure implementations updated to store/return `ImageUrls`. Controllers pass the list from request DTO to service call.

---

## Frontend Architecture

### `src/config/bbcode.config.ts`

```typescript
export const BBCODE_CONFIG = {
  bold:          true,
  italic:        true,
  underline:     false,
  strikethrough: true,
  url:           false,
  quote:         true,
  code:          false,
  spoiler:       true,
} as const;

export type BbcodeTag = keyof typeof BBCODE_CONFIG;
```

### New components

| File | Purpose |
|---|---|
| `src/components/ui/bbcode-renderer.tsx` | Parses BB code string → React elements. Escapes HTML before parsing. Disabled tags shown as plain text. Spoiler toggles on click. |
| `src/components/ui/bbcode-toolbar.tsx` | Floating pill toolbar that appears on text selection in a linked `<textarea>`. Wraps selected text in BB tags. Only shows buttons for enabled tags. |
| `src/components/ui/image-attachment-picker.tsx` | Camera button that opens `<input type="file" accept="image/*" multiple>`. Max 4 files. Shows thumbnail previews with remove button. Holds `File[]` in state; parent uploads at send time. |
| `src/components/ui/image-attachment-display.tsx` | Renders `imageUrls: string[]` as a grid below message content. 1 → full width; 2 → side-by-side; 3–4 → 2×2 grid. Click opens full-screen lightbox. |

### New API service

**`src/services/api/imagesApi.ts`**:
- `uploadImage(file: File)` — mock: returns placeholder URL after 300ms; API mode: `POST /api/v1/images/upload` via FormData
- Exported from `src/services/api/index.ts`

### Updated services

- `forumsApi.createReply(topicId, content, imageUrls?)` — adds optional `imageUrls`
- `chatsApi.sendMessage(chatId, content, imageUrls?)` — adds optional `imageUrls`

### Updated pages/components

**`src/components/forum/TopicDetail.tsx`**:
- Reply form: `<Textarea>` + `BbcodeToolbar` + `ImageAttachmentPicker`
- On submit: upload files via `imagesApi.uploadImage`, collect URLs, pass to `forumsApi.createReply`
- Reply rendering: `<BbcodeRenderer content={reply.content} />` + `<ImageAttachmentDisplay imageUrls={reply.imageUrls ?? []} />`
- Original post content: also rendered via `<BbcodeRenderer>`

**`src/pages/Friends.tsx`** (private chat):
- Chat input: `<textarea>` replaces `<Input>` + `BbcodeToolbar` + `ImageAttachmentPicker`
- On send: upload files, collect URLs, pass to `chatsApi.sendMessage`
- Message rendering: `<BbcodeRenderer content={msg.content} />` + `<ImageAttachmentDisplay imageUrls={msg.imageUrls ?? []} />`
- SignalR delivery unchanged — `MessageReceived` carries the full `MessageDto`

---

## Security

- **BB code input**: HtmlGuard remains active on all text fields. BB tags (`[b]`, etc.) are not HTML and pass through without issue.
- **BB code rendering**: `BbcodeRenderer` HTML-entity-encodes `<`, `>`, `&` in the raw string before parsing. No `dangerouslySetInnerHTML` used.
- **Image URLs**: validated server-side (content type + size at upload time). URL strings stored and returned as-is; `<img src>` rendering is safe because no script execution occurs from a URL in an `<img>` tag.
- **Links** (`[url]`): disabled by default. When enabled, rendered with `rel="noopener noreferrer"` and `target="_blank"`.

---

## Tests

### Backend (`Lovecraft.UnitTests`)

- `ImagesControllerTests`: valid upload accepted; invalid content type → 400 `INVALID_CONTENT_TYPE`; file > 10 MB → 400 `FILE_TOO_LARGE`
- `MockChatServiceTests`: `SendMessageAsync` with imageUrls stores and returns them in the DTO
- `MockForumServiceTests`: `CreateReplyAsync` with imageUrls stores and returns them in the DTO

### Frontend (Vitest + RTL)

- `bbcode-renderer.test.tsx`: each enabled tag renders the correct element; disabled tags render raw text; `<script>` in input is escaped; spoiler toggles on click
- `bbcode.config.test.ts`: default enabled/disabled state matches spec (snapshot)
- `imagesApi.test.ts`: mock mode returns placeholder URL; API mode sends correct FormData to correct endpoint

---

## Documentation Updates

- `docs/ISSUES.md`: MCF.11 marked resolved, changelog entry added
- `AGENTS.md`: "BB Code" section added explaining the config toggle pattern
- `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md`: image upload endpoint added
- `docs/API_INTEGRATION.md`: `imagesApi` usage example added

---

## Out of Scope

- Inline image embedding via `[img]` tag — images are always attachments below text
- BB code in forum topic titles — title fields stay plain text
- BB code in profile bios or other non-message fields
- Image upload from URL (paste-a-link) — file upload only
- Image deletion after send
