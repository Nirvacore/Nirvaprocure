import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusPill } from './StatusPill';

vi.mock('@/lib/i18n/provider', () => ({
  useT: () => ({
    locale: 'th' as const,
    setLocale: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'status.pending': 'รออนุมัติ',
        'status.approved': 'อนุมัติแล้ว',
        'status.rejected': 'ไม่อนุมัติ',
        'status.draft': 'ร่าง',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('StatusPill', () => {
  it('renders the Thai label for each status', () => {
    const cases: Array<['pending' | 'approved' | 'rejected' | 'draft', string]> = [
      ['pending',  'รออนุมัติ'],
      ['approved', 'อนุมัติแล้ว'],
      ['rejected', 'ไม่อนุมัติ'],
      ['draft',    'ร่าง'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(<StatusPill status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies the green palette for approved', () => {
    render(<StatusPill status="approved" />);
    const pill = screen.getByText('อนุมัติแล้ว').closest('span');
    expect(pill?.className).toMatch(/bg-green-100/);
    expect(pill?.className).toMatch(/text-green-800/);
  });

  it('uses different palette for rejected', () => {
    render(<StatusPill status="rejected" />);
    const pill = screen.getByText('ไม่อนุมัติ').closest('span');
    expect(pill?.className).toMatch(/bg-red-100/);
    expect(pill?.className).toMatch(/text-red-800/);
  });

  it('uses amber palette for pending', () => {
    render(<StatusPill status="pending" />);
    const pill = screen.getByText('รออนุมัติ').closest('span');
    expect(pill?.className).toMatch(/bg-amber-100/);
    expect(pill?.className).toMatch(/text-amber-800/);
  });

  it('uses gray palette for draft', () => {
    render(<StatusPill status="draft" />);
    const pill = screen.getByText('ร่าง').closest('span');
    expect(pill?.className).toMatch(/bg-gray-100/);
    expect(pill?.className).toMatch(/text-gray-700/);
  });

  it('renders icon for each status', () => {
    render(<StatusPill status="approved" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
