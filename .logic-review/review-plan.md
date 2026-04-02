# Catalog Logic Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a repeatable local review workflow that transforms every catalog export in `.test-data/exports/catalog`, scores each transformed product by confidence with emphasis on category and amount/THC/UOM correctness, and generates a static HTML site in `.logic-review/` for before/after review in Chrome.

**Architecture:** Reuse the existing local ETL path in `dev/run-catalog-etl.ts` and the current review-artifact pattern in `dev/generate-review-page.ts`, but move the workflow into a dedicated `.logic-review/` pipeline. The implementation should produce a structured JSON review dataset plus a standalone HTML file that sorts lowest-confidence products first and makes the scoring rationale visible per row.

**Tech Stack:** TypeScript, Node 20, existing parser/transformer/validator modules, static HTML generation, pnpm scripts

---

### Task 1: Define the local review artifact contract

**Files:**
- Create: `.logic-review/README.md`
- Create: `.logic-review/schema.md`
- Reference: `dev/run-catalog-etl.ts`
- Reference: `dev/generate-review-page.ts`
- Reference: `lib/transformer.ts`
- Reference: `lib/validator.ts`

**Step 1: Write the contract doc**

Document:
- input folder root: `.test-data/exports/catalog`
- output folder root: `.logic-review/output`
- per-run outputs:
  - `review-data.json`
  - `index.html`
  - copied source metadata if needed
- one review row shape:
  - source file path
  - row index
  - original source row
  - derived row
  - detected POS
  - confidence score
  - confidence reasons
  - validation errors/warnings
  - category-focused risk fields
  - amount/THC/UOM-focused risk fields

**Step 2: Define score semantics**

Write the initial scoring rules in `.logic-review/schema.md`:
- start from `100`
- subtract heavily for:
  - missing/weak category resolution
  - fallback category resolution
  - suspicious amount parsing
  - suspicious UOM for category
  - THC/CBD source present but transformed value missing or implausible
- subtract moderately for:
  - missing subcategory
  - classification mismatch
  - non-standard status
- expose every deduction as a machine-readable reason

**Step 3: Commit**

```bash
git add .logic-review/README.md .logic-review/schema.md
git commit -m "Define catalog logic review artifact contract"
```

### Task 2: Extract confidence scoring into a reusable module

**Files:**
- Create: `lib/catalog-review-score.ts`
- Test: `tests/catalog-review-score.test.ts`
- Reference: `dev/run-catalog-etl.ts`
- Reference: `lib/transformer.ts`
- Reference: `lib/validator.ts`

**Step 1: Write the failing test**

Cover:
- category fallback rows score lower than direct category matches
- Flower rows with non-gram UOM score lower
- Edible rows with suspicious amount score lower
- rows with source THC but blank transformed THC score lower
- score reasons include exact deduction labels

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/catalog-review-score.test.ts --reporter=verbose`

Expected: FAIL because the scoring module does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- exported `scoreCatalogReviewRow(...)`
- deterministic numeric score
- ordered reason list
- helper fields for:
  - `categoryConfidence`
  - `amountConfidence`
  - `thcConfidence`
  - `uomConfidence`

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/catalog-review-score.test.ts --reporter=verbose`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/catalog-review-score.ts tests/catalog-review-score.test.ts
git commit -m "Add catalog review confidence scoring"
```

### Task 3: Build a repeatable batch runner for the export folder

**Files:**
- Create: `.logic-review/run-review.ts`
- Create: `.logic-review/review-types.ts`
- Modify: `package.json`
- Test: `tests/catalog-review-runner.test.ts`
- Reference: `dev/run-catalog-etl.ts`
- Reference: `lib/parser.ts`
- Reference: `lib/pos-detection.ts`
- Reference: `lib/mapping-engine.ts`
- Reference: `lib/transformer.ts`
- Reference: `lib/validator.ts`
- Reference: `lib/catalog-review-score.ts`

**Step 1: Write the failing test**

Cover:
- runner walks `.test-data/exports/catalog` recursively
- each export becomes an individual review file entry
- rows are transformed individually
- output JSON is sorted by ascending confidence
- score reasons are preserved

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/catalog-review-runner.test.ts --reporter=verbose`

Expected: FAIL because the review runner does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- Node file shim reuse for `parseFile`
- POS detection and manual mapping fallback reuse from `dev/run-catalog-etl.ts`
- `deriveRows(...)`
- `validateDerivedRows(...)`
- scoring with `scoreCatalogReviewRow(...)`
- normalized output JSON:
  - one object per source file
  - one nested product review row per transformed row
- output path under `.logic-review/output/review-data.json`

Add a package script:

