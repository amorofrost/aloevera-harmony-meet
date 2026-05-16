import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_BY_CODE } from '@/data/countries';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country?: string;
  region?: string;
  /** Legacy free-text location, used as the final fallback when country is unset. */
  location?: string;
  className?: string;
}

export function LocationDisplay({ country, region, location, className }: Props) {
  const { language } = useLanguage();

  if (country && COUNTRY_BY_CODE[country]) {
    const c = COUNTRY_BY_CODE[country];
    const name = language === 'ru' ? c.nameRu : c.nameEn;
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span aria-hidden>{flagEmoji(country)}</span>
        <span>{region || name}</span>
      </span>
    );
  }

  if (country && isCustomCountry(country)) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span>{[country, region].filter(Boolean).join(', ')}</span>
      </span>
    );
  }

  if (location) {
    return <span className={cn('text-muted-foreground italic', className)}>{location}</span>;
  }

  return null;
}
