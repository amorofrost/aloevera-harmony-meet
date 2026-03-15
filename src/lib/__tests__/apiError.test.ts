import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '../apiError';

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('showApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls toast.error with the ApiResponse error message', () => {
    const err = { error: { message: 'Server error' } };
    showApiError(err);
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('calls toast.error with the Error message for a plain Error', () => {
    const err = new Error('Network failure');
    showApiError(err);
    expect(toast.error).toHaveBeenCalledWith('Network failure');
  });

  it('calls toast.error with fallback for an unknown object with no message', () => {
    const err = { code: 42 };
    showApiError(err, 'Fallback message');
    expect(toast.error).toHaveBeenCalledWith('Fallback message');
  });

  it('calls toast.error with fallback for null', () => {
    showApiError(null, 'Fallback message');
    expect(toast.error).toHaveBeenCalledWith('Fallback message');
  });

  it('calls toast.error with fallback for undefined', () => {
    showApiError(undefined, 'Fallback message');
    expect(toast.error).toHaveBeenCalledWith('Fallback message');
  });
});
