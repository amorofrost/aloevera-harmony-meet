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
  badgeImageUrl: string;
  date: string;
  endDate?: string | null;
  location: string;
  capacity?: number | null;
  attendees: string[];
  category: AdminEventCategory;
  price: string;
  organizer: string;
  /** Official event / ticketing URL. */
  externalUrl: string;
  isSecret: boolean;
  visibility: AdminEventVisibility;
  forumTopicId?: string | null;
  archived: boolean;
}

export interface AdminEventWritePayload {
  title: string;
  description: string;
  imageUrl: string;
  badgeImageUrl: string;
  date: string;
  endDate?: string | null;
  location: string;
  capacity?: number | null;
  category: AdminEventCategory;
  price: string;
  organizer: string;
  externalUrl: string;
  visibility: AdminEventVisibility;
  archived: boolean;
}

export interface EventAttendeeAdminDto {
  userId: string;
  displayName: string;
}

export type EventTopicVisibilityApi = 'public' | 'attendeesOnly' | 'specificUsers';

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
  eventTopicVisibility: EventTopicVisibilityApi;
  allowedUserIds: string[];
}

function parseEventTopicVisibility(v: unknown): EventTopicVisibilityApi {
  const s = String(v ?? 'public');
  if (s === 'attendeesOnly' || s === 'specificUsers') return s;
  return 'public';
}

function mapForumTopicRow(x: unknown): ForumTopicAdminDto {
  const o = x as Record<string, unknown>;
  const allowed = Array.isArray(o.allowedUserIds)
    ? (o.allowedUserIds as string[]).map((id) => String(id).trim()).filter(Boolean)
    : [];
  return {
    id: String(o.id ?? ''),
    sectionId: String(o.sectionId ?? ''),
    eventId: o.eventId != null && o.eventId !== '' ? String(o.eventId) : null,
    title: String(o.title ?? ''),
    content: String(o.content ?? ''),
    authorId: String(o.authorId ?? ''),
    authorName: String(o.authorName ?? ''),
    isPinned: Boolean(o.isPinned),
    isLocked: Boolean(o.isLocked),
    replyCount: Number(o.replyCount ?? 0),
    createdAt: String(o.createdAt ?? ''),
    updatedAt: String(o.updatedAt ?? ''),
    noviceVisible: o.noviceVisible !== false,
    noviceCanReply: o.noviceCanReply !== false,
    eventTopicVisibility: parseEventTopicVisibility(o.eventTopicVisibility),
    allowedUserIds: allowed,
  };
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
    badgeImageUrl: String(d.badgeImageUrl ?? ''),
    date: String(d.date ?? ''),
    endDate: d.endDate != null ? String(d.endDate) : null,
    location: String(d.location ?? ''),
    capacity: d.capacity != null ? Number(d.capacity) : null,
    attendees: Array.isArray(d.attendees) ? (d.attendees as string[]) : [],
    category: (['concert', 'meetup', 'party', 'festival', 'yachting', 'other'].includes(cat)
      ? cat
      : 'other') as AdminEventCategory,
    price: String(d.price ?? ''),
    organizer: String(d.organizer ?? ''),
    externalUrl: String(d.externalUrl ?? ''),
    isSecret: Boolean(d.isSecret),
    visibility: (['public', 'secretHidden', 'secretTeaser'].includes(vis)
      ? vis
      : 'public') as AdminEventVisibility,
    forumTopicId: d.forumTopicId != null ? String(d.forumTopicId) : null,
    archived: Boolean(d.archived),
  };
}

export interface AdminForumSectionDto {
  id: string;
  name: string;
  description: string;
  topicCount: number;
  orderIndex: number;
  minRank: string;
}

function mapForumSectionRow(x: unknown): AdminForumSectionDto {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: String(o.name ?? ''),
    description: String(o.description ?? ''),
    topicCount: Number(o.topicCount ?? 0),
    orderIndex: Number(o.orderIndex ?? o.OrderIndex ?? 0),
    minRank: String(o.minRank ?? 'novice'),
  };
}

/** Non-event forum topic row (admin list). */
export interface AdminStandardForumTopicDto {
  id: string;
  sectionId: string;
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

function mapStandardForumTopicRow(x: unknown): AdminStandardForumTopicDto {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    sectionId: String(o.sectionId ?? ''),
    title: String(o.title ?? ''),
    content: String(o.content ?? ''),
    authorId: String(o.authorId ?? ''),
    authorName: String(o.authorName ?? ''),
    isPinned: Boolean(o.isPinned),
    isLocked: Boolean(o.isLocked),
    replyCount: Number(o.replyCount ?? 0),
    createdAt: String(o.createdAt ?? ''),
    updatedAt: String(o.updatedAt ?? ''),
    noviceVisible: o.noviceVisible !== false,
    noviceCanReply: o.noviceCanReply !== false,
  };
}

