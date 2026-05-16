import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DualLocationPicker } from '@/components/ui/dual-location-picker';

// cmdk/Radix Popover needs these in jsdom
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
  HTMLElement.prototype.scrollIntoView = () => {};
});

describe('<DualLocationPicker>', () => {
  it('shows "Add second location" link when no secondary is set', () => {
    renderWithProviders(
      <DualLocationPicker
        country=""
        region=""
        secondaryCountry=""
        secondaryRegion=""
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /add.*location|добавить/i })).toBeInTheDocument();
  });

  it('expands and renders second picker when the link is clicked', () => {
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry=""
        secondaryRegion=""
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add.*location|добавить/i }));
    const triggers = screen.getAllByRole('combobox', { name: /country|страна/i });
    expect(triggers.length).toBe(2);
  });

  it('starts expanded when secondary fields are pre-populated', () => {
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry="TH"
        secondaryRegion="Пхукет"
        onChange={() => {}}
      />
    );
    const triggers = screen.getAllByRole('combobox', { name: /country|страна/i });
    expect(triggers.length).toBe(2);
  });

  it('Remove button collapses and clears secondary fields', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DualLocationPicker
        country="RU"
        region="Москва"
        secondaryCountry="TH"
        secondaryRegion="Пхукет"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove|убрать/i }));
    expect(onChange).toHaveBeenCalledWith({
      country: 'RU', region: 'Москва',
      secondaryCountry: '', secondaryRegion: '',
    });
  });
});
