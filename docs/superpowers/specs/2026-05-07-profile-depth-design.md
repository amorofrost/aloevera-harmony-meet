# Profile depth — design spec

**Date:** 2026-05-07
**Scope:** Friends/dating section — profile depth (B1, B2, B4 from the brainstorm).
**Out of scope (explicit):** Discovery/filtering (A), favorite-song surfacing (B3), profile-completeness meter (B5). A separate spec follows for A.
**Repos touched:** `aloevera-harmony-meet` (frontend), `lovecraft` (backend).

---

## Goal

Make the swipe deck and the profile detail view feel like a real dating-app profile rather than a one-line bio:

- **B1.** Multi-photo support — users upload up to 6 photos and reorder them; the deck card and profile detail show all of them via tap-zone navigation.
- **B2.** Prompts — users pick up to 3 questions from a curated fan-flavoured catalogue and write short answers (≤ 200 chars). One prompt is previewed on the deck card; all are shown on profile detail.
- **B4.** "Common ground" line — derived signal ("Вы оба были на AloeFest 2024", "Оба из Москвы") shown on the deck card and profile detail.

---

## Non-goals

- No filter/search work (A) — separate spec.
- No prompts admin UI / `appconfig` integration — catalogue is a static frontend constant for v1.
- No SAS-token / private-blob work for the new photos — they continue to use the existing public-read `content-images` container (TD.8 remains its own track).
- No photo cropping / face-detection / order-by-AI. User uploads, user reorders, user deletes.
- No required-prompts gate ("must answer 2 to publish") — left for B5.

---

## Architecture summary

Approach 1 from the brainstorm: pragmatic full-stack.

- One new column on `UserEntity` (`PromptsJson`).
- Existing `PUT /api/v1/users/{id}` accepts two new optional fields (`prompts`, `images`) — replacement semantics, partial update preserved.
- No new endpoints, no new tables, no new SignalR events.
- Frontend gains a photo carousel component, a prompts editor in Settings, a common-ground helper, and a localised prompts catalogue.

---

## Backend changes (`lovecraft`)

### Storage entity

`Lovecraft.Backend/Storage/Entities/UserEntity.cs`:

- Add `public string? PromptsJson { get; set; }` — JSON-encoded array of `{ promptId, answer }`. `null` or `"[]"` when none. Up to 3 entries; ≤ 200 chars per answer ⇒ well under the 64 KB Azure Table entity limit.
- `Images` (already present, `string[]`) — capacity now meaningful: writes capped at 6.

### Shared DTOs (`Lovecraft.Common/DTOs/Users/UserDto.cs`)

```csharp
public sealed record PromptAnswerDto(string PromptId, string Answer);
```

`UserDto` gains:

```csharp
public IReadOnlyList<PromptAnswerDto>? Prompts { get; init; }
```

`UpdateUserRequestDto` gains:

```csharp
public IReadOnlyList<PromptAnswerDto>? Prompts { get; init; }
public IReadOnlyList<string>? Images { get; init; }
```

`null` on either field ⇒ untouched. Non-null ⇒ replace.

### Validation (`UsersController.UpdateUser`)

Order matters — return the first failure:

1. `prompts is { Count: > 3 }` → 400 `PROMPTS_TOO_MANY`
2. Any `prompt.PromptId` not in `KnownPromptIds` → 400 `UNKNOWN_PROMPT_ID`
3. Duplicate `promptId` across the array → 400 `DUPLICATE_PROMPT_ID`
4. Any `prompt.Answer.Length > 200` → 400 `PROMPT_ANSWER_TOO_LONG`
5. `HtmlGuard.Reject(prompt.Answer)` → 400 `HTML_NOT_ALLOWED` (existing pattern)
6. `images is { Count: > 6 }` → 400 `IMAGES_TOO_MANY`
7. Any `images[i]` whose host is not the configured Azure Blob host → 400 `INVALID_IMAGE_URL`

### `KnownPromptIds`

Static `HashSet<string>` in `Lovecraft.Backend/Constants/PromptIds.cs`. Mirror the IDs in `src/data/prompts.ts` by hand. The backend never renders prompt text — it only validates IDs.

### Service layer

- `IUserService.UpdateUserAsync` already takes the request DTO. Extend the implementation in `AzureUserService` to:
  - Round-trip `PromptsJson` (serialise on write, deserialise into `UserDto.Prompts` on read).
  - Replace `UserEntity.Images` when `Images` is non-null.
  - Update `UserCache` on successful write (existing pattern).
- `MockUserService` mirrors the same logic against in-memory state.

