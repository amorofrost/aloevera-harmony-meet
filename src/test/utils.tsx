import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageContext } from '@/contexts/LanguageContext';

const mockLanguageValue = {
  language: 'en' as const,
  setLanguage: vi.fn(),
  t: (key: string) => key,
};

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <LanguageContext.Provider value={mockLanguageValue}>
        {ui}
      </LanguageContext.Provider>
    </MemoryRouter>
  );
}
