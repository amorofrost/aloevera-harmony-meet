# Country & Region location — design spec

**Date:** 2026-05-15
**Scope:** Replace the freeform `location` field on user accounts with a structured `country` + `region` pair, surface a flag in the profile header, and add country/region filtering to the user search API and Friends → Search UI.
**Out of scope (explicit):** Auto-parsing legacy `location` strings; distance/radius matching (still mock; the rest of MCF.7 stays open); per-country region completeness beyond a curated priority list; map view; per-region analytics; admin UI for editing the country/region tables.
**Repos touched:** `aloevera-harmony-meet` (frontend), `lovecraft` (backend).
**Issues:** Partially resolves MCF.7 (Advanced User Search & Filtering — country + region slice).

---

## Goal

Today `User.location` is a single free-text string ("Москва", "St. Petersburg, Russia", "Earth"). It cannot be filtered, aggregated, or rendered as anything richer than the raw text. The change:

- **Structured location** — store country and region separately so the swipe deck can show a flag and the search can filter by country (or country + region).
- **Drop-down + custom fallback** — every user picks from a curated dropdown (full ISO list for country; curated regional subdivisions for the priority countries the platform actually targets) but can always type a custom value when the dropdown doesn't fit.
- **Search filter** — `GET /api/v1/users` accepts `?country=&region=`; Friends → Search gains a filter sheet that maps onto those params.

Existing `location` strings are preserved as a read-only fallback so no user loses data on the day this ships.

---

## Non-goals

- No automatic migration of existing `location` strings into `country`/`region`. Users update via Settings on next visit; until then the legacy string keeps rendering.
- No distance / radius / "within N km" filtering — the existing `UserPreferences.maxDistance` field remains unwired (still part of MCF.7).
- No region completeness for every country. Curated lists exist only for the priority 15 (post-Soviet sphere + obvious diaspora). Other countries fall back to free-text region.
- No admin UI for editing the country/region tables. Both are static TS constants in v1.
- No new SignalR events. No new tables. No new blob containers.

---

## Architecture summary

