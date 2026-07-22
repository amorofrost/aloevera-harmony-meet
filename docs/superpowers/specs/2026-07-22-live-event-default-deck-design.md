# Live-event default deck — design

**Date:** 2026-07-22
**Status:** Approved (design) — amended 2026-07-22 (see Update below)
**Repo:** `aloevera-harmony-meet` (frontend only — no backend changes)

## Update (2026-07-22): per-mount re-apply, dropping the once-per-app-load guard

**Symptom:** in the Telegram Mini App (opened from `/tg`), the initial deck showed
the random list, not the live-event deck; a Mini App refresh then showed the correct
event deck. Browser fresh login showed the correct deck. Both paths call the identical
`navigateAfterAuth → /friends` and the identical `getCurrentUser` endpoints, so the
viewer's `eventsAttended` data is the same in both — the difference is client-side.

**Root cause:** the Telegram WebView **remounts** the `Friends` page after the initial
`/tg → /friends` navigation (theme/viewport re-renders). The original design applied the
filter "once per app load" via a **module-level** `sessionAutoFilterDone` flag. That flag
survived the remount, but the component's `filter` state reset to `EMPTY_FILTERS` on the
remount — so the remount saw the guard already `true`, skipped re-applying, and the deck
fell back to the random list until a full reload reset the module.

**Fix:** drop the module-level `sessionAutoFilterDone` guard entirely. The auto-apply is
now gated only by the per-mount `autoFilterResolved` state, so it re-evaluates and
re-applies the live-event filter on **every mount** (including Telegram remounts),
guaranteeing the event deck. Within a single mount the user can still clear the chip and
browse the random deck (`autoFilterResolved` prevents re-apply until the next mount).

This supersedes decision #3 below ("once per app load"). Trade-off accepted by the product
owner: if the user clears the chip and the page then remounts, the event filter snaps back
— which is the intended "always show the event deck while it's live" behavior.

## Problem

Every entry point into the app (Telegram Mini App `/tg`, browser open with an
existing session, and post-login navigation) lands the user on `/friends` with
the **Search** tab showing a random swipe deck.

When a user is attending an event that is **currently happening** (by dates), the
most useful default is a deck of *other attendees of that same event*, not a
random deck. A filtered deck by `eventId` already exists (filter sheet + chip +
`?eventId=` deep link). This feature makes that filtered deck the **default**
on app open while the event is live.

## Goal

On the initial app load, if the viewer attends a live event, seed the existing
`eventId` search filter with that event so the deck shows co-attendees. Reuse the
entire existing filter/deck pipeline. No backend work.

## Non-goals (YAGNI)

- No new banner / explanatory UI — the existing `📅 {title}` filter chip already
  communicates the active event filter and lets the user clear it.
- No backend endpoint or DTO changes.
- No changes to routing helpers (`authNavigation.ts`, `MiniAppEntry.tsx`) — all
  entry points already converge on `/friends`, so changing the deck's default
  state covers them all.
- Attendees only (matches the existing `eventId` filter); "interested" users are
  not included.

## Key decisions

1. **"Currently happening" definition** (`isEventLive`):
   - If the event has a valid `endDate`: live when `start ≤ now ≤ endDate`.
   - If it has no (or an invalid) `endDate`: live for the **whole local calendar
     day** of `start` — i.e. `now` and `start` fall on the same calendar day.
     A single-evening concert with no `endDate` is therefore "live" all day,
     including before its start time.
   - Missing/invalid `start` → not live.

2. **Multiple simultaneous live events:** pick the **first one found** in
   `viewer.eventsAttended` array order. The user can switch to any other attended
   event via the existing filter sheet.

3. **Dismissal / stickiness — "once per app load":**
   - Auto-apply runs only on the first `/friends` mount of an app load.
   - If the user clears the event chip, it stays cleared for the rest of that
     app session (navigating away from `/friends` and back does **not**
     re-apply).
   - On the next app load — a full page reload, a new tab, or a Telegram Mini
     App reopen (which reloads the webview) — it re-applies if the event is still
     live.

## Data availability

No fetching gymnastics needed: `viewer.eventsAttended` is already mapped via
`mapEventFromApi` and carries `date`, `endDate`, and `attendees`
(`src/services/api/usersApi.ts` → `mapEventFromApi` in `eventsApi.ts`). The
live-event decision is made entirely client-side from the already-loaded viewer.

The deck itself is loaded by the existing `filter.eventId` branch in `Friends.tsx`
(re-fetches the event via `eventsApi.getEventById` for fresh `attendees`, then
`usersApi.getUsersByIds`). We do not change that path — we only seed the filter.

## Design

### 1. Pure helper — `src/lib/liveEvent.ts`

Follows the existing pure-helper pattern (`commonGround.ts`, `acl.ts`,
`countryFlag.ts`). `now` is an injected parameter so the helper is deterministic
and unit-testable.

