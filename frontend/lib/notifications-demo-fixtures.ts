import type { AppNotification } from './api';
import type { Locale } from './i18n/dictionary';

/** Load locale-aware notification fixtures only after local demo opt-in. */
export async function loadDemoNotifications(locale: Locale): Promise<AppNotification[]> {
  const { mockNotifications } = await import('./mock-notifications');
  return mockNotifications(locale);
}
