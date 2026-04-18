import type { User } from '@/types/user';
import { mockSongs } from './mockSongs';
import { mockEvents } from './mockEvents';

export const mockCurrentUser: User = {
  id: 'current-user',
  name: 'Александра',
  age: 26,
  bio: 'Фанатка AloeVera с 2018 года. Люблю концерты, арт и хорошую компанию 🎵',
  location: 'Москва',
  gender: 'female',
  profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face',
  images: [],
  lastSeen: new Date(),
  isOnline: true,
  eventsAttended: [mockEvents[3], mockEvents[5], mockEvents[6]],
  favoriteSong: mockSongs[0],
  preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
  settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  rank: 'novice',
  staffRole: 'none',
};
