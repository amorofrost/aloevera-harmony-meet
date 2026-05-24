import { useNavigate } from 'react-router-dom';
import { Calendar, Music } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LocationDisplay } from '@/components/ui/location-display';
import { UserBadges } from '@/components/ui/user-badges';
import { PhotoCarousel } from '@/components/ui/photo-carousel';
import { EventAttendanceMark } from '@/components/ui/event-attendance-mark';
import { PromptCard } from '@/components/profile/PromptCard';
import type { User } from '@/types/user';

interface ProfileBodyProps {
  user: User;
}

function composePhotos(user: { profileImage: string; images: string[] }): string[] {
  const set = new Set<string>();
  const out: string[] = [];
  if (user.profileImage) { set.add(user.profileImage); out.push(user.profileImage); }
  for (const u of user.images ?? []) {
    if (u && !set.has(u)) { set.add(u); out.push(u); }
  }
  return out.slice(0, 6);
}

export function ProfileBody({ user }: ProfileBodyProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const photos = composePhotos(user);

  return (
    <div className="space-y-6">
      {/* Photo carousel */}
      {photos.length > 0 && (
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden">
          <PhotoCarousel images={photos} mode="detail" className="absolute inset-0" />
        </div>
      )}

      {/* Name, age, badges */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold">
            {user.name}{user.age ? `, ${user.age}` : ''}
          </h2>
          <UserBadges rank={user.rank} staffRole={user.staffRole} accountName={user.accountName} />
        </div>

        {/* Online status */}
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${user.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span className="text-sm text-muted-foreground">
            {user.isOnline ? 'Онлайн' : 'Недавно'}
          </span>
        </div>

        {/* Location */}
        {(user.country || user.secondaryCountry || user.location) && (
          <p className="text-sm text-muted-foreground">
            <LocationDisplay
              country={user.country}
              region={user.region}
              secondaryCountry={user.secondaryCountry}
              secondaryRegion={user.secondaryRegion}
              location={user.location}
            />
          </p>
        )}

        {/* Instagram */}
        {user.instagramHandle && (
          <a
            href={`https://www.instagram.com/${user.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            @{user.instagramHandle}
          </a>
        )}
      </div>

      {/* Bio */}
      {user.bio && (
        <div>
          <h3 className="font-semibold mb-1">{t('profile.bio')}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
        </div>
      )}

      {/* Prompts */}
      {user.prompts && user.prompts.length > 0 && (
        <div className="space-y-2">
          {user.prompts.map((p, i) => (
            <PromptCard key={i} prompt={p} />
          ))}
        </div>
      )}

      {/* Events attended */}
      {user.eventsAttended && user.eventsAttended.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {t('search.eventsCount').replace('{count}', String(user.eventsAttended.length))}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {user.eventsAttended.map((ev) => (
              <div key={ev.id} className="flex-shrink-0">
                <EventAttendanceMark
                  event={ev}
                  size="sm"
                  showEventName
                  onClick={() => navigate(`/aloevera/events/${ev.id}`)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favourite song */}
      {user.favoriteSong && (
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-1.5">
            <Music className="w-4 h-4" />
            Любимая песня
          </h3>
          <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{user.favoriteSong.title}</div>
              <div className="text-xs text-muted-foreground">
                {user.favoriteSong.album} · {user.favoriteSong.duration}
              </div>
            </div>
            <button
              type="button"
              aria-label="Play preview"
              onClick={() => {
                const audio = new Audio(user.favoriteSong!.previewUrl);
                audio.play();
              }}
              className="ml-3 bg-primary text-primary-foreground rounded-full p-2 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
