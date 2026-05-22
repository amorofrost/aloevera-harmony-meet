import { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { FeedCardForNotification } from '@/components/feed';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { Notification } from '@/types/notification';

export default function Feed() {
  const { t } = useLanguage();
  const items = useNotificationStore((s) => s.items);
  const setItems = useNotificationStore((s) => s.setItems);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    notificationsApi.list(undefined, 50).then((r) => {
      if (r.success && r.data) setItems(r.data.items as Notification[]);
      setIsLoading(false);
    });
  }, [setItems]);

  const visible = filter === 'unread' ? items.filter((n) => !n.readAtUtc) : items;

  const handleMarkAllRead = async () => {
    markAllRead();
    await notificationsApi.markAllRead();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">{t('notifications.feedTitle')}</h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Newspaper className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              {t('notifications.all')}
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              {t('notifications.unread')}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            {t('notifications.markAllRead')}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground p-8">
            {t('common.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            {t('notifications.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((n) => (
              <FeedCardForNotification key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
