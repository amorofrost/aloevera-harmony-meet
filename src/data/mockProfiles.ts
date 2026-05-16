import type { User, Match, Like, PromptAnswer } from '@/types/user';
import { mockSongs } from './mockSongs';
import { mockEvents } from './mockEvents';

export const mockSearchProfiles: User[] = [
  {
    id: '1', name: 'Анна', age: 25,
    bio: 'Обожаю музыку AloeVera и концерты под открытым небом ❤️',
    country: 'RU', region: 'Москва', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    ],
    lastSeen: new Date(), isOnline: true,
    eventsAttended: [mockEvents[0]],
    favoriteSong: mockSongs[0],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    rank: 'novice', staffRole: 'none',
    prompts: [
      {
        promptId: 'concert_memory',
        answer: 'Лучший момент — это когда весь зал поёт припев «Давайте разговаривать»',
      },
      {
        promptId: 'looking_for',
        answer: 'Тех, с кем можно поехать на любой концерт АлоэВера',
      },
    ] as PromptAnswer[],
  },
  {
    id: '2', name: 'Дмитрий', age: 28,
    bio: 'Музыкант, фанат AloeVera с первого альбома 🎸',
    country: 'RU', region: 'Санкт-Петербург', location: 'Санкт-Петербург', gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    ],
    lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    rank: 'novice', staffRole: 'none',
    prompts: [
      {
        promptId: 'instrument',
        answer: 'На гитаре, как и все остальные после первого альбома',
      },
      {
        promptId: 'aloevera_first',
        answer: 'Случайно услышал на радио и полюбил с первого слова',
      },
    ] as PromptAnswer[],
  },
  {
    id: '3', name: 'Елена', age: 22,
    bio: 'Танцую под AloeVera 💃',
    country: 'RU', region: 'Новосибирск', location: 'Новосибирск', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    eventsAttended: [mockEvents[1], mockEvents[0]],
    favoriteSong: mockSongs[2],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    rank: 'novice', staffRole: 'none',
  },
  {
    id: '4', name: 'Мария', age: 23,
    bio: 'Поэтесса и меломан',
    country: 'RU', region: 'Москва', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    rank: 'novice', staffRole: 'none',
  },
  {
    id: 'mock-user-by', name: 'Аліна', age: 26,
    bio: 'Слухаю AloeVera і мрію потрапити на живий концерт',
    country: 'BY', region: 'Минск', location: 'Минск', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 100, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    rank: 'novice', staffRole: 'none',
    prompts: [
      {
        promptId: 'aloevera_first',
        answer: 'Пачула AloeVera ад сяброўкі і адразу закахалася ў гук',
      },
    ] as PromptAnswer[],
  },
  {
    id: 'mock-user-us', name: 'Sarah', age: 28,
    bio: 'Discovered AloeVera through a friend and fell in love with their sound',
    country: 'US', region: 'California', location: 'San Francisco, USA', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [24, 35], maxDistance: 200, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'en', notifications: true },
    rank: 'novice', staffRole: 'none',
    prompts: [
      {
        promptId: 'looking_for',
        answer: 'Other international fans to connect with before the next tour',
      },
    ] as PromptAnswer[],
  },
  {
    id: 'mock-user-de', name: 'Hannah', age: 30,
    bio: 'Musikliebhaberin und begeisterte AloeVera-Hörerin aus Berlin',
    country: 'DE', region: 'Berlin', location: 'Berlin', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [25, 40], maxDistance: 150, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'en', notifications: false },
    rank: 'novice', staffRole: 'none',
    prompts: [
      {
        promptId: 'concert_memory',
        answer: 'Heard AloeVera on a playlist and immediately bought tickets to their next show',
      },
    ] as PromptAnswer[],
  },
];

export type MatchWithUser = Match & { otherUser: User; isRead: boolean };
export type SentLikeWithUser = Like & { toUser: User };
export type ReceivedLikeWithUser = Like & { fromUser: User; isRead: boolean };

export const mockMatches: MatchWithUser[] = [
  {
    id: 'm1', users: ['current-user', '1'], createdAt: new Date('2024-02-20'), isRead: false,
    otherUser: {
      id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera', country: 'RU', region: 'Москва', location: 'Москва', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
      rank: 'novice', staffRole: 'none',
    },
  },
];

export const mockSentLikes: SentLikeWithUser[] = [
  {
    id: 'l2', fromUserId: 'current-user', toUserId: '2', createdAt: new Date('2024-02-21'), isMatch: false,
    toUser: {
      id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант', country: 'RU', region: 'Санкт-Петербург', location: 'Санкт-Петербург', gender: 'male',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: false,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
      rank: 'novice', staffRole: 'none',
    },
  },
];

export const mockReceivedLikes: ReceivedLikeWithUser[] = [
  {
    id: 'l3', fromUserId: '3', toUserId: 'current-user', createdAt: new Date('2024-02-19'), isMatch: false, isRead: false,
    fromUser: {
      id: '3', name: 'Елена', age: 22, bio: 'Танцую под AloeVera', country: 'RU', region: 'Новосибирск', location: 'Новосибирск', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
      rank: 'novice', staffRole: 'none',
    },
  },
];
