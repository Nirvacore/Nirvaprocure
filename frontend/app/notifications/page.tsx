'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, MessageCircle, CheckCheck, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useT } from '@/lib/i18n/provider';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { notifications as notificationsApi, type AppNotification } from '@/lib/api';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'approval_needed',
    title: 'PR-2026-0042 รออนุมัติ',
    body: 'Office printer ink x4 — 8,089 ฿',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    ref_id: '1',
  },
  {
    id: 'n2',
    type: 'pr_approved',
    title: 'PR-2026-0041 อนุมัติแล้ว',
    body: 'ถุงมือแล็บ x 200 คู่',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    ref_id: '2',
  },
  {
    id: 'n3',
    type: 'po_created',
    title: 'PO-2026-0018 ออกแล้ว',
    body: 'บริษัท แม็คโคร จำกัด',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    ref_id: 'po-1',
  },
  {
    id: 'n4',
    type: 'stock_low',
    title: 'สต็อกต่ำ: ถุงมือแล็บ M',
    body: 'คงเหลือ 12 คู่ — ต่ำกว่า reorder point',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    ref_id: null,
  },
];

interface NotifPayload {
  items: AppNotification[];
  lineLinked: boolean;
}

const MOCK_PAYLOAD: NotifPayload = { items: MOCK_NOTIFICATIONS, lineLinked: true };

function LineStatusCard({ linked }: { linked: boolean }) {
  const { t } = useT();
  return (
    <Link
      href="/line"
      className={clsx(
        'card flex items-center gap-4 transition-colors',
        linked ? 'hover:border-green-300' : 'hover:border-amber-300',
      )}
    >
      <div className={clsx(
        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
        linked ? 'bg-green-100' : 'bg-amber-100',
      )}>
        <MessageCircle className={clsx('w-6 h-6', linked ? 'text-green-600' : 'text-amber-600')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">
          {linked ? t('notif.line.linked') : t('notif.line.not_linked')}
        </p>
        <p className={clsx(
          'text-xs font-medium mt-0.5',
          linked ? 'text-green-700' : 'text-amber-700',
        )}>
          {linked ? t('notif.line.status.on') : t('notif.line.status.off')}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </Link>
  );
}

function NotificationRow({
  item,
  onTap,
}: {
  item: AppNotification;
  onTap: (item: AppNotification) => void;
}) {
  const { locale } = useT();
  const unread = !item.read_at;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(item.created_at));

  return (
    <button
      type="button"
      onClick={() => onTap(item)}
      className={clsx(
        'w-full text-left card transition-colors hover:border-brand-300 flex items-start gap-3 py-4',
        unread && 'border-brand-200 bg-brand-50/30',
      )}
    >
      <div className={clsx(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
        unread ? 'bg-brand-100' : 'bg-gray-100',
      )}>
        <Bell className={clsx('w-5 h-5', unread ? 'text-brand-600' : 'text-gray-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm', unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
          {item.title}
        </p>
        {item.body && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>}
        <p className="text-xs text-gray-400 mt-1">{when}</p>
      </div>
      {unread && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />}
    </button>
  );
}

export default function NotificationsPage() {
  const { t } = useT();
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [lineLinked, setLineLinked] = useState(false);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(async () => {
      const [notifList, lineStatus] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.lineStatus(),
      ]);
      return { items: notifList, lineLinked: lineStatus.linked };
    }, MOCK_PAYLOAD),
  );

  React.useEffect(() => {
    if (data) {
      setItems(data.items);
      setLineLinked(data.lineLinked);
    }
  }, [data]);

  const list = items ?? [];
  const filtered = useMemo(
    () => (unreadOnly ? list.filter(n => !n.read_at) : list),
    [list, unreadOnly],
  );
  const hasUnread = list.some(n => !n.read_at);

  const navigate = (n: AppNotification) => {
    if (!n.read_at) {
      setItems(prev => (prev ?? []).map(x =>
        x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
      ));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    if (!n.ref_id) {
      if (n.type === 'stock_low') router.push('/stock');
      return;
    }
    switch (n.type) {
      case 'approval_needed':
      case 'pr_approved':
      case 'pr_rejected':
      case 'pr_submitted':
      case 'comment':
        router.push(`/pr/${n.ref_id}`);
        break;
      case 'po_status_changed':
      case 'po_created':
        router.push(`/po/${n.ref_id}`);
        break;
      case 'stock_low':
        router.push('/stock');
        break;
      default:
        break;
    }
  };

  const markAllRead = async () => {
    setItems(prev => (prev ?? []).map(n => ({
      ...n,
      read_at: n.read_at ?? new Date().toISOString(),
    })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      void refresh();
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('notif.heading')}</h1>
        {hasUnread && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4" />
            {t('notif.mark_all_read')}
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}

      <LineStatusCard linked={lineLinked} />

      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="text-lg font-bold">{t('notif.recent')}</h2>
        <button
          type="button"
          onClick={() => setUnreadOnly(v => !v)}
          className={clsx(
            'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
            unreadOnly
              ? 'bg-brand-100 border-brand-300 text-brand-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          )}
        >
          {t('notif.filter.unread_only')}
        </button>
      </div>

      {loading && !items ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>{t('notif.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotificationRow key={n.id} item={n} onTap={navigate} />
          ))}
        </div>
      )}
    </main>
  );
}
