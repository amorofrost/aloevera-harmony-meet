# Anonymous Likes — Design Spec

**Date:** 2026-07-17
**Issue:** MCF.8 — "Anonymous likes not implemented (all likes visible to recipient)."
**Repos:** `aloevera-harmony-meet` (frontend) + `lovecraft` (backend)

---

## 1. Summary

Let a user send either a **normal like** (as today) or an **anonymous ("secret") like**. Anonymity is a
per-like property, persisted on the like. An anonymous like behaves exactly like a normal one except:

- The recipient never learns the sender's identity **while the like is pending**.
- The recipient sees anonymous likes as a **count** ("N people liked you secretly"), not as profile cards.

When an anonymous like becomes **mutual it turns into a normal match** — both identities are revealed on the
Matches tab and the `MatchCreated` notification fires with the actor, exactly as for normal likes. No special
handling is required because matches are computed from the pair intersection of the two like tables.

The recipient still receives a `LikeReceived` notification for an anonymous like, with **no sender information**
(this already works: `actorId = null`, `payload.anonymous = true`, rendered via the existing
`notifications.title.likeReceivedAnonymous` key).

---

## 2. Behavior model

- **Per-like anonymity.** Each like carries `IsAnonymous`. The choice is made at send time and persisted.
- **Settings toggle = swipe-right default only.** The existing (currently disabled) `anonymousLikes` switch on
  the Settings page becomes the default applied when the user **swipes right**. The on-card buttons always let the
  user choose explicitly per profile, regardless of the setting.
- **Counts toward everything.** Anonymous likes increment `LikesReceived` and feed rank exactly like normal likes.
- **Match reveals.** A mutual like (either direction) produces a normal match; anonymity ends there. If the
  earlier like was anonymous, the match still reveals both users — nothing extra to do.

---

## 3. Backend changes (`lovecraft`)

### 3.1 Data model
- `Storage/Entities/LikeEntity.cs` — add `public bool IsAnonymous { get; set; }`. Persisted on **both** the
  `likes` row (PK=from, RK=to) and the mirrored `likesreceived` row (PK=to, RK=from).
- `Common/DTOs/Matching/MatchingDtos.cs`:
  - `LikeDto` — add `public bool IsAnonymous { get; set; }`.
  - `CreateLikeRequestDto` — add `public bool Anonymous { get; set; }` (default `false`).

### 3.2 `IMatchingService` (interface in `Services/IServices.cs`)
- `CreateLikeAsync(string fromUserId, string toUserId, bool anonymous)` — signature gains `anonymous`.
- New: `Task<int> GetAnonymousReceivedCountAsync(string userId)`.

### 3.3 `AzureMatchingService` + `MockMatchingService`
- `CreateLikeAsync`:
  - Persist `IsAnonymous = anonymous` on both like rows.
  - Drive the non-mutual `LikeReceived` notification from the **`anonymous` param** directly:
    `actorId = anonymous ? null : fromUserId`, `payload = { likeId, anonymous }`. **Remove** the current
    behavior of re-fetching the sender's global `Settings.AnonymousLikes` (and the extra `GetUserByIdAsync`
    call in the Azure impl) — anonymity now comes from the request, not the global setting.
  - Everything else unchanged: `LikesReceived` increment, mutual-match path, `MatchCreated` notifications.
- `GetReceivedLikesAsync` — **exclude** pending likes where `IsAnonymous == true` (in addition to the existing
  mutual-exclusion). The sender's identity for a pending anonymous like must never be returned to the client.
- `GetAnonymousReceivedCountAsync` — count of pending (non-mutual) received likes where `IsAnonymous == true`.
  Same mutual-exclusion logic as `GetReceivedLikesAsync`.
- `GetSentLikesAsync` — unchanged, but now returns `IsAnonymous` (via `ToSentLikeDto`) so the sender's own Sent
  tab can badge their anonymous likes. `GetMatchesAsync` — unchanged.
- `ToSentLikeDto` / `ToReceivedLikeDto` — carry `IsAnonymous` through.

### 3.4 Controller (`Controllers/V1/MatchingController.cs`)
- `POST /api/v1/matching/likes` — pass `request.Anonymous` into `CreateLikeAsync`.
- New `GET /api/v1/matching/likes/received/anonymous-count` → `ApiResponse<AnonymousLikeCountDto>` where
  `AnonymousLikeCountDto { int Count }`.

---

## 4. Frontend changes (`aloevera-harmony-meet`)

