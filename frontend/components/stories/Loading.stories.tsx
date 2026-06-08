import type { Meta, StoryObj } from '@storybook/react';
import { Loading, SkeletonRows } from '../Loading';

const meta: Meta<typeof Loading> = {
  title: 'Atoms/Loading',
  component: Loading,
};
export default meta;

type Story = StoryObj<typeof Loading>;
export const Default: Story = {};
export const CustomLabel: Story = { args: { label: 'กำลังดึงข้อมูลจาก Shopee...' } };

export const Skeleton: StoryObj = {
  name: 'Skeleton rows',
  render: () => <SkeletonRows rows={3} />,
};
