import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/services/api';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setItems = useNotificationStore((s) => s.setItems);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // Hydrate store on mount
  useEffect(() => {
    notificationsApi.list().then(r => { if (r.success && r.data) setItems(r.data.items); });
    notificationsApi.unreadCount().then(r => { if (r.success && r.data) setUnreadCount(r.data.count); });
  }, [setItems, setUnreadCount]);

  const badge = (
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{badge}</SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-96 p-0">
          <NotificationDropdown onItemClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-80">
        <NotificationDropdown onItemClick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
