/**
 * commonGround — computes "what do viewer and target have in common?" signals
 * for use in profile cards and match UI.
 *
 * SPIKE RESULT (2026-05-07):
 * Both AzureEventService.GetEventsAttendedByUserAsync and
 * MockEventService.GetEventsAttendedByUserAsync return ALL events where
 * the user appears in the Attendees list, with NO date filter applied.
 * Consequently, User.eventsAttended contains both past AND upcoming events.
 * The `sharedUpcomingEvent` signal is therefore feasible and is included.
 */

import type { User, Event } from '@/types/user';

export type CommonGroundSignal =
  | { kind: 'sharedEventsMany'; count: number }
  | { kind: 'sharedEventOne'; event: Event }
  | { kind: 'sharedUpcomingEvent'; event: Event }
  | { kind: 'sharedRank'; rank: 'aloeCrew' | 'friendOfAloe' }
  | { kind: 'sharedCity'; city: string };

/**
 * Returns an ordered list of signals describing what viewer and target have
 * in common. Returns [] when viewer === target (same id) or nothing matches.
 *
 * Signal priority order: past shared events → upcoming shared event → rank → city.
 */
export function commonGround(viewer: User, target: User): CommonGroundSignal[] {
  if (viewer.id === target.id) return [];

  const out: CommonGroundSignal[] = [];
  const now = Date.now();

  const viewerEvents = viewer.eventsAttended ?? [];
  const targetEventIds = new Set((target.eventsAttended ?? []).map(e => e.id));
  const shared = viewerEvents.filter(e => targetEventIds.has(e.id));

  const sharedPast = shared.filter(e => e.date.getTime() < now);
  const sharedUpcoming = shared.filter(e => e.date.getTime() >= now);

  if (sharedPast.length >= 2) {
    out.push({ kind: 'sharedEventsMany', count: sharedPast.length });
  } else if (sharedPast.length === 1) {
    out.push({ kind: 'sharedEventOne', event: sharedPast[0] });
  }

  if (sharedUpcoming.length > 0) {
    out.push({ kind: 'sharedUpcomingEvent', event: sharedUpcoming[0] });
  }

  if (
    viewer.rank === target.rank &&
    (viewer.rank === 'aloeCrew' || viewer.rank === 'friendOfAloe')
  ) {
    out.push({ kind: 'sharedRank', rank: viewer.rank });
  }

  const vCity = viewer.location.trim().toLowerCase();
  const tCity = target.location.trim().toLowerCase();
  if (vCity && tCity && vCity === tCity) {
    out.push({ kind: 'sharedCity', city: viewer.location.trim() });
  }

  return out;
}
