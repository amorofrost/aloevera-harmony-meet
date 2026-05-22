import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Returns a "go back" handler that prefers the browser history (so the user
 * returns to whichever page they came from — feed, list view, deep link, etc.)
 * and falls back to {@link fallbackPath} when there's no prior history entry
 * (e.g. the user opened the page in a fresh tab or via a deep link).
 *
 * `location.key === 'default'` is React Router v6's marker for "this is the
 * first entry on the history stack" — in that case `navigate(-1)` would exit
 * the SPA, so we navigate to the fallback instead.
 */
export function useSmartBack(fallbackPath: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key === 'default') {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  }, [navigate, location.key, fallbackPath]);
}
