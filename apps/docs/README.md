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
- `components/Announcement.astro` is shared by the homepage and documentation
  header. The header override is registered in `components.ts`.

Use Blume's native `:::info` callouts and `package-install` code fences in MDX.
Keep JSX examples inside fenced code blocks.

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

## Static hosting

Set the host's project root to `apps/docs`, install dependencies from the
repository root with `CI=true vp install --frozen-lockfile`, run
`vp run build`, and publish `dist/`. Select a static site or Other
framework preset and Node.js 22.19 or newer.

Blume detects the site origin on Vercel and Netlify. For another host, set
`deployment: { site: 'https://your-domain.example' }` in `blume.config.ts` to
generate canonical URLs, a sitemap, and Open Graph images for the correct origin.
No production domain is hardcoded in this repository.
