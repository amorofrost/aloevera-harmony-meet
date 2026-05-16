import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from '@/data/countries';
import { regionsFor, type Region } from '@/data/regions';
import { flagEmoji, isCustomCountry } from '@/lib/countryFlag';
import { useLanguage } from '@/contexts/LanguageContext';

interface CountryRegionPickerProps {
  country: string;
  region: string;
  onChange: (next: { country: string; region: string }) => void;
  required?: boolean;
  className?: string;
}

export function CountryRegionPicker({
  country,
  region,
  onChange,
  className,
}: CountryRegionPickerProps) {
  const { language, t } = useLanguage();

  const nameOf = (c: Country) => (language === 'ru' ? c.nameRu : c.nameEn);

  const [countryOpen, setCountryOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [countryCustomMode, setCountryCustomMode] = useState(false);
  const [regionCustomMode, setRegionCustomMode] = useState(false);
  const [countryDraft, setCountryDraft] = useState('');
  const [regionDraft, setRegionDraft] = useState('');

  const countryLabel = useMemo(() => {
    if (!country) return t('location.country');
    const known = COUNTRY_BY_CODE[country];
    if (known) return `${flagEmoji(country)} ${nameOf(known)}`;
    return `📍 ${country}`;
  }, [country, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Curated regions for ISO-coded countries; null for custom/unknown
  const regions: Region[] | null =
    country && !isCustomCountry(country) ? regionsFor(country) : null;

  const regionLabel = region || t('location.region');

  const setCountry = (next: string) => {
    onChange({ country: next, region: '' });
    setCountryOpen(false);
    setCountryCustomMode(false);
    setCountryDraft('');
  };

  const setRegion = (next: string) => {
    onChange({ country, region: next });
    setRegionOpen(false);
    setRegionCustomMode(false);
    setRegionDraft('');
  };

  const handleCountryCustomConfirm = () => {
    const trimmed = countryDraft.trim();
    if (trimmed) setCountry(trimmed);
  };

  const handleRegionCustomConfirm = () => {
    const trimmed = regionDraft.trim();
    if (trimmed) setRegion(trimmed);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* ── Country ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={countryOpen}
              aria-label={t('location.country')}
              className="w-full justify-between"
            >
              {countryLabel}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            {countryCustomMode ? (
              <div className="flex gap-2 p-2">
                <Input
                  autoFocus
                  value={countryDraft}
                  onChange={(e) => setCountryDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCountryCustomConfirm()}
                  placeholder={t('location.country')}
                  maxLength={56}
                />
                <Button type="button" size="sm" onClick={handleCountryCustomConfirm}>
                  OK
                </Button>
              </div>
            ) : (
              <Command>
                <CommandInput placeholder={t('location.country')} />
                <CommandList>
                  <CommandEmpty>{t('search.allCountries')}</CommandEmpty>
                  <CommandGroup>
                    {COUNTRIES.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={`${nameOf(c)} ${c.code}`}
                        onSelect={() => setCountry(c.code)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            country === c.code ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        {flagEmoji(c.code)} {nameOf(c)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem onSelect={() => setCountryCustomMode(true)}>
                      ✏️ {t('location.useCustomValue')}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>

        {/* Clear button — always visible when a country is set */}
        {country && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('location.clearCountry')}
            onClick={() => setCountry('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Region ───────────────────────────────────────────────────── */}
      {/*
        Region is always a Popover trigger (button) for consistency.
        - When country is empty  → button is disabled
        - When country is a known ISO code with curated regions → list of options
        - When country is a known ISO code without curated regions, or a custom text → "Use custom value..." only
      */}
      <Popover open={regionOpen} onOpenChange={setRegionOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={regionOpen}
            aria-label={t('location.region')}
            className="w-full justify-between"
            disabled={!country}
          >
            {regionLabel}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          {regionCustomMode ? (
            <div className="flex gap-2 p-2">
              <Input
                autoFocus
                value={regionDraft}
                onChange={(e) => setRegionDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegionCustomConfirm()}
                placeholder={t('location.region')}
                maxLength={80}
              />
              <Button type="button" size="sm" onClick={handleRegionCustomConfirm}>
                OK
              </Button>
            </div>
          ) : (
            <Command>
              <CommandInput placeholder={t('location.region')} />
              <CommandList>
                <CommandEmpty>{t('search.allRegions')}</CommandEmpty>
                {regions && regions.length > 0 && (
                  <CommandGroup>
                    {regions.map((r: Region) => (
                      <CommandItem
                        key={r.name}
                        value={r.name}
                        onSelect={() => setRegion(r.name)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            region === r.name ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        {r.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup>
                  <CommandItem onSelect={() => setRegionCustomMode(true)}>
                    ✏️ {t('location.useCustomValue')}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
