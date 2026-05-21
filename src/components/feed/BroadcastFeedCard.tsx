import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Notification } from '@/types/notification';
import { FeedCard, parsePayload } from './FeedCard';

interface BroadcastFeedCardProps {
  notification: Notification;
}

function isExternalLink(link: string): boolean {
  return link.startsWith('http://') || link.startsWith('https://');
}

export function BroadcastFeedCard({ notification }: BroadcastFeedCardProps) {
  const { t } = useLanguage();
  const payload = parsePayload(notification.payloadJson);
  const body = typeof payload.body === 'string' ? payload.body : '';
  const link = typeof payload.link === 'string' ? payload.link : '';
  const external = !!link && isExternalLink(link);

  // Reuse "viewEvent" label as the generic open verb — copy approval pending.
  const openLabel = t('feed.viewEvent');

  let footer: React.ReactNode = undefined;
  if (link) {
    footer = external ? (
      <Button asChild size="sm">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {openLabel}
        </a>
      </Button>
    ) : (
      <Button asChild size="sm">
        <Link to={link} onClick={(e) => e.stopPropagation()}>
          {openLabel}
        </Link>
      </Button>
    );
  }

  return (
    <FeedCard notification={notification} footer={footer}>
      {body ? <p className="text-sm whitespace-pre-wrap">{body}</p> : null}
    </FeedCard>
  );
}
