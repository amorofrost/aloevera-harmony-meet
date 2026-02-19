import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { User } from '@/types/user';
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
  };
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export const usersApi = {
  async getUsers(): Promise<ApiResponse<User[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/users');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapUserFromApi) };
      }
      return res as ApiResponse<User[]>;
    }
    return mockSuccess(mockSearchProfiles);
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
      const res = await apiClient.get<any>('/api/v1/auth/me');
      if (res.success && res.data) {
        return { ...res, data: mapUserFromApi(res.data) };
      }
      return res as ApiResponse<User | null>;
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
};
