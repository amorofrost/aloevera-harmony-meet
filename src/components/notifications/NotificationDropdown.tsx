import { Link } from 'react-router-dom';
import { useNotificationStore } from '@/stores/notificationStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { notificationsApi } from '@/services/api';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface NotificationDropdownProps {
  onItemClick?: () => void;
}

export function NotificationDropdown({ onItemClick }: NotificationDropdownProps) {
  const { t } = useLanguage();
  const { flags } = useFeatureFlags();
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const seeAllHref = flags.feedEnabled ? '/feed' : '/notifications';

  const handleMarkAllRead = async () => {
    markAllRead();
    await notificationsApi.markAllRead();
  };

  const visible = items.slice(0, 10);

  return (
    <div className="w-80 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{t('notifications.bell')}</h3>
        <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs h-auto p-1">
          {t('notifications.markAllRead')}
        </Button>
      </div>
      {visible.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {t('notifications.empty')}
        </div>
      ) : (
        <div className="divide-y">
          {visible.map((n) => (
            <NotificationItem key={n.id} notification={n} onClickHandled={onItemClick} />
          ))}
        </div>
      )}
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link to={seeAllHref} onClick={onItemClick}>{t('notifications.seeAll')}</Link>
        </Button>
      </div>
    </div>
  );
}
