import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Calendar, ExternalLink, Pin, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { forumsApi } from '@/services/api/forumsApi';
import { toast } from '@/components/ui/sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { meetsLevel } from '@/lib/acl';
import type { ForumSection, ForumTopic, ForumTopicDetail } from '@/data/mockForumData';
import type { EventDiscussionSection } from '@/types/forum';
import TopicDetail from '@/components/forum/TopicDetail';
import { CreateTopicModal } from '@/components/forum/CreateTopicModal';
import heroBg from '@/assets/hero-bg.jpg';

const Talks = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || 'forum';
  const selectedSection = searchParams.get('section');
  const selectedTopic = searchParams.get('topic');
  const eventSection = searchParams.get('eventSection');
  const { t } = useLanguage();
  const { user } = useCurrentUser();

  const [forumSections, setForumSections] = useState<ForumSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [eventDiscussionSections, setEventDiscussionSections] = useState<EventDiscussionSection[]>([]);
  const [loadingEventSections, setLoadingEventSections] = useState(false);
  const [eventTopics, setEventTopics] = useState<ForumTopic[]>([]);
  const [loadingEventTopics, setLoadingEventTopics] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const sectionsRes = await forumsApi.getSections();
      if (sectionsRes.success && sectionsRes.data) setForumSections(sectionsRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'events') return;
    let cancelled = false;
    setLoadingEventSections(true);
    forumsApi.getEventDiscussionSummary().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setEventDiscussionSections(res.data);
      setLoadingEventSections(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'events' || !eventSection) {
      setEventTopics([]);
      return;
    }
    let cancelled = false;
    setLoadingEventTopics(true);
    forumsApi.getEventDiscussionTopics(eventSection).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setEventTopics(res.data);
      else setEventTopics([]);
      setLoadingEventTopics(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, eventSection]);

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

  const handleTopicCreated = (topic: ForumTopicDetail) => {
    setForumSections((prev) =>
      prev.map((section) => {
        if (section.id !== selectedSection) return section;
        return {
          ...section,
          topicCount: section.topicCount + 1,
          topics: [
            {
              id: topic.id,
              sectionId: selectedSection!,
              title: topic.title,
              authorName: topic.authorName,
              replyCount: 0,
              lastActivity: new Date(topic.createdAt),
              isPinned: false,
              preview: topic.content.substring(0, 100),
            },
            ...section.topics,
          ],
        };
      })
    );
    setSearchParams({ tab: 'forum', section: selectedSection!, topic: topic.id });
    setCreateModalOpen(false);
  };

  const currentSection = selectedSection ? forumSections.find((s) => s.id === selectedSection) : null;
  const currentEventMeta = eventSection
    ? eventDiscussionSections.find((s) => s.eventId === eventSection)
    : undefined;

  const eventsHeaderTitle =
    activeTab === 'events'
      ? selectedTopic
        ? 'Тема'
        : eventSection
          ? currentEventMeta?.title ?? 'Событие'
          : 'Обсуждения событий'
      : currentSection
        ? currentSection.name
        : t('nav.talks');

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          {activeTab === 'forum' && (selectedSection || selectedTopic) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedTopic) setSearchParams({ tab: 'forum', section: selectedSection! });
                else setSearchParams({ tab: 'forum' });
              }}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          {activeTab === 'events' && (eventSection || selectedTopic) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedTopic && eventSection) {
                  setSearchParams({ tab: 'events', eventSection });
                } else {
                  setSearchParams({ tab: 'events' });
                }
              }}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground flex-1 truncate">{eventsHeaderTitle}</h1>
          {activeTab === 'forum' && selectedSection && !selectedTopic && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="bg-[var(--aloe-gold)] text-black hover:opacity-90"
            >
              {t('forum.newTopic')}
            </Button>
          )}
          {activeTab === 'events' && eventSection && !selectedTopic && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={`/aloevera/events/${eventSection}`} onClick={(e) => { e.preventDefault(); navigate(`/aloevera/events/${eventSection}`); }}>
                <ExternalLink className="w-4 h-4 mr-1" />
                К событию
              </a>
            </Button>
          )}
          <MessageSquare className="w-6 h-6 text-primary shrink-0" />
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="forum">Форум</TabsTrigger>
            <TabsTrigger value="events">Обсуждения событий</TabsTrigger>
          </TabsList>

          <TabsContent value="forum" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : selectedTopic ? (
              <TopicDetail
                topicId={selectedTopic}
                onBack={() => setSearchParams({ tab: 'forum', section: selectedSection! })}
              />
            ) : !selectedSection ? (
              <div className="space-y-4">
                {forumSections.map((section) => {
                  const allowed = !user
                    ? true
                    : meetsLevel(user.rank, user.staffRole, section.minRank ?? 'novice');
                  return (
                    <Card
                      key={section.id}
                      className={`profile-card cursor-pointer hover:shadow-lg transition-shadow ${allowed ? '' : 'opacity-60'}`}
                      onClick={() => {
                        if (!allowed) {
                          toast.error(t('forum.lockedSection'));
                          return;
                        }
                        setSearchParams({ tab: 'forum', section: section.id });
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{section.icon}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold flex items-center gap-2">
                              {section.name}
                              {!allowed && <Lock className="h-4 w-4" />}
                            </h3>
                            <p className="text-sm text-muted-foreground">{section.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-sm">
                              {section.topicCount}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">тем</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
                    <Card
                      key={topic.id}
                      className="profile-card cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() =>
                        setSearchParams({ tab: 'forum', section: selectedSection!, topic: topic.id })
                      }
                    >
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

          <TabsContent value="events" className="mt-6">
            {loadingEventSections && !eventSection ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : selectedTopic && eventSection ? (
              <TopicDetail
                topicId={selectedTopic}
                onBack={() => setSearchParams({ tab: 'events', eventSection })}
              />
            ) : eventSection ? (
              loadingEventTopics ? (
                <div className="text-center py-12 text-muted-foreground">Загрузка тем...</div>
              ) : (
                <div className="space-y-3">
                  {eventTopics.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Пока нет тем в этом обсуждении.
                    </p>
                  )}
                  {eventTopics
                    .sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1;
                      if (!a.isPinned && b.isPinned) return 1;
                      return b.lastActivity.getTime() - a.lastActivity.getTime();
                    })
                    .map((topic) => (
                      <Card
                        key={topic.id}
                        className="profile-card cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() =>
                          setSearchParams({
                            tab: 'events',
                            eventSection,
                            topic: topic.id,
                          })
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
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
              )
            ) : (
              <div className="space-y-4">
                {eventDiscussionSections.length === 0 && !loadingEventSections && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Нет доступных обсуждений событий.
                  </p>
                )}
                {eventDiscussionSections.map((ev) => (
                  <Card
                    key={ev.eventId}
                    className="profile-card cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSearchParams({ tab: 'events', eventSection: ev.eventId })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{ev.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ev.date).toLocaleDateString('ru-RU')}
                            {ev.isAttending && (
                              <span className="ml-2 text-primary">Вы участвуете</span>
                            )}
                            {ev.visibility === 'secretTeaser' && (
                              <span className="ml-2 text-amber-600">Тизер</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-sm">
                            {ev.topicCount}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">тем</p>
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

      {selectedSection && activeTab === 'forum' && (
        <CreateTopicModal
          sectionId={selectedSection}
          sectionName={currentSection?.name ?? ''}
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreated={handleTopicCreated}
        />
      )}

      <BottomNavigation />
    </div>
  );
};

export default Talks;
