import { toast } from 'sonner';

/**
 * Convenience wrappers around sonner's `toast()` for workspace operations.
 *
 * Usage:
 *   toastSuccess('Draft created');
 *   toastError('Failed to save', { retry: () => mutation.mutate(vars) });
 *   toastInfo('Copied to clipboard');
 */

export function toastSuccess(message: string) {
  toast.success(message, { duration: 1500 });
}

export function toastError(message: string, options?: { retry?: () => void }) {
  toast.error(message, {
    duration: 5000,
    action: options?.retry ? { label: 'Retry', onClick: options.retry } : undefined,
  });
}

export function toastInfo(message: string) {
  toast(message, { duration: 2000 });
}
