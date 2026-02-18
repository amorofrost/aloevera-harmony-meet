import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Send, ArrowLeft, MoreVertical, Calendar, ExternalLink, Pin, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { GroupChat, Message } from '@/types/chat';
import { User } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// Mock forum sections & topics
interface ForumTopic {
  id: string;
  title: string;
  author: string;
  replies: number;
  lastActivity: Date;
  isPinned?: boolean;
  preview: string;
}

interface ForumSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  topics: ForumTopic[];
}

const mockForumSections: ForumSection[] = [
  {
    id: 'general',
    title: '💬 Общие обсуждения',
    icon: '💬',
    description: 'Свободное общение на любые темы',
    topics: [
      { id: 't1', title: 'Какая ваша любимая песня AloeVera?', author: 'Анна', replies: 24, lastActivity: new Date('2024-02-23T09:15:00'), isPinned: true, preview: 'Делитесь любимыми треками и обсуждаем!' },
      { id: 't2', title: 'Новый альбом — ваши впечатления', author: 'Дмитрий', replies: 42, lastActivity: new Date('2024-02-23T11:30:00'), isPinned: true, preview: 'Обсуждаем новый альбом группы' },
      { id: 't3', title: 'Кто едет на летний фестиваль?', author: 'Елена', replies: 18, lastActivity: new Date('2024-02-22T16:45:00'), preview: 'Планируем поездку вместе' },
      { id: 't4', title: 'Текст последней песни — разбор', author: 'Мария', replies: 31, lastActivity: new Date('2024-02-23T10:00:00'), preview: 'Глубокий анализ текстов и метафор' },
    ]
  },
  {
    id: 'music',
    title: '🎵 Музыка и творчество',
    icon: '🎵',
    description: 'Разбор песен, каверы, творчество',
    topics: [
      { id: 't5', title: 'Каверы на AloeVera — делимся', author: 'Александр', replies: 15, lastActivity: new Date('2024-02-22T20:15:00'), preview: 'Скидывайте свои каверы!' },
      { id: 't6', title: 'Аккорды и табы для гитары', author: 'Дмитрий', replies: 8, lastActivity: new Date('2024-02-21T14:20:00'), isPinned: true, preview: 'Собираем аккорды ко всем песням' },
      { id: 't7', title: 'Плейлисты похожих исполнителей', author: 'София', replies: 22, lastActivity: new Date('2024-02-22T18:00:00'), preview: 'Если вам нравится AloeVera, послушайте...' },
    ]
  },
  {
    id: 'cities',
    title: '🏙️ По городам',
    icon: '🏙️',
    description: 'Общение по городам и регионам',
    topics: [
      { id: 't8', title: 'Москва — встречи фанатов', author: 'Анна', replies: 35, lastActivity: new Date('2024-02-23T08:00:00'), preview: 'Организуем встречи в Москве' },
      { id: 't9', title: 'Санкт-Петербург — кто тут?', author: 'Дмитрий', replies: 19, lastActivity: new Date('2024-02-22T14:20:00'), preview: 'Питерские фанаты, объединяемся!' },
      { id: 't10', title: 'Новосибирск — ищем компанию на концерт', author: 'Елена', replies: 7, lastActivity: new Date('2024-02-21T12:00:00'), preview: 'Ищем попутчиков' },
    ]
  },
  {
    id: 'offtopic',
    title: '🎨 Оффтопик',
    icon: '🎨',
    description: 'Всё, что не связано с музыкой',
    topics: [
      { id: 't11', title: 'Кто смотрел новый фильм?', author: 'Алексей', replies: 12, lastActivity: new Date('2024-02-22T20:15:00'), preview: 'Обсуждаем кино и сериалы' },
      { id: 't12', title: 'Рекомендации книг', author: 'Мария', replies: 9, lastActivity: new Date('2024-02-21T18:30:00'), preview: 'Что почитать?' },
    ]
  }
];

