import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    projects: ['packages/*/vite.config.ts'],
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
      'dist',
      'build',
      '**/*.langnostic.json',
    ],
  },
  lint: {
    plugins: ['react', 'nextjs', 'jsx-a11y'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      pedantic: 'off',
      nursery: 'off',
    },
    rules: {
      'nextjs/no-img-element': 'off',
      'react/react-in-jsx-scope': 'off',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    ignorePatterns: [
      'node_modules',
      '.next',
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
