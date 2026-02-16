import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Music, Clock, ShoppingBag, BookOpen, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventPostmark from '@/components/ui/event-postmark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Event } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// ── Events mock (from Events.tsx) ──
const mockEvents: Event[] = [
  { id: '1', title: 'Концерт AloeVera: Новые горизонты', description: 'Эксклюзивный концерт с новыми песнями', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop', date: new Date('2024-12-15T19:00:00'), endDate: new Date('2024-12-15T23:00:00'), location: 'Театр "Мир", Москва', capacity: 500, attendees: ['1','2','3'], category: 'concert', price: 2500, organizer: 'AloeVera Official' },
  { id: '2', title: 'Фан-встреча: Поэзия и музыка', description: 'Неформальная встреча фанатов', imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=400&fit=crop', date: new Date('2024-11-08T15:00:00'), endDate: new Date('2024-11-08T18:00:00'), location: 'Парк Сокольники, Москва', attendees: ['4','5','6','7'], category: 'meetup', organizer: 'Фан-клуб AloeVera' },
  { id: '3', title: 'AloeVera Fest 2024', description: 'Большой фестиваль!', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=400&fit=crop', date: new Date('2025-06-20T12:00:00'), endDate: new Date('2025-06-21T23:00:00'), location: 'Лужники, Москва', capacity: 50000, attendees: ['8','9','10','11','12'], category: 'festival', price: 5000, organizer: 'AloeVera Official' },
  { id: '9', title: 'Яхтинг в Австралии 2026', description: 'Только для тех, кто знает.', imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop', date: new Date('2026-04-15T10:00:00'), endDate: new Date('2026-04-22T18:00:00'), location: 'Золотое побережье, Австралия', capacity: 50, attendees: ['1','13','14','15'], category: 'yachting', price: 25000, organizer: 'Veter Veter', isSecret: true },
];

// ── Mock store items ──
interface StoreItem { id: string; title: string; price: number; imageUrl: string; category: string; }
const mockStoreItems: StoreItem[] = [
  { id: 's1', title: 'Футболка "Новые горизонты"', price: 2500, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', category: 'Одежда' },
  { id: 's2', title: 'Виниловая пластинка — Первый альбом', price: 3500, imageUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=400&h=400&fit=crop', category: 'Музыка' },
  { id: 's3', title: 'Постер "AloeVera Fest 2024"', price: 800, imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=400&fit=crop', category: 'Мерч' },
  { id: 's4', title: 'Худи "AloeVera"', price: 4500, imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop', category: 'Одежда' },
];

// ── Mock blog posts ──
interface BlogPost { id: string; title: string; excerpt: string; date: Date; imageUrl: string; author: string; }
const mockBlogPosts: BlogPost[] = [
  { id: 'b1', title: 'За кулисами нового альбома', excerpt: 'Эксклюзивный репортаж из студии записи. Как создавался новый звук группы...', date: new Date('2024-02-20'), imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=400&fit=crop', author: 'AloeVera Team' },
  { id: 'b2', title: 'Итоги тура 2023', excerpt: 'Вспоминаем лучшие моменты прошлогоднего тура по России...', date: new Date('2024-01-15'), imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=400&fit=crop', author: 'AloeVera Team' },
  { id: 'b3', title: 'Интервью: О вдохновении и музыке', excerpt: 'Большое интервью с участниками группы о творческом процессе...', date: new Date('2024-02-10'), imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop', author: 'Music Magazine' },
];

const AloeVera = () => {
  const [activeTab, setActiveTab] = useState('events');
  const [joinedEvents, setJoinedEvents] = useState<string[]>(['2', '9']);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleJoinEvent = (eventId: string) => {
    setJoinedEvents(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]);
  };

  const formatDate = (date: Date) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
  const formatBlogDate = (date: Date) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  const getCategoryLabel = (cat: string) => ({ concert: 'Концерт', meetup: 'Встреча', festival: 'Фестиваль', party: 'Вечеринка', yachting: 'Яхтинг' }[cat] || 'Событие');
  const getCategoryColor = (cat: string) => ({ concert: 'bg-aloe-flame text-white', meetup: 'bg-aloe-gold text-white', festival: 'bg-aloe-coral text-white', party: 'bg-aloe-lavender text-white', yachting: 'bg-blue-500 text-white' }[cat] || 'bg-gray-500 text-white');

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">AloeVera</h1>
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
            {mockEvents.map((event) => {
              const isJoined = joinedEvents.includes(event.id);
              return (
                <Card key={event.id} className="profile-card overflow-hidden cursor-pointer" onClick={() => navigate(`/aloevera/events/${event.id}`)}>
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
                      {isJoined ? t('events.joined') : t('events.join')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Store Tab */}
          <TabsContent value="store" className="mt-6">
            <div className="grid grid-cols-2 gap-4">
              {mockStoreItems.map((item) => (
                <Card key={item.id} className="profile-card overflow-hidden cursor-pointer">
                  <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  <CardContent className="p-3">
                    <Badge variant="secondary" className="mb-2 text-xs">{item.category}</Badge>
                    <h4 className="font-semibold text-sm line-clamp-2">{item.title}</h4>
                    <p className="text-primary font-bold mt-2">{item.price}₽</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Blog Tab */}
          <TabsContent value="blog" className="mt-6 space-y-6">
            {mockBlogPosts.map((post) => (
              <Card key={post.id} className="profile-card overflow-hidden cursor-pointer">
                <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${post.imageUrl})` }} />
                <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground mb-2">{formatBlogDate(post.date)} · {post.author}</p>
                  <h3 className="text-lg font-bold mb-2">{post.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default AloeVera;
