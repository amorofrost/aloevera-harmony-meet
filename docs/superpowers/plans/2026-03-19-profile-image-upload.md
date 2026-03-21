# Profile Image Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload a profile photo from the Settings page — stored in Azure Blob Storage after server-side resize, with a deferred preview/save UI.

**Architecture:** New `IImageService` dual-mode service (Mock / Azure) registered alongside existing services; new `POST /api/v1/users/{id}/images` endpoint in `UsersController`; new `postForm` helper in `apiClient.ts`; clickable-avatar upload zone replaces the existing camera button in `SettingsPage.tsx`.

**Tech Stack:** SixLabors.ImageSharp (server-side resize), Azure.Storage.Blobs (`BlobServiceClient`), React `useState`/`useRef`, `FileReader` API.

---

## File Map

### Backend (`D:\src\lovecraft\Lovecraft\`)

| Action | File |
|---|---|
| Modify | `Lovecraft.Backend/Lovecraft.Backend.csproj` |
| Modify | `Lovecraft.Backend/Services/IServices.cs` |
| Create | `Lovecraft.Backend/Services/MockImageService.cs` |
| Create | `Lovecraft.Backend/Services/Azure/AzureImageService.cs` |
| Modify | `Lovecraft.Backend/Controllers/V1/UsersController.cs` |
| Modify | `Lovecraft.Backend/Program.cs` |
| Create | `Lovecraft.UnitTests/ImageTests.cs` |

### Frontend (`D:\src\aloevera-harmony-meet\`)

| Action | File |
|---|---|
| Modify | `src/services/api/apiClient.ts` |
| Modify | `src/services/api/usersApi.ts` |
| Modify | `src/pages/SettingsPage.tsx` |

---

## Task 1: Add NuGet Packages

**Files:**
- Modify: `Lovecraft.Backend/Lovecraft.Backend.csproj`

- [ ] **Step 1: Add the two packages**

```bash
cd D:\src\lovecraft\Lovecraft\Lovecraft.Backend
dotnet add package SixLabors.ImageSharp
dotnet add package Azure.Storage.Blobs
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add Lovecraft.Backend/Lovecraft.Backend.csproj
git commit -m "chore: add SixLabors.ImageSharp and Azure.Storage.Blobs NuGet packages"
```

---

## Task 2: IImageService Interface + MockImageService + Unit Test

**Files:**
- Modify: `Lovecraft.Backend/Services/IServices.cs`
- Create: `Lovecraft.Backend/Services/MockImageService.cs`
- Create: `Lovecraft.UnitTests/ImageTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Lovecraft.UnitTests/ImageTests.cs`:

```csharp
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;

namespace Lovecraft.UnitTests;

[Collection("ImageTests")]
public class ImageTests
{
    [Fact]
    public async Task MockImageService_UploadProfileImageAsync_ReturnsNonNullUrl()
    {
        var service = new MockImageService();
        var userId = MockDataStore.Users[0].Id;

        var result = await service.UploadProfileImageAsync(userId, Stream.Null, "image/jpeg");

        Assert.NotNull(result);
        Assert.NotEmpty(result);
        Assert.Equal(MockDataStore.Users[0].ProfileImage, result);
    }
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --filter "FullyQualifiedName~ImageTests" -v normal
```

Expected: FAIL — `MockImageService` not found.

- [ ] **Step 3: Add IImageService to IServices.cs**

In `Lovecraft.Backend/Services/IServices.cs`, append after the last interface:

```csharp
public interface IImageService
{
    Task<string> UploadProfileImageAsync(string userId, Stream imageStream, string contentType);
}
```

- [ ] **Step 4: Create MockImageService.cs**

Create `Lovecraft.Backend/Services/MockImageService.cs`:

```csharp
using Lovecraft.Backend.MockData;

namespace Lovecraft.Backend.Services;

public class MockImageService : IImageService
{
    public Task<string> UploadProfileImageAsync(string userId, Stream imageStream, string contentType)
    {
        var user = MockDataStore.Users.FirstOrDefault(u => u.Id == userId);
        return Task.FromResult(user?.ProfileImage ?? string.Empty);
    }
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --filter "FullyQualifiedName~ImageTests" -v normal
```

