import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTopicSchema, type CreateTopicFormData } from '@/lib/validators';
import { forumsApi } from '@/services/api/forumsApi';
import { showApiError } from '@/lib/apiError';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ForumTopicDetail } from '@/data/mockForumData';

interface CreateTopicModalProps {
  sectionId: string;
  sectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (topic: ForumTopicDetail) => void;
}

export function CreateTopicModal({
  sectionId,
  sectionName,
  open,
  onOpenChange,
  onCreated,
}: CreateTopicModalProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateTopicFormData>({
    resolver: zodResolver(createTopicSchema),
    defaultValues: { title: '', content: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const response = await forumsApi.createTopic(sectionId, data.title, data.content);
      if (response.success && response.data) {
        form.reset();
        onCreated(response.data);
      }
    } catch (err) {
      showApiError(err, 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forum.createTopic.titlePrefix')} «{sectionName}»</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="topic-title">{t('forum.createTopic.titleLabel')}</Label>
            <Input
              id="topic-title"
              placeholder={t('forum.createTopic.titlePlaceholder')}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="topic-content">{t('forum.createTopic.contentLabel')}</Label>
            <textarea
              id="topic-content"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('forum.createTopic.contentPlaceholder')}
              {...form.register('content')}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('forum.createTopic.posting') : t('forum.createTopic.post')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
