import { defineConfig } from 'vitest/config';
import path from 'path';

// Pin TZ=UTC so date-key computations (e.g. toDayKey) are deterministic across
// developer machines and CI. Driving v2 sub-page aggregation buckets shifts by
// (driver, calendar day) — without a fixed TZ, ISO-Z timestamps in tests can
// drift across day boundaries depending on the local zone.
process.env.TZ = 'UTC';

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
