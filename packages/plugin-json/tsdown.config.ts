import { defineConfig } from 'tsdown';

const isDev = process.env.npm_lifecycle_event === 'dev';

export default defineConfig({
  entry: ['./src/index.ts'],
  minify: !isDev,
  external: ['langnostic'],
});
