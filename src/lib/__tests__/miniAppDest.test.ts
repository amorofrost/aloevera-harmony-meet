import { describe, it, expect } from 'vitest';
import { sanitizeDest } from '@/lib/miniAppDest';

describe('sanitizeDest', () => {
  it('accepts a simple relative path', () => {
    expect(sanitizeDest('/friends')).toBe('/friends');
  });

  it('accepts a relative path with a query string', () => {
    expect(sanitizeDest('/talks?chat=c1')).toBe('/talks?chat=c1');
    expect(sanitizeDest('/aloevera/events/e1')).toBe('/aloevera/events/e1');
  });

  it('rejects a protocol-relative path', () => {
    expect(sanitizeDest('//evil.com')).toBeNull();
  });

  it('rejects an absolute URL', () => {
    expect(sanitizeDest('https://evil.com')).toBeNull();
    expect(sanitizeDest('http://evil.com/x')).toBeNull();
  });

  it('rejects a path that does not start with a slash', () => {
    expect(sanitizeDest('friends')).toBeNull();
  });

  it('rejects empty, null, and undefined', () => {
    expect(sanitizeDest('')).toBeNull();
    expect(sanitizeDest(null)).toBeNull();
    expect(sanitizeDest(undefined)).toBeNull();
  });
});
