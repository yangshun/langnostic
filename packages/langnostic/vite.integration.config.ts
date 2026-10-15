import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    hookTimeout: 180_000,
    testTimeout: 30_000,
    reporters: ['verbose'],
  },
});
