import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Users, Send, ArrowLeft, MoreVertical, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Chat, GroupChat, PrivateChat, Message } from '@/types/chat';
import { User } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// Mock data
const mockUsers: Record<string, User> = {
  '1': {
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
  },
  '2': {
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
};

const mockPrivateChats: (PrivateChat & { otherUser: User })[] = [
  {
    id: 'private-1',
    type: 'private',
    participants: ['current-user', '1'],
    matchId: 'match-1',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date('2024-02-22'),
    lastMessage: {
      id: 'msg-1',
      chatId: 'private-1',
      senderId: '1',
      content: 'Привет! Тоже обожаешь AloeVera?',
      timestamp: new Date('2024-02-22T14:30:00'),
      read: false,
      type: 'text'
    },
    otherUser: mockUsers['1']
  }
];

const mockGroupChats: GroupChat[] = [
  {
    id: 'group-1',
    type: 'group',
    name: 'Фанаты AloeVera Москва',
    description: 'Общение фанатов из Москвы',
    participants: ['current-user', '1', '2'],
    isEventChat: false,
    adminIds: ['admin-1'],
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-22'),
    lastMessage: {
      id: 'msg-2',
      chatId: 'group-1',
      senderId: '2',
      content: 'Кто идет на концерт в мае?',
      timestamp: new Date('2024-02-22T16:45:00'),
      read: true,
      type: 'text'
    }
  },
  {
    id: 'group-2',
    type: 'group',
    name: 'Фан-встреча: Поэзия и музыка',
    description: 'Чат для участников встречи',
    participants: ['current-user', '4', '5', '6', '7'],
    isEventChat: true,
    eventId: '2',
    adminIds: ['admin-1'],
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date('2024-02-21'),
    lastMessage: {
      id: 'msg-3',
      chatId: 'group-2',
      senderId: '1',
      content: 'Встречаемся у входа в 19:00!',
      timestamp: new Date('2024-02-21T18:00:00'),
      read: true,
      type: 'text'
    }
  }
];

const Chats = () => {
  const [activeTab, setActiveTab] = useState('private');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  useEffect(() => {
    const tab = searchParams.get('tab');
    const eventId = searchParams.get('eventId');
    const chatId = searchParams.get('chatId');
    
    if (tab === 'group') {
      setActiveTab('group');
    }
    
    // If chatId is provided, directly open that chat
    if (chatId) {
      setSelectedChat(chatId);
      return;
    }
    
    // If eventId is provided, scroll to that event's chat
    if (eventId) {
      setTimeout(() => {
        const element = document.getElementById(`event-chat-${eventId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [searchParams]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return formatTime(date);
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short'
      }).format(date);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;
    
    console.log('Send message:', messageText, 'to chat:', selectedChat);
    setMessageText('');
  };

  const handleChatSelect = (chatId: string) => {
    setSelectedChat(chatId);
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  const ChatListItem = ({ chat, onClick }: { chat: any; onClick: () => void }) => (
    <Card 
      id={chat.id}
      className="profile-card mb-3 cursor-pointer hover:shadow-md transition-shadow" 
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {chat.type === 'private' ? (
              <>
                <img 
                  src={chat.otherUser.profileImage} 
                  alt={chat.otherUser.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${chat.otherUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
              </>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                {chat.isEventChat ? <Calendar className="w-6 h-6 text-white" /> : <Users className="w-6 h-6 text-white" />}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">
                {chat.type === 'private' ? chat.otherUser.name : chat.name}
              </h3>
              {chat.lastMessage && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(chat.lastMessage.timestamp)}
                </span>
              )}
            </div>
            
            {chat.lastMessage && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground truncate">
                  {chat.lastMessage.content}
                </p>
                {!chat.lastMessage.read && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ChatView = ({ chat }: { chat: any }) => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1">
            {chat.type === 'private' ? (
              <>
                <div className="relative">
                  <img 
                    src={chat.otherUser.profileImage} 
                    alt={chat.otherUser.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${chat.otherUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <h2 className="font-semibold">{chat.otherUser.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {chat.otherUser.isOnline ? 'В сети' : 'Не в сети'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold">{chat.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {chat.participants.length} участников
                  </p>
                </div>
              </>
            )}
          </div>
          
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto relative z-10">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {chat.type === 'private' 
              ? `Начало переписки с ${chat.otherUser.name}`
              : `Добро пожаловать в группу ${chat.name}`
            }
          </p>
        </div>
        
        {chat.lastMessage && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium">
                {chat.type === 'private' ? chat.otherUser.name[0] : 'У'}
              </span>
            </div>
            <div className="flex-1">
              <div className="bg-muted rounded-lg p-3 max-w-xs">
                <p className="text-sm">{chat.lastMessage.content}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(chat.lastMessage.timestamp)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={t('chats.typeMessage')}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (selectedChat) {
    const chat = [...mockPrivateChats, ...mockGroupChats].find(c => c.id === selectedChat);
    if (!chat) return null;
    
    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col relative">
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <ChatView chat={chat} />
        <BottomNavigation />
      </div>
    );
  }

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
            Чаты
          </h1>
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="private">{t('chats.private')}</TabsTrigger>
            <TabsTrigger value="group">{t('chats.group')}</TabsTrigger>
          </TabsList>

          {/* Private Chats Tab */}
          <TabsContent value="private" className="mt-6">
            {mockPrivateChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('chats.noPrivateChats')}</h3>
                <p className="text-muted-foreground">
                  {t('chats.startChatting')}
                </p>
              </div>
            ) : (
              <div>
                {mockPrivateChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    onClick={() => handleChatSelect(chat.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Group Chats Tab */}
          <TabsContent value="group" className="mt-6">
            {mockGroupChats.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('chats.noGroupChats')}</h3>
                <p className="text-muted-foreground">
                  Присоединяйтесь к событиям, чтобы попасть в групповые чаты
                </p>
              </div>
            ) : (
              <div>
                {mockGroupChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={{
                      ...chat,
                      id: chat.isEventChat && chat.eventId ? `event-chat-${chat.eventId}` : chat.id
                    }}
                    onClick={() => handleChatSelect(chat.id)}
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

export default Chats;