### Tests

- `Lovecraft.UnitTests/Controllers/UsersControllerUpdateTests.cs` (new file): one case per validation rule above + happy-path round-trip + partial-update preservation (send `prompts` only, expect `images` unchanged).
- `Lovecraft.UnitTests/Services/AzureUserServiceTests.cs`: add `PromptsJson` round-trip and confirm cache update.
- `Lovecraft.UnitTests/Services/MockUserServiceTests.cs` (or equivalent): mirror.

Target: existing 264 tests still green; add ≥ 12 new cases.

---

## Frontend changes (`aloevera-harmony-meet`)

### New files

| Path | Role |
|---|---|
| `src/data/prompts.ts` | `PROMPT_CATALOG` (12 items, `{ id, ru, en }`); `getPromptText(id, lang)`. |
| `src/lib/commonGround.ts` | `commonGround(viewer, target): CommonGroundSignal[]` (priority-ordered). |
| `src/components/ui/photo-carousel.tsx` | `<PhotoCarousel images mode="deck" \| "detail" />` — tap zones in deck mode, arrows + dots in detail mode. Photo dots row at top in both modes. |
| `src/components/profile/PromptCard.tsx` | Single prompt as a styled card (question + answer). |
| `src/components/profile/CommonGroundLine.tsx` | Icon + one line. |
| `src/components/profile/CommonGroundSection.tsx` | Up to 3 lines on profile detail. |
| `src/components/settings/PhotoGrid.tsx` | `@dnd-kit/sortable` grid; click-to-upload, x-to-delete. |
| `src/components/settings/PromptsEditor.tsx` | 3 slots; each = `<Select>` (catalogue) + `<Textarea>` (answer with X/200 counter). |

### Modified files

| Path | Change |
|---|---|
| `src/types/user.ts` | Add `PromptAnswer = { promptId: string; answer: string }`; `User.prompts?: PromptAnswer[]`. |
| `src/services/api/usersApi.ts` | `updateUser` accepts `prompts` and `images`. `mapUserFromApi` reads `prompts` from DTO. |
| `src/lib/validators.ts` | New `promptsSchema` (≤ 3 entries, unique `promptId`, answer ≤ 200, no HTML). |
| `src/pages/Friends.tsx` | Deck card + viewing-user branches use `<PhotoCarousel>`; render `<CommonGroundLine>` and (in deck) the user's first `<PromptCard>`. |
| `src/pages/SettingsPage.tsx` | Add **Photos** and **Prompts** sub-sections wired to `usersApi.updateUser`. |
| `src/contexts/LanguageContext.tsx` | New keys: `prompts.*`, `commonGround.*`, `settings.photos.*`, `settings.prompts.*`. Both `ru` and `en`. |
| `src/data/mockUsers.ts`, `mockProfiles.ts` | Seed prompts and 2–3 sample photos each so mock mode exercises the new UI. |
| `package.json` | Add `@dnd-kit/core` and `@dnd-kit/sortable`. |

### Deck-card layout (current vs new)

Current: cover image with bottom-anchored gradient overlay containing online dot, name + age, badges, location, bio (line-clamp-2), Instagram, events row.

New (additive):
- Photo dots row pinned at top of card (left-edge to right-edge, 8px from top, opacity 0.7).
- Tap left half = previous photo, tap right half = next photo. Horizontal swipe still routes to SwipeCard (pass/like).
- Below the events row: `<CommonGroundLine>` (only if a signal exists).
- Below common ground: first `<PromptCard>` (only if the user has prompts).

### Profile detail layout

Same hero photo carousel (detail mode — arrows + dots, no tap zones to avoid surprising the user). Below it:

1. Online + name + age + badges + location + Instagram (existing block).
2. `<CommonGroundSection>` (up to 3 signals) — only if any.
3. All `<PromptCard>` entries (vertical list).
4. Bio.
5. `eventsAttended` row (existing).

### Settings sub-sections

**Photos**

- Grid of 6 slots. Each slot is either a thumbnail (delete-on-x button overlaid) or an empty "+" tile.
- Drag any thumbnail to any slot to reorder; first slot = cover / `profileImage`.
- Click "+" to open file picker → `uploadImage(file)` → URL → push to local `images` array.
- "Save" button calls `usersApi.updateUser(myId, { images })`.

**Prompts**

- Three slots. Each slot:
  - `<Select>` lists the catalogue, filtered to exclude prompts already chosen in other slots (no dup).
  - `<Textarea>` for the answer with a live `X / 200` counter.
  - "Clear slot" button.
