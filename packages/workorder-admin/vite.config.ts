import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
})
