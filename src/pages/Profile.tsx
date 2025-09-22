import React, { useState } from 'react';
import { Settings, Edit3, Camera, LogOut, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { User } from '@/types/user';

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
  preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
  settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
};

const Profile = () => {
  const [user, setUser] = useState<User>(mockUser);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { t, language, setLanguage } = useLanguage();

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
    // Handle sign out
    console.log('Sign out');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
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

      <div className="p-4 space-y-6">
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
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('profile.signOut')}
                </Button>
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