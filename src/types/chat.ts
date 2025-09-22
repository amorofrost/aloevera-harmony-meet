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

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  read: boolean;
  type: 'text' | 'image' | 'system';
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