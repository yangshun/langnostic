import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:package': {
        command: 'vp pack',
        dependsOn: ['langnostic#build:package'],
        cache: false,
      },
      typecheck: {
        command: 'tsc',
        dependsOn: ['langnostic#build:package'],
        cache: false,
      },
      'test:unit': {
        command: 'vp test run',
        dependsOn: ['langnostic#build:package'],
        cache: false,
      },
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
    deps: {
      neverBundle: ['langnostic'],
    },
    entry: ['./src/index.ts'],
    hash: false,
    minify: true,
  },
});
