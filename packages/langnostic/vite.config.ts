import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:package': {
        command: 'vp pack',
        cache: {
          env: ['NODE_ENV'],
          input: [{ auto: true }, '.env*', '!dist/**'],
          output: ['dist/**'],
        },
      },
      typecheck: 'tsc',
      'test:unit': 'vp test run',
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
  },
  pack: {
    format: 'esm',
    dts: true,
    fixedExtension: false,
    entry: ['./src/cli.ts', './src/index.ts'],
    hash: false,
    minify: true,
  },
});
