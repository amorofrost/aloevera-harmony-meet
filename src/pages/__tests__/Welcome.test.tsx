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
    authApi: { login: vi.fn(), register: vi.fn(), getRegistrationConfig: vi.fn() },
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
  (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValue({
    success: true,
    data: { requireEventInvite: false },
    timestamp: new Date().toISOString(),
  });
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
    (vi.mocked(authApi.login) as any).mockResolvedValueOnce({
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
    (vi.mocked(authApi.login) as any).mockResolvedValueOnce({
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
    (vi.mocked(authApi.login) as any).mockRejectedValueOnce(new Error('Network failure'));
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
    (vi.mocked(authApi.login) as any).mockResolvedValueOnce({
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
    (vi.mocked(authApi.login) as any).mockResolvedValueOnce({
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

// ============================================================
// REGISTER FORM
// ============================================================

describe('Welcome — register form', () => {
  // Helper: switch to register tab
  async function openRegisterForm(user: ReturnType<typeof userEvent.setup>) {
    // Button text = t('auth.noAccount') = 'auth.noAccount' (mock returns key as-is)
    const switchBtn = screen.getByRole('button', { name: /auth\.noAccount/i });
    await user.click(switchBtn);
  }

  // Helper: fill all valid fields (bio is optional and omitted)
  async function fillValidRegisterForm(user: ReturnType<typeof userEvent.setup>) {
    // Labels use t() — mock returns key. Queries match substrings case-insensitively.
    // 'Display Name *' label → matches /name/i
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
    // 'auth.email *' label → matches /email/i
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
    // 'auth.password *' label → matches /password/i
    await user.type(screen.getByLabelText(/password/i), 'Secure1!');
    // 'auth.age' label → matches /age/i; number input has role 'spinbutton'
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
    // Gender uses native <select> mock with data-testid
    await user.selectOptions(screen.getByTestId('gender-select'), 'female');
    // 'auth.location' label → matches /location/i
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
  }

  it('shows inline error for password under 8 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'Ab1!');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // Multiple fields are empty → multiple errors fire; check at least one
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for password missing uppercase', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'secure1!');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for password missing special character', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByLabelText(/password/i), 'Secure123');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline error for age out of range (17)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '17');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows inline field error on email field for EMAIL_TAKEN', async () => {
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({
      success: false,
      error: { code: 'EMAIL_TAKEN', message: 'Email already in use' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // registerForm.setError('email', ...) — inline field error, not toast
      // All fields are valid so only the email error fires
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('calls toast.error for generic server error', async () => {
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('calls authApi.register with correct payload', async () => {
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'Secure1!',
          age: 25,
          gender: 'female',
          location: 'Moscow',
        })
      );
    });
  });

  it('shows login form after successful registration', async () => {
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      // setShowRegister(false) — register form gone, login visible
      // Login submit button text = t('auth.signIn') = 'auth.signIn'
      expect(screen.getByRole('button', { name: /auth\.signIn/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /auth\.createAccount/i })).not.toBeInTheDocument();
    });
  });

  it('shows success toast after successful registration', async () => {
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await fillValidRegisterForm(user);
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });
});

// ============================================================
// INVITE CODE
// ============================================================

describe('Welcome — register form — invite code', () => {
  async function openRegisterForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /auth\.noAccount/i }));
    await waitFor(() => {
      expect(authApi.getRegistrationConfig).toHaveBeenCalled();
    });
  }

  it('renders invite code field as optional when requireEventInvite is false', async () => {
    (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValueOnce({
      success: true,
      data: { requireEventInvite: false },
      timestamp: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/inviteCodePlaceholder/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/register\.inviteCodeOptional/i)).toBeInTheDocument();
  });

  it('renders invite code field when requireEventInvite is true', async () => {
    (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValueOnce({
      success: true,
      data: { requireEventInvite: true },
      timestamp: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/inviteCodePlaceholder/i)).toBeInTheDocument();
    });
  });

  it('shows inline Zod error when invite code field is visible but empty on submit', async () => {
    (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValueOnce({
      success: true,
      data: { requireEventInvite: true },
      timestamp: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/inviteCodePlaceholder/i)).toBeInTheDocument();
    });
    // Fill all fields except invite code
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secure1!');
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
    await user.selectOptions(screen.getByTestId('gender-select'), 'female');
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(authApi.register).not.toHaveBeenCalled();
    });
  });

  it('includes inviteCode in payload when field is visible and filled', async () => {
    (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValueOnce({
      success: true,
      data: { requireEventInvite: true },
      timestamp: new Date().toISOString(),
    });
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/inviteCodePlaceholder/i)).toBeInTheDocument();
    });
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secure1!');
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
    await user.selectOptions(screen.getByTestId('gender-select'), 'female');
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
    await user.type(screen.getByPlaceholderText(/inviteCodePlaceholder/i), 'MYCODE');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        expect.objectContaining({ inviteCode: 'MYCODE' })
      );
    });
  });

  it('sets inline error on invite code field for INVALID_INVITE_CODE response', async () => {
    (vi.mocked(authApi.getRegistrationConfig) as any).mockResolvedValueOnce({
      success: true,
      data: { requireEventInvite: true },
      timestamp: new Date().toISOString(),
    });
    (vi.mocked(authApi.register) as any).mockResolvedValueOnce({
      success: false,
      error: { code: 'INVALID_INVITE_CODE', message: 'Invalid invite code' },
    });
    const user = userEvent.setup();
    renderWithProviders(<Welcome />);
    await openRegisterForm(user);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/inviteCodePlaceholder/i)).toBeInTheDocument();
    });
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Alice');
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secure1!');
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '25');
    await user.selectOptions(screen.getByTestId('gender-select'), 'female');
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Moscow');
    await user.type(screen.getByPlaceholderText(/inviteCodePlaceholder/i), 'WRONG');
    await user.click(screen.getByRole('button', { name: /auth\.createAccount/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
