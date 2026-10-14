import { defineConfig } from 'vite-plus';
import tsconfigPaths from 'vite-tsconfig-paths';

const isDev = process.env.npm_lifecycle_event === 'dev';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
  },
  pack: {
    format: 'esm',
    dts: true,
    fixedExtension: false,
    entry: ['./src/cli.ts', './src/index.ts'],
    hash: false,
    ignoreWatch: ['.turbo'],
    minify: !isDev,
  },
});
