import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { PROMPT_CATALOG } from '@/data/prompts';
import type { PromptAnswer } from '@/types/user';

interface PromptsEditorProps {
  initial: PromptAnswer[];
  onSave: (prompts: PromptAnswer[]) => Promise<void>;
}

const HTML_RE = /<[a-z!\/][\s\S]*?>/i;

// Form schema: allows empty slots (promptId === '') so padded slots validate cleanly.
// The submit handler filters them out before calling onSave.
const slotSchema = z.union([
  z.object({ promptId: z.literal(''), answer: z.string() }),
  z.object({
    promptId: z.string().min(1),
    answer: z.string().max(200, 'Answer must be 200 characters or less').refine(
      s => !HTML_RE.test(s),
      'HTML is not allowed',
    ),
  }),
]);

const formSchema = z.object({
  prompts: z.array(slotSchema).max(3).refine(
    arr => {
      const ids = arr.map(a => a.promptId).filter(Boolean);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate prompt id' },
  ),
});

type FormValues = z.infer<typeof formSchema>;

export function PromptsEditor({ initial, onSave }: PromptsEditorProps) {
  const { language, t } = useLanguage();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompts: [
        ...initial,
        ...Array(Math.max(0, 3 - initial.length)).fill({ promptId: '', answer: '' }),
      ].slice(0, 3),
    },
  });

  const watched = form.watch('prompts');

  const submit = form.handleSubmit(async ({ prompts }) => {
    const cleaned = prompts.filter(p => p.promptId && p.answer.trim().length > 0) as PromptAnswer[];
    await onSave(cleaned);
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {[0, 1, 2].map(i => {
        const usedElsewhere = new Set(watched.filter((_, j) => j !== i).map(p => p.promptId).filter(Boolean));
        const available = PROMPT_CATALOG.filter(p => !usedElsewhere.has(p.id));
        return (
          <div key={i} className="space-y-2 border rounded-md p-3">
            <Controller
              control={form.control}
              name={`prompts.${i}.promptId`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t('settings.prompts.placeholder')} /></SelectTrigger>
                  <SelectContent>
                    {available.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p[language]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Textarea
              {...form.register(`prompts.${i}.answer`)}
              maxLength={200}
              placeholder={t('settings.prompts.answerPlaceholder')}
            />
            <div className="text-xs text-muted-foreground">
              {watched[i]?.answer?.length ?? 0}/200
            </div>
            {form.formState.errors.prompts?.[i]?.answer && (
              <p className="text-xs text-destructive">
                {form.formState.errors.prompts[i]!.answer!.message}
              </p>
            )}
          </div>
        );
      })}
      {form.formState.errors.prompts?.root && (
        <p className="text-xs text-destructive">
          {form.formState.errors.prompts.root.message}
        </p>
      )}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t('settings.prompts.save')}
      </Button>
    </form>
  );
}
