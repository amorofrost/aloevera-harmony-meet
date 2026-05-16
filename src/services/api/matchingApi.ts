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

// Module-level promise cache — getMatches/getSentLikes/getReceivedLikes are called
// concurrently on page load so they all share one network request.
let _allUsersFetch: Promise<User[]> | null = null;
let _allUsersFetchAt = 0;
const ALL_USERS_TTL = 30_000;

async function getAllUsers(): Promise<User[]> {
  const now = Date.now();
  if (_allUsersFetch && now - _allUsersFetchAt < ALL_USERS_TTL) return _allUsersFetch;
  _allUsersFetchAt = now;
  _allUsersFetch = usersApi.getUsers({ skip: 0, take: 500 }).then(res =>
    res.success && res.data ? res.data : []
  );
  return _allUsersFetch;
}

const UNKNOWN_USER_STUB = (id: string): User => ({
  id, name: 'Пользователь', age: 0, bio: '', location: '', gender: 'prefer-not-to-say' as const,
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

      const allUsers = await getAllUsers();
      const myId = getCurrentUserIdFromToken();

      const enriched: MatchWithUser[] = res.data.map((dto: any): MatchWithUser => {
        const otherUserId = (dto.users as string[]).find(id => id !== myId) ?? '';
        const otherUser = allUsers.find(u => u.id === otherUserId) ?? UNKNOWN_USER_STUB(otherUserId);
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

      const allUsers = await getAllUsers();

      const enriched: SentLikeWithUser[] = res.data.map((dto: any): SentLikeWithUser => {
        const toUser = allUsers.find(u => u.id === dto.toUserId) ?? UNKNOWN_USER_STUB(dto.toUserId);
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

      const allUsers = await getAllUsers();

      const enriched: ReceivedLikeWithUser[] = res.data.map((dto: any): ReceivedLikeWithUser => {
        const fromUser = allUsers.find(u => u.id === dto.fromUserId) ?? UNKNOWN_USER_STUB(dto.fromUserId);
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
