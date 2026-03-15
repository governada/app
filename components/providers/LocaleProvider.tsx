'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type SupportedLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  RTL_LOCALES,
  isValidLocale,
} from '@/lib/i18n/config';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

const LocaleContext = createContext<LocaleState>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

/** Read a cookie value by name from document.cookie */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Set a cookie */
function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};samesite=lax`;
}

/** Sync lang and dir attributes on the <html> element */
function syncHtmlAttributes(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  // Read locale from cookie on mount
  useEffect(() => {
    const cookieVal = getCookie(LOCALE_COOKIE);
    if (cookieVal && isValidLocale(cookieVal)) {
      setLocaleState(cookieVal);
      syncHtmlAttributes(cookieVal);
    }
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    setCookie(LOCALE_COOKIE, newLocale, LOCALE_COOKIE_MAX_AGE);
    syncHtmlAttributes(newLocale);
  }, []);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}
