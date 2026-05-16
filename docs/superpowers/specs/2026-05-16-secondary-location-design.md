# Secondary Location — design spec

**Date:** 2026-05-16
**Scope:** Add an optional secondary `country` + `region` slot to user profiles. Both slots displayed inline in profile cards; search/filter matches users whose primary OR secondary slot satisfies the filter; common-ground match scans all four cross-slot pairings.
**Out of scope (explicit):** Migration of existing data (new columns default empty); more than 2 locations; time-based "currently in" toggles or schedules; distance / radius filtering (still MCF.7).
**Repos touched:** `aloevera-harmony-meet` (frontend), `lovecraft` (backend).
**Predecessor:** [`2026-05-15-country-region-location-design.md`](./2026-05-15-country-region-location-design.md) (the structured-location feature this builds on).

---

## Goal

Some fans split their time between two places — Moscow + Phuket, St. Petersburg + Berlin, etc. Today the structured-location feature forces them to pick one. The change:

- **Optional secondary slot** — parallel to primary; either empty or fully populated. Two flat fields (`secondaryCountry`, `secondaryRegion`).
- **Inline both-locations display** — profile card shows `🇷🇺 Москва · 🇹🇭 Пхукет` when secondary set, falls back to primary-only otherwise.
- **Boolean-OR filter** — Friends → Search filter (and `GET /api/v1/users?country=&region=`) returns a user when EITHER slot matches.
- **Cross-slot common-ground** — match signals fire on any of the four (viewer-slot × target-slot) pairings.

---

## Non-goals

- No data migration. `SecondaryCountry`/`SecondaryRegion` default empty for existing users.
- No support for 3+ locations. If product needs that later, switch to a `locations[]` JSON model — but YAGNI now.
- No "currently in" / seasonal scheduling. Both slots are static once set; user updates them manually.
- No filter weighting / "primary matches before secondary" sort. Fisher-Yates shuffle stays unchanged.
- No "Show me users matching via my secondary" toggle. Filter behavior is symmetric.

---

## Architecture summary

- Backend: two more optional columns on `UserEntity`; two more fields on `UserDto`; the existing `IUserService.GetUsersAsync(country?, region?)` predicate broadens to match on either slot.
- Frontend: new `<DualLocationPicker>` wrapper composes two existing `<CountryRegionPicker>` instances with collapse/expand for the secondary slot. `<LocationDisplay>` gains secondary props and renders `primary · secondary` inline. `commonGround.ts` checks all four slot pairings.
- All five form pages (Welcome, WelcomeTelegram, WelcomeGoogle, MiniAppEntry, SettingsPage) swap their single `<CountryRegionPicker>` for `<DualLocationPicker>`. `<SearchFilterSheet>` keeps a single `<CountryRegionPicker>` — the filter UI deliberately stays one slot.

---

## Backend changes (`lovecraft`)

### Storage entity

`Lovecraft.Backend/Storage/Entities/UserEntity.cs`:

```csharp
public string Country { get; set; } = string.Empty;
public string Region { get; set; } = string.Empty;
public string SecondaryCountry { get; set; } = string.Empty;
public string SecondaryRegion { get; set; } = string.Empty;
```

### Shared DTOs (`Lovecraft.Common/DTOs/Users/UserDto.cs`)

`UserDto` gains:

```csharp
public string SecondaryCountry { get; init; } = string.Empty;
public string SecondaryRegion { get; init; } = string.Empty;
```

`UpdateUserRequestDto` already uses `UserDto` as the request body (per the predecessor spec) — these fields surface automatically. If the four register-style DTOs (`RegisterRequestDto`, `TelegramRegisterRequestDto`, `TelegramMiniAppRegisterRequestDto`, `GoogleRegisterRequestDto`) need to carry the new fields too, add `string? SecondaryCountry` + `string? SecondaryRegion` next to their existing `Country?` + `Region?` properties.

### Validation (`UsersController.UpdateUser`)

Add the same checks the predecessor added for `Country`/`Region`, mirrored for the secondary slot:

