'use client';
import { useInboxCount } from '@/lib/mock-hooks';

export function InboxBadge({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { count, bumped } = useInboxCount();
  if (count === 0) return null;

  // The `bumped` ring fires once each time the count rises, drawing the eye
  // to new inbox items without being annoying on first load.
  const ring = bumped ? 'ring-4 ring-red-300/60' : '';

  if (variant === 'mobile') {
    return (
      <span className={`num absolute top-1 right-4 sm:right-8 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 transition ${ring}`}>
        {count}
      </span>
    );
  }
  return (
    <span className={`num bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-full transition ${ring}`}>
      {count}
    </span>
  );
}
