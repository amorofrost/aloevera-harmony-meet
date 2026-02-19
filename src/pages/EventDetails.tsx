import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Event, User } from '@/types/user';
import { eventsApi, usersApi, chatsApi } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';

const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendeeUsers, setAttendeeUsers] = useState<User[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setIsLoading(true);
      const eventRes = await eventsApi.getEventById(eventId);
      if (!eventRes.success || !eventRes.data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const ev = eventRes.data;
      setEvent(ev);
      setIsJoined(ev.attendees.includes('current-user'));

      // Load attendee profiles (best-effort)
      const usersRes = await usersApi.getUsers();
      if (usersRes.success && usersRes.data) {
        setAttendeeUsers(usersRes.data.filter(u => ev.attendees.includes(u.id)));
      }

      setIsLoading(false);
    };
    load();
  }, [eventId]);

  const handleJoinToggle = async () => {
    if (!event) return;
    if (isJoined) {
      await eventsApi.unregisterFromEvent(event.id);
      setIsJoined(false);
    } else {
      await eventsApi.registerForEvent(event.id);
      setIsJoined(true);
    }
  };

  const handleGroupChatClick = async () => {
    const chatsRes = await chatsApi.getEventChats();
    if (chatsRes.success && chatsRes.data) {
      const chat = chatsRes.data.find(c => c.isEventChat && c.eventId === eventId);
      if (chat) {
        navigate(`/talks?chatId=${chat.id}`);
        return;
      }
    }
    navigate(`/talks?tab=events&eventId=${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <p className="relative z-10 text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="absolute inset-0 bg-background/90"></div>
        </div>
        <div className="text-center relative z-10">
          <h2 className="text-xl font-bold mb-4">Событие не найдено</h2>
          <Button onClick={() => navigate('/aloevera')}>Вернуться к событиям</Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = { concert: 'Концерт', meetup: 'Встреча', festival: 'Фестиваль', party: 'Вечеринка', yachting: 'Яхтинг', other: 'Другое' };
    return labels[category] || 'Событие';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = { concert: 'bg-aloe-flame text-white', meetup: 'bg-aloe-gold text-white', festival: 'bg-aloe-coral text-white', party: 'bg-aloe-lavender text-white', yachting: 'bg-blue-600 text-white', other: 'bg-aloe-sage text-white' };
    return colors[category] || 'bg-gray-500 text-white';
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/aloevera')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">Детали события</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        <Card className="profile-card overflow-hidden">
          <div className="h-64 bg-cover bg-center relative" style={{ backgroundImage: `url(${event.imageUrl})` }}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className={getCategoryColor(event.category)}>{getCategoryLabel(event.category)}</Badge>
              {event.isSecret && (
                <Badge className="bg-gray-900/90 text-yellow-400 border border-yellow-400/50">Секретный</Badge>
              )}
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
              <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{formatDate(event.date)}</span>
                {event.endDate && (
                  <>
                    <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                    <span className="text-muted-foreground">до {formatDate(event.endDate)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{event.location}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-primary" />
                <span>{event.attendees.length} участников{event.capacity && ` из ${event.capacity}`}</span>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Организатор: {event.organizer}</p>
            </div>
          </CardContent>
        </Card>

        {isJoined && (
          <Button onClick={handleGroupChatClick} className="w-full btn-like" size="lg">
            <MessageCircle className="w-5 h-5 mr-2" />
            Групповой чат события
          </Button>
        )}

        {isJoined && attendeeUsers.length > 0 && (
          <Card className="profile-card">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Участники ({attendeeUsers.length})</h3>
              <div className="grid grid-cols-2 gap-4">
                {attendeeUsers.map((user) => (
                  <div key={user.id} onClick={() => navigate(`/friends?userId=${user.id}`)} className="cursor-pointer group">
                    <Card className="profile-card transition-transform group-hover:scale-105">
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <Avatar className="w-16 h-16">
                            <AvatarImage src={user.profileImage} alt={user.name} />
                            <AvatarFallback>{user.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{user.name}</h4>
                            <p className="text-sm text-muted-foreground">{user.age} лет</p>
                            <p className="text-xs text-muted-foreground">{user.location}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                            <span className="text-xs text-muted-foreground">{user.isOnline ? 'Онлайн' : 'Был недавно'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`}
            variant={isJoined ? 'secondary' : 'default'} size="lg" onClick={handleJoinToggle}>
            {isJoined ? 'Покинуть событие' : 'Присоединиться к событию'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
