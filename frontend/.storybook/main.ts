import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  framework: { name: '@storybook/nextjs', options: {} },
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  staticDirs: ['../public'],
  typescript: { check: false, reactDocgen: 'react-docgen-typescript' },
};
export default config;
