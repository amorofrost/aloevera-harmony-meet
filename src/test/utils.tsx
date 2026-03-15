import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageContext } from '@/contexts/LanguageContext';

export function renderWithProviders(ui: React.ReactElement) {
  const mockLanguageValue = {
    language: 'en' as const,
    setLanguage: vi.fn(),
    t: (key: string) => key,
  };
  return render(
    <MemoryRouter>
      <LanguageContext.Provider value={mockLanguageValue}>
        {ui}
      </LanguageContext.Provider>
    </MemoryRouter>
  );
}
