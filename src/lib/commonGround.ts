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
import { COUNTRY_BY_CODE } from '@/data/countries';

export type CommonGroundSignal =
  | { kind: 'sharedEventsMany'; count: number }
  | { kind: 'sharedEventOne'; event: Event }
  | { kind: 'sharedUpcomingEvent'; event: Event }
  | { kind: 'sharedPromptAnswer'; promptId: string; answer: string }
  | { kind: 'sharedRank'; rank: 'aloeCrew' | 'friendOfAloe' }
  | { kind: 'sharedCity'; city: string }
  | { kind: 'sharedCountry'; country: string };

/**
 * Returns an ordered list of signals describing what viewer and target have
 * in common. Returns [] when viewer === target (same id) or nothing matches.
 *
 * Signal priority order: past shared events → upcoming shared event →
 * shared prompt answers → rank → city.
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

  // Shared prompt answers: case-insensitive trimmed match on the same promptId.
  const viewerPrompts = viewer.prompts ?? [];
  const targetPrompts = target.prompts ?? [];
  for (const vp of viewerPrompts) {
    if (!vp.promptId || !vp.answer) continue;
    const vAnswer = vp.answer.trim().toLowerCase();
    if (!vAnswer) continue;
    const match = targetPrompts.find(
      tp => tp.promptId === vp.promptId && tp.answer.trim().toLowerCase() === vAnswer
    );
    if (match) {
      out.push({ kind: 'sharedPromptAnswer', promptId: vp.promptId, answer: vp.answer.trim() });
    }
  }

  if (
    viewer.rank === target.rank &&
    (viewer.rank === 'aloeCrew' || viewer.rank === 'friendOfAloe')
  ) {
    out.push({ kind: 'sharedRank', rank: viewer.rank });
  }

  // Same (country, region) tuple wins highest; same country with different region is softer.
  if (viewer.country && viewer.country === target.country &&
      viewer.region && viewer.region === target.region) {
    out.push({ kind: 'sharedCity', city: viewer.region });
  } else if (viewer.country && viewer.country === target.country) {
    const countryName = COUNTRY_BY_CODE[viewer.country]?.nameRu ?? viewer.country;
    out.push({ kind: 'sharedCountry', country: countryName });
  }

  return out;
}
