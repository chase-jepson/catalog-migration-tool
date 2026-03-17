# Contributing

## Setup

Requires **Node.js 20+** and **pnpm**.

```bash
git clone https://gitlab.com/chase_jepson/catalog-migration-tool-v2.git
cd catalog-migration-tool-v2
pnpm install
```

## Development

```bash
pnpm dev        # Start dev mode with hot reload
pnpm build      # Production build
pnpm test       # Run tests
pnpm test:watch # Run tests in watch mode
pnpm typecheck  # TypeScript type checking
```

Load the extension from `.output/chrome-mv3-dev/` (dev) or `.output/chrome-mv3/` (prod build) via `chrome://extensions/` with Developer mode enabled.

## Submitting Changes

1. Create a branch from `main`
2. Make your changes and add tests
3. Run `pnpm test` and `pnpm typecheck` to verify nothing breaks
4. Open a merge request using the default template
5. Update CHANGELOG.md if the change is user-facing

## Project Structure

```
entrypoints/           # Chrome extension entrypoints (background, content scripts)
components/            # React UI components (wizard steps, shared controls)
lib/                   # Core logic (ETL pipelines, transformers, validators)
tests/                 # Vitest test suites
docs/                  # User-facing documentation
public/                # Static assets (icons)
```
