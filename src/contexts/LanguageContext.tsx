import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

const translations = {
  ru: {
    // Navigation
    'nav.profile': 'Профиль',
    'nav.search': 'Поиск',
    'nav.events': 'События',
    'nav.likes': 'Лайки',
    'nav.chats': 'Чаты',
    'nav.advice': 'Советы',

    // Common
    'common.like': 'Лайк',
    'common.pass': 'Пропустить',
    'common.match': 'Взаимность!',
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.loading': 'Загрузка...',
    'common.error': 'Ошибка',

    // Profile
    'profile.title': 'Ваш профиль',
    'profile.edit': 'Редактировать профиль',
    'profile.name': 'Имя',
    'profile.age': 'Возраст',
    'profile.bio': 'О себе',
    'profile.location': 'Местоположение',
    'profile.gender': 'Пол',
    'profile.settings': 'Настройки',
    'profile.signOut': 'Выйти',

    // Search
    'search.title': 'Найти любовь',
    'search.noMoreProfiles': 'Больше профилей пока нет',
    'search.swipeInstructions': 'Свайп вправо - лайк, влево - пропустить',

    // Events
    'events.title': 'События AloeVera',
    'events.join': 'Присоединиться',
    'events.joined': 'Вы участвуете',
    'events.attendees': 'участников',

    // Likes
    'likes.matches': 'Взаимности',
    'likes.sent': 'Отправленные',
    'likes.received': 'Полученные',
    'likes.noMatches': 'Пока нет взаимных лайков',
    'likes.noSent': 'Вы пока никого не лайкнули',
    'likes.noReceived': 'Пока никто вас не лайкнул',

    // Chats
    'chats.private': 'Личные чаты',
    'chats.group': 'Групповые чаты',
    'chats.noPrivateChats': 'Пока нет личных чатов',
    'chats.noGroupChats': 'Пока нет групповых чатов',
    'chats.startChatting': 'Начните общаться с вашими совпадениями',
    'chats.typeMessage': 'Введите сообщение...',
    'chats.send': 'Отправить',

    // Welcome
    'welcome.title': 'Добро пожаловать в мир AloeVera',
    'welcome.subtitle': 'Знакомства для фанатов музыки',
    'welcome.description': 'Находите единомышленников, влюбляйтесь под любимые мелодии и создавайте гармонию в отношениях.',
    'welcome.getStarted': 'Начать знакомства',
  },
  en: {
    // Navigation
    'nav.profile': 'Profile',
    'nav.search': 'Search',
    'nav.events': 'Events',
    'nav.likes': 'Likes',
    'nav.chats': 'Chats',
    'nav.advice': 'Advice',

    // Common
    'common.like': 'Like',
    'common.pass': 'Pass',
    'common.match': 'It\'s a Match!',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'common.error': 'Error',

    // Profile
    'profile.title': 'Your Profile',
    'profile.edit': 'Edit Profile',
    'profile.name': 'Name',
    'profile.age': 'Age',
    'profile.bio': 'Bio',
    'profile.location': 'Location',
    'profile.gender': 'Gender',
    'profile.settings': 'Settings',
    'profile.signOut': 'Sign Out',

    // Search
    'search.title': 'Find Love',
    'search.noMoreProfiles': 'No more profiles for now',
    'search.swipeInstructions': 'Swipe right to like, left to pass',

    // Events
    'events.title': 'AloeVera Events',
    'events.join': 'Join Event',
    'events.joined': 'Joined',
    'events.attendees': 'attendees',

    // Likes
    'likes.matches': 'Matches',
    'likes.sent': 'Sent',
    'likes.received': 'Received',
    'likes.noMatches': 'No matches yet',
    'likes.noSent': 'No likes sent yet',
    'likes.noReceived': 'No likes received yet',

    // Chats
    'chats.private': 'Private Chats',
    'chats.group': 'Group Chats',
    'chats.noPrivateChats': 'No private chats yet',
    'chats.noGroupChats': 'No group chats yet',
    'chats.startChatting': 'Start chatting with your matches',
    'chats.typeMessage': 'Type a message...',
    'chats.send': 'Send',

    // Welcome
    'welcome.title': 'Welcome to AloeVera World',
    'welcome.subtitle': 'Dating for Music Lovers',
    'welcome.description': 'Find like-minded people, fall in love to your favorite melodies, and create harmony in relationships.',
    'welcome.getStarted': 'Start Dating',
  },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ru');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['ru']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};