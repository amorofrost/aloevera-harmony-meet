import type { Message } from './chat';

export interface AloeVeraSong {
  id: string;
  title: string;
  album: string;
  duration: string;
  previewUrl: string;
  year: number;
}

export type UserRank = 'novice' | 'activeMember' | 'friendOfAloe' | 'aloeCrew';
export type StaffRole = 'none' | 'moderator' | 'admin';

export interface PromptAnswer {
  promptId: string;
  answer: string;
}

export interface User {
  id: string;
  accountName?: string;
  name: string;
  email?: string;
  age: number;
  bio: string;
  /** ISO-3166-1 alpha-2 code (e.g. "RU") OR a free-text custom country name. Empty when unset. */
  country: string;
  /** Free text up to 80 chars. Curated dropdown for priority countries; else custom text. */
  region: string;
  /** ISO-3166-1 alpha-2 code or custom free-text label for the secondary slot; empty when unset. */
  secondaryCountry?: string;
  /** Free text up to 80 chars for the secondary slot; empty when unset. */
  secondaryRegion?: string;
  /** @deprecated Legacy free-text location. Read-only fallback for users who haven't set country/region yet. */
  location?: string;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  profileImage: string;
  images: string[];
  lastSeen: Date;
  isOnline: boolean;
  eventsAttended?: Event[];
  favoriteSong?: AloeVeraSong;
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
  rank: UserRank;
  staffRole: StaffRole;
  registrationSourceEventId?: string;
  instagramHandle?: string;
  prompts?: PromptAnswer[];
}

export interface Match {
  id: string;
  users: [string, string];
  createdAt: Date;
  lastMessage?: Message;
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
  /** Small badge / stamp image for profiles and forum (optional). */
  badgeImageUrl?: string;
  date: Date;
  endDate?: Date;
  location: string;
  capacity?: number;
  attendees: string[];
  /** Users who marked "interested" (not yet confirmed attendees). */
  interestedUserIds?: string[];
  category: 'concert' | 'meetup' | 'party' | 'festival' | 'yachting' | 'other';
  /** Free-text price / currency as entered (e.g. "2500 ₽", "from $100"). */
  price?: string;
  organizer: string;
  /** Official site or ticket purchase URL. */
  externalUrl?: string;
  isSecret?: boolean;
  /** Backend: public | secretHidden | secretTeaser */
  visibility?: 'public' | 'secretHidden' | 'secretTeaser';
  forumTopicId?: string;
  /** Admin API only: hidden from public event lists when true */
  archived?: boolean;
}