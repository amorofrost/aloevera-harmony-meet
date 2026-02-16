import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, X, Info, ArrowLeft, ChevronLeft, ChevronRight, Send, MessageCircle, MoreVertical, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SwipeCard from '@/components/ui/swipe-card';
import EventPostmark from '@/components/ui/event-postmark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Event, AloeVeraSong, Match, Like } from '@/types/user';
import { PrivateChat } from '@/types/chat';
import heroBg from '@/assets/hero-bg.jpg';

// ── Mock songs ──
const mockSongs: AloeVeraSong[] = [
  { id: '1', title: 'Звездное небо', album: 'Первый альбом', duration: '3:45', previewUrl: '', year: 2018 },
  { id: '2', title: 'Летний ветер', album: 'Первый альбом', duration: '4:12', previewUrl: '', year: 2018 },
  { id: '3', title: 'Новые горизонты', album: 'Второй альбом', duration: '3:28', previewUrl: '', year: 2020 },
];

// ── Mock events for search cards ──
const mockEvents: Event[] = [
  { id: '1', title: 'AloeVera: Новые Горизонты', description: '', imageUrl: '', date: new Date('2023-06-15'), location: 'Москва', attendees: ['1','2'], category: 'concert', organizer: 'AloeVera Official' },
  { id: '2', title: 'Акустический вечер', description: '', imageUrl: '', date: new Date('2024-03-20'), location: 'СПб', attendees: ['1','3'], category: 'concert', organizer: 'AloeVera Official' },
];

// ── Mock users for search ──
const searchUsers: User[] = [
  { id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera и концерты под открытым небом ❤️', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true, eventsAttended: [mockEvents[0]], favoriteSong: mockSongs[0],
    preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } },
  { id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант, фанат AloeVera с первого альбома 🎸', location: 'Санкт-Петербург', gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } },
  { id: '3', name: 'Елена', age: 22, bio: 'Танцую под AloeVera 💃', location: 'Новосибирск', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true, eventsAttended: [mockEvents[1], mockEvents[0]], favoriteSong: mockSongs[2],
    preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } },
  { id: '4', name: 'Мария', age: 23, bio: 'Поэтесса и меломан', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } },
];

// ── Mock likes data ──
const mockMatches: (Match & { otherUser: User; isRead: boolean })[] = [
  { id: '1', users: ['current-user','1'], createdAt: new Date('2024-02-20'), isRead: false,
    otherUser: { id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera', location: 'Москва', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } } },
];

const mockSentLikes: (Like & { toUser: User })[] = [
  { id: '2', fromUserId: 'current-user', toUserId: '2', createdAt: new Date('2024-02-21'), isMatch: false,
    toUser: { id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант', location: 'Санкт-Петербург', gender: 'male',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: false,
      preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } } },
];

const mockReceivedLikes: (Like & { fromUser: User; isRead: boolean })[] = [
  { id: '3', fromUserId: '3', toUserId: 'current-user', createdAt: new Date('2024-02-19'), isMatch: false, isRead: false,
    fromUser: { id: '3', name: 'Елена', age: 22, bio: 'Танцую под AloeVera', location: 'Новосибирск', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } } },
];

// ── Mock private chats ──
const mockPrivateChats: (PrivateChat & { otherUser: User })[] = [
  {
    id: 'private-1', type: 'private', participants: ['current-user','1'], matchId: 'match-1',
    createdAt: new Date('2024-02-20'), updatedAt: new Date('2024-02-22'),
    lastMessage: { id: 'msg-1', chatId: 'private-1', senderId: '1', content: 'Привет! Тоже обожаешь AloeVera?', timestamp: new Date('2024-02-22T14:30:00'), read: false, type: 'text' },
    otherUser: { id: '1', name: 'Анна', age: 25, bio: '', location: 'Москва', gender: 'female',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face', images: [], lastSeen: new Date(), isOnline: true,
      preferences: { ageRange: [22,35], maxDistance: 50, showMe: 'everyone' }, settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true } }
  }
];

