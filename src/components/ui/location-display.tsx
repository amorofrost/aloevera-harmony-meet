import { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country?: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  /** Legacy free-text location, used as the final fallback when no slot is set. */
  location?: string;
  className?: string;
}

export function LocationDisplay({
  country, region, secondaryCountry, secondaryRegion, location, className,
}: Props) {
  const { language } = useLanguage();

  const primary = renderSlot(country, region, language);
  const secondary = renderSlot(secondaryCountry, secondaryRegion, language);

  if (!primary && !secondary && location) {
    return <span className={cn('text-muted-foreground italic', className)}>{location}</span>;
  }
  if (!primary && !secondary) return null;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {primary}
      {primary && secondary && <span aria-hidden> · </span>}
      {secondary}
    </span>
  );
}

function renderSlot(country: string | undefined, region: string | undefined, language: 'ru' | 'en'): ReactNode {
  if (country && COUNTRY_BY_CODE[country]) {
    const c = COUNTRY_BY_CODE[country];
    const name = language === 'ru' ? c.nameRu : c.nameEn;
    return (
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>{flagEmoji(country)}</span>
        <span>{region || name}</span>
      </span>
    );
  }
  if (country && isCustomCountry(country)) {
    return (
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span>{[country, region].filter(Boolean).join(', ')}</span>
      </span>
    );
  }
  return null;
}
