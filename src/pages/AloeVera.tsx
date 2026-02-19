import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Users, Music, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventPostmark from '@/components/ui/event-postmark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Event } from '@/types/user';
import type { StoreItem } from '@/data/mockStoreItems';
import type { BlogPost } from '@/data/mockBlogPosts';
import { eventsApi, storeApi, blogApi } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';

const AloeVera = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'events');
  const [joinedEvents, setJoinedEvents] = useState<string[]>(['2', '9']);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [events, setEvents] = useState<Event[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [eventsRes, storeRes, blogRes] = await Promise.all([
        eventsApi.getEvents(),
        storeApi.getStoreItems(),
        blogApi.getBlogPosts(),
      ]);
      if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data);
      if (storeRes.success && storeRes.data) setStoreItems(storeRes.data);
      if (blogRes.success && blogRes.data) setBlogPosts(blogRes.data);
      setIsLoading(false);
    };
    load();
  }, []);

  const handleJoinEvent = async (eventId: string) => {
    const isJoined = joinedEvents.includes(eventId);
    if (isJoined) {
      await eventsApi.unregisterFromEvent(eventId);
      setJoinedEvents(prev => prev.filter(id => id !== eventId));
    } else {
      await eventsApi.registerForEvent(eventId);
      setJoinedEvents(prev => [...prev, eventId]);
    }
  };

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
  const formatBlogDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  const getCategoryLabel = (cat: string) =>
    ({ concert: 'Концерт', meetup: 'Встреча', festival: 'Фестиваль', party: 'Вечеринка', yachting: 'Яхтинг' }[cat] || 'Событие');
  const getCategoryColor = (cat: string) =>
    ({ concert: 'bg-aloe-flame text-white', meetup: 'bg-aloe-gold text-white', festival: 'bg-aloe-coral text-white', party: 'bg-aloe-lavender text-white', yachting: 'bg-blue-500 text-white' }[cat] || 'bg-gray-500 text-white');

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">{t('nav.aloevera')}</h1>
          <Music className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="p-4 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events">События</TabsTrigger>
            <TabsTrigger value="store">Магазин</TabsTrigger>
            <TabsTrigger value="blog">Блог</TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-6 space-y-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : events.map((event) => {
              const isJoined = joinedEvents.includes(event.id);
              return (
                <Card key={event.id} className="profile-card overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/aloevera/events/${event.id}`)}>
                  <div className="h-48 bg-cover bg-center relative" style={{ backgroundImage: `url(${event.imageUrl})` }}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <Badge className={getCategoryColor(event.category)}>{getCategoryLabel(event.category)}</Badge>
                      {event.isSecret && <Badge className="bg-gray-900/90 text-yellow-400 border border-yellow-400/50">Секретный</Badge>}
                    </div>
                    {event.price && (
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1">
                        <span className="text-sm font-semibold">{event.price}₽</span>
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4">
                      <EventPostmark location={event.location} date={event.date} title={event.title} category={event.category} />
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                      <p className="text-muted-foreground text-sm">{event.description}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm"><Calendar className="w-4 h-4 text-primary" /><span>{formatDate(event.date)}</span></div>
                      <div className="flex items-center gap-3 text-sm"><MapPin className="w-4 h-4 text-primary" /><span>{event.location}</span></div>
                      <div className="flex items-center gap-3 text-sm"><Users className="w-4 h-4 text-primary" /><span>{event.attendees.length} {t('events.attendees')}{event.capacity && ` из ${event.capacity}`}</span></div>
                    </div>
                    <Button onClick={(e) => { e.stopPropagation(); handleJoinEvent(event.id); }}
                      className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`} variant={isJoined ? 'secondary' : 'default'}>
                      {isJoined ? <><Check className="w-4 h-4 mr-2" />{t('events.joined')}</> : t('events.join')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Store Tab */}
          <TabsContent value="store" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {storeItems.map((item) => (
                  <Card key={item.id} className="profile-card overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/aloevera/store/${item.id}`)}>
                    <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                    <CardContent className="p-3">
                      <Badge variant="secondary" className="mb-2 text-xs">{item.category}</Badge>
                      <h4 className="font-semibold text-sm line-clamp-2">{item.title}</h4>
                      <p className="text-primary font-bold mt-2">{item.price}₽</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Blog Tab */}
          <TabsContent value="blog" className="mt-6 space-y-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <Badge
                    variant={selectedTag === null ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedTag(null)}
                  >
                    Все
                  </Badge>
                  {Array.from(new Set(blogPosts.flatMap(p => p.tags))).map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTag === tag ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                {blogPosts
                  .filter(post => !selectedTag || post.tags.includes(selectedTag))
                  .map((post) => (
                    <Card key={post.id} className="profile-card overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/aloevera/blog/${post.id}`)}>
                      <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${post.imageUrl})` }} />
                      <CardContent className="p-6">
                        <p className="text-xs text-muted-foreground mb-2">{formatBlogDate(post.date)} · {post.author}</p>
                        <h3 className="text-lg font-bold mb-2">{post.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                        <div className="flex gap-1.5 mt-3">
                          {post.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default AloeVera;