1. `secondaryCountry.Length > 56` → 400 `SECONDARY_COUNTRY_TOO_LONG`
2. `secondaryRegion.Length > 80` → 400 `SECONDARY_REGION_TOO_LONG`
3. `HtmlGuard.Reject(secondaryCountry)` → 400 `HTML_NOT_ALLOWED`
4. `HtmlGuard.Reject(secondaryRegion)` → 400 `HTML_NOT_ALLOWED`

(Distinct error codes for length so the frontend can route inline errors to the right field. HTML check shares the existing code — UI just surfaces "HTML not allowed" near the offending field.)

### Filtering (`IUserService` + `UsersController`)

Signature unchanged:

```csharp
Task<List<UserDto>> GetUsersAsync(int skip, int take, string? country = null, string? region = null);
```

`AzureUserService.GetUsersAsync` predicate broadens. Replace the existing `.Where(e => string.Equals(e.Country, country, ...))` with:

```csharp
if (!string.IsNullOrWhiteSpace(country) && !string.IsNullOrWhiteSpace(region))
{
    // Pair-wise match within a single slot — no cross-slot mixing.
    all = all.Where(e =>
        (string.Equals(e.Country, country, StringComparison.OrdinalIgnoreCase) &&
         string.Equals(e.Region,  region,  StringComparison.OrdinalIgnoreCase)) ||
        (string.Equals(e.SecondaryCountry, country, StringComparison.OrdinalIgnoreCase) &&
         string.Equals(e.SecondaryRegion,  region,  StringComparison.OrdinalIgnoreCase))
    ).ToList();
}
else if (!string.IsNullOrWhiteSpace(country))
{
    all = all.Where(e =>
        string.Equals(e.Country, country, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(e.SecondaryCountry, country, StringComparison.OrdinalIgnoreCase)
    ).ToList();
}
else if (!string.IsNullOrWhiteSpace(region))
{
    all = all.Where(e =>
        string.Equals(e.Region, region, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(e.SecondaryRegion, region, StringComparison.OrdinalIgnoreCase)
    ).ToList();
}
```

Same pattern in `MockUserService.GetUsersAsync`.

Pair-wise match: when both `country` and `region` are supplied, a user matches only when the same slot has both. `country=RU, region=Москва` does NOT match a user with `country=RU, secondaryRegion=Москва`.

### Auth provisioning

`AzureAuthService` / `MockAuthService` register paths: where `Country` / `Region` are currently written from request DTO, also write `SecondaryCountry` / `SecondaryRegion`:

```csharp
Country = request.Country ?? string.Empty,
Region = request.Region ?? string.Empty,
SecondaryCountry = request.SecondaryCountry ?? string.Empty,
SecondaryRegion = request.SecondaryRegion ?? string.Empty,
```

### Mock data + seeder

Pick 2 existing mock users (one RU, one non-RU) and give them a secondary location so the filter behavior is testable in mock mode:

- `mock-user-1` (Анна): `secondaryCountry: 'TH', secondaryRegion: 'Пхукет'`
- `mock-user-us` (Sarah): `secondaryCountry: 'RU', secondaryRegion: 'Москва'` — useful: ensures Sarah shows up to a Moscow searcher despite primary being California

Update both `MockDataStore.cs` and `Lovecraft.Tools.Seeder/Program.cs`.

### Tests

Extend `UsersControllerUpdateTests`:
- `UpdateUser_AcceptsSecondaryCountryAndRegion`
- `UpdateUser_RejectsSecondaryCountryWithHtml` → `HTML_NOT_ALLOWED`
- `UpdateUser_RejectsSecondaryRegionWithHtml` → `HTML_NOT_ALLOWED`
- `UpdateUser_RejectsSecondaryCountryTooLong` (57 chars) → `SECONDARY_COUNTRY_TOO_LONG`
- `UpdateUser_RejectsSecondaryRegionTooLong` (81 chars) → `SECONDARY_REGION_TOO_LONG`

