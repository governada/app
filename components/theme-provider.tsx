'use client';

import * as React from 'react';

type ThemeProviderProps = React.PropsWithChildren<{
  attribute?: string;
  defaultTheme?: string;
  forcedTheme?: string;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  nonce?: string;
}>;

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
