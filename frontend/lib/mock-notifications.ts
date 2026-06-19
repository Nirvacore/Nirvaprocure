import type { AppNotification } from './api';
import { dictionary, type Locale, type TranslationKey } from './i18n/dictionary';

function label(locale: Locale, key: TranslationKey): string {
  return dictionary[locale][key] ?? key;
}

/** Locale-aware notification fixtures for offline mock fallback. */
export function mockNotifications(locale: Locale): AppNotification[] {
  const now = Date.now();
  return [
    {
      id: 'n1',
      type: 'approval_needed',
      title: label(locale, 'notif.mock.approval.title'),
      body: label(locale, 'notif.mock.approval.body'),
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      read_at: null,
      ref_id: '1',
    },
    {
      id: 'n2',
      type: 'pr_approved',
      title: label(locale, 'notif.mock.approved.title'),
      body: label(locale, 'notif.mock.approved.body'),
      created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      read_at: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      ref_id: '2',
    },
    {
      id: 'n3',
      type: 'po_created',
      title: label(locale, 'notif.mock.po.title'),
      body: label(locale, 'notif.mock.po.body'),
      created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      read_at: null,
      ref_id: 'po-1',
    },
    {
      id: 'n4',
      type: 'stock_low',
      title: label(locale, 'notif.mock.stock.title'),
      body: label(locale, 'notif.mock.stock.body'),
      created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      read_at: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      ref_id: null,
    },
  ];
}
