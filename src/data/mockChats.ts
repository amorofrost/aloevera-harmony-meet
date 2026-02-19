import type { GroupChat, PrivateChat } from '@/types/chat';
import type { User } from '@/types/user';

export const mockChatUsers: Record<string, User> = {
  '1': {
    id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
  '2': {
    id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант, фанат AloeVera', location: 'Санкт-Петербург', gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true },
  },
};

export const mockEventChats: GroupChat[] = [
  {
    id: 'event-1', type: 'group', name: 'Фан-встреча: Поэзия и музыка',
    description: 'Чат для участников встречи',
    participants: ['current-user', '4', '5', '6', '7'],
    isEventChat: true, eventId: '2', adminIds: ['admin-1'],
    createdAt: new Date('2024-02-18'), updatedAt: new Date('2024-02-21'),
    lastMessage: {
      id: 'msg-3', chatId: 'event-1', senderId: '1',
      content: 'Встречаемся у входа в 19:00!',
      timestamp: new Date('2024-02-21T18:00:00'), read: true, type: 'text',
    },
  },
  {
    id: 'event-2', type: 'group', name: 'Концерт AloeVera - Москва',
    description: 'Общение участников концерта',
    participants: ['current-user', '1', '2', '3'],
    isEventChat: true, eventId: '1', adminIds: ['admin-1'],
    createdAt: new Date('2024-02-10'), updatedAt: new Date('2024-02-22'),
    lastMessage: {
      id: 'msg-4', chatId: 'event-2', senderId: '2',
      content: 'Не могу дождаться концерта! 🎵',
      timestamp: new Date('2024-02-22T12:30:00'), read: true, type: 'text',
    },
  },
];

export type PrivateChatWithUser = PrivateChat & { otherUser: User };

export const mockPrivateChats: PrivateChatWithUser[] = [
  {
    id: 'private-1', type: 'private', participants: ['current-user', '1'], matchId: 'match-1',
    createdAt: new Date('2024-02-20'), updatedAt: new Date('2024-02-22'),
    lastMessage: {
      id: 'msg-1', chatId: 'private-1', senderId: '1',
      content: 'Привет! Тоже обожаешь AloeVera?',
      timestamp: new Date('2024-02-22T14:30:00'), read: false, type: 'text',
    },
    otherUser: mockChatUsers['1'],
  },
];
