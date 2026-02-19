import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, ArrowLeft, Calendar, ExternalLink, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GroupChat } from '@/types/chat';
import { forumsApi, chatsApi } from '@/services/api';
import type { ForumSection } from '@/data/mockForumData';
import heroBg from '@/assets/hero-bg.jpg';

const Talks = () => {
  const [activeTab, setActiveTab] = useState('forum');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [forumSections, setForumSections] = useState<ForumSection[]>([]);
  const [eventChats, setEventChats] = useState<GroupChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const chatId = searchParams.get('chatId');
    if (tab === 'events') setActiveTab('events');
    if (chatId) {
      setActiveTab('events');
      setSelectedChat(chatId);
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [sectionsRes, chatsRes] = await Promise.all([
        forumsApi.getSections(),
        chatsApi.getEventChats(),
      ]);
      if (sectionsRes.success && sectionsRes.data) setForumSections(sectionsRes.data);
      if (chatsRes.success && chatsRes.data) setEventChats(chatsRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

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

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    setMessageText('');
  };

  // Chat view
  if (selectedChat) {
    const chat = eventChats.find(c => c.id === selectedChat);
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
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)}
              placeholder="Введи сообщение..." onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
            <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const currentSection = selectedSection ? forumSections.find(s => s.id === selectedSection) : null;

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
            {currentSection ? currentSection.name : t('nav.talks')}
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
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : !selectedSection ? (
              <div className="space-y-4">
                {forumSections.map((section) => (
                  <Card key={section.id} className="profile-card cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedSection(section.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{section.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{section.name}</h3>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{section.topicCount}</Badge>
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
                              <span>{topic.authorName}</span>
                              <span>·</span>
                              <span>{topic.replyCount} ответов</span>
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
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : eventChats.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет чатов событий</h3>
                <p className="text-muted-foreground">Присоединяйтесь к событиям</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventChats.map((chat) => (
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
