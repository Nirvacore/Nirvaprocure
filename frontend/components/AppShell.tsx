'use client';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAuth } from './AuthProvider';

/**
 * Wraps the main content in the standard header + mobile-nav chrome, EXCEPT
 * on auth-public routes (login) where we want a clean full-page layout.
 *
 * Also gates rendering until the auth hydration completes, so users never
 * flash an authenticated view before the route guard redirects them.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Public routes that render their own chrome and DO NOT require auth.
  // Keep this list narrow; everything else goes through the guard below.
  const isAuthPage = pathname === '/login';
  const isPortal   = pathname.startsWith('/portal/');

  if (isAuthPage || isPortal) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  // For protected pages: wait for auth to hydrate, then verify a user is
  // present. If not, AuthProvider has already kicked off a redirect to /login.
  if (loading) return null;
  if (!user) return null;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </>
  );
}
