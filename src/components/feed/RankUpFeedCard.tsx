import { UserBadges } from '@/components/ui/user-badges';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Notification } from '@/types/notification';
import type { UserRank } from '@/types/user';
import { FeedCard, parsePayload } from './FeedCard';

interface RankUpFeedCardProps {
  notification: Notification;
}

const VALID_RANKS: ReadonlySet<UserRank> = new Set([
  'novice',
  'activeMember',
  'friendOfAloe',
  'aloeCrew',
]);

function asRank(value: unknown): UserRank | null {
  return typeof value === 'string' && VALID_RANKS.has(value as UserRank)
    ? (value as UserRank)
    : null;
}

export function RankUpFeedCard({ notification }: RankUpFeedCardProps) {
  const { t } = useLanguage();
  const payload = parsePayload(notification.payloadJson);
  const newRank = asRank(payload.newRank);
  const previousRank = asRank(payload.previousRank);

  return (
    <FeedCard
      notification={notification}
      className="border-aloe-gold/50"
    >
      <div className="space-y-2">
        {newRank && (
          <div className="text-base">
            <UserBadges rank={newRank} className="text-base" />
          </div>
        )}
        {newRank && previousRank && (
          <p className="text-xs text-muted-foreground">
            {t('feed.rankUpFrom', {
              previous: t(`rank.${previousRank}`),
              new: t(`rank.${newRank}`),
            })}
          </p>
        )}
      </div>
    </FeedCard>
  );
}
