import './globals.css';
import type { Metadata } from 'next';
import {
  Inter, Noto_Sans_Thai, Noto_Sans_SC, Noto_Sans_JP,
  Noto_Sans, Noto_Sans_Myanmar, Noto_Sans_Khmer,
} from 'next/font/google';
import { Header } from '@/components/Header';
import { MobileNav } from '@/components/MobileNav';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { CookieConsent } from '@/components/CookieConsent';
import { I18nProvider } from '@/lib/i18n/provider';
import { ThemeProvider } from '@/components/ThemeProvider';

// Load every script we serve, each on its own CSS variable. The body picks
// the right stack based on `html.lang`. This keeps any one locale's
// font payload small — the browser only downloads what's referenced.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const notoThai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});
const notoSc = Noto_Sans_SC({
  subsets: ['latin'],   // Chinese glyphs come from the font's default subset
  weight: ['400', '500', '700'],
  variable: '--font-noto-sc',
  display: 'swap',
});
const notoJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-jp',
  display: 'swap',
});
// Vietnamese + Indonesian are Latin — Noto Sans (Latin Extended) covers them.
const notoLatin = Noto_Sans({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-latin',
  display: 'swap',
});
const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ['myanmar'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-my',
  display: 'swap',
});
const notoKhmer = Noto_Sans_Khmer({
  subsets: ['khmer'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-km',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NIRVAPROCURE — AI Procurement OS',
  description: 'AI-powered procurement OS — Shopee, Lazada, Makro, Alibaba and your ERP in one place',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    inter.variable, notoThai.variable, notoSc.variable, notoJp.variable,
    notoLatin.variable, notoMyanmar.variable, notoKhmer.variable,
  ].join(' ');
  return (
    <html lang="th" className={fontVars}>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>
                <AppShell>{children}</AppShell>
                {/* Cookie consent banner — rendered outside AppShell so it
                    shows on the public privacy/portal pages too. Self-hides
                    once the user makes a decision. */}
                <CookieConsent />
              </AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