const Friends = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [likesTab, setLikesTab] = useState('matches');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = searchUsers[currentUserIndex];

  const handleLike = () => { console.log('Liked:', currentUser?.name); nextUser(); };
  const handlePass = () => { console.log('Passed:', currentUser?.name); nextUser(); };
  const nextUser = () => { setShowDetails(false); setCurrentUserIndex(prev => prev + 1); };

  const formatDateShort = (date: Date) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);

  const formatTime = (date: Date) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);

  const formatChatDate = (date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return formatTime(date);
    return formatDateShort(date);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;
    setMessageText('');
  };

  // ── Private Chat View ──
  if (selectedChat) {
    const chat = mockPrivateChats.find(c => c.id === selectedChat);
    if (!chat) return null;
    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedChat(null)}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="relative">
                <img src={chat.otherUser.profileImage} alt={chat.otherUser.name} className="w-10 h-10 rounded-full object-cover" />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${chat.otherUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
              </div>
              <div>
                <h2 className="font-semibold">{chat.otherUser.name}</h2>
                <p className="text-xs text-muted-foreground">{chat.otherUser.isOnline ? 'В сети' : 'Не в сети'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm"><MoreVertical className="w-5 h-5" /></Button>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto relative z-10">
          <div className="text-center"><p className="text-sm text-muted-foreground">Начало переписки с {chat.otherUser.name}</p></div>
          {chat.lastMessage && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><span className="text-xs font-medium">{chat.otherUser.name[0]}</span></div>
              <div className="flex-1">
                <div className="bg-muted rounded-lg p-3 max-w-xs"><p className="text-sm">{chat.lastMessage.content}</p></div>
                <p className="text-xs text-muted-foreground mt-1">{formatTime(chat.lastMessage.timestamp)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Введи сообщение..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
            <Button onClick={handleSendMessage} disabled={!messageText.trim()}><Send className="w-4 h-4" /></Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const UserCard = ({ user, actionButton, subtitle }: { user: User; actionButton?: React.ReactNode; subtitle?: string }) => (
    <Card className="profile-card mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img src={user.profileImage} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${user.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{user.name}, {user.age}</h3>
            <p className="text-sm text-muted-foreground truncate">{user.location}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">Друзья</h1>
          <Heart className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <SearchIcon className="w-4 h-4 mr-1" />
              Поиск
            </TabsTrigger>
            <TabsTrigger value="likes" className="relative">
              Лайки
              {(mockMatches.filter(m => !m.isRead).length + mockReceivedLikes.filter(l => !l.isRead).length) > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="chats" className="relative">
              Чаты
              {mockPrivateChats.some(c => c.lastMessage && !c.lastMessage.read) && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-6">
            {currentUserIndex >= searchUsers.length ? (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">{t('search.noMoreProfiles')}</h2>
                <p className="text-muted-foreground">Загляните позже</p>
              </div>
            ) : currentUser ? (
              <div>
                <SwipeCard onSwipeLeft={handlePass} onSwipeRight={handleLike} onTap={() => setShowDetails(!showDetails)} className="w-full max-w-sm mx-auto">
                  <Card className="profile-card aspect-[3/4] relative overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${currentUser.profileImage})` }}>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${currentUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                          <span className="text-sm opacity-90">{currentUser.isOnline ? 'Онлайн' : 'Недавно'}</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-1">{currentUser.name}, {currentUser.age}</h2>
                        <p className="text-sm opacity-90 mb-2">{currentUser.location}</p>
                        {!showDetails && <p className="text-sm opacity-75 line-clamp-2">{currentUser.bio}</p>}
                      </div>
                      {showDetails && (
                        <div className="absolute inset-0 bg-black/80 p-6 flex flex-col justify-end">
                          <div className="text-white space-y-4">
                            <div><h3 className="font-semibold mb-2">О себе</h3><p className="text-sm">{currentUser.bio}</p></div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="opacity-75">Возраст:</span><div>{currentUser.age}</div></div>
                              <div><span className="opacity-75">Пол:</span><div>{currentUser.gender === 'male' ? 'Мужской' : 'Женский'}</div></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </SwipeCard>
                <div className="flex justify-center gap-6 mt-6">
                  <Button size="lg" variant="outline" onClick={handlePass} className="rounded-full w-16 h-16 btn-pass"><X className="w-8 h-8" /></Button>
                  <Button size="lg" onClick={handleLike} className="rounded-full w-16 h-16 btn-like"><Heart className="w-8 h-8" /></Button>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-4">{t('search.swipeInstructions')}</p>
              </div>
            ) : null}
          </TabsContent>

          {/* Likes Tab */}
          <TabsContent value="likes" className="mt-6">
            <Tabs value={likesTab} onValueChange={setLikesTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="matches">{t('likes.matches')} <Badge variant="secondary" className="ml-1 text-xs">{mockMatches.length}</Badge></TabsTrigger>
                <TabsTrigger value="sent">{t('likes.sent')} <Badge variant="secondary" className="ml-1 text-xs">{mockSentLikes.length}</Badge></TabsTrigger>
                <TabsTrigger value="received">{t('likes.received')} <Badge variant="secondary" className="ml-1 text-xs">{mockReceivedLikes.length}</Badge></TabsTrigger>
              </TabsList>
              <TabsContent value="matches" className="mt-4">
                {mockMatches.map((match) => (
                  <UserCard key={match.id} user={match.otherUser} subtitle={`Взаимность ${formatDateShort(match.createdAt)}`}
                    actionButton={<Button size="sm" onClick={() => navigate('/friends')} className="btn-match"><MessageCircle className="w-4 h-4" /></Button>} />
                ))}
              </TabsContent>
              <TabsContent value="sent" className="mt-4">
                {mockSentLikes.map((like) => (
                  <UserCard key={like.id} user={like.toUser} subtitle={`Лайк отправлен ${formatDateShort(like.createdAt)}`} />
                ))}
              </TabsContent>
              <TabsContent value="received" className="mt-4">
                {mockReceivedLikes.map((like) => (
                  <UserCard key={like.id} user={like.fromUser} subtitle={`Лайкнул(а) вас ${formatDateShort(like.createdAt)}`}
                    actionButton={<Button size="sm" className="btn-like"><Heart className="w-4 h-4" /></Button>} />
                ))}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Private Chats Tab */}
          <TabsContent value="chats" className="mt-6">
            {mockPrivateChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет личных чатов</h3>
                <p className="text-muted-foreground">Начните общение с понравившимися людьми</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mockPrivateChats.map((chat) => (
                  <Card key={chat.id} className="profile-card cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedChat(chat.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={chat.otherUser.profileImage} alt={chat.otherUser.name} className="w-12 h-12 rounded-full object-cover" />
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${chat.otherUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold truncate">{chat.otherUser.name}</h3>
                            {chat.lastMessage && <span className="text-xs text-muted-foreground">{formatChatDate(chat.lastMessage.timestamp)}</span>}
                          </div>
                          {chat.lastMessage && (
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground truncate">{chat.lastMessage.content}</p>
                              {!chat.lastMessage.read && <div className="w-2 h-2 bg-primary rounded-full ml-2" />}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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

export default Friends;
