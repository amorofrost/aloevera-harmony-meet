import React, { useState } from 'react';
import { Calendar, MapPin, Users, Music, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Event } from '@/types/user';

// Mock events data
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Концерт AloeVera: Новые горизонты',
    description: 'Эксклюзивный концерт с новыми песнями и встречей с фанатами. Приходите знакомиться под любимую музыку!',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop',
    date: new Date('2024-03-15T19:00:00'),
    endDate: new Date('2024-03-15T23:00:00'),
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
    date: new Date('2024-03-08T15:00:00'),
    endDate: new Date('2024-03-08T18:00:00'),
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
    date: new Date('2024-06-20T12:00:00'),
    endDate: new Date('2024-06-21T23:00:00'),
    location: 'Лужники, Москва',
    capacity: 50000,
    attendees: ['8', '9', '10', '11', '12'],
    category: 'festival',
    price: 5000,
    organizer: 'AloeVera Official'
  }
];

const Events = () => {
  const [joinedEvents, setJoinedEvents] = useState<string[]>(['2']);
  const { t } = useLanguage();

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

      {/* Events List */}
      <div className="p-4 space-y-6">
        {mockEvents.map((event) => {
          const isJoined = joinedEvents.includes(event.id);
          
          return (
            <Card key={event.id} className="profile-card overflow-hidden">
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
                  onClick={() => handleJoinEvent(event.id)}
                  className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`}
                  variant={isJoined ? "secondary" : "default"}
                >
                  {isJoined ? t('events.joined') : t('events.join')}
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State */}
        {mockEvents.length === 0 && (
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