Extend `AzureUserServiceFilterTests`:
- `GetUsersAsync_MatchesUserViaSecondaryCountry` — user with primary US + secondary RU is returned by `country=RU` filter
- `GetUsersAsync_MatchesUserViaSecondaryCountryAndRegion` — user with primary US + secondary `(RU, Москва)` is returned by `country=RU, region=Москва`
- `GetUsersAsync_DoesNotCrossSlotMix` — user with primary `(RU, anything)` + secondary `(US, Москва)` is NOT returned by `country=RU, region=Москва` (only same-slot pairs match)

---

## Frontend changes (`aloevera-harmony-meet`)

### Type + validators

`src/types/user.ts` — `User` interface gains:

```typescript
secondaryCountry?: string;
secondaryRegion?: string;
```

(Optional. Empty = not set. Same shape as `country`/`region`.)

`src/lib/validators.ts` — `registerSchema`, `profileEditSchema`, `telegramRegisterSchema` each gain:

```typescript
secondaryCountry: z.string().max(56, 'Secondary country must be 56 characters or less').optional(),
secondaryRegion: z.string().max(80, 'Secondary region must be 80 characters or less').optional(),
```

(Both `.optional()` because the secondary slot is fully optional.)

### `<DualLocationPicker>` (new)

`src/components/ui/dual-location-picker.tsx`:

```typescript
interface Props {
  country: string;
  region: string;
  secondaryCountry: string;
  secondaryRegion: string;
  onChange: (next: {
    country: string;
    region: string;
    secondaryCountry: string;
    secondaryRegion: string;
  }) => void;
  required?: boolean;
  className?: string;
}
```

Internals:

```tsx
function DualLocationPicker({ country, region, secondaryCountry, secondaryRegion, onChange, required, className }: Props) {
  const { t } = useLanguage();
  const hasSecondary = Boolean(secondaryCountry || secondaryRegion);
  const [expanded, setExpanded] = useState(hasSecondary);

  // sync expanded state if props change externally (e.g. form reset)
  useEffect(() => { if (hasSecondary) setExpanded(true); }, [hasSecondary]);

  const updatePrimary = (next: { country: string; region: string }) =>
    onChange({ ...next, secondaryCountry, secondaryRegion });

  const updateSecondary = (next: { country: string; region: string }) =>
    onChange({ country, region, secondaryCountry: next.country, secondaryRegion: next.region });

  const removeSecondary = () => {
    onChange({ country, region, secondaryCountry: '', secondaryRegion: '' });
    setExpanded(false);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <CountryRegionPicker
        country={country}
        region={region}
        onChange={updatePrimary}
        required={required}
      />
      {expanded ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('location.secondary')}</span>
            <Button variant="ghost" size="sm" onClick={removeSecondary}>
              ✕ {t('location.removeSecond')}
            </Button>
          </div>
          <CountryRegionPicker
            country={secondaryCountry}
            region={secondaryRegion}
            onChange={updateSecondary}
            aria-label={t('location.secondary')}
          />
        </div>
      ) : (
        <Button variant="link" size="sm" className="self-start px-0" onClick={() => setExpanded(true)}>
          + {t('location.addSecond')}
        </Button>
      )}
    </div>
  );
}
```

