import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import { mockForumSections, mockTopicDetails, type ForumSection, type ForumTopic, type ForumTopicDetail, type ForumReply } from '@/data/mockForumData';
import type { EventDiscussionSection, ForumMinRank } from '@/types/forum';
import { eventsApi } from './eventsApi';
import { getCurrentUserIdFromToken } from './matchingApi';
import type { UserRank, StaffRole } from '@/types/user';

// TODO: Import ForumTopicDto from backend types once available
interface ForumTopicDto {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  isPinned: boolean;
  isLocked?: boolean;
  minRank?: ForumMinRank;
  noviceVisible?: boolean;
  noviceCanReply?: boolean;
}

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function mapReplyFromApi(dto: any): ForumReply {
  return {
    id: dto.id,
    topicId: dto.topicId,
    authorId: dto.authorId,
    authorName: dto.authorName,
    authorAvatar: dto.authorAvatar,
    content: dto.content,
    createdAt: new Date(dto.createdAt),
    likes: dto.likes ?? 0,
    imageUrls: dto.imageUrls ?? [],
    authorRank: (dto.authorRank ?? 'novice') as UserRank,
    authorStaffRole: (dto.authorStaffRole ?? 'none') as StaffRole,
  };
}

function mapTopicDetailFromApi(dto: any, replies: ForumReply[]): ForumTopicDetail {
  return {
    id: dto.id,
    sectionId: dto.sectionId,
    title: dto.title,
    authorId: dto.authorId,
    authorName: dto.authorName,
    authorAvatar: dto.authorAvatar,
    content: dto.content ?? '',
    createdAt: new Date(dto.createdAt),
    replyCount: dto.replyCount ?? replies.length,
    lastActivity: new Date(dto.updatedAt ?? dto.createdAt),
    isPinned: dto.isPinned ?? false,
    isLocked: dto.isLocked ?? false,
    replies,
    minRank: (dto.minRank ?? 'novice') as ForumMinRank,
    noviceVisible: dto.noviceVisible ?? true,
    noviceCanReply: dto.noviceCanReply ?? true,
  };
}

function mapTopicFromApi(dto: any): ForumTopic {
  return {
    id: dto.id,
    sectionId: dto.sectionId,
    title: dto.title,
    authorName: dto.authorName,
    replyCount: dto.replyCount ?? 0,
    lastActivity: new Date(dto.updatedAt ?? dto.createdAt),
    isPinned: dto.isPinned ?? false,
    preview: dto.content ? dto.content.substring(0, 100) : '',
    minRank: (dto.minRank ?? 'novice') as ForumMinRank,
    noviceVisible: dto.noviceVisible ?? true,
    noviceCanReply: dto.noviceCanReply ?? true,
  };
}

function mapSectionFromApi(dto: any, topics: ForumTopic[]): ForumSection {
  return {
    id: dto.id,
    name: dto.name,
    icon: '💬',
    description: dto.description ?? '',
    topicCount: dto.topicCount ?? topics.length,
    topics,
    minRank: (dto.minRank ?? 'novice') as ForumMinRank,
  };
}

function mapEventDiscussionSection(dto: any): EventDiscussionSection {
  const d = dto.date ?? dto.Date;
  return {
    eventId: dto.eventId,
    title: dto.title,
    date: typeof d === 'string' ? d : new Date(d).toISOString(),
    visibility: dto.visibility ?? 'public',
    isAttending: dto.isAttending ?? false,
    topicCount: dto.topicCount ?? 0,
  };
}

