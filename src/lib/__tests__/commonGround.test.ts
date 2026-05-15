import { describe, expect, it } from 'vitest';
import { commonGround } from '../commonGround';
import type { User, Event } from '@/types/user';

const baseUser = (id: string, overrides: Partial<User> = {}): User => ({
  id, name: id, age: 25, bio: '', location: '',
  gender: 'prefer-not-to-say', profileImage: '', images: [],
  lastSeen: new Date(), isOnline: false,
  preferences: { ageRange: [18, 65], maxDistance: 50, showMe: 'everyone' },
  settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  rank: 'novice', staffRole: 'none',
  ...overrides,
});

const event = (id: string, daysFromNow: number, title = id): Event => ({
  id, title, description: '', imageUrl: '',
  date: new Date(Date.now() + daysFromNow * 86400_000),
  location: '', attendees: [], category: 'concert', organizer: '',
});

describe('commonGround', () => {
  it('returns [] for self', () => {
    const u = baseUser('a');
    expect(commonGround(u, u)).toEqual([]);
  });

  it('returns sharedEventOne for one shared past event', () => {
    const evt = event('e1', -10);
    const a = baseUser('a', { eventsAttended: [evt] });
    const b = baseUser('b', { eventsAttended: [evt] });
    const r = commonGround(a, b);
    expect(r[0].kind).toBe('sharedEventOne');
  });

  it('returns sharedEventsMany when 2+ shared past events', () => {
    const events = [event('e1', -10), event('e2', -20)];
    const a = baseUser('a', { eventsAttended: events });
    const b = baseUser('b', { eventsAttended: events });
    const r = commonGround(a, b);
    expect(r[0]).toEqual({ kind: 'sharedEventsMany', count: 2 });
  });

  it('returns sharedRank for matching aloeCrew', () => {
    const a = baseUser('a', { rank: 'aloeCrew' });
    const b = baseUser('b', { rank: 'aloeCrew' });
    expect(commonGround(a, b)[0]).toEqual({ kind: 'sharedRank', rank: 'aloeCrew' });
  });

  it('does NOT return sharedRank for matching novice', () => {
    const a = baseUser('a', { rank: 'novice' });
    const b = baseUser('b', { rank: 'novice' });
    expect(commonGround(a, b).find(s => s.kind === 'sharedRank')).toBeUndefined();
  });

  it('returns sharedCity for case-insensitive location match', () => {
    const a = baseUser('a', { location: ' Moscow ' });
    const b = baseUser('b', { location: 'moscow' });
    expect(commonGround(a, b).some(s => s.kind === 'sharedCity')).toBe(true);
  });

  it('does NOT return sharedCity for empty location', () => {
    const a = baseUser('a', { location: '' });
    const b = baseUser('b', { location: '' });
    expect(commonGround(a, b).find(s => s.kind === 'sharedCity')).toBeUndefined();
  });

  it('orders signals: events > rank > city', () => {
    const evt = event('e1', -5);
    const a = baseUser('a', {
      eventsAttended: [evt], rank: 'aloeCrew', location: 'Moscow'
    });
    const b = baseUser('b', {
      eventsAttended: [evt], rank: 'aloeCrew', location: 'Moscow'
    });
    const r = commonGround(a, b);
    expect(r[0].kind).toBe('sharedEventOne');
    expect(r[1].kind).toBe('sharedRank');
    expect(r[2].kind).toBe('sharedCity');
  });

  it('returns [] when nothing matches', () => {
    const a = baseUser('a', { location: 'Moscow', rank: 'novice' });
    const b = baseUser('b', { location: 'Berlin', rank: 'novice' });
    expect(commonGround(a, b)).toEqual([]);
  });

  it('tolerates missing eventsAttended', () => {
    const a = baseUser('a', { location: 'X', rank: 'aloeCrew' });
    const b = baseUser('b', { location: 'X', rank: 'aloeCrew' });
    expect(commonGround(a, b).length).toBeGreaterThan(0);
  });

  // Spike confirmed: GetEventsAttendedByUserAsync has no date filter in either
  // AzureEventService or MockEventService — upcoming events flow through.
  it('returns sharedUpcomingEvent for shared future event', () => {
    const evt = event('e-future', 30, 'AloeFest 2027');
    const a = baseUser('a', { eventsAttended: [evt] });
    const b = baseUser('b', { eventsAttended: [evt] });
    expect(commonGround(a, b).some(s => s.kind === 'sharedUpcomingEvent')).toBe(true);
  });

  it('returns sharedPromptAnswer when both users have the same prompt with the same answer', () => {
    const a = baseUser('a', {
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
    });
    const b = baseUser('b', {
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
    });
    const r = commonGround(a, b);
    expect(r.some(s =>
      s.kind === 'sharedPromptAnswer' && s.promptId === 'aloevera_song' && s.answer === 'Hometown'
    )).toBe(true);
  });

  it('matches sharedPromptAnswer case-insensitively and ignores whitespace', () => {
    const a = baseUser('a', {
      prompts: [{ promptId: 'aloevera_song', answer: '  Hometown  ' }],
    });
    const b = baseUser('b', {
      prompts: [{ promptId: 'aloevera_song', answer: 'hometown' }],
    });
    expect(commonGround(a, b).some(s => s.kind === 'sharedPromptAnswer')).toBe(true);
  });

  it('does NOT return sharedPromptAnswer when the same prompt has different answers', () => {
    const a = baseUser('a', {
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
    });
    const b = baseUser('b', {
      prompts: [{ promptId: 'aloevera_song', answer: 'Lullaby' }],
    });
    expect(commonGround(a, b).find(s => s.kind === 'sharedPromptAnswer')).toBeUndefined();
  });

  it('does NOT return sharedPromptAnswer when answers match but prompt ids differ', () => {
    const a = baseUser('a', {
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
    });
    const b = baseUser('b', {
      prompts: [{ promptId: 'looking_for', answer: 'Hometown' }],
    });
    expect(commonGround(a, b).find(s => s.kind === 'sharedPromptAnswer')).toBeUndefined();
  });

  it('emits one sharedPromptAnswer per matching prompt', () => {
    const a = baseUser('a', {
      prompts: [
        { promptId: 'aloevera_song', answer: 'Hometown' },
        { promptId: 'looking_for', answer: 'Tour buddies' },
      ],
    });
    const b = baseUser('b', {
      prompts: [
        { promptId: 'aloevera_song', answer: 'Hometown' },
        { promptId: 'looking_for', answer: 'Tour buddies' },
      ],
    });
    const matches = commonGround(a, b).filter(s => s.kind === 'sharedPromptAnswer');
    expect(matches).toHaveLength(2);
  });

  it('places sharedPromptAnswer after shared events but before rank and city', () => {
    const evt = event('e1', -5);
    const a = baseUser('a', {
      eventsAttended: [evt],
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
      rank: 'aloeCrew',
      location: 'Moscow',
    });
    const b = baseUser('b', {
      eventsAttended: [evt],
      prompts: [{ promptId: 'aloevera_song', answer: 'Hometown' }],
      rank: 'aloeCrew',
      location: 'Moscow',
    });
    const r = commonGround(a, b);
    expect(r[0].kind).toBe('sharedEventOne');
    expect(r[1].kind).toBe('sharedPromptAnswer');
    expect(r[2].kind).toBe('sharedRank');
    expect(r[3].kind).toBe('sharedCity');
  });
});
