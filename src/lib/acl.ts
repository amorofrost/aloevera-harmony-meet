import type { UserRank, StaffRole } from '@/types/user';

const LEVELS: Record<string, number> = {
  novice: 0,
  none: 0,
  activeMember: 1,
  friendOfAloe: 2,
  aloeCrew: 3,
  moderator: 4,
  admin: 5,
};

export function levelOf(value: UserRank | StaffRole | string | null | undefined): number {
  if (!value) return 0;
  return LEVELS[value] ?? 0;
}

export function effectiveLevel(rank: UserRank, staffRole: StaffRole): number {
  return Math.max(levelOf(rank), levelOf(staffRole));
}

export function meetsLevel(
  rank: UserRank,
  staffRole: StaffRole,
  required: UserRank | StaffRole,
): boolean {
  return effectiveLevel(rank, staffRole) >= levelOf(required);
}
