import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  country: string;
  region: string;
  onApply: (next: { country: string; region: string }) => void;
}

export function SearchFilterSheet({ country, region, onApply }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draftCountry, setDraftCountry] = useState(country);
  const [draftRegion, setDraftRegion] = useState(region);

  // When the sheet reopens, snap draft back to the applied filter
  useEffect(() => {
    if (open) {
      setDraftCountry(country);
      setDraftRegion(region);
    }
  }, [open, country, region]);

  const apply = () => {
    onApply({ country: draftCountry, region: draftRegion });
    setOpen(false);
  };

  const clear = () => {
    setDraftCountry('');
    setDraftRegion('');
    onApply({ country: '', region: '' });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('search.filter')}>
          <Filter className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader><SheetTitle>{t('search.filter')}</SheetTitle></SheetHeader>
        <div className="py-4">
          <CountryRegionPicker
            country={draftCountry}
            region={draftRegion}
            onChange={({ country, region }) => {
              setDraftCountry(country);
              setDraftRegion(region);
            }}
          />
        </div>
        <SheetFooter className="flex flex-row gap-2">
          <Button variant="outline" onClick={clear}>{t('search.clearFilter')}</Button>
          <Button onClick={apply}>{t('search.applyFilter')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
