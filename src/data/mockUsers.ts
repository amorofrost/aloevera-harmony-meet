import type { User, PromptAnswer } from '@/types/user';

export const mockUsers: (User & { email: string; password: string })[] = [
  {
    id: 'user-1',
    name: 'Алиса Иванова',
    email: 'alice@example.com',
    password: 'Test123!@#',
    age: 25,
    bio: 'Люблю музыку и путешествия',
    location: 'Москва',
    gender: 'female',
    profileImage: '/placeholder.svg',
    images: [
      '/placeholder.svg',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    ],
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
    rank: 'novice',
    staffRole: 'none',
    prompts: [
      {
        promptId: 'aloevera_song',
        answer: 'Hometown — её играют каждый раз бис на моих любимых концертах',
      },
      {
        promptId: 'looking_for',
        answer: 'Тех, кто поедет на следующий тур в другие города',
      },
    ] as PromptAnswer[],
  },
  {
    id: 'user-2',
    name: 'Борис Петров',
    email: 'boris@example.com',
    password: 'Test123!@#',
    age: 28,
    bio: 'Фанат Aloe Vera',
    location: 'Санкт-Петербург',
    gender: 'male',
    profileImage: '/placeholder.svg',
    images: [
      '/placeholder.svg',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    ],
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
    rank: 'novice',
    staffRole: 'none',
    prompts: [
      {
        promptId: 'concert_memory',
        answer: 'Когда с друзьями спели куплет «С тобой становится теплей» после концерта',
      },
      {
        promptId: 'playlist',
        answer: 'Много инди-рока и пост-панка, но Aloe Vera занимает первое место',
      },
    ] as PromptAnswer[],
  },
];