// Re-use mock data from Chats for event/community chats
const mockUsers: Record<string, User> = {
  '1': {
    id: '1', name: 'Анна', age: 25, bio: 'Обожаю музыку AloeVera', location: 'Москва', gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  '2': {
    id: '2', name: 'Дмитрий', age: 28, bio: 'Музыкант, фанат AloeVera', location: 'Санкт-Петербург', gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [], lastSeen: new Date(), isOnline: false,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  }
};

const mockEventChats: GroupChat[] = [
  {
    id: 'event-1', type: 'group', name: 'Фан-встреча: Поэзия и музыка', description: 'Чат для участников встречи',
    participants: ['current-user', '4', '5', '6', '7'], isEventChat: true, eventId: '2', adminIds: ['admin-1'],
    createdAt: new Date('2024-02-18'), updatedAt: new Date('2024-02-21'),
    lastMessage: { id: 'msg-3', chatId: 'event-1', senderId: '1', content: 'Встречаемся у входа в 19:00!', timestamp: new Date('2024-02-21T18:00:00'), read: true, type: 'text' }
  },
  {
    id: 'event-2', type: 'group', name: 'Концерт AloeVera - Москва', description: 'Общение участников концерта',
    participants: ['current-user', '1', '2', '3'], isEventChat: true, eventId: '1', adminIds: ['admin-1'],
    createdAt: new Date('2024-02-10'), updatedAt: new Date('2024-02-22'),
    lastMessage: { id: 'msg-4', chatId: 'event-2', senderId: '2', content: 'Не могу дождаться концерта! 🎵', timestamp: new Date('2024-02-22T12:30:00'), read: true, type: 'text' }
  }
];

const Talks = () => {
  const [activeTab, setActiveTab] = useState('forum');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const tab = searchParams.get('tab');
    const chatId = searchParams.get('chatId');
    if (tab === 'events') setActiveTab('events');
    if (chatId) {
      setActiveTab('events');
      setSelectedChat(chatId);
    }
  }, [searchParams]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours}ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}д назад`;
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    console.log('Send message:', messageText);
    setMessageText('');
  };

  // Chat view for event chats
  if (selectedChat) {
    const chat = mockEventChats.find(c => c.id === selectedChat);
    if (!chat) return null;

    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedChat(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">{chat.name}</h2>
                <p className="text-xs text-muted-foreground">{chat.participants.length} участников</p>
              </div>
            </div>
            {chat.eventId && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/aloevera/events/${chat.eventId}`)}>
                <ExternalLink className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto relative z-10">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Добро пожаловать в группу {chat.name}</p>
          </div>
          {chat.lastMessage && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">У</span>
              </div>
              <div className="flex-1">
                <div className="bg-muted rounded-lg p-3 max-w-xs">
                  <p className="text-sm">{chat.lastMessage.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatTime(chat.lastMessage.timestamp)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Введи сообщение..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
            <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const currentSection = selectedSection ? mockForumSections.find(s => s.id === selectedSection) : null;

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          {selectedSection && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedSection(null)} className="mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground flex-1">
            {currentSection ? currentSection.title : t('nav.talks')}
          </h1>
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="forum">Форум</TabsTrigger>
            <TabsTrigger value="events">Чаты событий</TabsTrigger>
          </TabsList>

          {/* Forum Tab */}
          <TabsContent value="forum" className="mt-6">
            {!selectedSection ? (
              <div className="space-y-4">
                {mockForumSections.map((section) => (
                  <Card key={section.id} className="profile-card cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedSection(section.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{section.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{section.title}</h3>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{section.topics.length}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">тем</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {currentSection?.topics
                  .sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return b.lastActivity.getTime() - a.lastActivity.getTime();
                  })
                  .map((topic) => (
                    <Card key={topic.id} className="profile-card cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {topic.isPinned && <Pin className="w-3 h-3 text-primary" />}
                              <h4 className="font-semibold truncate">{topic.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{topic.preview}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>{topic.author}</span>
                              <span>·</span>
                              <span>{topic.replies} ответов</span>
                              <span>·</span>
                              <span>{formatDate(topic.lastActivity)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Event Chats Tab */}
          <TabsContent value="events" className="mt-6">
            {mockEventChats.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет чатов событий</h3>
                <p className="text-muted-foreground">Присоединяйтесь к событиям</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mockEventChats.map((chat) => (
                  <Card key={chat.id} className="profile-card cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedChat(chat.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold truncate">{chat.name}</h3>
                            {chat.lastMessage && (
                              <span className="text-xs text-muted-foreground">{formatDate(chat.lastMessage.timestamp)}</span>
                            )}
                          </div>
                          {chat.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage.content}</p>
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

export default Talks;