### 4.1 Types & service
- `src/types/user.ts` — `Like` gains `isAnonymous?: boolean`.
- `src/services/api/matchingApi.ts`:
  - `sendLike(toUserId: string, anonymous = false)` → posts `{ toUserId, anonymous }` (api mode); mock returns
    `{ isMatch: false }` as today.
  - New `getAnonymousReceivedCount(): Promise<ApiResponse<number>>` → calls the new endpoint in api mode; mock
    returns `0` (or a small static value from mock data).
  - `getReceivedLikes` / `getSentLikes` — map `isAnonymous` from the dto onto `Like`.

### 4.2 `src/pages/Friends.tsx`
- **Deck action buttons — 4 buttons** replacing the current 3 (skip / more-info / like):
  `Skip (✕)` · `Details (▲/▼)` · `Like (♥)` · `Secret like (🔒♥)`.
  - Like → `sendLike(id, false)`; Secret like → `sendLike(id, true)`.
  - Keep them on one row, mobile-friendly (reduce sizes so four fit; e.g. the two heart buttons `w-14 h-14`,
    skip/details slightly smaller). Follow existing `btn-like` / `btn-pass` styling; secret like reuses the like
    gradient with a lock/secret glyph overlaid or `Lock`+`Heart` composed icon.
- **Swipe-right default:** `onSwipeRight` / the `onLike` handler sends `sendLike(id, myDefaultAnonymous)` where
  `myDefaultAnonymous` = the **logged-in** user's `settings.anonymousLikes`, loaded via `useCurrentUser()`.
  (Swipe-left / Skip unchanged.)
- **`renderUserDeckCard`** signature extends so both the deck and the deep-link single-profile view provide the
  Like / Secret-like pair. The `?userId=` view uses the same two actions.
- **Received sub-tab:** when `anonymousReceivedCount > 0`, render a summary card at the top:
  `🔒 {count} people liked you secretly`. Normal (non-anonymous) received likes render below as today (backend
  already filters anonymous ones out). Fetch the count alongside the other likes-tab loads.
- **Sent sub-tab:** show a small "secret" lock badge on `like.isAnonymous` entries.

### 4.3 `src/pages/SettingsPage.tsx`
- Enable the `anonymousLikes` `Switch` (remove `disabled`), wire `onCheckedChange` into the existing
  profile-edit/persist flow, and relabel with help text conveying "swipe right sends secret likes; you can still
  choose per profile."
- **Verify** `PUT /users/{id}` maps `settings.anonymousLikes` end-to-end. The field already exists on the user
  entity (backend reads it today), so this is expected to work; if the update mapping drops it, add it to the
  users update path (small change).

### 4.4 i18n (`src/contexts/LanguageContext.tsx`)
New ru + en keys:
- `search.like`, `search.secretLike` — deck button labels / aria.
- `likes.secretAdmirers` — "{count} people liked you secretly" / "Вас тайно лайкнули: {count}".
- `likes.sentSecretBadge` — small "secret" tag on Sent tab.
- `settings.anonymousLikes` label + `settings.anonymousLikesHelp` help text.

---

## 5. Cross-cutting

### 5.1 Mock parity
- `MockMatchingService.CreateLikeAsync` accepts + persists `anonymous` on the mock `LikeDto`; `GetReceivedLikesAsync`
  filters anonymous; `GetAnonymousReceivedCountAsync` implemented.
- `matchingApi` mock branch honors the flag and returns a sensible count so mock-mode dev keeps working.

### 5.2 Out of scope
- The orphaned `src/pages/Likes.tsx` (no route; embedded mock data) is **not** touched.
- No change to Web Push / Telegram / Email notification rendering — they already consume `payload.anonymous` /
  null actor.

---

## 6. Testing

**Backend (`Lovecraft.UnitTests/MatchingTests.cs`):**
- Anonymous like persists `IsAnonymous` on both like rows.
- Non-mutual anonymous like → `LikeReceived` notification fired with `actorId == null` and `payload.anonymous == true`.
- Non-mutual normal like → notification with actor set (regression).
- Anonymous pending like is **excluded** from `GetReceivedLikesAsync`; a normal pending like is included.
- `GetAnonymousReceivedCountAsync` returns the correct pending anonymous count and excludes mutual ones.
- Mutual like where one side was anonymous → produces a match (revealed) with `MatchCreated` to both.

**Frontend (`src/services/api/matchingApi.test.ts`):**
- `sendLike(id, true)` posts `anonymous: true`; `sendLike(id)` defaults to `false`.
- `getAnonymousReceivedCount` maps the new endpoint response.

---

## 7. Rollout notes
- Existing like rows have no `IsAnonymous` property; Azure Table deserialization defaults it to `false`, so all
  pre-existing likes are treated as normal. No migration required.
