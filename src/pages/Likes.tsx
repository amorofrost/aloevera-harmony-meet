import React, { useEffect, useState } from 'react';
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
import { api } from '@/lib/api';

type MatchVM = Match & { otherUser: User; isRead: boolean };
type SentLikeVM = Like & { toUser: User };
type ReceivedLikeVM = Like & { fromUser: User; isRead: boolean };

const Likes = () => {
  const [activeTab, setActiveTab] = useState('matches');
  const [matches, setMatches] = useState<MatchVM[]>([]);
  const [sentLikes, setSentLikes] = useState<SentLikeVM[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<ReceivedLikeVM[]>([]);
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    api.getLikes().then((data) => {
      setMatches(data.matches.map((m: any) => ({
        id: m.id,
        users: m.users,
        createdAt: new Date(m.createdAt),
        isRead: m.isRead,
        otherUser: {
          id: m.otherUser.id,
          name: m.otherUser.name,
          age: m.otherUser.age,
          bio: m.otherUser.bio,
          location: m.otherUser.location,
          gender: m.otherUser.gender,
          profileImage: m.otherUser.profileImage,
          images: [],
          lastSeen: new Date(),
          isOnline: m.otherUser.isOnline,
          preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
          settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
        }
      })));
      setSentLikes(data.sent.map((s: any) => ({
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        createdAt: new Date(s.createdAt),
        isMatch: s.isMatch,
        toUser: {
          id: s.toUser.id,
          name: s.toUser.name,
          age: s.toUser.age,
          bio: s.toUser.bio,
          location: s.toUser.location,
          gender: s.toUser.gender,
          profileImage: s.toUser.profileImage,
          images: [],
          lastSeen: new Date(),
          isOnline: s.toUser.isOnline,
          preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
          settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
        }
      })));
      setReceivedLikes(data.received.map((r: any) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        createdAt: new Date(r.createdAt),
        isMatch: r.isMatch,
        isRead: r.isRead,
        fromUser: {
          id: r.fromUser.id,
          name: r.fromUser.name,
          age: r.fromUser.age,
          bio: r.fromUser.bio,
          location: r.fromUser.location,
          gender: r.fromUser.gender,
          profileImage: r.fromUser.profileImage,
          images: [],
          lastSeen: new Date(),
          isOnline: r.fromUser.isOnline,
          preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
          settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
        }
      })));
    }).catch(console.error);
  }, []);

  // Count unread items
  const unreadMatches = matches.filter(match => !match.isRead).length;
  const unreadReceivedLikes = receivedLikes.filter(like => !like.isRead).length;

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
                  {matches.length}
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
                  {sentLikes.length}
                </Badge>
              </div>
            </TabsTrigger>
            <TabsTrigger value="received" className="relative">
              <div className="flex items-center gap-2">
                <span>{t('likes.received')}</span>
                <Badge variant="secondary" className="text-xs">
                  {receivedLikes.length}
                </Badge>
                {unreadReceivedLikes > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Matches Tab */}
          <TabsContent value="matches" className="mt-6">
            {matches.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noMatches')}</h3>
                <p className="text-muted-foreground">
                  Лайкайте профили, чтобы найти взаимность
                </p>
              </div>
            ) : (
              <div>
                {matches.map((match) => (
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
            {sentLikes.length === 0 ? (
              <div className="text-center py-12">
                <Send className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noSent')}</h3>
                <p className="text-muted-foreground">
                  Начните лайкать профили в поиске
                </p>
              </div>
            ) : (
              <div>
                {sentLikes.map((like) => (
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
            {receivedLikes.length === 0 ? (
              <div className="text-center py-12">
                <ArrowLeft className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('likes.noReceived')}</h3>
                <p className="text-muted-foreground">
                  Улучшите профиль, чтобы получать больше лайков
                </p>
              </div>
            ) : (
              <div>
                {receivedLikes.map((like) => (
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