Expected: PASS — 1 test.

- [ ] **Step 6: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add Lovecraft.Backend/Services/IServices.cs Lovecraft.Backend/Services/MockImageService.cs Lovecraft.UnitTests/ImageTests.cs
git commit -m "feat: add IImageService interface and MockImageService with unit test"
```

---

## Task 3: AzureImageService

**Files:**
- Create: `Lovecraft.Backend/Services/Azure/AzureImageService.cs`

No new unit tests for `AzureImageService` — it requires live Azure resources and is covered by integration testing.

- [ ] **Step 1: Create AzureImageService.cs**

Create `Lovecraft.Backend/Services/Azure/AzureImageService.cs`:

```csharp
using Azure;
using Azure.Data.Tables;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Lovecraft.Backend.Storage;
using Lovecraft.Backend.Storage.Entities;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Lovecraft.Backend.Services.Azure;

public class AzureImageService : IImageService
{
    private const int MaxDimension = 800;
    private const int JpegQuality = 85;
    private const string ContainerName = "profile-images";

    private readonly BlobContainerClient _containerClient;
    private readonly TableClient _usersTable;
    private readonly ILogger<AzureImageService> _logger;

    public AzureImageService(
        BlobServiceClient blobServiceClient,
        TableServiceClient tableServiceClient,
        ILogger<AzureImageService> logger)
    {
        _logger = logger;
        _containerClient = blobServiceClient.GetBlobContainerClient(ContainerName);
        _containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob).GetAwaiter().GetResult();
        _usersTable = tableServiceClient.GetTableClient(TableNames.Users);
    }

    public async Task<string> UploadProfileImageAsync(string userId, Stream imageStream, string contentType)
    {
        // 1. Resize image
        using var image = await Image.LoadAsync(imageStream);
        if (image.Width > MaxDimension || image.Height > MaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(MaxDimension, MaxDimension),
                Mode = ResizeMode.Max
            }));
        }

        // 2. Encode to JPEG
        using var outputStream = new MemoryStream();
        var encoder = new JpegEncoder { Quality = JpegQuality };
        await image.SaveAsync(outputStream, encoder);
        outputStream.Position = 0;

        // 3. Upload to Blob Storage
        var blobName = $"{userId}/profile.jpg";
        var blobClient = _containerClient.GetBlobClient(blobName);
        await blobClient.UploadAsync(outputStream, overwrite: true);
        var blobUrl = blobClient.Uri.ToString();

        // 4. Update UserEntity.ProfileImage in Table Storage
        try
        {
            var response = await _usersTable.GetEntityAsync<UserEntity>(
                UserEntity.GetPartitionKey(userId), userId);
            var entity = response.Value;
            entity.ProfileImage = blobUrl;
            entity.UpdatedAt = DateTime.UtcNow;
            await _usersTable.UpdateEntityAsync(entity, entity.ETag);
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex, "Failed to update ProfileImage in Table Storage for user {UserId}", userId);
            throw;
        }

        return blobUrl;
    }
}
```

- [ ] **Step 2: Build to confirm no compilation errors**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add Lovecraft.Backend/Services/Azure/AzureImageService.cs
git commit -m "feat: add AzureImageService (ImageSharp resize + Blob Storage upload + Table Storage update)"
```

---

## Task 4: UploadProfileImage Controller Action + Controller Unit Tests

**Files:**
- Modify: `Lovecraft.Backend/Controllers/V1/UsersController.cs`
- Modify: `Lovecraft.UnitTests/ImageTests.cs`

- [ ] **Step 1: Write the two failing controller tests**

Replace the entire contents of `Lovecraft.UnitTests/ImageTests.cs` with the following (adds two new tests after the existing one):

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Lovecraft.Backend.Controllers.V1;
using Lovecraft.Backend.MockData;
using Lovecraft.Backend.Services;
using Lovecraft.Common.Models;

