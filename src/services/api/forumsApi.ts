import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import { mockForumSections, type ForumSection, type ForumTopic } from '@/data/mockForumData';

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
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

      // Fetch topics for each section
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
};
