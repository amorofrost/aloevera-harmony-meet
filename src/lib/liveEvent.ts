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
