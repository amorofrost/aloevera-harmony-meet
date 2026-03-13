// src/lib/apiError.ts
import { toast } from '@/components/ui/sonner';

export function showApiError(err: unknown, fallback = 'Something went wrong') {
  const message =
    (err as any)?.error?.message ||
    (err instanceof Error ? err.message : null) ||
    fallback;
  toast.error(message);
}
