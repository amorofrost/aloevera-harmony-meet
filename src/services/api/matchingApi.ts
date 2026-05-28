import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { User, Like, Match } from '@/types/user';
import {
  mockSearchProfiles,
  mockMatches, mockSentLikes, mockReceivedLikes,
  type MatchWithUser, type SentLikeWithUser, type ReceivedLikeWithUser,
} from '@/data/mockProfiles';
import { usersApi, mapUserFromApi } from './usersApi';

// Decode the stored JWT to get the current user's ID without an extra API call.
// .NET serialises ClaimTypes.NameIdentifier as "nameid" in the JWT payload.
export function getCurrentUserIdFromToken(): string {
  const token = apiClient.getAccessToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload['nameid']
      ?? payload['sub']
      ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
      ?? '';
  } catch {
    return '';
  }
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

// Resolve exactly the users referenced by a list (likes/matches), keyed by id.
// These users are intentionally excluded from the search deck, so they must be
// fetched explicitly rather than joined against a deck batch.
async function resolveUsersById(ids: string[]): Promise<Map<string, User>> {
  const res = await usersApi.getUsersByIds(ids);
  const users = res.success && res.data ? res.data : [];
  return new Map(users.map(u => [u.id, u]));
}

const UNKNOWN_USER_STUB = (id: string): User => ({
  id, name: 'Пользователь', age: 0, bio: '', location: '', country: '', region: '',
  gender: 'prefer-not-to-say' as const,
  profileImage: '', images: [], lastSeen: new Date(), isOnline: false,
  preferences: { ageRange: [18, 65] as [number, number], maxDistance: 50, showMe: 'everyone' as const },
  settings: { profileVisibility: 'public' as const, anonymousLikes: false, language: 'ru' as const, notifications: true },
  rank: 'novice' as const, staffRole: 'none' as const,
});

export const matchingApi = {
  async getSearchProfiles(): Promise<ApiResponse<User[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/users?skip=0&take=50');
      if (res.success && res.data) {
        const myId = getCurrentUserIdFromToken();
        return { ...res, data: res.data.filter((u: any) => u.id !== myId).map(mapUserFromApi) };
      }
      return res as ApiResponse<User[]>;
    }
    const myId = getCurrentUserIdFromToken();
    return mockSuccess(mockSearchProfiles.filter(u => u.id !== myId));
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

      const myId = getCurrentUserIdFromToken();
      const otherIds = res.data.map((dto: any) => (dto.users as string[]).find(id => id !== myId) ?? '');
      const usersById = await resolveUsersById(otherIds);

      const enriched: MatchWithUser[] = res.data.map((dto: any): MatchWithUser => {
        const otherUserId = (dto.users as string[]).find(id => id !== myId) ?? '';
        const otherUser = usersById.get(otherUserId) ?? UNKNOWN_USER_STUB(otherUserId);
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

      const usersById = await resolveUsersById(res.data.map((dto: any) => dto.toUserId));

      const enriched: SentLikeWithUser[] = res.data.map((dto: any): SentLikeWithUser => {
        const toUser = usersById.get(dto.toUserId) ?? UNKNOWN_USER_STUB(dto.toUserId);
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

      const usersById = await resolveUsersById(res.data.map((dto: any) => dto.fromUserId));

      const enriched: ReceivedLikeWithUser[] = res.data.map((dto: any): ReceivedLikeWithUser => {
        const fromUser = usersById.get(dto.fromUserId) ?? UNKNOWN_USER_STUB(dto.fromUserId);
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