```ts
import type { Event } from '@/types/user';

/** Whole-local-calendar-day equality (ignores time of day). */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * True when `now` falls inside the event's live window.
 * - valid endDate:  start ≤ now ≤ endDate
 * - no/invalid endDate: same local calendar day as start
 */
export function isEventLive(
  event: { date: Date; endDate?: Date },
  now: Date,
): boolean {
  const start = event.date;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
  const end = event.endDate;
  if (end instanceof Date && !Number.isNaN(end.getTime())) {
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  }
  return isSameLocalDay(now, start);
}

/** First attended event (array order) that is currently live, else undefined. */
export function findLiveAttendedEvent(
  events: Event[],
  now: Date,
): Event | undefined {
  return events.find((ev) => isEventLive(ev, now));
}
```

### 2. Auto-apply in `src/pages/Friends.tsx`

**Module-level session guard** (top of the module, outside the component):

```ts
// Auto-event-filter is applied at most once per app load. A module-level flag
// (not component state / sessionStorage) is exactly "per app load": it survives
// in-SPA remounts (navigating away from /friends and back) but resets on a full
// page reload / new tab / Telegram Mini App reopen.
let sessionAutoFilterDone = false;
```

**New effect** inside the component (runs when the viewer finishes loading):

```ts
const [autoFilterResolved, setAutoFilterResolved] = useState(false);

useEffect(() => {
  if (viewerLoading) return;          // wait for the viewer profile
  if (autoFilterResolved) return;     // resolved for this mount already
  if (
    !sessionAutoFilterDone &&
    !urlEventId &&                     // explicit ?eventId= deep link wins
    !filter.eventId                    // don't override an existing filter
  ) {
    const live = findLiveAttendedEvent(viewer?.eventsAttended ?? [], new Date());
    if (live) setFilter((prev) => ({ ...prev, eventId: live.id }));
  }
  sessionAutoFilterDone = true;
  setAutoFilterResolved(true);
}, [viewerLoading, viewer, urlEventId, filter.eventId, autoFilterResolved]);
```

**Deck-load effect guard.** Add one early-return so the deck fetches exactly once
with the resolved filter (no random-deck flash before the attendee deck loads):

```ts
if (!autoFilterResolved) return;      // added alongside the existing guards
```

and add `autoFilterResolved` to that effect's dependency array.

### Behavior walk-through

| Scenario | `sessionAutoFilterDone` at entry | Result |
|---|---|---|
| First app load, viewer attends a live event | `false` | deck defaults to that event's attendees; chip shows `📅 {title}` |
| First app load, no live attended event | `false` | normal random deck |
| Arrive via `?eventId=X` deep link | `false` | guard skips auto-apply; existing deep-link effect seeds the filter |
| User clears the chip, then re-enters Search tab | `true` | stays the normal random deck (no re-apply) |
| Full reload / new tab / Mini App reopen (event still live) | `false` (fresh module) | re-applies |

### Failure / edge handling

- **Viewer fails to load** (`viewerLoading` → false, `viewer` null): helper runs
  over `[]`, finds nothing, `autoFilterResolved` flips true, deck loads normally.
  No deadlock.
- **Deck load waits for viewer now (all cases, not just deep link).** This is a
  deliberate, necessary change: we cannot know about live events until the viewer
  loads. The viewer is a single `/users/me` call that `Friends` already issues on
  mount; the Search tab shows the existing "Загрузка..." state until it resolves.
- **Chip title resolution** already reads from `attendedEvents`
  (= `viewer.eventsAttended`); since the live event comes from that same list, its
  title resolves with no extra fetch.

## Testing

- **Unit tests** — `src/lib/__tests__/liveEvent.test.ts`:
  - `isEventLive`: `now` inside `[start, endDate]`; before `start`; after
    `endDate`; no `endDate` same calendar day (incl. before start time on that
    day); no `endDate` different day; invalid/missing `start`; invalid `endDate`
    falls back to same-day rule.
  - `findLiveAttendedEvent`: empty list → `undefined`; no live → `undefined`;
    multiple live → returns the first in array order; single live among
    non-live.
- **Manual verification (API mode):** as a user attending a live event, open
  `/friends` → deck shows co-attendees with the `📅` chip; clear the chip →
  random deck; reload → chip returns.
- **Optional mock-mode demo aid:** nudge one `src/data/mockEvents.ts` entry's
  `date`/`endDate` to span the current day so the behavior is demoable against
  the mock backend. Optional and clearly reversible; not required for the feature.

## Files touched

- `src/lib/liveEvent.ts` (new)
- `src/lib/__tests__/liveEvent.test.ts` (new)
- `src/pages/Friends.tsx` (module guard + new effect + one deck-load guard line)
- `src/data/mockEvents.ts` (optional demo aid)
