import type { User } from '@/types/user';

export const mockUsers: (User & { email: string })[] = [
  {
    id: 'user-1',
    name: 'Алиса Иванова',
    email: 'alice@example.com',
    age: 25,
    bio: 'Люблю музыку и путешествия',
    location: 'Москва',
    gender: 'female',
    profileImage: '/placeholder.svg',
    images: ['/placeholder.svg'],
    lastSeen: new Date(),
    isOnline: true,
    preferences: {
      ageRange: [20, 35],
      maxDistance: 50,
      showMe: 'everyone',
    },
    settings: {
      profileVisibility: 'public',
      anonymousLikes: false,
      language: 'ru',
      notifications: true,
    },
  },
  {
    id: 'user-2',
    name: 'Борис Петров',
    email: 'boris@example.com',
    age: 28,
    bio: 'Фанат Aloe Vera',
    location: 'Санкт-Петербург',
    gender: 'male',
    profileImage: '/placeholder.svg',
    images: ['/placeholder.svg'],
    lastSeen: new Date(),
    isOnline: false,
    preferences: {
      ageRange: [22, 32],
      maxDistance: 30,
      showMe: 'women',
    },
    settings: {
      profileVisibility: 'public',
      anonymousLikes: true,
      language: 'ru',
      notifications: true,
    },
  },
];
