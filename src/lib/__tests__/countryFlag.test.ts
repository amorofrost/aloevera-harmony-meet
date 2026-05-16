import { describe, it, expect } from 'vitest';
import { flagEmoji, isCustomCountry } from '../countryFlag';

describe('flagEmoji', () => {
  it('returns the flag for a valid ISO code', () => {
    expect(flagEmoji('RU')).toBe('🇷🇺');
    expect(flagEmoji('US')).toBe('🇺🇸');
    expect(flagEmoji('GB')).toBe('🇬🇧');
  });

  it('returns empty string for non-ISO values', () => {
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('Russia')).toBe('');
    expect(flagEmoji('ru')).toBe('');     // lowercase isn't accepted
    expect(flagEmoji('RUS')).toBe('');    // 3-letter codes aren't accepted
  });
});

describe('isCustomCountry', () => {
  it('treats free text as custom', () => {
    expect(isCustomCountry('Atlantis')).toBe(true);
    expect(isCustomCountry('Some Place')).toBe(true);
  });

  it('treats ISO-2 codes as not custom', () => {
    expect(isCustomCountry('RU')).toBe(false);
    expect(isCustomCountry('US')).toBe(false);
  });

  it('treats empty as not custom', () => {
    expect(isCustomCountry('')).toBe(false);
  });
});
