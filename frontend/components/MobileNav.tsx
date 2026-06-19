'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, Inbox, Building2, Wallet, Scale } from 'lucide-react';
import clsx from 'clsx';
import { InboxBadge } from './InboxBadge';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const items: { href: string; labelKey: TranslationKey; icon: typeof Home }[] = [
  { href: '/',           labelKey: 'nav.home',      icon: Home },
  { href: '/pr',         labelKey: 'nav.pr',        icon: List },
  { href: '/approvals',  labelKey: 'nav.approvals', icon: Inbox },
  { href: '/suppliers',  labelKey: 'nav.suppliers', icon: Building2 },
  { href: '/budget',     labelKey: 'nav.budget',    icon: Wallet },
  { href: '/gov/tor',    labelKey: 'nav.gov',       icon: Scale },
];

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 grid grid-cols-6 px-1 pt-2 pb-3 shadow-lift">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 py-2 rounded-xl relative"
          >
            <Icon className={clsx('w-6 h-6', active ? 'text-brand-700' : 'text-ink-soft')} />
            <span className={clsx('text-xs font-medium', active ? 'text-brand-700' : 'text-ink-soft')}>
              {t(labelKey)}
            </span>
            {href === '/approvals' && <InboxBadge variant="mobile" />}
          </Link>
        );
      })}
    </nav>
  );
}
