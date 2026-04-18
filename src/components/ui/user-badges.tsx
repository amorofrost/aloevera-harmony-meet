import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { UserRank, StaffRole } from '@/types/user';

export interface UserBadgesProps extends React.HTMLAttributes<HTMLDivElement> {
  rank?: UserRank;
  staffRole?: StaffRole;
}

const RANK_DOT: Record<UserRank, string> = {
  novice: 'bg-muted',
  activeMember: 'bg-aloe-sage',
  friendOfAloe: 'bg-aloe-ocean',
  aloeCrew: 'bg-aloe-gold',
};

const STAFF_PILL: Record<Exclude<StaffRole, 'none'>, string> = {
  moderator: 'bg-aloe-lavender',
  admin: 'bg-aloe-flame',
};

export function UserBadges({
  rank = 'novice',
  staffRole = 'none',
  className,
  ...props
}: UserBadgesProps) {
  const { t } = useLanguage();
  const showRank = rank !== 'novice';
  const showStaff = staffRole !== 'none';
  if (!showRank && !showStaff) return null;

  return (
    <div className={cn('inline-flex items-center gap-2 text-xs', className)} {...props}>
      {showRank && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className={cn('h-2 w-2 rounded-full', RANK_DOT[rank])} aria-hidden />
          <span>{t(`rank.${rank}`)}</span>
        </span>
      )}
      {showStaff && (
        <span
          className={cn(
            'uppercase text-[10px] tracking-wide px-1.5 py-0.5 rounded text-white font-semibold',
            STAFF_PILL[staffRole as Exclude<StaffRole, 'none'>],
          )}
        >
          {t(`staffRole.${staffRole}`)}
        </span>
      )}
    </div>
  );
}
