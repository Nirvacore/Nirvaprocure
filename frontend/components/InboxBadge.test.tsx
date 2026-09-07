import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  approvals: { inbox: vi.fn().mockRejectedValue(new Error('unavailable')) },
  ApiError: class ApiError extends Error {},
}));

import { InboxBadge } from './InboxBadge';

describe('InboxBadge', () => {
  it('does not show a demo inbox count when the backend is unavailable', () => {
    render(<InboxBadge />);
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});
