import { useEffect, useState } from 'react';
import type { User } from '@/types/user';
import { usersApi } from '@/services/api';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    usersApi.getCurrentUser().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setUser(res.data);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { user, loading };
}
