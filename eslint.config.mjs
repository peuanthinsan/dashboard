import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['hosting/*.cjs'],
    // Hosting entrypoints and their Node tests intentionally use CommonJS.
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores([
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/.vercel/**',
    'next-env.d.ts',
    '**/node_modules/**',
  ]),
]);

export default eslintConfig;