- "Save" button calls `usersApi.updateUser(myId, { prompts })`.
- Form uses `react-hook-form` + `zodResolver(promptsSchema)`. Inline errors per slot.

### Common-ground helper

`src/lib/commonGround.ts`:

```ts
type CommonGroundSignal =
  | { kind: 'sharedEventsMany'; count: number }
  | { kind: 'sharedEventOne'; event: Event }
  | { kind: 'sharedUpcomingEvent'; event: Event }
  | { kind: 'sharedRank'; rank: 'aloeCrew' | 'friendOfAloe' }
  | { kind: 'sharedCity'; city: string };

export function commonGround(viewer: User, target: User): CommonGroundSignal[];
```

Rules (in priority order; helper returns the full array, render code slices):

1. Compute `sharedPast = (viewer.eventsAttended ?? []).filter(e => target.eventsAttended?.some(t => t.id === e.id) && eventIsPast(e))`. If `sharedPast.length ≥ 2` ⇒ `sharedEventsMany`. Else if `length === 1` ⇒ `sharedEventOne`.
2. **Decision deferred to implementation.** If `User.eventsAttended` is confirmed to include upcoming registrations (not just past attendance), emit `sharedUpcomingEvent` for any future-dated event in the intersection. If `eventsAttended` is past-only, drop this signal from v1 — adding it would require a new API call (`GET /events/upcoming` or similar), which is out of scope. The plan author makes this call after a 5-minute spike against the dev backend; if dropped, also drop the corresponding `commonGround.sharedUpcomingEvent` i18n key and the associated test case from this spec.
3. If `viewer.rank === target.rank` and `rank ∈ {'aloeCrew', 'friendOfAloe'}` ⇒ `sharedRank`.
4. If `viewer.location.trim().toLowerCase() === target.location.trim().toLowerCase()` and non-empty ⇒ `sharedCity`.

Edge cases:
- `viewer.id === target.id` ⇒ return `[]` (no self-matching).
- Missing `eventsAttended` ⇒ skip event signals, fall through to rank/city.
- Empty `location` ⇒ skip city signal.

### i18n keys (added to `LanguageContext.tsx`)

- `commonGround.sharedEventsMany` — "Вы оба были на {count} концертах AloeVera" / "You've both been to {count} AloeVera shows"
- `commonGround.sharedEventOne` — "Вы оба были на {event}" / "You've both been to {event}"
- `commonGround.sharedUpcomingEvent` — "Оба идут на {event}" / "Both attending {event}"
- `commonGround.sharedRank.aloeCrew` — "Оба — Aloe Crew" / "Both Aloe Crew"
- `commonGround.sharedRank.friendOfAloe` — "Оба — Friend of Aloe" / "Both Friend of Aloe"
- `commonGround.sharedCity` — "Оба из {city}" / "Both from {city}"
- `settings.photos.title`, `settings.photos.empty`, `settings.photos.delete`, `settings.photos.dragHint`, `settings.photos.saveSuccess`, `settings.photos.saveFailed`
- `settings.prompts.title`, `settings.prompts.placeholder`, `settings.prompts.clear`, `settings.prompts.charCount` (with `{count}/200`), `settings.prompts.saveSuccess`, `settings.prompts.saveFailed`
- `prompts.<id>` for every prompt in the catalogue (12 entries × 2 languages).

### Curated prompt catalogue (editable)

`src/data/prompts.ts` exports:

```ts
export const PROMPT_CATALOG = [
  { id: 'aloevera_first',     ru: 'Моё первое знакомство с AloeVera…',         en: 'How I first found AloeVera…' },
  { id: 'aloevera_song',      ru: 'Любимая песня AloeVera и почему',           en: 'Favorite AloeVera song and why' },
  { id: 'concert_memory',     ru: 'Лучший момент с концерта AloeVera',         en: 'Best AloeVera concert memory' },
  { id: 'looking_for',        ru: 'Что я ищу здесь',                            en: "What I'm looking for here" },
  { id: 'weekend',            ru: 'Идеальные выходные — это…',                 en: 'A perfect weekend looks like…' },
  { id: 'road_trip',          ru: 'На концерт AloeVera поеду…',                 en: "I'd travel this far for an AloeVera show…" },
  { id: 'playlist',           ru: 'Кроме AloeVera я слушаю…',                  en: 'Besides AloeVera I listen to…' },
  { id: 'instrument',         ru: 'Если бы я был в группе, играл бы на…',      en: "If I were in a band, I'd play…" },
  { id: 'unpopular_opinion',  ru: 'Непопулярное мнение об AloeVera',            en: 'Unpopular AloeVera opinion' },
  { id: 'dream_setlist',      ru: 'Сетлист моей мечты',                         en: 'My dream AloeVera setlist' },
  { id: 'first_date',         ru: 'Идея для первого свидания',                  en: 'First-date idea' },
  { id: 'dealbreaker',        ru: 'Меня точно не зацепит…',                     en: "Won't work for me…" },
] as const;
```

