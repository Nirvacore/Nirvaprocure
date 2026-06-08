'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeCtx = createContext<Ctx | null>(null);
const COOKIE  = 'nirva.theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Theme resolution order:
 *   1. cookie `nirva.theme` (explicit user choice — persists across visits)
 *   2. prefers-color-scheme on first visit
 *   3. default 'light'
 *
 * We flip `html.dark` rather than re-render every consumer — the CSS-variable
 * approach in globals.css repaints automatically.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const fromCookie = readCookie(COOKIE);
    if (fromCookie === 'dark' || fromCookie === 'light') {
      apply(fromCookie);
      setThemeState(fromCookie);
      return;
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial: Theme = prefersDark ? 'dark' : 'light';
    apply(initial);
    setThemeState(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    apply(t);
    setThemeState(t);
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE}=${t}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
