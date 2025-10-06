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

- **JSON** - Locale files with ICU message format support
- **MDX** - Documentation files with frontmatter and content translation

## 🚀 Quick start

### Installation

```bash
npm install langnostic
# or
pnpm add langnostic
# or
yarn add langnostic
```

### Initialize configuration

```bash
npx langnostic init
```

This creates a `langnostic.config.ts` file with default settings:

```typescript
import { openai } from '@ai-sdk/openai';
import JsonPlugin from '@langnostic/plugin-json';
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
      plugin: JsonPlugin(),
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

### JSON locale files

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
- **`packages/plugin-json`** - JSON file format plugin
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
      plugin: JsonPlugin(),
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

- Node.js >= 22
- pnpm >= 10.15.1

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

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter langnostic build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm --filter langnostic test
```

## 📋 Available scripts

- `pnpm build` - Build all packages
- `pnpm dev` - Start development mode
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Biome
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
