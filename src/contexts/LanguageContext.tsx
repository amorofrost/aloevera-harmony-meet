import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
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

    // Location
    'location.country': 'Страна',
    'location.region': 'Регион',
    'location.useCustomValue': 'Указать своё значение…',
    'location.regionUnavailable': 'Фильтр по региону недоступен для этой страны',
    'location.clearCountry': 'Очистить страну',
    'location.addSecond': '+ Добавить вторую локацию',
    'location.removeSecond': 'Убрать',
    'location.secondary': 'Дополнительная локация',

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
    'profile.savePhoto': 'Сохранить фото',
    'profile.savingPhoto': 'Сохранение...',
    'profile.photoUpdated': 'Фото обновлено',
    'profile.photoUploadFailed': 'Не удалось загрузить фото',
    'profile.photoTooLarge': 'Файл слишком большой. Максимальный размер — 20 МБ',
    'profile.instagram': 'Instagram',
    'profile.instagramPlaceholder': 'username (без @)',

    // Search
    'search.title': 'Найди тех самых',
    'search.noMoreProfiles': 'Больше профилей пока нет',
    'search.swipeInstructions': 'Свайп вправо - лайк, влево - пропустить, вверх - подробнее',
    'search.moreInfo': 'Подробнее',
    'search.lessInfo': 'Скрыть подробности',
    'search.eventsCount': 'Событий посещено: {count}',
    'search.scrollPrompts': '↕ Прокрутите, чтобы увидеть {count} ответа(ов)',
    'search.filter': 'Фильтр',
    'search.applyFilter': 'Применить',
    'search.clearFilter': 'Сбросить фильтры',
    'search.allCountries': 'Все страны',
    'search.allRegions': 'Все регионы',

    // Events
    'events.title': 'События АлоэВера',
    'events.join': 'Присоединиться',
    'events.joined': 'Ты участвуешь',
    'events.interested': 'Интересно',
    'events.interestedShort': 'Интересно',
    'events.notInterested': 'Не интересно',
    'events.attendees': 'участников',
    'events.interestedCount': 'интересуется',
    'events.attendWithInvite': 'Подтвердить участие по коду',
    'events.inviteCodeLabel': 'Код приглашения',
    'events.inviteCodePlaceholder': 'Введите код с приглашения или из ссылки',
    'events.inviteDevHint': 'Локальный mock-бэкенд: код вида MOCK-ATTEND-{id события}',
    'events.applyCode': 'Показать детали по коду',
    'events.externalLink': 'Сайт и билеты',
    'events.leaveEvent': 'Покинуть событие',

    // Store (merch)
    'store.officialPurchase': 'Купить на официальном сайте',
    'store.officialPurchaseHint': 'Откроется страница товара в официальном магазине',
    'store.noPurchaseLink': 'Ссылка на магазин пока не указана',
    'store.listOfficialLink': 'Официальный магазин',

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
    'welcome.title': 'Добро пожаловать в Клуб АлоэВера',
    'welcome.subtitle': 'Знакомства и общение для тех, кто на одной волне',
    'welcome.description': 'Ты в правильном месте. Здесь ты найдешь людей, которые разделяют твой вайб и взгляды на жизнь.',
    'welcome.getStarted': 'Начать общение',
    
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
    'register.inviteCode': 'Инвайт-код',
    'register.inviteCodePlaceholder': 'Введите инвайт-код',
    'register.inviteCodeOptional': 'необязательно',
    'register.inviteCodeHint': 'Если у вас есть код приглашения на событие, введите его здесь.',
    'invite.banner': 'У вас есть инвайт-код. Войдите или создайте аккаунт, чтобы воспользоваться им.',
    // Forgot password modal
    'auth.forgotPassword': 'Забыли пароль?',
    'auth.telegram': 'Войти через Telegram',
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
    'forum.lockedSection': 'Только для активных участников+',
    'forum.replyRestricted': 'Ответы доступны только активным участникам',
    'forum.noviceVisible': 'Видно новичкам',
    'forum.noviceCanReply': 'Новички могут отвечать',
    'forum.editReply': 'Изменить',
    'forum.saveEdit': 'Сохранить',
    'forum.cancelEdit': 'Отмена',
    'forum.savingEdit': 'Сохранение...',
    'forum.editPlaceholder': 'Измените ваш ответ...',
    'forum.editFailed': 'Не удалось сохранить изменения',
    'forum.editedBy': 'изменено {name} · {date}',

    // Ranks & staff roles
    'rank.novice': 'Новичок',
    'rank.activeMember': 'Активный участник',
    'rank.friendOfAloe': 'Друг AloeVera',
    'rank.aloeCrew': 'Команда AloeVera',
    'staffRole.moderator': 'Мод',
    'staffRole.admin': 'Админ',

    // Common Ground
    'commonGround.title': 'Общее',
    'commonGround.sharedEventsMany': 'Вы оба участвовали в {count} событиях АлоэВера',
    'commonGround.sharedEventOne': 'Вы оба были на {event}',
    'commonGround.sharedUpcomingEvent': 'Оба идут на {event}',
    'commonGround.sharedPromptAnswer': '{prompt}: {answer}',
    'commonGround.sharedRank.aloeCrew': 'Оба — Aloe Crew',
    'commonGround.sharedRank.friendOfAloe': 'Оба — Friend of Aloe',
    'commonGround.sharedCity': 'Оба из {city}',

    // Settings - Photos
    'settings.photos.title': 'Фотографии',
    'settings.photos.add': 'Добавить фото',
    'settings.photos.delete': 'Удалить',
    'settings.photos.dragHint': 'Перетащите, чтобы изменить порядок',
    'settings.photos.save': 'Сохранить',
    'settings.photos.saveSuccess': 'Фото сохранены',
    'settings.photos.saveFailed': 'Не удалось сохранить фото',
    'settings.photos.uploadFailed': 'Не удалось загрузить фото',

    // Settings - Prompts
    'settings.prompts.title': 'Подсказки',
    'settings.prompts.placeholder': 'Выберите вопрос',
    'settings.prompts.pickFromList': 'Выбрать из списка',
    'settings.prompts.answerPlaceholder': 'Ваш ответ',
    'settings.prompts.save': 'Сохранить',
    'settings.prompts.saveSuccess': 'Подсказки сохранены',
    'settings.prompts.saveFailed': 'Не удалось сохранить подсказки',

    // Notifications
    'notifications.bell': 'Уведомления',
    'notifications.markAllRead': 'Отметить все прочитанными',
    'notifications.seeAll': 'Все уведомления',
    'notifications.empty': 'Уведомлений пока нет',
    'notifications.unread': 'Непрочитанные',
    'notifications.all': 'Все',
    'notifications.dismiss': 'Скрыть',
    'notifications.title.likeReceived': '{actor} лайкнул(а) вас',
    'notifications.title.likeReceivedAnonymous': 'Кто-то лайкнул вас',
    'notifications.title.matchCreated': 'Взаимная симпатия с {actor}',
    'notifications.title.messageReceived': '{actor}: {preview}',
    'notifications.title.forumReply': '{actor} ответил(а) в обсуждении',
    'notifications.title.communityBroadcast': '{title}',
    'notifications.title.eventPublished': 'Новое событие: {title}',
    'notifications.title.eventReminder': 'Завтра: {title}',
    'notifications.title.eventInvite': 'Вас пригласили: {title}',
    'notifications.title.rankUp': 'Новый ранг: {rank}!',
    'notifications.settings.title': 'Уведомления',
    'notifications.settings.pauseAll': 'Отключить все уведомления',
    'notifications.settings.snoozeFor': 'Тишина на',
    'notifications.settings.snoozeNever': 'Не активна',
    'notifications.settings.snooze1h': '1 час',
    'notifications.settings.snooze4h': '4 часа',
    'notifications.settings.snooze24h': '24 часа',
    'notifications.settings.dailyHour': 'Ежедневная рассылка (UTC)',
    'notifications.settings.channel.inApp': 'В приложении',
    'notifications.settings.channel.telegram': 'Telegram',
    'notifications.settings.channel.webPush': 'Уведомления браузера',
    'notifications.settings.channel.email': 'Email',
    'notifications.settings.frequency.immediate': 'Сразу',
    'notifications.settings.frequency.hourly': 'Раз в час',
    'notifications.settings.frequency.daily': 'Раз в день',
    'notifications.settings.unavailable.telegram': 'Привяжите Telegram, чтобы включить',
    'notifications.settings.unavailable.webPush': 'Включить на этом устройстве',
    'notifications.settings.unavailable.email': 'Подтвердите email, чтобы включить',
    'notifications.settings.type.likeReceived': 'Новые лайки',
    'notifications.settings.type.matchCreated': 'Новые взаимные симпатии',
    'notifications.settings.type.messageReceived': 'Личные сообщения',
    'notifications.settings.type.forumReplyToThread': 'Ответы в обсуждениях',
    'notifications.settings.type.communityBroadcast': 'Объявления сообщества',
    'notifications.settings.type.eventPublished': 'Новые события',
    'notifications.settings.type.eventReminder': 'Напоминания о событиях',
    'notifications.settings.type.eventInviteReceived': 'Приглашения на события',
    'notifications.settings.type.rankUp': 'Повышение ранга',
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

    // Location
    'location.country': 'Country',
    'location.region': 'Region',
    'location.useCustomValue': 'Use custom value…',
    'location.regionUnavailable': 'Region filter not available for this country',
    'location.clearCountry': 'Clear country',
    'location.addSecond': '+ Add second location',
    'location.removeSecond': 'Remove',
    'location.secondary': 'Secondary location',

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
    'profile.savePhoto': 'Save photo',
    'profile.savingPhoto': 'Saving...',
    'profile.photoUpdated': 'Photo updated',
    'profile.photoUploadFailed': 'Failed to upload photo',
    'profile.photoTooLarge': 'File too large. Maximum size is 20 MB',
    'profile.instagram': 'Instagram',
    'profile.instagramPlaceholder': 'username (without @)',

    // Search
    'search.title': 'Find Love',
    'search.noMoreProfiles': 'No more profiles for now',
    'search.swipeInstructions': 'Swipe right to like, left to pass, up for more info',
    'search.moreInfo': 'More info',
    'search.lessInfo': 'Hide details',
    'search.eventsCount': '{count} events attended',
    'search.scrollPrompts': '↕ Scroll for {count} answers',
    'search.filter': 'Filter',
    'search.applyFilter': 'Apply',
    'search.clearFilter': 'Clear filters',
    'search.allCountries': 'All countries',
    'search.allRegions': 'All regions',

    // Events
    'events.title': 'AloeVera Events',
    'events.join': 'Join Event',
    'events.joined': 'Joined',
    'events.interested': 'Interested',
    'events.interestedShort': 'Interest',
    'events.notInterested': 'Not interested',
    'events.attendees': 'attendees',
    'events.interestedCount': 'interested',
    'events.attendWithInvite': 'Confirm attendance with code',
    'events.inviteCodeLabel': 'Invite code',
    'events.inviteCodePlaceholder': 'Enter the code from your invite or link',
    'events.inviteDevHint': 'Local mock API: use MOCK-ATTEND-{event id}',
    'events.applyCode': 'Apply code',
    'events.externalLink': 'Website & tickets',
    'events.leaveEvent': 'Leave event',

    // Store (merch)
    'store.officialPurchase': 'Buy on official store',
    'store.officialPurchaseHint': 'Opens the product page on the band’s official shop',
    'store.noPurchaseLink': 'Store link not set yet',
    'store.listOfficialLink': 'Official store',

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
    'register.inviteCode': 'Invite code',
    'register.inviteCodePlaceholder': 'Enter invite code',
    'register.inviteCodeOptional': 'optional',
    'register.inviteCodeHint': 'If you have an event invite code, enter it here.',
    'invite.banner': 'You have an invite code. Sign in or create an account to use it.',
    // Forgot password modal
    'auth.forgotPassword': 'Forgot password?',
    'auth.telegram': 'Telegram',
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
    'forum.lockedSection': 'Active Member+ only',
    'forum.replyRestricted': 'Replies for Active Members only',
    'forum.noviceVisible': 'Visible to new users',
    'forum.noviceCanReply': 'New users can reply',
    'forum.editReply': 'Edit',
    'forum.saveEdit': 'Save',
    'forum.cancelEdit': 'Cancel',
    'forum.savingEdit': 'Saving...',
    'forum.editPlaceholder': 'Edit your reply...',
    'forum.editFailed': 'Failed to save changes',
    'forum.editedBy': 'edited by {name} · {date}',

    // Ranks & staff roles
    'rank.novice': 'Novice',
    'rank.activeMember': 'Active Member',
    'rank.friendOfAloe': 'Friend of Aloe',
    'rank.aloeCrew': 'Aloe Crew',
    'staffRole.moderator': 'Mod',
    'staffRole.admin': 'Admin',

    // Common Ground
    'commonGround.title': 'In common',
    'commonGround.sharedEventsMany': "You've both been to {count} AloeVera events",
    'commonGround.sharedEventOne': "You've both been to {event}",
    'commonGround.sharedUpcomingEvent': 'Both attending {event}',
    'commonGround.sharedPromptAnswer': '{prompt}: {answer}',
    'commonGround.sharedRank.aloeCrew': 'Both Aloe Crew',
    'commonGround.sharedRank.friendOfAloe': 'Both Friend of Aloe',
    'commonGround.sharedCity': 'Both from {city}',

    // Settings - Photos
    'settings.photos.title': 'Photos',
    'settings.photos.add': 'Add photo',
    'settings.photos.delete': 'Delete',
    'settings.photos.dragHint': 'Drag to reorder',
    'settings.photos.save': 'Save',
    'settings.photos.saveSuccess': 'Photos saved',
    'settings.photos.saveFailed': 'Could not save photos',
    'settings.photos.uploadFailed': 'Could not upload photo',

    // Settings - Prompts
    'settings.prompts.title': 'Prompts',
    'settings.prompts.placeholder': 'Pick a prompt',
    'settings.prompts.pickFromList': 'Pick from list',
    'settings.prompts.answerPlaceholder': 'Your answer',
    'settings.prompts.save': 'Save',
    'settings.prompts.saveSuccess': 'Prompts saved',
    'settings.prompts.saveFailed': 'Could not save prompts',

    // Notifications
    'notifications.bell': 'Notifications',
    'notifications.markAllRead': 'Mark all as read',
    'notifications.seeAll': 'See all',
    'notifications.empty': 'No notifications yet',
    'notifications.unread': 'Unread',
    'notifications.all': 'All',
    'notifications.dismiss': 'Dismiss',
    'notifications.title.likeReceived': '{actor} liked you',
    'notifications.title.likeReceivedAnonymous': 'Someone liked you',
    'notifications.title.matchCreated': 'New match with {actor}',
    'notifications.title.messageReceived': '{actor}: {preview}',
    'notifications.title.forumReply': '{actor} replied in a thread',
    'notifications.title.communityBroadcast': '{title}',
    'notifications.title.eventPublished': 'New event: {title}',
    'notifications.title.eventReminder': 'Event tomorrow: {title}',
    'notifications.title.eventInvite': "You're invited: {title}",
    'notifications.title.rankUp': "You're now {rank}!",
    'notifications.settings.title': 'Notifications',
    'notifications.settings.pauseAll': 'Pause all notifications',
    'notifications.settings.snoozeFor': 'Snooze for',
    'notifications.settings.snoozeNever': 'Never',
    'notifications.settings.snooze1h': '1 hour',
    'notifications.settings.snooze4h': '4 hours',
    'notifications.settings.snooze24h': '24 hours',
    'notifications.settings.dailyHour': 'Daily digest hour (UTC)',
    'notifications.settings.channel.inApp': 'In-app',
    'notifications.settings.channel.telegram': 'Telegram',
    'notifications.settings.channel.webPush': 'Browser push',
    'notifications.settings.channel.email': 'Email',
    'notifications.settings.frequency.immediate': 'Immediate',
    'notifications.settings.frequency.hourly': 'Hourly digest',
    'notifications.settings.frequency.daily': 'Daily digest',
    'notifications.settings.unavailable.telegram': 'Link your Telegram account to enable',
    'notifications.settings.unavailable.webPush': 'Enable on this device',
    'notifications.settings.unavailable.email': 'Verify your email to enable',
    'notifications.settings.type.likeReceived': 'New likes',
    'notifications.settings.type.matchCreated': 'New matches',
    'notifications.settings.type.messageReceived': 'Private messages',
    'notifications.settings.type.forumReplyToThread': 'Forum replies',
    'notifications.settings.type.communityBroadcast': 'Community announcements',
    'notifications.settings.type.eventPublished': 'New events',
    'notifications.settings.type.eventReminder': 'Event reminders',
    'notifications.settings.type.eventInviteReceived': 'Event invitations',
    'notifications.settings.type.rankUp': 'Rank promotions',
  },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ru');

  const t = (key: string, params?: Record<string, string>): string => {
    let str = translations[language][key as keyof typeof translations['ru']] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
