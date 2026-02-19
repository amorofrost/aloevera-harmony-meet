import type { ApiResponse } from './apiClient';
import { mockEventChats, mockPrivateChats, type PrivateChatWithUser } from '@/data/mockChats';
import type { GroupChat } from '@/types/chat';

// Chat endpoints are not yet implemented in the backend.
// This service always uses mock data regardless of mode.

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export const chatsApi = {
  async getEventChats(): Promise<ApiResponse<GroupChat[]>> {
    return mockSuccess(mockEventChats);
  },

  async getPrivateChats(): Promise<ApiResponse<PrivateChatWithUser[]>> {
    return mockSuccess(mockPrivateChats);
  },
};
