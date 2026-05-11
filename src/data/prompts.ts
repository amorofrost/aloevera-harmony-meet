import { mockSongs } from './mockSongs';

export interface PromptCatalogEntry {
  id: string;
  ru: string;
  en: string;
  /**
   * Optional suggested answers. When present, the editor renders a dropdown
   * of these alongside the free-text field. Picking an option fills the
   * textarea; the user can keep, edit, or replace the inserted text.
   */
  options?: {
    ru: readonly string[];
    en: readonly string[];
  };
}

// Song titles aren't translated — same list under ru and en.
const ALOEVERA_SONG_TITLES: readonly string[] = mockSongs.map(s => s.title);

const INSTRUMENT_OPTIONS = {
  ru: ['Гитара', 'Бас', 'Барабаны', 'Клавишные', 'Вокал', 'Скрипка', 'Саксофон'] as const,
  en: ['Guitar', 'Bass', 'Drums', 'Keys', 'Vocals', 'Violin', 'Saxophone'] as const,
};

export const PROMPT_CATALOG: readonly PromptCatalogEntry[] = [
  { id: 'aloevera_first',    ru: 'Моё первое знакомство с AloeVera…',     en: 'How I first found AloeVera…' },
  {
    id: 'aloevera_song',
    ru: 'Любимая песня AloeVera и почему',
    en: 'Favorite AloeVera song and why',
    options: { ru: ALOEVERA_SONG_TITLES, en: ALOEVERA_SONG_TITLES },
  },
  { id: 'concert_memory',    ru: 'Лучший момент с концерта AloeVera',     en: 'Best AloeVera concert memory' },
  { id: 'looking_for',       ru: 'Что я ищу здесь',                        en: "What I'm looking for here" },
  { id: 'weekend',           ru: 'Идеальные выходные — это…',             en: 'A perfect weekend looks like…' },
  { id: 'road_trip',         ru: 'На концерт AloeVera поеду…',             en: "I'd travel this far for an AloeVera show…" },
  { id: 'playlist',          ru: 'Кроме AloeVera я слушаю…',              en: 'Besides AloeVera I listen to…' },
  {
    id: 'instrument',
    ru: 'Если бы я был в группе, играл бы на…',
    en: "If I were in a band, I'd play…",
    options: INSTRUMENT_OPTIONS,
  },
  { id: 'unpopular_opinion', ru: 'Непопулярное мнение об AloeVera',        en: 'Unpopular AloeVera opinion' },
  { id: 'dream_setlist',     ru: 'Сетлист моей мечты',                     en: 'My dream AloeVera setlist' },
  { id: 'first_date',        ru: 'Идея для первого свидания',              en: 'First-date idea' },
  { id: 'dealbreaker',       ru: 'Меня точно не зацепит…',                 en: "Won't work for me…" },
];

export const PROMPT_IDS: readonly string[] = PROMPT_CATALOG.map(p => p.id);

export function getPromptText(id: string, lang: 'ru' | 'en'): string | null {
  const entry = PROMPT_CATALOG.find(p => p.id === id);
  return entry ? entry[lang] : null;
}

export function getPromptOptions(id: string, lang: 'ru' | 'en'): readonly string[] | null {
  const entry = PROMPT_CATALOG.find(p => p.id === id);
  return entry?.options?.[lang] ?? null;
}
