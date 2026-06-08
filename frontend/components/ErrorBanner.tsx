'use client';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: Props) {
  const { t } = useT();
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold text-red-900 mb-1">{t('common.error')}</div>
        <div className="text-sm text-red-800">{message ?? t('common.error.sub')}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-sm rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold px-4 flex items-center gap-2 whitespace-nowrap">
          <RotateCw className="w-4 h-4" />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
