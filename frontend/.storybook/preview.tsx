import type { Preview } from '@storybook/react';
import { Inter, Noto_Sans_Thai } from 'next/font/google';
import '../app/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const notoThai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app',   value: '#F9FAFB' },  // gray-50, matches the app shell
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark',  value: '#111827' },  // gray-900
      ],
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
  decorators: [
    (Story) => (
      <div className={`${inter.variable} ${notoThai.variable} font-sans p-6`}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
