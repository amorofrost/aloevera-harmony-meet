import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, X, ArrowLeft, Send, MessageCircle, MoreVertical, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SwipeCard from '@/components/ui/swipe-card';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';
import { BbcodeToolbar } from '@/components/ui/bbcode-toolbar';
import { ImageAttachmentPicker } from '@/components/ui/image-attachment-picker';
import { ImageAttachmentDisplay } from '@/components/ui/image-attachment-display';
import { uploadImage } from '@/services/api/imagesApi';
import { UserBadges } from '@/components/ui/user-badges';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { User } from '@/types/user';
import type { MessageDto } from '@/types/chat';
import { matchingApi, usersApi, getCurrentUserIdFromToken } from '@/services/api';
import { chatsApi } from '@/services/api/chatsApi';
import { useChatSignalR } from '@/hooks/useChatSignalR';
import type { MatchWithUser, SentLikeWithUser, ReceivedLikeWithUser } from '@/data/mockProfiles';
import type { PrivateChatWithUser } from '@/data/mockChats';
import heroBg from '@/assets/hero-bg.jpg';

const Friends = () => {
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const viewingUserId = searchParams.get('userId');
  const activeTab = searchParams.get('tab') || 'search';
  const likesTab = searchParams.get('sub') || 'matches';
  const selectedChat = searchParams.get('chat');

  const [searchProfiles, setSearchProfiles] = useState<User[]>([]);
  const [matches, setMatches] = useState<MatchWithUser[]>([]);
  const [sentLikes, setSentLikes] = useState<SentLikeWithUser[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<ReceivedLikeWithUser[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChatWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // Chat message state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagePage, setMessagePage] = useState(1);

  // SignalR live updates
  const { sendMessage: signalRSend, isConnected, onEvent } = useChatSignalR(
    'chat', activeChatId ?? ''
  );

  useEffect(() => {
    if (!activeChatId) return;
    return onEvent('MessageReceived', (msg: unknown) => {
      const incoming = msg as MessageDto;
      setMessages(prev =>
        prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
      );
    });
  }, [activeChatId, onEvent]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [profilesRes, matchesRes, sentRes, receivedRes, chatsRes] = await Promise.all([
        matchingApi.getSearchProfiles(),
        matchingApi.getMatches(),
        matchingApi.getSentLikes(),
        matchingApi.getReceivedLikes(),
        chatsApi.getChats(),
      ]);
      if (profilesRes.success && profilesRes.data) setSearchProfiles(profilesRes.data);
      if (matchesRes.success && matchesRes.data) setMatches(matchesRes.data);
      if (sentRes.success && sentRes.data) setSentLikes(sentRes.data);
      if (receivedRes.success && receivedRes.data) setReceivedLikes(receivedRes.data);
      if (chatsRes.success && chatsRes.data) {
        const allMatches = matchesRes.success && matchesRes.data ? matchesRes.data : [];
        const allProfiles = profilesRes.success && profilesRes.data ? profilesRes.data : [];
        const enriched: PrivateChatWithUser[] = (chatsRes.data as any[]).map((chat: any) => {
          const participants: string[] = chat.participants ?? [];
          const otherUser =
            allMatches.find(m => participants.includes(m.otherUser.id))?.otherUser ??
            allProfiles.find(u => participants.includes(u.id)) ??
            { id: participants[0] ?? '', name: 'Пользователь', age: 0, bio: '', location: '',
              gender: 'prefer-not-to-say' as const, profileImage: '', images: [],
              lastSeen: new Date(), isOnline: false,
              preferences: { ageRange: [18, 65] as [number, number], maxDistance: 50, showMe: 'everyone' as const },
              settings: { profileVisibility: 'public' as const, anonymousLikes: false, language: 'ru' as const, notifications: true } };
          return {
            ...chat,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            lastMessage: chat.lastMessage ? {
              ...chat.lastMessage,
              timestamp: new Date(chat.lastMessage.timestamp),
            } : undefined,
            otherUser,
          };
        });
        setPrivateChats(enriched);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  // Sync activeChatId with URL and load messages when selectedChat changes
  useEffect(() => {
    if (!selectedChat) {
      setActiveChatId(null);
      setMessages([]);
      return;
    }
    setActiveChatId(selectedChat);
    setMessagesLoading(true);
    chatsApi.getMessages(selectedChat, 1).then(msgsResult => {
      if (msgsResult.success && msgsResult.data) {
        setMessages(msgsResult.data);
        setMessagePage(1);
      }
      setMessagesLoading(false);
    });
  }, [selectedChat]);

  // Load specific user profile when userId param is present
  useEffect(() => {
    if (!viewingUserId) {
      setViewingUser(null);
      return;
    }
    const loadUser = async () => {
      const res = await usersApi.getUserById(viewingUserId);
      if (res.success && res.data) setViewingUser(res.data);
    };
    loadUser();
  }, [viewingUserId]);
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

  const handleOpenChat = async (targetUserId: string) => {
    const chatResult = await chatsApi.getOrCreateChat(targetUserId);
    if (chatResult.success && chatResult.data) {
      const chatId = chatResult.data.id;
      if (!privateChats.find(c => c.id === chatId)) {
        const otherUser =
          matches.find(m => m.otherUser.id === targetUserId)?.otherUser ??
          receivedLikes.find(l => l.fromUser.id === targetUserId)?.fromUser ??
          searchProfiles.find(u => u.id === targetUserId);
        if (otherUser) {
          setPrivateChats(prev => [...prev, { ...chatResult.data!, otherUser }]);
        }
      }
      setSearchParams({ tab: 'chats', chat: chatId });
    }
  };

  const handleOpenChatById = (chatId: string) => {
    setSearchParams({ tab: 'chats', chat: chatId });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChatId) return;
    const imageUrls: string[] = [];
    for (const file of imageFiles) {
      const res = await uploadImage(file);
      imageUrls.push(res.url);
    }
    // Don't add to state from the REST response — the SignalR broadcast delivers
    // the message to all group members including the sender, avoiding duplicates.
    await chatsApi.sendMessage(activeChatId, messageText.trim(), imageUrls);
    setImageFiles([]);
  };

  const handleSendClick = () => {
    if (!messageText.trim()) {
      setMessageError("Message can't be empty");
      return;
    }
    if (!selectedChat) return;
    setMessageError('');
    handleSendMessage();
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
          <div className="flex items-center gap-3 p-4 max-w-3xl mx-auto w-full">
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({ tab: 'chats' })}><ArrowLeft className="w-5 h-5" /></Button>
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
        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="p-4 space-y-4 max-w-3xl mx-auto w-full">
          <div className="text-center"><p className="text-sm text-muted-foreground">Начало переписки с {chat.otherUser.name}</p></div>
          {activeChatId && messagePage > 0 && (
            <button
              className="text-xs text-muted-foreground underline py-2"
              onClick={async () => {
                const next = messagePage + 1;
                const r = await chatsApi.getMessages(activeChatId!, next);
                if (r.success && r.data && r.data.length > 0) {
                  setMessages(prev => [...r.data!, ...prev]);
                  setMessagePage(next);
                }
              }}
            >
              Load older messages
            </button>
          )}
          {messagesLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Загрузка сообщений...</div>
          ) : messages.length > 0 ? (
            messages.map(msg => (
              <div key={msg.id} className={cn('flex', msg.senderId === getCurrentUserIdFromToken() ? 'justify-end' : 'justify-start')}>
                <div className={cn('rounded-lg px-3 py-2 max-w-[75%] text-sm',
                  msg.senderId === 'current-user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <BbcodeRenderer content={msg.content} />
                  <ImageAttachmentDisplay imageUrls={msg.imageUrls ?? []} />
                </div>
              </div>
            ))
          ) : (
            chat.lastMessage && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><span className="text-xs font-medium">{chat.otherUser.name[0]}</span></div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3 max-w-xs"><p className="text-sm">{chat.lastMessage.content}</p></div>
                  <p className="text-xs text-muted-foreground mt-1">{formatTime(chat.lastMessage.timestamp)}</p>
                </div>
              </div>
            )
          )}
          </div>
        </div>
        <div className="border-t p-4 relative z-10">
          <div className="flex gap-2 max-w-3xl mx-auto w-full">
            <div className="relative flex-1">
              <BbcodeToolbar textareaRef={chatInputRef} />
              <textarea
                ref={chatInputRef}
                value={messageText}
                onChange={e => { setMessageText(e.target.value); if (messageError) setMessageError(''); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendClick();
                  }
                }}
                placeholder="Написать сообщение..."
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
                rows={1}
              />
            </div>
            <ImageAttachmentPicker files={imageFiles} onChange={setImageFiles} />
            <Button onClick={handleSendClick} disabled={!messageText.trim()}><Send className="w-4 h-4" /></Button>
          </div>
          {messageError && (
            <p className="text-xs text-destructive mt-1">{messageError}</p>
          )}
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

  if (viewingUserId && viewingUser) {
    return (
      <div className="min-h-screen bg-background pb-20 relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>

        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">{viewingUser.name}</h1>
          </div>
        </div>

        <div className="p-4 relative z-10">
          <Card className="profile-card aspect-[3/4] relative overflow-hidden max-w-sm mx-auto">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${viewingUser.profileImage})` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${viewingUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-sm opacity-90">{viewingUser.isOnline ? 'Онлайн' : 'Недавно'}</span>
                </div>
                <h2 className="text-2xl font-bold mb-1">{viewingUser.name}, {viewingUser.age}</h2>
                <p className="text-sm opacity-90 mb-2">{viewingUser.location}</p>
                <p className="text-sm opacity-75">{viewingUser.bio}</p>
              </div>
            </div>
          </Card>
          <div className="flex justify-center gap-6 mt-6">
            <Button size="lg" variant="outline" onClick={() => navigate(-1)} className="rounded-full w-16 h-16 btn-pass"><X className="w-8 h-8" /></Button>
            <Button size="lg" onClick={() => { matchingApi.sendLike(viewingUser.id); navigate(-1); }} className="rounded-full w-16 h-16 btn-like"><Heart className="w-8 h-8" /></Button>
          </div>
        </div>

        <BottomNavigation />
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
          <h1 className="text-2xl font-bold text-foreground">Друзья</h1>
          <Heart className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })} className="w-full">
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
                        <UserBadges rank={currentUser.rank} staffRole={currentUser.staffRole} />
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
            <Tabs value={likesTab} onValueChange={(sub) => setSearchParams({ tab: 'likes', sub })} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="matches">{t('likes.matches')} <Badge variant="secondary" className="ml-1 text-xs">{matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="sent">{t('likes.sent')} <Badge variant="secondary" className="ml-1 text-xs">{sentLikes.length}</Badge></TabsTrigger>
                <TabsTrigger value="received">{t('likes.received')} <Badge variant="secondary" className="ml-1 text-xs">{receivedLikes.length}</Badge></TabsTrigger>
              </TabsList>
              <TabsContent value="matches" className="mt-4">
                {matches.map((match) => (
                  <UserCard key={match.id} user={match.otherUser} subtitle={`Взаимность ${formatDateShort(match.createdAt)}`}
                    actionButton={<Button size="sm" onClick={() => handleOpenChat(match.otherUser.id)} className="btn-match"><MessageCircle className="w-4 h-4" /></Button>} />
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
                    onClick={() => handleOpenChatById(chat.id)}>
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
                          <UserBadges rank={chat.otherUser.rank} staffRole={chat.otherUser.staffRole} />
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
