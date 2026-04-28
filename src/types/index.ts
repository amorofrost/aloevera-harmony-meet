export type { User, AloeVeraSong, Match, Like, Event, UserRank, StaffRole } from './user';
export type { Chat, GroupChat, PrivateChat, Message } from './chat';
export type { ForumMinRank } from './forum';
// Note: ForumSection/ForumTopic/ForumReply from './forum' collide with UI-shaped
// types in @/data/mockForumData. Callers needing API types import directly from @/types/forum.

export interface PagedResult<T> {
  items: T[];
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string | null;
  total?: number | null;
}