```json
"review:catalog": "tsx .logic-review/run-review.ts"
```

If `tsx` is not already present, choose one of:
- add `tsx` as a dev dependency, or
- compile/run with the repo’s existing Node/TypeScript path in a minimal way

Prefer the smallest repeatable option.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/catalog-review-runner.test.ts --reporter=verbose`

Expected: PASS

**Step 5: Smoke-run against real exports**

Run: `pnpm review:catalog`

Expected:
- `.logic-review/output/review-data.json` exists
- output includes all discovered exports
- rows are sorted with lowest-confidence items first

**Step 6: Commit**

```bash
git add .logic-review/run-review.ts .logic-review/review-types.ts package.json tests/catalog-review-runner.test.ts
git commit -m "Add repeatable catalog review batch runner"
```

### Task 4: Generate the static review HTML site

**Files:**
- Create: `.logic-review/generate-site.ts`
- Create: `.logic-review/site-template.css`
- Create: `.logic-review/site-template.js`
- Test: `tests/catalog-review-site.test.ts`
- Reference: `dev/generate-review-page.ts`
- Reference: `.logic-review/output/review-data.json`

**Step 1: Write the failing test**

Cover:
- `index.html` is generated under `.logic-review/output/`
- rows render original and transformed values
- score and score reasons appear in the page
- ordering is lowest confidence first
- file name / POS / row index are visible

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/catalog-review-site.test.ts --reporter=verbose`

Expected: FAIL because the site generator does not exist yet.

**Step 3: Write minimal implementation**

Build a standalone static page that:
- loads embedded review JSON or inlines it at build time
- shows per-row:
  - source file
  - product name
  - original row values
  - transformed row values
  - confidence score
  - score reason list
  - validation warnings/errors
- defaults to sort by ascending confidence
- includes quick filters for:
  - category risk
  - amount/UOM risk
  - THC/CBD risk
  - POS
  - source file

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/catalog-review-site.test.ts --reporter=verbose`

Expected: PASS

**Step 5: Generate the real site**

Run:

```bash
pnpm review:catalog
node .logic-review/generate-site.ts
```

Expected:
- `.logic-review/output/index.html` exists
- opening it in Chrome shows the lowest-confidence products first

**Step 6: Commit**

```bash
git add .logic-review/generate-site.ts .logic-review/site-template.css .logic-review/site-template.js tests/catalog-review-site.test.ts
git commit -m "Generate static catalog logic review site"
```

### Task 5: Make the workflow one-command repeatable

**Files:**
- Modify: `package.json`
- Modify: `.logic-review/README.md`
- Optionally create: `.logic-review/run-all.ts`

**Step 1: Wire the end-to-end command**

Provide one stable command, for example:

```json
"review:catalog": "tsx .logic-review/run-all.ts"
```

Where `run-all.ts` performs:
1. export discovery
2. transform + score JSON generation
3. HTML site generation

**Step 2: Document exact usage**

Document:
- default input folder
- output folder
- how to open `.logic-review/output/index.html` in Chrome
- how to re-run after logic changes

**Step 3: Verify the command**

Run: `pnpm review:catalog`

Expected:
- `review-data.json` regenerated
- `index.html` regenerated
- no manual steps required besides opening the file

**Step 4: Commit**

```bash
git add package.json .logic-review/README.md .logic-review/run-all.ts
git commit -m "Wire one-command catalog logic review workflow"
```

### Task 6: Final verification and review handoff

**Files:**
- Update if needed: `.logic-review/review-plan.md`
- Update if needed: `.logic-review/README.md`

**Step 1: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm review:catalog
```

Expected:
- lint passes
- typecheck passes
- tests pass
- review artifacts regenerate successfully

**Step 2: Sanity-check the generated site manually**

Open:
- `.logic-review/output/index.html`

Check:
- lowest-confidence products appear first
- category/amount/THC/UOM issues are obvious
- before/after rows are readable
- file context is visible

**Step 3: Commit**

```bash
git add .logic-review
git commit -m "Finalize catalog logic review workflow"
```

## Notes and defaults for execution

- Prefer reusing the existing mapping/detection logic instead of creating a second transformation path.
- Confidence ranking should be explicit and inspectable, not opaque.
- Category correctness is the highest-priority score component.
- Amount, total mg THC/CBD, and UOM correctness are the next-priority score components.
- The output site should be static and Chrome-openable without a dev server.
- Keep all generated artifacts under `.logic-review/output/` so the process can be rerun cleanly.

## Suggested first execution slice

If we execute this next, start with:
1. Task 2
2. Task 3
3. Task 4

That gets the scoring model, batch transformation, and review site working before polishing the single-command wrapper.
