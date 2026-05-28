import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { User, UserRank, StaffRole } from '@/types/user';
import { mockSearchProfiles } from '@/data/mockProfiles';
import { mockCurrentUser } from '@/data/mockCurrentUser';
import { mapEventFromApi } from './eventsApi';

function mapGender(g: string): User['gender'] {
  const map: Record<string, User['gender']> = {
    male: 'male', female: 'female',
    nonBinary: 'non-binary', preferNotToSay: 'prefer-not-to-say',
  };
  return map[g] ?? 'prefer-not-to-say';
}

export function mapUserFromApi(dto: any): User {
  return {
    id: dto.id,
    accountName: dto.accountName || undefined,
    name: dto.name,
    age: dto.age,
    bio: dto.bio ?? '',
    location: dto.location ?? '',
    country: dto.country ?? '',
    region: dto.region ?? '',
    secondaryCountry: dto.secondaryCountry ?? '',
    secondaryRegion: dto.secondaryRegion ?? '',
    gender: mapGender(dto.gender),
    profileImage: dto.profileImage ?? '',
    images: dto.images ?? [],
    prompts: dto.prompts ?? undefined,
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
    registrationSourceEventId: dto.registrationSourceEventId,
    instagramHandle: dto.instagramHandle ?? undefined,
    eventsAttended: Array.isArray(dto.attendedEvents)
      ? (dto.attendedEvents as unknown[]).map((ev) => mapEventFromApi(ev))
      : undefined,
  };
}

// Reverse of mapGender — converts frontend hyphenated values back to backend camelCase enum strings.
const genderToApi: Record<string, string> = {
  male: 'male', female: 'female',
  'non-binary': 'nonBinary', 'prefer-not-to-say': 'preferNotToSay',
};

// Converts a frontend User (partial) into the shape the backend UserDto expects.
function mapUserToApi(u: Partial<User>): Record<string, unknown> {
  return {
    id: u.id,
    name: u.name,
    age: u.age,
    bio: u.bio,
    location: u.location,
    country: u.country,
    region: u.region,
    secondaryCountry: u.secondaryCountry,
    secondaryRegion: u.secondaryRegion,
    gender: u.gender ? (genderToApi[u.gender] ?? u.gender) : undefined,
    profileImage: u.profileImage,
    images: u.images,
    prompts: u.prompts,
    isOnline: u.isOnline,
    preferences: u.preferences ? {
      ageRangeMin: u.preferences.ageRange?.[0],
      ageRangeMax: u.preferences.ageRange?.[1],
      maxDistance: u.preferences.maxDistance,
      showMe: u.preferences.showMe,
    } : undefined,
    settings: u.settings,
    favoriteSong: u.favoriteSong,
    instagramHandle: u.instagramHandle ?? '',
    // eventsAttended is omitted — backend populates it from event registrations,
    // and the frontend stores full Event objects which can't be sent as List<string>.
  };
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export interface GetUsersOptions {
  skip?: number;
  take?: number;
  country?: string;
  region?: string;
  /** Exact, case-insensitive match on the user's account name (handle). */
  accountName?: string;
  /** Case-insensitive substring match on display name. */
  name?: string;
  minAge?: number;
  maxAge?: number;
  /** Gender filter; uses the frontend User['gender'] hyphenated values. */
  gender?: User['gender'];
}

// Hyphenated frontend gender → backend camelCase enum string.
const genderToApiQuery: Record<User['gender'], string> = {
  male: 'male',
  female: 'female',
  'non-binary': 'nonBinary',
  'prefer-not-to-say': 'preferNotToSay',
};

export const usersApi = {
  async getUsers(opts: GetUsersOptions = {}): Promise<ApiResponse<User[]>> {
    const {
      skip = 0, take = 100,
      country, region, accountName, name, minAge, maxAge, gender,
    } = opts;
    if (isApiMode()) {
      const params = new URLSearchParams({ skip: String(skip), take: String(take) });
      if (country) params.set('country', country);
      if (region) params.set('region', region);
      if (accountName) params.set('accountName', accountName);
      if (name) params.set('name', name);
      if (typeof minAge === 'number') params.set('minAge', String(minAge));
      if (typeof maxAge === 'number') params.set('maxAge', String(maxAge));
      if (gender) params.set('gender', genderToApiQuery[gender]);
      const res = await apiClient.get<any[]>(`/api/v1/users?${params.toString()}`);
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapUserFromApi) };
      }
      return res as ApiResponse<User[]>;
    }
    // mock-mode filter (mirrors backend GetUsersAsync)
    const ci = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
    let list = mockSearchProfiles as User[];
    if (country && region) {
      list = list.filter(u =>
        (ci(u.country, country) && ci(u.region, region)) ||
        (ci(u.secondaryCountry, country) && ci(u.secondaryRegion, region))
      );
    } else if (country) {
      list = list.filter(u => ci(u.country, country) || ci(u.secondaryCountry, country));
    } else if (region) {
      list = list.filter(u => ci(u.region, region) || ci(u.secondaryRegion, region));
    }
    if (accountName) {
      const lc = accountName.toLowerCase();
      list = list.filter(u => (u.accountName ?? '').toLowerCase() === lc);
    }
    if (name) {
      const lc = name.toLowerCase();
      list = list.filter(u => (u.name ?? '').toLowerCase().includes(lc));
    }
    if (typeof minAge === 'number') list = list.filter(u => u.age >= minAge);
    if (typeof maxAge === 'number') list = list.filter(u => u.age <= maxAge);
    if (gender) list = list.filter(u => u.gender === gender);
    return mockSuccess(list.slice(skip, skip + take));
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

  async getUserByAccountName(accountName: string): Promise<ApiResponse<User | null>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/users/by-account-name/${encodeURIComponent(accountName)}`);
      if (res.success && res.data) {
        return { ...res, data: mapUserFromApi(res.data) };
      }
      return res as ApiResponse<User | null>;
    }
    await new Promise((r) => setTimeout(r, 150));
    const user = mockSearchProfiles.find(u => (u.accountName ?? '').toLowerCase() === accountName.toLowerCase()) ?? null;
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
      const res = await apiClient.put<any>(`/api/v1/users/${id}`, mapUserToApi(updates));
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
