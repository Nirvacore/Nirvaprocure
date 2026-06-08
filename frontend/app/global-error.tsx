'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Root-level error boundary — catches the catastrophic case where the layout
 * itself throws. Reports to Sentry (if configured) and offers the user a way
 * out (reload + go home).
 */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="th">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-soft border border-gray-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          {/* Bilingual — global-error renders outside the i18n provider so
              we can't use useT(). Thai + English covers the local audience
              and the universal fallback in the catastrophic case. */}
          <h1 className="text-2xl font-bold">เกิดข้อผิดพลาด / Something went wrong</h1>
          <p className="text-base text-gray-600">เราได้รับแจ้งแล้ว ลองรีเฟรชอีกครั้งได้เลย<br/>We have been notified. Please try refreshing.</p>
          {error.digest && (
            <p className="num text-xs text-gray-400">รหัสอ้างอิง / Ref: {error.digest}</p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={reset} className="btn-primary btn-sm px-5">
              <RotateCw className="w-5 h-5" />
              ลองใหม่ / Retry
            </button>
            <Link href="/" className="btn-secondary btn-sm px-5">
              <Home className="w-5 h-5" />
              หน้าหลัก / Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
