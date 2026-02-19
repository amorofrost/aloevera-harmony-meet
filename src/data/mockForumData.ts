export interface ForumTopic {
  id: string;
  sectionId: string;
  title: string;
  authorName: string;
  replyCount: number;
  lastActivity: Date;
  isPinned?: boolean;
  preview: string;
}

export interface ForumSection {
  id: string;
  name: string;
  icon: string;
  description: string;
  topicCount: number;
  topics: ForumTopic[];
}

export const mockForumSections: ForumSection[] = [
  {
    id: 'general',
    name: '💬 Общие обсуждения',
    icon: '💬',
    description: 'Свободное общение на любые темы',
    topicCount: 4,
    topics: [
      { id: 't1', sectionId: 'general', title: 'Какая ваша любимая песня AloeVera?', authorName: 'Анна', replyCount: 24, lastActivity: new Date('2024-02-23T09:15:00'), isPinned: true, preview: 'Делитесь любимыми треками и обсуждаем!' },
      { id: 't2', sectionId: 'general', title: 'Новый альбом — ваши впечатления', authorName: 'Дмитрий', replyCount: 42, lastActivity: new Date('2024-02-23T11:30:00'), isPinned: true, preview: 'Обсуждаем новый альбом группы' },
      { id: 't3', sectionId: 'general', title: 'Кто едет на летний фестиваль?', authorName: 'Елена', replyCount: 18, lastActivity: new Date('2024-02-22T16:45:00'), preview: 'Планируем поездку вместе' },
      { id: 't4', sectionId: 'general', title: 'Текст последней песни — разбор', authorName: 'Мария', replyCount: 31, lastActivity: new Date('2024-02-23T10:00:00'), preview: 'Глубокий анализ текстов и метафор' },
    ],
  },
  {
    id: 'music',
    name: '🎵 Музыка и творчество',
    icon: '🎵',
    description: 'Разбор песен, каверы, творчество',
    topicCount: 3,
    topics: [
      { id: 't5', sectionId: 'music', title: 'Каверы на AloeVera — делимся', authorName: 'Александр', replyCount: 15, lastActivity: new Date('2024-02-22T20:15:00'), preview: 'Скидывайте свои каверы!' },
      { id: 't6', sectionId: 'music', title: 'Аккорды и табы для гитары', authorName: 'Дмитрий', replyCount: 8, lastActivity: new Date('2024-02-21T14:20:00'), isPinned: true, preview: 'Собираем аккорды ко всем песням' },
      { id: 't7', sectionId: 'music', title: 'Плейлисты похожих исполнителей', authorName: 'София', replyCount: 22, lastActivity: new Date('2024-02-22T18:00:00'), preview: 'Если вам нравится AloeVera, послушайте...' },
    ],
  },
  {
    id: 'cities',
    name: '🏙️ По городам',
    icon: '🏙️',
    description: 'Общение по городам и регионам',
    topicCount: 3,
    topics: [
      { id: 't8', sectionId: 'cities', title: 'Москва — встречи фанатов', authorName: 'Анна', replyCount: 35, lastActivity: new Date('2024-02-23T08:00:00'), preview: 'Организуем встречи в Москве' },
      { id: 't9', sectionId: 'cities', title: 'Санкт-Петербург — кто тут?', authorName: 'Дмитрий', replyCount: 19, lastActivity: new Date('2024-02-22T14:20:00'), preview: 'Питерские фанаты, объединяемся!' },
      { id: 't10', sectionId: 'cities', title: 'Новосибирск — ищем компанию на концерт', authorName: 'Елена', replyCount: 7, lastActivity: new Date('2024-02-21T12:00:00'), preview: 'Ищем попутчиков' },
    ],
  },
  {
    id: 'offtopic',
    name: '🎨 Оффтопик',
    icon: '🎨',
    description: 'Всё, что не связано с музыкой',
    topicCount: 2,
    topics: [
      { id: 't11', sectionId: 'offtopic', title: 'Кто смотрел новый фильм?', authorName: 'Алексей', replyCount: 12, lastActivity: new Date('2024-02-22T20:15:00'), preview: 'Обсуждаем кино и сериалы' },
      { id: 't12', sectionId: 'offtopic', title: 'Рекомендации книг', authorName: 'Мария', replyCount: 9, lastActivity: new Date('2024-02-21T18:30:00'), preview: 'Что почитать?' },
    ],
  },
];
