'use client';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

/**
 * Vertical centered spinner — used inside cards/sections where there's
 * no meaningful skeleton (yet). Skeletons can replace these per-page later.
 */
export function Loading({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <span className="text-base">{label ?? t('common.loading')}</span>
    </div>
  );
}

/**
 * Skeleton rows — used in the PR list / inbox while data is loading.
 */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-soft border border-gray-200 animate-pulse">
          <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-1/3 bg-gray-200 rounded mb-4" />
          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <div className="h-6 w-24 bg-gray-200 rounded-full" />
            <div className="h-6 w-20 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
