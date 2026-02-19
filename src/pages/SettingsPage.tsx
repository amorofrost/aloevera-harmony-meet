import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Camera, LogOut, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { usersApi, songsApi, apiClient } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<AloeVeraSong[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [eventsScrollPosition, setEventsScrollPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [userRes, songsRes] = await Promise.all([
        usersApi.getCurrentUser(),
        songsApi.getSongs(),
      ]);
      if (userRes.success && userRes.data) setUser(userRes.data);
      if (songsRes.success && songsRes.data) setSongs(songsRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

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

  const handleSave = async () => {
    if (!user) return;
    setIsEditing(false);
    await usersApi.updateUser(user.id, user);
  };

  const handleSignOut = () => {
    apiClient.clearAccessToken();
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
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}><Edit3 className="w-5 h-5" /></Button>
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
                  <div className="relative inline-block">
                    <img src={user.profileImage} alt={user.name} className="w-32 h-32 rounded-full object-cover shadow-lg" />
                    {isEditing && (
                      <Button size="sm" className="absolute bottom-0 right-0 rounded-full w-10 h-10 p-0"><Camera className="w-4 h-4" /></Button>
                    )}
                  </div>
                  <div className="mt-4"><h2 className="text-2xl font-bold">{user.name}, {user.age}</h2><p className="text-muted-foreground">{user.location}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card className="profile-card">
              <CardHeader><CardTitle>Информация о профиле</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>{t('profile.name')}</Label><Input value={user.name} onChange={(e) => setUser({...user, name: e.target.value})} disabled={!isEditing} className="mt-1" /></div>
                <div><Label>{t('profile.age')}</Label><Input type="number" value={user.age} onChange={(e) => setUser({...user, age: parseInt(e.target.value)})} disabled={!isEditing} className="mt-1" /></div>
                <div><Label>{t('profile.location')}</Label><Input value={user.location} onChange={(e) => setUser({...user, location: e.target.value})} disabled={!isEditing} className="mt-1" /></div>
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
                <div><Label>{t('profile.bio')}</Label><Textarea value={user.bio} onChange={(e) => setUser({...user, bio: e.target.value})} disabled={!isEditing} className="mt-1 min-h-[100px]" /></div>
                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSave} className="flex-1">{t('common.save')}</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">{t('common.cancel')}</Button>
                  </div>
                )}
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
