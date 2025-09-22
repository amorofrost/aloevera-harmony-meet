import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Music, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import { Event } from '@/types/user';

// Mock events data
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Концерт AloeVera: Новые горизонты',
    description: 'Эксклюзивный концерт с новыми песнями и встречей с фанатами. Приходите знакомиться под любимую музыку!',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop',
    date: new Date('2024-12-15T19:00:00'),
    endDate: new Date('2024-12-15T23:00:00'),
    location: 'Театр "Мир", Москва',
    capacity: 500,
    attendees: ['1', '2', '3'],
    category: 'concert',
    price: 2500,
    organizer: 'AloeVera Official'
  },
  {
    id: '2',
    title: 'Фан-встреча: Поэзия и музыка',
    description: 'Неформальная встреча фанатов для обсуждения творчества группы и знакомств. Приносите гитары!',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=400&fit=crop',
    date: new Date('2024-11-08T15:00:00'),
    endDate: new Date('2024-11-08T18:00:00'),
    location: 'Парк Сокольники, Москва',
    attendees: ['4', '5', '6', '7'],
    category: 'meetup',
    organizer: 'Фан-клуб AloeVera'
  },
  {
    id: '3',
    title: 'AloeVera Fest 2024',
    description: 'Большой фестиваль с участием группы и приглашенных артистов. Два дня музыки, любви и знакомств!',
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=400&fit=crop',
    date: new Date('2025-06-20T12:00:00'),
    endDate: new Date('2025-06-21T23:00:00'),
    location: 'Лужники, Москва',
    capacity: 50000,
    attendees: ['8', '9', '10', '11', '12'],
    category: 'festival',
    price: 5000,
    organizer: 'AloeVera Official'
  }
];

// Past events data
const pastEvents: Event[] = [
  {
    id: '4',
    title: 'AloeVera Summer Tour 2023',
    description: 'Летний тур группы AloeVera по России. Незабываемые концерты под открытым небом!',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=400&fit=crop',
    date: new Date('2023-08-15T20:00:00'),
    endDate: new Date('2023-08-15T23:30:00'),
    location: 'Гребной канал, Санкт-Петербург',
    capacity: 15000,
    attendees: ['1', '15', '16', '17', '18'],
    category: 'concert',
    price: 3000,
    organizer: 'AloeVera Official'
  },
  {
    id: '5',
    title: 'Акустический вечер: Близко к сердцу',
    description: 'Камерный концерт в уютной атмосфере. Только живая музыка и душевные разговоры.',
    imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=400&fit=crop',
    date: new Date('2023-10-12T19:30:00'),
    endDate: new Date('2023-10-12T22:00:00'),
    location: 'Клуб "Вечность", Москва',
    capacity: 200,
    attendees: ['1', '19', '20'],
    category: 'concert',
    price: 1500,
    organizer: 'AloeVera Official'
  },
  {
    id: '6',
    title: 'Новогодний бал фанатов',
    description: 'Праздничная встреча фанатов группы с конкурсами, подарками и сюрпризами от AloeVera.',
    imageUrl: 'https://images.unsplash.com/photo-1482575832494-771f77fd8ba2?w=800&h=400&fit=crop',
    date: new Date('2022-12-30T21:00:00'),
    endDate: new Date('2023-01-01T02:00:00'),
    location: 'Дворец культуры, Москва',
    capacity: 800,
    attendees: ['1', '21', '22', '23'],
    category: 'party',
    price: 2000,
    organizer: 'Фан-клуб AloeVera'
  },
  {
    id: '7',
    title: 'AloeVera Fest 2022',
    description: 'Первый большой фестиваль группы с участием звёздных гостей и множеством активностей.',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
    date: new Date('2022-07-15T14:00:00'),
    endDate: new Date('2022-07-16T23:00:00'),
    location: 'Парк Горького, Москва',
    capacity: 25000,
    attendees: ['1', '24', '25', '26', '27'],
    category: 'festival',
    price: 4000,
    organizer: 'AloeVera Official'
  },
  {
    id: '8',
    title: 'Винтажный вечер: Ретро-хиты',
    description: 'Вечер старых хитов группы в стиле ретро. Потанцуем под любимые песни прошлых лет!',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
    date: new Date('2023-03-25T20:00:00'),
    endDate: new Date('2023-03-25T23:30:00'),
    location: 'Клуб "Джаз", Санкт-Петербург',
    capacity: 300,
    attendees: ['1', '28', '29'],
    category: 'party',
    price: 1800,
    organizer: 'Фан-клуб AloeVera'
  }
];

