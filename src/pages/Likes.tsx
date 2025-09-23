import React, { useState } from 'react';
import { Heart, Send, ArrowLeft, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Match, Like } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// Mock data with read status
const mockMatches: (Match & { otherUser: User; isRead: boolean })[] = [
  {
    id: '1',
    users: ['current-user', '1'],
    createdAt: new Date('2024-02-20'),
    isRead: false,
    otherUser: {
      id: '1',
      name: 'Анна',
      age: 25,
      bio: 'Обожаю музыку AloeVera',
      location: 'Москва',
      gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
      images: [],
      lastSeen: new Date(),
      isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
    }
  },
  {
    id: '4',
    users: ['current-user', '4'],
    createdAt: new Date('2024-02-22'),
    isRead: true,
    otherUser: {
      id: '4',
      name: 'Мария',
      age: 26,
      bio: 'Фотограф, люблю AloeVera',
      location: 'Москва',
      gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop&crop=face',
      images: [],
      lastSeen: new Date(),
      isOnline: false,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
    }
  }
];

const mockSentLikes: (Like & { toUser: User })[] = [
  {
    id: '2',
    fromUserId: 'current-user',
    toUserId: '2',
    createdAt: new Date('2024-02-21'),
    isMatch: false,
    toUser: {
      id: '2',
      name: 'Дмитрий',
      age: 28,
      bio: 'Музыкант, фанат AloeVera',
      location: 'Санкт-Петербург',
      gender: 'male',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
      images: [],
      lastSeen: new Date(),
      isOnline: false,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
    }
  }
];

const mockReceivedLikes: (Like & { fromUser: User; isRead: boolean })[] = [
  {
    id: '3',
    fromUserId: '3',
    toUserId: 'current-user',
    createdAt: new Date('2024-02-19'),
    isMatch: false,
    isRead: false,
    fromUser: {
      id: '3',
      name: 'Елена',
      age: 22,
      bio: 'Танцую под AloeVera',
      location: 'Новосибирск',
      gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
      images: [],
      lastSeen: new Date(),
      isOnline: true,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
    }
  },
  {
    id: '5',
    fromUserId: '5',
    toUserId: 'current-user',
    createdAt: new Date('2024-02-18'),
    isMatch: false,
    isRead: true,
    fromUser: {
      id: '5',
      name: 'Алексей',
      age: 30,
      bio: 'Музыкант AloeVera cover band',
      location: 'Екатеринбург',
      gender: 'male',
      profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop&crop=face',
      images: [],
      lastSeen: new Date(),
      isOnline: false,
      preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
      settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
    }
  }
];

const Likes = () => {
  const [activeTab, setActiveTab] = useState('matches');
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Count unread items
  const unreadMatches = mockMatches.filter(match => !match.isRead).length;
  const unreadReceivedLikes = mockReceivedLikes.filter(like => !like.isRead).length;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  };

  const handleChatWithMatch = (matchId: string) => {
    // Navigate to chats page with the specific chat
    navigate('/chats');
  };

  const handleLikeBack = (userId: string) => {
    console.log('Like back user:', userId);
    // Create match
  };

  const UserCard = ({ user, actionButton, subtitle }: { 
    user: User; 
    actionButton?: React.ReactNode;
    subtitle?: string;
  }) => (
    <Card className="profile-card mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={user.profileImage} 
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${user.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{user.name}, {user.age}</h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">{user.location}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{user.bio}</p>
          </div>

          {actionButton}
        </div>
      </CardContent>
    </Card>
  );

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
            Лайки
          </h1>
          <Heart className="w-6 h-6 text-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches" className="relative">
              <div className="flex items-center gap-2">
                <span>{t('likes.matches')}</span>
                <Badge variant="secondary" className="text-xs">
                  {mockMatches.length}
                </Badge>
                {unreadMatches > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="sent" className="relative">
              <div className="flex items-center gap-2">
                <span>{t('likes.sent')}</span>
                <Badge variant="secondary" className="text-xs">
                  {mockSentLikes.length}
                </Badge>
              </div>
            </TabsTrigger>
            <TabsTrigger value="received" className="relative">
              <div className="flex items-center gap-2">
                <span>{t('likes.received')}</span>
                <Badge variant="secondary" className="text-xs">
                  {mockReceivedLikes.length}
                </Badge>
                {unreadReceivedLikes > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Matches Tab */}
          <TabsContent value="matches" className="mt-6">
            {mockMatches.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noMatches')}</h3>
                <p className="text-muted-foreground">
                  Лайкайте профили, чтобы найти взаимность
                </p>
              </div>
            ) : (
              <div>
                {mockMatches.map((match) => (
                  <UserCard
                    key={match.id}
                    user={match.otherUser}
                    subtitle={`Взаимность ${formatDate(match.createdAt)}`}
                    actionButton={
                      <Button
                        size="sm"
                        onClick={() => handleChatWithMatch(match.id)}
                        className="btn-match"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sent Likes Tab */}
          <TabsContent value="sent" className="mt-6">
            {mockSentLikes.length === 0 ? (
              <div className="text-center py-12">
                <Send className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noSent')}</h3>
                <p className="text-muted-foreground">
                  Начните лайкать профили в поиске
                </p>
              </div>
            ) : (
              <div>
                {mockSentLikes.map((like) => (
                  <UserCard
                    key={like.id}
                    user={like.toUser}
                    subtitle={`Лайк отправлен ${formatDate(like.createdAt)}`}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Received Likes Tab */}
          <TabsContent value="received" className="mt-6">
            {mockReceivedLikes.length === 0 ? (
              <div className="text-center py-12">
                <ArrowLeft className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noReceived')}</h3>
                <p className="text-muted-foreground">
                  Улучшите профиль, чтобы получать больше лайков
                </p>
              </div>
            ) : (
              <div>
                {mockReceivedLikes.map((like) => (
                  <UserCard
                    key={like.id}
                    user={like.fromUser}
                    subtitle={`Лайкнул(а) вас ${formatDate(like.createdAt)}`}
                    actionButton={
                      <Button
                        size="sm"
                        onClick={() => handleLikeBack(like.fromUser.id)}
                        className="btn-like"
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Likes;