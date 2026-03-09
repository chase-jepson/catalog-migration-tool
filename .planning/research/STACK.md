# Technology Stack

**Project:** Catalog Migration Tool v2
**Researched:** 2026-03-09

## Recommended Stack

### Chrome Extension Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WXT | ^0.20.18 | Extension build framework | CRXJS nearly got archived in 2025 (narrowly saved by new maintainers). WXT is the consensus best framework for new extension projects: actively maintained, Vite-based, file-based entrypoints, smallest bundle sizes (~400KB vs Plasmo's ~700KB), and has an official React module. Since this is a v2 rewrite (not incremental changes to v1), the migration cost is justified. |
| React | ^19.2.0 | Popup/options UI | Keep from v1. React 19 is current, stable, and the team already knows it. |
| TypeScript | ~5.9.3 | Type safety | Keep from v1. Current version, excellent Chrome API types. |
| Tailwind CSS | ^4.2.1 | Styling | Keep from v1. v4 is current, CSS-first config, excellent for small bundle sizes in extensions. |
| Vite | ^7.3.1 | Build tool (via WXT) | WXT is built on Vite. Keep same version range as v1. |

**Confidence:** HIGH -- React 19 + TypeScript + Tailwind CSS 4 + Vite 7 are all verified current. WXT is verified as the leading extension framework per multiple 2025-2026 comparisons.

### Backend Service

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Hono | ^4.12.5 | HTTP framework | Lightweight (12KB), TypeScript-first, Web Standards-based, 3x faster than Express with 30% less memory than Fastify. Perfect for a focused internal tool -- not overengineered like NestJS, not legacy like Express. Runs on Node.js via @hono/node-server. |
| @hono/node-server | ^1.x | Node.js adapter | Run Hono on standard Node.js -- no exotic runtime needed for an internal tool. |
| better-sqlite3 | ^11.x | Database driver | Synchronous SQLite driver. Zero infrastructure -- no database server to manage. Perfect for an internal tool with low-to-moderate traffic. Single file = trivial backups. |
| Drizzle ORM | ^0.45.1 | Database ORM | Type-safe SQL queries, zero code generation, sync API support for better-sqlite3, lightweight (~50KB). Drizzle mirrors SQLite's native API (all, get, run) so there is no abstraction penalty. |
| drizzle-kit | latest | Migrations | Schema migrations for Drizzle. Push-based workflow for development, migration files for production. |
| Zod | ^3.x | Validation | Runtime schema validation for API inputs. Drizzle has built-in Zod integration for schema-to-validator generation. |

**Confidence:** HIGH -- Hono 4.12.5 verified on npm. Drizzle 0.45.1 verified. better-sqlite3 is the standard synchronous SQLite driver for Node.js.

### File Processing (keep from v1)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PapaParse | ^5.5.3 | CSV parsing | Keep from v1. Battle-tested, handles edge cases (quoted fields, encoding). No reason to change. |
| xlsx (SheetJS) | ^0.18.5 | XLSX parsing | Keep from v1. Standard library for Excel file parsing. Note: the community edition is sufficient. |
| JSZip | ^3.10.1 | ZIP creation | Keep from v1. Used for bundling multiple generated CSVs for download. |
| file-saver | ^2.0.5 | File downloads | Keep from v1. Trigger browser downloads from generated blobs. |

**Confidence:** HIGH -- all verified in existing v1 package.json, all still current and maintained.

### Backend File Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Local filesystem | N/A | Source file storage | For an internal tool, local disk storage is simplest. Store uploaded CSVs/XLSX files in a structured directory (e.g., `./data/uploads/{orgId}/{migrationId}/`). No S3 dependency for the backend's own storage. |
| multer or Hono built-in | N/A | File upload handling | Hono has built-in multipart form parsing. No need for additional upload middleware. |

