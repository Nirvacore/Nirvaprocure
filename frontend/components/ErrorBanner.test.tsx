import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from './ErrorBanner';

vi.mock('@/lib/i18n/provider', () => ({
  useT: () => ({
    locale: 'th' as const,
    setLocale: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.error': 'เกิดข้อผิดพลาด',
        'common.error.sub': 'ไม่สามารถโหลดข้อมูลได้',
        'common.retry': 'ลองอีกครั้ง',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('ErrorBanner', () => {
  it('renders default error text when no message given', () => {
    render(<ErrorBanner />);
    expect(screen.getByText('เกิดข้อผิดพลาด')).toBeInTheDocument();
    expect(screen.getByText('ไม่สามารถโหลดข้อมูลได้')).toBeInTheDocument();
  });

  it('renders custom error message', () => {
    render(<ErrorBanner message="ไม่พบข้อมูล" />);
    expect(screen.getByText('ไม่พบข้อมูล')).toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', () => {
    const retry = vi.fn();
    render(<ErrorBanner onRetry={retry} />);
    expect(screen.getByText('ลองอีกครั้ง')).toBeInTheDocument();
  });

  it('calls onRetry when button is clicked', () => {
    const retry = vi.fn();
    render(<ErrorBanner onRetry={retry} />);
    fireEvent.click(screen.getByText('ลองอีกครั้ง'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorBanner />);
    expect(screen.queryByText('ลองอีกครั้ง')).not.toBeInTheDocument();
  });

  it('uses red error palette', () => {
    render(<ErrorBanner />);
    const banner = document.querySelector('.bg-red-50');
    expect(banner).toBeInTheDocument();
  });
});
