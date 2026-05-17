import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country: string;
  region: string;
  secondaryCountry: string;
  secondaryRegion: string;
  onChange: (next: {
    country: string;
    region: string;
    secondaryCountry: string;
    secondaryRegion: string;
  }) => void;
  required?: boolean;
  className?: string;
}

export function DualLocationPicker({
  country, region, secondaryCountry, secondaryRegion, onChange, required, className,
}: Props) {
  const { t } = useLanguage();
  const hasSecondary = Boolean(secondaryCountry || secondaryRegion);
  const [expanded, setExpanded] = useState(hasSecondary);

  useEffect(() => {
    if (hasSecondary) setExpanded(true);
  }, [hasSecondary]);

  const updatePrimary = (next: { country: string; region: string }) =>
    onChange({
      country: next.country, region: next.region,
      secondaryCountry, secondaryRegion,
    });

  const updateSecondary = (next: { country: string; region: string }) =>
    onChange({
      country, region,
      secondaryCountry: next.country, secondaryRegion: next.region,
    });

  const removeSecondary = () => {
    onChange({ country, region, secondaryCountry: '', secondaryRegion: '' });
    setExpanded(false);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <CountryRegionPicker
        country={country}
        region={region}
        onChange={updatePrimary}
        required={required}
      />
      {expanded ? (
        <div className="flex flex-col gap-1 pl-3 border-l-2 border-muted">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('location.secondary')}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeSecondary}
              aria-label={t('location.removeSecond')}
              className="h-auto py-0 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t('location.removeSecond')}
            </Button>
          </div>
          <CountryRegionPicker
            country={secondaryCountry}
            region={secondaryRegion}
            onChange={updateSecondary}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0 text-xs h-auto"
          aria-label="add second location"
          onClick={() => setExpanded(true)}
        >
          {t('location.addSecond')}
        </Button>
      )}
    </div>
  );
}