- Two new optional columns on `UserEntity` (`Country`, `Region`). `Location` retained as legacy fallback (read-only after this ships).
- `UpdateUserRequestDto` gains `country` + `region`. Existing `location` field on the DTO becomes deprecated input — accepted but ignored on write going forward (read returns whatever's stored).
- `IUserService.GetUsersAsync` gains optional `country` + `region` filter params. `UsersController.GetUsers` exposes them as query parameters.
- New frontend modules: `src/data/countries.ts` (~250 ISO entries), `src/data/regions.ts` (curated subdivisions for ~15 priority countries), `src/lib/countryFlag.ts` (ISO-2 → flag emoji), `src/components/ui/country-region-picker.tsx`, `src/components/ui/location-display.tsx`, `src/components/SearchFilterSheet.tsx`.
- All five places that currently render or edit `location` switch to the new components.

---

## Backend changes (`lovecraft`)

### Storage entity

`Lovecraft.Backend/Storage/Entities/UserEntity.cs`:

- Add `public string Country { get; set; } = string.Empty;` — either an ISO-3166-1 alpha-2 uppercase code (`"RU"`, `"US"`) or a free-text custom label, or empty.
- Add `public string Region { get; set; } = string.Empty;` — free text up to 80 chars, or empty.
- Keep `Location` (legacy). Never written by new write paths; read-only in `ToDto`.

### Shared DTOs (`Lovecraft.Common/DTOs/Users/UserDto.cs`)

`UserDto` gains:

```csharp
public string Country { get; init; } = string.Empty;
public string Region { get; init; } = string.Empty;
```

`UpdateUserRequestDto` gains:

```csharp
public string? Country { get; init; }
public string? Region { get; init; }
```

`null` ⇒ untouched. Non-null (including empty string) ⇒ replace.

`UpdateUserRequestDto.Location` stays in the DTO so older clients don't 400 on send, but `UsersController.UpdateUser` ignores it on write.

### Validation (`UsersController.UpdateUser`)

In addition to existing checks, before the existing HtmlGuard pass:

1. `country` non-null and `country.Length > 56` → 400 `COUNTRY_TOO_LONG` (56 = longest official short-form country name; covers custom values too).
2. `region` non-null and `region.Length > 80` → 400 `REGION_TOO_LONG`.
3. `HtmlGuard.Reject(country)` and `HtmlGuard.Reject(region)` → 400 `HTML_NOT_ALLOWED` (existing pattern).

No server-side validation that `country` is a real ISO-2 code — the client is the source of the dropdown, and custom-text is intentionally allowed. The two-character-uppercase heuristic is a render-time concern only.

### Filtering (`IUserService` + `UsersController`)

`Lovecraft.Backend/Services/IUserService.cs`:

```csharp
Task<PagedResult<UserDto>> GetUsersAsync(
    int skip,
    int take,
    string? country = null,
    string? region = null);
```

**`AzureUserService.GetUsersAsync`**: filter the existing `UserCache` snapshot in-memory before the Fisher-Yates shuffle. Country comparison is case-insensitive ordinal (`StringComparer.OrdinalIgnoreCase`) to handle ISO codes coming in lowercase from the URL. Region likewise. Empty filter param ⇒ no-op. Zero new round-trips because the cache snapshot is already in process.

**`MockUserService.GetUsersAsync`**: same `.Where` chain over the in-memory list.

**`UsersController.GetUsers`**:

```csharp
[HttpGet]
public async Task<IActionResult> GetUsers(
    [FromQuery] int skip = 0,
    [FromQuery] int take = 20,
    [FromQuery] string? country = null,
    [FromQuery] string? region = null)
```

Pass through to the service. Filter values are echoed back in the standard `ApiResponse<PagedResult<UserDto>>` envelope.

### Auth provisioning

`AzureAuthService.TelegramLoginAsync` and `MockAuthService` Telegram register paths currently set `Location = "Telegram"` as a placeholder. Drop that — leave `Country` and `Region` empty so the user is prompted on the next Settings or Mini App wizard pass. The legacy `Location` field also stays empty for new Telegram accounts (no value to fall back to anyway).

Google + email registration paths already collect `location` from the request body. They switch to writing `Country` + `Region` from the new request fields; `Location` is no longer written for new accounts.

### Mock data + seeder

- `MockDataStore.cs`: every seeded `UserEntity` gets `Country` (ISO-2) + `Region` populated to match the existing `Location` string where it's clear (Russian cities → `"RU"` + region name).
- `Lovecraft.Tools.Seeder/Program.cs`: same — seed entities include `Country` + `Region`.

### Tests (`Lovecraft.UnitTests`)

- Extend `UsersControllerUpdateTests`:
  - `UpdateUser_AcceptsCountryAndRegion`
  - `UpdateUser_RejectsCountryWithHtml` → 400 `HTML_NOT_ALLOWED`
  - `UpdateUser_RejectsRegionWithHtml` → 400 `HTML_NOT_ALLOWED`
  - `UpdateUser_RejectsCountryTooLong` (57 chars) → 400 `COUNTRY_TOO_LONG`
  - `UpdateUser_RejectsRegionTooLong` (81 chars) → 400 `REGION_TOO_LONG`
- New `AzureUserServiceTests`:
  - `GetUsersAsync_FiltersByCountry` (3 RU users, 2 US users, filter `country=RU` → 3)
  - `GetUsersAsync_FiltersByCountryAndRegion`
  - `GetUsersAsync_CountryFilterIsCaseInsensitive` (`country=ru` matches `Country="RU"`)
  - `GetUsersAsync_EmptyFilter_ReturnsAll`

---

## Frontend changes (`aloevera-harmony-meet`)

### Static data

**`src/data/countries.ts`**

```typescript
export interface Country {
  code: string;       // ISO-3166-1 alpha-2, uppercase
  nameRu: string;
  nameEn: string;
}

export const COUNTRIES: Country[] = [
  { code: 'RU', nameRu: 'Россия',  nameEn: 'Russia' },
  { code: 'BY', nameRu: 'Беларусь', nameEn: 'Belarus' },
  // ~250 entries, alphabetical by nameEn
];

export const COUNTRY_BY_CODE: Record<string, Country> =
  Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
```

**`src/data/regions.ts`**

```typescript
export interface Region {
  name: string;        // canonical display name in the country's primary language
  nameEn?: string;     // optional English name when materially different
}

export const REGIONS_BY_COUNTRY: Record<string, Region[]> = {
  RU: [
    { name: 'Москва' },
    { name: 'Санкт-Петербург' },
    { name: 'Московская область' },
    // … 85 federal subjects
  ],
  BY: [...],
  UA: [...],
  KZ: [...], KG: [...], UZ: [...], AM: [...], GE: [...], AZ: [...], MD: [...],
  EE: [...], LV: [...], LT: [...],
  US: [{ name: 'California', nameEn: 'California' }, /* 50 states */],
  DE: [...],
  IL: [...],
};

export function regionsFor(countryCode: string): Region[] | null {
  return REGIONS_BY_COUNTRY[countryCode] ?? null;
}
```

**`src/lib/countryFlag.ts`**

```typescript
const isIsoCode = (s: string) =>
  /^[A-Z]{2}$/.test(s);

export function flagEmoji(country: string): string {
  if (!isIsoCode(country)) return '';
  const A = 0x1F1E6;
  return String.fromCodePoint(
    A + country.charCodeAt(0) - 65,
    A + country.charCodeAt(1) - 65,
  );
}

export const isCustomCountry = (country: string) =>
  country.length > 0 && !isIsoCode(country);
```

### `<CountryRegionPicker>` (new)

`src/components/ui/country-region-picker.tsx`

Props:

```typescript
interface Props {
  country: string;
  region: string;
  onChange: (next: { country: string; region: string }) => void;
  required?: boolean;     // when true, country is required; region remains optional
  className?: string;
}
```

Implementation:

- Two `Popover` + `Command` (cmdk) comboboxes stacked vertically. cmdk is already in `package.json` (listed as unused under UX.6).
- Country combobox: searchable list of `COUNTRIES` rendered as `<flagEmoji> <localised name>`. Sticky footer item "Use custom value…" swaps the popover body to a single text input + Save button. Saving sets `country` to the typed string (custom value).
- Region combobox: disabled until `country` is non-empty.
  - If `regionsFor(country)` returns a list → searchable combobox + the same "Use custom value…" footer.
  - If `regionsFor(country)` returns `null` → render a plain `<Input>` instead of a combobox.
- Clearing the country resets the region to empty (consistent state).
- Inline error rendering uses the same pattern as other RHF inputs (`form.setError('country', …)`), but the picker itself is a controlled component so callers wire it up with `<Controller>`.

### `<LocationDisplay>` (new)

`src/components/ui/location-display.tsx`

Props:

```typescript
interface Props {
  country?: string;
  region?: string;
  location?: string;     // legacy fallback
  className?: string;
}
```

Render rules (in order — first match wins):

1. `country` is ISO-2 (matches `/^[A-Z]{2}$/` and exists in `COUNTRY_BY_CODE`):
   `🇷🇺 Москва` (region) or `🇷🇺 Россия` (no region — fall back to country name)
2. `country` is custom (non-ISO non-empty):
   `📍 Custom Country, Region` (no flag; `MapPin` lucide icon for parity)
3. `location` (legacy) non-empty:
   plain text in italic muted (`text-muted-foreground italic`) — visual hint that it's stale
4. None set: render `null`

### `<SearchFilterSheet>` (new)

`src/components/SearchFilterSheet.tsx`

shadcn `Sheet` (bottom side on mobile, right side on `md:` and up). Triggered by a `<Filter>` icon button added to the Friends → Search tab header.

Body:

- "Country" `Select` (using the same combobox primitive as the picker, but read-only — no custom-value option here; users filter on the canonical set).
- "Region" `Select` — visible only after country is picked, populated from `regionsFor(country)`. When country has no curated regions, hide the region filter and show a hint ("Region filter not available for this country").
- "Apply" + "Clear filters" buttons. Apply calls back into Friends.tsx with `{ country, region }`; Clear emits `{ country: '', region: '' }`.

When a filter is active, render a removable pill above the swipe deck: `🇷🇺 Россия · Москва ✕`. Tapping the ✕ clears just that part.

### Form rewiring

Replace the single `<Input name="location">` with `<Controller>` around `<CountryRegionPicker>` in:

- `src/pages/Welcome.tsx` (register form)
- `src/pages/WelcomeTelegram.tsx`
- `src/pages/WelcomeGoogle.tsx`
- `src/pages/MiniAppEntry.tsx` (inline registration wizard)
- `src/pages/SettingsPage.tsx` (profile edit)

`src/lib/validators.ts`:

- Drop `location` from `registerSchema`, `registerSchemaWithInvite`, `profileEditSchema`.
- Add `country: z.string().min(1, 'Country is required').max(56, 'Country too long')` and `region: z.string().max(80, 'Region too long').optional()` to the same three schemas.

### Display rewiring

Replace plain `{user.location}` renders with `<LocationDisplay country={user.country} region={user.region} location={user.location} />` in:

- `src/pages/Friends.tsx` — swipe card header + chat list peer line + likes-tab user cards
- `src/pages/SettingsPage.tsx` — profile header (view mode)
- `src/components/ui/swipe-card.tsx` — if it has its own location render

`src/lib/commonGround.ts`: the "оба из Москвы" branch currently compares `user.location === other.location`. Update to compare `(user.country, user.region)` tuples — same-region match wins highest, same-country match (different region) wins lower. Update `commonGround.test.ts` accordingly.

### Search filter wiring

`src/pages/Friends.tsx`:

- New state: `const [filter, setFilter] = useState<{ country: string; region: string }>({ country: '', region: '' });`
- The existing `useEffect` that loads the swipe deck via `usersApi.getUsers(...)` adds `filter.country` and `filter.region` to the dependency array and to the query string.
- Header gets a `<Filter>` icon button that opens `<SearchFilterSheet>`.
- Active-filter pill rendered above the deck.

`src/services/api/usersApi.ts`:

```typescript
getUsers(opts?: { skip?: number; take?: number; country?: string; region?: string }): Promise<ApiResponse<PagedResult<User>>>
```

Mock branch: filter `mockUsers` in-memory by `country` / `region` before slicing. API branch: append `?country=&region=` (only when non-empty) to the `GET /users` URL.

### Mock data

Update `src/data/mockUsers.ts`, `src/data/mockProfiles.ts`, `src/data/mockCurrentUser.ts`, `src/data/mockChats.ts`:

- Existing four mock users (Анна, Дмитрий, Елена, Мария) keep their `location` strings AND get `country: 'RU'` + `region` (`"Москва"`, etc.).
- Add 2-3 mock users from other countries (e.g. `country: 'BY' / 'UA' / 'US'`) so the search filter has something to filter against in mock mode.

### i18n

Add to both `ru` and `en` blocks of `src/contexts/LanguageContext.tsx`:

```
location.country         "Country" / "Страна"
location.region          "Region" / "Регион"
location.useCustomValue  "Use custom value…" / "Указать своё значение…"
location.regionUnavailable "Region filter not available for this country" / "Фильтр по региону недоступен для этой страны"
search.filter            "Filter" / "Фильтр"
search.applyFilter       "Apply" / "Применить"
search.clearFilter       "Clear filters" / "Сбросить фильтры"
search.allCountries      "All countries" / "Все страны"
search.allRegions        "All regions" / "Все регионы"
```

### Tests

- `src/lib/__tests__/validators.test.ts`: add cases for the new `country` + `region` rules in all three affected schemas.
- New `src/components/ui/__tests__/country-region-picker.test.tsx`: smoke test (renders, picks an ISO country and emits change; switches to custom-value mode; region disabled until country picked).
- Update `src/lib/__tests__/commonGround.test.ts` for the new same-region/same-country logic.
- `src/services/api/usersApi.test.ts` (extend if exists, create if not): mock-mode filter applies country and region.

---

## Migration & rollout

- **Schema:** Azure Tables are schemaless — nothing to run. Existing `users` rows just have empty `Country`/`Region` columns until they're written.
- **Display fallback:** The first render rule in `<LocationDisplay>` covers ISO `Country`. The third covers legacy `Location`. So pre-migration users keep seeing their old string until they edit settings; post-migration users see the new flag-and-region rendering.
- **First-write trigger:** When a legacy user opens Settings the form is pre-populated with empty `country`/`region` (we deliberately do not auto-parse `location`). Submitting the form writes the new fields and the legacy `Location` becomes irrelevant for them. They can still see the old string in their own header until they save.
- **Telegram users:** New Telegram registrations no longer get the `"Telegram"` placeholder, so the Settings nag to set country/region applies to them too.

---

## Error handling

| Code | Meaning | Where |
|---|---|---|
| `COUNTRY_TOO_LONG` | `country.Length > 56` | `UsersController.UpdateUser`, register paths |
| `REGION_TOO_LONG` | `region.Length > 80` | same |
| `HTML_NOT_ALLOWED` | HTML in country or region | `HtmlGuard` (existing) |

Frontend handling: surface as inline form errors via `form.setError('country', …)` / `form.setError('region', …)`. Generic failures fall through to `showApiError`.

---

## Performance

- Country list is ~250 entries; renders inside a `cmdk` virtual list, no perf concern.
- Region list per country tops out at ~85 (Russia's federal subjects); same.
- Backend filter runs on the in-memory `UserCache` snapshot — adds an `O(n)` filter pass before the existing Fisher-Yates shuffle. With 10k cached users that's ~0.1 ms; nothing measurable.
- No new HTTP round-trips. No new Azure Storage round-trips.

---

## File map

### Backend
| File | Change |
|---|---|
| `Lovecraft.Backend/Storage/Entities/UserEntity.cs` | + `Country`, `Region` |
| `Lovecraft.Common/DTOs/Users/UserDto.cs` | + `Country`, `Region` on `UserDto`; + `Country?`, `Region?` on `UpdateUserRequestDto` |
| `Lovecraft.Backend/Controllers/V1/UsersController.cs` | accept + validate + HtmlGuard; pass filter params through `GetUsers` |
| `Lovecraft.Backend/Services/IUserService.cs` | `GetUsersAsync` gains `country`, `region` params |
| `Lovecraft.Backend/Services/Azure/AzureUserService.cs` | filter cache snapshot |
| `Lovecraft.Backend/Services/MockUserService.cs` | filter mock list |
| `Lovecraft.Backend/Services/Azure/AzureAuthService.cs` | drop `Location = "Telegram"`; write `Country`/`Region` from register requests |
| `Lovecraft.Backend/Services/MockAuthService.cs` | same |
| `Lovecraft.Backend/MockData/MockDataStore.cs` | seed `Country`/`Region` |
| `Lovecraft.Tools.Seeder/Program.cs` | seed `Country`/`Region` |
| `Lovecraft.UnitTests/UsersControllerUpdateTests.cs` | + 5 cases |
| `Lovecraft.UnitTests/AzureUserServiceTests.cs` | + filter tests |

### Frontend
| File | Change |
|---|---|
| `src/data/countries.ts` | new — ISO list |
| `src/data/regions.ts` | new — curated subdivisions |
| `src/lib/countryFlag.ts` | new — flag emoji + custom check |
| `src/components/ui/country-region-picker.tsx` | new |
| `src/components/ui/location-display.tsx` | new |
| `src/components/SearchFilterSheet.tsx` | new |
| `src/lib/validators.ts` | swap `location` for `country`+`region` in 3 schemas |
| `src/types/user.ts` | + `country`, `region` on `User`; keep `location` (now legacy/optional) so `<LocationDisplay>` can fall back |
| `src/services/api/usersApi.ts` | + filter args; `mapUserFromApi` reads new fields |
| `src/services/api/authApi.ts` | register payloads send `country`+`region` |
| `src/pages/Welcome.tsx` | swap input for picker |
| `src/pages/WelcomeTelegram.tsx` | same |
| `src/pages/WelcomeGoogle.tsx` | same |
| `src/pages/MiniAppEntry.tsx` | same |
| `src/pages/SettingsPage.tsx` | swap input for picker; swap header render for `<LocationDisplay>` |
| `src/pages/Friends.tsx` | filter state + `<SearchFilterSheet>` + active-filter pill; swap renders for `<LocationDisplay>` |
| `src/lib/commonGround.ts` | (country, region) tuple match instead of string compare |
| `src/contexts/LanguageContext.tsx` | + i18n keys |
| `src/data/mockUsers.ts` | + `country`/`region`; add 2-3 non-RU mocks |
| `src/data/mockProfiles.ts` | + `country`/`region` |
| `src/data/mockCurrentUser.ts` | + `country`/`region` |
| `src/data/mockChats.ts` | + `country`/`region` (peer info) |
| `src/lib/__tests__/validators.test.ts` | + cases |
| `src/lib/__tests__/commonGround.test.ts` | update for tuple match |
| `src/components/ui/__tests__/country-region-picker.test.tsx` | new smoke test |

### Docs
| File | Change |
|---|---|
| `aloevera-harmony-meet/docs/FEATURES.md` | reword "name, age, location" → "name, age, country/region"; mention search filter sheet |
| `aloevera-harmony-meet/docs/ARCHITECTURE.md` | add `country` / `region` to the User type block |
| `aloevera-harmony-meet/docs/ISSUES.md` | mark MCF.7 as "partial — country/region shipped; age/gender filters + distance still open" |
| `aloevera-harmony-meet/AGENTS.md` | add `<CountryRegionPicker>` and `<LocationDisplay>` to the custom-components list |
| `lovecraft/Lovecraft/docs/AZURE_STORAGE.md` | add `Country`, `Region` to the `users` table notable-fields list |
| `lovecraft/Lovecraft/docs/IMPLEMENTATION_SUMMARY.md` | one-line entry under "Done since the original plan" |

---

## Open questions deliberately deferred

- **Auto-parse legacy strings?** Decided no — the heuristic ("Moscow, Russia" → RU/Moscow) is messy and the cost of leaving stale strings showing in italic is small.
- **Distance / radius matching?** Stays in MCF.7 as the next slice — this spec deliberately doesn't touch `UserPreferences.maxDistance`.
- **Region completeness for the long tail?** Free-text only outside the priority 15. If a non-priority country becomes important, add an entry to `regions.ts` — no schema change.
- **Country flags via SVG sprite instead of emoji?** Emoji works on every modern browser including Telegram WebView. If Windows-without-emoji-font reports come in, swap `flagEmoji` for `<img src="/flags/{code}.svg">` — render boundary is one function.
