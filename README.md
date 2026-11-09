# Langnostic

**Ship in more languages.** Translate your app and docs with your choice of AI.
Review the changes and commit translations alongside your code.

[Website](https://langnostic.com) · [Documentation](https://langnostic.com/docs) ·
[Quick start](https://langnostic.com/docs/quick-start)

Langnostic is a CLI for translating localization files and documentation before
you build or deploy your application. Use the generated files with your existing
i18n runtime and development workflow.

## Why Langnostic?

- **Translate only the changes** - Reuse existing translations. Fill missing
  FormatJS message IDs and translate updated Markdown/MDX blocks with source
  registries.
- **Keep your syntax intact** - Give AI instructions to preserve Markdown, HTML,
  placeholders, and inline code. Review and validate generated syntax before
  shipping.
- **Bring your own AI** - Choose OpenAI, Anthropic, Google, or an OpenAI-compatible
  endpoint and a model that fits your content and budget.
- **Add the formats you need** - Start with FormatJS and Markdown/MDX. Build a
  custom plugin for other file formats.
- **Translate when you're ready** - Run on demand, after a commit, or before a
  release. Configure translation in your development or CI workflow.
- **Keep translations in Git** - Review, edit, and commit translations alongside
  your code, then use the files with your existing tools.

## Supported file formats

| Format                                                        | Plugin                        | Supported content                                                                                                     |
| ------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [FormatJS JSON](https://langnostic.com/docs/plugins/formatjs) | `@langnostic/plugin-formatjs` | Flat message-ID maps with strings or descriptors containing `defaultMessage` and `description`, including ICU syntax. |
| [Markdown / MDX](https://langnostic.com/docs/plugins/mdx)     | `@langnostic/plugin-mdx`      | `.md` and `.mdx` document blocks and translatable frontmatter fields.                                                 |

Install plugins separately from the CLI. Other localization schemas and file
formats, including nested JSON catalogs, require a compatible custom plugin.

## Quick start

Use Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` and an AI provider account with
a model that supports structured translation output.

### Install the CLI and plugin

```bash
npm install langnostic @langnostic/plugin-formatjs --save-dev
# or
pnpm add langnostic @langnostic/plugin-formatjs --save-dev
# or
yarn add langnostic @langnostic/plugin-formatjs --dev
```

### Initialize configuration

```bash
npx langnostic init
```

If no project configuration exists, this creates `langnostic.config.ts`:

```typescript
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    provider: 'openai',
    model: 'gpt-6.1-sol',
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

Change the paths and target locales to match your project. Create the source
catalog at `src/locales/en-US.json` before translating:

```json
{
  "welcome": {
    "defaultMessage": "Welcome, {username}!",
    "description": "Greeting for a signed-in user"
  }
}
```

For a plain JSON configuration, run `npx langnostic init --format json`. See
[JSON configuration](https://langnostic.com/docs/configuration#json-configuration)
for plugin module references and environment-variable settings.

### Configure your AI provider

Add your key to a `.env` file in the directory where you run the command:

```bash
OPENAI_API_KEY="your-api-key"
```

The CLI loads `.env` automatically. Keep credentials out of version control.
Provider adapters are included with Langnostic; no provider package installation
is needed. See [AI settings](https://langnostic.com/docs/configuration#ai-settings)
for Anthropic, Google, custom endpoints, and local servers.

### Translate and review

```bash
# Preview pending file batches and string counts (dry run)
npx langnostic translate --dry-run

# Translate pending content
npx langnostic translate

# Save prompts and responses for a real translation run
npx langnostic translate --debug
```

With the configuration above, translations are written to
`src/locales/zh-CN.json`. Review the diff and validate ICU syntax, placeholders,
and markup before committing. See [Workflows](https://langnostic.com/docs/workflows)
for review and CI integration.

FormatJS fills missing target IDs and removes obsolete IDs. Changes to source text
or descriptions under an existing ID do not trigger retranslation; update the
translation manually or remove the affected target ID before running again.
Dry runs do not print strings or list removal-only maintenance.

Add debug output to your `.gitignore`:

```gitignore
.langnostic/
```

Keep translation files and MDX `*.langnostic.json` registries in version control.

## Use cases

### FormatJS message catalogs

Translate application message catalogs containing:

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

### Markdown / MDX files

Translate document blocks and string-valued frontmatter fields. Commit each
source document's `*.langnostic.json` registry beside the source and target files.
Ignore only the separate `.langnostic/` debug directory.

The plugin sends Markdown, JSX, and code blocks to the model. Review generated
syntax and code examples; preservation is model-dependent. Missing registries or
target block-count changes can trigger full content retranslation.

See [Markdown / MDX setup and tracking](https://langnostic.com/docs/plugins/mdx)
for options, limitations, and a complete configuration.

## Repository structure

This monorepo contains:

### Core packages

- **`packages/langnostic`** - Main CLI tool and core functionality
- **`packages/plugin-formatjs`** - FormatJS message catalog plugin
- **`packages/plugin-mdx`** - Markdown/MDX file format plugin
- **`packages/typescript-config`** - Shared TypeScript configurations

### Documentation & testing

- **`apps/docs`** - Website and documentation, built with Blume
- **`apps/test-fixtures`** - Test files and example configurations

## Configuration

Configure Langnostic with `langnostic.config.ts`, `langnostic.config.js`, or
`langnostic.json`. Configuration supports:

- OpenAI, Anthropic, Google, and OpenAI-compatible endpoints
- Custom translation groups
- Plugin-specific options
- Concurrency controls
- Path pattern matching

Example with multiple file types. Install the additional plugin:

```bash
npm install @langnostic/plugin-mdx --save-dev
```

```typescript
import FormatJSPlugin from '@langnostic/plugin-formatjs';
import MdxPlugin from '@langnostic/plugin-mdx';
import type { ConfigType } from 'langnostic';

export default {
  ai: {
    provider: 'openai',
    model: 'gpt-6.1-sol',
  },
  localeConfig: {
    source: 'en-US',
    target: ['zh-CN', 'pt-BR', 'es-ES'],
  },
  groups: [
    {
      name: 'app-strings',
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
      plugin: MdxPlugin({ frontmatterExcludedKeys: ['slug', 'date', 'tags'] }),
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

Create a separate plugin instance for each group. `frontmatterExcludedKeys` keeps
fields such as slugs, dates, and tags out of translation requests.

Supported providers are `openai` (Responses), `anthropic` (Messages), `google`
(GenerateContent), and `openai-compatible` (Chat Completions). Model IDs are
freeform strings. Langnostic includes all four adapters.

For a local OpenAI-compatible server:

```typescript
ai: {
  provider: 'openai-compatible',
  model: 'your-local-model',
  baseURL: 'http://localhost:1234/v1',
}
```

`apiKey`, `baseURL`, `headers`, `parameters`, `temperature`, and `topP` are optional,
except `baseURL` is required for `openai-compatible`. Native providers use their
standard credentials and endpoints. Use `openai` with a `baseURL` override for
custom Responses endpoints. `parameters` adds native request fields while
preserving generated input and output schemas.

See the [configuration guide](https://langnostic.com/docs/configuration)
for environment references, request parameters, and plugin settings.

## Development

### Prerequisites

- Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` (Node 24.14.0 is pinned for development)
- Vite+ (`vp`); the repository pins pnpm 12.11.2 for package management

### Setup

```bash
# Clone the repository
git clone https://github.com/yangshun/langnostic.git
cd langnostic

# Install dependencies
vp install

# Build all packages
vp run build

# Run tests
vp run test

# Start development mode
vp run dev
```

### Building

Vite+ runs workspace tasks and caches builds. Plugin builds, tests, and type checks
build `langnostic` first.

Library type checks use [tsrs](https://github.com/oxc-project/tsrs) with the
existing strict TypeScript configurations. Run `vp run tc` to check all libraries
and the documentation site, or `vp run langnostic#typecheck` to check one library.
The docs use Blume's Astro checker. TypeScript remains installed for declaration
builds, Astro tooling, and the integration test of published types. Vite+ also
retains its built-in type-aware linting and type checks in `vp check`.
The pinned tsrs release supports macOS arm64 and Linux x64/arm64. See the
[typechecking benchmark](benchmarks/typecheck.md) for measured time and memory.

```bash
# Build all packages
vp run build

# Build specific package
vp run langnostic#build
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
vp run test

# Measure coverage and enforce 100% for every package source file
vp run test:coverage

# Test the CLI from freshly packed and installed packages
vp run test:integration

# Run tests in watch mode
vp run langnostic#test:watch

# Run tests for specific package
vp run langnostic#test
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

## Available scripts

- `vp run build` - Build all packages
- `vp run dev` - Start development mode
- `vp run test` - Run all tests
- `vp run test:coverage` - Run tests with coverage and enforce 100% per file
- `vp run test:integration` - Test the packed CLI and plugins in an isolated consumer
- `vp run tc` - Type check libraries with tsrs and docs with Blume
- `vp check` - Check formatting, lint, and types with Vite+
- `vp run lint` - Lint all packages with Vite+
- `vp run format` - Format code with Vite+
- `vp run clean` - Clean all build artifacts

## Plugin development

Implement the exported `LangnosticPlugin` type. See the
[complete plain-text plugin example](https://langnostic.com/docs/plugin-api#complete-example)
and [runner architecture](https://langnostic.com/docs/architecture) for current
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
4. Run checks and tests: `vp check` and `vp run test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

Langnostic is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use and the other
uses expressly permitted by that license are free. Commercial use outside those
permissions requires a paid business license covering the CLI and both official
plugins. Contact [team@greatfrontend.com](mailto:team@greatfrontend.com) for terms
and pricing.

Langnostic's software license does not impose licensing terms on your input
content or translations. AI provider usage is a separate cost.

The same license applies to all first-party code, shared configuration, examples,
and documentation in this repository. Third-party dependencies retain their own
licenses.

Required Notice: Copyright (c) 2025-2026 Yangshun Tay
