# Live-event Default Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On app open, default the `/friends` Search deck to the attendees of an event the viewer is currently attending (live by dates), instead of the random deck.

**Architecture:** A pure, unit-tested helper (`src/lib/liveEvent.ts`) decides whether an event is live and finds the first live attended event from the already-loaded viewer profile. `Friends.tsx` seeds its existing `eventId` search filter with that event on the first mount of an app load, guarded by a module-level flag so it applies at most once per app load. Everything downstream (event chip, attendee deck fetch) is the existing pipeline — unchanged.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (globals: `describe`/`it`/`expect`), `@/` path alias → `src/`.

## Global Constraints

- Frontend repo `aloevera-harmony-meet` only. **No backend / DTO changes.**
- No new UI — reuse the existing `📅 {title}` filter chip.
- Attendees only (not "interested" users) — matches the existing `eventId` filter.
- `now` is always an injected parameter in helpers (never call `new Date()` inside a pure helper) for deterministic tests.
- Follow existing conventions: pure helpers in `src/lib/`, tests in `src/lib/__tests__/*.test.ts`, Vitest globals (no per-file imports of `describe`/`it`/`expect`), `@/` alias for imports.
- Single-file test run: `npx vitest run <path>`. Full suite: `npm run test:run`.

---

### Task 1: Pure live-event helper + unit tests

**Files:**
- Create: `src/lib/liveEvent.ts`
- Test: `src/lib/__tests__/liveEvent.test.ts`

**Interfaces:**
- Consumes: `Event` type from `@/types/user` (fields used: `date: Date`, `endDate?: Date`, `id: string`).
- Produces:
  - `isEventLive(event: { date: Date; endDate?: Date }, now: Date): boolean`
  - `findLiveAttendedEvent(events: Event[], now: Date): Event | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/liveEvent.test.ts`:

```ts
import { isEventLive, findLiveAttendedEvent } from '@/lib/liveEvent';
import type { Event } from '@/types/user';

// Minimal Event factory — only the fields the helper reads matter.
function ev(partial: Partial<Event> & { id: string; date: Date }): Event {
  return {
    title: 'E',
    description: '',
    imageUrl: '',
    location: '',
    attendees: [],
    category: 'concert',
    organizer: '',
    ...partial,
  } as Event;
}

describe('isEventLive', () => {
  it('is live when now is between start and endDate', () => {
    const start = new Date('2026-07-22T10:00:00');
    const end = new Date('2026-07-24T10:00:00');
    const now = new Date('2026-07-23T12:00:00');
    expect(isEventLive({ date: start, endDate: end }, now)).toBe(true);
  });

  it('is not live before start (with endDate)', () => {
    const start = new Date('2026-07-22T10:00:00');
    const end = new Date('2026-07-24T10:00:00');
    const now = new Date('2026-07-21T12:00:00');
    expect(isEventLive({ date: start, endDate: end }, now)).toBe(false);
  });

  it('is not live after endDate', () => {
    const start = new Date('2026-07-22T10:00:00');
    const end = new Date('2026-07-24T10:00:00');
    const now = new Date('2026-07-25T00:00:00');
    expect(isEventLive({ date: start, endDate: end }, now)).toBe(false);
  });

  it('is live on the whole calendar day of start when there is no endDate', () => {
    const start = new Date('2026-07-22T20:00:00');
    // Before the concert start time, but same calendar day → live.
    const early = new Date('2026-07-22T08:00:00');
    const late = new Date('2026-07-22T23:59:00');
    expect(isEventLive({ date: start }, early)).toBe(true);
    expect(isEventLive({ date: start }, late)).toBe(true);
  });

  it('is not live on a different calendar day when there is no endDate', () => {
    const start = new Date('2026-07-22T20:00:00');
    const nextDay = new Date('2026-07-23T00:01:00');
    expect(isEventLive({ date: start }, nextDay)).toBe(false);
  });

  it('falls back to the same-day rule when endDate is an invalid Date', () => {
    const start = new Date('2026-07-22T20:00:00');
    const now = new Date('2026-07-22T21:00:00');
    expect(isEventLive({ date: start, endDate: new Date('nope') }, now)).toBe(true);
  });

  it('is not live when start is missing or invalid', () => {
    const now = new Date('2026-07-22T21:00:00');
    // @ts-expect-error — exercising the runtime guard for a missing date
    expect(isEventLive({}, now)).toBe(false);
    expect(isEventLive({ date: new Date('nope') }, now)).toBe(false);
  });
});

describe('findLiveAttendedEvent', () => {
  const now = new Date('2026-07-22T12:00:00');

  it('returns undefined for an empty list', () => {
    expect(findLiveAttendedEvent([], now)).toBeUndefined();
  });

  it('returns undefined when nothing is live', () => {
    const events = [
      ev({ id: 'a', date: new Date('2026-07-01T10:00:00'), endDate: new Date('2026-07-02T10:00:00') }),
      ev({ id: 'b', date: new Date('2026-08-01T10:00:00') }),
    ];
    expect(findLiveAttendedEvent(events, now)).toBeUndefined();
  });

  it('returns the single live event', () => {
    const events = [
      ev({ id: 'past', date: new Date('2026-07-01T10:00:00') }),
      ev({ id: 'live', date: new Date('2026-07-22T09:00:00'), endDate: new Date('2026-07-22T23:00:00') }),
    ];
    expect(findLiveAttendedEvent(events, now)?.id).toBe('live');
  });

  it('returns the first live event in array order when several are live', () => {
    const events = [
      ev({ id: 'live1', date: new Date('2026-07-22T08:00:00') }),
      ev({ id: 'live2', date: new Date('2026-07-20T08:00:00'), endDate: new Date('2026-07-25T08:00:00') }),
    ];
    expect(findLiveAttendedEvent(events, now)?.id).toBe('live1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/liveEvent.test.ts`
