import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { User, UserRank, StaffRole } from '@/types/user';
import { mockSearchProfiles } from '@/data/mockProfiles';
import { mockCurrentUser } from '@/data/mockCurrentUser';

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
    rank: (dto.rank ?? 'novice') as UserRank,
    staffRole: (dto.staffRole ?? 'none') as StaffRole,
  };
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export const usersApi = {
  async getUsers(skip = 0, take = 100): Promise<ApiResponse<User[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>(`/api/v1/users?skip=${skip}&take=${take}`);
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapUserFromApi) };
      }
      return res as ApiResponse<User[]>;
    }
    return mockSuccess(mockSearchProfiles);
  },

  /** Admin only — backend enforces [RequireStaffRole("admin")]. */
  async setStaffRole(userId: string, role: StaffRole): Promise<ApiResponse<{ userId: string; staffRole: StaffRole }>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'API mode only' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.put(`/api/v1/users/${userId}/role`, { role });
  },

  /** Admin only — `null` clears rank override (use computed rank). */
  async setRankOverride(
    userId: string,
    rank: UserRank | null
  ): Promise<ApiResponse<{ userId: string; rankOverride: UserRank | null }>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'API mode only' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.put(`/api/v1/users/${userId}/rank-override`, { rank });
  },

  async getUserById(id: string): Promise<ApiResponse<User | null>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/users/${id}`);
      if (res.success && res.data) {
        return { ...res, data: mapUserFromApi(res.data) };
      }
      return res as ApiResponse<User | null>;
    }
    const user = mockSearchProfiles.find(u => u.id === id) ?? null;
    return mockSuccess(user);
  },

  async getCurrentUser(): Promise<ApiResponse<User | null>> {
    if (isApiMode()) {
      const meRes = await apiClient.get<any>('/api/v1/auth/me');
      if (!meRes.success || !meRes.data?.id) return meRes as ApiResponse<User | null>;
      const userRes = await apiClient.get<any>(`/api/v1/users/${meRes.data.id}`);
      if (userRes.success && userRes.data) {
        return { ...userRes, data: mapUserFromApi(userRes.data) };
      }
      return userRes as ApiResponse<User | null>;
    }
    return mockSuccess(mockCurrentUser);
  },

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User | null>> {
    if (isApiMode()) {
      const res = await apiClient.put<any>(`/api/v1/users/${id}`, updates);
      if (res.success && res.data) {
        return { ...res, data: mapUserFromApi(res.data) };
      }
      return res as ApiResponse<User | null>;
    }
    const user = mockSearchProfiles.find(u => u.id === id) ?? null;
    return mockSuccess(user ? { ...user, ...updates } : null);
  },

  async uploadProfileImage(userId: string, file: File): Promise<ApiResponse<string>> {
    if (isApiMode()) {
      const formData = new FormData();
      formData.append('image', file);
      return apiClient.postForm<string>(`/api/v1/users/${userId}/images`, formData);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return mockSuccess(mockCurrentUser.profileImage);
  },
};
