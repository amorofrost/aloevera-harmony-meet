import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface BadgeScrollRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal strip of event postmarks that:
 * - translates mouse-wheel into horizontal scroll (desktop),
 * - scrolls via touch drag without triggering a parent SwipeCard (stopPropagation),
 * - shows an edge chevron button only while more content exists in that direction.
 *
 * The chevron pills use a white backing so they read on both the dark deck overlay
 * and the light profile page.
 */
export function BadgeScrollRow({ children, className }: BadgeScrollRowProps) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  // Re-evaluate when the rendered badges change (different user / count).
  useEffect(() => {
    syncScrollState();
  }, [syncScrollState, children]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Native non-passive listener so preventDefault works (React routes wheel
    // through passive root listeners, where preventDefault is a no-op).
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= maxScroll - 1;
      // Let the page scroll normally once the strip hits an edge.
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      el.scrollLeft += delta;
      e.preventDefault();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncScrollState);
      observer.observe(el);
    }

    return () => {
      el.removeEventListener('wheel', handleWheel);
      observer?.disconnect();
    };
  }, [syncScrollState]);

  const scrollByStep = (direction: 'left' | 'right') => {
    ref.current?.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center ' +
    'rounded-full bg-white/90 text-foreground ring-1 ring-black/10 shadow-md';

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn('flex gap-2 overflow-x-auto pb-1 scrollbar-hide', className)}
        style={{ scrollbarWidth: 'none' }}
        onScroll={syncScrollState}
        onMouseDown={stop}
        onMouseMove={stop}
        onMouseUp={stop}
        onTouchStart={stop}
        onTouchMove={stop}
        onTouchEnd={stop}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          aria-label={t('common.scrollLeft')}
          className={cn(arrowClass, 'left-0')}
          onClick={(e) => { stop(e); scrollByStep('left'); }}
          onMouseDown={stop}
          onTouchStart={stop}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label={t('common.scrollRight')}
          className={cn(arrowClass, 'right-0')}
          onClick={(e) => { stop(e); scrollByStep('right'); }}
          onMouseDown={stop}
          onTouchStart={stop}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
