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
import { isWebPushSupported, getSubscriptionStatus, enableWebPush, disableWebPush } from '@/lib/webPush';
import type { SubscriptionStatus } from '@/lib/webPush';
import type {
  NotificationPreferences as Prefs,
  NotificationType,
  NotificationChannel,
  NotificationFrequency,
} from '@/types/notification';

interface Props {
  telegramLinked: boolean;
  pushSubscribed: boolean;
  emailVerified: boolean;
}

const TYPES: NotificationType[] = [
  'likeReceived', 'matchCreated', 'messageReceived', 'forumReplyToThread',
  'communityBroadcast', 'eventPublished', 'eventReminder', 'eventInviteReceived', 'rankUp',
];

const CHANNELS: NotificationChannel[] = ['inApp', 'telegram', 'webPush', 'email'];

const LOCKED_IMMEDIATE: NotificationChannel[] = ['inApp', 'webPush'];

export function NotificationPreferences({ telegramLinked, pushSubscribed, emailVerified }: Props) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<'loading' | SubscriptionStatus>('loading');

  useEffect(() => {
    notificationsApi.getPreferences().then((r) => {
      if (r.success && r.data) setPrefs(r.data);
    });
  }, []);

  useEffect(() => {
    if (isWebPushSupported()) {
      getSubscriptionStatus().then(setWebPushStatus);
    } else {
      setWebPushStatus('unsupported');
    }
  }, [pushSubscribed]);

  const handleEnableWebPush = async () => {
    try {
      await enableWebPush();
      toast.success('Web Push enabled');
      setWebPushStatus('subscribed');
    } catch (err) {
      showApiError(err as Error, 'Failed to enable Web Push');
    }
  };

  const handleDisableWebPush = async () => {
    try {
      await disableWebPush();
      toast.success('Web Push disabled on this device');
      setWebPushStatus('available');
    } catch (err) {
      showApiError(err as Error, 'Failed to disable Web Push');
    }
  };

  if (!prefs) return <div>Loading…</div>;

  const channelAvailable: Record<NotificationChannel, boolean> = {
    inApp: true,
    telegram: telegramLinked,
    webPush: pushSubscribed,
    email: emailVerified,
  };

  const handleMatrixToggle = (type: NotificationType, channel: NotificationChannel) => {
    if (channel === 'inApp') return; // in-app is locked on
    setPrefs({
      ...prefs,
      matrix: {
        ...prefs.matrix,
        [type]: { ...prefs.matrix[type], [channel]: !prefs.matrix[type][channel] },
      },
    });
  };

  const handleFrequencyChange = (channel: NotificationChannel, frequency: NotificationFrequency) => {
    setPrefs({ ...prefs, frequency: { ...prefs.frequency, [channel]: frequency } });
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

  const anyDaily = Object.values(prefs.frequency).includes('daily');

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

      {CHANNELS.map((channel) => (
        <div
          key={channel}
          data-channel={channel}
          data-disabled={!channelAvailable[channel]}
          className={cn('border rounded-lg p-4 space-y-3', !channelAvailable[channel] && 'opacity-50 pointer-events-none')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t(`notifications.settings.channel.${channel}`)}</h3>
            {!LOCKED_IMMEDIATE.includes(channel) && (
              <Select
                value={prefs.frequency[channel]}
                onValueChange={(v) => handleFrequencyChange(channel, v as NotificationFrequency)}
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">{t('notifications.settings.frequency.immediate')}</SelectItem>
                  <SelectItem value="hourly">{t('notifications.settings.frequency.hourly')}</SelectItem>
                  <SelectItem value="daily">{t('notifications.settings.frequency.daily')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {channel === 'webPush' && (
            <div className="text-sm">
              {webPushStatus === 'loading' && <span>Checking…</span>}
              {webPushStatus === 'subscribed' && (
                <Button variant="outline" size="sm" onClick={handleDisableWebPush}>
                  Disable on this device
                </Button>
              )}
              {webPushStatus === 'available' && (
                <Button variant="outline" size="sm" onClick={handleEnableWebPush}>
                  Enable on this device
                </Button>
              )}
              {webPushStatus === 'denied' && (
                <span className="text-muted-foreground">
                  Notification permission blocked — enable in browser settings
                </span>
              )}
              {webPushStatus === 'unsupported' && (
                <span className="text-muted-foreground">Browser doesn&apos;t support Web Push</span>
              )}
            </div>
          )}
          <div className="grid gap-2">
            {TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between">
                <Label className="text-sm">
                  {t(`notifications.title.${
                    type === 'forumReplyToThread' ? 'forumReply' :
                    type === 'eventInviteReceived' ? 'eventInvite' :
                    type
                  }`, { actor: '', preview: '', title: '', rank: '' })}
                </Label>
                <Switch
                  checked={prefs.matrix[type][channel]}
                  disabled={channel === 'inApp'}
                  onCheckedChange={() => handleMatrixToggle(type, channel)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {anyDaily && (
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

      <Button onClick={handleSave} disabled={saving} className="w-full">Save</Button>
    </div>
  );
}
