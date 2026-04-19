import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { Event } from '@/types/user';
import { mockEvents } from '@/data/mockEvents';
import { getCurrentUserIdFromToken } from './matchingApi';

// Map backend event category string (camelCase) to frontend type
function mapCategory(cat: string): Event['category'] {
  const map: Record<string, Event['category']> = {
    concert: 'concert', meetup: 'meetup', party: 'party',
    festival: 'festival', yachting: 'yachting', other: 'other',
  };
  return map[cat?.toLowerCase()] ?? 'other';
}

export function mapEventFromApi(dto: any): Event {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    imageUrl: dto.imageUrl,
    badgeImageUrl: dto.badgeImageUrl ?? undefined,
    date: new Date(dto.date),
    endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    location: dto.location,
    capacity: dto.capacity ?? undefined,
    attendees: dto.attendees ?? [],
    interestedUserIds: dto.interestedUserIds ?? [],
    category: mapCategory(dto.category),
    price:
      dto.price != null && String(dto.price).trim() !== ''
        ? String(dto.price).trim()
        : undefined,
    organizer: dto.organizer,
    externalUrl: dto.externalUrl?.trim() || undefined,
    isSecret: dto.isSecret ?? false,
    visibility: dto.visibility,
    forumTopicId: dto.forumTopicId,
    archived: dto.archived,
  };
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

/** Mock-only: mutable interest sets by event id (session memory). */
const mockInterestSets = new Map<string, Set<string>>();

function mergeMockInterest(e: Event): Event {
  const extra = mockInterestSets.get(e.id);
  const base = [...(e.interestedUserIds ?? [])];
  if (!extra?.size) return { ...e, interestedUserIds: base };
  return { ...e, interestedUserIds: [...new Set([...base, ...extra])] };
}

export const eventsApi = {
  async getEvents(): Promise<ApiResponse<Event[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/events');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapEventFromApi) };
      }
      return res as ApiResponse<Event[]>;
    }
    return mockSuccess(mockEvents.map(mergeMockInterest));
  },

  async getEventById(id: string, inviteCode?: string): Promise<ApiResponse<Event | null>> {
    if (isApiMode()) {
      const q = inviteCode ? `?code=${encodeURIComponent(inviteCode)}` : '';
      const res = await apiClient.get<any>(`/api/v1/events/${id}${q}`);
      if (res.success && res.data) {
        return { ...res, data: mapEventFromApi(res.data) };
      }
      return res as ApiResponse<Event | null>;
    }
    const event = mockEvents.find(e => e.id === id) ?? null;
    return mockSuccess(event ? mergeMockInterest(event) : null);
  },

  /** Register as attendee — backend requires a valid invite code (except moderators/admins). */
  async registerForEvent(id: string, inviteCode?: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      const body =
        inviteCode && inviteCode.trim() !== '' ? { inviteCode: inviteCode.trim() } : {};
      return apiClient.post<boolean>(`/api/v1/events/${id}/register`, body);
    }
    const uid = getCurrentUserIdFromToken();
    if (uid) {
      mockInterestSets.get(id)?.delete(uid);
    }
    return mockSuccess(true);
  },

  async unregisterFromEvent(id: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      return apiClient.delete<boolean>(`/api/v1/events/${id}/register`);
    }
    return mockSuccess(true);
  },

  async addEventInterest(id: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      return apiClient.post<boolean>(`/api/v1/events/${id}/interest`, {});
    }
    const uid = getCurrentUserIdFromToken();
    if (!uid) return { success: false, error: { code: 'NO_USER', message: 'Not logged in' }, timestamp: new Date().toISOString() };
    if (!mockInterestSets.has(id)) mockInterestSets.set(id, new Set());
    mockInterestSets.get(id)!.add(uid);
    return mockSuccess(true);
  },

  async removeEventInterest(id: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      return apiClient.delete<boolean>(`/api/v1/events/${id}/interest`);
    }
    const uid = getCurrentUserIdFromToken();
    if (uid) mockInterestSets.get(id)?.delete(uid);
    return mockSuccess(true);
  },
};
