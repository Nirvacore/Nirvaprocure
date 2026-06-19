'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n/provider';

function LoginInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const { login } = useAuth();
  const { t } = useT();

  const [email, setEmail]       = useState('suda@nirva.co.th');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(params.get('next') ?? '/');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401
        ? t('login.bad')
        : t('login.err'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lift p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">{t('login.heading')}</h1>
          <p className="text-sm text-ink-soft">{t('login.sub')}</p>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="login-email" className="block font-semibold mb-2 text-base">{t('login.email')}</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block font-semibold mb-2 text-base">{t('login.password')}</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {busy ? t('login.busy') : t('login.submit')}
          </button>
        </form>

        <div className="text-center text-xs text-ink-muted pt-3 border-t border-line">
          {t('login.hint')}: <code className="font-mono">suda@nirva.co.th</code> / <code className="font-mono">password123</code>
        </div>

        <div className="text-center text-xs text-ink-muted pt-2">
          <a href="/privacy" className="text-ink-soft hover:text-brand-700 underline">
            {t('privacy.title')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
