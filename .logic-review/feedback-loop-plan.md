# Catalog Logic Feedback Loop Plan

Goal: turn small reviewer batches into a fast, repeatable loop:

1. ingest reviewer feedback
2. derive a targeted rule-change plan
3. implement a small logic batch
4. rerun a focused review set
5. open a fresh review page with no stale notes

---

## Loop Design

### Reviewer batch size

- Default to 10-20 reviewed products per batch.
- Review the lowest-confidence products first.
- After each logic update, show:
  - the exact reviewed rows from the last batch
  - similar rows likely affected by the changed rules
  - a small regression sample from other low-confidence rows

### Clean-slate review page

- Each generated review site should use a run-scoped notes key instead of a single static localStorage key.
- The key should include a build identifier, for example:
  - generated timestamp
  - git commit
  - optional batch name
- Result:
  - old notes remain exportable if needed
  - new review runs open with an empty notes state by default

### Fast rerun strategy

- Keep the full review command for broad audits:
  - `pnpm review:catalog`
- Add a focused review command for iteration:
  - `pnpm review:catalog:focus /path/to/notes.json`
- Focus mode should include:
  - every noted `rowId`
  - neighboring rows from the same file when helpful
  - rows matching the same heuristic signature
    - same category guess
    - same keyword trigger
    - same UOM/amount extraction path

---

## Structured Feedback Upgrade

The current free-text notes were enough to identify direction, but the next speed improvement is structured reviewer input.

### Add structured reviewer fields

- `expectedCategory`
- `expectedAmount`
- `expectedUom`
- `expectedThcPresence`
  - `yes`
  - `no`
  - `unknown`
- `issueTypes`
  - `category`
  - `amount`
  - `uom`
  - `thc`
  - `classification`
  - `other`
- `evidence`
  - short explanation pointing to source-row evidence

### Export richer note payloads

When exporting review notes JSON, include:

- reviewer note text
- structured expectation fields
- original row snapshot
- transformed row snapshot
- confidence reasons
- file path
- row id

This avoids reloading the full site just to understand what a note meant.

---

## Feedback Ingestion

Add a plan generator command:

- `pnpm review:catalog:plan /path/to/catalog-logic-review-notes.json`

Output:

- `.logic-review/feedback-plan.md`

The generator should:

- group repeated feedback into rule candidates
- separate hard constraints from heuristics
- identify duplicate notes for the same pattern
- propose affected code areas
- estimate blast radius

### Hard constraints from current notes

These should be treated as strict logic rules, not soft confidence hints:

- Category can never be blank.
- Category can never be `Other`.
- Imported categories must stay within the existing allowed Treez set.

### Rule candidates from the current 9 notes

#### Merch corrections

- Terp-infused wraps should not be treated as THC products.
- Flavor words like `Lemonade` should not override obvious merch context.
- Exit bags and similar packaging should map to `Merch`.
- RAW rollers and similar accessories should bias strongly to `Merch`.
- Automobile / non-cannabis merch records should map to `Merch`, not `Other`.

#### CBD corrections

- `hemp` in the product name should bias to `CBD` when there is no THC evidence.
- Repeated `Love Plus Hemp Skincare` notes indicate this should become a reusable rule, not a one-off exception.

#### Tincture / edible corrections

- `drops` should never end in a blank category.
- `drops` should bias to `Tincture`, with `Edible` as secondary fallback when source context supports ingestion.

#### Flower / amount extraction corrections

- `BULK - Cannatonic 3.5 CBD` indicates the parser should extract:
  - category `Flower`
  - amount `3.5`
  - UOM `grams`
- Flower amount extraction should work even when `CBD` appears in the product name.

#### THC evidence handling

- THC branding alone should not imply a THC-bearing cannabis product.
- We need to distinguish:
  - branding text
  - product potency fields
  - actual infused / cannabinoid evidence

---

## Implementation Phases

### Phase 1: Review workflow upgrades

- Add run-scoped note storage so each review opens clean.
- Add structured review fields to the HTML review page.
- Add richer note export payloads.
- Add focused review mode driven by note JSON.

### Phase 2: Feedback plan generator

- Parse exported notes.
- Group notes into deduplicated rule-change themes.
- Emit an actionable `.logic-review/feedback-plan.md`.

### Phase 3: First logic batch from current notes

Target the highest-signal rules first:

- enforce allowed category output set
- replace `Other` fallback with valid category fallback logic
- add merch bias rules for wraps / bags / rollers / accessories
- add hemp-without-THC bias to `CBD`
- add drops bias to `Tincture` or `Edible`
- strengthen flower amount/UOM extraction for `3.5`-style names
- separate THC branding from real potency evidence

### Phase 4: Focused rerun and review

- regenerate review site for the 9 noted rows plus similar rows
- open Chrome automatically
- verify that old notes do not preload
- review only the impacted batch before touching broader heuristics

---

## Recommended Command Set

### Existing

- `pnpm review:catalog`
- `pnpm review:catalog:no-open`

### Add

- `pnpm review:catalog:plan /path/to/notes.json`
- `pnpm review:catalog:focus /path/to/notes.json`
- `pnpm review:catalog:focus:no-open /path/to/notes.json`

---

## Immediate Next Batch

Use `/Users/chase/Downloads/catalog-logic-review-notes.json` as batch 1 input.

Execute in this order:

1. implement clean-slate note storage
2. implement focused review mode
3. implement feedback plan generator
4. generate a rule-change plan from the 9 notes
5. apply the first small logic batch
6. rerun a focused review site and open Chrome

This keeps the next iteration short and lets reviewer time go toward changed rows, not the whole export corpus.
