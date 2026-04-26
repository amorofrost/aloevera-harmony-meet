import type { NavigateFunction } from 'react-router-dom';

export function navigateAfterAuth(
  navigate: NavigateFunction,
  user: { id: string; profileImage: string },
  redirectPath?: string
): void {
  if (!user.profileImage) {
    // Photo upload step is required — redirect is deferred until after that flow
    navigate('/welcome/photo', { state: { userId: user.id }, replace: true });
  } else if (redirectPath) {
    navigate(redirectPath, { replace: true });
  } else {
    navigate('/friends', { replace: true });
  }
}
