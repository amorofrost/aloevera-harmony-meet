import { isApiMode } from '@/config/api.config';
import { apiClient } from './apiClient';
import { mockPrivateChats, mockChatUsers } from '@/data/mockChats';
import type { ChatDto, MessageDto, PrivateChatWithUser } from '@/types/chat';
import type { User } from '@/types/user';

// Suppress unused import warning — mockChatUsers may be used in future mock helpers
void (mockChatUsers as unknown as Record<string, User>);

function mockSuccess<T>(data: T) {
  return { success: true as const, data };
}

export const chatsApi = {
  async getChats() {
    if (!isApiMode()) {
      return mockSuccess(mockPrivateChats);
    }
    return apiClient.get<ChatDto[]>('/api/v1/chats');
  },

  async getMessages(chatId: string, page = 1) {
    if (!isApiMode()) {
      return mockSuccess([] as MessageDto[]);
    }
    return apiClient.get<MessageDto[]>(`/api/v1/chats/${chatId}/messages?page=${page}`);
  },

  async getOrCreateChat(targetUserId: string) {
    if (!isApiMode()) {
      const existing = mockPrivateChats.find(c => c.participants.includes(targetUserId));
      return mockSuccess(existing ?? mockPrivateChats[0]);
    }
    return apiClient.post<ChatDto>('/api/v1/chats', { targetUserId });
  },

  async sendMessage(chatId: string, content: string, imageUrls?: string[]) {
    if (!isApiMode()) {
      const msg: MessageDto = {
        id: crypto.randomUUID(),
        chatId,
        senderId: 'current-user',
        content,
        timestamp: new Date(),
        read: false,
        type: 'text',
        imageUrls: imageUrls ?? [],
      };
      return mockSuccess(msg);
    }
    return apiClient.post<MessageDto>(`/api/v1/chats/${chatId}/messages`, { content, imageUrls: imageUrls ?? [] });
  },
};

// Re-export PrivateChatWithUser for consumers that import it from here
export type { PrivateChatWithUser };
