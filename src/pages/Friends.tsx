import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, X, ArrowLeft, Send, MessageCircle, MoreVertical, Search as SearchIcon, ChevronUp, ChevronDown, Calendar, SmilePlus } from 'lucide-react';
import { SearchFilterSheet, EMPTY_FILTERS, type SearchFilters } from '@/components/SearchFilterSheet';
import { LocationDisplay } from '@/components/ui/location-display';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji } from '@/lib/countryFlag';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { EventAttendanceMark } from '@/components/ui/event-attendance-mark';
import { BadgeScrollRow } from '@/components/ui/badge-scroll-row';
import { PhotoCarousel } from '@/components/ui/photo-carousel';
import { CommonGroundLine } from '@/components/profile/CommonGroundLine';
import { PromptCard } from '@/components/profile/PromptCard';
import { commonGround } from '@/lib/commonGround';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSmartBack } from '@/hooks/useSmartBack';
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
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ReactionPicker } from '@/components/chat/ReactionPicker';
import { ReactionPill } from '@/components/chat/ReactionPill';
import { showApiError } from '@/lib/apiError';

function composePhotos(user: { profileImage: string; images: string[] }): string[] {
  const set = new Set<string>();
  const out: string[] = [];
  if (user.profileImage) { set.add(user.profileImage); out.push(user.profileImage); }
  for (const u of user.images ?? []) {
    if (u && !set.has(u)) { set.add(u); out.push(u); }
  }
  return out.slice(0, 6);
}

