import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    projects: ['packages/*/vite.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary', 'json'],
      thresholds: {
        perFile: true,
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    singleQuote: true,
    tabWidth: 2,
    printWidth: 80,
    sortImports: {},
    ignorePatterns: [
      'node_modules',
      '.next',
      '**/.blume*/**',
      'dist',
      'build',
      '**/*.langnostic.json',
    ],
  },
  lint: {
    plugins: ['react', 'jsx-a11y'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      pedantic: 'off',
      nursery: 'off',
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    ignorePatterns: [
      'node_modules',
      '.next',
      '**/.blume*/**',
      'dist',
      'build',
      '**/*.langnostic.json',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
});
