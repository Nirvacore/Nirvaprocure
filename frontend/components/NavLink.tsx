'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={clsx(
        'min-h-[44px] px-4 py-2 rounded-lg text-base font-medium whitespace-nowrap inline-flex items-center',
        active ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100',
      )}
    >
      {children}
    </Link>
  );
}
