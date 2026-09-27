import type { InboxItem, PrDetail, PrRow } from './mock-data';

export async function loadDemoPrPage(): Promise<{ data: PrRow[]; next_cursor: null }> {
  const { mockPrs } = await import('./mock-data');
  return { data: mockPrs, next_cursor: null };
}

export async function loadDemoPrDetail(id: string): Promise<PrDetail> {
  const { mockDetailById } = await import('./mock-data');
  return mockDetailById[id] ?? mockDetailById['1'];
}

export async function loadDemoApprovalInbox(): Promise<InboxItem[]> {
  const { mockInbox } = await import('./mock-data');
  return mockInbox;
}
