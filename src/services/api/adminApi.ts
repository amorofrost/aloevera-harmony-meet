import { apiClient, isApiMode, type ApiResponse } from './apiClient';

export interface AppConfigDto {
  rankThresholds: Record<string, string>;
  permissions: Record<string, string>;
  /** Site-wide registration policy (partition <code>registration</code> in appconfig). */
  registration: Record<string, string>;
}

export type AdminEventCategory =
  | 'concert'
  | 'meetup'
  | 'party'
  | 'festival'
  | 'yachting'
  | 'other';

export type AdminEventVisibility = 'public' | 'secretHidden' | 'secretTeaser';

export interface AdminEventDto {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  endDate?: string | null;
  location: string;
  capacity?: number | null;
  attendees: string[];
  category: AdminEventCategory;
  price?: number | null;
  organizer: string;
  isSecret: boolean;
  visibility: AdminEventVisibility;
  forumTopicId?: string | null;
  archived: boolean;
}

export interface AdminEventWritePayload {
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  endDate?: string | null;
  location: string;
  capacity?: number | null;
  category: AdminEventCategory;
  price?: number | null;
  organizer: string;
  visibility: AdminEventVisibility;
  archived: boolean;
}

export interface EventAttendeeAdminDto {
  userId: string;
  displayName: string;
}

export interface ForumTopicAdminDto {
  id: string;
  sectionId: string;
  eventId?: string | null;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  noviceVisible: boolean;
  noviceCanReply: boolean;
}

export interface EventInviteAdminDto {
  plainCode: string;
  eventId: string;
  campaignLabel: string | null;
  expiresAtUtc: string;
  revoked: boolean;
  createdAtUtc: string;
  registrationCount: number;
  eventAttendanceClaimCount: number;
}

function mapInvite(d: Record<string, unknown>): EventInviteAdminDto {
  return {
    plainCode: String(d.plainCode ?? ''),
    eventId: String(d.eventId ?? ''),
    campaignLabel: d.campaignLabel != null && String(d.campaignLabel) !== '' ? String(d.campaignLabel) : null,
    expiresAtUtc: String(d.expiresAtUtc ?? ''),
    revoked: Boolean(d.revoked),
    createdAtUtc: String(d.createdAtUtc ?? ''),
    registrationCount: Number(d.registrationCount ?? 0),
    eventAttendanceClaimCount: Number(d.eventAttendanceClaimCount ?? 0),
  };
}

function mapEvent(d: Record<string, unknown>): AdminEventDto {
  const cat = String(d.category ?? 'other').toLowerCase();
  const vis = String(d.visibility ?? 'public');
  return {
    id: String(d.id ?? ''),
    title: String(d.title ?? ''),
    description: String(d.description ?? ''),
    imageUrl: String(d.imageUrl ?? ''),
    date: String(d.date ?? ''),
    endDate: d.endDate != null ? String(d.endDate) : null,
    location: String(d.location ?? ''),
    capacity: d.capacity != null ? Number(d.capacity) : null,
    attendees: Array.isArray(d.attendees) ? (d.attendees as string[]) : [],
    category: (['concert', 'meetup', 'party', 'festival', 'yachting', 'other'].includes(cat)
      ? cat
      : 'other') as AdminEventCategory,
    price: d.price != null ? Number(d.price) : null,
    organizer: String(d.organizer ?? ''),
    isSecret: Boolean(d.isSecret),
    visibility: (['public', 'secretHidden', 'secretTeaser'].includes(vis)
      ? vis
      : 'public') as AdminEventVisibility,
    forumTopicId: d.forumTopicId != null ? String(d.forumTopicId) : null,
    archived: Boolean(d.archived),
  };
}

