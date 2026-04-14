# Rich Text & Media Attachments (MCF.11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BB code text formatting (8 configurable tags) and photo attachments (up to 4 per message) to forum replies and private chat messages, with backend storage and a new image upload endpoint.

**Architecture:** BB codes stored as raw strings in the database; parsed client-side into React elements by `BbcodeRenderer`. Images uploaded via new `POST /api/v1/images/upload` endpoint (validates content type + size, resizes, stores in Azure Blob Storage `content-images` container). Image URLs stored as a JSON string on backend entities, returned as `List<string>` in DTOs. Frontend components (`BbcodeToolbar`, `ImageAttachmentPicker`, `ImageAttachmentDisplay`) are decoupled units wired into `TopicDetail.tsx` and `Friends.tsx`.

**Tech Stack:** .NET 10 + xUnit + Moq (backend), React 18 + TypeScript + Vitest + RTL (frontend), Azure Blob Storage + SixLabors.ImageSharp (image processing, already in use), Tailwind CSS + shadcn/ui

---

## File Map

**Create (backend — `D:\src\lovecraft\Lovecraft\`):**
- `Lovecraft.Common/DTOs/Images/ImageDtos.cs` — `UploadImageResponseDto`
- `Lovecraft.Backend/Controllers/V1/ImagesController.cs` — `POST /api/v1/images/upload`

**Modify (backend):**
- `Lovecraft.Common/DTOs/Chats/ChatDtos.cs` — `ImageUrls` on `MessageDto` + `SendMessageRequestDto`
- `Lovecraft.Common/DTOs/Forum/ForumDtos.cs` — `ImageUrls` on `ForumReplyDto` + `CreateReplyRequestDto`
- `Lovecraft.Backend/Services/IServices.cs` — add `UploadContentImageAsync`; update `SendMessageAsync` + `CreateReplyAsync` signatures
- `Lovecraft.Backend/Services/MockImageService.cs` — implement `UploadContentImageAsync`
- `Lovecraft.Backend/Services/Azure/AzureImageService.cs` — implement `UploadContentImageAsync`
- `Lovecraft.Backend/Storage/Entities/MessageEntity.cs` — add `ImageUrls` string property
- `Lovecraft.Backend/Storage/Entities/ForumReplyEntity.cs` — add `ImageUrls` string property
- `Lovecraft.Backend/Services/MockChatService.cs` — update `SendMessageAsync` signature + body
- `Lovecraft.Backend/Services/MockForumService.cs` — update `CreateReplyAsync` signature + body
- `Lovecraft.Backend/Services/Azure/AzureChatService.cs` — update `SendMessageAsync` + entity→DTO mapping
- `Lovecraft.Backend/Services/Azure/AzureForumService.cs` — update `CreateReplyAsync` + `ToReplyDto`
- `Lovecraft.Backend/Controllers/V1/ChatsController.cs` — pass `request.ImageUrls` to service
- `Lovecraft.Backend/Controllers/V1/ForumController.cs` — pass `request.ImageUrls` to service
- `Lovecraft.UnitTests/ImageTests.cs` — add `ImagesController` tests + `MockImageService.UploadContentImageAsync` test
- `Lovecraft.UnitTests/ChatTests.cs` — add imageUrls persistence test
- `Lovecraft.UnitTests/ForumTests.cs` — add imageUrls persistence test

**Create (frontend — `D:\src\aloevera-harmony-meet\`):**
- `src/config/bbcode.config.ts` — feature flags per tag
- `src/components/ui/bbcode-renderer.tsx` — parses BB code → React elements
- `src/components/ui/bbcode-toolbar.tsx` — floating toolbar on text selection
- `src/components/ui/image-attachment-picker.tsx` — file input + thumbnail previews
- `src/components/ui/image-attachment-display.tsx` — grid + lightbox
- `src/services/api/imagesApi.ts` — `uploadImage(file)`
- `src/__tests__/bbcode-renderer.test.tsx`
- `src/__tests__/bbcode.config.test.ts`
- `src/__tests__/imagesApi.test.ts`

**Modify (frontend):**
- `src/services/api/index.ts` — export `imagesApi`
- `src/types/chat.ts` — add `imageUrls?` to `Message`
- `src/data/mockForumData.ts` — add `imageUrls?` to `ForumReply`
- `src/services/api/forumsApi.ts` — update `createReply` + `mapReplyFromApi`
- `src/services/api/chatsApi.ts` — update `sendMessage`
- `src/components/forum/TopicDetail.tsx` — wire toolbar + picker + renderer
- `src/pages/Friends.tsx` — wire toolbar + picker + renderer

**Modify (docs):**
- `docs/ISSUES.md` — mark MCF.11 resolved
- `AGENTS.md` — add BB Code section
- `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md` — add image upload endpoint
- `docs/API_INTEGRATION.md` — add `imagesApi` example

---

## Task 1: Common DTO + entity updates (no tests — pure data classes)

**Files:**
- Create: `Lovecraft.Common/DTOs/Images/ImageDtos.cs`
- Modify: `Lovecraft.Common/DTOs/Chats/ChatDtos.cs`
- Modify: `Lovecraft.Common/DTOs/Forum/ForumDtos.cs`
- Modify: `Lovecraft.Backend/Storage/Entities/MessageEntity.cs`
- Modify: `Lovecraft.Backend/Storage/Entities/ForumReplyEntity.cs`

- [ ] **Step 1: Create `ImageDtos.cs`**

```csharp
namespace Lovecraft.Common.DTOs.Images;

public class UploadImageResponseDto
{
    public string Url { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Add `ImageUrls` to chat DTOs**

In `Lovecraft.Common/DTOs/Chats/ChatDtos.cs`, add the property to both `MessageDto` and `SendMessageRequestDto`:

```csharp
// Inside MessageDto:
public List<string> ImageUrls { get; set; } = new();

// Inside SendMessageRequestDto:
public List<string>? ImageUrls { get; set; }
```

- [ ] **Step 3: Add `ImageUrls` to forum DTOs**

In `Lovecraft.Common/DTOs/Forum/ForumDtos.cs`, add the property to both `ForumReplyDto` and `CreateReplyRequestDto`:

```csharp
// Inside ForumReplyDto:
public List<string> ImageUrls { get; set; } = new();

// Inside CreateReplyRequestDto:
public List<string>? ImageUrls { get; set; }
```

- [ ] **Step 4: Add `ImageUrls` to `MessageEntity`**

In `Lovecraft.Backend/Storage/Entities/MessageEntity.cs`, add:

```csharp
public string ImageUrls { get; set; } = "[]"; // stored as JSON array
```

- [ ] **Step 5: Add `ImageUrls` to `ForumReplyEntity`**

In `Lovecraft.Backend/Storage/Entities/ForumReplyEntity.cs`, add:

```csharp
public string ImageUrls { get; set; } = "[]"; // stored as JSON array
```

- [ ] **Step 6: Build to verify no compile errors**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add Lovecraft.Common/DTOs/Images/ImageDtos.cs \
        Lovecraft.Common/DTOs/Chats/ChatDtos.cs \
        Lovecraft.Common/DTOs/Forum/ForumDtos.cs \
        Lovecraft.Backend/Storage/Entities/MessageEntity.cs \
        Lovecraft.Backend/Storage/Entities/ForumReplyEntity.cs
git commit -m "feat(MCF.11): add ImageUrls to chat/forum DTOs and storage entities"
```

---

## Task 2: IImageService extension + MockImageService test + implementation

**Files:**
- Modify: `Lovecraft.Backend/Services/IServices.cs`
- Modify: `Lovecraft.Backend/Services/MockImageService.cs`
- Modify: `Lovecraft.UnitTests/ImageTests.cs`

- [ ] **Step 1: Write the failing test**

Add to `Lovecraft.UnitTests/ImageTests.cs` (inside the `ImageTests` class, after existing tests):

```csharp
[Fact]
public async Task MockImageService_UploadContentImageAsync_ReturnsPlaceholderUrl()
{
    var service = new MockImageService();
    var result = await service.UploadContentImageAsync("user1", Stream.Null, "image/jpeg");
    Assert.Equal("https://placehold.co/600x400", result);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet test Lovecraft.UnitTests --filter "MockImageService_UploadContentImageAsync_ReturnsPlaceholderUrl" -v
```

Expected: FAIL — method `UploadContentImageAsync` does not exist yet.

- [ ] **Step 3: Add method to `IImageService` interface**

In `Lovecraft.Backend/Services/IServices.cs`, inside the `IImageService` interface, add:

```csharp
Task<string> UploadContentImageAsync(string userId, Stream imageStream, string contentType);
```

- [ ] **Step 4: Implement in `MockImageService`**

In `Lovecraft.Backend/Services/MockImageService.cs`, add:

```csharp
public Task<string> UploadContentImageAsync(string userId, Stream imageStream, string contentType)
{
    return Task.FromResult("https://placehold.co/600x400");
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
dotnet test Lovecraft.UnitTests --filter "MockImageService_UploadContentImageAsync_ReturnsPlaceholderUrl" -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Lovecraft.Backend/Services/IServices.cs \
        Lovecraft.Backend/Services/MockImageService.cs \
        Lovecraft.UnitTests/ImageTests.cs
git commit -m "feat(MCF.11): add UploadContentImageAsync to IImageService and MockImageService"
```

---

## Task 3: AzureImageService.UploadContentImageAsync

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureImageService.cs`

(No unit tests — Azure integration; tested via mock in controller tests.)

- [ ] **Step 1: Add the method to `AzureImageService`**

Open `Lovecraft.Backend/Services/Azure/AzureImageService.cs`. Add the following method (using the same `using` statements already present for `ImageSharp`, `Azure.Storage.Blobs`, `BlobHttpHeaders`, etc.):

```csharp
public async Task<string> UploadContentImageAsync(string userId, Stream imageStream, string contentType)
{
    using var image = await Image.LoadAsync(imageStream);

    const int maxDimension = 1200;
    if (image.Width > maxDimension || image.Height > maxDimension)
    {
        var ratio = Math.Min((double)maxDimension / image.Width, (double)maxDimension / image.Height);
        image.Mutate(x => x.Resize((int)(image.Width * ratio), (int)(image.Height * ratio)));
    }

    using var output = new MemoryStream();
    await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 85 });
    output.Position = 0;

    var blobName = $"{userId}/{Guid.NewGuid()}.jpg";
    var containerClient = _blobServiceClient.GetBlobContainerClient("content-images");
    await containerClient.CreateIfNotExistsAsync(Azure.Storage.Blobs.Models.PublicAccessType.Blob);
    var blobClient = containerClient.GetBlobClient(blobName);
    await blobClient.UploadAsync(output, new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = "image/jpeg" });

    return blobClient.Uri.ToString();
}
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet build
```

Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add Lovecraft.Backend/Services/Azure/AzureImageService.cs
git commit -m "feat(MCF.11): implement UploadContentImageAsync in AzureImageService"
```

---

## Task 4: IChatService signature + MockChatService test + implementation

**Files:**
- Modify: `Lovecraft.Backend/Services/IServices.cs`
- Modify: `Lovecraft.Backend/Services/MockChatService.cs`
- Modify: `Lovecraft.UnitTests/ChatTests.cs`

- [ ] **Step 1: Write the failing test**

Add to `Lovecraft.UnitTests/ChatTests.cs` (inside the `ChatTests` class):

```csharp
[Fact]
public async Task SendMessageAsync_WithImageUrls_StoresAndReturnsThem()
{
    var svc = CreateService();
    var imageUrls = new List<string>
    {
        "https://example.com/img1.jpg",
        "https://example.com/img2.jpg"
    };
    var msg = await svc.SendMessageAsync("chat-1", "current-user", "See photos!", imageUrls);
    Assert.Equal(imageUrls, msg.ImageUrls);
    var history = await svc.GetMessagesAsync("chat-1", "current-user");
    var persisted = history.First(m => m.Id == msg.Id);
    Assert.Equal(imageUrls, persisted.ImageUrls);
}
```

Add the required using at the top of the file if not already present:
```csharp
using System.Collections.Generic;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet test Lovecraft.UnitTests --filter "SendMessageAsync_WithImageUrls_StoresAndReturnsThem" -v
```

Expected: FAIL — signature mismatch.

- [ ] **Step 3: Update `IChatService.SendMessageAsync` signature**

In `Lovecraft.Backend/Services/IServices.cs`, inside `IChatService`, change:

```csharp
// Before:
Task<MessageDto> SendMessageAsync(string chatId, string userId, string content);

// After:
Task<MessageDto> SendMessageAsync(string chatId, string userId, string content, List<string>? imageUrls = null);
```

- [ ] **Step 4: Update `MockChatService.SendMessageAsync`**

In `Lovecraft.Backend/Services/MockChatService.cs`, update the method signature and body. Wherever the `MessageDto` is constructed, add `ImageUrls`:

```csharp
// Change signature:
public async Task<MessageDto> SendMessageAsync(string chatId, string userId, string content, List<string>? imageUrls = null)

// In the MessageDto construction, add:
ImageUrls = imageUrls ?? new List<string>(),
```

- [ ] **Step 5: Run test to verify it passes**

```bash
dotnet test Lovecraft.UnitTests --filter "SendMessageAsync_WithImageUrls_StoresAndReturnsThem" -v
```

Expected: PASS.

- [ ] **Step 6: Run full test suite to check nothing broke**

```bash
dotnet test Lovecraft.UnitTests -v
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add Lovecraft.Backend/Services/IServices.cs \
        Lovecraft.Backend/Services/MockChatService.cs \
        Lovecraft.UnitTests/ChatTests.cs
git commit -m "feat(MCF.11): add imageUrls param to SendMessageAsync"
```

---

## Task 5: IForumService signature + MockForumService test + implementation

**Files:**
- Modify: `Lovecraft.Backend/Services/IServices.cs`
- Modify: `Lovecraft.Backend/Services/MockForumService.cs`
- Modify: `Lovecraft.UnitTests/ForumTests.cs`

- [ ] **Step 1: Write the failing test**

Add to `Lovecraft.UnitTests/ForumTests.cs` (inside the `ForumTests` class, after existing tests):

```csharp
[Fact]
public async Task CreateReplyAsync_WithImageUrls_StoresAndReturnsThem()
{
    var service = CreateService();
    var imageUrls = new List<string> { "https://example.com/photo.jpg" };

    var reply = await service.CreateReplyAsync(
        "t1", "user1", "TestUser",
        "Reply with a photo attached", imageUrls);

    Assert.Equal(imageUrls, reply.ImageUrls);
}
```

Add the required using at the top if not already present:
```csharp
using System.Collections.Generic;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet test Lovecraft.UnitTests --filter "CreateReplyAsync_WithImageUrls_StoresAndReturnsThem" -v
```

Expected: FAIL.

- [ ] **Step 3: Update `IForumService.CreateReplyAsync` signature**

In `Lovecraft.Backend/Services/IServices.cs`, inside `IForumService`, change:

```csharp
// Before:
Task<ForumReplyDto> CreateReplyAsync(string topicId, string authorId, string authorName, string content);

// After:
Task<ForumReplyDto> CreateReplyAsync(string topicId, string authorId, string authorName, string content, List<string>? imageUrls = null);
```

- [ ] **Step 4: Update `MockForumService.CreateReplyAsync`**

In `Lovecraft.Backend/Services/MockForumService.cs`, update the signature and add `ImageUrls` to the `ForumReplyDto` construction:

```csharp
// Change signature:
public async Task<ForumReplyDto> CreateReplyAsync(string topicId, string authorId, string authorName, string content, List<string>? imageUrls = null)

// In the ForumReplyDto construction, add:
ImageUrls = imageUrls ?? new List<string>(),
```

- [ ] **Step 5: Run test to verify it passes**

```bash
dotnet test Lovecraft.UnitTests --filter "CreateReplyAsync_WithImageUrls_StoresAndReturnsThem" -v
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
dotnet test Lovecraft.UnitTests -v
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add Lovecraft.Backend/Services/IServices.cs \
        Lovecraft.Backend/Services/MockForumService.cs \
        Lovecraft.UnitTests/ForumTests.cs
git commit -m "feat(MCF.11): add imageUrls param to CreateReplyAsync"
```

---

## Task 6: AzureChatService + AzureForumService imageUrls mapping

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureChatService.cs`
- Modify: `Lovecraft.Backend/Services/Azure/AzureForumService.cs`

- [ ] **Step 1: Update `AzureChatService.SendMessageAsync`**

In `AzureChatService.cs`, update the `SendMessageAsync` method signature:

```csharp
public async Task<MessageDto> SendMessageAsync(string chatId, string userId, string content, List<string>? imageUrls = null)
```

When constructing the `MessageEntity` for storage, add:
```csharp
ImageUrls = System.Text.Json.JsonSerializer.Serialize(imageUrls ?? new List<string>()),
```

When constructing the returned `MessageDto`, add:
```csharp
ImageUrls = imageUrls ?? new List<string>(),
```

- [ ] **Step 2: Update `AzureChatService` entity→DTO mapping**

Find wherever `MessageEntity` is mapped to `MessageDto` (typically in `GetMessagesAsync`). Add:

```csharp
ImageUrls = System.Text.Json.JsonSerializer.Deserialize<List<string>>(entity.ImageUrls ?? "[]") ?? new List<string>(),
```

- [ ] **Step 3: Update `AzureForumService.CreateReplyAsync`**

In `AzureForumService.cs`, update the signature:

```csharp
public async Task<ForumReplyDto> CreateReplyAsync(string topicId, string authorId, string authorName, string content, List<string>? imageUrls = null)
```

When constructing the `ForumReplyEntity`, add:
```csharp
ImageUrls = System.Text.Json.JsonSerializer.Serialize(imageUrls ?? new List<string>()),
```

- [ ] **Step 4: Update `AzureForumService.ToReplyDto`**

In the `ToReplyDto` helper, add:

```csharp
ImageUrls = System.Text.Json.JsonSerializer.Deserialize<List<string>>(entity.ImageUrls ?? "[]") ?? new List<string>(),
```

- [ ] **Step 5: Build**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet build
```

Expected: Build succeeded.

- [ ] **Step 6: Commit**

```bash
git add Lovecraft.Backend/Services/Azure/AzureChatService.cs \
        Lovecraft.Backend/Services/Azure/AzureForumService.cs
git commit -m "feat(MCF.11): persist and map ImageUrls in Azure chat/forum services"
```

---

## Task 7: ImagesController tests + implementation

**Files:**
- Modify: `Lovecraft.UnitTests/ImageTests.cs`
- Create: `Lovecraft.Backend/Controllers/V1/ImagesController.cs`

- [ ] **Step 1: Write the failing controller tests**

Add to `Lovecraft.UnitTests/ImageTests.cs`. First add the required usings at the top of the file (if not already present):

```csharp
using Lovecraft.Backend.Controllers.V1;
using Lovecraft.Common.DTOs.Images;
```

Then add these three test methods inside the `ImageTests` class:

```csharp
[Fact]
public async Task UploadContentImage_ValidJpeg_Returns200WithUrl()
{
    var mockImageService = new Mock<IImageService>();
    mockImageService
        .Setup(s => s.UploadContentImageAsync(
            It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>()))
        .ReturnsAsync("https://placehold.co/600x400");

    var controller = new ImagesController(
        mockImageService.Object,
        NullLogger<ImagesController>.Instance);
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext()
    };
    controller.HttpContext.User = new ClaimsPrincipal(
        new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, "user1") }, "test"));

    var mockFile = new Mock<IFormFile>();
    mockFile.Setup(f => f.ContentType).Returns("image/jpeg");
    mockFile.Setup(f => f.Length).Returns(1024);
    mockFile.Setup(f => f.OpenReadStream()).Returns(Stream.Null);

    var result = await controller.UploadContentImage(mockFile.Object);

    var ok = Assert.IsType<OkObjectResult>(result);
    var response = Assert.IsType<ApiResponse<UploadImageResponseDto>>(ok.Value);
    Assert.True(response.Success);
    Assert.Equal("https://placehold.co/600x400", response.Data?.Url);
}

[Fact]
public async Task UploadContentImage_InvalidContentType_Returns400WithCode()
{
    var mockImageService = new Mock<IImageService>();
    var controller = new ImagesController(
        mockImageService.Object,
        NullLogger<ImagesController>.Instance);
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext()
    };
    controller.HttpContext.User = new ClaimsPrincipal(
        new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, "user1") }, "test"));

    var mockFile = new Mock<IFormFile>();
    mockFile.Setup(f => f.ContentType).Returns("text/plain");
    mockFile.Setup(f => f.Length).Returns(1024);

    var result = await controller.UploadContentImage(mockFile.Object);

    var bad = Assert.IsType<BadRequestObjectResult>(result);
    var response = Assert.IsType<ApiResponse<UploadImageResponseDto>>(bad.Value);
    Assert.Equal("INVALID_CONTENT_TYPE", response.Error?.Code);
}