namespace Lovecraft.UnitTests;

[Collection("ImageTests")]
public class ImageTests
{
    [Fact]
    public async Task MockImageService_UploadProfileImageAsync_ReturnsNonNullUrl()
    {
        var service = new MockImageService();
        var userId = MockDataStore.Users[0].Id;

        var result = await service.UploadProfileImageAsync(userId, Stream.Null, "image/jpeg");

        Assert.NotNull(result);
        Assert.NotEmpty(result);
        Assert.Equal(MockDataStore.Users[0].ProfileImage, result);
    }

    [Fact]
    public async Task UploadProfileImage_InvalidContentType_Returns400WithInvalidImageType()
    {
        var mockUserService = new Mock<IUserService>();
        var mockImageService = new Mock<IImageService>();
        var controller = new UsersController(mockUserService.Object, NullLogger<UsersController>.Instance, mockImageService.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(new[]
            {
                new System.Security.Claims.Claim("sub", "user1")
            }, "test"));

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.ContentType).Returns("text/plain");
        mockFile.Setup(f => f.Length).Returns(1024);

        var result = await controller.UploadProfileImage("user1", mockFile.Object);

        var objectResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<string>>(objectResult.Value);
        Assert.Equal("INVALID_IMAGE_TYPE", response.Error?.Code);
    }

    [Fact]
    public async Task UploadProfileImage_FileTooLarge_Returns400WithImageTooLarge()
    {
        var mockUserService = new Mock<IUserService>();
        var mockImageService = new Mock<IImageService>();
        var controller = new UsersController(mockUserService.Object, NullLogger<UsersController>.Instance, mockImageService.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(new[]
            {
                new System.Security.Claims.Claim("sub", "user1")
            }, "test"));

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.ContentType).Returns("image/jpeg");
        mockFile.Setup(f => f.Length).Returns(6 * 1024 * 1024); // 6 MB — over limit

        var result = await controller.UploadProfileImage("user1", mockFile.Object);

        var objectResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<string>>(objectResult.Value);
        Assert.Equal("IMAGE_TOO_LARGE", response.Error?.Code);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --filter "FullyQualifiedName~ImageTests" -v normal
```

Expected: FAIL — `UsersController` constructor not found (no `IImageService` parameter yet).

- [ ] **Step 3: Add UploadProfileImage action to UsersController.cs**

In `Lovecraft.Backend/Controllers/V1/UsersController.cs`:

3a. Add `IImageService` field and update constructor:

```csharp
// Add field:
private readonly IImageService _imageService;

