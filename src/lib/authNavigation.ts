import type { NavigateFunction } from 'react-router-dom';

export function navigateAfterAuth(
  navigate: NavigateFunction,
  user: { id: string; profileImage: string }
): void {
  if (!user.profileImage) {
    navigate('/welcome/photo', { state: { userId: user.id }, replace: true });
  } else {
    navigate('/friends', { replace: true });
  }
}
