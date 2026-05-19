import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import BottomNavigation from '@/components/ui/bottom-navigation';
import type { Notification } from '@/types/notification';

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
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
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">{t('notifications.bell')}</h1>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            {t('notifications.markAllRead')}
          </Button>
        </div>
        <div className="flex gap-2 px-4 pb-2">
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
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground p-8">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">{t('notifications.empty')}</div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {visible.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
