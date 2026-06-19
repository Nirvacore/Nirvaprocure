import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill';
import { renderWithI18n } from '@/test/render';

describe('StatusPill', () => {
  it('renders the Thai label for each status', () => {
    const cases: Array<['pending' | 'approved' | 'rejected' | 'draft', string]> = [
      ['pending',  'รออนุมัติ'],
      ['approved', 'อนุมัติแล้ว'],
      ['rejected', 'ไม่อนุมัติ'],
      ['draft',    'ร่าง'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = renderWithI18n(<StatusPill status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies the green palette for approved', () => {
    renderWithI18n(<StatusPill status="approved" />);
    const pill = screen.getByText('อนุมัติแล้ว').closest('span');
    expect(pill?.className).toMatch(/bg-green-100/);
    expect(pill?.className).toMatch(/text-green-800/);
  });

  it('uses different palette for rejected', () => {
    renderWithI18n(<StatusPill status="rejected" />);
    const pill = screen.getByText('ไม่อนุมัติ').closest('span');
    expect(pill?.className).toMatch(/bg-red-100/);
    expect(pill?.className).toMatch(/text-red-800/);
  });
});