[Fact]
public async Task UploadContentImage_FileTooLarge_Returns400WithCode()
{
    var mockImageService = new Mock<IImageService>();
    var controller = new ImagesController(
        mockImageService.Object,
        NullLogger<ImagesController>.Instance);
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext()
    };
    controller.HttpContext.User = new ClaimsPrincipal(
        new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, "user1") }, "test"));

    var mockFile = new Mock<IFormFile>();
    mockFile.Setup(f => f.ContentType).Returns("image/png");
    mockFile.Setup(f => f.Length).Returns(11 * 1024 * 1024); // 11 MB > 10 MB limit

    var result = await controller.UploadContentImage(mockFile.Object);

    var bad = Assert.IsType<BadRequestObjectResult>(result);
    var response = Assert.IsType<ApiResponse<UploadImageResponseDto>>(bad.Value);
    Assert.Equal("FILE_TOO_LARGE", response.Error?.Code);
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet test Lovecraft.UnitTests --filter "UploadContentImage" -v
```

Expected: FAIL — `ImagesController` does not exist.

- [ ] **Step 3: Create `ImagesController.cs`**

```csharp
using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Lovecraft.Backend.Services;
using Lovecraft.Common.DTOs.Images;
using Lovecraft.Common.Models;

namespace Lovecraft.Backend.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/images")]
public class ImagesController : ControllerBase
{
    private readonly IImageService _imageService;
    private readonly ILogger<ImagesController> _logger;

