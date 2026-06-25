import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Loading, SkeletonRows } from './Loading';

vi.mock('@/lib/i18n/provider', () => ({
  useT: () => ({
    locale: 'th' as const,
    setLocale: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.loading': 'กำลังโหลด...',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('Loading', () => {
  it('renders with default label', () => {
    render(<Loading />);
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<Loading label="กำลังโหลดรายการ" />);
    expect(screen.getByText('กำลังโหลดรายการ')).toBeInTheDocument();
  });

  it('has spinner animation', () => {
    render(<Loading />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('has centered layout', () => {
    render(<Loading />);
    const container = document.querySelector('.flex.flex-col.items-center');
    expect(container).toBeInTheDocument();
  });
});

describe('SkeletonRows', () => {
  it('renders 3 rows by default', () => {
    render(<SkeletonRows />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(3);
  });

  it('renders specified number of rows', () => {
    render(<SkeletonRows rows={5} />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(5);
  });

  it('renders 1 row', () => {
    render(<SkeletonRows rows={1} />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(1);
  });

  it('renders 0 rows when asked', () => {
    render(<SkeletonRows rows={0} />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(0);
  });
});