`<CountryRegionPicker>` stays unchanged — `<SearchFilterSheet>` continues using a single picker (we deliberately don't filter by secondary on the filter UI side; the OR-match happens on the backend).

### `<LocationDisplay>` extension

Gains two optional props:

```typescript
interface Props {
  country?: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  location?: string;     // legacy fallback
  className?: string;
}
```

Render behavior:

1. Build a primary fragment using existing rules (ISO → flag + region/name; custom → 📍 + text; legacy → italic).
2. If `secondaryCountry || secondaryRegion`, build a secondary fragment using the same rules.
3. Join with ` · ` separator.

Implementation:

```tsx
export function LocationDisplay({ country, region, secondaryCountry, secondaryRegion, location, className }: Props) {
  const primary = renderSlot(country, region);
  const secondary = renderSlot(secondaryCountry, secondaryRegion);

  if (!primary && !secondary && location) {
    return <span className={cn('text-muted-foreground italic', className)}>{location}</span>;
  }
  if (!primary && !secondary) return null;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {primary}
      {primary && secondary && <span aria-hidden> · </span>}
      {secondary}
    </span>
  );
}

function renderSlot(country?: string, region?: string): React.ReactNode { /* existing branch logic, returns null when slot is empty */ }
```

### Form rewiring

All five form pages (Welcome.tsx, WelcomeTelegram.tsx, WelcomeGoogle.tsx, MiniAppEntry.tsx, SettingsPage.tsx) swap their single `<CountryRegionPicker>` Controller for `<DualLocationPicker>`. The Controller now drives 4 form fields:

```tsx
<Controller
  control={form.control}
  name="country"
  render={({ field }) => (
    <DualLocationPicker
      country={field.value ?? ''}
      region={form.watch('region') ?? ''}
      secondaryCountry={form.watch('secondaryCountry') ?? ''}
      secondaryRegion={form.watch('secondaryRegion') ?? ''}
      onChange={({ country, region, secondaryCountry, secondaryRegion }) => {
        form.setValue('country', country, { shouldValidate: true });
        form.setValue('region', region, { shouldValidate: true });
        form.setValue('secondaryCountry', secondaryCountry, { shouldValidate: true });
        form.setValue('secondaryRegion', secondaryRegion, { shouldValidate: true });
      }}
    />
  )}
/>
```

`useForm.defaultValues` (or `reset`) updated to include `secondaryCountry: ''` + `secondaryRegion: ''`.

Inline error rendering added for the two new fields next to the existing country/region error spots.

### Display rewiring

Every `<LocationDisplay>` call site passes the secondary props through:

```tsx
<LocationDisplay
  country={user.country}
  region={user.region}
  secondaryCountry={user.secondaryCountry}
  secondaryRegion={user.secondaryRegion}
  location={user.location}
/>
```

Touched in `Friends.tsx` (swipe card, UserCard, deck render) and `SettingsPage.tsx` (header view + non-editing edit branch).

### `usersApi.ts` round-trip

`mapUserFromApi` and `mapUserToApi` both add `secondaryCountry` + `secondaryRegion` next to the existing `country`/`region` round-trip. `getUsers` signature unchanged — filter args still `{ skip, take, country, region }` (backend handles the OR-match).

Mock-mode filter inside `usersApi.getUsers` mirrors backend OR-match:

```typescript
if (country && region) {
  list = list.filter(u =>
    (u.country?.toLowerCase() === country.toLowerCase() && u.region?.toLowerCase() === region.toLowerCase()) ||
    (u.secondaryCountry?.toLowerCase() === country.toLowerCase() && u.secondaryRegion?.toLowerCase() === region.toLowerCase())
  );
} else if (country) {
  list = list.filter(u =>
    u.country?.toLowerCase() === country.toLowerCase() ||
    u.secondaryCountry?.toLowerCase() === country.toLowerCase()
  );
} else if (region) {
  list = list.filter(u =>
    u.region?.toLowerCase() === region.toLowerCase() ||
    u.secondaryRegion?.toLowerCase() === region.toLowerCase()
  );
}
```

### `authApi.ts` register payloads

Every register-style method (`register`, `telegramRegister`, `miniAppRegister`, `googleRegister`) request type gains `secondaryCountry?: string` + `secondaryRegion?: string`. Since each method passes `data` straight to `apiClient.post`, no body-literal edits — interface change is sufficient.

### `commonGround.ts` — 4-way overlap

Replace the current 2-branch logic with all four pairings, picking the strongest match:

```typescript
const viewerSlots = [
  { country: viewer.country, region: viewer.region },
  { country: viewer.secondaryCountry, region: viewer.secondaryRegion },
].filter(s => s.country);

const targetSlots = [
  { country: target.country, region: target.region },
  { country: target.secondaryCountry, region: target.secondaryRegion },
].filter(s => s.country);

// Region-equal beats country-equal. First region match wins.
let bestKind: 'sharedCity' | 'sharedCountry' | null = null;
let best: { country: string; region: string } | null = null;

for (const v of viewerSlots) {
  for (const t of targetSlots) {
    if (v.country === t.country && v.region && v.region === t.region) {
      bestKind = 'sharedCity';
      best = v;
      break;  // strongest match — no need to keep searching
    }
    if (v.country === t.country && bestKind === null) {
      bestKind = 'sharedCountry';
      best = v;
    }
  }
  if (bestKind === 'sharedCity') break;
}

if (bestKind === 'sharedCity') matches.push({ kind: 'sharedCity', city: best!.region });
else if (bestKind === 'sharedCountry') matches.push({ kind: 'sharedCountry', country: COUNTRY_BY_CODE[best!.country]?.nameRu ?? best!.country });
```

(One signal emitted, strongest wins — preserves existing semantics.)

### Mock data

`mockUsers.ts` + `mockProfiles.ts`:
- Анна gets `secondaryCountry: 'TH', secondaryRegion: 'Пхукет'`
- Sarah (mock-user-us) gets `secondaryCountry: 'RU', secondaryRegion: 'Москва'`

So a Moscow filter returns Sarah (via her secondary RU/Москва) alongside RU primaries.

### i18n

Add to both `ru` and `en` blocks:

```
location.addSecond     "+ Add second location" / "+ Добавить вторую локацию"
location.removeSecond  "Remove" / "Убрать"
location.secondary     "Secondary location" / "Дополнительная локация"
```

### Tests

- `src/lib/__tests__/validators.test.ts`: secondary country/region accepted; rejected when over length; absence allowed.
- `src/lib/__tests__/commonGround.test.ts`:
  - `sharedCity matches when viewer.secondary equals target.primary`
  - `sharedCity matches when viewer.primary equals target.secondary`
  - `sharedCity beats sharedCountry when both pairings exist` (e.g., viewer primary same country as target secondary, viewer secondary same city as target primary — picks sharedCity)
- New `src/components/ui/__tests__/dual-location-picker.test.tsx` smoke test:
  - Renders with no secondary → shows "Add second location" link
  - Clicking link expands and shows second picker
  - Setting secondary → onChange emits all 4 fields
  - "Remove" collapses + clears secondary

---

## Migration & rollout

- **Schema:** Azure Tables are schemaless — no migration. Existing `users` rows get empty `SecondaryCountry`/`SecondaryRegion` columns.
- **Display:** `<LocationDisplay>` falls back to primary-only when secondary empty (existing behavior unchanged).
- **Filter:** existing primary-only users continue to match the same way; users who add a secondary now show up to more searches.

---

## Error handling

| Code | Meaning | Where |
|---|---|---|
| `SECONDARY_COUNTRY_TOO_LONG` | `secondaryCountry.Length > 56` | `UsersController.UpdateUser`, register paths |
| `SECONDARY_REGION_TOO_LONG` | `secondaryRegion.Length > 80` | same |
| `HTML_NOT_ALLOWED` | HTML in secondary fields | `HtmlGuard` (existing code) |

Frontend: inline form errors via `form.setError('secondaryCountry', …)` / `form.setError('secondaryRegion', …)`. Generic failures fall through to `showApiError`.

---

## Performance

- Filter predicate is now 2× as wide (matches either slot) but still in-memory over `UserCache` — adds ~zero measurable cost.
- Two additional string columns per user row in Azure Tables: ~80 bytes/user. Negligible.
- DualLocationPicker doubles cmdk popover instances when expanded, but only when the user explicitly opens the secondary section.

---

## File map

### Backend
| File | Change |
|---|---|
| `Lovecraft.Backend/Storage/Entities/UserEntity.cs` | + `SecondaryCountry`, `SecondaryRegion` |
| `Lovecraft.Common/DTOs/Users/UserDto.cs` | + `SecondaryCountry`, `SecondaryRegion` |
| `Lovecraft.Common/DTOs/Auth/AuthDtos.cs` | + `SecondaryCountry?`, `SecondaryRegion?` on 4 register-request DTOs |
| `Lovecraft.Backend/Controllers/V1/UsersController.cs` | + length + HtmlGuard checks for secondary fields |
| `Lovecraft.Backend/Services/Azure/AzureUserService.cs` | OR-match filter; write secondary in `UpdateUserAsync`; emit secondary in `ToDto` |
| `Lovecraft.Backend/Services/MockUserService.cs` | same |
| `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` | write secondary on every register path |
| `Lovecraft.Backend/Services/MockAuthService.cs` | same |
| `Lovecraft.Backend/MockData/MockDataStore.cs` | give 2 mocks secondary locations |
| `Lovecraft.Tools.Seeder/Program.cs` | propagate secondary fields |
| `Lovecraft.UnitTests/UsersControllerUpdateTests.cs` | + 5 cases |
| `Lovecraft.UnitTests/AzureUserServiceFilterTests.cs` | + 3 OR-match cases |

### Frontend
| File | Change |
|---|---|
| `src/components/ui/dual-location-picker.tsx` | new wrapper |
| `src/components/ui/__tests__/dual-location-picker.test.tsx` | new smoke test |
| `src/components/ui/location-display.tsx` | + secondary props, inline separator render |
| `src/types/user.ts` | + `secondaryCountry?`, `secondaryRegion?` on `User` |
| `src/lib/validators.ts` | + secondary fields in 3 schemas |
| `src/lib/__tests__/validators.test.ts` | + cases |
| `src/lib/commonGround.ts` | 4-way slot scan |
| `src/lib/__tests__/commonGround.test.ts` | + cross-slot cases |
| `src/services/api/usersApi.ts` | round-trip secondary fields; mock-mode OR filter |
| `src/services/api/authApi.ts` | register-request types gain secondary fields |
| `src/pages/Welcome.tsx` | swap Picker → DualLocationPicker; defaults + errors |
| `src/pages/WelcomeTelegram.tsx` | same |
| `src/pages/WelcomeGoogle.tsx` | same |
| `src/pages/MiniAppEntry.tsx` | same |
| `src/pages/SettingsPage.tsx` | DualLocationPicker in edit; LocationDisplay with secondary in header |
| `src/pages/Friends.tsx` | LocationDisplay calls pass secondary props (3 spots) |
| `src/contexts/LanguageContext.tsx` | + 3 i18n keys |
| `src/data/mockUsers.ts` | + secondary on Анна (TH/Пхукет); add secondary to existing mock-user-us (RU/Москва) |
| `src/data/mockProfiles.ts` | mirror mockUsers |

### Docs
| File | Change |
|---|---|
| `aloevera-harmony-meet/docs/FEATURES.md` | mention secondary location in profile + filter behavior |
| `aloevera-harmony-meet/docs/ARCHITECTURE.md` | add `secondaryCountry`/`secondaryRegion` to User type block; mention `<DualLocationPicker>` |
| `aloevera-harmony-meet/AGENTS.md` | add `<DualLocationPicker>` to custom-components list |
| `lovecraft/Lovecraft/docs/AZURE_STORAGE.md` | add `SecondaryCountry`, `SecondaryRegion` to users notable-fields list |
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | one-line entry |

---

## Open questions deliberately deferred

- **More than 2 locations?** YAGNI. If product needs it later, migrate to `locations[]` JSON.
- **Time-based "currently in" toggle?** Could be valuable for snowbirds but adds significant UX + data complexity. Defer until requested.
- **Reorder primary ↔ secondary?** Not exposed in UI v1 — user must clear and re-enter. If common, add a swap button later.
- **Search filter against secondary explicitly?** The filter UI shows one slot; backend OR-matches both. If user feedback demands separate "primary only" / "include secondary" toggles, revisit.