export const adminApi = {
  async getConfig(): Promise<ApiResponse<AppConfigDto>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: {
          code: 'ADMIN_REQUIRES_API',
          message: 'Admin panel requires VITE_API_MODE=api',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.get<AppConfigDto>('/api/v1/admin/config');
  },

  async listEvents(): Promise<ApiResponse<AdminEventDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<Record<string, unknown>[]>('/api/v1/admin/events');
    if (res.success && res.data) {
      return { ...res, data: res.data.map((x) => mapEvent(x)) };
    }
    return res as unknown as ApiResponse<AdminEventDto[]>;
  },

  async getEvent(eventId: string): Promise<ApiResponse<AdminEventDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<Record<string, unknown>>(`/api/v1/admin/events/${eventId}`);
    if (res.success && res.data) {
      return { ...res, data: mapEvent(res.data) };
    }
    return res as unknown as ApiResponse<AdminEventDto | null>;
  },

  async createEvent(body: AdminEventWritePayload): Promise<ApiResponse<AdminEventDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.post<Record<string, unknown>>('/api/v1/admin/events', body);
    if (res.success && res.data) {
      return { ...res, data: mapEvent(res.data) };
    }
    return res as unknown as ApiResponse<AdminEventDto | null>;
  },

  async updateEvent(
    eventId: string,
    body: AdminEventWritePayload,
  ): Promise<ApiResponse<AdminEventDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.put<Record<string, unknown>>(`/api/v1/admin/events/${eventId}`, body);
    if (res.success && res.data) {
      return { ...res, data: mapEvent(res.data) };
    }
    return res as unknown as ApiResponse<AdminEventDto | null>;
  },

  async deleteEvent(eventId: string): Promise<ApiResponse<null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<null>(`/api/v1/admin/events/${eventId}`);
  },

  async setArchived(eventId: string, archived: boolean): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.post<boolean>(`/api/v1/admin/events/${eventId}/archive`, { archived });
  },

  async getAttendees(eventId: string): Promise<ApiResponse<EventAttendeeAdminDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<EventAttendeeAdminDto[]>(
      `/api/v1/admin/events/${eventId}/attendees`,
    );
    return res;
  },

  async removeAttendee(eventId: string, userId: string): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<boolean>(`/api/v1/admin/events/${eventId}/attendees/${userId}`);
  },

  async createInvite(
    eventId: string,
    expiresAtUtc: Date,
  ): Promise<ApiResponse<{ plainCode: string; expiresAtUtc: string }>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.post<{ plainCode: string; expiresAtUtc: string }>(
      `/api/v1/admin/events/${eventId}/invites`,
      { expiresAtUtc: expiresAtUtc.toISOString() },
    );
  },

  async listInvites(): Promise<ApiResponse<EventInviteAdminDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<Record<string, unknown>[]>('/api/v1/admin/invites');
    if (res.success && res.data) {
      return { ...res, data: res.data.map((x) => mapInvite(x)) };
    }
    return res as ApiResponse<EventInviteAdminDto[]>;
  },

  async listInvitesForEvent(eventId: string): Promise<ApiResponse<EventInviteAdminDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<Record<string, unknown>[]>(
      `/api/v1/admin/events/${eventId}/invites`,
    );
    if (res.success && res.data) {
      return { ...res, data: res.data.map((x) => mapInvite(x)) };
    }
    return res as ApiResponse<EventInviteAdminDto[]>;
  },

  async createCampaignInvite(body: {
    campaignId: string;
    campaignLabel?: string | null;
    expiresAtUtc: string;
    plainCode?: string | null;
  }): Promise<ApiResponse<{ plainCode: string; expiresAtUtc: string } | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.post<{ plainCode: string; expiresAtUtc: string }>(
      '/api/v1/admin/invites/campaigns',
      body,
    );
  },

  async getForumTopics(eventId: string): Promise<ApiResponse<ForumTopicAdminDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<ForumTopicAdminDto[]>(
      `/api/v1/admin/events/${eventId}/forum-topics`,
    );
    return res;
  },

  async createForumTopic(
    eventId: string,
    body: { title: string; content: string; noviceVisible?: boolean; noviceCanReply?: boolean },
  ): Promise<ApiResponse<ForumTopicAdminDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.post<ForumTopicAdminDto>(`/api/v1/admin/events/${eventId}/forum-topics`, body);
  },

  async updateForumTopic(
    topicId: string,
    body: {
      title?: string;
      content?: string;
      noviceVisible?: boolean;
      noviceCanReply?: boolean;
      isPinned?: boolean;
      isLocked?: boolean;
    },
  ): Promise<ApiResponse<ForumTopicAdminDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.put<ForumTopicAdminDto>(`/api/v1/admin/forum-topics/${topicId}`, body);
  },

  async deleteForumTopic(topicId: string): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<boolean>(`/api/v1/admin/forum-topics/${topicId}`);
  },
};