**Confidence:** MEDIUM -- local filesystem is the simplest choice for an internal tool. If this scales to many concurrent users or needs HA deployment, switch to S3. Flag for phase-specific review.

### S3 Integration (for Treez import pipeline)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @aws-sdk/client-s3 | ^3.x | S3 operations | AWS SDK v3 modular -- only import what you need. Used for presigned URL generation on the backend. |
| @aws-sdk/s3-request-presigner | ^3.x | Presigned URLs | Generate time-limited upload URLs for the Chrome extension to upload generated CSVs directly to S3 (existing Treez import pipeline pattern). |

**Confidence:** HIGH -- AWS SDK v3 is the current standard. Presigned URL pattern matches existing v1 approach.

### Dev Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ESLint | ^9.39.1 | Linting | Keep from v1. Flat config format (v9). |
| typescript-eslint | ^8.48.0 | TS linting | Keep from v1. |
| Vitest | ^3.x | Testing | Vite-native test runner. Same config as build tool, fast, TypeScript out of the box. No separate Jest config needed. |
| @testing-library/react | ^16.x | Component testing | Standard React testing approach. |

**Confidence:** HIGH for ESLint (verified from v1). MEDIUM for Vitest version (standard choice but version not independently verified).

### Monorepo Structure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| npm workspaces | Built-in | Monorepo management | Extension and backend share TypeScript types (migration state schema, API types). npm workspaces is zero-dependency, built into npm 7+. No need for Turborepo/Nx for a 2-package repo. |

**Confidence:** HIGH -- npm workspaces is stable and well-documented.

## Recommended Project Structure

```
catalog-migration-tool/
  packages/
    extension/          # Chrome extension (WXT + React)
      entrypoints/
        popup/          # Main wizard UI
        background/     # Service worker
      components/
      lib/
      wxt.config.ts
    backend/            # Hono API server
      src/
        routes/
        db/
          schema.ts     # Drizzle schema
          migrations/
        services/
      data/
        uploads/        # Source file storage
    shared/             # Shared TypeScript types
      types/
        migration.ts    # Migration state, API contracts
  package.json          # Workspace root
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Extension framework | WXT | CRXJS ^2.3.0 | CRXJS nearly got archived in mid-2025. New maintainers saved it and released v2.0, but WXT has stronger momentum, better docs, smaller bundles, and is the ecosystem consensus pick for new projects. Since v2 is a rewrite anyway, pay the migration cost now. |
| Extension framework | WXT | Plasmo | Plasmo is React-only and opinionated about project structure. WXT is more flexible, produces smaller bundles, and is framework-agnostic (future-proof). |
| Backend framework | Hono | Express | Express is legacy. No built-in TypeScript support, callback-based, large dependency tree. Hono is smaller, faster, and TypeScript-native. |
| Backend framework | Hono | Fastify | Fastify is excellent but heavier than needed. Its plugin ecosystem and advanced features (decorators, hooks) are overkill for this focused internal API. Hono's simplicity matches the project scope. |
| Backend framework | Hono | NestJS | Massively overengineered for an internal tool with ~10 API routes. NestJS is for large team enterprise backends. |
| Database | SQLite + Drizzle | PostgreSQL | PostgreSQL requires running a database server. This is an internal tool used by one team. SQLite is zero-ops, single-file, trivially backed up. If the tool later needs multi-server deployment, migrate to PostgreSQL (Drizzle makes this a driver swap). |
| Database | SQLite + Drizzle | MongoDB | No document DB advantages here. Migration state is relational (org -> migration -> files -> mappings -> validation errors). SQL is the right model. |
| ORM | Drizzle | Prisma | Prisma requires code generation step, has a heavier runtime, and its query engine adds latency. Drizzle is lighter, has no generation step, and its sync API works naturally with better-sqlite3. |
| File storage | Local filesystem | S3 | For an internal tool with few concurrent users, local disk is simpler. No AWS credentials to manage for backend storage. The extension still uploads to S3 for the Treez import pipeline -- that is separate from the backend's own file storage. |
| Testing | Vitest | Jest | Jest requires separate TypeScript configuration (ts-jest or SWC transform). Vitest uses the same Vite config, is faster, and has native ESM support. |
| Monorepo | npm workspaces | Turborepo/Nx | Only 2-3 packages. Turborepo/Nx add complexity and learning curve for minimal benefit at this scale. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| CRXJS (for new project) | Maintenance risk. Nearly archived. WXT is the safer long-term bet for a rewrite. |
| Express | Legacy framework. No TypeScript support, large dependency tree, callback patterns. |
| Prisma | Code generation step, heavy runtime, unnecessary for a lightweight SQLite backend. |
| MongoDB/Mongoose | Wrong data model. Migration data is relational. |
| Redux/Zustand (extension) | Overengineered for extension state. React 19 context + `chrome.storage` (for persistence) + backend API (for cross-session state) covers all needs. |
| Next.js | This is an API-only backend + Chrome extension. No SSR/SSG needed. Hono is the right tool. |
| Docker (for dev) | SQLite + Node.js has zero infrastructure dependencies. Docker adds friction for no benefit during development. Consider for deployment only if needed. |

## Installation

```bash
# Root workspace setup
npm init -w packages/extension -w packages/backend -w packages/shared

