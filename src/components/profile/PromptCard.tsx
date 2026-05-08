import { useLanguage } from '@/contexts/LanguageContext';
import { getPromptText } from '@/data/prompts';
import type { PromptAnswer } from '@/types/user';
import { Card } from '@/components/ui/card';

interface PromptCardProps {
  prompt: PromptAnswer;
  className?: string;
}

export function PromptCard({ prompt, className }: PromptCardProps) {
  const { language } = useLanguage();
  const question = getPromptText(prompt.promptId, language);
  if (!question) return null;

  return (
    <Card className={className}>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          {question}
        </p>
        <p className="text-sm">{prompt.answer}</p>
      </div>
    </Card>
  );
}
