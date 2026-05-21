import { useEffect, useState } from 'react';
import { usersApi, eventsApi } from '@/services/api';
import type { User, Event } from '@/types';

// Module-level in-memory promise caches. These dedupe lookups across all feed
// cards mounted on the page (and across remounts within the same session) so
// rendering 50 notifications referencing 10 distinct actors only fires 10
// network requests.
const userCache = new Map<string, Promise<User | null>>();
const eventCache = new Map<string, Promise<Event | null>>();

export function fetchActor(actorId: string): Promise<User | null> {
  if (!userCache.has(actorId)) {
    userCache.set(
      actorId,
      usersApi
        .getUserById(actorId)
        .then((r) => (r.success && r.data ? r.data : null))
        .catch(() => null),
    );
  }
  return userCache.get(actorId)!;
}

export function fetchEvent(eventId: string): Promise<Event | null> {
  if (!eventCache.has(eventId)) {
    eventCache.set(
      eventId,
      eventsApi
        .getEventById(eventId)
        .then((r) => (r.success && r.data ? r.data : null))
        .catch(() => null),
    );
  }
  return eventCache.get(eventId)!;
}

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
}

export function useActor(actorId?: string | null): UseAsyncResult<User> {
  const [state, setState] = useState<UseAsyncResult<User>>({
    data: null,
    loading: Boolean(actorId),
  });

  useEffect(() => {
    if (!actorId) {
      setState({ data: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true });
    fetchActor(actorId).then((data) => {
      if (!cancelled) setState({ data, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [actorId]);

  return state;
}

export function useEvent(eventId?: string | null): UseAsyncResult<Event> {
  const [state, setState] = useState<UseAsyncResult<Event>>({
    data: null,
    loading: Boolean(eventId),
  });

  useEffect(() => {
    if (!eventId) {
      setState({ data: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true });
    fetchEvent(eventId).then((data) => {
      if (!cancelled) setState({ data, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}

// Test-only: clear caches between tests so module state doesn't leak.
export function __clearFeedContextCache(): void {
  userCache.clear();
  eventCache.clear();
}
