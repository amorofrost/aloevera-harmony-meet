import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import { mockForumSections, mockTopicDetails, type ForumSection, type ForumTopic, type ForumTopicDetail, type ForumReply } from '@/data/mockForumData';

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function mapReplyFromApi(dto: any): ForumReply {
  return {
    id: dto.id,
    topicId: dto.topicId,
    authorName: dto.authorName,
    authorAvatar: dto.authorAvatar,
    content: dto.content,
    createdAt: new Date(dto.createdAt),
    likes: dto.likes ?? 0,
  };
}

function mapTopicDetailFromApi(dto: any, replies: ForumReply[]): ForumTopicDetail {
  return {
    id: dto.id,
    sectionId: dto.sectionId,
    title: dto.title,
    authorName: dto.authorName,
    authorAvatar: dto.authorAvatar,
    content: dto.content ?? '',
    createdAt: new Date(dto.createdAt),
    replyCount: dto.replyCount ?? replies.length,
    lastActivity: new Date(dto.updatedAt ?? dto.createdAt),
    isPinned: dto.isPinned ?? false,
    replies,
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
  };
}

export const forumsApi = {
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

  async createReply(topicId: string, content: string): Promise<ApiResponse<ForumReply>> {
    if (isApiMode()) {
      return apiClient.post<ForumReply>(`/api/v1/forum/topics/${topicId}/replies`, { content });
    }
    const reply: ForumReply = {
      id: `r_${Date.now()}`,
      topicId,
      authorName: 'Вы',
      content,
      createdAt: new Date(),
      likes: 0,
    };
    // Add to mock data so it persists within the session
    if (mockTopicDetails[topicId]) {
      mockTopicDetails[topicId].replies.push(reply);
      mockTopicDetails[topicId].replyCount++;
    }
    return mockSuccess(reply);
  },
};
