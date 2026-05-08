import { render, screen } from '@testing-library/react';
import { PromptCard } from '../PromptCard';
import { LanguageContext } from '@/contexts/LanguageContext';
import type { PromptAnswer } from '@/types/user';

const wrap = (ui: React.ReactNode, lang: 'ru' | 'en' = 'ru') =>
  render(
    <LanguageContext.Provider
      value={{
        language: lang,
        setLanguage: () => {},
        t: (k: string) => k,
      }}
    >
      {ui}
    </LanguageContext.Provider>
  );

describe('<PromptCard>', () => {
  it('renders question text and answer', () => {
    const prompt: PromptAnswer = {
      promptId: 'looking_for',
      answer: 'Tour buddies',
    };
    wrap(<PromptCard prompt={prompt} />);
    expect(screen.getByText('Что я ищу здесь')).toBeInTheDocument();
    expect(screen.getByText('Tour buddies')).toBeInTheDocument();
  });

  it('renders nothing for unknown promptId', () => {
    const prompt: PromptAnswer = {
      promptId: 'totally_invented',
      answer: 'x',
    };
    const { container } = wrap(<PromptCard prompt={prompt} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses en text when language is en', () => {
    const prompt: PromptAnswer = {
      promptId: 'looking_for',
      answer: 'x',
    };
    wrap(<PromptCard prompt={prompt} />, 'en');
    expect(screen.getByText("What I'm looking for here")).toBeInTheDocument();
  });
});