const Events = () => {
  const [joinedEvents, setJoinedEvents] = useState<string[]>(['2']);
  const [attendedEvents, setAttendedEvents] = useState<string[]>(['4', '6', '7']); // Past events user attended
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const currentDate = new Date();

  const handleJoinEvent = (eventId: string) => {
    if (joinedEvents.includes(eventId)) {
      setJoinedEvents(joinedEvents.filter(id => id !== eventId));
    } else {
      setJoinedEvents([...joinedEvents, eventId]);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      concert: 'Концерт',
      meetup: 'Встреча',
      festival: 'Фестиваль',
      party: 'Вечеринка',
      other: 'Другое'
    };
    return labels[category as keyof typeof labels] || 'Событие';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      concert: 'bg-aloe-flame text-white',
      meetup: 'bg-aloe-gold text-white',
      festival: 'bg-aloe-coral text-white',
      party: 'bg-aloe-lavender text-white',
      other: 'bg-aloe-sage text-white'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500 text-white';
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">
            {t('events.title')}
          </h1>
          <Music className="w-6 h-6 text-primary" />
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="p-4 space-y-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Предстоящие события</h2>
        
        {mockEvents.map((event) => {
          const isJoined = joinedEvents.includes(event.id);
          
          return (
            <Card 
              key={event.id} 
              className="profile-card overflow-hidden cursor-pointer"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              {/* Event Image */}
              <div 
                className="h-48 bg-cover bg-center relative"
                style={{ backgroundImage: `url(${event.imageUrl})` }}
              >
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute top-4 left-4">
                  <Badge className={getCategoryColor(event.category)}>
                    {getCategoryLabel(event.category)}
                  </Badge>
                </div>
                {event.price && (
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1">
                    <span className="text-sm font-semibold">{event.price}₽</span>
                  </div>
                )}
                {/* Event Postmark */}
                <div className="absolute bottom-4 right-4">
                  <EventPostmark 
                    location={event.location} 
                    date={event.date} 
                    title={event.title}
                    category={event.category}
                  />
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                {/* Event Info */}
                <div>
                  <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {event.description}
                  </p>
                </div>

                {/* Event Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{formatDate(event.date)}</span>
                    {event.endDate && (
                      <>
                        <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                        <span className="text-muted-foreground">
                          до {formatDate(event.endDate)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{event.location}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-primary" />
                    <span>
                      {event.attendees.length} {t('events.attendees')}
                      {event.capacity && ` из ${event.capacity}`}
                    </span>
                  </div>
                </div>

                {/* Organizer */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Организатор: {event.organizer}
                  </p>
                </div>

                {/* Join Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinEvent(event.id);
                  }}
                  className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`}
                  variant={isJoined ? "secondary" : "default"}
                >
                  {isJoined ? t('events.joined') : t('events.join')}
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {/* Past Events */}
        <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Прошедшие события</h2>
        
        {pastEvents.map((event) => {
          const wasAttended = attendedEvents.includes(event.id);
          
          return (
            <Card 
              key={event.id} 
              className="profile-card overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              {/* Event Image */}
              <div 
                className="h-48 bg-cover bg-center relative transition-all duration-300 group-hover:grayscale-0 grayscale"
                style={{ backgroundImage: `url(${event.imageUrl})` }}
              >
                <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-all duration-300" />
                <div className="absolute top-4 left-4">
                  <Badge className={`${getCategoryColor(event.category)} opacity-70 group-hover:opacity-100 transition-opacity duration-300`}>
                    {getCategoryLabel(event.category)}
                  </Badge>
                </div>
                {event.price && (
                  <div className="absolute top-4 right-4 bg-white/60 group-hover:bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 transition-all duration-300">
                    <span className="text-sm font-semibold">{event.price}₽</span>
                  </div>
                )}
                {/* Event Postmark - grayscale effect */}
                <div className="absolute bottom-4 right-4 transition-all duration-300 group-hover:grayscale-0 grayscale">
                  <EventPostmark 
                    location={event.location} 
                    date={event.date} 
                    title={event.title}
                    category={event.category}
                  />
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                {/* Event Info */}
                <div>
                  <h3 className="text-xl font-bold mb-2 text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                    {event.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                    {event.description}
                  </p>
                </div>

                {/* Event Details */}
                <div className="space-y-3 opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDate(event.date)}</span>
                    {event.endDate && (
                      <>
                        <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                        <span className="text-muted-foreground">
                          до {formatDate(event.endDate)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {event.attendees.length} {t('events.attendees')}
                      {event.capacity && ` из ${event.capacity}`}
                    </span>
                  </div>
                </div>

                {/* Organizer */}
                <div className="pt-2 border-t opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-xs text-muted-foreground">
                    Организатор: {event.organizer}
                  </p>
                </div>

                {/* Attendance Status */}
                <div className="flex items-center justify-center py-2">
                  {wasAttended ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Вы были на этом событии</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Событие завершено</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State */}
        {mockEvents.length === 0 && pastEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Пока нет событий</h3>
            <p className="text-muted-foreground">
              События появятся здесь, когда будут запланированы
            </p>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Events;