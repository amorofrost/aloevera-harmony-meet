import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Event, User } from '@/types/user';
import { eventsApi, usersApi, getCurrentUserIdFromToken } from '@/services/api';
import { showApiError } from '@/lib/apiError';
import { toast } from '@/components/ui/sonner';
import heroBg from '@/assets/hero-bg.jpg';

const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendeeUsers, setAttendeeUsers] = useState<User[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isInterested, setIsInterested] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPortraitImage, setIsPortraitImage] = useState(false);
  const [badgeLightboxOpen, setBadgeLightboxOpen] = useState(false);

  useEffect(() => {
    setInviteInput(searchParams.get('code') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setIsLoading(true);
      const inviteCode = searchParams.get('code') ?? undefined;
      const eventRes = await eventsApi.getEventById(eventId, inviteCode);
      if (!eventRes.success || !eventRes.data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const ev = eventRes.data;
      setEvent(ev);
      const myId = getCurrentUserIdFromToken();
      setIsJoined(!!myId && ev.attendees.includes(myId));
      setIsInterested(!!myId && (ev.interestedUserIds ?? []).includes(myId));

      const usersRes = await usersApi.getUsers();
      if (usersRes.success && usersRes.data) {
        setAttendeeUsers(usersRes.data.filter(u => ev.attendees.includes(u.id)));
      }

      setNotFound(false);
      setIsLoading(false);
    };
    load();
  }, [eventId, searchParams]);

  useEffect(() => {
    if (!event?.imageUrl) return;
    setIsPortraitImage(false);
    const img = new Image();
    img.onload = () => {
      setIsPortraitImage(img.naturalHeight > img.naturalWidth);
    };
    img.src = event.imageUrl;
  }, [event?.imageUrl]);

  const effectiveInviteCode = () =>
    inviteInput.trim() || searchParams.get('code')?.trim() || undefined;

  const handleApplyInviteCode = () => {
    const c = inviteInput.trim();
    if (!c) return;
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('code', c);
      return p;
    });
  };

  const handleInterestToggle = async () => {
    if (!event) return;
    const myId = getCurrentUserIdFromToken();
    if (!myId) return;
    try {
      if (isInterested) {
        const r = await eventsApi.removeEventInterest(event.id);
        if (!r.success) throw r;
        setIsInterested(false);
        setEvent({
          ...event,
          interestedUserIds: (event.interestedUserIds ?? []).filter(id => id !== myId),
        });
      } else {
        const r = await eventsApi.addEventInterest(event.id);
        if (!r.success) throw r;
        setIsInterested(true);
        setEvent({
          ...event,
          interestedUserIds: [...(event.interestedUserIds ?? []), myId],
        });
        toast.success(t('events.interested'));
      }
    } catch (err) {
      showApiError(err, t('common.error'));
    }
  };

  const handleConfirmAttendance = async () => {
    if (!event) return;
    const code = effectiveInviteCode();
    if (!code) {
      toast.error(t('events.inviteCodePlaceholder'));
      return;
    }
    try {
      const r = await eventsApi.registerForEvent(event.id, code);
      if (!r.success) throw r;
      setIsJoined(true);
      setIsInterested(false);
      toast.success(t('events.joined'));
      const inviteCode = searchParams.get('code') ?? undefined;
      const eventRes = await eventsApi.getEventById(event.id, inviteCode);
      if (eventRes.success && eventRes.data) {
        const ev = eventRes.data;
        setEvent(ev);
        const myId = getCurrentUserIdFromToken();
        setIsInterested(!!myId && (ev.interestedUserIds ?? []).includes(myId));
        const usersRes = await usersApi.getUsers();
        if (usersRes.success && usersRes.data) {
          setAttendeeUsers(usersRes.data.filter(u => ev.attendees.includes(u.id)));
        }
      }
    } catch (err) {
      showApiError(err, t('common.error'));
    }
  };

  const handleLeaveEvent = async () => {
    if (!event) return;
    try {
      const r = await eventsApi.unregisterFromEvent(event.id);
      if (!r.success) throw r;
      setIsJoined(false);
      toast.success(t('events.leaveEvent'));
      const inviteCode = searchParams.get('code') ?? undefined;
      const eventRes = await eventsApi.getEventById(event.id, inviteCode);
      if (eventRes.success && eventRes.data) {
        const ev = eventRes.data;
        setEvent(ev);
        const myId = getCurrentUserIdFromToken();
        setIsInterested(!!myId && (ev.interestedUserIds ?? []).includes(myId));
      }
    } catch (err) {
      showApiError(err, t('common.error'));
    }
  };

  const handleGroupChatClick = () => {
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

  const interestedCount = event.interestedUserIds?.length ?? 0;

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

      <div className="p-4 space-y-6 relative z-10 max-w-6xl mx-auto">
        {(() => {
          const badgeSrc = event.badgeImageUrl?.trim();
          const imageBlock = (
            <div
              className={`bg-cover bg-center relative ${isPortraitImage ? 'h-64 lg:h-[36rem]' : 'h-64'}`}
              style={{ backgroundImage: `url(${event.imageUrl})` }}
            >
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
                <EventPostmark
                  location={event.location}
                  date={event.date}
                  title={event.title}
                  category={event.category}
                  badgeImageUrl={event.badgeImageUrl}
                  onClick={badgeSrc ? () => setBadgeLightboxOpen(true) : undefined}
                />
              </div>
            </div>
          );

          const detailsBlock = (
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
                  <span>
                    {event.attendees.length} участников{event.capacity && ` из ${event.capacity}`}
                    {interestedCount > 0 && (
                      <span className="text-muted-foreground"> · {interestedCount} {t('events.interestedCount')}</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Организатор: {event.organizer}</p>
              </div>
            </CardContent>
          );

          if (isPortraitImage) {
            return (
              <>
                <Card className="profile-card overflow-hidden lg:hidden">
                  {imageBlock}
                  {detailsBlock}
                </Card>
                <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
                  <Card className="profile-card overflow-hidden">{imageBlock}</Card>
                  <Card className="profile-card overflow-hidden">{detailsBlock}</Card>
                </div>
              </>
            );
          }

          return (
            <Card className="profile-card overflow-hidden">
              {imageBlock}
              {detailsBlock}
            </Card>
          );
        })()}

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

        {!isJoined && (
          <div className="space-y-3">
            <Button
              className={`w-full ${isInterested ? 'btn-match' : 'btn-like'}`}
              variant={isInterested ? 'secondary' : 'default'}
              size="lg"
              onClick={handleInterestToggle}
            >
              {isInterested ? t('events.notInterested') : t('events.interested')}
            </Button>
          </div>
        )}

        {isJoined ? (
          <Button type="button" variant="secondary" className="w-full" size="lg" onClick={handleLeaveEvent}>
            {t('events.leaveEvent')}
          </Button>
        ) : (
          <Card className="profile-card">
            <CardContent className="p-6 space-y-4">
              <Label htmlFor="event-invite-code">{t('events.inviteCodeLabel')}</Label>
              <Input
                id="event-invite-code"
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value)}
                placeholder={t('events.inviteCodePlaceholder')}
                autoComplete="off"
              />
              {import.meta.env.DEV && (
                <p className="text-xs text-muted-foreground">{t('events.inviteDevHint')}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleApplyInviteCode}>
                  {t('events.applyCode')}
                </Button>
                <Button type="button" className="flex-1 btn-like" onClick={handleConfirmAttendance}>
                  {t('events.attendWithInvite')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {badgeLightboxOpen && event.badgeImageUrl?.trim() ? (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 p-4"
          onClick={() => setBadgeLightboxOpen(false)}
          role="presentation"
        >
          <img
            src={event.badgeImageUrl.trim()}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
};

export default EventDetails;
