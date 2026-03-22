'use client';

import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Observatory-specific error boundary that captures and displays the actual
 * error message for debugging. Falls back to a per-panel recovery UI
 * so one broken panel doesn't crash the whole Observatory.
 */
export class ObservatoryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    logger.error('Observatory render error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message ?? 'Unknown error';
      const errorStack = this.state.error?.stack ?? '';

      return (
        <div className="px-4 py-6 space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-amber-400">
              Observatory encountered an error
            </h3>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            <pre className="text-[10px] text-muted-foreground/60 font-mono overflow-x-auto max-h-32 whitespace-pre-wrap">
              {errorStack.split('\n').slice(0, 8).join('\n')}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
