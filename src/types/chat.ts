export interface Chat {
  id: string;
  type: 'private' | 'group';
  name?: string; // For group chats
  participants: string[]; // User IDs
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  eventId?: string; // For event-related group chats
}

export interface MessageReplySnippet {
  id: string;
  senderId: string;
  /** First ~100 chars of the original Content. */
  contentPreview: string;
  hasImages: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  /** Set when the message was edited by its author; absent if never edited. */
  editedAt?: Date;
  read: boolean;
  type: 'text' | 'image' | 'system';
  imageUrls?: string[];
  /** userId → emoji. One reaction per user per message; senders cannot react to own. */
  reactions?: Record<string, string>;
  /** Id of the message this is a reply to, or undefined. Always in the same chat. */
  replyToMessageId?: string;
  /** Backend-embedded snapshot of the replied-to message for rendering the quote. */
  replyToSnippet?: MessageReplySnippet;
}

export interface GroupChat extends Chat {
  type: 'group';
  name: string;
  description?: string;
  isEventChat: boolean;
  eventId?: string;
  adminIds: string[];
}

export interface PrivateChat extends Chat {
  type: 'private';
  matchId: string;
}

// Aliases used by chatsApi dual-mode layer
export type ChatDto = PrivateChat;
export type MessageDto = Message;

import type { User } from './user';

export interface PrivateChatWithUser {
  chat: PrivateChat;
  otherUser: User;
}