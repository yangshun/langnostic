import { defineConfig } from 'tsdown';

const isDev = process.env.npm_lifecycle_event === 'dev';

export default defineConfig({
  entry: ['./src/index.ts'],
  external: ['langnostic'],
  ignoreWatch: ['.turbo'],
  minify: !isDev,
});
