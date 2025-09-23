import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, X, Info, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SwipeCard from '@/components/ui/swipe-card';
import EventPostmark from '@/components/ui/event-postmark';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Event } from '@/types/user';
import heroBg from '@/assets/hero-bg.jpg';

// Mock events data
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'AloeVera: Новые Горизонты',
    description: 'Большой концерт в поддержку нового альбома',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2023-06-15'),
    location: 'Крокус Сити Холл, Москва',
    capacity: 7000,
    attendees: ['1', '2'],
    category: 'concert',
    price: 3500,
    organizer: 'AloeVera Official'
  },
  {
    id: '2',
    title: 'Акустический вечер: Близко к сердцу',
    description: 'Камерное выступление с акустическими версиями любимых песен',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2024-03-20'),
    location: 'Театр Эстрады, Санкт-Петербург',
    capacity: 500,
    attendees: ['1', '3'],
    category: 'concert',
    price: 2500,
    organizer: 'AloeVera Official'
  },
  {
    id: '3',
    title: 'AloeVera Summer Fest',
    description: 'Летний фестиваль под открытым небом',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2024-07-10'),
    location: 'Парк Сокольники, Москва',
    capacity: 10000,
    attendees: ['2', '3', '4'],
    category: 'festival',
    price: 4000,
    organizer: 'AloeVera Official'
  },
  {
    id: '4',
    title: 'Фан-встреча: Музыка и Общение',
    description: 'Неформальная встреча поклонников группы',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2024-05-12'),
    location: 'Клуб Plan B, Москва',
    capacity: 200,
    attendees: ['1', '4', '5'],
    category: 'meetup',
    organizer: 'AloeVera Fan Club'
  },
  {
    id: '5',
    title: 'Новогодний концерт 2024',
    description: 'Празднование Нового года с любимой группой',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2023-12-31'),
    location: 'Олимпийский, Москва',
    capacity: 15000,
    attendees: ['5', '6', '7'],
    category: 'party',
    price: 5000,
    organizer: 'AloeVera Official'
  },
  {
    id: '6',
    title: 'Винтажный вечер: Ретро-хиты',
    description: 'Вечер старых хитов группы в камерной обстановке',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600',
    date: new Date('2024-02-14'),
    location: 'Клуб Космонавт, Санкт-Петербург',
    capacity: 300,
    attendees: ['2', '6', '7'],
    category: 'party',
    price: 2000,
    organizer: 'AloeVera Official'
  }
];

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Анна',
    age: 25,
    bio: 'Обожаю музыку AloeVera и концерты под открытым небом. Ищу того, с кем можно петь любимые песни ❤️',
    location: 'Москва',
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    eventsAttended: [mockEvents[0]],
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
    eventsAttended: [],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '3',
    name: 'Елена',
    age: 22,
    bio: 'Танцую под AloeVera, хожу на все концерты. Ищу романтика, который разделит мою страсть к музыке 💃',
    location: 'Новосибирск',
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    eventsAttended: [mockEvents[1], mockEvents[2], mockEvents[4], mockEvents[5], mockEvents[0], mockEvents[3]],
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
    eventsAttended: [mockEvents[2], mockEvents[3]],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '5',
    name: 'Александр',
    age: 26,
    bio: 'Фотограф и фанат AloeVera. Ищу музу и вторую половинку',
    location: 'Москва', 
    gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: false,
    eventsAttended: [mockEvents[3], mockEvents[4]],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '6',
    name: 'София',
    age: 24,
    bio: 'Художница, рисую под музыку AloeVera. Творческая душа ищет понимание',
    location: 'Москва',
    gender: 'female', 
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    eventsAttended: [mockEvents[4], mockEvents[5]],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  {
    id: '7',
    name: 'Максим',
    age: 27,
    bio: 'Барабанщик, мечтаю сыграть на одной сцене с AloeVera',
    location: 'Москва',
    gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop&crop=face',
    images: [],
    lastSeen: new Date(),
    isOnline: false,
    eventsAttended: [mockEvents[4], mockEvents[5]],
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  }
];

