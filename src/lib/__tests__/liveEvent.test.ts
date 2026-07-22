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
