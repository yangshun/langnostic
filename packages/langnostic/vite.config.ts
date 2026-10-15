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
      'test:integration': {
        command: 'vp test run --config vite.integration.config.ts',
        dependsOn: [
          'langnostic#build:package',
          '@langnostic/plugin-formatjs#build:package',
          '@langnostic/plugin-mdx#build:package',
        ],
        cache: false,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
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
