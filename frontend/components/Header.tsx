'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Settings, LogOut } from 'lucide-react';
import { NavLink } from './NavLink';
import { InboxBadge } from './InboxBadge';
import { useAuth } from './AuthProvider';
import { useT } from '@/lib/i18n/provider';
import { LangSwitch } from './LangSwitch';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const initial = user?.full_name?.[0] ?? '?';
  const dept    = user?.email ?? '';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 font-bold text-base sm:text-xl text-gray-900 flex-shrink-0 -ml-1 p-1 rounded-lg">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <span>NIRVAPROCURE</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4 whitespace-nowrap">
          <NavLink href="/">{t('nav.home')}</NavLink>
          <NavLink href="/pr">{t('nav.pr')}</NavLink>
          <NavLink href="/approvals">
            <span className="flex items-center gap-2">
              {t('nav.approvals')}
              <InboxBadge />
            </span>
          </NavLink>
          <NavLink href="/suppliers">{t('nav.suppliers')}</NavLink>
          <NavLink href="/po">{t('nav.po')}</NavLink>
          <NavLink href="/budget">{t('nav.budget')}</NavLink>
        </nav>

        <div className="flex-1" />

        <ThemeToggle />
        <LangSwitch />

        <Link
          href="/settings"
          aria-label={t('nav.settings')}
          className="min-h-[44px] w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0"
        >
          <Settings className="w-5 h-5" />
        </Link>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 sm:pl-3 sm:border-l border-gray-200 whitespace-nowrap flex-shrink-0 min-h-[44px] rounded-lg"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
              {initial}
            </div>
            <div className="hidden lg:block leading-tight text-left">
              <div className="font-semibold text-sm">{user?.full_name ?? ''}</div>
              <div className="text-xs text-gray-500">{dept}</div>
            </div>
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lift border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="font-semibold truncate">{user?.full_name}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-red-700 font-medium"
                role="menuitem"
              >
                <LogOut className="w-5 h-5" />
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
