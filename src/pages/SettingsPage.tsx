import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, LogOut, Globe, ChevronLeft, ChevronRight, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventAttendanceMark } from '@/components/ui/event-attendance-mark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User, AloeVeraSong, PromptAnswer } from '@/types/user';
import { usersApi, songsApi, apiClient, authApi, notificationsApi } from '@/services/api';
import { PhotoGrid } from '@/components/settings/PhotoGrid';
import { PromptsEditor } from '@/components/settings/PromptsEditor';
import heroBg from '@/assets/hero-bg.jpg';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { profileEditSchema, type ProfileEditSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import { UserBadges } from '@/components/ui/user-badges';
import { DualLocationPicker } from '@/components/ui/dual-location-picker';
import { LocationDisplay } from '@/components/ui/location-display';
import LinkedAccountsCard from '@/components/settings/LinkedAccountsCard';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { NotificationAvailability } from '@/types/notification';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<AloeVeraSong[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [eventsScrollPosition, setEventsScrollPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language, setLanguage } = useLanguage();
  const profileForm = useForm<ProfileEditSchema>({
    resolver: zodResolver(profileEditSchema),
  });
  const [editStartUser, setEditStartUser] = useState<User | null>(null);
  const [availability, setAvailability] = useState<NotificationAvailability>({
    telegramLinked: false,
    emailVerified: false,
    webPushSubscribed: false,
  });

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [userRes, songsRes] = await Promise.all([
        usersApi.getCurrentUser(),
        songsApi.getSongs(),
      ]);
      if (userRes.success && userRes.data) {
        setUser(userRes.data);
        profileForm.reset({
          name: userRes.data.name,
          age: userRes.data.age,
          country: userRes.data.country ?? '',
          region: userRes.data.region ?? '',
          secondaryCountry: userRes.data.secondaryCountry ?? '',
          secondaryRegion: userRes.data.secondaryRegion ?? '',
          bio: userRes.data.bio ?? '',
          instagramHandle: userRes.data.instagramHandle ?? '',
        });
      }
      if (songsRes.success && songsRes.data) setSongs(songsRes.data);
      notificationsApi.getAvailability().then((r) => {
        if (r.success && r.data) setAvailability(r.data);
      });
      setIsLoading(false);
    };
    load();
  }, [profileForm]);

  const scrollEvents = (direction: 'left' | 'right') => {
    const container = document.getElementById('events-scroll-container');
    if (container) {
      const scrollAmount = 150;
      const newPosition = direction === 'left'
        ? Math.max(0, eventsScrollPosition - scrollAmount)
        : eventsScrollPosition + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setEventsScrollPosition(newPosition);
    }
  };

  const handleSave = profileForm.handleSubmit(async (data) => {
    if (!user) return;
    try {
      const response = await usersApi.updateUser(user.id, { ...user, ...data, instagramHandle: data.instagramHandle || undefined });
      if (!response.success) {
        showApiError(response, 'Failed to update profile');
        return;
      }
      setUser({ ...user, ...data, instagramHandle: data.instagramHandle || undefined });
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      showApiError(err, 'Failed to update profile');
    }
  });

  const handleToggleAnonymousLikes = async (checked: boolean) => {
    if (!user) return;
    const next = { ...user, settings: { ...user.settings, anonymousLikes: checked } };
    setUser(next);
    const res = await usersApi.updateUser(user.id, next);
    if (!res.success) {
      setUser(user); // revert on failure
      showApiError(res, 'Failed to update setting');
    }
  };

  const handleSignOut = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      showApiError(err, 'Logout failed');
    }
    apiClient.clearTokens();
    navigate('/');
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => {
              if (!isEditing) setEditStartUser(user);
              setIsEditing(!isEditing);
            }}><Edit3 className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6 space-y-6">
            <Card className="profile-card">
              <CardContent className="p-6">
                <div className="text-center">
                  <div
                    className="relative inline-block cursor-pointer"
                    onClick={() => navigate(`/friends?userId=${user.id}`)}
                  >
                    <img
                      src={user.profileImage}
                      alt={user.name}
                      className="w-32 h-32 rounded-full object-cover shadow-lg"
                    />
                  </div>
                  <div className="mt-4"><h2 className="text-2xl font-bold">{user.name}{user.age ? `, ${user.age}` : ''}</h2><UserBadges rank={user.rank} staffRole={user.staffRole} accountName={user.accountName} className="mt-1" /><LocationDisplay country={user.country} region={user.region} secondaryCountry={user.secondaryCountry} secondaryRegion={user.secondaryRegion} location={user.location} className="text-sm text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="profile-card">
              <CardHeader><CardTitle>Информация о профиле</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <Label>{t('profile.name')}</Label>
                    <Input
                      {...(isEditing ? profileForm.register('name') : {})}
                      value={isEditing ? undefined : user.name}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                    {isEditing && profileForm.formState.errors.name && (
                      <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>{t('profile.age')}</Label>
                    <Input
                      type="number"
                      {...(isEditing ? profileForm.register('age', { valueAsNumber: true }) : {})}
                      value={isEditing ? undefined : user.age}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                    {isEditing && profileForm.formState.errors.age && (
                      <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.age.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>{t('profile.location')}</Label>
                    {isEditing ? (
                      <>
                        <Controller
                          control={profileForm.control}
                          name="country"
                          render={({ field }) => (
                            <DualLocationPicker
                              country={field.value ?? ''}
                              region={profileForm.watch('region') ?? ''}
                              secondaryCountry={profileForm.watch('secondaryCountry') ?? ''}
                              secondaryRegion={profileForm.watch('secondaryRegion') ?? ''}
                              onChange={({ country, region, secondaryCountry, secondaryRegion }) => {
                                profileForm.setValue('country', country, { shouldValidate: true });
                                profileForm.setValue('region', region, { shouldValidate: true });
                                profileForm.setValue('secondaryCountry', secondaryCountry, { shouldValidate: true });
                                profileForm.setValue('secondaryRegion', secondaryRegion, { shouldValidate: true });
                              }}
                            />
                          )}
                        />
                        {profileForm.formState.errors.country && (
                          <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.country.message}</p>
                        )}
                        {profileForm.formState.errors.region && (
                          <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.region.message}</p>
                        )}
                        {profileForm.formState.errors.secondaryCountry && (
                          <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.secondaryCountry.message}</p>
                        )}
                        {profileForm.formState.errors.secondaryRegion && (
                          <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.secondaryRegion.message}</p>
                        )}
                      </>
                    ) : (
                      <div className="mt-1">
                        <LocationDisplay country={user.country} region={user.region} secondaryCountry={user.secondaryCountry} secondaryRegion={user.secondaryRegion} location={user.location} className="text-sm text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>{t('profile.gender')}</Label>
                    <Select value={user.gender} onValueChange={(v) => setUser({...user, gender: v as User['gender']})} disabled={!isEditing}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Мужской</SelectItem>
                        <SelectItem value="female">Женский</SelectItem>
                        <SelectItem value="non-binary">Небинарный</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('profile.bio')}</Label>
                    <Textarea
                      {...(isEditing ? profileForm.register('bio') : {})}
                      value={isEditing ? undefined : (user.bio ?? '')}
                      disabled={!isEditing}
                      className="mt-1 min-h-[100px]"
                    />
                    {isEditing && profileForm.formState.errors.bio && (
                      <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.bio.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Instagram className="w-4 h-4" />
                      {t('profile.instagram')}
                    </Label>
                    {isEditing ? (
                      <>
                        <Input
                          {...profileForm.register('instagramHandle')}
                          placeholder={t('profile.instagramPlaceholder')}
                          className="mt-1"
                        />
                        {profileForm.formState.errors.instagramHandle && (
                          <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.instagramHandle.message}</p>
                        )}
                      </>
                    ) : user.instagramHandle ? (
                      <a
                        href={`https://www.instagram.com/${user.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        @{user.instagramHandle}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1">{t('common.save')}</Button>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          profileForm.reset();
                          if (editStartUser) setUser(editStartUser);
                          setIsEditing(false);
                        }}
                        className="flex-1"
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <LinkedAccountsCard />

            {user && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold mb-2">{t('settings.photos.title')}</h2>
                <p className="text-xs text-muted-foreground mb-3">{t('settings.photos.dragHint')}</p>
                <PhotoGridSettingsBlock user={user} onUserUpdate={setUser} />
              </section>
            )}

            {user && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold mb-3">{t('settings.prompts.title')}</h2>
                <PromptsEditor
                  initial={user.prompts ?? []}
                  onSave={async (prompts) => {
                    try {
                      const result = await usersApi.updateUser(user.id, { ...user, prompts });
                      if (!result.success) {
                        showApiError(result, t('settings.prompts.saveFailed'));
                        return;
                      }
                      if (result.data) setUser(result.data);
                      toast.success(t('settings.prompts.saveSuccess'));
                    } catch (err) {
                      showApiError(err, t('settings.prompts.saveFailed'));
                    }
                  }}
                />
              </section>
            )}

            {/* Favorite AloeVera song — hidden for now, will be reimplemented later */}

            {user.eventsAttended && user.eventsAttended.length > 0 && (
              <Card className="profile-card">
                <CardHeader><CardTitle>Посещённые события</CardTitle></CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => scrollEvents('left')} className="h-8 w-8 p-0 rounded-full flex-shrink-0"><ChevronLeft className="h-4 w-4" /></Button>
                      <div id="events-scroll-container" className="flex gap-3 overflow-x-auto scrollbar-hide flex-1" style={{ scrollbarWidth: 'none' }}>
                        {user.eventsAttended.map((event) => (
                          <div key={event.id} className="flex-shrink-0">
                            <EventAttendanceMark
                              event={event}
                              size="sm"
                              showEventName
                              onClick={() => navigate(`/aloevera/events/${event.id}`)}
                            />
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => scrollEvents('right')} className="h-8 w-8 p-0 rounded-full flex-shrink-0"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6 space-y-6">
            <Card className="profile-card">
              <CardHeader><CardTitle>{t('profile.settings')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Profile visibility and push notifications aren't backed by anything
                    server-side yet — disabled until the corresponding features ship.
                    Controls stay visible so users can see what's coming. Anonymous
                    likes is enabled and persists immediately via PUT /users/{id}. */}
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <Label>Видимость профиля</Label>
                    <p className="text-sm text-muted-foreground">Кто может видеть ваш профиль</p>
                    <p className="text-xs italic text-muted-foreground mt-0.5">{t('settings.comingSoon')}</p>
                  </div>
                  <Select value={user.settings.profileVisibility} disabled>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Публичный</SelectItem>
                      <SelectItem value="private">Приватный</SelectItem>
                      <SelectItem value="friends">Друзья</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-sm font-medium">{t('settings.anonymousLikes')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.anonymousLikesHelp')}</p>
                  </div>
                  <Switch
                    checked={user.settings.anonymousLikes}
                    onCheckedChange={handleToggleAnonymousLikes}
                  />
                </div>
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <Label>Уведомления</Label>
                    <p className="text-sm text-muted-foreground">Push-уведомления</p>
                    <p className="text-xs italic text-muted-foreground mt-0.5">{t('settings.comingSoon')}</p>
                  </div>
                  <Switch checked={user.settings.notifications} disabled />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Globe className="w-4 h-4" /><Label>Язык</Label></div>
                  <Select value={language} onValueChange={(v) => setLanguage(v as 'ru' | 'en')}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="profile-card">
              <CardHeader><CardTitle>{t('notifications.settings.title')}</CardTitle></CardHeader>
              <CardContent>
                <NotificationPreferences
                  telegramLinked={availability.telegramLinked}
                  emailVerified={availability.emailVerified}
                  pushSubscribed={availability.webPushSubscribed}
                />
              </CardContent>
            </Card>

            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />{t('profile.signOut')}
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

function PhotoGridSettingsBlock({ user, onUserUpdate }: { user: User; onUserUpdate: (u: User) => void }) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<string[]>(() => {
    const seed = [user.profileImage, ...(user.images ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(seed)).slice(0, 6);
  });

  const save = async () => {
    try {
      const result = await usersApi.updateUser(user.id, { ...user, profileImage: photos[0] ?? '', images: photos });
      if (!result.success) {
        showApiError(result, t('settings.photos.saveFailed'));
        return;
      }
      if (result.data) onUserUpdate(result.data);
      toast.success(t('settings.photos.saveSuccess'));
    } catch (err) {
      showApiError(err, t('settings.photos.saveFailed'));
    }
  };

  return (
    <>
      <PhotoGrid images={photos} maxPhotos={6} onChange={setPhotos} />
      <Button onClick={save} className="mt-3">{t('settings.photos.save')}</Button>
    </>
  );
}

export default SettingsPage;
