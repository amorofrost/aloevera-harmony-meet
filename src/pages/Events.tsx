import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Music, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import { Event } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';
import { api } from '@/lib/api';

const empty: Event[] = [];

const Events = () => {
  const [joinedEvents, setJoinedEvents] = useState<string[]>(['2', '9']);
  const [attendedEvents, setAttendedEvents] = useState<string[]>(['4', '6', '7']);
  const [upcoming, setUpcoming] = useState<Event[]>(empty);
  const [past, setPast] = useState<Event[]>(empty);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    api.getEvents().then(({ upcoming, past }) => {
      setUpcoming(upcoming);
      setPast(past);
    }).catch(console.error);
  }, []);

  const formatDate = (date: Date) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
  const getCategoryLabel = (category: string) => ({ concert: 'Концерт', meetup: 'Встреча', festival: 'Фестиваль', party: 'Вечеринка', yachting: 'Яхтинг', other: 'Другое' } as const)[category as any] || 'Событие';
  const getCategoryColor = (category: string) => ({ concert: 'bg-aloe-flame text-white', meetup: 'bg-aloe-gold text-white', festival: 'bg-aloe-coral text-white', party: 'bg-aloe-lavender text-white', yachting: 'bg-blue-500 text-white', other: 'bg-aloe-sage text-white' } as const)[category as any] || 'bg-gray-500 text-white';
  const handleJoinEvent = (eventId: string) => setJoinedEvents(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]);

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">{t('events.title')}</h1>
          <Music className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        <h2 className="text-lg font-semibold text-foreground mb-4">Предстоящие события</h2>
        {upcoming.map((event) => {
          const isJoined = joinedEvents.includes(event.id);
          return (
            <Card key={event.id} className="profile-card overflow-hidden cursor-pointer" onClick={() => navigate(`/events/${event.id}`)}>
              <div className="h-48 bg-cover bg-center relative" style={{ backgroundImage: `url(${event.imageUrl})` }}>
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className={getCategoryColor(event.category)}>{getCategoryLabel(event.category)}</Badge>
                  {event.isSecret && (<Badge className="bg-gray-900/90 text-yellow-400 border border-yellow-400/50">Секретный</Badge>)}
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
                  <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{formatDate(event.date)}</span>
                    {event.endDate && (<><Clock className="w-4 h-4 text-muted-foreground ml-2" /><span className="text-muted-foreground">до {formatDate(event.endDate)}</span></>)}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{event.attendees.length} {t('events.attendees')}{event.capacity && ` из ${event.capacity}`}</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Организатор: {event.organizer}</p>
                </div>
                <Button onClick={(e) => { e.stopPropagation(); handleJoinEvent(event.id); }} className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`} variant={isJoined ? 'secondary' : 'default'}>
                  {isJoined ? t('events.joined') : t('events.join')}
                </Button>
              </CardContent>
            </Card>
          );
        })}

        <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Прошедшие события</h2>
        {past.map((event) => {
          const wasAttended = attendedEvents.includes(event.id);
          return (
            <Card key={event.id} className="profile-card overflow-hidden cursor-pointer group" onClick={() => navigate(`/events/${event.id}`)}>
              <div className="h-48 bg-cover bg-center relative transition-all duration-300 group-hover:grayscale-0 grayscale" style={{ backgroundImage: `url(${event.imageUrl})` }}>
                <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-all duration-300" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className={`${getCategoryColor(event.category)} opacity-70 group-hover:opacity-100 transition-opacity duration-300`}>{getCategoryLabel(event.category)}</Badge>
                  {event.isSecret && (<Badge className="bg-gray-900/60 group-hover:bg-gray-900/90 text-yellow-400 border border-yellow-400/50 opacity-70 group-hover:opacity-100 transition-all duration-300">секрет</Badge>)}
                </div>
                {event.price && (
                  <div className="absolute top-4 right-4 bg-white/60 group-hover:bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 transition-all duration-300">
                    <span className="text-sm font-semibold">{event.price}₽</span>
                  </div>
                )}
                <div className="absolute bottom-4 right-4 transition-all duration-300 group-hover:grayscale-0 grayscale">
                  <EventPostmark location={event.location} date={event.date} title={event.title} category={event.category} />
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold mb-2 text-muted-foreground group-hover:text-foreground transition-colors duration-300">{event.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed opacity-75 group-hover:opacity-100 transition-opacity duration-300">{event.description}</p>
                </div>
                <div className="space-y-3 opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDate(event.date)}</span>
                    {event.endDate && (<><Clock className="w-4 h-4 text-muted-foreground ml-2" /><span className="text-muted-foreground">до {formatDate(event.endDate)}</span></>)}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{event.attendees.length} {t('events.attendees')}{event.capacity && ` из ${event.capacity}`}</span>
                  </div>
                </div>
                <div className="pt-2 border-t opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-xs text-muted-foreground">Организатор: {event.organizer}</p>
                </div>
                <div className="flex items-center justify-center py-2">
                  {wasAttended ? (<div className="flex items-center gap-2 text-green-600"><Check className="w-4 h-4" /><span className="text-sm font-medium">Вы были на этом событии</span></div>) : (<span className="text-sm text-muted-foreground">Событие завершено</span>)}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Пока нет событий</h3>
            <p className="text-muted-foreground">События появятся здесь, когда будут запланированы</p>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Events;
