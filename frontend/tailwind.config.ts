import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  // Tailwind toggles `dark:` variants from `html.dark` instead of a media
  // query. ThemeProvider is the single source of truth for the class.
  darkMode: 'class',
  theme: {
    extend: {
      // Design tokens — see /design-system/principles.md for the rationale.
      fontFamily: {
        sans: ['var(--font-noto-thai)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        num:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(17,24,39,0.04), 0 4px 12px rgba(17,24,39,0.06)',
        lift: '0 4px 6px rgba(17,24,39,0.05), 0 12px 24px rgba(17,24,39,0.08)',
      },
      minHeight: {
        // Big tap targets — see principles doc.
        btn:    '56px',
        'btn-sm': '44px',
      },
      fontSize: {
        // 18px body baseline (vs Tailwind's 16px default).
        base: ['1.125rem', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
};
export default config;
