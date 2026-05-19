import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { formatNotificationTitle, formatNotificationLink } from '@/lib/notificationFormatting';
import { notificationIcons } from './notificationIcons';
import type { Notification } from '@/types/notification';

interface NotificationItemProps {
  notification: Notification;
  onClickHandled?: () => void;
}

export function NotificationItem({ notification, onClickHandled }: NotificationItemProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const markRead = useNotificationStore((s) => s.markRead);
  const Icon = notificationIcons[notification.type];
  const title = formatNotificationTitle(notification, t);
  const link = formatNotificationLink(notification);
  const isUnread = !notification.readAtUtc;

  const handleClick = async () => {
    if (isUnread) {
      markRead(notification.id);
      await notificationsApi.markRead(notification.id);
    }
    onClickHandled?.();
    navigate(link);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left flex gap-3 p-3 hover:bg-accent transition-colors',
        isUnread && 'bg-accent/40'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAtUtc), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
    </button>
  );
}
