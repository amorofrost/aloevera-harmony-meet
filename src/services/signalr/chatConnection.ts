import * as signalR from '@microsoft/signalr';
import { isApiMode } from '@/config/api.config';

// Module-level singleton — created once, shared across all components.
// All methods are no-ops when !isApiMode().

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

let connection: signalR.HubConnection | null = null;

function getAccessToken(): string {
  return localStorage.getItem('access_token') ?? '';
}

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/chat`, {
        accessTokenFactory: () => getAccessToken(),
      })
      .withAutomaticReconnect()
      .build();
  }
  return connection;
}

export const chatConnection = {
  async connect(): Promise<void> {
    if (!isApiMode()) return;
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
  },

  async disconnect(): Promise<void> {
    if (!connection) return;
    await connection.stop();
  },

  async leaveGroup(groupId: string): Promise<void> {
    if (!isApiMode() || !connection) return;
    await connection.invoke('LeaveGroup', groupId);
  },

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!isApiMode()) return;
    getConnection().on(event, handler);
  },

  off(event: string, handler: (...args: unknown[]) => void): void {
    if (!connection) return;
    connection.off(event, handler);
  },

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('SendMessage', chatId, content);
  },

  async joinChat(chatId: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('JoinChat', chatId);
  },

  async joinTopic(topicId: string): Promise<void> {
    if (!isApiMode()) return;
    await getConnection().invoke('JoinTopic', topicId);
  },

  get isConnected(): boolean {
    if (!isApiMode() || !connection) return false;
    return connection.state === signalR.HubConnectionState.Connected;
  },
};
