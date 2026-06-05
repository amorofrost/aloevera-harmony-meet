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

  async sendMessage(chatId: string, content: string, imageUrls?: string[], replyToMessageId?: string) {
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
        replyToMessageId,
      };
      return mockSuccess(msg);
    }
    return apiClient.post<MessageDto>(`/api/v1/chats/${chatId}/messages`, {
      content,
      imageUrls: imageUrls ?? [],
      replyToMessageId: replyToMessageId ?? null,
    });
  },

  /** Reset the caller's unread counter for a chat (called when they open/read it). */
  async markRead(chatId: string) {
    if (!isApiMode()) {
      return mockSuccess({ chatId });
    }
    return apiClient.post<{ chatId: string }>(`/api/v1/chats/${chatId}/read`, {});
  },

  /** Edit the text content of a message the caller authored (within the 24h window). */
  async editMessage(chatId: string, messageId: string, content: string) {
    if (!isApiMode()) {
      const msg: MessageDto = {
        id: messageId, chatId, senderId: 'current-user', content,
        timestamp: new Date(), editedAt: new Date(), read: false, type: 'text', imageUrls: [],
      };
      return mockSuccess(msg);
    }
    return apiClient.put<MessageDto>(`/api/v1/chats/${chatId}/messages/${messageId}`, { content });
  },

  /** Add or replace the caller's reaction on a message. Returns updated message. */
  async setReaction(chatId: string, messageId: string, emoji: string) {
    if (!isApiMode()) {
      // Mock returns a thin stub; the UI optimistically updates local state.
      const msg: MessageDto = {
        id: messageId, chatId, senderId: '', content: '', timestamp: new Date(),
        read: false, type: 'text', imageUrls: [],
        reactions: { 'current-user': emoji },
      };
      return mockSuccess(msg);
    }
    return apiClient.put<MessageDto>(`/api/v1/chats/${chatId}/messages/${messageId}/reaction`, { emoji });
  },

  /** Remove the caller's reaction on a message. Idempotent. Returns updated message. */
  async removeReaction(chatId: string, messageId: string) {
    if (!isApiMode()) {
      const msg: MessageDto = {
        id: messageId, chatId, senderId: '', content: '', timestamp: new Date(),
        read: false, type: 'text', imageUrls: [],
        reactions: {},
      };
      return mockSuccess(msg);
    }
    return apiClient.delete<MessageDto>(`/api/v1/chats/${chatId}/messages/${messageId}/reaction`);
  },
};

// Re-export PrivateChatWithUser for consumers that import it from here
export type { PrivateChatWithUser };
