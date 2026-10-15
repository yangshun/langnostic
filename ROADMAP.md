# Implementation roadmap

When implementing a feature, consider the upcoming milestones in this roadmap.
Design interfaces, data models, and module boundaries to accommodate those
features as they are added.

This is the internal implementation plan. The [public roadmap](apps/docs/content/docs/roadmap.mdx)
describes the same milestones for users. Keep milestone scope, order, and status
aligned across both versions. Keep implementation guidance and completion
criteria here, and describe user-facing outcomes on the public page.

The milestones below are ordered by priority, with scope and completion criteria
for each milestone.

## 1. Minimal backend interface and declarative configuration

Give Langnostic a stable foundation for multiple translation backends and
installations outside the JavaScript ecosystem.

Define a small Langnostic-owned translation interface covering messages, locales,
context, instructions, and results. Keep AI SDK behind that interface as the
existing API implementation, preserving support for multiple providers.

Add versioned declarative configuration for backend selection, models,
environment-variable references, locales, translation groups, and plugins. Retain
executable TS/JS configuration as an advanced option and preserve user-supplied
plugins.

**Complete when:** Existing translation workflows work through declarative
configuration, and the core can accept another backend without depending on AI
SDK's public types.

## 2. Project context and glossary

Help translations reflect the project's terminology, audience, and writing style.

Support translation instruction files containing product background, tone,
audience, and locale-specific guidance. Allow instructions to apply globally or to
particular directories and translation groups, with predictable precedence.

Add structured glossaries for terminology, preferred translations, contextual
meanings, and terms that should remain unchanged. Resolve this context within
Langnostic so every backend receives consistent guidance.

Include context and glossary changes in translation change tracking, with a clear
way to identify affected translations and request regeneration.

**Complete when:** Users can influence translations through project files,
understand which guidance applies, and identify translations affected by changes
to that guidance.

## 3. Local CLI translation backends

Let users translate through their installed, authenticated AI CLIs.

Start with one CLI integration, then expand to Claude, Codex, and Gemini. Each
adapter should use the shared translation interface and participate in the same
batching, context, validation, and file-update workflow as API providers.

Provide clear setup guidance and useful errors for missing executables,
authentication problems, usage limits, failed requests, and invalid responses.
Keep translation file updates under Langnostic's control.

**Complete when:** A user can complete a translation run through a supported CLI
using its existing authentication, with the same output checks as an API-backed
run.

## 4. Standalone distribution

Make Langnostic installable and usable without a JavaScript development
environment.

Provide executables for supported macOS, Linux, and Windows platforms. Bundle
common providers and format plugins so the standard workflow requires no
separately installed project dependencies.

Cover installation, upgrades, configuration initialization, and release
automation. Retain the npm distribution for users who prefer it, and verify that
packaged executables support custom plugins.

**Complete when:** A user on a clean machine can install Langnostic, configure a
supported backend, and translate files without installing Node, Bun, npm, or
project dependencies.

## 5. Desktop translation workspace

Provide a local desktop app for configuring projects, managing terminology, and
reviewing translations, using the same engine as the CLI.

Start with a focused workflow: open a project folder, inspect pending
translations, translate selected entries, compare source text and proposed
translations, edit or approve results, and write changes back to the existing
localization files.

Expose project glossaries and translation instructions, show which context applies
to an entry, and provide controls for backend selection, progress, and errors.
Package the app for supported desktop platforms.

Share project configuration, plugins, context resolution, validation, and file
updates with the CLI. Keep the CLI available for scripts, coding agents, and CI so
users can move between both interfaces within the same project.

**Complete when:** A user can open an existing Langnostic project, configure a
supported backend, translate selected entries, review and apply changes through
the desktop app, and continue using the CLI with the same project files.

## 6. More ecosystems, starting with one non-JS integration

Prove that Langnostic fits naturally into localization workflows beyond
JavaScript.

Start with Rails I18n, using a representative project to validate configuration,
translation, incremental updates, and framework compatibility. Expand afterward
to Django/Gettext and Swift/Apple string catalogs.

Each integration should understand its format's localization semantics, including
placeholders, plural forms, context, and metadata. Include ecosystem-specific
documentation and examples that fit existing extraction and build workflows.

**Complete when:** A reference application can consume the generated translations,
subsequent changes translate correctly, and unchanged runs produce stable
results. Apply these criteria separately to each ecosystem.

## 7. Plugin installation and publishing

Make additional integrations easy to distribute, install, and maintain.

Preserve local custom-plugin support throughout earlier milestones. Build on that
with plugin discovery, versioned installation, compatibility checks, explicit
upgrades, and reproducible project configuration.

Provide an authoring SDK, documentation, examples, and validation tools. Define a
packaging contract that lets non-JavaScript users consume compatible plugins
without adopting npm or manually assembling dependencies.

**Complete when:** An independent author can publish a plugin, and another user
can install and use it through declarative configuration with either Langnostic
distribution.

## Quality and workflow requirements

Quality and workflow requirements apply throughout: validate translation
completeness and format constraints, preserve human edits, keep dry runs free of
file changes, write files safely, and maintain reliable source-change detection.
Each milestone should include appropriate tests, documentation, and CI coverage.

## Open implementation decisions

The configuration format, instruction filenames, executable packager, desktop
framework, and plugin distribution mechanism remain open decisions until their
respective milestones.
