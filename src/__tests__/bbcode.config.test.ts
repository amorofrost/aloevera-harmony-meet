import { describe, it, expect } from 'vitest';
import { BBCODE_CONFIG } from '@/config/bbcode.config';

describe('BBCODE_CONFIG', () => {
  it('matches the expected default state (snapshot)', () => {
    expect(BBCODE_CONFIG).toMatchSnapshot();
  });

  it('has bold, italic, strikethrough, quote, spoiler enabled', () => {
    expect(BBCODE_CONFIG.bold).toBe(true);
    expect(BBCODE_CONFIG.italic).toBe(true);
    expect(BBCODE_CONFIG.strikethrough).toBe(true);
    expect(BBCODE_CONFIG.quote).toBe(true);
    expect(BBCODE_CONFIG.spoiler).toBe(true);
  });

  it('has underline, url, code disabled', () => {
    expect(BBCODE_CONFIG.underline).toBe(false);
    expect(BBCODE_CONFIG.url).toBe(false);
    expect(BBCODE_CONFIG.code).toBe(false);
  });
});
