import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { featuresApi, DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/services/api/featuresApi';

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  /** True once the initial fetch has resolved (even on failure). */
  loaded: boolean;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

/**
 * Provides feature flag values to the whole app. Fetches GET /api/v1/features
 * once at mount; falls back to {@link DEFAULT_FEATURE_FLAGS} if the call fails
 * (so we never hide a feature behind a flag we couldn't load).
 */
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    featuresApi.getFlags()
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setFlags(r.data);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loaded }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  return ctx;
}