export interface AdminStoreItemDto {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  /** Product page on the official band store site. */
  externalPurchaseUrl: string;
}

function mapStoreItemRow(x: unknown): AdminStoreItemDto {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? ''),
    description: String(o.description ?? ''),
    price: Number(o.price ?? 0),
    imageUrl: String(o.imageUrl ?? ''),
    category: String(o.category ?? ''),
    externalPurchaseUrl: String(o.externalPurchaseUrl ?? ''),
  };
}

export interface AdminBlogPostDto {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  author: string;
  tags: string[];
  /** ISO date string from API */
  date: string;
}

function mapBlogPostRow(x: unknown): AdminBlogPostDto {
  const o = x as Record<string, unknown>;
  const tagsRaw = o.tags;
  const tags = Array.isArray(tagsRaw)
    ? (tagsRaw as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : [];
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? ''),
    excerpt: String(o.excerpt ?? ''),
    content: String(o.content ?? ''),
    imageUrl: String(o.imageUrl ?? ''),
    author: String(o.author ?? ''),
    tags,
    date: String(o.date ?? ''),
  };
}

export interface AdminContainerInfrastructureDto {
  name: string;
  startedAtUtc: string;
  uptimeSeconds: number;
  appStartedAtUtc: string;
  appUptimeSeconds: number;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
}

export interface AdminInfrastructureStatusDto {
  generatedAtUtc: string;
  containers: AdminContainerInfrastructureDto[];
}