# Extension
cd packages/extension
npm install react react-dom papaparse xlsx jszip file-saver
npm install -D wxt @wxt-dev/module-react typescript tailwindcss @tailwindcss/vite \
  @types/react @types/react-dom @types/chrome @types/papaparse @types/file-saver \
  eslint typescript-eslint vitest @testing-library/react

# Backend
cd packages/backend
npm install hono @hono/node-server better-sqlite3 drizzle-orm zod \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D drizzle-kit @types/better-sqlite3 typescript vitest

# Shared types (no runtime deps)
cd packages/shared
npm install -D typescript
```

## Version Verification Log

| Package | Claimed Version | Verification Source | Verified |
|---------|----------------|---------------------|----------|
| React | ^19.2.0 | Existing v1 package.json | YES |
| TypeScript | ~5.9.3 | Existing v1 package.json | YES |
| Vite | ^7.3.1 | Existing v1 package.json | YES |
| Tailwind CSS | ^4.2.1 | Existing v1 package.json | YES |
| WXT | ^0.20.18 | npm registry (WebSearch, 2026-03-06) | YES |
| Hono | ^4.12.5 | npm registry (WebSearch, 2026-03-06) | YES |
| Drizzle ORM | ^0.45.1 | npm registry (WebSearch, 2026-03-09) | YES |
| PapaParse | ^5.5.3 | Existing v1 package.json | YES |
| xlsx | ^0.18.5 | Existing v1 package.json | YES |
| JSZip | ^3.10.1 | Existing v1 package.json | YES |
| file-saver | ^2.0.5 | Existing v1 package.json | YES |
| better-sqlite3 | ^11.x | Training data (MEDIUM confidence) | PARTIAL |
| Vitest | ^3.x | Training data (MEDIUM confidence) | PARTIAL |

## Sources

- [CRXJS maintenance status discussion](https://github.com/crxjs/chrome-extension-tools/discussions/974)
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- [WXT official site](https://wxt.dev/)
- [WXT npm](https://www.npmjs.com/package/wxt)
- [WXT migration guide](https://wxt.dev/guide/resources/migrate.html)
- [Hono official site](https://hono.dev/)
- [Hono npm](https://www.npmjs.com/package/hono)
- [Hono vs Fastify comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)
- [Drizzle ORM SQLite docs](https://orm.drizzle.team/docs/get-started-sqlite)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm)
- [AWS SDK v3 presigned URLs](https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/)
- [Top Chrome Extension Frameworks 2026](https://extensionbooster.com/blog/best-chrome-extension-frameworks-compared/)
