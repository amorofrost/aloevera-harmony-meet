import { describe, it, expect } from 'vitest';
import { safeRedirectFrom, inviteCodeFrom } from './inviteRedirect';

describe('safeRedirectFrom', () => {
  it('accepts a valid internal path', () => {
    expect(safeRedirectFrom('/aloevera/events/123')).toBe('/aloevera/events/123');
  });

  it('accepts an internal path with query string', () => {
    expect(safeRedirectFrom('/aloevera/events/123?code=INVITE')).toBe('/aloevera/events/123?code=INVITE');
  });

  it('rejects an absolute URL (open redirect attempt)', () => {
    expect(safeRedirectFrom('https://attacker.com')).toBe('');
  });

  it('rejects a protocol-relative URL', () => {
    expect(safeRedirectFrom('//attacker.com')).toBe('');
  });

  it('rejects a path containing ://', () => {
    expect(safeRedirectFrom('/evil://attacker.com')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(safeRedirectFrom('')).toBe('');
  });
});

describe('inviteCodeFrom', () => {
  it('extracts code from a path with query string', () => {
    expect(inviteCodeFrom('/aloevera/events/123?code=INVITE123')).toBe('INVITE123');
  });

  it('returns empty string when no code param', () => {
    expect(inviteCodeFrom('/aloevera/events/123')).toBe('');
  });

  it('returns empty string for empty safeRedirect', () => {
    expect(inviteCodeFrom('')).toBe('');
  });

  it('handles URL with multiple params', () => {
    expect(inviteCodeFrom('/aloevera/events/123?foo=bar&code=MYCODE')).toBe('MYCODE');
  });
});
