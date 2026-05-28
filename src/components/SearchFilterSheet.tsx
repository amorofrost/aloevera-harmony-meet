import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { CountryRegionPicker } from '@/components/ui/country-region-picker';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User } from '@/types/user';

export interface SearchFilters {
  country: string;
  region: string;
  accountName: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  gender: User['gender'] | '';
}

export const EMPTY_FILTERS: SearchFilters = {
  country: '',
  region: '',
  accountName: '',
  name: '',
  minAge: null,
  maxAge: null,
  gender: '',
};

interface Props {
  value: SearchFilters;
  onApply: (next: SearchFilters) => void;
}

export function SearchFilterSheet({ value, onApply }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const setField = <K extends keyof SearchFilters>(key: K, v: SearchFilters[K]) =>
    setDraft(prev => ({ ...prev, [key]: v }));

  const parseAge = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  const apply = () => { onApply(draft); setOpen(false); };
  const clear = () => { setDraft(EMPTY_FILTERS); onApply(EMPTY_FILTERS); setOpen(false); };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('search.filter')}>
          <Filter className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>{t('search.filter')}</SheetTitle></SheetHeader>

        <div className="py-4 space-y-5">
          <div>
            <Label htmlFor="filter-handle">{t('search.handle')}</Label>
            <Input
              id="filter-handle"
              value={draft.accountName}
              onChange={(e) => setField('accountName', e.target.value.trim())}
              placeholder={t('search.handlePlaceholder')}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="filter-name">{t('search.name')}</Label>
            <Input
              id="filter-name"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder={t('search.namePlaceholder')}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t('search.location')}</Label>
            <div className="mt-1">
              <CountryRegionPicker
                country={draft.country}
                region={draft.region}
                onChange={({ country, region }) => {
                  setDraft(prev => ({ ...prev, country, region }));
                }}
              />
            </div>
          </div>

          <div>
            <Label>{t('search.ageRange')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={draft.minAge ?? ''}
                onChange={(e) => setField('minAge', parseAge(e.target.value))}
                placeholder={t('search.minAge')}
                className="w-24"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={draft.maxAge ?? ''}
                onChange={(e) => setField('maxAge', parseAge(e.target.value))}
                placeholder={t('search.maxAge')}
                className="w-24"
              />
            </div>
          </div>

          <div>
            <Label>{t('search.gender')}</Label>
            <Select
              value={draft.gender || 'all'}
              onValueChange={(v) => setField('gender', v === 'all' ? '' : (v as User['gender']))}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search.genderAll')}</SelectItem>
                <SelectItem value="male">{t('search.genderMale')}</SelectItem>
                <SelectItem value="female">{t('search.genderFemale')}</SelectItem>
                <SelectItem value="non-binary">{t('search.genderNonBinary')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex flex-row gap-2">
          <Button variant="outline" onClick={clear}>{t('search.clearFilter')}</Button>
          <Button onClick={apply}>{t('search.applyFilter')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
