import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AccountNameInput } from '@/components/ui/account-name-input';
import * as api from '@/services/api/authApi';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/services/api/authApi', async () => {
  const actual = await vi.importActual<typeof api>('@/services/api/authApi');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      checkAccountNameAvailability: vi.fn(),
    },
  };
});

function Wrapper(props: { onValidityChange?: (v: boolean) => void }) {
  const [v, setV] = useState('');
  return renderWithProviders(
    <AccountNameInput value={v} onChange={setV} onValidityChange={props.onValidityChange} />
  ).baseElement as unknown as React.ReactElement;
}

// Stateful wrapper rendered with renderWithProviders
function StatefulWrapper({ onValidityChange }: { onValidityChange?: (v: boolean) => void }) {
  const [v, setV] = useState('');
  return <AccountNameInput value={v} onChange={setV} onValidityChange={onValidityChange} />;
}

describe('<AccountNameInput>', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders an input', () => {
    renderWithProviders(<StatefulWrapper />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows "available" for a valid free name (after debounce)', async () => {
    (api.authApi.checkAccountNameAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({ available: true });
    const onValid = vi.fn();
    renderWithProviders(<StatefulWrapper onValidityChange={onValid} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'free_name' } });
    await waitFor(
      () => expect(api.authApi.checkAccountNameAvailability).toHaveBeenCalledWith('free_name'),
      { timeout: 1500 }
    );
    await waitFor(() => expect(onValid).toHaveBeenCalledWith(true));
  });

  it('shows "taken" reason as role=alert', async () => {
    (api.authApi.checkAccountNameAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: false,
      reason: 'taken',
    });
    renderWithProviders(<StatefulWrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'taken_name' } });
    await waitFor(
      () => {
        const alerts = screen.queryAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      },
      { timeout: 1500 }
    );
  });

  it('skips the API call when the format is invalid (too short)', async () => {
    renderWithProviders(<StatefulWrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } });
    await new Promise(r => setTimeout(r, 600));
    expect(api.authApi.checkAccountNameAvailability).not.toHaveBeenCalled();
  });
});