const Friends = () => {
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [showDeckDetails, setShowDeckDetails] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user: viewer } = useCurrentUser();

  const viewingUserId = searchParams.get('userId');
  const activeTab = searchParams.get('tab') || 'search';
  const likesTab = searchParams.get('sub') || 'matches';
  const selectedChat = searchParams.get('chat');
  const goBackFromChat = useSmartBack('/friends?tab=chats');

  const [filter, setFilter] = useState<SearchFilters>(EMPTY_FILTERS);
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // True when the next render should scroll to the bottom of the message list.
  // Set on chat open and on incoming SignalR messages; intentionally NOT set when
  // "Load older messages" prepends history, so the user stays anchored where they were.
  const shouldScrollToBottomRef = useRef(false);

  // SignalR live updates
  const { sendMessage: signalRSend, isConnected, onEvent } = useChatSignalR(
    'chat', activeChatId ?? ''
  );

  useEffect(() => {
    if (!activeChatId) return;
    return onEvent('MessageReceived', (msg: unknown) => {
      const incoming = msg as MessageDto;
      setMessages(prev => {
        if (prev.some(m => m.id === incoming.id)) return prev;
        shouldScrollToBottomRef.current = true;
        return [...prev, incoming];
      });
    });
  }, [activeChatId, onEvent]);

  // Live-patch a message's reactions when any participant adds/replaces/removes.
  useEffect(() => {
    if (!activeChatId) return;
    return onEvent('MessageReactionUpdated', (payload: unknown) => {
      const { messageId, reactions } = payload as {
        messageId: string;
        reactions: Record<string, string>;
      };
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, reactions: reactions ?? {} } : m))
      );
    });
  }, [activeChatId, onEvent]);

  // Scroll to the bottom after messages render, but only when flagged.
  useEffect(() => {
    if (shouldScrollToBottomRef.current && !messagesLoading) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
      shouldScrollToBottomRef.current = false;
    }
  }, [messages, messagesLoading]);

  // Load matches, likes and chats once on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [matchesRes, sentRes, receivedRes, chatsRes] = await Promise.all([
        matchingApi.getMatches(),
        matchingApi.getSentLikes(),
        matchingApi.getReceivedLikes(),
        chatsApi.getChats(),
      ]);
      if (matchesRes.success && matchesRes.data) setMatches(matchesRes.data);
      if (sentRes.success && sentRes.data) setSentLikes(sentRes.data);
      if (receivedRes.success && receivedRes.data) setReceivedLikes(receivedRes.data);
      if (chatsRes.success && chatsRes.data) {
        const chatList = chatsRes.data as any[];
        const myId = getCurrentUserIdFromToken();
        const partnerIdOf = (chat: any): string => {
          const participants: string[] = chat.participants ?? [];
          return participants.find(id => id !== myId) ?? participants[0] ?? '';
        };
        // Mock chats already embed otherUser; API chats carry only participant ids,
        // so resolve those partners explicitly (they may be matches the deck excludes).
        const needIds = chatList.filter(c => !c.otherUser).map(partnerIdOf);
        const partnersRes = needIds.length ? await usersApi.getUsersByIds(needIds) : null;
        const partnerById = new Map(
          (partnersRes?.success && partnersRes.data ? partnersRes.data : []).map(u => [u.id, u])
        );
        const enriched: PrivateChatWithUser[] = chatList.map((chat: any) => {
          const otherUserId = partnerIdOf(chat);
          const otherUser =
            chat.otherUser ??
            partnerById.get(otherUserId) ??
            { id: otherUserId, name: 'Пользователь', age: 0, bio: '', location: '',
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

  // Reload search deck whenever the filter changes
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setCurrentUserIndex(0);
      try {
        const result = await usersApi.getUsers({
          skip: 0,
          take: 100,
          country: filter.country || undefined,
          region: filter.region || undefined,
          accountName: filter.accountName || undefined,
          name: filter.name || undefined,
          minAge: filter.minAge ?? undefined,
          maxAge: filter.maxAge ?? undefined,
          gender: filter.gender || undefined,
        });
        if (result.success && result.data) setSearchProfiles(result.data);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [
    filter.country, filter.region, filter.accountName, filter.name,
    filter.minAge, filter.maxAge, filter.gender,
  ]);

  // Sync activeChatId with URL and load messages when selectedChat changes
  useEffect(() => {
    if (!selectedChat) {
      setActiveChatId(null);
      setMessages([]);
      return;
    }
    setActiveChatId(selectedChat);
    setMessagesLoading(true);
    shouldScrollToBottomRef.current = true;
    chatsApi.getMessages(selectedChat, 1).then(msgsResult => {
      if (msgsResult.success && msgsResult.data) {
        setMessages(msgsResult.data);
        setMessagePage(1);
      }
      setMessagesLoading(false);
    });
  }, [selectedChat]);

  // Reset the details overlay whenever the currently-rendered user changes.
  useEffect(() => {
    setShowDeckDetails(false);
  }, [viewingUserId]);

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
  const nextUser = () => {
    setCurrentUserIndex(prev => prev + 1);
    setShowDeckDetails(false);
  };

  const genderLabel = (g: SearchFilters['gender']): string => {
    switch (g) {
      case 'male': return t('search.genderMale');
      case 'female': return t('search.genderFemale');
      case 'non-binary': return t('search.genderNonBinary');
      default: return '';
    }
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: React.ReactNode; clear: () => void }[] = [];
    const patch = (next: Partial<SearchFilters>) => setFilter(prev => ({ ...prev, ...next }));
    if (filter.accountName) {
      chips.push({
        key: 'accountName',
        label: <>@{filter.accountName}</>,
        clear: () => patch({ accountName: '' }),
      });
    }
    if (filter.name) {
      chips.push({
        key: 'name',
        label: <>{filter.name}</>,
        clear: () => patch({ name: '' }),
      });
    }
    if (filter.country || filter.region) {
      chips.push({
        key: 'location',
        label: (
          <>
            {filter.country && (
              <>{flagEmoji(filter.country) || '📍'} {COUNTRY_BY_CODE[filter.country]?.nameRu ?? filter.country}</>
            )}
            {filter.region && <> · {filter.region}</>}
          </>
        ),
        clear: () => patch({ country: '', region: '' }),
      });
    }
    if (filter.minAge != null || filter.maxAge != null) {
      const lo = filter.minAge ?? '';
      const hi = filter.maxAge ?? '';
      chips.push({
        key: 'age',
        label: <>{t('search.ageRange')}: {lo}–{hi}</>,
        clear: () => patch({ minAge: null, maxAge: null }),
      });
    }
    if (filter.gender) {
      chips.push({
        key: 'gender',
        label: <>{genderLabel(filter.gender)}</>,
        clear: () => patch({ gender: '' }),
      });
    }
    return chips;
  }, [filter, t]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Open the in-app profile view (/friends?userId=...). Pushes a history entry so the
  // profile view's back button returns to wherever it was opened from.
  const openProfile = (userId: string) => {
    if (userId) setSearchParams({ userId });
  };
  const profileAvatarProps = (userId: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': t('friends.viewProfile'),
    onClick: () => openProfile(userId),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(userId); }
    },
  });

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

  const handleSetReaction = async (messageId: string, emoji: string) => {
    const myId = getCurrentUserIdFromToken();
    if (!myId || !activeChatId) return;
    const prevMessages = messages;
    setMessages(ms => ms.map(m =>
      m.id === messageId
        ? { ...m, reactions: { ...(m.reactions ?? {}), [myId]: emoji } }
        : m));
    try {
      const r = await chatsApi.setReaction(activeChatId, messageId, emoji);
      if (!r.success) throw r;
      // Adopt server truth (SignalR will also broadcast the same payload; setter is idempotent).
      setMessages(ms => ms.map(m =>
        m.id === messageId ? { ...m, reactions: r.data?.reactions ?? {} } : m));
    } catch (err) {
      setMessages(prevMessages);
      showApiError(err, 'Failed to add reaction');
    }
  };

  const handleRemoveReaction = async (messageId: string) => {
    const myId = getCurrentUserIdFromToken();
    if (!myId || !activeChatId) return;
    const prevMessages = messages;
    setMessages(ms => ms.map(m => {
      if (m.id !== messageId) return m;
      const next = { ...(m.reactions ?? {}) };
      delete next[myId];
      return { ...m, reactions: next };
    }));
    try {
      const r = await chatsApi.removeReaction(activeChatId, messageId);
      if (!r.success) throw r;
      setMessages(ms => ms.map(m =>
        m.id === messageId ? { ...m, reactions: r.data?.reactions ?? {} } : m));
    } catch (err) {
      setMessages(prevMessages);
      showApiError(err, 'Failed to remove reaction');
    }
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
            <Button variant="ghost" size="sm" onClick={goBackFromChat}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="relative cursor-pointer" {...profileAvatarProps(chat.otherUser.id)}>
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
            messages.map(msg => {
              const myId = getCurrentUserIdFromToken();
              const isMine = !!myId && msg.senderId === myId;
              const myReaction = !isMine && myId ? msg.reactions?.[myId] : undefined;
              const reactionEntries = Object.entries(msg.reactions ?? {});
              return (
                <div key={msg.id} className={cn('flex group', isMine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('flex flex-col gap-1 max-w-[75%]', isMine ? 'items-end' : 'items-start')}>
                    <div className={cn('flex items-center gap-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                      {!isMine && (
                        <ReactionPicker
                          currentReaction={myReaction}
                          onSelect={(emoji) => handleSetReaction(msg.id, emoji)}
                          onRemove={() => handleRemoveReaction(msg.id)}
                        >
                          <button
                            type="button"
                            aria-label="Add reaction"
                            className="text-muted-foreground hover:text-foreground p-1 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <SmilePlus className="w-4 h-4" />
                          </button>
                        </ReactionPicker>
                      )}
                      <div className={cn('rounded-lg px-3 py-2 text-sm',
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                        <BbcodeRenderer content={msg.content} />
                        <ImageAttachmentDisplay imageUrls={msg.imageUrls ?? []} />
                      </div>
                    </div>
                    {reactionEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {reactionEntries.map(([uid, emoji]) => (
                          <ReactionPill
                            key={uid}
                            emoji={emoji}
                            isOwn={uid === myId}
                            onClick={uid === myId ? () => handleRemoveReaction(msg.id) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
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
          <div ref={messagesEndRef} />
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
                  // Ctrl+Enter (or Cmd+Enter on Mac) sends. Plain Enter inserts a newline
                  // so multi-line drafting works on both desktop and mobile.
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
          <div className="relative cursor-pointer" {...profileAvatarProps(user.id)}>
            <img src={user.profileImage} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${user.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{user.name}{user.age ? `, ${user.age}` : ''}</h3>
            <p className="text-sm text-muted-foreground truncate"><LocationDisplay country={user.country} region={user.region} secondaryCountry={user.secondaryCountry} secondaryRegion={user.secondaryRegion} location={user.location} /></p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );

  const renderUserDeckCard = (target: User, onPass: () => void, onLike: () => void) => (
    <div>
      <SwipeCard
        onSwipeLeft={onPass}
        onSwipeRight={onLike}
        onSwipeUp={() => setShowDeckDetails(true)}
        onSwipeDown={() => setShowDeckDetails(false)}
        className="w-full max-w-sm mx-auto"
      >
        <Card className="profile-card aspect-[3/4] relative overflow-hidden">
          <PhotoCarousel key={target.id} images={composePhotos(target)} mode="deck" className="absolute inset-0" />
          <div
            className={cn(
              'absolute inset-0 bg-black/50 pointer-events-none transition-opacity duration-200',
              showDeckDetails ? 'opacity-100' : 'opacity-0'
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-20">
            <h2 className="text-2xl font-bold mb-1">
              {target.name}{target.age ? `, ${target.age}` : ''}
            </h2>
            <UserBadges rank={target.rank} staffRole={target.staffRole} accountName={target.accountName} />
            {(target.country || target.secondaryCountry || target.location || (target.eventsAttended && target.eventsAttended.length > 0)) && (
              <div className="flex items-center gap-3 text-sm opacity-90 mb-2 flex-wrap">
                {(target.country || target.secondaryCountry || target.location) && <LocationDisplay country={target.country} region={target.region} secondaryCountry={target.secondaryCountry} secondaryRegion={target.secondaryRegion} location={target.location} />}
                {target.eventsAttended && target.eventsAttended.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-xs opacity-80"
                    aria-label={t('search.eventsCount').replace('{count}', String(target.eventsAttended.length))}
                  >
                    <Calendar className="w-3 h-3" />
                    {target.eventsAttended.length}
                  </span>
                )}
              </div>
            )}
            {target.bio && (
              <p className="text-sm opacity-75 line-clamp-2">{target.bio}</p>
            )}
            {viewer && (() => {
              const signals = commonGround(viewer, target);
              return signals.length > 0 ? <CommonGroundLine signal={signals[0]} className="mt-2" /> : null;
            })()}
            {showDeckDetails && (
              <div className="mt-3 pt-3 border-t border-white/15 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${target.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-xs opacity-90">{target.isOnline ? 'Онлайн' : 'Недавно'}</span>
                </div>
                {target.instagramHandle && (
                  <a
                    href={`https://www.instagram.com/${target.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    @{target.instagramHandle}
                  </a>
                )}
                {target.prompts && target.prompts.length > 0 && (
                  <div>
                    <div
                      className="max-h-[110px] overflow-y-auto snap-y snap-mandatory space-y-2 pr-1 scrollbar-hide"
                      style={{ scrollbarWidth: 'none' }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseMove={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      {target.prompts.map((p, i) => (
                        <div key={i} className="snap-start">
                          <PromptCard prompt={p} onDark className="bg-black/30 border-white/20" />
                        </div>
                      ))}
                    </div>
                    {target.prompts.length > 1 && (
                      <p className="text-[10px] opacity-70 mt-1 text-center">
                        {t('search.scrollPrompts').replace('{count}', String(target.prompts.length))}
                      </p>
                    )}
                  </div>
                )}
                {target.eventsAttended && target.eventsAttended.length > 0 && (
                  <BadgeScrollRow>
                    {target.eventsAttended.map((ev) => (
                      <div key={ev.id} className="flex-shrink-0">
                        <EventAttendanceMark
                          event={ev}
                          size="sm"
                          showEventName
                          onClick={() => navigate(`/aloevera/events/${ev.id}`)}
                        />
                      </div>
                    ))}
                  </BadgeScrollRow>
                )}
              </div>
            )}
          </div>
        </Card>
      </SwipeCard>
      <div className="flex justify-center items-center gap-6 mt-6">
        <Button size="lg" variant="outline" onClick={onPass} className="rounded-full w-16 h-16 btn-pass"><X className="w-8 h-8" /></Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setShowDeckDetails(v => !v)}
          aria-label={showDeckDetails ? t('search.lessInfo') : t('search.moreInfo')}
          className="rounded-full w-12 h-12"
        >
          {showDeckDetails ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </Button>
        <Button size="lg" onClick={onLike} className="rounded-full w-16 h-16 btn-like"><Heart className="w-8 h-8" /></Button>
      </div>
    </div>
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
          {renderUserDeckCard(
            viewingUser,
            () => navigate(-1),
            async () => {
              await matchingApi.sendLike(viewingUser.id);
              navigate(-1);
            }
          )}
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
          <div className="flex items-center gap-1">
            <SearchFilterSheet value={filter} onApply={setFilter} />
            <NotificationBell />
            <Heart className="w-6 h-6 text-primary" />
          </div>
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
            {activeChips.length > 0 && (
              <div className="flex items-center flex-wrap gap-2 px-1 py-2 text-sm">
                {activeChips.map(chip => (
                  <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1">
                    {chip.label}
                    <button
                      onClick={chip.clear}
                      aria-label={t('search.clearFilter')}
                      className="ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {activeChips.length > 1 && (
                  <button
                    onClick={() => setFilter(EMPTY_FILTERS)}
                    className="text-xs text-muted-foreground underline"
                  >
                    {t('search.clearFilter')}
                  </button>
                )}
              </div>
            )}
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
                {renderUserDeckCard(currentUser, handlePass, handleLike)}
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
                          <UserBadges rank={chat.otherUser.rank} staffRole={chat.otherUser.staffRole} accountName={chat.otherUser.accountName} />
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