    private static readonly HashSet<string> AllowedContentTypes = new()
    {
        "image/jpeg", "image/png", "image/gif", "image/webp"
    };

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "current-user";

    public ImagesController(IImageService imageService, ILogger<ImagesController> logger)
    {
        _imageService = imageService;
        _logger = logger;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(10 * 1024 * 1024 + 1024)]
    public async Task<IActionResult> UploadContentImage([FromForm] IFormFile file)
    {
        if (!AllowedContentTypes.Contains(file.ContentType))
            return BadRequest(ApiResponse<UploadImageResponseDto>.ErrorResponse(
                "INVALID_CONTENT_TYPE",
                "Only JPEG, PNG, GIF, and WebP images are allowed."));

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(ApiResponse<UploadImageResponseDto>.ErrorResponse(
                "FILE_TOO_LARGE",
                "Image must be 10 MB or less."));

        try
        {
            var url = await _imageService.UploadContentImageAsync(
                CurrentUserId, file.OpenReadStream(), file.ContentType);
            return Ok(ApiResponse<UploadImageResponseDto>.SuccessResponse(
                new UploadImageResponseDto { Url = url }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Content image upload failed for user {UserId}", CurrentUserId);
            return StatusCode(500, ApiResponse<UploadImageResponseDto>.ErrorResponse(
                "UPLOAD_FAILED", "Image upload failed. Please try again."));
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test Lovecraft.UnitTests --filter "UploadContentImage" -v
```

Expected: All 3 PASS.

- [ ] **Step 5: Run full test suite**

```bash
dotnet test Lovecraft.UnitTests -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add Lovecraft.Backend/Controllers/V1/ImagesController.cs \
        Lovecraft.UnitTests/ImageTests.cs
git commit -m "feat(MCF.11): add ImagesController with upload endpoint + controller tests"
```

---

## Task 8: Wire imageUrls through ChatsController and ForumController

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/ChatsController.cs`
- Modify: `Lovecraft.Backend/Controllers/V1/ForumController.cs`

- [ ] **Step 1: Update `ChatsController.SendMessage`**

In `ChatsController.cs`, find the `SendMessage` action. Change the service call from:

```csharp
var message = await _chatService.SendMessageAsync(id, CurrentUserId, request.Content);
```

To:

```csharp
var message = await _chatService.SendMessageAsync(id, CurrentUserId, request.Content, request.ImageUrls);
```

- [ ] **Step 2: Update `ForumController.CreateReply`**

In `ForumController.cs`, find the `CreateReply` action. Change the service call from:

```csharp
var reply = await _forumService.CreateReplyAsync(id, CurrentUserId, currentUserName, request.Content);
```

To:

```csharp
var reply = await _forumService.CreateReplyAsync(id, CurrentUserId, currentUserName, request.Content, request.ImageUrls);
```

(Adjust based on exact variable names you see in the file — the second argument is the current user's ID, third is their display name.)

- [ ] **Step 3: Build + run full test suite**

```bash
cd D:/src/lovecraft/Lovecraft
dotnet build && dotnet test Lovecraft.UnitTests -v
```

Expected: Build succeeded, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add Lovecraft.Backend/Controllers/V1/ChatsController.cs \
        Lovecraft.Backend/Controllers/V1/ForumController.cs
git commit -m "feat(MCF.11): pass imageUrls from request DTOs to chat and forum services"
```

---

## Task 9: `bbcode.config.ts` + snapshot test

**Files:**
- Create: `src/config/bbcode.config.ts`
- Create: `src/__tests__/bbcode.config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/bbcode.config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BBCODE_CONFIG } from '@/config/bbcode.config';

describe('BBCODE_CONFIG', () => {
  it('matches the expected default state (snapshot)', () => {
    expect(BBCODE_CONFIG).toMatchSnapshot();
  });

  it('has bold, italic, strikethrough, quote, spoiler enabled', () => {
    expect(BBCODE_CONFIG.bold).toBe(true);
    expect(BBCODE_CONFIG.italic).toBe(true);
    expect(BBCODE_CONFIG.strikethrough).toBe(true);
    expect(BBCODE_CONFIG.quote).toBe(true);
    expect(BBCODE_CONFIG.spoiler).toBe(true);
  });

  it('has underline, url, code disabled', () => {
    expect(BBCODE_CONFIG.underline).toBe(false);
    expect(BBCODE_CONFIG.url).toBe(false);
    expect(BBCODE_CONFIG.code).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/src/aloevera-harmony-meet
npx vitest run src/__tests__/bbcode.config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `bbcode.config.ts`**

```typescript
// src/config/bbcode.config.ts
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

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/bbcode.config.test.ts
```

Expected: PASS (snapshot created on first run).

- [ ] **Step 5: Commit**

```bash
git add src/config/bbcode.config.ts src/__tests__/bbcode.config.test.ts src/__tests__/__snapshots__/
git commit -m "feat(MCF.11): add BBCODE_CONFIG with per-tag feature flags"
```

---

## Task 10: `bbcode-renderer.tsx` + unit tests

**Files:**
- Create: `src/components/ui/bbcode-renderer.tsx`
- Create: `src/__tests__/bbcode-renderer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/bbcode-renderer.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';

// vi.mock is not needed — bbcode.config is a plain module with no side effects

describe('BbcodeRenderer — enabled tags', () => {
  it('renders [b] as <strong>', () => {
    const { container } = render(<BbcodeRenderer content="[b]hello[/b]" />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe('hello');
  });

  it('renders [i] as <em>', () => {
    const { container } = render(<BbcodeRenderer content="[i]world[/i]" />);
    expect(container.querySelector('em')).not.toBeNull();
  });

  it('renders [s] as <s>', () => {
    const { container } = render(<BbcodeRenderer content="[s]deleted[/s]" />);
    expect(container.querySelector('s')).not.toBeNull();
  });

  it('renders [quote] as <blockquote>', () => {
    const { container } = render(<BbcodeRenderer content="[quote]cited[/quote]" />);
    expect(container.querySelector('blockquote')).not.toBeNull();
  });

  it('renders [spoiler] as hidden span revealed on click', () => {
    const { container } = render(<BbcodeRenderer content="[spoiler]secret[/spoiler]" />);
    const span = container.querySelector('[data-spoiler]') as HTMLElement;
    expect(span).not.toBeNull();
    expect(span.getAttribute('data-revealed')).toBe('false');
    fireEvent.click(span);
    expect(span.getAttribute('data-revealed')).toBe('true');
  });
});

describe('BbcodeRenderer — disabled tags', () => {
  it('renders [u] as plain text (not <u>)', () => {
    const { container } = render(<BbcodeRenderer content="[u]underline[/u]" />);
    expect(container.querySelector('u')).toBeNull();
    expect(container.textContent).toContain('[u]underline[/u]');
  });

  it('renders [code] as plain text', () => {
    const { container } = render(<BbcodeRenderer content="[code]snippet[/code]" />);
    expect(container.querySelector('code')).toBeNull();
    expect(container.textContent).toContain('[code]snippet[/code]');
  });

  it('renders [url=...] as plain text', () => {
    const { container } = render(<BbcodeRenderer content="[url=https://example.com]click[/url]" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('[url=https://example.com]click[/url]');
  });
});

describe('BbcodeRenderer — XSS safety', () => {
  it('does not inject <script> tags', () => {
    const { container } = render(
      <BbcodeRenderer content="<script>alert(1)</script>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('does not execute HTML inside a BB tag', () => {
    const { container } = render(
      <BbcodeRenderer content="[b]<img onerror='alert(1)' src=x>[/b]" />
    );
    // img element should NOT be in the DOM — it should be text
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/src/aloevera-harmony-meet
npx vitest run src/__tests__/bbcode-renderer.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `bbcode-renderer.tsx`**

```typescript
// src/components/ui/bbcode-renderer.tsx
import React, { useState } from 'react';
import { BBCODE_CONFIG, BbcodeTag } from '@/config/bbcode.config';

// ── Tokenizer ──────────────────────────────────────────────────────────────

type Token =
  | { type: 'text'; value: string }
  | { type: 'open'; tag: string; attr?: string }
  | { type: 'close'; tag: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\[(\/?[a-z]+)(?:=([^\]]{0,200}))?\]/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: input.slice(last, match.index) });
    }
    const raw = match[1];
    if (raw.startsWith('/')) {
      tokens.push({ type: 'close', tag: raw.slice(1).toLowerCase() });
    } else {
      tokens.push({ type: 'open', tag: raw.toLowerCase(), attr: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    tokens.push({ type: 'text', value: input.slice(last) });
  }
  return tokens;
}

// ── Spoiler component (needs useState) ───────────────────────────────────

function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      data-spoiler
      data-revealed={String(revealed)}
      onClick={() => setRevealed(r => !r)}
      style={{
        background: revealed ? 'transparent' : 'currentColor',
        color: revealed ? 'inherit' : 'transparent',
        borderRadius: '3px',
        cursor: 'pointer',
        userSelect: 'none',
        padding: '0 2px',
      }}
    >
      {children}
    </span>
  );
}

// ── Tag → config key mapping ──────────────────────────────────────────────

const TAG_CONFIG_KEY: Record<string, BbcodeTag> = {
  b:       'bold',
  i:       'italic',
  u:       'underline',
  s:       'strikethrough',
  url:     'url',
  quote:   'quote',
  code:    'code',
  spoiler: 'spoiler',
};

// ── Tag wrappers ──────────────────────────────────────────────────────────

type Wrapper = (children: React.ReactNode, attr?: string) => React.ReactNode;

const TAG_WRAPPERS: Record<string, Wrapper> = {
  b:       ch => <strong>{ch}</strong>,
  i:       ch => <em>{ch}</em>,
  u:       ch => <u>{ch}</u>,
  s:       ch => <s>{ch}</s>,
  quote:   ch => (
    <blockquote className="border-l-4 border-orange-500 pl-3 text-muted-foreground italic my-2">
      {ch}
    </blockquote>
  ),
  code:    ch => (
    <code className="font-mono bg-muted px-1 py-0.5 rounded text-sm block my-1 p-2 whitespace-pre-wrap">
      {ch}
    </code>
  ),
  spoiler: ch => <SpoilerSpan>{ch}</SpoilerSpan>,
  url:     (ch, attr) =>
    attr ? (
      <a href={attr} rel="noopener noreferrer" target="_blank" className="text-blue-400 underline">
        {ch}
      </a>
    ) : <>{ch}</>,
};

// ── Recursive renderer ────────────────────────────────────────────────────

function renderTokens(
  tokens: Token[],
  pos: number,
  stopTag?: string
): [React.ReactNode[], number] {
  const nodes: React.ReactNode[] = [];
  let i = pos;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'close') {
      if (stopTag && token.tag === stopTag) {
        return [nodes, i + 1]; // consumed the closing tag
      }
      // Unmatched close — emit as literal text
      nodes.push(`[/${token.tag}]`);
      i++;
      continue;
    }

    if (token.type === 'open') {
      const configKey = TAG_CONFIG_KEY[token.tag];
      const enabled = configKey !== undefined && BBCODE_CONFIG[configKey];

      if (enabled && TAG_WRAPPERS[token.tag]) {
        const [children, nextPos] = renderTokens(tokens, i + 1, token.tag);
        nodes.push(TAG_WRAPPERS[token.tag](children, token.attr));
        i = nextPos;
      } else {
        // Disabled/unknown — emit as plain text, still recurse to consume the close tag
        const openText = token.attr
          ? `[${token.tag}=${token.attr}]`
          : `[${token.tag}]`;
        const [innerNodes, nextPos] = renderTokens(tokens, i + 1, token.tag);
        nodes.push(openText);
        nodes.push(...innerNodes);
        nodes.push(`[/${token.tag}]`);
        i = nextPos;
      }
      continue;
    }

    // text token — React renders strings as text nodes (XSS-safe, no dangerouslySetInnerHTML)
    nodes.push(token.value);
    i++;
  }

  return [nodes, i];
}

// ── Public component ──────────────────────────────────────────────────────

interface BbcodeRendererProps {
  content: string;
  className?: string;
}

export function BbcodeRenderer({ content, className }: BbcodeRendererProps) {
  const tokens = tokenize(content);
  const [nodes] = renderTokens(tokens, 0);
  return (
    <span className={className}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>{node}</React.Fragment>
      ))}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/bbcode-renderer.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/bbcode-renderer.tsx src/__tests__/bbcode-renderer.test.tsx
git commit -m "feat(MCF.11): add BbcodeRenderer with tokenizer, XSS-safe rendering, spoiler toggle"
```

---

## Task 11: `bbcode-toolbar.tsx`

**Files:**
- Create: `src/components/ui/bbcode-toolbar.tsx`

(No automated unit tests — requires real textarea DOM interaction; behavior verified in Task 17/18 via manual testing.)

- [ ] **Step 1: Create `bbcode-toolbar.tsx`**

```typescript
// src/components/ui/bbcode-toolbar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { BBCODE_CONFIG, BbcodeTag } from '@/config/bbcode.config';

interface BbcodeToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface Position {
  visible: boolean;
  top: number;
  left: number;
}

interface ButtonDef {
  tag: string;
  configKey: BbcodeTag;
  label: string;
  style?: React.CSSProperties;
}

const BUTTONS: ButtonDef[] = [
  { tag: 'b',       configKey: 'bold',          label: 'B',   style: { fontWeight: 'bold' } },
  { tag: 'i',       configKey: 'italic',        label: 'I',   style: { fontStyle: 'italic' } },
  { tag: 's',       configKey: 'strikethrough', label: 'S',   style: { textDecoration: 'line-through' } },
  { tag: 'u',       configKey: 'underline',     label: 'U',   style: { textDecoration: 'underline' } },
  { tag: 'quote',   configKey: 'quote',         label: '❝' },
  { tag: 'spoiler', configKey: 'spoiler',       label: '👁' },
  { tag: 'code',    configKey: 'code',          label: '</>' },
  { tag: 'url',     configKey: 'url',           label: '🔗' },
];

export function BbcodeToolbar({ textareaRef }: BbcodeToolbarProps) {
  const [pos, setPos] = useState<Position>({ visible: false, top: 0, left: 0 });

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    function checkSelection() {
      const el = textareaRef.current;
      if (!el) return;
      if (el.selectionStart === el.selectionEnd) {
        setPos(p => ({ ...p, visible: false }));
        return;
      }
      const rect = el.getBoundingClientRect();
      setPos({ visible: true, top: rect.top - 44, left: rect.left });
    }

    ta.addEventListener('mouseup', checkSelection);
    ta.addEventListener('keyup', checkSelection);
    return () => {
      ta.removeEventListener('mouseup', checkSelection);
      ta.removeEventListener('keyup', checkSelection);
    };
  }, [textareaRef]);

