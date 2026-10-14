import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:package': {
        command: 'next build',
        cache: {
          env: ['NODE_ENV', 'NEXT_PUBLIC_*'],
          input: [
            'src/**',
            'content/**',
            'public/**',
            '.source/**',
            '.env*',
            '*.{ts,tsx,mjs,cjs,js,json}',
            {
              pattern: 'pnpm-lock.yaml',
              base: 'workspace',
            },
            {
              pattern: 'pnpm-workspace.yaml',
              base: 'workspace',
            },
            {
              pattern: 'packages/typescript-config/**',
              base: 'workspace',
            },
          ],
          output: ['.next/**', '!.next/cache/**'],
        },
      },
    },
  },
});
