import type { User, Match, Like } from '@/types/user';
import { mockSongs } from './mockSongs';
import { mockEvents } from './mockEvents';

export const mockSearchProfiles: User[] = [
  {
    id: '1', name: 'Анна', age: 25,
    bio: 'Обожаю музыку AloeVera и концерты под открытым небом ❤️',
    location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    eventsAttended: [mockEvents[0]],
    favoriteSong: mockSongs[0],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
  {
    id: '2', name: 'Дмитрий', age: 28,
    bio: 'Музыкант, фанат AloeVera с первого альбома 🎸',
    location: 'Санкт-Петербург', gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
  {
    id: '3', name: 'Елена', age: 22,
    bio: 'Танцую под AloeVera 💃',
    location: 'Новосибирск', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    eventsAttended: [mockEvents[1], mockEvents[0]],
    favoriteSong: mockSongs[2],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
  {
    id: '4', name: 'Мария', age: 23,
    bio: 'Поэтесса и меломан',
    location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
];

export type MatchWithUser = Match & { otherUser: User; isRead: boolean };
export type SentLikeWithUser = Like & { toUser: User };
export type ReceivedLikeWithUser = Like & { fromUser: User; isRead: boolean };

export const mockMatches: MatchWithUser[] = [
  {
    id: 'm1', users: ['current-user', '1'], createdAt: new Date('2024-02-20'), isRead: false,
    otherUser: {
      id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera', location: 'Москва', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    },
  },
];

export const mockSentLikes: SentLikeWithUser[] = [
  {
    id: 'l2', fromUserId: 'current-user', toUserId: '2', createdAt: new Date('2024-02-21'), isMatch: false,
    toUser: {
      id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант', location: 'Санкт-Петербург', gender: 'male',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: false,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    },
  },
];

export const mockReceivedLikes: ReceivedLikeWithUser[] = [
  {
    id: 'l3', fromUserId: '3', toUserId: 'current-user', createdAt: new Date('2024-02-19'), isMatch: false, isRead: false,
    fromUser: {
      id: '3', name: 'Елена', age: 22, bio: 'Танцую под AloeVera', location: 'Новосибирск', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
      images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
    },
  },
];
