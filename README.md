# Langnostic

Translate FormatJS message catalogs and Markdown documents with your own AI provider, keeping the results in your repository.

## ✨ Features

- 🤖 **AI-powered translation** - Use compatible language models with structured output through AI SDK providers
- 🔌 **Plugin architecture** - Extensible system supporting multiple file formats
- 📦 **Plugin-specific change detection** - Fill missing FormatJS IDs and track changed Markdown blocks with source registries
- ⚡ **Batch processing** - Efficiently processes multiple strings per request
- 🎯 **Format-aware instructions** - Guide the model on syntax and placeholders, then review and validate the generated content
- 🔄 **Concurrent processing** - Configurable parallel translation for faster results
- 🛠️ **Simple CLI** - Easy-to-use command-line interface

## 📦 Supported file formats

- **FormatJS JSON** - React Intl/FormatJS message catalogs with ICU syntax
- **MDX** - Documentation files with frontmatter and content translation

Use `@langnostic/plugin-formatjs` for FormatJS JSON catalogs. Import it as
`FormatJSPlugin`; locale paths use the `.json` extension. Other localization
schemas and formats require a compatible custom plugin.

## 🚀 Quick start

### Install the CLI, plugin, and provider

```bash
npm install langnostic @langnostic/plugin-formatjs @ai-sdk/openai --save-dev
# or
pnpm add langnostic @langnostic/plugin-formatjs @ai-sdk/openai --save-dev
# or
yarn add langnostic @langnostic/plugin-formatjs @ai-sdk/openai --dev
```

### Initialize configuration

```bash
npx langnostic init
```

This creates a `langnostic.config.ts` file with default settings:

```typescript
import { openai } from '@ai-sdk/openai';
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    model: openai('gpt-6.1-sol'),
  },
  groups: [
    {
      name: 'app-strings',
      paths: [
        {
          source: './src/locales/en-US.json',
          target: './src/locales/{locale}.json',
        },
      ],
      plugin: FormatJSPlugin(),
    },
  ],
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN'],
  },
} satisfies ConfigType;
```

### Set up AI provider

Add your AI provider API key to your environment:

```bash
# For OpenAI
export OPENAI_API_KEY="your-api-key"

# For Google AI
export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"
```

### Run translation

```bash
# Translate all untranslated content
npx langnostic translate

# Preview pending file batches and string counts (dry run)
npx langnostic translate --dry-run

# Enable debug mode to see prompts and responses
npx langnostic translate --debug
```

FormatJS fills missing target IDs and removes obsolete IDs. Changes to source text
or descriptions under an existing ID do not trigger retranslation; update the
translation manually or remove the affected target ID before running again.
Dry runs do not print strings or list removal-only maintenance.

## 🎯 Use cases

### FormatJS message catalogs

Perfect for translating application strings with support for:

- ICU message format
- HTML/XML tags
- Template variables
- Pluralization rules

```json
{
  "welcome": {
    "defaultMessage": "Welcome, {username}!",
    "description": "Greeting message for logged-in users"
  },
  "itemCount": {
    "defaultMessage": "{count, plural, =0 {no items} =1 {1 item} other {# items}}",
    "description": "Display count of items"
  }
}
```

### MDX files

Translate document blocks and string-valued frontmatter fields. Commit each
source document's `*.langnostic.json` registry beside the source and target files.
Ignore only the separate `.langnostic/` debug directory.

The plugin sends Markdown, JSX, and code blocks to the model. Review generated
syntax and code examples; preservation is model-dependent. Missing registries or
target block-count changes can trigger full content retranslation.

See [MDX setup and tracking](apps/docs/content/docs/plugins/mdx.mdx)
for options, limitations, and a complete configuration.

## 🏗️ Repository structure

This monorepo contains:

### Core packages

- **`packages/langnostic`** - Main CLI tool and core functionality
- **`packages/plugin-formatjs`** - FormatJS message catalog plugin
- **`packages/plugin-mdx`** - MDX file format plugin
- **`packages/typescript-config`** - Shared TypeScript configurations

### Examples & testing

- **`examples/basic`** - Next.js example integration
- **`apps/test-fixtures`** - Test files and example configurations

## 🔧 Configuration

Langnostic uses a flexible configuration system supporting:

- Multiple AI providers (OpenAI, Google, Anthropic, etc.)
- Custom translation groups
- Plugin-specific options
- Concurrency controls
- Path pattern matching

