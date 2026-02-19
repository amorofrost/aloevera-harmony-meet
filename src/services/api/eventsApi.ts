import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import type { Event } from '@/types/user';
import { mockEvents } from '@/data/mockEvents';

// Map backend event category string (camelCase) to frontend type
function mapCategory(cat: string): Event['category'] {
  const map: Record<string, Event['category']> = {
    concert: 'concert', meetup: 'meetup', party: 'party',
    festival: 'festival', yachting: 'yachting', other: 'other',
  };
  return map[cat?.toLowerCase()] ?? 'other';
}

function mapEventFromApi(dto: any): Event {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    imageUrl: dto.imageUrl,
    date: new Date(dto.date),
    endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    location: dto.location,
    capacity: dto.capacity ?? undefined,
    attendees: dto.attendees ?? [],
    category: mapCategory(dto.category),
    price: dto.price ?? undefined,
    organizer: dto.organizer,
    isSecret: dto.isSecret ?? false,
  };
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
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
    return mockSuccess(mockEvents);
  },

  async getEventById(id: string): Promise<ApiResponse<Event | null>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/events/${id}`);
      if (res.success && res.data) {
        return { ...res, data: mapEventFromApi(res.data) };
      }
      return res as ApiResponse<Event | null>;
    }
    const event = mockEvents.find(e => e.id === id) ?? null;
    return mockSuccess(event);
  },

  async registerForEvent(id: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      return apiClient.post<boolean>(`/api/v1/events/${id}/register`);
    }
    return mockSuccess(true);
  },

  async unregisterFromEvent(id: string): Promise<ApiResponse<boolean>> {
    if (isApiMode()) {
      return apiClient.delete<boolean>(`/api/v1/events/${id}/register`);
    }
    return mockSuccess(true);
  },
};