const Search = () => {
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const specificUserId = searchParams.get('userId');
  const isViewingSpecificUser = Boolean(specificUserId);

  const currentUser = specificUserId 
    ? mockUsers.find(user => user.id === specificUserId) 
    : mockUsers[currentUserIndex];

  useEffect(() => {
    if (specificUserId) {
      setShowDetails(true);
    }
  }, [specificUserId]);

  const handleLike = () => {
    console.log('Liked user:', currentUser?.name);
    if (!isViewingSpecificUser) {
      nextUser();
    }
  };

  const handlePass = () => {
    console.log('Passed user:', currentUser?.name);
    if (!isViewingSpecificUser) {
      nextUser();
    }
  };

  const nextUser = () => {
    setShowDetails(false);
    setCurrentUserIndex((prev) => prev + 1);
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const scrollEvents = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 100;
      const currentScroll = scrollContainerRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="mb-8">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Пользователь не найден
            </h2>
            <p className="text-muted-foreground">
              Этот профиль недоступен
            </p>
            <Button 
              onClick={() => navigate('/search')} 
              className="mt-4"
            >
              Вернуться к поиску
            </Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (!isViewingSpecificUser && currentUserIndex >= mockUsers.length) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="mb-8">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('search.noMoreProfiles')}
            </h2>
            <p className="text-muted-foreground">
              Загляните позже или расширьте настройки поиска
            </p>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90"></div>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b relative">
        <div className="flex items-center justify-between p-4">
          {isViewingSpecificUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="p-2 mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground flex-1">
            {isViewingSpecificUser ? currentUser.name : t('search.title')}
          </h1>
          {!isViewingSpecificUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDetails}
              className="text-muted-foreground"
            >
              <Info className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="relative p-4 flex-1 z-10">
        <SwipeCard
          onSwipeLeft={handlePass}
          onSwipeRight={handleLike}
          onTap={toggleDetails}
          className="w-full max-w-sm mx-auto"
        >
          <Card className="profile-card aspect-[3/4] relative overflow-hidden">
            {/* Profile Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentUser.profileImage})` }}
            >
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
              
              {/* Basic Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${currentUser.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-sm opacity-90">
                    {currentUser.isOnline ? 'Онлайн' : 'Недавно была'}
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {currentUser.name}, {currentUser.age}
                </h2>
                <p className="text-sm opacity-90 mb-2">{currentUser.location}</p>
                {!showDetails && (
                  <p className="text-sm opacity-75 line-clamp-2">
                    {currentUser.bio}
                  </p>
                )}
              </div>

              {/* Detailed Info Overlay */}
              {showDetails && (
                <div className="absolute inset-0 bg-black/80 p-6 flex flex-col justify-end">
                  <div className="text-white space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">О себе</h3>
                      <p className="text-sm leading-relaxed">{currentUser.bio}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="opacity-75">Возраст:</span>
                        <div>{currentUser.age}</div>
                      </div>
                      <div>
                        <span className="opacity-75">Пол:</span>
                        <div>{currentUser.gender === 'male' ? 'Мужской' : 'Женский'}</div>
                      </div>
                    </div>
                    
                    {/* Events Attended */}
                    {currentUser.eventsAttended && currentUser.eventsAttended.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Посещённые события</h3>
                        <div className="relative">
                          {currentUser.eventsAttended.length > 4 && (
                            <>
                              <button
                                onClick={() => scrollEvents('left')}
                                className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => scrollEvents('right')}
                                className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <div 
                            ref={scrollContainerRef}
                            className="flex gap-2 overflow-x-auto scrollbar-hide"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {currentUser.eventsAttended.map((event) => (
                              <div key={event.id} className="flex-shrink-0">
                                <EventPostmark
                                  location={event.location}
                                  date={event.date}
                                  title={event.title}
                                  category={event.category}
                                  className="w-12 h-12"
                                  showEventName={true}
                                  onClick={() => navigate(`/events/${event.id}`)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </SwipeCard>

        {/* Instructions */}
        {!isViewingSpecificUser && (
          <p className="text-center text-muted-foreground text-sm mt-4">
            {t('search.swipeInstructions')}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-6 mt-8">
          <Button
            size="lg"
            onClick={handlePass}
            className="btn-pass w-16 h-16 rounded-full p-0"
          >
            <X className="w-8 h-8" />
          </Button>
          <Button
            size="lg"
            onClick={handleLike}
            className="btn-like w-16 h-16 rounded-full p-0"
          >
            <Heart className="w-8 h-8" />
          </Button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Search;