(IDs are the contract with the backend's `KnownPromptIds`. Editing text is a frontend-only change. Adding/removing an ID requires updating both sides in the same release.)

---

## Error handling

- All `usersApi.updateUser` failures route through `showApiError(err, t('settings.<which>.saveFailed'))`.
- Backend validation error codes (`PROMPTS_TOO_MANY`, `UNKNOWN_PROMPT_ID`, etc.) — frontend maps to inline form errors via `form.setError` where possible (e.g. `PROMPT_ANSWER_TOO_LONG` → set on the matching slot's `answer` field). Generic codes fall back to toast.
- Photo upload failures (existing `IMAGE_TOO_LARGE`, `UNSUPPORTED_IMAGE_TYPE` from `POST /images/upload`) → toast with the existing localised message.
- Photo carousel with empty `images` falls back to single `profileImage` (no breakage for unmigrated users — most existing users today).
- Common-ground helper returns `[]` for self-vs-self and on missing data; render code conditionally hides the `<CommonGroundLine>` / `<CommonGroundSection>` element when empty.

---

## Testing

### Backend

- `UsersControllerUpdateTests` — new file. One case per validation rule (8 negative + 2 positive: full update and partial-update preservation).
- `AzureUserServiceTests` — extend with `PromptsJson` round-trip + cache update.
- `MockUserServiceTests` — mirror.

### Frontend

- `src/lib/__tests__/commonGround.test.ts` — new. Cases:
  - 0 shared events ⇒ no event signal.
  - 1 shared past event ⇒ `sharedEventOne`.
  - 2 shared past events ⇒ `sharedEventsMany` with `count: 2`.
  - 1 shared upcoming event ⇒ `sharedUpcomingEvent` (test only if v1 keeps this signal).
  - Same `aloeCrew` rank ⇒ `sharedRank`. Same `novice` rank ⇒ no signal.
  - Same city, different case + whitespace ⇒ `sharedCity`. Empty city ⇒ no signal.
  - Self-vs-self ⇒ `[]`.
  - Priority: events > rank > city when multiple apply (`array[0].kind`).
- `src/data/__tests__/prompts.test.ts` — new. Unique IDs, ru and en non-empty, prompts text length ≤ 80 (display sanity).
- `src/lib/__tests__/validators.test.ts` — extend `promptsSchema` cases (cap, dup IDs, HTML rejection, length cap).
- `src/components/profile/__tests__/PromptCard.test.tsx` — renders question + answer; unknown `promptId` renders `null`.
- `src/components/ui/__tests__/photo-carousel.test.tsx` — tap-zone advances/rewinds, dots reflect index, single-photo case shows no UI chrome.

### Manual

- Mobile devtools viewport: tap-zone + swipe gesture coexist (no accidental pass when tapping the right half).
- Settings → Photos: drag-reorder, save, refresh — order persists.
- Settings → Prompts: hit char limit, see counter turn red; pick same prompt in two slots — second `<Select>` no longer offers it; submit empty answer — Zod blocks.
- Profile detail: long Cyrillic answer (~200 chars) and emoji answer render without breaking layout.
- API-mode test against the dev backend: confirm `PUT /users/{id}` with the new fields persists across restart.

---

## Rollout

- No data migration. `PromptsJson` defaults to `null`; existing `Images` arrays untouched.
- No feature flag. The new UI is additive — users without prompts/extra photos see the same card as today.
- Mock-mode seed data updated so the dev experience exercises the new UI immediately.
- Both repos ship in a coordinated PR pair (`KnownPromptIds` set must match `PROMPT_CATALOG` IDs at deploy time).

---

## Open follow-ups (not in this spec)

- **A. Discovery & filtering** — next spec; will add filter sheet, server-side filter params on `GET /users`, name search.
- **B5. Profile-completeness meter** — add later; will reuse the new prompts/photos data.
- **TD.8.** Move both `profile-images` and `content-images` to private + SAS URLs. Independent track.
- Promote `PROMPT_CATALOG` to `appconfig` if/when admins need to edit prompts without a deploy.
