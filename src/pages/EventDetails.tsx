import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Clock, MessageCircle, Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { Event, User } from '@/types/user';

// Mock data - in real app this would come from props or API
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

// Mock group chats to find event-specific chats
const mockGroupChats = [
  {
    id: 'group-2',
    type: 'group' as const,
    name: 'Фан-встреча: Поэзия и музыка',
    description: 'Чат для участников встречи',
    participants: ['current-user', '4', '5', '6', '7'],
    isEventChat: true,
    eventId: '2',
    adminIds: ['admin-1'],
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date('2024-02-21')
  }
];

const mockUsers: User[] = [
  {
    id: '1',
    name: 'Анна',
    age: 25,
    bio: 'Обожаю музыку AloeVera и концерты под открытым небом. Ищу того, с кем можно петь любимые песни ❤️',
    location: 'Москва',
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '2',
    name: 'Дмитрий',
    age: 28,
    bio: 'Музыкант, фанат AloeVera с первого альбома. Играю на гитаре и пишу песни. Давайте создадим дуэт! 🎸',
    location: 'Санкт-Петербург',
    gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: false,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '4',
    name: 'Мария',
    age: 23,
    bio: 'Поэтесса и меломан. AloeVera вдохновляет меня на стихи',
    location: 'Москва',
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  }
];

const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Mock joined events - in real app this would come from user state
  const joinedEvents = ['2'];
  const isJoined = eventId ? joinedEvents.includes(eventId) : false;

  const event = mockEvents.find(e => e.id === eventId);

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Событие не найдено</h2>
          <Button onClick={() => navigate('/events')}>
            Вернуться к событиям
          </Button>
        </div>
      </div>
    );
  }

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

  const attendeeUsers = mockUsers.filter(user => event.attendees.includes(user.id));

  const handleAttendeeClick = (userId: string) => {
    navigate(`/search?userId=${userId}`);
  };

  const handleGroupChatClick = () => {
    // Find the group chat for this specific event
    const eventGroupChat = mockGroupChats.find(chat => 
      chat.isEventChat && chat.eventId === eventId
    );
    
    if (eventGroupChat) {
      navigate(`/chats?chatId=${eventGroupChat.id}`);
    } else {
      // Fallback to group chats list if specific chat not found
      navigate(`/chats?tab=group&eventId=${eventId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/events')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">
            Детали события
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Event Image and Info */}
        <Card className="profile-card overflow-hidden">
          <div 
            className="h-64 bg-cover bg-center relative"
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
            <div>
              <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
              <p className="text-muted-foreground leading-relaxed">
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
                  {event.attendees.length} участников
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
          </CardContent>
        </Card>

        {/* Group Chat Button (only if joined) */}
        {isJoined && (
          <Button
            onClick={handleGroupChatClick}
            className="w-full btn-like"
            size="lg"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Групповой чат события
          </Button>
        )}

        {/* Attendees List (only if joined) */}
        {isJoined && attendeeUsers.length > 0 && (
          <Card className="profile-card">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Участники ({attendeeUsers.length})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {attendeeUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleAttendeeClick(user.id)}
                    className="cursor-pointer group"
                  >
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
                            <span className="text-xs text-muted-foreground">
                              {user.isOnline ? 'Онлайн' : 'Был недавно'}
                            </span>
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

        {/* Join/Leave Event Button */}
        <div className="text-center">
          <Button
            className={`w-full ${isJoined ? 'btn-match' : 'btn-like'}`}
            variant={isJoined ? "secondary" : "default"}
            size="lg"
          >
            {isJoined ? 'Покинуть событие' : 'Присоединиться к событию'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;