// Update constructor:
public UsersController(IUserService userService, ILogger<UsersController> logger, IImageService imageService)
{
    _userService = userService;
    _logger = logger;
    _imageService = imageService;
}
```

3b. Add the action method (place after `UpdateUser`):

```csharp
/// <summary>
/// Upload a profile image for a user
/// </summary>
[HttpPost("{id}/images")]
public async Task<ActionResult<ApiResponse<string>>> UploadProfileImage(string id, IFormFile image)
{
    var callerId = User.FindFirst("sub")?.Value;
    if (callerId != id)
        return StatusCode(403, ApiResponse<string>.ErrorResponse("FORBIDDEN", "You can only upload your own profile image"));

    var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
    if (!allowedTypes.Contains(image.ContentType))
        return BadRequest(ApiResponse<string>.ErrorResponse("INVALID_IMAGE_TYPE", "Accepted types: JPEG, PNG, WebP"));

    if (image.Length > 5 * 1024 * 1024)
        return BadRequest(ApiResponse<string>.ErrorResponse("IMAGE_TOO_LARGE", "Image must be 5 MB or less"));

    try
    {
        var url = await _imageService.UploadProfileImageAsync(id, image.OpenReadStream(), image.ContentType);
        return Ok(ApiResponse<string>.SuccessResponse(url));
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error uploading profile image for user {UserId}", id);
        return StatusCode(500, ApiResponse<string>.ErrorResponse("INTERNAL_ERROR", "Failed to upload image"));
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --filter "FullyQualifiedName~ImageTests" -v normal
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj -v normal
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add Lovecraft.Backend/Controllers/V1/UsersController.cs Lovecraft.UnitTests/ImageTests.cs
git commit -m "feat: add UploadProfileImage controller action with validation and unit tests"
```

---

## Task 5: Program.cs Registrations

**Files:**
- Modify: `Lovecraft.Backend/Program.cs`

No new tests — covered by existing integration behavior and build success.

- [ ] **Step 1: Add FormOptions limit (at the top of service registration, before the useAzure block)**

In `Lovecraft.Backend/Program.cs`, add after `builder.Services.AddSignalR();`:

```csharp
// Allow up to 10 MB multipart bodies (business rule of 5 MB enforced in controller)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 10 * 1024 * 1024);
```

- [ ] **Step 2: Register BlobServiceClient and IImageService in the Azure branch**

Inside the `if (useAzure)` block in `Program.cs`, add after the existing `AddSingleton(new TableServiceClient(...))` line:

```csharp
builder.Services.AddSingleton(new BlobServiceClient(connectionString));
builder.Services.AddSingleton<IImageService, AzureImageService>();
```

Also add the required using at the top of `Program.cs`:

```csharp
using Azure.Storage.Blobs;
```

- [ ] **Step 3: Register MockImageService in the else branch**

Inside the `else` block, add after the last existing `AddSingleton`:

```csharp
builder.Services.AddSingleton<IImageService, MockImageService>();
```

- [ ] **Step 4: Build to confirm no compilation errors**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet build Lovecraft.Backend/Lovecraft.Backend.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 5: Run all tests**

```bash
cd D:\src\lovecraft\Lovecraft
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj -v normal
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd D:\src\lovecraft\Lovecraft
git add Lovecraft.Backend/Program.cs
git commit -m "feat: register BlobServiceClient, IImageService, and configure multipart limit in Program.cs"
```

---

## Task 6: apiClient.ts — postForm Method

**Files:**
- Modify: `src/services/api/apiClient.ts`

- [ ] **Step 1: Add postForm method to ApiClient class**

In `src/services/api/apiClient.ts`, add the following method inside the `ApiClient` class, after the existing `post` method:

```typescript
async postForm<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('access_token');
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401) {
    await this.handleUnauthorized();
    const newToken = localStorage.getItem('access_token');
    const retryHeaders: HeadersInit = newToken ? { Authorization: `Bearer ${newToken}` } : {};
    const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: retryHeaders,
      body: formData,
    });
    return retryResponse.json();
  }

  return response.json();
}
```

**Note:** Do NOT call `buildHeaders()` here — that method hardcodes `Content-Type: application/json`. The browser must set `Content-Type: multipart/form-data` with the correct boundary automatically when `body` is a `FormData`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd D:\src\aloevera-harmony-meet
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/services/api/apiClient.ts
git commit -m "feat: add postForm method to ApiClient for multipart/form-data uploads"
```

---

## Task 7: usersApi.ts — uploadProfileImage Method

**Files:**
- Modify: `src/services/api/usersApi.ts`

- [ ] **Step 1: Add uploadProfileImage to the usersApi object**

In `src/services/api/usersApi.ts`, add the following method inside the `usersApi` object (after the existing `updateUser` method):

```typescript
async uploadProfileImage(userId: string, file: File): Promise<ApiResponse<string>> {
  if (isApiMode()) {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.postForm<string>(`/api/v1/users/${userId}/images`, formData);
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, data: mockCurrentUser.profileImage };
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd D:\src\aloevera-harmony-meet
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/services/api/usersApi.ts
git commit -m "feat: add uploadProfileImage method to usersApi (mock + API mode)"
```

---

## Task 8: SettingsPage.tsx — Avatar Upload UI

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add new imports**

In `src/pages/SettingsPage.tsx`, ensure `useRef` is imported from React (add to existing React import if needed) and the `usersApi` import is present. Also remove `Camera` from lucide-react imports if it is no longer used after this change.

