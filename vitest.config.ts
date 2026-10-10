import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const exclude = ['node_modules/**', '.next/**'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': root },
  },
  test: {
    globals: true,
    restoreMocks: true,
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
          testTimeout: 30000,
          exclude,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
          exclude,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
