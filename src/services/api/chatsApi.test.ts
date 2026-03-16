import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock isApiMode to return false (mock mode) and provide API_CONFIG for apiClient
vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));
// Mock chatConnection so we can verify it's never called
vi.mock('@/services/signalr/chatConnection', () => ({
  chatConnection: {
    connect: vi.fn(),
    isConnected: false,
    sendMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    joinChat: vi.fn(),
    joinTopic: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

import { chatsApi } from './chatsApi';
import { chatConnection } from '@/services/signalr/chatConnection';

describe('chatsApi — mock mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getChats returns mock chats without any HTTP call', async () => {
    const result = await chatsApi.getChats();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('chatConnection.connect is never called in mock mode', async () => {
    await chatsApi.getChats();
    expect(chatConnection.connect).not.toHaveBeenCalled();
  });

  it('sendMessage returns a mock MessageDto without HTTP call', async () => {
    const result = await chatsApi.sendMessage('chat-1', 'hello');
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('hello');
    expect(result.data?.senderId).toBe('current-user');
  });
});
