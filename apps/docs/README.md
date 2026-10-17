# Langnostic documentation

The documentation site uses [Blume](https://useblume.dev/) and the workspace's
Vite+ toolchain. Use Node.js 22.19 or newer; the repository pins Node.js 24.14.0.
Run these commands from the repository root.

```bash
CI=true vp install
vp run docs#dev
```

Open http://localhost:4321 for the homepage and http://localhost:4321/docs for
the documentation.

## Content and navigation

- `content/docs/` contains the documentation pages. `index.mdx` serves `/docs`;
  every other filename serves `/docs/<filename>`.
- `blume.config.ts` sets the site metadata, `/docs` prefix, search, theme, and
  sidebar groups. Pages omitted from the sidebar remain available at their URLs.
- `pages/index.astro` is the homepage, using Blume's full-width `PageLayout`.

The homepage uses the Prism design and follows Blume's light/dark site theme,
including the animated WebGL globe, glowing continent outlines, connection arcs,
and twelve greetings that fade in and out around the globe. Labels are staggered
across six positions on desktop and three on mobile. The map overlay shares the
shader's clock and projection; the greeting animations follow its pause state.
The shader, map overlay, and labels use the same CSS globe frame. At tablet widths
and below, a larger globe sits beneath the copy, with labels positioned inside it.
Natural Earth geography is bundled locally in `components/homepage/geography/`.
Its styles, six illustrated feature cards,
animated translation preview, and shader live in `components/homepage/`.
The feature cards cover workflow timing, ownership, AI providers, incremental
updates, extensibility, and syntax preservation. The preview
shows `en-US.json`, a CLI run, a new `zh-CN.json` file opening in a separate
editor pane, a new source message, a second CLI run, and the updated translation.
The two editor panes sit side by side on desktop and can be swiped between on
mobile. It uses illustrative local strings, not an
AI request. The source edit adds a message ID to match FormatJS change detection.
The file explorer follows the active editor. Pause, replay, and step controls
let visitors inspect the sequence. On mobile, the translated file is shown during
the re-run before its new message appears.
Both animations respect reduced-motion preferences and stop while offscreen
or the browser tab is hidden. The hero keeps a CSS background when WebGL is
unavailable.

The homepage and documentation share the Prism palette: `blume.config.ts` sets
the light/dark accent and background colors, and `theme.css` defines the matching
text, surface, border, and code colors. Homepage styles consume those same tokens.

Use Blume's native `:::info` callouts and `package-install` code fences in MDX.
Keep JSX examples inside fenced code blocks.

The sidebar orders Getting started, Guides, References, Plugins, and Resources.
Guides contains Workflows and Using plugins. References contains CLI,
Configuration, Plugin API, and Utilities. Plugins contains separate FormatJS and
Markdown / MDX pages under `content/docs/plugins/`.

Keep shared plugin setup in Using plugins, format-specific options and behavior
in each plugin's page, and public types, hook contracts, and helpers in References.
Architecture in Resources explains how the runner connects them. Navigation
reordering does not change page URLs. Preserve existing section anchors when
moving detailed content into a new page.

All existing content pages are complete and included in navigation. Removing a
page from the sidebar alone does not make it private or exclude it from search,
the sitemap, or the LLM exports. Keep internal notes out of published content.

The Introduction's licensing section summarizes the source-available and
commercial terms defined in the root `LICENSE` and README. The quick start links
there. Keep that summary aligned with package metadata and packaged `LICENSE`
files.

## Build and validate

```bash
vp run docs#typecheck
vp run docs#validate
vp run docs#build
vp run docs#start
```

The build runs through the cached Vite+ `build:package` task and writes the static
site to `apps/docs/dist/`. `start` previews that production output. Search and the
`/llms.txt` and `/llms-full.txt` exports are generated during the build.

Stop the dev server before a normal build or type check. To check compilation
while keeping it running, use `vp run docs#typecheck --isolated` or
`vp run docs#build --isolated`. Isolated builds write to `.blume-verify/dist/`
and skip production post-processing such as the search index and LLM exports;
run a normal build before testing or publishing those features.

## Deploy to Cloudflare

### Deployment checks

1. Verify installation, peer dependencies, and generated configuration against
   the documented CLI and plugin versions in a clean project.
2. Check that licensing text, package metadata, and legal artifacts match the
   terms for the documented version.
3. Build the matching documentation, including navigation, search, sitemap, and
   Markdown/LLM exports. Check public URLs and installation examples after
   deployment.

### Deployment setup

The production site is served by the `langnostic` Cloudflare Worker at
https://langnostic.com. `www.langnostic.com` redirects to the same path on the
canonical domain. Blume's `deployment.site` sets this origin for canonical URLs,
the sitemap, Open Graph images, and LLM exports.

The `www` redirect is a Cloudflare Single Redirect rule for
`http.host eq "www.langnostic.com"`, with a 301 dynamic redirect to
`concat("https://langnostic.com", http.request.uri.path)` and query string
preservation enabled.
Cloudflare's Always Use HTTPS setting redirects HTTP traffic to HTTPS.

Authenticate from `apps/docs` with the pinned Wrangler CLI. A directory-bound
profile keeps this project's personal account separate from other projects:

```bash
cd apps/docs
vp exec wrangler auth create langnostic
vp exec wrangler auth activate langnostic ../..
vp exec wrangler whoami
```

From the repository root, build and deploy with:

```bash
CI=true vp install --frozen-lockfile
vp run docs#deploy
```

`wrangler.jsonc` pins the Cloudflare account and both custom domains, and uploads
`dist/` as static assets. Documentation URLs have no trailing slash; missing
pages use the generated 404 page. Cloudflare manages the domains' DNS records
and HTTPS certificates.

For Cloudflare Workers Builds, use the repository root as the root directory,
the build command `pnpm --filter docs run build`, and the deploy command
`pnpm --filter docs exec wrangler deploy`. Use the repository's Node.js and pnpm
versions. CI authenticates with `CLOUDFLARE_API_TOKEN`; local directory profiles
are specific to this machine.

The output also works on other static hosts: publish `apps/docs/dist/` and support
directory index pages and the generated `_headers`. Configure the `www` redirect
at the host.
