import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Welcome from '@/pages/Welcome';
import { authApi, apiClient } from '@/services/api';
import { toast } from '@/components/ui/sonner';

// --- Module mocks ---

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    authApi: { login: vi.fn(), register: vi.fn() },
  };
});

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

// Mock Radix Select — jsdom does not support pointer events required by Radix portal
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, children }: any) => (
    <div>
      <select
        data-testid="gender-select"
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
}));

// --- Shared setup ---

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(apiClient, 'setAccessToken').mockImplementation(() => {});
  vi.spyOn(apiClient, 'setRefreshToken').mockImplementation(() => {});
});

// ============================================================
// LOGIN FORM
// ============================================================

describe('Welcome — login form', () => {
  it('renders email field, password field, and sign-in button', () => {
    renderWithProviders(<Welcome />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    // Button text = t('auth.signIn') = 'auth.signIn' (mock returns key as-is)
    expect(screen.getByRole('button', { name: /auth\.signIn/i })).toBeInTheDocument();
  });

  it('shows inline error when email is invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'bad-email');
    // Pre-fill a valid password so only the email error fires
    await user.type(screen.getByLabelText(/password/i), 'secret');
    // fireEvent.submit bypasses jsdom's native HTML5 email constraint validation
    // which would block the submit event before react-hook-form can run
    fireEvent.submit(screen.getByRole('button', { name: /auth\.signIn/i }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows inline error when password is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      // Only password error fires (email is valid)
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls authApi.login with correct email and password', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' });
    });
  });

  it('shows inline root error on API failure (INVALID_CREDENTIALS)', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      // loginForm.setError('root', ...) renders an inline error, not a toast
      // Valid email + password means no field errors — only root error fires
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('calls toast.error with fallback message on network/unexpected failure', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Network failure'));
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('calls setAccessToken and setRefreshToken on success', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('at');
      expect(apiClient.setRefreshToken).toHaveBeenCalledWith('rt');
    });
  });

  it('navigates away from / on successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: '1', name: 'Test', email: 'user@example.com' } as any },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/friends');
    });
  });
});
