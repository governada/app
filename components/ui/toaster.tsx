'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Governada toast container — renders Sonner toasts styled to
 * match the dark-only Compass design language.
 *
 * Drop this once in the root layout (or Providers) and call
 * `toast()` / `toast.success()` / `toast.error()` from anywhere.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className: 'bg-card text-card-foreground border border-border shadow-lg rounded-lg text-sm',
        duration: 2000,
        style: {
          // Map to Compass CSS custom properties so the toast inherits
          // the dark theme automatically.
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
        },
      }}
      visibleToasts={3}
    />
  );
}
