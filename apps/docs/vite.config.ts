import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:package': {
        command: 'blume build',
        cache: {
          env: [
            'NODE_ENV',
            'VERCEL',
            'VERCEL_PROJECT_PRODUCTION_URL',
            'VERCEL_URL',
            'NETLIFY',
            'URL',
            'DEPLOY_PRIME_URL',
            'DEPLOY_URL',
          ],
          input: [
            'components/**',
            'content/**',
            'pages/**',
            'public/**',
            '.env*',
            '*.{ts,tsx,mjs,cjs,js,json,css}',
            {
              pattern: 'pnpm-lock.yaml',
              base: 'workspace',
            },
            {
              pattern: 'pnpm-workspace.yaml',
              base: 'workspace',
            },
          ],
          output: ['dist/**'],
        },
      },
    },
  },
});
