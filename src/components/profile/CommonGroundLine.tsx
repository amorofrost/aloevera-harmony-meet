import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPromptText } from '@/data/prompts';
import type { CommonGroundSignal } from '@/lib/commonGround';

interface CommonGroundLineProps {
  signal: CommonGroundSignal;
  className?: string;
}

export function CommonGroundLine({ signal, className }: CommonGroundLineProps) {
  const { language, t } = useLanguage();
  let text = '';
  switch (signal.kind) {
    case 'sharedEventsMany':
      text = t('commonGround.sharedEventsMany').replace('{count}', String(signal.count));
      break;
    case 'sharedEventOne':
      text = t('commonGround.sharedEventOne').replace('{event}', signal.event.title);
      break;
    case 'sharedUpcomingEvent':
      text = t('commonGround.sharedUpcomingEvent').replace('{event}', signal.event.title);
      break;
    case 'sharedPromptAnswer': {
      const promptText = getPromptText(signal.promptId, language) ?? signal.promptId;
      text = t('commonGround.sharedPromptAnswer')
        .replace('{prompt}', promptText)
        .replace('{answer}', signal.answer);
      break;
    }
    case 'sharedRank':
      text = t(`commonGround.sharedRank.${signal.rank}`);
      break;
    case 'sharedCity':
      text = t('commonGround.sharedCity').replace('{city}', signal.city);
      break;
  }
  return (
    <div className={`flex items-center gap-1 text-xs opacity-95 ${className ?? ''}`}>
      <Sparkles className="w-3 h-3" />
      <span>{text}</span>
    </div>
  );
}
