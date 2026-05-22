import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { notificationsApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';
import type {
  NotificationPreferences as Prefs,
  NotificationType,
  NotificationFrequency,
} from '@/types/notification';

interface Props {
  telegramLinked: boolean;
  /**
   * Kept for API compatibility with the SettingsPage caller, but unused for now —
   * Web Push and Email channels are hidden from this UI until the user-facing
   * stories around them are firmed up. The backend still honours the matrix
   * cells for these channels if they're set; we just don't expose toggles yet.
   */
  pushSubscribed?: boolean;
  emailVerified?: boolean;
}

const TYPES: NotificationType[] = [
  'likeReceived', 'matchCreated', 'messageReceived', 'forumReplyToThread',
  'communityBroadcast', 'eventPublished', 'eventReminder', 'eventInviteReceived', 'rankUp',
];

export function NotificationPreferences({ telegramLinked }: Props) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationsApi.getPreferences().then((r) => {
      if (r.success && r.data) setPrefs(r.data);
    });
  }, []);

  if (!prefs) return <div>{t('common.loading')}</div>;

  const handleTelegramToggle = (type: NotificationType) => {
    setPrefs({
      ...prefs,
      matrix: {
        ...prefs.matrix,
        [type]: { ...prefs.matrix[type], telegram: !prefs.matrix[type].telegram },
      },
    });
  };

  const handleTelegramFrequencyChange = (frequency: NotificationFrequency) => {
    setPrefs({ ...prefs, frequency: { ...prefs.frequency, telegram: frequency } });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await notificationsApi.updatePreferences(prefs);
      if (!r.success) {
        showApiError(r, 'Failed to save preferences');
        return;
      }
      toast.success('Preferences saved');
    } catch (err) {
      showApiError(err, 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const telegramDaily = prefs.frequency.telegram === 'daily';

  // Grid: type label | in-app toggle | telegram toggle
  const rowGrid = 'grid grid-cols-[1fr_5rem_5rem] items-center gap-2';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="mute-all">{t('notifications.settings.pauseAll')}</Label>
        <Switch
          id="mute-all"
          checked={prefs.mute}
          onCheckedChange={(v) => setPrefs({ ...prefs, mute: v })}
        />
      </div>

      {/* Telegram channel status — linked? frequency picker. Not linked? CTA. */}
      <div
        data-channel="telegram"
        data-disabled={!telegramLinked}
        className="flex items-center justify-between border rounded-lg px-4 py-3"
      >
        <div className="text-sm">
          <span className="font-medium">{t('notifications.settings.channel.telegram')}</span>
          {!telegramLinked && (
            <span className="ml-2 text-muted-foreground">
              · {t('notifications.settings.unavailable.telegram')}
            </span>
          )}
        </div>
        {telegramLinked && (
          <Select
            value={prefs.frequency.telegram}
            onValueChange={(v) => handleTelegramFrequencyChange(v as NotificationFrequency)}
          >
            <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">{t('notifications.settings.frequency.immediate')}</SelectItem>
              <SelectItem value="hourly">{t('notifications.settings.frequency.hourly')}</SelectItem>
              <SelectItem value="daily">{t('notifications.settings.frequency.daily')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Matrix card: type rows × (in-app, telegram) columns */}
      <div className="border rounded-lg overflow-hidden">
        <div className={cn(rowGrid, 'px-4 py-2 border-b bg-muted/30')}>
          <div />
          <div className="text-center text-xs font-semibold text-muted-foreground">
            {t('notifications.settings.channel.inApp')}
          </div>
          <div
            className={cn(
              'text-center text-xs font-semibold text-muted-foreground',
              !telegramLinked && 'opacity-50'
            )}
          >
            {t('notifications.settings.channel.telegram')}
          </div>
        </div>

        {TYPES.map((type) => {
          const typeLabel = t(`notifications.settings.type.${type}`);
          return (
            <div
              key={type}
              className={cn(rowGrid, 'px-4 py-3 border-b last:border-b-0')}
            >
              <Label className="text-sm">{typeLabel}</Label>
              <div className="flex justify-center">
                <Switch
                  checked={prefs.matrix[type].inApp}
                  disabled
                  aria-label={`${typeLabel} — ${t('notifications.settings.channel.inApp')}`}
                />
              </div>
              <div
                className="flex justify-center"
                data-channel="telegram"
                data-type={type}
                data-disabled={!telegramLinked}
              >
                <Switch
                  checked={prefs.matrix[type].telegram}
                  disabled={!telegramLinked}
                  onCheckedChange={() => handleTelegramToggle(type)}
                  aria-label={`${typeLabel} — ${t('notifications.settings.channel.telegram')}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {telegramDaily && (
        <div className="flex items-center justify-between">
          <Label>{t('notifications.settings.dailyHour')}</Label>
          <Select
            value={String(prefs.dailyDigestHourUtc)}
            onValueChange={(v) => setPrefs({ ...prefs, dailyDigestHourUtc: Number(v) })}
          >
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>{i.toString().padStart(2, '0')}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {t('common.save')}
      </Button>
    </div>
  );
}
