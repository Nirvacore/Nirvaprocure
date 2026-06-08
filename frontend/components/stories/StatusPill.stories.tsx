import type { Meta, StoryObj } from '@storybook/react';
import { StatusPill } from '../StatusPill';

/**
 * Status pills always combine icon + color + label — never any one alone.
 * That's the rule from `/design-system/principles.md` (#2 — color is never
 * the only signal). Every variant is shown together so the design intent
 * stays obvious during review.
 */
const meta: Meta<typeof StatusPill> = {
  title: 'Atoms/StatusPill',
  component: StatusPill,
  argTypes: {
    status: { control: 'select', options: ['pending', 'approved', 'rejected', 'draft'] },
  },
};
export default meta;

type Story = StoryObj<typeof StatusPill>;

export const Pending:  Story = { args: { status: 'pending' } };
export const Approved: Story = { args: { status: 'approved' } };
export const Rejected: Story = { args: { status: 'rejected' } };
export const Draft:    Story = { args: { status: 'draft' } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusPill status="pending"  />
      <StatusPill status="approved" />
      <StatusPill status="rejected" />
      <StatusPill status="draft"    />
    </div>
  ),
};
