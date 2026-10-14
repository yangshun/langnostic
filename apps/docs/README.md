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

## Deploy to Cloudflare

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
