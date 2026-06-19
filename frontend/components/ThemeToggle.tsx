'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useT } from '@/lib/i18n/provider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useT();
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? t('a11y.theme.light') : t('a11y.theme.dark')}
      className="min-h-[44px] w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-ink-soft dark:text-gray-200 flex items-center justify-center flex-shrink-0"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
