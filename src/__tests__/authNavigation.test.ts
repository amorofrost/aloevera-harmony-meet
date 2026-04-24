import { describe, it, expect, vi } from 'vitest';
import { navigateAfterAuth } from '@/lib/authNavigation';

describe('navigateAfterAuth', () => {
  it('routes to /welcome/photo with userId state when profileImage is empty', () => {
    const navigate = vi.fn();
    navigateAfterAuth(navigate as any, { id: 'user-123', profileImage: '' });
    expect(navigate).toHaveBeenCalledWith(
      '/welcome/photo',
      { state: { userId: 'user-123' }, replace: true }
    );
  });

  it('routes to /friends when user has a profileImage', () => {
    const navigate = vi.fn();
    navigateAfterAuth(navigate as any, { id: 'user-123', profileImage: 'https://cdn.example.com/photo.jpg' });
    expect(navigate).toHaveBeenCalledWith('/friends', { replace: true });
  });

  it('routes to /welcome/photo when profileImage is undefined', () => {
    const navigate = vi.fn();
    navigateAfterAuth(navigate as any, { id: 'user-456', profileImage: undefined as any });
    expect(navigate).toHaveBeenCalledWith(
      '/welcome/photo',
      { state: { userId: 'user-456' }, replace: true }
    );
  });
});
