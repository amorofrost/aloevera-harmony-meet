import { PROMPT_CATALOG, PROMPT_IDS, getPromptText, getPromptOptions } from '@/data/prompts';
import { mockSongs } from '@/data/mockSongs';

describe('PROMPT_CATALOG', () => {
  it('has 12 entries', () => {
    expect(PROMPT_CATALOG).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = PROMPT_CATALOG.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty ru and en text on every entry', () => {
    for (const p of PROMPT_CATALOG) {
      expect(p.ru.length).toBeGreaterThan(0);
      expect(p.en.length).toBeGreaterThan(0);
      expect(p.ru.length).toBeLessThanOrEqual(80);
      expect(p.en.length).toBeLessThanOrEqual(80);
    }
  });

  it('PROMPT_IDS mirrors PROMPT_CATALOG ids', () => {
    expect(PROMPT_IDS).toEqual(PROMPT_CATALOG.map(p => p.id));
  });

  it('getPromptText returns ru text for known id and ru lang', () => {
    expect(getPromptText('looking_for', 'ru')).toBe(
      PROMPT_CATALOG.find(p => p.id === 'looking_for')!.ru
    );
  });

  it('getPromptText returns null for unknown id', () => {
    expect(getPromptText('totally_invented', 'ru')).toBeNull();
  });

  it('getPromptOptions returns the song titles for aloevera_song', () => {
    const options = getPromptOptions('aloevera_song', 'ru');
    expect(options).not.toBeNull();
    expect(options).toEqual(mockSongs.map(s => s.title));
  });

  it('getPromptOptions returns localized instruments for instrument', () => {
    const ruOptions = getPromptOptions('instrument', 'ru');
    const enOptions = getPromptOptions('instrument', 'en');
    expect(ruOptions?.length).toBeGreaterThan(0);
    expect(enOptions?.length).toBe(ruOptions?.length);
    expect(ruOptions).toContain('Гитара');
    expect(enOptions).toContain('Guitar');
  });

  it('getPromptOptions returns null for prompts without options', () => {
    expect(getPromptOptions('looking_for', 'ru')).toBeNull();
    expect(getPromptOptions('weekend', 'en')).toBeNull();
  });

  it('getPromptOptions returns null for unknown id', () => {
    expect(getPromptOptions('totally_invented', 'ru')).toBeNull();
  });
});