Example with multiple file types. Install the additional provider and plugin:

```bash
npm install @ai-sdk/google @langnostic/plugin-mdx --save-dev
```

```typescript
import { google } from '@ai-sdk/google';
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import MdxPlugin from '@langnostic/plugin-mdx';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    model: google('gemini-3.8-flash'),
  },
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN', 'pt-BR', 'es-ES'],
  },
  groups: [
    {
      name: 'app',
      plugin: FormatJSPlugin(),
      paths: [
        {
          source: './src/locales/en-US.json',
          target: './src/locales/{locale}.json',
        },
      ],
    },
    {
      name: 'docs',
      plugin: MdxPlugin(),
      paths: [
        {
          source: './docs/en-US/**/*.mdx',
          target: './docs/{locale}/**/*.mdx',
        },
      ],
    },
  ],
} satisfies ConfigType;
```

## 🛠️ Development

### Prerequisites

- Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` (Node 24.14.0 is pinned for development)
- pnpm >= 12.11.2

### Setup

```bash
# Clone the repository
git clone https://github.com/greatfrontend/langnostic.git
cd langnostic

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Building

Vite+ runs workspace tasks and caches builds. Plugin builds, tests, and type checks
build `langnostic` first.

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter langnostic build
```

### Documentation

The documentation site uses Blume and requires Node.js 22.19 or newer.

```bash
vp run docs#dev
vp run docs#typecheck
vp run docs#validate
vp run docs#build
vp run docs#start
```

The homepage is at http://localhost:4321 and documentation is under `/docs`.
See [the docs README](apps/docs/README.md) for content and static hosting details.

### Testing

```bash
# Run all tests
pnpm test

# Measure coverage and enforce 100% for every package source file
vp run test:coverage

# Test the CLI from freshly packed and installed packages
vp run test:integration

# Run tests in watch mode
pnpm --filter langnostic test:watch

# Run tests for specific package
pnpm --filter langnostic test
```

Coverage includes all `packages/*/src/**/*.ts` files except tests. Each file must
have 100% statement, branch, function, and line coverage. The HTML report is
generated at `coverage/index.html`. AI generation tests use a mock model and
do not require provider API keys.

The integration suite builds and packs the three libraries, installs their tarballs
in a temporary consumer project, checks the published types, and runs the real CLI
against FormatJS JSON and MDX files. Installing the consumer's dependencies may require
registry access. Translation requests use a local mock model and need no API keys.
CI runs checks, type checks, coverage, integration tests, documentation validation,
and builds from the repository root.

## 📋 Available scripts

- `pnpm build` - Build all packages
- `pnpm dev` - Start development mode
- `pnpm test` - Run all tests
- `vp run test:coverage` - Run tests with coverage and enforce 100% per file
- `vp run test:integration` - Test the packed CLI and plugins in an isolated consumer
- `pnpm tc` - Type check all libraries
- `pnpm exec vp check` - Check formatting, lint, and types with Vite+
- `pnpm lint` - Lint all packages with Vite+
- `pnpm format` - Format code with Vite+
- `pnpm clean` - Clean all build artifacts

## 🔌 Plugin development

Implement the exported `LangnosticPlugin` type. See the
[complete plain-text plugin example](apps/docs/content/docs/plugin-api.mdx#complete-example)
and [runner architecture](apps/docs/content/docs/architecture.mdx) for current
argument/result shapes.

`getTranslationStrings()` must leave files unchanged. Queue maintenance such as
removals or reordering for the optional `onTranslationStart()` hook, which runs
only on real runs, including runs that need no AI calls. The runner invokes
`onTranslationBatchComplete()` after an entire batch succeeds.

The exported `writeFileAtomic` and `writeJsonAtomic` helpers create parent
directories and replace individual files after their full contents are written.
They do not create a transaction spanning multiple files.

`buildTranslationStrings` accepts normalized `{ string, description? }` source
values, changed IDs per locale, and file metadata. `buildTranslatedContentMap`
groups translated results by locale and ID.

### Development workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

Langnostic is free to use for open-source projects. Commercial projects require
a paid business license. See
[licensing](apps/docs/content/docs/index.mdx#licensing) for commercial terms and
contact details.

Versions distributed under the [MIT license](packages/langnostic/LICENSE) retain
the license terms included with those versions.
