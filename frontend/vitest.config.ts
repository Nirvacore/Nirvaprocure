import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Component specs only; Playwright drives the e2e/ directory.
    include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
