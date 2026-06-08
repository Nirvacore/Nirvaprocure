'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, clearToken, setToken, setRefreshToken } from '@/lib/api';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = 'nirva.user';
const PUBLIC_PATHS    = ['/login'];
/** Path prefixes that are fully public (supplier portal, etc). */
const PUBLIC_PREFIXES = ['/portal/'];

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router    = useRouter();
  const pathname  = usePathname();

  // Hydrate session from localStorage on first mount.
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch { /* ignore corrupted user blob */ }
    setLoading(false);
  }, []);

  // Route guard: bounce to /login whenever an unauthenticated user lands on a
  // protected route. Public paths (the login page itself) are allowlisted.
  useEffect(() => {
    if (loading) return;
    const isPublic =
      PUBLIC_PATHS.includes(pathname) ||
      PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    setToken(res.token);
    setRefreshToken(res.refresh_token);
    setUser(res.user);
    try { localStorage.setItem(USER_KEY, JSON.stringify(res.user)); } catch { /* quota */ }
  }, []);

  const logout = useCallback(async () => {
    // Best-effort clear of the server-side httpOnly cookies; we still wipe
    // localStorage so a stale page doesn't keep the user logged in if the
    // call fails (e.g. offline).
    try { await auth.logout(); } catch { /* ignore */ }
    clearToken();
    try { localStorage.removeItem(USER_KEY); } catch { /* quota */ }
    setUser(null);
    router.replace('/login');
  }, [router]);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