export const adminApi = {
  async listForumSections(): Promise<ApiResponse<AdminForumSectionDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown[]>('/api/v1/admin/forum-sections');
    if (res.success && Array.isArray(res.data)) {
      return { ...res, data: res.data.map(mapForumSectionRow) };
    }
    return res as ApiResponse<AdminForumSectionDto[]>;
  },

  async createForumSection(body: {
    id: string;
    name: string;
    description: string;
    minRank: string;
  }): Promise<ApiResponse<AdminForumSectionDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.post<unknown>('/api/v1/admin/forum-sections', body);
    if (res.success && res.data) {
      return { ...res, data: mapForumSectionRow(res.data) };
    }
    return res as ApiResponse<AdminForumSectionDto | null>;
  },

  async updateForumSection(
    sectionId: string,
    body: { name?: string; description?: string; minRank?: string },
  ): Promise<ApiResponse<AdminForumSectionDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.put<unknown>(`/api/v1/admin/forum-sections/${sectionId}`, body);
    if (res.success && res.data) {
      return { ...res, data: mapForumSectionRow(res.data) };
    }
    return res as ApiResponse<AdminForumSectionDto | null>;
  },

  async deleteForumSection(sectionId: string): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<boolean>(`/api/v1/admin/forum-sections/${sectionId}`);
  },

  async reorderForumSections(sectionIds: string[]): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.put<boolean>('/api/v1/admin/forum-sections/order', { sectionIds });
  },

  async listForumSectionTopics(sectionId: string): Promise<ApiResponse<AdminStandardForumTopicDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown[]>(
      `/api/v1/admin/forum-sections/${encodeURIComponent(sectionId)}/topics`,
    );
    if (res.success && Array.isArray(res.data)) {
      return { ...res, data: res.data.map(mapStandardForumTopicRow) };
    }
    return res as ApiResponse<AdminStandardForumTopicDto[]>;
  },

  async createForumSectionTopic(
    sectionId: string,
    body: { title: string; content: string; noviceVisible?: boolean; noviceCanReply?: boolean },
  ): Promise<ApiResponse<AdminStandardForumTopicDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.post<unknown>(
      `/api/v1/admin/forum-sections/${encodeURIComponent(sectionId)}/topics`,
      body,
    );
    if (res.success && res.data) {
      return { ...res, data: mapStandardForumTopicRow(res.data) };
    }
    return res as ApiResponse<AdminStandardForumTopicDto | null>;
  },

  async listStoreItems(): Promise<ApiResponse<AdminStoreItemDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown[]>('/api/v1/admin/store-items');
    if (res.success && Array.isArray(res.data)) {
      return { ...res, data: res.data.map(mapStoreItemRow) };
    }
    return res as ApiResponse<AdminStoreItemDto[]>;
  },

  async getStoreItem(itemId: string): Promise<ApiResponse<AdminStoreItemDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown>(`/api/v1/admin/store-items/${encodeURIComponent(itemId)}`);
    if (res.success && res.data) {
      return { ...res, data: mapStoreItemRow(res.data) };
    }
    return res as ApiResponse<AdminStoreItemDto | null>;
  },

  async createStoreItem(body: {
    id: string;
    title: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    externalPurchaseUrl: string;
  }): Promise<ApiResponse<AdminStoreItemDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.post<unknown>('/api/v1/admin/store-items', body);
    if (res.success && res.data) {
      return { ...res, data: mapStoreItemRow(res.data) };
    }
    return res as ApiResponse<AdminStoreItemDto | null>;
  },

  async updateStoreItem(
    itemId: string,
    body: {
      title: string;
      description: string;
      price: number;
      imageUrl: string;
      category: string;
      externalPurchaseUrl: string;
    },
  ): Promise<ApiResponse<AdminStoreItemDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.put<unknown>(
      `/api/v1/admin/store-items/${encodeURIComponent(itemId)}`,
      body,
    );
    if (res.success && res.data) {
      return { ...res, data: mapStoreItemRow(res.data) };
    }
    return res as ApiResponse<AdminStoreItemDto | null>;
  },

  async deleteStoreItem(itemId: string): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<boolean>(`/api/v1/admin/store-items/${encodeURIComponent(itemId)}`);
  },

  async listBlogPosts(): Promise<ApiResponse<AdminBlogPostDto[]>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown[]>('/api/v1/admin/blog-posts');
    if (res.success && Array.isArray(res.data)) {
      return { ...res, data: res.data.map(mapBlogPostRow) };
    }
    return res as ApiResponse<AdminBlogPostDto[]>;
  },

  async getBlogPost(postId: string): Promise<ApiResponse<AdminBlogPostDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.get<unknown>(`/api/v1/admin/blog-posts/${encodeURIComponent(postId)}`);
    if (res.success && res.data) {
      return { ...res, data: mapBlogPostRow(res.data) };
    }
    return res as ApiResponse<AdminBlogPostDto | null>;
  },

  async createBlogPost(body: {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    imageUrl: string;
    author: string;
    tags: string[];
    date: string;
  }): Promise<ApiResponse<AdminBlogPostDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.post<unknown>('/api/v1/admin/blog-posts', body);
    if (res.success && res.data) {
      return { ...res, data: mapBlogPostRow(res.data) };
    }
    return res as ApiResponse<AdminBlogPostDto | null>;
  },

  async updateBlogPost(
    postId: string,
    body: {
      title: string;
      excerpt: string;
      content: string;
      imageUrl: string;
      author: string;
      tags: string[];
      date: string;
    },
  ): Promise<ApiResponse<AdminBlogPostDto | null>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const res = await apiClient.put<unknown>(
      `/api/v1/admin/blog-posts/${encodeURIComponent(postId)}`,
      body,
    );
    if (res.success && res.data) {
      return { ...res, data: mapBlogPostRow(res.data) };
    }
    return res as ApiResponse<AdminBlogPostDto | null>;
  },

  async deleteBlogPost(postId: string): Promise<ApiResponse<boolean>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.delete<boolean>(`/api/v1/admin/blog-posts/${encodeURIComponent(postId)}`);
  },

  async getInfrastructure(): Promise<ApiResponse<AdminInfrastructureStatusDto>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.get<AdminInfrastructureStatusDto>('/api/v1/admin/infrastructure');
  },

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
    plainCode?: string | null,
  ): Promise<ApiResponse<{ plainCode: string; expiresAtUtc: string }>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: { code: 'ADMIN_REQUIRES_API', message: 'Admin panel requires VITE_API_MODE=api' },
        timestamp: new Date().toISOString(),
      };
    }
    const body: { expiresAtUtc: string; plainCode?: string } = {
      expiresAtUtc: expiresAtUtc.toISOString(),
    };
    const trimmed = plainCode?.trim();
    if (trimmed) body.plainCode = trimmed;
    return apiClient.post<{ plainCode: string; expiresAtUtc: string }>(
      `/api/v1/admin/events/${eventId}/invites`,
      body,
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
    return res as unknown as ApiResponse<EventInviteAdminDto[]>;
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
    return res as unknown as ApiResponse<EventInviteAdminDto[]>;
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
    const res = await apiClient.get<unknown[]>(`/api/v1/admin/events/${eventId}/forum-topics`);
    if (res.success && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map(mapForumTopicRow),
      } as ApiResponse<ForumTopicAdminDto[]>;
    }
    return res as ApiResponse<ForumTopicAdminDto[]>;
  },

  async createForumTopic(
    eventId: string,
    body: {
      title: string;
      content: string;
      noviceVisible?: boolean;
      noviceCanReply?: boolean;
      eventTopicVisibility?: EventTopicVisibilityApi;
      allowedUserIds?: string[];
    },
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
      eventTopicVisibility?: EventTopicVisibilityApi;
      allowedUserIds?: string[];
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
