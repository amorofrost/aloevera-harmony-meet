import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreRegisterAttendeesCard from '../PreRegisterAttendeesCard';
import { adminApi } from '@/services/api/adminApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const VALID_JSON = JSON.stringify([
  { telegramUsername: 'anna_p', name: 'Anna' },
  { telegramUsername: 'bad', name: 'Bad Row' },
]);

describe('PreRegisterAttendeesCard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows a parse error for malformed JSON', () => {
    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: '{not json' },
    });
    expect(screen.getByText(/could not parse/i)).toBeInTheDocument();
  });

  it('previews parsed rows before import', () => {
    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: VALID_JSON },
    });
    expect(screen.getByText('anna_p')).toBeInTheDocument();
    expect(screen.getByText(/2 attendees? ready/i)).toBeInTheDocument();
  });

  it('submits and renders per-row results', async () => {
    const spy = vi.spyOn(adminApi, 'preRegisterAttendees').mockResolvedValue({
      success: true,
      data: {
        summary: { created: 1, skippedExists: 0, invalidUsername: 1, invalidName: 0, error: 0 },
        results: [
          { telegramUsername: 'anna_p', status: 'created', userId: 'anna_p' },
          { telegramUsername: 'bad', status: 'invalidUsername', message: 'invalidFormat' },
        ],
      },
      timestamp: new Date().toISOString(),
    } as never);

    render(<PreRegisterAttendeesCard eventId="1" />);
    fireEvent.change(screen.getByLabelText(/attendee list/i), {
      target: { value: VALID_JSON },
    });
    fireEvent.click(screen.getByRole('button', { name: /import/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('1', [
      { telegramUsername: 'anna_p', name: 'Anna' },
      { telegramUsername: 'bad', name: 'Bad Row' },
    ]));
    expect(await screen.findByText('created')).toBeInTheDocument();
    expect(await screen.findByText('invalidUsername')).toBeInTheDocument();
  });
});