  function wrapSelection(tag: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    if (start === end) return;
    const selected = value.slice(start, end);
    const wrapped = `[${tag}]${selected}[/${tag}]`;
    const next = value.slice(0, start) + wrapped + value.slice(end);

    // Trigger React's synthetic onChange via native value setter
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    setter?.call(ta, next);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.setSelectionRange(start, start + wrapped.length);
    setPos(p => ({ ...p, visible: false }));
  }

  const enabledButtons = BUTTONS.filter(b => BBCODE_CONFIG[b.configKey]);

  if (!pos.visible || enabledButtons.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
        display: 'flex',
        gap: '2px',
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        padding: '3px 6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {enabledButtons.map(b => (
        <button
          key={b.tag}
          type="button"
          title={b.configKey}
          style={b.style}
          onMouseDown={e => e.preventDefault()} // prevent textarea blur
          onClick={() => wrapSelection(b.tag)}
          className="px-2 py-0.5 text-sm rounded hover:bg-muted transition-colors text-foreground"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/bbcode-toolbar.tsx
git commit -m "feat(MCF.11): add BbcodeToolbar — floating selection popup with BB tag buttons"
```

---

## Task 12: `image-attachment-picker.tsx`

**Files:**
- Create: `src/components/ui/image-attachment-picker.tsx`

- [ ] **Step 1: Create `image-attachment-picker.tsx`**

```typescript
// src/components/ui/image-attachment-picker.tsx
import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Camera, X } from 'lucide-react';

const MAX_FILES = 4;

interface ImageAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function ImageAttachmentPicker({ files, onChange }: ImageAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const combined = [...files, ...incoming];
    if (combined.length > MAX_FILES) {
      toast.error(`Максимум ${MAX_FILES} фото на сообщение`);
      onChange(combined.slice(0, MAX_FILES));
      return;
    }
    onChange(combined);
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {files.map((file, i) => (
        <div key={i} className="relative w-14 h-14 flex-shrink-0">
          <img
            src={URL.createObjectURL(file)}
            alt={`фото ${i + 1}`}
            className="w-full h-full object-cover rounded border border-border"
          />
          <button
            type="button"
            onClick={() => removeFile(i)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs leading-none"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}

      {files.length < MAX_FILES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded border border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Прикрепить фото"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          handleFiles(e.target.files);
          // Reset so the same file can be picked again
          e.target.value = '';
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/image-attachment-picker.tsx
git commit -m "feat(MCF.11): add ImageAttachmentPicker — file input with previews, max 4"
```

---

## Task 13: `image-attachment-display.tsx`

**Files:**
- Create: `src/components/ui/image-attachment-display.tsx`

- [ ] **Step 1: Create `image-attachment-display.tsx`**

```typescript
// src/components/ui/image-attachment-display.tsx
import React, { useState } from 'react';

interface ImageAttachmentDisplayProps {
  imageUrls: string[];
}

export function ImageAttachmentDisplay({ imageUrls }: ImageAttachmentDisplayProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!imageUrls || imageUrls.length === 0) return null;

  // 1 image → full width; 2+ → 2-column grid
  const gridCols = imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <>
      <div className={`grid ${gridCols} gap-1 mt-2 max-w-xs rounded overflow-hidden`}>
        {imageUrls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`вложение ${i + 1}`}
            className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightbox(url)}
          />
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="полный размер"
            className="max-w-full max-h-full object-contain rounded shadow-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/image-attachment-display.tsx
git commit -m "feat(MCF.11): add ImageAttachmentDisplay — grid view with click-to-lightbox"
```

---

## Task 14: `imagesApi.ts` + tests + index export

**Files:**
- Create: `src/services/api/imagesApi.ts`
- Create: `src/__tests__/imagesApi.test.ts`
- Modify: `src/services/api/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/imagesApi.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

import { uploadImage } from '@/services/api/imagesApi';

describe('imagesApi — mock mode', () => {
  it('returns a placeholder URL without an HTTP call', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file);
    expect(result.url).toBe('https://placehold.co/600x400');
  });

  it('resolves with an object that has a url string', async () => {
    const file = new File(['img'], 'photo.png', { type: 'image/png' });
    const result = await uploadImage(file);
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/src/aloevera-harmony-meet
npx vitest run src/__tests__/imagesApi.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `imagesApi.ts`**

```typescript
// src/services/api/imagesApi.ts
import { apiClient, isApiMode } from './apiClient';

interface UploadImageResponse {
  url: string;
}

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  if (!isApiMode()) {
    // Simulate network delay in mock mode
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    return { url: 'https://placehold.co/600x400' };
  }

  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.postForm<{ Url: string }>('/api/v1/images/upload', formData);
  return { url: res.data!.Url };
}

export const imagesApi = { uploadImage };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/imagesApi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add export to `src/services/api/index.ts`**

```typescript
export { imagesApi, uploadImage } from './imagesApi';
```

Add this line after the `matchingApi` export line.

- [ ] **Step 6: Commit**

```bash
git add src/services/api/imagesApi.ts src/__tests__/imagesApi.test.ts src/services/api/index.ts
git commit -m "feat(MCF.11): add imagesApi with uploadImage (mock + API mode)"
```

---

## Task 15: Frontend type and service updates

**Files:**
- Modify: `src/types/chat.ts`
- Modify: `src/data/mockForumData.ts`
- Modify: `src/services/api/forumsApi.ts`
- Modify: `src/services/api/chatsApi.ts`

- [ ] **Step 1: Add `imageUrls` to `Message` type**

In `src/types/chat.ts`, find the `Message` interface and add:

```typescript
imageUrls?: string[];
```

- [ ] **Step 2: Add `imageUrls` to `ForumReply` in mock data**

In `src/data/mockForumData.ts`, find the `ForumReply` interface and add:

```typescript
imageUrls?: string[];
```

- [ ] **Step 3: Update `forumsApi.createReply`**

In `src/services/api/forumsApi.ts`:

a. Update the `createReply` signature:
```typescript
// Before:
createReply: async (topicId: string, content: string): Promise<ApiResponse<ForumReply>>

// After:
createReply: async (topicId: string, content: string, imageUrls?: string[]): Promise<ApiResponse<ForumReply>>
```

b. In mock mode, add `imageUrls: imageUrls ?? []` to the returned mock reply object.

c. In API mode, include `imageUrls: imageUrls ?? []` in the request body:
```typescript
const response = await apiClient.post<ForumReplyDto>(`/api/v1/forum/topics/${topicId}/replies`, {
  content,
  imageUrls: imageUrls ?? [],
});
```

d. In `mapReplyFromApi` (the function that converts a DTO to `ForumReply`), add:
```typescript
imageUrls: dto.imageUrls ?? [],
```

- [ ] **Step 4: Update `chatsApi.sendMessage`**

In `src/services/api/chatsApi.ts`:

a. Update the `sendMessage` signature:
```typescript
// Before:
sendMessage: async (chatId: string, content: string): Promise<ApiResponse<MessageDto>>

// After:
sendMessage: async (chatId: string, content: string, imageUrls?: string[]): Promise<ApiResponse<MessageDto>>
```

b. In mock mode, add `imageUrls: imageUrls ?? []` to the returned mock message object.

c. In API mode, include `imageUrls: imageUrls ?? []` in the request body:
```typescript
const response = await apiClient.post<MessageDto>(`/api/v1/chats/${chatId}/messages`, {
  content,
  imageUrls: imageUrls ?? [],
});
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd D:/src/aloevera-harmony-meet
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Run existing tests to verify nothing broke**

```bash
npx vitest run
```

Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/types/chat.ts src/data/mockForumData.ts \
        src/services/api/forumsApi.ts src/services/api/chatsApi.ts
git commit -m "feat(MCF.11): add imageUrls to Message/ForumReply types and API services"
```

---

## Task 16: Wire `TopicDetail.tsx` — BB toolbar + image picker + renderer

**Files:**
- Modify: `src/components/forum/TopicDetail.tsx`

Read this file before editing — it's long and has specific RHF and submit logic to preserve.

- [ ] **Step 1: Add imports**

At the top of `TopicDetail.tsx`, add:

```typescript
import { useRef, useState } from 'react';
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';
import { BbcodeToolbar } from '@/components/ui/bbcode-toolbar';
import { ImageAttachmentPicker } from '@/components/ui/image-attachment-picker';
import { ImageAttachmentDisplay } from '@/components/ui/image-attachment-display';
import { uploadImage } from '@/services/api/imagesApi';
```

- [ ] **Step 2: Add state for image files**

Inside the component body, after existing state declarations:

```typescript
const contentRef = useRef<HTMLTextAreaElement | null>(null);
const [imageFiles, setImageFiles] = useState<File[]>([]);
```

- [ ] **Step 3: Wire the ref into the RHF Textarea**

React Hook Form's `register()` returns its own ref. Share it with `contentRef` using a dual-ref callback.

Find the `replyForm.register('content')` call. Change it to:

```typescript
const { ref: registerRef, ...registerRest } = replyForm.register('content');
```

Then on the `<Textarea>` element, change `{...replyForm.register('content')}` to:

```typescript
{...registerRest}
ref={(el) => {
  registerRef(el);
  contentRef.current = el;
}}
```

- [ ] **Step 4: Add `BbcodeToolbar` next to the Textarea**

Wrap the `<Textarea>` in a `relative` container and place `<BbcodeToolbar>` before it:

```tsx
<div className="relative">
  <BbcodeToolbar textareaRef={contentRef} />
  <Textarea
    {...registerRest}
    ref={(el) => { registerRef(el); contentRef.current = el; }}
    placeholder="Написать ответ..."
    className="min-h-[100px]"
  />
</div>
```

- [ ] **Step 5: Add `ImageAttachmentPicker` below the Textarea**

Below the Textarea (but still inside the form or reply section):

```tsx
<ImageAttachmentPicker files={imageFiles} onChange={setImageFiles} />
```

- [ ] **Step 6: Upload images on submit**

Find the form submit handler (e.g., `handleReplySubmit` or `onSubmit`). Before calling `forumsApi.createReply`, add the upload step:

```typescript
// Upload all selected files, collect URLs
const imageUrls: string[] = [];
for (const file of imageFiles) {
  const res = await uploadImage(file);
  imageUrls.push(res.url);
}

// Then pass to createReply:
await forumsApi.createReply(topicId, data.content, imageUrls);

// Clear image files after successful submit
setImageFiles([]);
```

Wrap in try/catch and show `toast.error` on failure (consistent with existing error handling in this component).

- [ ] **Step 7: Replace plain `<p>` with `<BbcodeRenderer>` for reply content**

Find where reply content is rendered (likely `<p>{reply.content}</p>`). Replace with:

```tsx
<BbcodeRenderer content={reply.content} />
```

Also render images below each reply:

```tsx
<ImageAttachmentDisplay imageUrls={reply.imageUrls ?? []} />
```

- [ ] **Step 8: Replace plain content for original post**

If the topic's own content (`topic.content`) is rendered as plain text, also wrap it:

```tsx
<BbcodeRenderer content={topic.content} />
```

- [ ] **Step 9: Verify TypeScript compilation + run tests**

```bash
cd D:/src/aloevera-harmony-meet
npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/forum/TopicDetail.tsx
git commit -m "feat(MCF.11): wire BB toolbar, image picker, and renderer into TopicDetail"
```

---

## Task 17: Wire `Friends.tsx` — BB toolbar + image picker + renderer

**Files:**
- Modify: `src/pages/Friends.tsx`

Read this file before editing — the chat input currently uses `<Input>` with `messageText` local state.

- [ ] **Step 1: Add imports**

```typescript
import { useRef, useState } from 'react'; // if not already imported
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';
import { BbcodeToolbar } from '@/components/ui/bbcode-toolbar';
import { ImageAttachmentPicker } from '@/components/ui/image-attachment-picker';
import { ImageAttachmentDisplay } from '@/components/ui/image-attachment-display';
import { uploadImage } from '@/services/api/imagesApi';
```

- [ ] **Step 2: Replace `<Input>` with `<textarea>` + add image state**

Find the chat input area. Replace the `<Input>` element and add the companion state/ref:

```typescript
const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
const [imageFiles, setImageFiles] = useState<File[]>([]);
```

Replace the `<Input>` with:

```tsx
<div className="relative flex-1">
  <BbcodeToolbar textareaRef={chatInputRef} />
  <textarea
    ref={chatInputRef}
    value={messageText}
    onChange={e => setMessageText(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    }}
    placeholder="Написать сообщение..."
    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
    rows={1}
  />
</div>
```

- [ ] **Step 3: Add `ImageAttachmentPicker` to the send row**

In the row that contains the send button, add the picker before the send button:

```tsx
<ImageAttachmentPicker files={imageFiles} onChange={setImageFiles} />
```

- [ ] **Step 4: Upload images on send**

Find `handleSendMessage` (or equivalent). Before calling `chatsApi.sendMessage`, add:

```typescript
const imageUrls: string[] = [];
for (const file of imageFiles) {
  const res = await uploadImage(file);
  imageUrls.push(res.url);
}

await chatsApi.sendMessage(activeChatId, messageText.trim(), imageUrls);
setImageFiles([]);
```

- [ ] **Step 5: Render messages with `BbcodeRenderer` + `ImageAttachmentDisplay`**

Find where `msg.content` is rendered (likely `<p>{msg.content}</p>` or similar). Replace with:

```tsx
<BbcodeRenderer content={msg.content} />
<ImageAttachmentDisplay imageUrls={msg.imageUrls ?? []} />
```

- [ ] **Step 6: TypeScript + tests**

```bash
cd D:/src/aloevera-harmony-meet
npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat(MCF.11): wire BB toolbar, image picker, and renderer into Friends chat"
```

---

## Task 18: Documentation updates

**Files:**
- Modify: `docs/ISSUES.md`
- Modify: `AGENTS.md`
- Modify: `D:\src\lovecraft\Lovecraft\docs\IMPLEMENTATION_SUMMARY.md`
- Modify: `docs/API_INTEGRATION.md`

- [ ] **Step 1: Mark MCF.11 resolved in `docs/ISSUES.md`**

Find the MCF.11 entry. Change its status to `[x]` (resolved) and add a changelog entry:

```markdown
- **MCF.11** (2026-04-13): BB code formatting + photo attachments added to forum replies and private chat. New endpoint `POST /api/v1/images/upload`. Config: `src/config/bbcode.config.ts`.
```

- [ ] **Step 2: Add BB Code section to `AGENTS.md`**

Add a new section (after the existing component conventions):

```markdown
## BB Code

BB code formatting is controlled per-tag via `src/config/bbcode.config.ts`. To enable or disable a tag, change the boolean value — no other code changes needed.

- **Renderer**: `src/components/ui/bbcode-renderer.tsx` — parses raw BB code strings into React elements. Disabled tags render as literal `[tag]...[/tag]` text. XSS-safe: uses React text nodes, no `dangerouslySetInnerHTML`.
- **Toolbar**: `src/components/ui/bbcode-toolbar.tsx` — floating popup on text selection. Requires a `ref` to the target `<textarea>`.
- **Image picker**: `src/components/ui/image-attachment-picker.tsx` — max 4 files, holds `File[]` in state; parent uploads at send time.
- **Image display**: `src/components/ui/image-attachment-display.tsx` — 1→full-width, 2+→2-col grid, click-to-lightbox.
```

- [ ] **Step 3: Add image upload endpoint to backend `IMPLEMENTATION_SUMMARY.md`**

Add under the endpoints section:

```markdown
### Image Upload
- `POST /api/v1/images/upload` — multipart/form-data; validates content-type (JPEG/PNG/GIF/WebP) and size (≤10 MB); resizes to 1200px max, JPEG 85%; uploads to `content-images` Azure Blob container; returns `{ Url: string }`.
```

- [ ] **Step 4: Add `imagesApi` example to `docs/API_INTEGRATION.md`**

```markdown
### Image Upload

```typescript
import { uploadImage } from '@/services/api/imagesApi';

// Upload a single File object; returns { url: string }
const { url } = await uploadImage(file);
```

In mock mode (VITE_API_MODE=mock), returns `https://placehold.co/600x400` after a 300ms delay. In API mode, calls `POST /api/v1/images/upload`.
```

- [ ] **Step 5: Commit**

```bash
# Frontend docs
git -C D:/src/aloevera-harmony-meet add docs/ISSUES.md AGENTS.md docs/API_INTEGRATION.md
git -C D:/src/aloevera-harmony-meet commit -m "docs(MCF.11): mark resolved, add BB Code section and imagesApi example"

# Backend docs
git -C D:/src/lovecraft add Lovecraft/docs/IMPLEMENTATION_SUMMARY.md
git -C D:/src/lovecraft commit -m "docs(MCF.11): document image upload endpoint"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| 8 BB code tags, per-tag config flags | Task 9 (bbcode.config.ts) |
| Bold, italic, strikethrough, quote, spoiler enabled | Task 9 |
| Underline, link, code disabled | Task 9 |
| Disabled tags render as literal `[tag]` text | Task 10 (renderer) |
| Floating toolbar on text selection | Task 11 |
| Photo attachments, max 4 per message | Task 12 (picker) |
| Grid display below message | Task 13 (display) |
| Click-to-lightbox | Task 13 |
| `POST /api/v1/images/upload` endpoint | Task 7 |
| Content type + size validation | Task 7 |
| `INVALID_CONTENT_TYPE`, `FILE_TOO_LARGE` error codes | Task 7 |
| Azure Blob `content-images` container | Task 3 |
| MockImageService returns placeholder | Task 2 |
| `ImageUrls` on `MessageDto`, `SendMessageRequestDto` | Task 1 |
| `ImageUrls` on `ForumReplyDto`, `CreateReplyRequestDto` | Task 1 |
| `ImageUrls` stored as JSON on entities | Task 1 |
| Forum reply rendering with renderer + display | Task 16 |
| Chat message rendering with renderer + display | Task 17 |
| HtmlGuard unchanged | HtmlGuard is not modified (BB codes have no `<>`) |
| Backend unit tests for controller | Task 7 |
| Backend unit tests for services | Tasks 2, 4, 5 |
| Frontend tests for renderer | Task 10 |
| Frontend tests for config | Task 9 |
| Frontend tests for imagesApi | Task 14 |
| Documentation updates | Task 18 |

No gaps found.