export const forumsApi = {
  /** Event-linked areas for the Talks → event discussions tab (visibility matches /events). */
  async getEventDiscussionSummary(): Promise<ApiResponse<EventDiscussionSection[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/forum/event-discussions/summary');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapEventDiscussionSection) };
      }
      return res as ApiResponse<EventDiscussionSection[]>;
    }
    const evRes = await eventsApi.getEvents();
    if (!evRes.success || !evRes.data) {
      return { success: true, data: [], timestamp: new Date().toISOString() };
    }
    const uid = getCurrentUserIdFromToken();
    const data: EventDiscussionSection[] = [];
    for (const e of evRes.data) {
      const vis = e.visibility ?? (e.isSecret ? 'secretTeaser' : 'public');
      if (vis === 'secretHidden' && !(uid && e.attendees.includes(uid))) continue;
      data.push({
        eventId: e.id,
        title: e.title,
        date: e.date.toISOString(),
        visibility: vis,
        isAttending: !!(uid && e.attendees.includes(uid)),
        topicCount: 0,
      });
    }
    return { success: true, data, timestamp: new Date().toISOString() };
  },

  async getEventDiscussionTopics(eventId: string): Promise<ApiResponse<ForumTopic[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>(`/api/v1/forum/event-discussions/${encodeURIComponent(eventId)}/topics`);
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapTopicFromApi) };
      }
      return res as ApiResponse<ForumTopic[]>;
    }
    return { success: true, data: [], timestamp: new Date().toISOString() };
  },

  async getSections(): Promise<ApiResponse<ForumSection[]>> {
    if (isApiMode()) {
      const sectionsRes = await apiClient.get<any[]>('/api/v1/forum/sections');
      if (!sectionsRes.success || !sectionsRes.data) {
        return sectionsRes as ApiResponse<ForumSection[]>;
      }

      const sections = await Promise.all(
        sectionsRes.data.map(async (sectionDto) => {
          const topicsRes = await apiClient.get<any[]>(
            `/api/v1/forum/sections/${sectionDto.id}/topics`
          );
          const topics = topicsRes.success && topicsRes.data
            ? topicsRes.data.map(mapTopicFromApi)
            : [];
          return mapSectionFromApi(sectionDto, topics);
        })
      );

      return { ...sectionsRes, data: sections };
    }
    return mockSuccess(mockForumSections);
  },

  async getTopics(sectionId: string): Promise<ApiResponse<ForumTopic[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>(`/api/v1/forum/sections/${sectionId}/topics`);
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapTopicFromApi) };
      }
      return res as ApiResponse<ForumTopic[]>;
    }
    const section = mockForumSections.find(s => s.id === sectionId);
    return mockSuccess(section?.topics ?? []);
  },

  async getTopic(topicId: string): Promise<ApiResponse<ForumTopicDetail>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/forum/topics/${topicId}`);
      if (res.success && res.data) {
        const repliesRes = await apiClient.get<any[]>(`/api/v1/forum/topics/${topicId}/replies`);
        const replies = repliesRes.success && repliesRes.data
          ? repliesRes.data.map(mapReplyFromApi)
          : [];
        return { ...res, data: mapTopicDetailFromApi(res.data, replies) };
      }
      return res as ApiResponse<ForumTopicDetail>;
    }
    const detail = mockTopicDetails[topicId];
    if (!detail) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Topic not found' }, timestamp: new Date().toISOString() };
    }
    return mockSuccess(detail);
  },

  async getReplies(topicId: string): Promise<ApiResponse<ForumReply[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>(`/api/v1/forum/topics/${topicId}/replies`);
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapReplyFromApi) };
      }
      return res as ApiResponse<ForumReply[]>;
    }
    const detail = mockTopicDetails[topicId];
    return mockSuccess(detail ? detail.replies : []);
  },

  async createTopic(
    sectionId: string,
    title: string,
    content: string,
    options?: { noviceVisible?: boolean; noviceCanReply?: boolean }
  ): Promise<ApiResponse<ForumTopicDetail>> {
    if (!isApiMode()) {
      const newId = `topic-${Date.now()}`;
      const now = new Date();

      const topicDetail: ForumTopicDetail = {
        id: newId,
        sectionId,
        title,
        content,
        authorId: 'current-user',
        authorName: 'Вы',
        authorAvatar: undefined,
        isPinned: false,
        replyCount: 0,
        createdAt: now,
        lastActivity: now,
        replies: [],
        noviceVisible: options?.noviceVisible,
        noviceCanReply: options?.noviceCanReply,
      };

      const topicStub: ForumTopic = {
        id: newId,
        sectionId,
        title,
        authorName: 'Вы',
        replyCount: 0,
        lastActivity: now,
        isPinned: false,
        preview: content.substring(0, 100),
        noviceVisible: options?.noviceVisible,
        noviceCanReply: options?.noviceCanReply,
      };

      const section = mockForumSections.find(s => s.id === sectionId);
      if (section) {
        section.topics.push(topicStub);
        section.topicCount++;
      }

      mockTopicDetails[newId] = topicDetail;

      return mockSuccess(topicDetail);
    }

    const body: Record<string, unknown> = { title, content };
    if (options?.noviceVisible !== undefined) body.noviceVisible = options.noviceVisible;
    if (options?.noviceCanReply !== undefined) body.noviceCanReply = options.noviceCanReply;

    const response = await apiClient.post<ForumTopicDto>(
      `/api/v1/forum/sections/${sectionId}/topics`,
      body
    );
    return {
      ...response,
      data: response.data ? mapTopicDetailFromApi(response.data, []) : null,
    };
  },

  async createReply(topicId: string, content: string, imageUrls?: string[]): Promise<ApiResponse<ForumReply>> {
    if (isApiMode()) {
      const res = await apiClient.post<any>(`/api/v1/forum/topics/${topicId}/replies`, { content, imageUrls: imageUrls ?? [] });
      return res.success && res.data ? { ...res, data: mapReplyFromApi(res.data) } : res as ApiResponse<ForumReply>;
    }
    const reply: ForumReply = {
      id: `r_${Date.now()}`,
      topicId,
      authorName: 'Вы',
      content,
      createdAt: new Date(),
      likes: 0,
      imageUrls: imageUrls ?? [],
    };
    // Add to mock data so it persists within the session
    if (mockTopicDetails[topicId]) {
      mockTopicDetails[topicId].replies.push(reply);
      mockTopicDetails[topicId].replyCount++;
    }
    return mockSuccess(reply);
  },
};
