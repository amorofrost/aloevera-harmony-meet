export interface ForumReply {
  id: string;
  topicId: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  likes: number;
  imageUrls?: string[];
}

export interface ForumTopicDetail {
  id: string;
  sectionId: string;
  title: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  replyCount: number;
  lastActivity: Date;
  isPinned?: boolean;
  replies: ForumReply[];
}

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

export const mockTopicDetails: Record<string, ForumTopicDetail> = {
  t1: {
    id: 't1', sectionId: 'general', title: 'Какая ваша любимая песня AloeVera?',
    authorId: '1', authorName: 'Анна', content: 'Привет всем! Давайте делиться любимыми треками AloeVera и обсуждать, почему они нам нравятся. Я начну — мне очень нравится "Сладкая жизнь", потому что текст невероятно глубокий.',
    createdAt: new Date('2024-02-20T12:00:00'), replyCount: 24, lastActivity: new Date('2024-02-23T09:15:00'), isPinned: true,
    replies: [
      { id: 'r1', topicId: 't1', authorId: '2', authorName: 'Дмитрий', content: 'Однозначно "На краю"! Мурашки каждый раз.', createdAt: new Date('2024-02-20T13:10:00'), likes: 12 },
      { id: 'r2', topicId: 't1', authorId: '3', authorName: 'Елена', content: 'А мне "Розовый закат" больше всего зашёл. Атмосфера потрясающая.', createdAt: new Date('2024-02-20T15:30:00'), likes: 8 },
      { id: 'r3', topicId: 't1', authorId: '4', authorName: 'Мария', content: 'Согласна с Анной! "Сладкая жизнь" — шедевр. Особенно припев.', createdAt: new Date('2024-02-21T09:00:00'), likes: 5 },
      { id: 'r4', topicId: 't1', authorName: 'Алексей', content: 'Для меня это "Ночной город". Слушаю на повторе уже месяц.', createdAt: new Date('2024-02-22T18:45:00'), likes: 15 },
      { id: 'r5', topicId: 't1', authorName: 'София', content: 'Сложно выбрать одну! Но если надо — "Между нами".', createdAt: new Date('2024-02-23T09:15:00'), likes: 3 },
    ],
  },
  t2: {
    id: 't2', sectionId: 'general', title: 'Новый альбом — ваши впечатления',
    authorId: '2', authorName: 'Дмитрий', content: 'Новый альбом вышел! Кто уже послушал? Делитесь впечатлениями. Мне кажется, это их лучшая работа.',
    createdAt: new Date('2024-02-22T08:00:00'), replyCount: 42, lastActivity: new Date('2024-02-23T11:30:00'), isPinned: true,
    replies: [
      { id: 'r6', topicId: 't2', authorId: '1', authorName: 'Анна', content: 'Послушала три раза подряд! Каждый трек — огонь 🔥', createdAt: new Date('2024-02-22T09:30:00'), likes: 20 },
      { id: 'r7', topicId: 't2', authorId: '3', authorName: 'Елена', content: 'Продакшн на высоте. Звук стал более зрелым.', createdAt: new Date('2024-02-22T11:00:00'), likes: 14 },
      { id: 'r8', topicId: 't2', authorName: 'Алексей', content: 'Третий трек — мой фаворит. Необычная аранжировка!', createdAt: new Date('2024-02-23T11:30:00'), likes: 7 },
    ],
  },
  t3: {
    id: 't3', sectionId: 'general', title: 'Кто едет на летний фестиваль?',
    authorId: '3', authorName: 'Елена', content: 'AloeVera будут выступать на летнем фестивале! Кто планирует ехать? Давайте организуем поездку вместе!',
    createdAt: new Date('2024-02-19T10:00:00'), replyCount: 18, lastActivity: new Date('2024-02-22T16:45:00'),
    replies: [
      { id: 'r9', topicId: 't3', authorId: '4', authorName: 'Мария', content: 'Я еду! Уже купила билет 🎉', createdAt: new Date('2024-02-19T12:00:00'), likes: 6 },
      { id: 'r10', topicId: 't3', authorId: '2', authorName: 'Дмитрий', content: 'Тоже планирую. Можно снять жильё вместе?', createdAt: new Date('2024-02-20T08:30:00'), likes: 4 },
    ],
  },
  t4: {
    id: 't4', sectionId: 'general', title: 'Текст последней песни — разбор',
    authorId: '4', authorName: 'Мария', content: 'Хочу разобрать текст последней песни. Там столько скрытых смыслов и метафор! Поделитесь своими интерпретациями.',
    createdAt: new Date('2024-02-21T14:00:00'), replyCount: 31, lastActivity: new Date('2024-02-23T10:00:00'),
    replies: [
      { id: 'r11', topicId: 't4', authorName: 'София', content: 'Мне кажется, второй куплет — про принятие себя.', createdAt: new Date('2024-02-21T16:00:00'), likes: 11 },
      { id: 'r12', topicId: 't4', authorName: 'Алексей', content: 'А припев — отсылка к их ранним работам!', createdAt: new Date('2024-02-22T10:00:00'), likes: 9 },
    ],
  },
  t5: {
    id: 't5', sectionId: 'music', title: 'Каверы на AloeVera — делимся',
    authorName: 'Александр', content: 'Записали кавер? Скидывайте сюда! Давайте поддержим друг друга.',
    createdAt: new Date('2024-02-18T10:00:00'), replyCount: 15, lastActivity: new Date('2024-02-22T20:15:00'),
    replies: [
      { id: 'r13', topicId: 't5', authorId: '2', authorName: 'Дмитрий', content: 'Вот мой кавер на гитаре: [ссылка]. Не судите строго 😅', createdAt: new Date('2024-02-18T15:00:00'), likes: 18 },
      { id: 'r14', topicId: 't5', authorId: '1', authorName: 'Анна', content: 'Круто! А я пою — может запишем коллаб?', createdAt: new Date('2024-02-19T09:00:00'), likes: 10 },
    ],
  },
  t6: {
    id: 't6', sectionId: 'music', title: 'Аккорды и табы для гитары',
    authorId: '2', authorName: 'Дмитрий', content: 'Собираем аккорды ко всем песням AloeVera. Кто знает — добавляйте!',
    createdAt: new Date('2024-02-15T08:00:00'), replyCount: 8, lastActivity: new Date('2024-02-21T14:20:00'), isPinned: true,
    replies: [
      { id: 'r15', topicId: 't6', authorName: 'Александр', content: '"Сладкая жизнь": Am - F - C - G, каподастр на 2-м ладу.', createdAt: new Date('2024-02-15T12:00:00'), likes: 22 },
    ],
  },
  t7: {
    id: 't7', sectionId: 'music', title: 'Плейлисты похожих исполнителей',
    authorName: 'София', content: 'Если вам нравится AloeVera, послушайте этих исполнителей. Делитесь своими находками!',
    createdAt: new Date('2024-02-20T10:00:00'), replyCount: 22, lastActivity: new Date('2024-02-22T18:00:00'),
    replies: [
      { id: 'r16', topicId: 't7', authorId: '3', authorName: 'Елена', content: 'Очень похожий вайб у группы "Лунный свет"!', createdAt: new Date('2024-02-20T14:00:00'), likes: 7 },
      { id: 'r17', topicId: 't7', authorId: '4', authorName: 'Мария', content: 'Советую послушать "Тени" — та же атмосфера.', createdAt: new Date('2024-02-22T18:00:00'), likes: 5 },
    ],
  },
  t8: {
    id: 't8', sectionId: 'cities', title: 'Москва — встречи фанатов',
    authorId: '1', authorName: 'Анна', content: 'Московские фанаты, давайте организуем встречу! Можно в кафе или на прогулке.',
    createdAt: new Date('2024-02-17T10:00:00'), replyCount: 35, lastActivity: new Date('2024-02-23T08:00:00'),
    replies: [
      { id: 'r18', topicId: 't8', authorName: 'Алексей', content: 'Я за! Предлагаю в эту субботу в центре.', createdAt: new Date('2024-02-17T14:00:00'), likes: 8 },
      { id: 'r19', topicId: 't8', authorId: '2', authorName: 'Дмитрий', content: 'Может в парке Горького?', createdAt: new Date('2024-02-18T09:00:00'), likes: 12 },
    ],
  },
  t9: {
    id: 't9', sectionId: 'cities', title: 'Санкт-Петербург — кто тут?',
    authorId: '2', authorName: 'Дмитрий', content: 'Питерские фанаты AloeVera, объединяемся! Кто из Питера?',
    createdAt: new Date('2024-02-18T08:00:00'), replyCount: 19, lastActivity: new Date('2024-02-22T14:20:00'),
    replies: [
      { id: 'r20', topicId: 't9', authorName: 'София', content: 'Я из Питера! Можем встретиться на Невском.', createdAt: new Date('2024-02-18T12:00:00'), likes: 6 },
    ],
  },
  t10: {
    id: 't10', sectionId: 'cities', title: 'Новосибирск — ищем компанию на концерт',
    authorId: '3', authorName: 'Елена', content: 'Концерт AloeVera в Новосибирске через месяц. Ищем попутчиков и компанию!',
    createdAt: new Date('2024-02-19T08:00:00'), replyCount: 7, lastActivity: new Date('2024-02-21T12:00:00'),
    replies: [
      { id: 'r21', topicId: 't10', authorId: '4', authorName: 'Мария', content: 'Я тоже иду! Давайте встретимся у входа.', createdAt: new Date('2024-02-19T14:00:00'), likes: 3 },
    ],
  },
  t11: {
    id: 't11', sectionId: 'offtopic', title: 'Кто смотрел новый фильм?',
    authorName: 'Алексей', content: 'Посмотрел новый фильм — очень понравился! Кто ещё смотрел? Обсудим!',
    createdAt: new Date('2024-02-20T18:00:00'), replyCount: 12, lastActivity: new Date('2024-02-22T20:15:00'),
    replies: [
      { id: 'r22', topicId: 't11', authorId: '1', authorName: 'Анна', content: 'Да, отличный фильм! Концовка неожиданная.', createdAt: new Date('2024-02-20T20:00:00'), likes: 4 },
      { id: 'r23', topicId: 't11', authorId: '2', authorName: 'Дмитрий', content: 'Не понравился, если честно. Ожидал большего.', createdAt: new Date('2024-02-21T10:00:00'), likes: 2 },
    ],
  },
  t12: {
    id: 't12', sectionId: 'offtopic', title: 'Рекомендации книг',
    authorId: '4', authorName: 'Мария', content: 'Что почитать? Делитесь любимыми книгами! Любой жанр подойдёт.',
    createdAt: new Date('2024-02-19T10:00:00'), replyCount: 9, lastActivity: new Date('2024-02-21T18:30:00'),
    replies: [
      { id: 'r24', topicId: 't12', authorName: 'София', content: 'Советую "Маленький принц" — вечная классика.', createdAt: new Date('2024-02-19T14:00:00'), likes: 8 },
      { id: 'r25', topicId: 't12', authorId: '3', authorName: 'Елена', content: '"1984" Оруэлла — очень актуально сейчас.', createdAt: new Date('2024-02-20T09:00:00'), likes: 6 },
    ],
  },
};
