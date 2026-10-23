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
        command: 'tsrs --noEmit',
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
    dts: {
      // Vite+ 1.2 only auto-detects TypeScript 7.0.
      generator: 'tsgo',
      tsgo: { path: 'tsc' },
    },
    fixedExtension: false,
    deps: {
      neverBundle: ['langnostic'],
    },
    entry: ['./src/index.ts'],
    hash: false,
    minify: true,
  },
});
