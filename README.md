# Langnostic

Fast, scalable, and efficient translation system to continuously translate strings within React components + Markdown documents using AI.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ Features

- 🤖 **AI-Powered translation** - Powered by AI with support for any model (OpenAI, Google, Anthropic, and more)
- 🔌 **Plugin architecture** - Extensible system supporting multiple file formats
- 📦 **Smart change detection** - Only translates new or modified content
- ⚡ **Batch processing** - Efficiently processes multiple strings per request
- 🎯 **Format preservation** - Maintains code syntax, HTML tags, and template variables
- 🔄 **Concurrent processing** - Configurable parallel translation for faster results
- 🛠️ **Simple CLI** - Easy-to-use command-line interface

## 📦 Supported file formats

- **FormatJS JSON** - React Intl/FormatJS message catalogs with ICU syntax
- **MDX** - Documentation files with frontmatter and content translation

`@langnostic/plugin-formatjs` replaces `@langnostic/plugin-json`. Update your
dependency and import it as `FormatJSPlugin`; locale file paths remain `.json`.

## 🚀 Quick start

### Installation

```bash
npm install langnostic @langnostic/plugin-formatjs
# or
pnpm add langnostic @langnostic/plugin-formatjs
# or
yarn add langnostic @langnostic/plugin-formatjs
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
    model: openai('gpt-4'),
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
    target: ['zh-CN', 'es-ES', 'fr-FR'],
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

# Preview what would be translated (dry run)
npx langnostic translate --dry-run

# Enable debug mode to see prompts and responses
npx langnostic translate --debug
```

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

Ideal for translating documentation sites while preserving:

- Frontmatter metadata
- Code blocks
- JSX components
- Markdown formatting

```mdx
---
title: Getting Started
description: Learn how to use our platform
---

# Getting Started

Welcome to our platform! Here's how to get started:

<CustomComponent prop="value" />
```

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

Example with multiple file types:

```typescript
export default {
  ai: {
    model: google('gemini-1.5-pro'),
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
          source: './docs/**/**/en-US.mdx',
          target: './docs/**/**/{locale}.mdx',
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

Create custom plugins to support additional file formats:

```typescript
import type { LangnosticPlugin } from 'langnostic';

export default function MyPlugin(): LangnosticPlugin {
  return {
    type: 'my-format',
    stringsPerRequest: 50,

    async trackFiles(filesMetadata) {
      // Track files for translation
    },

    async getTranslationStrings() {
      // Return strings that need translation
      return translationStrings;
    },

    async onTranslationBatchComplete(translatedStrings) {
      // Handle completed translations
    },

    async getInstructions() {
      // Return AI-specific instructions for this format
      return 'Custom instructions for translating this format...';
    },
  };
}
```

`getTranslationStrings()` must leave files unchanged. Queue maintenance such as
removals or reordering for an optional `onTranslationStart()` hook, which runs only
on real runs, including runs that need no AI calls. The exported `writeFileAtomic`
and `writeJsonAtomic` helpers create parent directories and replace files only
after their full contents have been written.

The exported `buildTranslationStrings` helper accepts a map from message IDs to
normalized `{ string, description? }` values, a map of changed IDs per target
locale, and the file metadata. Plugins interpret their own source schemas before
calling it; the helper adds the source locale, batch ID, and target locales.

### Development workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](packages/langnostic/LICENSE) file for details.
