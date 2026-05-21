import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageContext } from '@/contexts/LanguageContext';
import { FeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { DEFAULT_FEATURE_FLAGS } from '@/services/api/featuresApi';

export function renderWithProviders(ui: React.ReactElement) {
  const mockLanguageValue = {
    language: 'en' as const,
    setLanguage: vi.fn(),
    t: (key: string) => key,
  };
  const mockFlagsValue = {
    flags: { ...DEFAULT_FEATURE_FLAGS },
    loaded: true,
  };
  return render(
    <MemoryRouter>
      <LanguageContext.Provider value={mockLanguageValue}>
        <FeatureFlagsContext.Provider value={mockFlagsValue}>
          {ui}
        </FeatureFlagsContext.Provider>
      </LanguageContext.Provider>
    </MemoryRouter>
  );
}
