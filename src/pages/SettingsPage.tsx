import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, LogOut, Globe, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventPostmark from '@/components/ui/event-postmark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User, AloeVeraSong } from '@/types/user';
import { usersApi, songsApi, apiClient, authApi } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { profileEditSchema, type ProfileEditSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import { UserBadges } from '@/components/ui/user-badges';

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          location: userRes.data.location,
          bio: userRes.data.bio ?? '',
        });
      }
      if (songsRes.success && songsRes.data) setSongs(songsRes.data);
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
      const response = await usersApi.updateUser(user.id, { ...user, ...data });
      if (!response.success) {
        showApiError(response, 'Failed to update profile');
        return;
      }
      setUser({ ...user, ...data });
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      showApiError(err, 'Failed to update profile');
    }
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
    setPendingFile(file);
  };

  const handleSavePhoto = async () => {
    if (!pendingFile || !user) return;
    setIsUploading(true);
    try {
      const result = await usersApi.uploadProfileImage(user.id, pendingFile);
      if (!result.success) throw result;
      setUser({ ...user, profileImage: result.data! });
      setPreviewUrl(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(t('profile.photoUpdated'));
    } catch (err) {
      showApiError(err, t('profile.photoUploadFailed'));
      setPreviewUrl(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPhoto = () => {
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          <div className="flex gap-2">
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
                    onClick={handleAvatarClick}
                  >
                    <img
                      src={previewUrl ?? user.profileImage}
                      alt={user.name}
                      className="w-32 h-32 rounded-full object-cover shadow-lg"
                    />
                    <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[--aloe-flame] flex items-center justify-center border-2 border-background">
                      <Pencil className="w-3.5 h-3.5 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>
                  {pendingFile && (
                    <div className="flex gap-2 mt-3">
                      <Button onClick={handleSavePhoto} disabled={isUploading} size="sm">
                        {isUploading ? t('profile.savingPhoto') : t('profile.savePhoto')}
                      </Button>
                      <Button onClick={handleCancelPhoto} disabled={isUploading} variant="outline" size="sm">
                        {t('common.cancel')}
                      </Button>
                    </div>
                  )}
                  <div className="mt-4"><h2 className="text-2xl font-bold">{user.name}, {user.age}</h2><UserBadges rank={user.rank} staffRole={user.staffRole} className="mt-1" /><p className="text-muted-foreground">{user.location}</p></div>
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
                    <Input
                      {...(isEditing ? profileForm.register('location') : {})}
                      value={isEditing ? undefined : user.location}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                    {isEditing && profileForm.formState.errors.location && (
                      <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.location.message}</p>
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

            {songs.length > 0 && (
              <Card className="profile-card">
                <CardHeader><CardTitle>Любимая песня AloeVera</CardTitle></CardHeader>
                <CardContent>
                  <Select value={user.favoriteSong?.id || ''} onValueChange={(v) => setUser({...user, favoriteSong: songs.find(s => s.id === v)})} disabled={!isEditing}>
                    <SelectTrigger><SelectValue placeholder="Выберите песню..." /></SelectTrigger>
                    <SelectContent>{songs.map(s => <SelectItem key={s.id} value={s.id}>{s.title} - {s.album}</SelectItem>)}</SelectContent>
                  </Select>
                  {user.favoriteSong && (
                    <div className="bg-muted/50 rounded-lg p-4 mt-4">
                      <h4 className="font-medium">{user.favoriteSong.title}</h4>
                      <p className="text-sm text-muted-foreground">{user.favoriteSong.album} · {user.favoriteSong.duration}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                            <EventPostmark location={event.location} date={event.date} title={event.title} category={event.category} className="w-12 h-12" showEventName onClick={() => navigate(`/aloevera/events/${event.id}`)} />
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
                <div className="flex items-center justify-between">
                  <div><Label>Видимость профиля</Label><p className="text-sm text-muted-foreground">Кто может видеть ваш профиль</p></div>
                  <Select value={user.settings.profileVisibility} onValueChange={(v) => setUser({...user, settings: {...user.settings, profileVisibility: v as User['settings']['profileVisibility']}})}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Публичный</SelectItem>
                      <SelectItem value="private">Приватный</SelectItem>
                      <SelectItem value="friends">Друзья</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Анонимные лайки</Label><p className="text-sm text-muted-foreground">Скрыть ваше имя при лайках</p></div>
                  <Switch checked={user.settings.anonymousLikes} onCheckedChange={(v) => setUser({...user, settings: {...user.settings, anonymousLikes: v}})} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Уведомления</Label><p className="text-sm text-muted-foreground">Push-уведомления</p></div>
                  <Switch checked={user.settings.notifications} onCheckedChange={(v) => setUser({...user, settings: {...user.settings, notifications: v}})} />
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
              <CardHeader><CardTitle>Предпочтения поиска</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Возрастной диапазон</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="number" value={user.preferences.ageRange[0]} onChange={(e) => setUser({...user, preferences: {...user.preferences, ageRange: [parseInt(e.target.value), user.preferences.ageRange[1]]}})} className="w-20" />
                    <span className="self-center">—</span>
                    <Input type="number" value={user.preferences.ageRange[1]} onChange={(e) => setUser({...user, preferences: {...user.preferences, ageRange: [user.preferences.ageRange[0], parseInt(e.target.value)]}})} className="w-20" />
                  </div>
                </div>
                <div>
                  <Label>Показывать</Label>
                  <Select value={user.preferences.showMe} onValueChange={(v) => setUser({...user, preferences: {...user.preferences, showMe: v as User['preferences']['showMe']}})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Всех</SelectItem>
                      <SelectItem value="men">Мужчин</SelectItem>
                      <SelectItem value="female">Женщин</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

export default SettingsPage;