Expected: FAIL — cannot resolve module `@/lib/liveEvent` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/liveEvent.ts`:

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
 * - valid endDate:  start <= now <= endDate
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/liveEvent.test.ts`
Expected: PASS — all cases in both `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveEvent.ts src/lib/__tests__/liveEvent.test.ts
git commit -m "feat: add live-event detection helper"
```

---

### Task 2: Wire the auto-filter into Friends.tsx

**Files:**
- Modify: `src/pages/Friends.tsx`

**Interfaces:**
- Consumes: `findLiveAttendedEvent` from `@/lib/liveEvent` (Task 1); existing `viewer` / `viewerLoading` from `useCurrentUser()`; existing `filter` / `setFilter` state; existing `urlEventId`.
- Produces: no new exports. Seeds the existing `filter.eventId`, which the existing deck-load effect consumes.

**Context for the implementer (read before editing):**
`Friends.tsx` is a large existing page. You are making three surgical edits and adding one import. Do not restructure anything else. The relevant existing anchors:
- The barrel import on line ~33: `import { matchingApi, usersApi, getCurrentUserIdFromToken, eventsApi } from '@/services/api';`
- `const Friends = () => {` (component start, line ~55).
- `const { user: viewer, loading: viewerLoading } = useCurrentUser();` (line ~63).
- `const urlEventId = searchParams.get('eventId') || '';` (line ~69).
- `const [filter, setFilter] = useState<SearchFilters>(EMPTY_FILTERS);` (line ~72).
- The deep-link seeding effect `useEffect(() => { if (!urlEventId) return; ... }, [urlEventId, attendedEvents, filter.eventId]);` (lines ~234-240).
- The deck-load effect that starts `useEffect(() => {` with first line `if (urlEventId && filter.eventId !== urlEventId && viewerLoading) return;` (line ~255) and ends with a deps array (lines ~328-332).

- [ ] **Step 1: Add the helper import**

Add this import near the other `@/lib` imports (e.g. just after the `import { cn } from '@/lib/utils';` line, ~line 30):

```ts
import { findLiveAttendedEvent } from '@/lib/liveEvent';
```

- [ ] **Step 2: Add the module-level session guard**

Immediately above `const Friends = () => {` (line ~55), add:

```ts
// Auto-event-filter is applied at most once per app load. A module-level flag
// (not component state / sessionStorage) is exactly "per app load": it survives
// in-SPA remounts (navigating away from /friends and back) but resets on a full
// page reload / new tab / Telegram Mini App reopen.
let sessionAutoFilterDone = false;
```

- [ ] **Step 3: Add the `autoFilterResolved` state**

Directly after the `const [filter, setFilter] = useState<SearchFilters>(EMPTY_FILTERS);` line (~line 72), add:

```ts
  // Gates the deck-load effect until the once-per-app-load live-event auto-filter
  // decision has been made, so the deck fetches exactly once with the resolved
  // filter (no random-deck flash before the attendee deck loads).
  const [autoFilterResolved, setAutoFilterResolved] = useState(false);
```

- [ ] **Step 4: Add the auto-apply effect**

Insert this effect immediately BEFORE the deep-link seeding effect (the one whose comment begins "Seed filter.eventId from a ?eventId= deep link", ~line 231):

```ts
  // On the first /friends mount of an app load, if the viewer attends an event
  // that is currently live (by dates), default the deck to that event's
  // attendees by seeding the existing eventId filter. Runs at most once per app
  // load (module-level sessionAutoFilterDone). An explicit ?eventId= deep link or
  // an already-set filter takes precedence and suppresses the auto-apply.
  useEffect(() => {
    if (viewerLoading) return;        // wait for the viewer profile to load
    if (autoFilterResolved) return;   // resolved for this mount already
    if (!sessionAutoFilterDone && !urlEventId && !filter.eventId) {
      const live = findLiveAttendedEvent(viewer?.eventsAttended ?? [], new Date());
      if (live) setFilter(prev => ({ ...prev, eventId: live.id }));
    }
    sessionAutoFilterDone = true;
    setAutoFilterResolved(true);
  }, [viewerLoading, viewer, urlEventId, filter.eventId, autoFilterResolved]);
```

