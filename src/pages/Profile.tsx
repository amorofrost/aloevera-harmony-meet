import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Edit3, Camera, LogOut, Globe, ChevronLeft, ChevronRight, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BottomNavigation from '@/components/ui/bottom-navigation';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHealthCheck } from '@/hooks/use-api';
import { checkBackendHealth } from '@/lib/api';
import { User, Event, AloeVeraSong } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// Mock AloeVera songs data
const mockSongs: AloeVeraSong[] = [
  {
    id: '1',
    title: 'Звездное небо',
    album: 'Первый альбом',
    duration: '3:45',
    previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    year: 2018
  },
  {
    id: '2', 
    title: 'Летний ветер',
    album: 'Первый альбом',
    duration: '4:12',
    previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    year: 2018
  },
  {
    id: '3',
    title: 'Новые горизонты',
    album: 'Второй альбом', 
    duration: '3:28',
    previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    year: 2020
  },
  {
    id: '4',
    title: 'В объятиях тишины',
    album: 'Второй альбом',
    duration: '4:55',
    previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    year: 2020
  },
  {
    id: '5',
    title: 'Дыхание города',
    album: 'Третий альбом',
    duration: '3:33',
    previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    year: 2022
  }
];

// Mock events data for attended events
const attendedEvents: Event[] = [
  {
    id: '4',
    title: 'AloeVera Summer Tour 2023',
    description: 'Летний тур группы AloeVera по России',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=400&fit=crop',
    date: new Date('2023-08-15T20:00:00'),
    location: 'Гребной канал, Санкт-Петербург',
    attendees: ['1'],
    category: 'concert',
    organizer: 'AloeVera Official'
  },
  {
    id: '6',
    title: 'Новогодний бал фанатов',
    description: 'Праздничная встреча фанатов группы',
    imageUrl: 'https://images.unsplash.com/photo-1482575832494-771f77fd8ba2?w=800&h=400&fit=crop',
    date: new Date('2022-12-30T21:00:00'),
    location: 'Дворец культуры, Москва',
    attendees: ['1'],
    category: 'party',
    organizer: 'Фан-клуб AloeVera'
  },
  {
    id: '7',
    title: 'AloeVera Fest 2022',
    description: 'Первый большой фестиваль группы',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
    date: new Date('2022-07-15T14:00:00'),
    location: 'Парк Горького, Москва',
    attendees: ['1'],
    category: 'festival',
    organizer: 'AloeVera Official'
  },
  {
    id: '9',
    title: 'Yachting 2026',
    description: 'Невероятная неделя яхтинга у берегов Австралии',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',
    date: new Date('2026-04-15T10:00:00'),
    location: 'Золотое побережье, Австралия',
    attendees: ['1'],
    category: 'yachting',
    organizer: 'Oceanic Adventures',
    isSecret: true
  },
  {
    id: '10',
    title: 'Yachting 2025',
    description: 'Магическая неделя яхтинга среди греческих островов',
    imageUrl: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&h=400&fit=crop',
    date: new Date('2025-08-10T09:00:00'),
    location: 'Миконос, Греция',
    attendees: ['1'],
    category: 'yachting',
    organizer: 'Mediterranean Sailing'
  }
];

