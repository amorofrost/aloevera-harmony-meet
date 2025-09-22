export interface User {
  id: string;
  name: string;
  age: number;
  bio: string;
  location: string;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  profileImage: string;
  images: string[];
  lastSeen: Date;
  isOnline: boolean;
  preferences: {
    ageRange: [number, number];
    maxDistance: number;
    showMe: 'everyone' | 'men' | 'women' | 'non-binary';
  };
  settings: {
    profileVisibility: 'public' | 'private' | 'friends';
    anonymousLikes: boolean;
    language: 'ru' | 'en';
    notifications: boolean;
  };
}

export interface Match {
  id: string;
  users: [string, string];
  createdAt: Date;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface Like {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: Date;
  isMatch: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  date: Date;
  endDate?: Date;
  location: string;
  capacity?: number;
  attendees: string[];
  category: 'concert' | 'meetup' | 'party' | 'festival' | 'other';
  price?: number;
  organizer: string;
}