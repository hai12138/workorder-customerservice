import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30000,
    setupFiles: ['./test/setup.ts'],
    pool: 'forks',
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