// Mock user data
const mockUser: User = {
  id: 'current-user',
  name: 'Александра',
  age: 26,
  bio: 'Фанатка AloeVera с 2018 года. Люблю концерты, арт и хорошую компанию. Ищу того, кто разделит мою страсть к музыке! 🎵',
  location: 'Москва',
  gender: 'female',
  profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face',
  images: [],
  lastSeen: new Date(),
  isOnline: true,
  eventsAttended: attendedEvents,
  favoriteSong: mockSongs[0],
  preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
  settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
};

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(mockUser);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [eventsScrollPosition, setEventsScrollPosition] = useState(0);
  const { t, language, setLanguage } = useLanguage();
  
  // API health check hook
  const healthCheck = useHealthCheck();

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

  const handleSave = () => {
    setIsEditing(false);
    // Here you would save to backend
    console.log('Saving user profile:', user);
  };

  const handleImageUpload = () => {
    // Handle image upload
    console.log('Upload image');
  };

  const handleSignOut = () => {
    // Navigate back to welcome page
    navigate('/');
  };

  const handleApiTest = async () => {
    await healthCheck.execute(() => checkBackendHealth());
  };

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90"></div>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">
            {t('profile.title')}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        {/* Profile Photo */}
        <Card className="profile-card">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="relative inline-block">
                <img 
                  src={user.profileImage} 
                  alt={user.name}
                  className="w-32 h-32 rounded-full object-cover shadow-lg"
                />
                {isEditing && (
                  <Button
                    size="sm"
                    onClick={handleImageUpload}
                    className="absolute bottom-0 right-0 rounded-full w-10 h-10 p-0"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="mt-4 text-center">
                <h2 className="text-2xl font-bold">{user.name}, {user.age}</h2>
                <p className="text-muted-foreground">{user.location}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="profile-card">
          <CardHeader>
            <CardTitle>Информация о профиле</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">{t('profile.name')}</Label>
              <Input
                id="name"
                value={user.name}
                onChange={(e) => setUser({...user, name: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="age">{t('profile.age')}</Label>
              <Input
                id="age"
                type="number"
                value={user.age}
                onChange={(e) => setUser({...user, age: parseInt(e.target.value)})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="location">{t('profile.location')}</Label>
              <Input
                id="location"
                value={user.location}
                onChange={(e) => setUser({...user, location: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gender">{t('profile.gender')}</Label>
              <Select 
                value={user.gender} 
                onValueChange={(value) => setUser({...user, gender: value as any})}
                disabled={!isEditing}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                  <SelectItem value="non-binary">Небинарный</SelectItem>
                  <SelectItem value="prefer-not-to-say">Предпочитаю не указывать</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bio">{t('profile.bio')}</Label>
              <Textarea
                id="bio"
                value={user.bio}
                onChange={(e) => setUser({...user, bio: e.target.value})}
                disabled={!isEditing}
                className="mt-1 min-h-[100px]"
                placeholder="Расскажите о себе..."
              />
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  {t('common.save')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Favorite Song */}
        <Card className="profile-card">
          <CardHeader>
            <CardTitle>Любимая песня AloeVera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="favoriteSong">Выберите любимую песню</Label>
              <Select 
                value={user.favoriteSong?.id || ''} 
                onValueChange={(value) => {
                  const selectedSong = mockSongs.find(song => song.id === value);
                  setUser({...user, favoriteSong: selectedSong});
                }}
                disabled={!isEditing}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите песню..." />
                </SelectTrigger>
                <SelectContent>
                  {mockSongs.map((song) => (
                    <SelectItem key={song.id} value={song.id}>
                      {song.title} - {song.album} ({song.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {user.favoriteSong && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{user.favoriteSong.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {user.favoriteSong.album} • {user.favoriteSong.duration} • {user.favoriteSong.year}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const audio = new Audio(user.favoriteSong!.previewUrl);
                      audio.play();
                    }}
                  >
                    ▶️ Воспроизвести
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events Attended */}
        <Card className="profile-card">
          <CardHeader>
            <CardTitle>События, которые я посетил</CardTitle>
          </CardHeader>
          <CardContent>
            {user.eventsAttended && user.eventsAttended.length > 0 ? (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => scrollEvents('left')}
                    className="h-8 w-8 p-0 rounded-full flex-shrink-0"
                    disabled={eventsScrollPosition === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div 
                    id="events-scroll-container"
                    className="flex gap-3 overflow-x-auto scrollbar-hide flex-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {user.eventsAttended.map((event) => (
                      <div key={event.id} className="flex-shrink-0">
                        <EventPostmark
                          location={event.location}
                          date={event.date}
                          title={event.title}
                          category={event.category}
                          className="w-12 h-12"
                          showEventName={true}
                          onClick={() => navigate(`/events/${event.id}`)}
                        />
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => scrollEvents('right')}
                    className="h-8 w-8 p-0 rounded-full flex-shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Вы еще не посетили ни одного события
              </p>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        {showSettings && (
          <Card className="profile-card">
            <CardHeader>
              <CardTitle>{t('profile.settings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Видимость профиля</Label>
                  <p className="text-sm text-muted-foreground">Кто может видеть ваш профиль</p>
                </div>
                <Select 
                  value={user.settings.profileVisibility} 
                  onValueChange={(value) => setUser({
                    ...user, 
                    settings: {...user.settings, profileVisibility: value as any}
                  })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Публичный</SelectItem>
                    <SelectItem value="private">Приватный</SelectItem>
                    <SelectItem value="friends">Друзья</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Анонимные лайки</Label>
                  <p className="text-sm text-muted-foreground">Скрыть ваши лайки до взаимности</p>
                </div>
                <Switch
                  checked={user.settings.anonymousLikes}
                  onCheckedChange={(checked) => setUser({
                    ...user,
                    settings: {...user.settings, anonymousLikes: checked}
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Уведомления</Label>
                  <p className="text-sm text-muted-foreground">Получать push-уведомления</p>
                </div>
                <Switch
                  checked={user.settings.notifications}
                  onCheckedChange={(checked) => setUser({
                    ...user,
                    settings: {...user.settings, notifications: checked}
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <Label>Язык</Label>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">РУС</SelectItem>
                    <SelectItem value="en">ENG</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  variant="destructive" 
                  onClick={handleSignOut}
                  className="w-full mb-3"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('profile.signOut')}
                </Button>
                
                {/* API Test Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="outline" 
                      onClick={handleApiTest}
                      disabled={healthCheck.loading}
                      className="flex-1 mr-3"
                    >
                      <Wifi className="w-4 h-4 mr-2" />
                      {healthCheck.loading ? 'Testing...' : 'API Test'}
                    </Button>
                    {healthCheck.data && (
                      <div className="text-xs text-green-600 font-mono bg-green-50 px-2 py-1 rounded">
                        ✓ Connected
                      </div>
                    )}
                    {healthCheck.error && (
                      <div className="text-xs text-red-600 font-mono bg-red-50 px-2 py-1 rounded">
                        ✗ Error
                      </div>
                    )}
                  </div>
                  
                  {/* API Response Display */}
                  {healthCheck.data && (
                    <Alert>
                      <AlertDescription>
                        <div className="font-mono text-xs">
                          <strong>Backend Response:</strong>
                          <pre className="mt-1 whitespace-pre-wrap">
                            {JSON.stringify(healthCheck.data, null, 2)}
                          </pre>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {healthCheck.error && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <div className="font-mono text-xs">
                          <strong>Error:</strong>
                          <div className="mt-1">{healthCheck.error}</div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Profile;