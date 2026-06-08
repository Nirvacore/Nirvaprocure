'use client';
import { Clock, CheckCircle2, XCircle, Pencil, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

export type PrStatus = 'pending' | 'approved' | 'rejected' | 'draft';

// Static config: icon + colors per status. Labels resolve through useT()
// at render time so changing the locale via dropdown updates every pill
// in place without remounting.
const config: Record<PrStatus, { tKey: TranslationKey; icon: LucideIcon; cls: string }> = {
  pending:  { tKey: 'status.pending',  icon: Clock,        cls: 'bg-amber-100 text-amber-800' },
  approved: { tKey: 'status.approved', icon: CheckCircle2, cls: 'bg-green-100 text-green-800' },
  rejected: { tKey: 'status.rejected', icon: XCircle,      cls: 'bg-red-100 text-red-800' },
  draft:    { tKey: 'status.draft',    icon: Pencil,       cls: 'bg-gray-100 text-gray-700' },
};

export function StatusPill({ status }: { status: PrStatus }) {
  const { t } = useT();
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold text-sm whitespace-nowrap ${c.cls}`}>
      <Icon className="w-4 h-4" />
      {t(c.tKey)}
    </span>
  );
}
