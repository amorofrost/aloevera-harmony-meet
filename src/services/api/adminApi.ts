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

export interface MetricsOverviewDto {
  registered: number;
  dau: number;
  mau: number;
  currentlyActive: number;
  requestsLastHour: number;
  p95LastHourMs: number | null;
}

export interface ContainerStatusDto {
  name: string;
  status: 'green' | 'amber' | 'red';
  heartbeatAgeSeconds: number | null;
  gcHeapMb: number | null;
  workingSetMb: number | null;
  threadCount: number | null;
  note: string | null;
  startedAtUtc: string | null;
  version: string | null;
}

export interface TimeseriesPointDto {
  ts: string;
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export interface BiTimeseriesDto {
  days: string[];
  registered: number[];
  dau: number[];
  mau: number[];
}

export interface MetricsAdminConfigDto {
  requestTiming: boolean;
  biEvents: boolean;
  containerStats: boolean;
  frontendPerf: boolean;
  retentionMinuteHours: number;
  retentionHourDays: number;
  retentionDauDays: number;
}

export interface EndpointStatDto {
  dimensionKey: string;
  method: string;
  route: string;
  statusCode: number | null;
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
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

export type BroadcastAudienceType = 'all' | 'attendingEvent' | 'minRank' | 'staffRole';

export interface BroadcastAudienceDto {
  type: BroadcastAudienceType;
  value: string | null;
}

export type BroadcastStatus = 'pending' | 'completed';

export interface BroadcastDto {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  audience: BroadcastAudienceDto;
  issuedByUserId: string;
  issuedAtUtc: string;
  estimatedRecipients: number;
  dispatchedCount: number;
  status: BroadcastStatus;
  completedAtUtc?: string | null;
}

export interface CreateBroadcastPayload {
  title: string;
  body: string;
  link?: string;
  audience: BroadcastAudienceDto;
}

function mapBroadcast(x: unknown): BroadcastDto {
  const o = x as Record<string, unknown>;
  const audRaw = (o.audience ?? {}) as Record<string, unknown>;
  const t = String(audRaw.type ?? 'all');
  const type: BroadcastAudienceType = (
    ['all', 'attendingEvent', 'minRank', 'staffRole'].includes(t) ? t : 'all'
  ) as BroadcastAudienceType;
  const status = String(o.status ?? 'pending');
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? ''),
    body: String(o.body ?? ''),
    link: o.link != null && String(o.link) !== '' ? String(o.link) : null,
    audience: {
      type,
      value: audRaw.value != null && String(audRaw.value) !== '' ? String(audRaw.value) : null,
    },
    issuedByUserId: String(o.issuedByUserId ?? ''),
    issuedAtUtc: String(o.issuedAtUtc ?? ''),
    estimatedRecipients: Number(o.estimatedRecipients ?? 0),
    dispatchedCount: Number(o.dispatchedCount ?? 0),
    status: (status === 'completed' ? 'completed' : 'pending') as BroadcastStatus,
    completedAtUtc: o.completedAtUtc != null && String(o.completedAtUtc) !== '' ? String(o.completedAtUtc) : null,
  };
}

/**
 * Mock store for admin community broadcasts. Unlike most admin endpoints, broadcasts
 * support a working mock path so the compose form + history can be exercised locally
 * (and in unit tests with VITE_API_MODE=mock).
 */
