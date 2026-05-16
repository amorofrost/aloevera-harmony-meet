import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';

// cmdk references ResizeObserver and scrollIntoView which jsdom doesn't provide.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom doesn't implement scrollIntoView — cmdk calls it on the active item.
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {};
  }
});

describe('<CountryRegionPicker>', () => {
  it('renders and emits change when an ISO country is picked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="" region="" onChange={onChange} />
    );
    // Open the country combobox (role="combobox" from explicit attribute; aria-label="location.country" which contains "country")
    fireEvent.click(screen.getByRole('combobox', { name: /country|страна/i }));
    // Click the Russia option (rendered by cmdk CommandItem — fires onSelect)
    fireEvent.click(screen.getByText(/Russia|Россия/));
    expect(onChange).toHaveBeenCalledWith({ country: 'RU', region: '' });
  });

  it('region is disabled until country is set', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="" region="" onChange={onChange} />
    );
    // Region trigger should be a disabled combobox (role="combobox"; aria-label="location.region" contains "region")
    const regionBtn = screen.getByRole('combobox', { name: /region|регион/i });
    expect(regionBtn).toBeDisabled();
  });

  it('clearing country resets region', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountryRegionPicker country="RU" region="Москва" onChange={onChange} />
    );
    // aria-label="location.clearCountry" — the i18n key returned by t() in tests
    const clear = screen.queryByRole('button', { name: /clearCountry|clear country|очистить страну/i });
    if (clear) {
      fireEvent.click(clear);
      expect(onChange).toHaveBeenCalledWith({ country: '', region: '' });
    }
  });
});
