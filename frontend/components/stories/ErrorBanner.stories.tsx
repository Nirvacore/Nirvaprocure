import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBanner } from '../ErrorBanner';

const meta: Meta<typeof ErrorBanner> = {
  title: 'Atoms/ErrorBanner',
  component: ErrorBanner,
};
export default meta;

type Story = StoryObj<typeof ErrorBanner>;

export const Default: Story = {};
export const WithRetry: Story = {
  args: { message: 'เซิร์ฟเวอร์ตอบช้าผิดปกติ', onRetry: () => alert('retried') },
};
export const LongMessage: Story = {
  args: { message: 'การส่งใบขอไม่สำเร็จ เพราะมีรายการที่ราคาน้อยกว่าศูนย์ ลองตรวจอีกครั้ง' },
};
