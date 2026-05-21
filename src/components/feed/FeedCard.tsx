import { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatNotificationTitle,
  formatNotificationLink,
} from '@/lib/notificationFormatting';
import { notificationIcons } from '@/components/notifications/notificationIcons';
import type { Notification } from '@/types/notification';

export interface FeedCardProps {
  notification: Notification;
  children?: ReactNode;
  footer?: ReactNode;
  /** When provided, replaces the auto-formatted title. */
  titleOverride?: ReactNode;
  /** Optional extra container class names. */
  className?: string;
}

/**
 * Shared shell for all feed cards. Wraps the card body in a clickable Card that:
 * 1. Marks the notification as read on click (in store + via API)
 * 2. Navigates to the formatted notification link
 * Footer slots are rendered inside a stop-propagation wrapper so per-card
 * action buttons can opt out of triggering the card-level navigation.
 */
export function FeedCard({
  notification,
  children,
  footer,
  titleOverride,
  className,
}: FeedCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const markRead = useNotificationStore((s) => s.markRead);
  const Icon = notificationIcons[notification.type];
  const title = titleOverride ?? formatNotificationTitle(notification, t);
  const link = formatNotificationLink(notification);
  const isUnread = !notification.readAtUtc;

  const handleClick = async () => {
    if (isUnread) {
      markRead(notification.id);
      await notificationsApi.markRead(notification.id);
    }
    navigate(link);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleClick();
        }
      }}
      className={cn(
        'cursor-pointer hover:bg-accent/30 transition-colors',
        isUnread && 'bg-accent/40',
        className,
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(notification.createdAtUtc), {
                addSuffix: true,
              })}
            </p>
          </div>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
          )}
        </div>

        {children && <div className="pl-11">{children}</div>}

        {footer && (
          <div
            className="pl-11 flex flex-wrap gap-2"
            // Stop propagation so footer button clicks don't double-navigate.
            onClick={(e) => e.stopPropagation()}
          >
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Small helper for cards that need to parse the JSON payload safely.
export function parsePayload(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
