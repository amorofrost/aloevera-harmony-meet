import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, X, ArrowLeft, Send, MessageCircle, MoreVertical, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SwipeCard from '@/components/ui/swipe-card';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User } from '@/types/user';
import { matchingApi, chatsApi } from '@/services/api';
import type { MatchWithUser, SentLikeWithUser, ReceivedLikeWithUser } from '@/data/mockProfiles';
import type { PrivateChatWithUser } from '@/data/mockChats';
import heroBg from '@/assets/hero-bg.jpg';

const Friends = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [likesTab, setLikesTab] = useState('matches');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [searchProfiles, setSearchProfiles] = useState<User[]>([]);
  const [matches, setMatches] = useState<MatchWithUser[]>([]);
  const [sentLikes, setSentLikes] = useState<SentLikeWithUser[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<ReceivedLikeWithUser[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChatWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [profilesRes, matchesRes, sentRes, receivedRes, chatsRes] = await Promise.all([
        matchingApi.getSearchProfiles(),
        matchingApi.getMatches(),
        matchingApi.getSentLikes(),
        matchingApi.getReceivedLikes(),
        chatsApi.getPrivateChats(),
      ]);
      if (profilesRes.success && profilesRes.data) setSearchProfiles(profilesRes.data);
      if (matchesRes.success && matchesRes.data) setMatches(matchesRes.data);
      if (sentRes.success && sentRes.data) setSentLikes(sentRes.data);
      if (receivedRes.success && receivedRes.data) setReceivedLikes(receivedRes.data);
      if (chatsRes.success && chatsRes.data) setPrivateChats(chatsRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

  const currentUser = searchProfiles[currentUserIndex];

  const handleLike = async () => {
    if (currentUser) {
      await matchingApi.sendLike(currentUser.id);
    }
    nextUser();
  };
  const handlePass = () => nextUser();
  const nextUser = () => { setShowDetails(false); setCurrentUserIndex(prev => prev + 1); };

  const formatDateShort = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
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
    const chat = privateChats.find(c => c.id === selectedChat);
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
              {(matches.filter(m => !m.isRead).length + receivedLikes.filter(l => !l.isRead).length) > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="chats" className="relative">
              Чаты
              {privateChats.some(c => c.lastMessage && !c.lastMessage.read) && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : currentUserIndex >= searchProfiles.length ? (
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
                <TabsTrigger value="matches">{t('likes.matches')} <Badge variant="secondary" className="ml-1 text-xs">{matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="sent">{t('likes.sent')} <Badge variant="secondary" className="ml-1 text-xs">{sentLikes.length}</Badge></TabsTrigger>
                <TabsTrigger value="received">{t('likes.received')} <Badge variant="secondary" className="ml-1 text-xs">{receivedLikes.length}</Badge></TabsTrigger>
              </TabsList>
              <TabsContent value="matches" className="mt-4">
                {matches.map((match) => (
                  <UserCard key={match.id} user={match.otherUser} subtitle={`Взаимность ${formatDateShort(match.createdAt)}`}
                    actionButton={<Button size="sm" onClick={() => navigate('/friends')} className="btn-match"><MessageCircle className="w-4 h-4" /></Button>} />
                ))}
              </TabsContent>
              <TabsContent value="sent" className="mt-4">
                {sentLikes.map((like) => (
                  <UserCard key={like.id} user={like.toUser} subtitle={`Лайк отправлен ${formatDateShort(like.createdAt)}`} />
                ))}
              </TabsContent>
              <TabsContent value="received" className="mt-4">
                {receivedLikes.map((like) => (
                  <UserCard key={like.id} user={like.fromUser} subtitle={`Лайкнул(а) вас ${formatDateShort(like.createdAt)}`}
                    actionButton={<Button size="sm" className="btn-like" onClick={() => matchingApi.sendLike(like.fromUser.id)}><Heart className="w-4 h-4" /></Button>} />
                ))}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Private Chats Tab */}
          <TabsContent value="chats" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : privateChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет личных чатов</h3>
                <p className="text-muted-foreground">Начните общение с понравившимися людьми</p>
              </div>
            ) : (
              <div className="space-y-3">
                {privateChats.map((chat) => (
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
