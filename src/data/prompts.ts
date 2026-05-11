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
const ALOEVERA_SONG_TITLES = [
  'Беги',
  'Берега',
  'Боли буйство',
  'Бросайте мужей',
  'Ватрушка',
  'Вместо меня',
  'Во мне нет',
  'Генерал',
  'Георгины',
  'Георгины осенние',
  'Гладь',
  'Город',
  'Грязь',
  'Дискац',
  'Доктор',
  'Дорогу осилит идущий',
  'Дочь моряка',
  'Если ты вернешься',
  'Каждую мою весну',
  'Как боги',
  'Каково тебе',
  'Калина',
  'Капитан',
  'Касаться',
  'Качели',
  'Кварталам',
  'Колыбельная',
  'Красиво',
  'Крылья',
  'Кто вы',
  'Легче',
  'Лето',
  'Лётчики',
  'Любила до рвоты',
  'Мальчики',
  'Марина',
  'Механик',
  'Морем',
  'Назову его',
  'Напрашиваясь на встречу',
  'Не было',
  'Не ломайте',
  'Не по ГОСТу',
  'Неумело',
  'Нежность',
  'Несуразная',
  'Новости',
  'Олег',
  'Оправданий нет',
  'Отвертка',
  'Паратов',
  'Пинженин',
  'Письмо',
  'Платье в точку',
  'Позовите Олега',
  'Понимаешь, девочка',
  'Резина',
  'Рейволюция',
  'Самокат',
  'Сделаем вид',
  'Сделай мне хорошо',
  'Сказочка про козявочку',
  'Слушаю Каца',
  'Сначала в бездну',
  'Солдат',
  'Солдатом',
  'Стой',
  'Страсти',
  'Стыд',
  'Сюжет для новой песни',
  'Сэлинджер',
  'Та-да-да',
  'Танцы',
  'Телеграм-канал',
  'Тот, кто тебе нужен',
  'Ты что такой?',
  'Фотопространство',
  'Хочется тебя касаться',
  'Цыпочки',
  'Что я делаю',
  'Чтобы целоваться',
  'Эта песня не про тебя',
  'Это море',
  'Я когда не люблю',
  'Я не хочу',
  'Я этого не выбирала'
] as const;

const ALOEVERA_SONG_TITLES_OPTIONS = {
  ru: ALOEVERA_SONG_TITLES,
  en: ALOEVERA_SONG_TITLES,
};

const INSTRUMENT_OPTIONS = {
  ru: ['Гитара', 'Бас', 'Барабаны', 'Клавишные', 'Вокал', 'Труба'] as const,
  en: ['Guitar', 'Bass', 'Drums', 'Keys', 'Vocals', 'Tuba'] as const,
};

export const PROMPT_CATALOG: readonly PromptCatalogEntry[] = [
  { id: 'aloevera_first',    ru: 'Моё первое знакомство с AloeVera…',     en: 'How I first found AloeVera…' },
  {
    id: 'aloevera_song',
    ru: 'Любимая песня АлоэВера',
    en: 'Favorite AloeVera song',
    options: ALOEVERA_SONG_TITLES_OPTIONS,
  },
  { id: 'concert_memory',    ru: 'Лучший момент с концерта АлоэВера',     en: 'Best AloeVera concert memory' },
  { id: 'looking_for',       ru: 'Что я ищу здесь',                        en: "What I'm looking for here" },
  { id: 'playlist',          ru: 'Кроме АлоэВера я слушаю…',              en: 'Besides AloeVera I listen to…' },
  {
    id: 'instrument',
    ru: 'Если бы я был в группе, играл бы на…',
    en: "If I were in a band, I'd play…",
    options: INSTRUMENT_OPTIONS,
  }
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
