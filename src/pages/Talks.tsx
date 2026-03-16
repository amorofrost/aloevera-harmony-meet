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
import { eventsApi } from '@/services/api/eventsApi';
import { forumsApi } from '@/services/api/forumsApi';
import { useChatSignalR } from '@/hooks/useChatSignalR';
import type { ForumSection, ForumReply } from '@/data/mockForumData';
import TopicDetail from '@/components/forum/TopicDetail';
import heroBg from '@/assets/hero-bg.jpg';

const Talks = () => {
  const [activeTab, setActiveTab] = useState('forum');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [forumSections, setForumSections] = useState<ForumSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Event discussion state
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [topicReplies, setTopicReplies] = useState<ForumReply[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);

  // SignalR for event topic updates
  const { onEvent } = useChatSignalR('topic', activeTopicId ?? '');

  useEffect(() => {
    if (!activeTopicId) return;
    return onEvent('ReplyPosted', (reply: unknown, topicId: unknown) => {
      if (topicId === activeTopicId) {
        setTopicReplies(prev => [...prev, reply as ForumReply]);
      }
    });
  }, [activeTopicId, onEvent]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const eventId = searchParams.get('eventId');
    if (tab === 'events') setActiveTab('events');
    if (eventId) {
      setActiveTab('events');
      handleOpenEventDiscussion(eventId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const sectionsRes = await forumsApi.getSections();
      if (sectionsRes.success && sectionsRes.data) setForumSections(sectionsRes.data);
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

  const handleOpenEventDiscussion = async (eventId: string) => {
    setActiveEventId(eventId);
    setTopicLoading(true);
    const eventResult = await eventsApi.getEventById(eventId);
    if (eventResult.success && eventResult.data?.forumTopicId) {
      const topicId = eventResult.data.forumTopicId;
      setActiveTopicId(topicId);
      const repliesResult = await forumsApi.getReplies(topicId);
      if (repliesResult.success && repliesResult.data) {
        setTopicReplies(repliesResult.data);
      }
    } else {
      setActiveTopicId(null);
      setTopicReplies([]);
    }
    setTopicLoading(false);
  };

  const handleSendEventReply = async () => {
    const content = messageText.trim();
    if (!content || !activeTopicId) {
      if (!content) setMessageError("Message can't be empty");
      return;
    }
    setMessageError('');
    setMessageText('');
    const result = await forumsApi.createReply(activeTopicId, content);
    if (result.success && result.data) {
      setTopicReplies(prev => [...prev, result.data!]);
    }
  };

  // Event discussion panel
  if (activeEventId && activeTab === 'events') {
    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="sm" onClick={() => { setActiveEventId(null); setActiveTopicId(null); setTopicReplies([]); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">Обсуждение события</h2>
                <p className="text-xs text-muted-foreground">Форум события</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/aloevera/events/${activeEventId}`)}>
              <ExternalLink className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto relative z-10">
          {topicLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
          {!topicLoading && !activeTopicId && (
            <p className="text-sm text-muted-foreground text-center py-8">
              У этого события нет форумного обсуждения.
            </p>
          )}
          {!topicLoading && topicReplies.map(reply => (
            <div key={reply.id} className="flex gap-3 py-2">
              {reply.authorAvatar && (
                <img src={reply.authorAvatar} alt={reply.authorName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">{reply.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm mt-0.5 break-words">{reply.content}</p>
              </div>
            </div>
          ))}
          {!topicLoading && activeTopicId && topicReplies.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Нет сообщений. Начните обсуждение!
            </p>
          )}
        </div>
        {activeTopicId && (
          <div className="border-t p-4 relative z-10">
            <div className="flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => { setMessageText(e.target.value); if (messageError) setMessageError(''); }}
                placeholder="Введи сообщение..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendEventReply()}
                className="flex-1"
              />
              <Button onClick={handleSendEventReply} disabled={!messageText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {messageError && (
              <p className="text-xs text-destructive mt-1">{messageError}</p>
            )}
          </div>
        )}
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
          {(selectedSection || selectedTopic) && (
            <Button variant="ghost" size="sm" onClick={() => {
              if (selectedTopic) { setSelectedTopic(null); }
              else { setSelectedSection(null); }
            }} className="mr-2">
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
            <TabsTrigger value="events">Обсуждения событий</TabsTrigger>
          </TabsList>

          {/* Forum Tab */}
          <TabsContent value="forum" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : selectedTopic ? (
              <TopicDetail topicId={selectedTopic} onBack={() => setSelectedTopic(null)} />
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
                    <Card key={topic.id} className="profile-card cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTopic(topic.id)}>
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

          {/* Event Discussions Tab */}
          <TabsContent value="events" className="mt-6">
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Обсуждения событий</h3>
              <p className="text-muted-foreground">
                Перейдите к событию и откройте его форумное обсуждение оттуда.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => navigate('/aloevera')}>
                К событиям
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Talks;
