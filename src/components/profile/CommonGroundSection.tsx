import type { CommonGroundSignal } from '@/lib/commonGround';
import { CommonGroundLine } from './CommonGroundLine';
import { useLanguage } from '@/contexts/LanguageContext';

interface CommonGroundSectionProps {
  signals: CommonGroundSignal[];
}

export function CommonGroundSection({ signals }: CommonGroundSectionProps) {
  const { t } = useLanguage();
  if (signals.length === 0) return null;
  const top = signals.slice(0, 3);
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">{t('commonGround.title')}</h3>
      <div className="space-y-1">
        {top.map((s, i) => <CommonGroundLine key={i} signal={s} />)}
      </div>
    </div>
  );
}