Verify the top of the file has:
```typescript
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 2: Add new state and ref**

In the `SettingsPage` component function body, alongside the existing `useState` declarations, add:

```typescript
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [pendingFile, setPendingFile] = useState<File | null>(null);
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Add event handlers**

In the component function body, after the existing handlers, add:

```typescript
const handleAvatarClick = () => {
  fileInputRef.current?.click();
};

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setPreviewUrl(reader.result as string);
  reader.readAsDataURL(file);
  setPendingFile(file);
};

const handleSavePhoto = async () => {
  if (!pendingFile || !user) return;
  setIsUploading(true);
  try {
    const result = await usersApi.uploadProfileImage(user.id, pendingFile);
    if (!result.success) throw result;
    setUser({ ...user, profileImage: result.data! });
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.success('Photo updated');
  } catch (err) {
    showApiError(err, 'Failed to upload photo');
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  } finally {
    setIsUploading(false);
  }
};

const handleCancelPhoto = () => {
  setPreviewUrl(null);
  setPendingFile(null);
  if (fileInputRef.current) fileInputRef.current.value = '';
};
```

- [ ] **Step 4: Update lucide-react imports**

Read the current lucide-react import line in `SettingsPage.tsx`. Remove `Camera` (Step 5 removes the only place it was used) and add `Pencil`. For example, if the current import is:

```typescript
import { Camera, Settings, User } from 'lucide-react';
```

It becomes:

```typescript
import { Settings, User, Pencil } from 'lucide-react';
```

Replace the actual icons with whatever is currently listed — the rule is: drop `Camera`, add `Pencil`, keep everything else.

- [ ] **Step 5: Replace the avatar area in the JSX**

Find the existing avatar block (around line 136–141):

```tsx
<div className="relative inline-block">
  <img src={user.profileImage} alt={user.name} className="w-32 h-32 rounded-full object-cover shadow-lg" />
  {isEditing && (
    <Button size="sm" className="absolute bottom-0 right-0 rounded-full w-10 h-10 p-0"><Camera className="w-4 h-4" /></Button>
  )}
</div>
```

Replace it entirely with:

```tsx
<div
  className="relative inline-block cursor-pointer"
  onClick={handleAvatarClick}
>
  <img
    src={previewUrl ?? user.profileImage}
    alt={user.name}
    className="w-32 h-32 rounded-full object-cover shadow-lg"
  />
  <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[--aloe-flame] flex items-center justify-center border-2 border-background">
    <Pencil className="w-3.5 h-3.5 text-white" />
  </div>
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    hidden
    ref={fileInputRef}
    onChange={handleFileChange}
  />
</div>
{pendingFile && (
  <div className="flex gap-2 mt-3">
    <Button onClick={handleSavePhoto} disabled={isUploading} size="sm">
      {isUploading ? 'Saving...' : 'Save photo'}
    </Button>
    <Button onClick={handleCancelPhoto} disabled={isUploading} variant="outline" size="sm">
      Cancel
    </Button>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd D:\src\aloevera-harmony-meet
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test in mock mode**

```bash
cd D:\src\aloevera-harmony-meet
npm run dev
```

1. Open `http://localhost:5173`, log in as `user1@mock.local` / `Seed123!@#`
2. Navigate to Settings
3. Verify avatar shows pencil badge and is clickable
4. Select an image file — verify inline preview appears and Save/Cancel buttons appear
5. Click Cancel — verify preview reverts and buttons disappear
6. Select image again, click Save photo — verify "Photo updated" toast appears and profile image updates
7. Verify the same image file can be re-selected after saving

- [ ] **Step 8: Commit**

```bash
cd D:\src\aloevera-harmony-meet
git add src/pages/SettingsPage.tsx
git commit -m "feat: add clickable avatar upload UI with preview and save/cancel to SettingsPage"
```

---

## Spec Reference

`D:\src\aloevera-harmony-meet\docs\superpowers\specs\2026-03-19-profile-image-upload-design.md`
