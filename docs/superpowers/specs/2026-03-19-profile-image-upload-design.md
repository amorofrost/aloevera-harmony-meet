# Profile Image Upload — Design Spec

**Issue**: MCF.3
**Date**: 2026-03-19
**Status**: Approved

---

## Overview

Allow users to upload a profile photo from the Settings page. The photo is resized server-side and stored in Azure Blob Storage. The frontend shows a preview before confirming the upload.

**Scope**: Full stack — backend (Azure Blob Storage + new endpoint) and frontend (clickable avatar UI in `SettingsPage.tsx`).

**Out of scope**: Multiple-image gallery (backend scaffolded for it, but UI is single-photo only for now), image cropping, upload progress bar.

---

## Decisions

| Question | Decision |
|---|---|
| Storage | Azure Blob Storage (`profile-images` container, public blob read) |
| Image processing | Server-side resize via SixLabors.ImageSharp |
| Output dimensions | Longest side ≤ 800 px, JPEG quality 85 |
| Max input size | 5 MB (enforced in controller via `IFormFile.Length` before calling the service) |
| Accepted types | JPEG, PNG, WebP (validated in controller before calling the service) |
| Blob naming | `profile-images/{userId}/profile.jpg` (always overwrites — no orphaned blobs) |
| Upload trigger | Deferred — file select shows preview, explicit "Save photo" confirms |
| UI pattern | Clickable avatar with pencil badge overlay |
| Mock mode | `MockImageService` looks up user in `MockDataStore.Users` and returns their existing `ProfileImage` URL |

---

## Backend

### New service: `IImageService`

**Location**: `Lovecraft.Backend/Services/IServices.cs` (add interface), plus two implementations.

```csharp
public interface IImageService
{
    Task<string> UploadProfileImageAsync(string userId, Stream imageStream, string contentType);
}
```

**`MockImageService`**: Looks up the user in `MockDataStore.Users` by `userId` and returns that user's `ProfileImage` field. No file I/O. Registered when `USE_AZURE_STORAGE=false`.

**`AzureImageService`**: Full pipeline:
1. Decode with SixLabors.ImageSharp, resize to max 800 px on longest side (aspect-ratio preserved)
2. Encode as JPEG quality 85 into a `MemoryStream`
3. Upload to Azure Blob Storage container `profile-images`, blob name `{userId}/profile.jpg`, via `BlobServiceClient` (injected via DI)
4. Update `UserEntity.ProfileImage` in Table Storage with the public blob URL (field is `ProfileImage`, not `ProfileImageUrl`)
5. Return the blob URL

Note: content type and size validation happen in the **controller** before this method is called (see endpoint section below).

### New endpoint

```
POST /api/v1/users/{id}/images
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file field named "image"

200 Response: ApiResponse<string>   // new image URL
400 Response: ApiResponse (INVALID_IMAGE_TYPE | IMAGE_TOO_LARGE)
403 Response: ApiResponse           // caller ID ≠ {id}
```

**Controller** (`UsersController.UploadProfileImage`):
1. Verify caller ID (from JWT) matches route `{id}` → 403 if not
2. Read `IFormFile image` from the request
3. Validate `image.ContentType` is one of `image/jpeg`, `image/png`, `image/webp` → 400 `INVALID_IMAGE_TYPE` if not
4. Validate `image.Length <= 5 * 1024 * 1024` → 400 `IMAGE_TOO_LARGE` if exceeded
5. Call `IImageService.UploadProfileImageAsync(id, image.OpenReadStream(), image.ContentType)`
6. Return the URL in `ApiResponse<string>`

**`Program.cs` changes**:
- Register `BlobServiceClient` as a singleton using `AZURE_STORAGE_CONNECTION_STRING` (same pattern as `TableServiceClient`)
- Register `IImageService` — `MockImageService` when `USE_AZURE_STORAGE=false`, `AzureImageService` when `true`
- Configure multipart limit: `builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 10 * 1024 * 1024)` (10 MB at ASP.NET level to allow the controller to return a clean 400; the 5 MB business rule is enforced in the controller)

### Azure Blob Storage setup

- Container: `profile-images`, created with `PublicAccessType.Blob` so images are publicly readable by URL
- `AzureImageService` constructor calls `blobServiceClient.GetBlobContainerClient("profile-images").CreateIfNotExistsAsync(PublicAccessType.Blob).GetAwaiter().GetResult()` on startup — synchronously awaited because constructors cannot be `async` (same pattern as `AzureChatService`)
- Connection string: existing `AZURE_STORAGE_CONNECTION_STRING` env var

### NuGet packages to add to `Lovecraft.Backend.csproj`

- `SixLabors.ImageSharp` — image resizing
- `Azure.Storage.Blobs` — Blob Storage client (`BlobServiceClient`)

---

## Frontend

### `usersApi.ts` — new method

```typescript
uploadProfileImage(userId: string, file: File): Promise<ApiResponse<string>>
```

- **Mock mode**: 500 ms simulated delay, returns `{ success: true, data: mockCurrentUser.profileImage }` — uses `mockCurrentUser` (already imported in `usersApi.ts`) since Settings only calls this for the logged-in user
- **API mode**: Builds `FormData` with file as `"image"` field, calls `apiClient.postForm(\`/api/v1/users/${userId}/images\`, formData)`

### `apiClient.ts` — new method

