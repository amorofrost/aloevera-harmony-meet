import { describe, expect, it } from 'vitest';
import { effectiveLevel, meetsLevel } from '@/lib/acl';

describe('effectiveLevel', () => {
  it('returns 0 for novice / none', () => {
    expect(effectiveLevel('novice', 'none')).toBe(0);
  });

  it('takes max of rank and staff', () => {
    expect(effectiveLevel('aloeCrew', 'none')).toBe(3);
    expect(effectiveLevel('novice', 'moderator')).toBe(4);
    expect(effectiveLevel('activeMember', 'admin')).toBe(5);
  });
});

describe('meetsLevel', () => {
  it('true when user level equals required', () => {
    expect(meetsLevel('activeMember', 'none', 'activeMember')).toBe(true);
  });

  it('false when below required', () => {
    expect(meetsLevel('novice', 'none', 'activeMember')).toBe(false);
  });

  it('staff role satisfies rank requirement', () => {
    expect(meetsLevel('novice', 'moderator', 'activeMember')).toBe(true);
  });
});
