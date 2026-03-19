import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'app/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, './app'),
    },
  },
});
