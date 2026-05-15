import { useLanguage } from '@/contexts/LanguageContext';
import { getPromptText } from '@/data/prompts';
import type { PromptAnswer } from '@/types/user';
import { Card } from '@/components/ui/card';

interface PromptCardProps {
  prompt: PromptAnswer;
  className?: string;
  /** When true, renders with light text suitable for placement over a dark photo overlay. */
  onDark?: boolean;
}

export function PromptCard({ prompt, className, onDark = false }: PromptCardProps) {
  const { language } = useLanguage();
  const question = getPromptText(prompt.promptId, language);
  if (!question) return null;

  return (
    <Card className={className}>
      <div className="p-3">
        <p className={`text-xs uppercase tracking-wide mb-1 ${onDark ? 'text-white/70' : 'text-muted-foreground'}`}>
          {question}
        </p>
        <p className={`text-sm ${onDark ? 'text-white' : ''}`}>{prompt.answer}</p>
      </div>
    </Card>
  );
}
