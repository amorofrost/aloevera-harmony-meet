import { useEffect, useRef, type RefObject } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export function useInfiniteScroll({
  hasMore,
  isLoadingMore,
  onLoadMore,
}: UseInfiniteScrollOptions): { sentinelRef: RefObject<HTMLDivElement> } {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return { sentinelRef };
}