- [ ] **Step 5: Gate the deck-load effect on `autoFilterResolved`**

In the deck-load effect, find its current first line (~line 256):

```ts
    if (urlEventId && filter.eventId !== urlEventId && viewerLoading) return;
```

Add a new line immediately after it:

```ts
    if (!autoFilterResolved) return; // wait for the live-event auto-filter decision
```

Then add `autoFilterResolved` to that effect's dependency array. Change:

```ts
  }, [
    filter.country, filter.region, filter.accountName, filter.name,
    filter.minAge, filter.maxAge, filter.gender, filter.eventId,
    urlEventId, viewerLoading,
  ]);
```

to:

```ts
  }, [
    filter.country, filter.region, filter.accountName, filter.name,
    filter.minAge, filter.maxAge, filter.gender, filter.eventId,
    urlEventId, viewerLoading, autoFilterResolved,
  ]);
```

- [ ] **Step 6: Typecheck, lint, and run the full test suite**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors in `src/pages/Friends.tsx` (a pre-existing `react-hooks/exhaustive-deps` disable comment already sits on the deck-load effect; do not remove it).

Run: `npm run test:run`
Expected: PASS — full suite green, including `liveEvent.test.ts` from Task 1.

- [ ] **Step 7: Manual verification (document the result in the commit)**

Because `Friends.tsx` has no page-level test harness, verify the effect manually:

1. `npm run dev`, sign in (API mode) as a user attending a live event.
2. Open `/friends` → Search deck shows co-attendees; the `📅 {title}` chip is present.
3. Clear the chip → random deck; navigate to `/aloevera` and back to `/friends` → deck stays random (no re-apply).
4. Full page reload while the event is still live → chip returns.
5. Open `/friends?eventId=<some other attended event>` → that event wins (auto-apply suppressed).

If a live event is not readily available in your environment, do Task 3 first (mock demo aid), verify in mock mode, then confirm in API mode when possible.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat: default /friends deck to a live attended event's attendees"
```

---

### Task 3 (OPTIONAL): Mock-mode demo aid

Do this only if you want the feature visible against the mock backend (`VITE_API_MODE=mock`), e.g. to manually verify Task 2 without an API-mode account. It edits seed data only and is trivially reversible. **Skip entirely if not needed** — the feature does not depend on it.

**Files:**
- Modify: `src/data/mockEvents.ts`
- Modify: `src/data/mockCurrentUser.ts` (only if the mock current user does not already list the chosen event under attended events)

- [ ] **Step 1: Inspect the current mock data**

Run: `sed -n '1,80p' src/data/mockEvents.ts`
Run: `grep -n "eventsAttended\|attendees" src/data/mockCurrentUser.ts`

Identify one event the mock current user attends (its id appears in the user's `eventsAttended`, and the current user's id is in that event's `attendees`). If none overlap, pick one event and make them overlap in the following steps.

- [ ] **Step 2: Make that event span "today"**

For the chosen event in `src/data/mockEvents.ts`, set its `date` to the start of the current day and `endDate` to the end of the current day so it is always live when demoing:

```ts
    // Demo aid: keep this event live "today" so the live-event default deck is
    // visible in mock mode. Safe to revert.
    date: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 0)),
```

If needed, ensure the mock current user attends it: add the event to the user's `eventsAttended` in `src/data/mockCurrentUser.ts` and add the current user's id to that event's `attendees` array in `src/data/mockEvents.ts`.

- [ ] **Step 3: Verify in mock mode**

Run: `npm run dev` (mock is the default in `.env.development`).
Open `/friends` → the Search deck defaults to that event's attendees with the `📅` chip.

- [ ] **Step 4: Commit (or revert)**

If keeping it:

```bash
git add src/data/mockEvents.ts src/data/mockCurrentUser.ts
git commit -m "chore: mock event kept live today to demo live-event default deck"
```

If you only used it to verify, revert instead:

```bash
git checkout -- src/data/mockEvents.ts src/data/mockCurrentUser.ts
```

---

## Self-Review notes

- **Spec coverage:** live-window definition + first-found selection → Task 1; module-guard once-per-app-load, deep-link precedence, single-fetch gating → Task 2; optional mock demo aid → Task 3. All spec sections covered.
- **No backend changes** anywhere — matches the spec's non-goals.
- **Type consistency:** `isEventLive` / `findLiveAttendedEvent` signatures are identical across Task 1's definition, its tests, and Task 2's usage.
