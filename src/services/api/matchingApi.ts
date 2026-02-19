import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { User, Like, Match } from '@/types/user';
import {
  mockSearchProfiles,
  mockMatches, mockSentLikes, mockReceivedLikes,
  type MatchWithUser, type SentLikeWithUser, type ReceivedLikeWithUser,
} from '@/data/mockProfiles';
import { usersApi } from './usersApi';

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function mapGender(g: string): User['gender'] {
  const map: Record<string, User['gender']> = {
    male: 'male', female: 'female',
    nonBinary: 'non-binary', preferNotToSay: 'prefer-not-to-say',
  };
  return map[g] ?? 'prefer-not-to-say';
}

function mapUserFromApi(dto: any): User {
  return {
    id: dto.id,
    name: dto.name,
    age: dto.age,
    bio: dto.bio ?? '',
    location: dto.location ?? '',
    gender: mapGender(dto.gender),
    profileImage: dto.profileImage ?? '',
    images: dto.images ?? [],
    lastSeen: new Date(dto.lastSeen),
    isOnline: dto.isOnline ?? false,
    preferences: {
      ageRange: [dto.preferences?.ageRangeMin ?? 18, dto.preferences?.ageRangeMax ?? 65],
      maxDistance: dto.preferences?.maxDistance ?? 50,
      showMe: dto.preferences?.showMe ?? 'everyone',
    },
    settings: {
      profileVisibility: dto.settings?.profileVisibility ?? 'public',
      anonymousLikes: dto.settings?.anonymousLikes ?? false,
      language: dto.settings?.language ?? 'ru',
      notifications: dto.settings?.notifications ?? true,
    },
  };
}

export const matchingApi = {
  async getSearchProfiles(): Promise<ApiResponse<User[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/users');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapUserFromApi) };
      }
      return res as ApiResponse<User[]>;
    }
    return mockSuccess(mockSearchProfiles);
  },

  async sendLike(toUserId: string): Promise<ApiResponse<{ isMatch: boolean }>> {
    if (isApiMode()) {
      return apiClient.post<{ isMatch: boolean }>('/api/v1/matching/likes', { toUserId });
    }
    return mockSuccess({ isMatch: false });
  },

  async getMatches(): Promise<ApiResponse<MatchWithUser[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/matching/matches');
      if (!res.success || !res.data) return res as ApiResponse<MatchWithUser[]>;

      const allUsersRes = await usersApi.getUsers();
      const allUsers: User[] = (allUsersRes.success && allUsersRes.data) ? allUsersRes.data : [];

      const enriched: MatchWithUser[] = res.data.map((dto: any): MatchWithUser => {
        const otherUserId = (dto.users as string[]).find(id => id !== 'current-user') ?? '';
        const otherUser = allUsers.find(u => u.id === otherUserId) ?? {
          id: otherUserId, name: 'Пользователь', age: 0, bio: '', location: '', gender: 'prefer-not-to-say' as const,
          profileImage: '', images: [], lastSeen: new Date(), isOnline: false,
          preferences: { ageRange: [18, 65] as [number, number], maxDistance: 50, showMe: 'everyone' as const },
          settings: { profileVisibility: 'public' as const, anonymousLikes: false, language: 'ru' as const, notifications: true },
        };
        const match: Match = {
          id: dto.id,
          users: dto.users as [string, string],
          createdAt: new Date(dto.createdAt),
        };
        return { ...match, otherUser, isRead: true };
      });

      return { ...res, data: enriched };
    }
    return mockSuccess(mockMatches);
  },

  async getSentLikes(): Promise<ApiResponse<SentLikeWithUser[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/matching/likes/sent');
      if (!res.success || !res.data) return res as ApiResponse<SentLikeWithUser[]>;

      const allUsersRes = await usersApi.getUsers();
      const allUsers: User[] = (allUsersRes.success && allUsersRes.data) ? allUsersRes.data : [];

      const enriched: SentLikeWithUser[] = res.data.map((dto: any): SentLikeWithUser => {
        const toUser = allUsers.find(u => u.id === dto.toUserId) ?? {
          id: dto.toUserId, name: 'Пользователь', age: 0, bio: '', location: '', gender: 'prefer-not-to-say' as const,
          profileImage: '', images: [], lastSeen: new Date(), isOnline: false,
          preferences: { ageRange: [18, 65] as [number, number], maxDistance: 50, showMe: 'everyone' as const },
          settings: { profileVisibility: 'public' as const, anonymousLikes: false, language: 'ru' as const, notifications: true },
        };
        const like: Like = {
          id: dto.id, fromUserId: dto.fromUserId, toUserId: dto.toUserId,
          createdAt: new Date(dto.createdAt), isMatch: dto.isMatch,
        };
        return { ...like, toUser };
      });

      return { ...res, data: enriched };
    }
    return mockSuccess(mockSentLikes);
  },

  async getReceivedLikes(): Promise<ApiResponse<ReceivedLikeWithUser[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/matching/likes/received');
      if (!res.success || !res.data) return res as ApiResponse<ReceivedLikeWithUser[]>;

      const allUsersRes = await usersApi.getUsers();
      const allUsers: User[] = (allUsersRes.success && allUsersRes.data) ? allUsersRes.data : [];

      const enriched: ReceivedLikeWithUser[] = res.data.map((dto: any): ReceivedLikeWithUser => {
        const fromUser = allUsers.find(u => u.id === dto.fromUserId) ?? {
          id: dto.fromUserId, name: 'Пользователь', age: 0, bio: '', location: '', gender: 'prefer-not-to-say' as const,
          profileImage: '', images: [], lastSeen: new Date(), isOnline: false,
          preferences: { ageRange: [18, 65] as [number, number], maxDistance: 50, showMe: 'everyone' as const },
          settings: { profileVisibility: 'public' as const, anonymousLikes: false, language: 'ru' as const, notifications: true },
        };
        const like: Like = {
          id: dto.id, fromUserId: dto.fromUserId, toUserId: dto.toUserId,
          createdAt: new Date(dto.createdAt), isMatch: dto.isMatch,
        };
        return { ...like, fromUser, isRead: false };
      });

      return { ...res, data: enriched };
    }
    return mockSuccess(mockReceivedLikes);
  },
};