```typescript
postForm<T>(url: string, formData: FormData): Promise<ApiResponse<T>>
```

- Does **not** call `buildHeaders()` (which hardcodes `Content-Type: application/json`)
- Constructs headers manually: only `{ Authorization: 'Bearer <token>' }` — **no `Content-Type`** (browser sets it with multipart boundary automatically)
- On 401 response: calls `handleUnauthorized()` to refresh the token, then retries the fetch with a **newly constructed** auth-only header object using the refreshed token (must not reuse the original fetch options — rebuild `{ Authorization: 'Bearer <newToken>' }` for the retry to avoid sending the expired token again)
- Parses and returns the JSON response as `ApiResponse<T>`

### `SettingsPage.tsx` — avatar section changes

The profile avatar area becomes a self-contained upload zone, independent of the edit mode — the upload UI is **always visible**, not gated behind `isEditing`. Any existing `{isEditing && <camera button>}` block in the avatar area must be **removed and replaced** by the new upload zone. No changes to the other edit form fields.

**New state and ref**:
```typescript
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [pendingFile, setPendingFile] = useState<File | null>(null);
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

**JSX structure**:
```
<div> (relative, cursor-pointer, onClick → handleAvatarClick)
  <img src={previewUrl ?? user.profileImage} alt="Profile" />
  <div> (pencil badge overlay, absolute bottom-right)
  <input type="file" accept="image/jpeg,image/png,image/webp" hidden ref={fileInputRef} onChange={handleFileChange}>
</div>
{pendingFile && (
  <div>
    <Button onClick={handleSavePhoto} disabled={isUploading}>
      {isUploading ? 'Saving...' : 'Save photo'}
    </Button>
    <Button onClick={handleCancelPhoto} disabled={isUploading}>Cancel</Button>
  </div>
)}
```

**Handlers**:

`handleAvatarClick` → `fileInputRef.current?.click()`

`handleFileChange(e: React.ChangeEvent<HTMLInputElement>)`:
- Get `file = e.target.files?.[0]`; return if none
- Read with `FileReader.readAsDataURL(file)` → `setPreviewUrl(result)`
- `setPendingFile(file)`

`handleSavePhoto`:
```
setIsUploading(true)
try {
  const result = await usersApi.uploadProfileImage(user.id, pendingFile)
  if (!result.success) throw result
  setUser({ ...user, profileImage: result.data })
  setPreviewUrl(null)
  setPendingFile(null)
  if (fileInputRef.current) fileInputRef.current.value = ''   // reset so same file can be re-selected
  toast.success('Photo updated')
} catch (err) {
  showApiError(err, 'Failed to upload photo')
  setPreviewUrl(null)
  setPendingFile(null)
  if (fileInputRef.current) fileInputRef.current.value = ''
} finally {
  setIsUploading(false)
}
```

`handleCancelPhoto`:
```
setPreviewUrl(null)
setPendingFile(null)
if (fileInputRef.current) fileInputRef.current.value = ''   // reset so same file can be re-selected
```

---

## Error Handling

| Scenario | Backend response | Frontend behaviour |
|---|---|---|
| Wrong file type | 400 `INVALID_IMAGE_TYPE` | `showApiError` toast, revert preview |
| File > 5 MB | 400 `IMAGE_TOO_LARGE` | `showApiError` toast, revert preview |
| Blob Storage unavailable | 500 | `showApiError` toast, revert preview |
| Caller ID ≠ route `{id}` | 403 | `showApiError` toast, revert preview |
| Token expired during upload | 401 → auto-refresh retry | Transparent to user |

---

## Testing

**Backend** (3 new unit tests in `Lovecraft.UnitTests/ImageTests.cs`):
1. `MockImageService.UploadProfileImageAsync` — returns non-null URL matching the mock user's `ProfileImage`
2. `UsersController.UploadProfileImage` (or isolated validation logic) — rejects `text/plain` with `INVALID_IMAGE_TYPE`
3. `UsersController.UploadProfileImage` (or isolated validation logic) — rejects a file > 5 MB with `IMAGE_TOO_LARGE`

**Frontend**: `SettingsPage.tsx` is currently untested; no new test files required for this change. Existing 50 frontend tests remain unaffected.

---

## Files Changed

### Backend (`D:\src\lovecraft\Lovecraft\`)
- `Lovecraft.Backend/Lovecraft.Backend.csproj` — add `SixLabors.ImageSharp` and `Azure.Storage.Blobs` NuGet packages
- `Lovecraft.Backend/Services/IServices.cs` — add `IImageService` interface
- `Lovecraft.Backend/Services/MockImageService.cs` — new file
- `Lovecraft.Backend/Services/Azure/AzureImageService.cs` — new file
- `Lovecraft.Backend/Controllers/V1/UsersController.cs` — add `UploadProfileImage` action
- `Lovecraft.Backend/Program.cs` — register `BlobServiceClient` singleton, register `IImageService`, configure `FormOptions.MultipartBodyLengthLimit`
- `Lovecraft.UnitTests/ImageTests.cs` — new file (3 tests)

### Frontend (`D:\src\aloevera-harmony-meet\`)
- `src/services/api/apiClient.ts` — add `postForm` method (auth-only headers, 401 retry)
- `src/services/api/usersApi.ts` — add `uploadProfileImage` method
- `src/pages/SettingsPage.tsx` — avatar upload UI (clickable avatar, preview, save/cancel)
