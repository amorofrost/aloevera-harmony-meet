import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import { mockBlogPosts, type BlogPost } from '@/data/mockBlogPosts';

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function mapBlogPostFromApi(dto: any): BlogPost {
  return {
    id: dto.id,
    title: dto.title,
    excerpt: dto.excerpt ?? '',
    content: dto.content ?? '',
    date: new Date(dto.date),
    imageUrl: dto.imageUrl,
    author: dto.author,
    tags: dto.tags ?? [],
  };
}

export const blogApi = {
  async getBlogPosts(): Promise<ApiResponse<BlogPost[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/blog');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapBlogPostFromApi) };
      }
      return res as ApiResponse<BlogPost[]>;
    }
    return mockSuccess(mockBlogPosts);
  },

  async getBlogPostById(id: string): Promise<ApiResponse<BlogPost | null>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/blog/${id}`);
      if (res.success && res.data) {
        return { ...res, data: mapBlogPostFromApi(res.data) };
      }
      return res as ApiResponse<BlogPost | null>;
    }
    const post = mockBlogPosts.find(p => p.id === id) ?? null;
    return mockSuccess(post);
  },
};
