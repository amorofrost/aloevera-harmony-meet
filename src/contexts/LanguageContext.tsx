import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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
    'nav.talks': 'Форум',
    'nav.friends': 'Друзья',
    'nav.aloevera': 'АлоэВера',
    'nav.settings': 'Настройки',

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
    'search.title': 'Найди тех самых',
    'search.noMoreProfiles': 'Больше профилей пока нет',
    'search.swipeInstructions': 'Свайп вправо - лайк, влево - пропустить',

    // Events
    'events.title': 'События АлоэВера',
    'events.join': 'Присоединиться',
    'events.joined': 'Ты участвуешь',
    'events.attendees': 'участников',

    // Likes
    'likes.matches': 'Взаимности',
    'likes.sent': 'Отправленные',
    'likes.received': 'Полученные',
    'likes.noMatches': 'Пока нет взаимных лайков',
    'likes.noSent': 'Ты пока никого не лайкнул',
    'likes.noReceived': 'Пока нет лайков',

    // Chats
    'chats.private': 'Личные чаты',
    'chats.group': 'Групповые чаты',
    'chats.noPrivateChats': 'Пока нет личных чатов',
    'chats.noGroupChats': 'Пока нет групповых чатов',
    'chats.startChatting': 'Начни общаться',
    'chats.typeMessage': 'Введи сообщение...',
    'chats.send': 'Отправить',

    // Welcome
    'welcome.title': 'Добро пожаловать в мир АлоэВера',
    'welcome.subtitle': 'Знакомства для тех, кто на одной волне',
    'welcome.description': 'Находите единомышленников, влюбляйтесь под любимые мелодии и создавайте гармонию в отношениях.',
    'welcome.getStarted': 'Начать знакомства',
    
    // Auth
    'auth.email': 'Email',
    'auth.password': 'Пароль',
    'auth.signIn': 'Войти',
    'auth.createAccount': 'Создать аккаунт',
    'auth.noAccount': 'Нет аккаунта? Создать',
    'auth.hasAccount': 'Уже есть аккаунт? Войти',
    'auth.age': 'Возраст',
    'auth.gender': 'Пол',
    'auth.location': 'Местоположение',
    'auth.bio': 'О себе',
    'auth.enterEmail': 'Введи свой email',
    'auth.enterPassword': 'Введи пароль',
    'auth.createPassword': 'Создай пароль',
    'auth.cityCountry': 'Город, Страна',
    'auth.aboutYourself': 'Расскажи о себе...',
    'auth.male': 'Мужской',
    'auth.female': 'Женский',
    'auth.other': 'Другой',
    // Forgot password modal
    'auth.forgotPassword': 'Забыли пароль?',
    'forgotPassword.title': 'Восстановление пароля',
    'forgotPassword.emailLabel': 'Email',
    'forgotPassword.submitButton': 'Отправить ссылку',
    'forgotPassword.successMessage': 'Если этот email зарегистрирован, вы получите ссылку для сброса пароля.',
    'forgotPassword.closeButton': 'Закрыть',
    'forgotPassword.errorFallback': 'Не удалось отправить ссылку для сброса пароля',
    // Email verification page
    'verifyEmail.loading': 'Подтверждаем email...',
    'verifyEmail.success': 'Email подтверждён! Теперь вы можете войти.',
    'verifyEmail.successButton': 'Войти',
    'verifyEmail.error': 'Ссылка недействительна или устарела.',
    'verifyEmail.errorButton': 'На главную',
    // Reset password page
    'resetPassword.title': 'Новый пароль',
    'resetPassword.passwordLabel': 'Новый пароль',
    'resetPassword.confirmLabel': 'Подтвердите пароль',
    'resetPassword.submitButton': 'Сохранить пароль',
    'resetPassword.successToast': 'Пароль изменён. Войдите с новым паролем.',
    'resetPassword.errorFallback': 'Не удалось изменить пароль',
    'resetPassword.passwordMismatch': 'Пароли не совпадают',

    // Forum
    'forum.createTopic.titlePrefix': 'Новая тема в',
    'forum.createTopic.titleLabel': 'Заголовок',
    'forum.createTopic.titlePlaceholder': 'Заголовок темы...',
    'forum.createTopic.contentLabel': 'Содержание',
    'forum.createTopic.contentPlaceholder': 'Напишите ваш пост...',
    'forum.createTopic.posting': 'Публикация...',
    'forum.createTopic.post': 'Опубликовать',
    'forum.newTopic': '+ Новая тема',
  },
  en: {
    // Navigation
    'nav.profile': 'Profile',
    'nav.search': 'Search',
    'nav.events': 'Events',
    'nav.likes': 'Likes',
    'nav.chats': 'Chats',
    'nav.talks': 'Talks',
    'nav.friends': 'Friends',
    'nav.aloevera': 'AloeVera',
    'nav.settings': 'Settings',

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
    
    // Auth
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.signIn': 'Sign In',
    'auth.createAccount': 'Create Account',
    'auth.noAccount': 'Don\'t have an account? Create one',
    'auth.hasAccount': 'Already have an account? Sign in',
    'auth.age': 'Age',
    'auth.gender': 'Gender',
    'auth.location': 'Location',
    'auth.bio': 'Bio',
    'auth.enterEmail': 'Enter your email',
    'auth.enterPassword': 'Enter your password',
    'auth.createPassword': 'Create a password',
    'auth.cityCountry': 'City, Country',
    'auth.aboutYourself': 'Tell us about yourself...',
    'auth.male': 'Male',
    'auth.female': 'Female',
    'auth.other': 'Other',
    // Forgot password modal
    'auth.forgotPassword': 'Forgot password?',
    'forgotPassword.title': 'Reset Password',
    'forgotPassword.emailLabel': 'Email',
    'forgotPassword.submitButton': 'Send Reset Link',
    'forgotPassword.successMessage': "If that email is registered, you'll receive a reset link shortly.",
    'forgotPassword.closeButton': 'Close',
    'forgotPassword.errorFallback': 'Failed to send reset link',
    // Email verification page
    'verifyEmail.loading': 'Verifying your email...',
    'verifyEmail.success': 'Email verified! You can now sign in.',
    'verifyEmail.successButton': 'Sign In',
    'verifyEmail.error': 'This link is invalid or has expired.',
    'verifyEmail.errorButton': 'Go Home',
    // Reset password page
    'resetPassword.title': 'Set New Password',
    'resetPassword.passwordLabel': 'New Password',
    'resetPassword.confirmLabel': 'Confirm Password',
    'resetPassword.submitButton': 'Save Password',
    'resetPassword.successToast': 'Password changed. Sign in with your new password.',
    'resetPassword.errorFallback': 'Failed to reset password',
    'resetPassword.passwordMismatch': 'Passwords do not match',

    // Forum
    'forum.createTopic.titlePrefix': 'New Topic in',
    'forum.createTopic.titleLabel': 'Title',
    'forum.createTopic.titlePlaceholder': 'Topic title...',
    'forum.createTopic.contentLabel': 'Content',
    'forum.createTopic.contentPlaceholder': 'Write your post...',
    'forum.createTopic.posting': 'Posting...',
    'forum.createTopic.post': 'Post Topic',
    'forum.newTopic': '+ New Topic',
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
