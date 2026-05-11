import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAP_THRESHOLD_PX = 10;

interface PhotoCarouselProps {
  images: string[];
  mode: 'deck' | 'detail';
  className?: string;
}

export function PhotoCarousel({ images, mode, className }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const downX = useRef<number | null>(null);

  if (images.length === 0) return null;

  const safeIndex = Math.min(index, images.length - 1);
  const next = () => setIndex(i => Math.min(i + 1, images.length - 1));
  const prev = () => setIndex(i => Math.max(i - 1, 0));

  const handlePointerDown = (e: React.PointerEvent) => { downX.current = e.clientX; };
  const handleTap = (advance: () => void) => (e: React.PointerEvent) => {
    if (downX.current === null) return;
    const moved = Math.abs(e.clientX - downX.current);
    downX.current = null;
    if (moved <= TAP_THRESHOLD_PX) advance();
  };

  return (
    <div className={cn('relative w-full h-full', className)}>
      <img
        src={images[safeIndex]}
        alt=""
        role="img"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {images.length > 1 && (
        <div
          data-testid="photo-carousel-dots"
          className="absolute top-2 left-2 right-2 flex gap-1 pointer-events-none"
        >
          {images.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-opacity',
                i === safeIndex ? 'bg-white opacity-90' : 'bg-white opacity-40'
              )}
            />
          ))}
        </div>
      )}

      {mode === 'deck' && images.length > 1 && (
        <>
          {safeIndex > 0 && (
            <div
              data-testid="photo-carousel-prev-hint"
              aria-hidden="true"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/25 text-white/80 rounded-full p-1 pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </div>
          )}
          {safeIndex < images.length - 1 && (
            <div
              data-testid="photo-carousel-next-hint"
              aria-hidden="true"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/25 text-white/80 rounded-full p-1 pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
          <div
            data-testid="photo-carousel-tap-left"
            className="absolute inset-y-0 left-0 w-1/2 z-10"
            onPointerDown={handlePointerDown}
            onPointerUp={handleTap(prev)}
          />
          <div
            data-testid="photo-carousel-tap-right"
            className="absolute inset-y-0 right-0 w-1/2 z-10"
            onPointerDown={handlePointerDown}
            onPointerUp={handleTap(next)}
          />
        </>
      )}

      {mode === 'detail' && images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
            disabled={safeIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2"
            disabled={safeIndex === images.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
