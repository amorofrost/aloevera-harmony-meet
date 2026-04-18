import type { UserRank, StaffRole } from './user';

export type ForumMinRank = UserRank;

export interface ForumSection {
  id: string;
  name: string;
  description: string;
  topicCount: number;
  minRank: ForumMinRank;
}

export interface ForumTopic {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  minRank: ForumMinRank;
  noviceVisible: boolean;
  noviceCanReply: boolean;
}

/** One row per event on Talks → «Обсуждения событий» (from GET .../forum/event-discussions/summary). */
export interface EventDiscussionSection {
  eventId: string;
  title: string;
  date: string;
  visibility: string;
  isAttending: boolean;
  topicCount: number;
}

export interface ForumReply {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  imageUrls: string[];
  authorRank: UserRank;
  authorStaffRole: StaffRole;
}