const mockBroadcasts: BroadcastDto[] = [];

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

  broadcasts: {
    async create(body: CreateBroadcastPayload): Promise<ApiResponse<BroadcastDto>> {
      if (!isApiMode()) {
        const link = body.link?.trim();
        const bc: BroadcastDto = {
          id: `bc-${Math.random().toString(36).slice(2, 14)}`,
          title: body.title,
          body: body.body,
          link: link ? link : null,
          audience: {
            type: body.audience.type,
            value: body.audience.value && body.audience.value.trim() !== ''
              ? body.audience.value
              : null,
          },
          issuedByUserId: 'mock-admin',
          issuedAtUtc: new Date().toISOString(),
          estimatedRecipients: 0,
          dispatchedCount: 0,
          status: 'pending',
          completedAtUtc: null,
        };
        mockBroadcasts.unshift(bc);
        return { success: true, data: bc, timestamp: new Date().toISOString() };
      }
      const res = await apiClient.post<unknown>('/api/v1/admin/notifications/broadcast', body);
      if (res.success && res.data) {
        return { ...res, data: mapBroadcast(res.data) };
      }
      return res as unknown as ApiResponse<BroadcastDto>;
    },

    async list(limit = 50): Promise<ApiResponse<BroadcastDto[]>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: mockBroadcasts.slice(0, limit),
          timestamp: new Date().toISOString(),
        };
      }
      const res = await apiClient.get<unknown[]>(
        `/api/v1/admin/notifications/broadcasts?limit=${limit}`,
      );
      if (res.success && Array.isArray(res.data)) {
        return { ...res, data: res.data.map(mapBroadcast) };
      }
      return res as unknown as ApiResponse<BroadcastDto[]>;
    },

    async get(broadcastId: string): Promise<ApiResponse<BroadcastDto>> {
      if (!isApiMode()) {
        const bc = mockBroadcasts.find((b) => b.id === broadcastId);
        if (bc) {
          return { success: true, data: bc, timestamp: new Date().toISOString() };
        }
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Broadcast not found' },
          timestamp: new Date().toISOString(),
        };
      }
      const res = await apiClient.get<unknown>(
        `/api/v1/admin/notifications/broadcasts/${encodeURIComponent(broadcastId)}`,
      );
      if (res.success && res.data) {
        return { ...res, data: mapBroadcast(res.data) };
      }
      return res as unknown as ApiResponse<BroadcastDto>;
    },
  },

  metrics: {
    async getOverview(): Promise<ApiResponse<MetricsOverviewDto>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: {
            registered: 12, dau: 4, mau: 12, currentlyActive: 1,
            requestsLastHour: 240, p95LastHourMs: 180,
          },
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<MetricsOverviewDto>('/api/v1/admin/metrics/overview');
    },

    async getContainers(): Promise<ApiResponse<ContainerStatusDto[]>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: [
            { name: 'backend', status: 'green', heartbeatAgeSeconds: 12, gcHeapMb: 38, workingSetMb: 142, threadCount: 24, note: null, startedAtUtc: null, version: '1.0' },
            { name: 'telegram-bot', status: 'green', heartbeatAgeSeconds: 18, gcHeapMb: 12, workingSetMb: 38, threadCount: 12, note: null, startedAtUtc: null, version: '1.0' },
            { name: 'notifications-worker', status: 'green', heartbeatAgeSeconds: 22, gcHeapMb: 19, workingSetMb: 62, threadCount: 18, note: null, startedAtUtc: null, version: '1.0' },
            { name: 'frontend', status: 'green', heartbeatAgeSeconds: null, gcHeapMb: null, workingSetMb: null, threadCount: null, note: 'HTTP 200', startedAtUtc: null, version: null },
          ] as ContainerStatusDto[],
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<ContainerStatusDto[]>('/api/v1/admin/metrics/containers');
    },

    async getTimeseries(params: {
      category: string;
      dimensionKey?: string;
      from: string;
      to: string;
      resolution: 'minute' | 'hour';
    }): Promise<ApiResponse<TimeseriesPointDto[]>> {
      if (!isApiMode()) {
        return { success: true, data: [] as TimeseriesPointDto[], timestamp: new Date().toISOString() };
      }
      const q = new URLSearchParams({
        category: params.category,
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });
      if (params.dimensionKey) q.set('dimensionKey', params.dimensionKey);
      return apiClient.get<TimeseriesPointDto[]>(`/api/v1/admin/metrics/timeseries?${q}`);
    },

    async getBi(range: '24h' | '7d' | '30d'): Promise<ApiResponse<BiTimeseriesDto>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: {
            days: ['2026-05-19', '2026-05-20', '2026-05-21'],
            registered: [10, 11, 12],
            dau: [3, 4, 4],
            mau: [10, 11, 12],
          } as BiTimeseriesDto,
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<BiTimeseriesDto>(`/api/v1/admin/metrics/bi?range=${range}`);
    },

    async getEndpointStats(params: {
      from: string;
      to: string;
      resolution: 'minute' | 'hour';
      limit?: number;
    }): Promise<ApiResponse<EndpointStatDto[]>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: [
            { dimensionKey: 'backend|GET|api~v1~users|200',                         method: 'GET',    route: '/api/v1/users',                         statusCode: 200, count: 842, p50: 34,  p95: 142, p99: 310 },
            { dimensionKey: 'backend|POST|api~v1~forum~topics~{topicId}~replies|201', method: 'POST', route: '/api/v1/forum/topics/{topicId}/replies', statusCode: 201, count: 312, p50: 89,  p95: 280, p99: 490 },
            { dimensionKey: 'backend|GET|api~v1~events|200',                          method: 'GET',  route: '/api/v1/events',                        statusCode: 200, count: 289, p50: 41,  p95: 160, p99: 280 },
            { dimensionKey: 'backend|POST|api~v1~chats~{id}~messages|201',            method: 'POST', route: '/api/v1/chats/{id}/messages',           statusCode: 201, count: 241, p50: 62,  p95: 195, p99: 380 },
            { dimensionKey: 'backend|GET|api~v1~matching~likes~received|200',         method: 'GET',  route: '/api/v1/matching/likes/received',       statusCode: 200, count: 198, p50: 28,  p95: 110, p99: 210 },
            { dimensionKey: 'backend|POST|api~v1~matching~likes|200',                 method: 'POST', route: '/api/v1/matching/likes',                statusCode: 200, count: 174, p50: 55,  p95: 220, p99: 410 },
            { dimensionKey: 'backend|GET|api~v1~forum~topics~{topicId}~replies|200',  method: 'GET',  route: '/api/v1/forum/topics/{topicId}/replies', statusCode: 200, count: 143, p50: 48,  p95: 175, p99: 320 },
            { dimensionKey: 'backend|GET|api~v1~users~me|200',                        method: 'GET',  route: '/api/v1/users/me',                      statusCode: 200, count: 138, p50: 22,  p95: 89,  p99: 160 },
            { dimensionKey: 'backend|POST|api~v1~auth~refresh|200',                   method: 'POST', route: '/api/v1/auth/refresh',                  statusCode: 200, count: 112, p50: 18,  p95: 72,  p99: 130 },
            { dimensionKey: 'backend|GET|api~v1~users|401',                           method: 'GET',  route: '/api/v1/users',                         statusCode: 401, count: 23,  p50: 8,   p95: 28,  p99: 55  },
          ] as EndpointStatDto[],
          timestamp: new Date().toISOString(),
        };
      }
      const q = new URLSearchParams({
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });
      if (params.limit !== undefined) q.set('limit', String(params.limit));
      return apiClient.get<EndpointStatDto[]>(`/api/v1/admin/metrics/endpoint-stats?${q}`);
    },

    async getConfig(): Promise<ApiResponse<MetricsAdminConfigDto>> {
      if (!isApiMode()) {
        return {
          success: true,
          data: {
            requestTiming: true, biEvents: true, containerStats: true, frontendPerf: true,
            retentionMinuteHours: 24, retentionHourDays: 90, retentionDauDays: 30,
          } as MetricsAdminConfigDto,
          timestamp: new Date().toISOString(),
        };
      }
      return apiClient.get<MetricsAdminConfigDto>('/api/v1/admin/metrics/config');
    },

    async putConfig(updates: Partial<MetricsAdminConfigDto>): Promise<ApiResponse<undefined>> {
      if (!isApiMode()) {
        return { success: true, data: undefined, timestamp: new Date().toISOString() };
      }
      return apiClient.put('/api/v1/admin/metrics/config', updates);
    },
  },
};
