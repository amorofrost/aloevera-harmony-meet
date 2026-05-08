import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CommonGroundSignal } from '@/lib/commonGround';

interface CommonGroundLineProps {
  signal: CommonGroundSignal;
  className?: string;
}

export function CommonGroundLine({ signal, className }: CommonGroundLineProps) {
  const { t } = useLanguage();
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
