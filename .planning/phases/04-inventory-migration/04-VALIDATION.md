---
phase: 4
slug: inventory-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INV-01 | unit | `pnpm vitest run tests/store-api.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INV-02 | unit | `pnpm vitest run tests/inventory-transformer.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | INV-02, INV-03 | unit | `pnpm vitest run tests/inventory-validator.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | INV-02, INV-03 | unit | `pnpm vitest run tests/inventory-csv-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | INV-01 | manual | Load extension, verify store selector renders | N/A | ⬜ pending |
| 04-02-02 | 02 | 2 | INV-02 | manual | Upload inventory file, verify mapping step | N/A | ⬜ pending |
| 04-03-01 | 03 | 2 | INV-02, INV-03 | manual | Run full inventory migration end-to-end | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/store-api.test.ts` — JWT claim extraction, store API call mocking (INV-01)
- [ ] `tests/inventory-transformer.test.ts` — field mapping, product matching, unmatched row handling (INV-02)
- [ ] `tests/inventory-validator.test.ts` — quantity/cost validation, warning vs error severity (INV-02, INV-03)
- [ ] `tests/inventory-csv-generator.test.ts` — single CSV output with correct columns (INV-02, INV-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Store selector banner renders and lists stores | INV-01 | UI component with API dependency | Load extension on Treez import page, click "Migrate Inventory", verify store dropdown appears |
| Store change resets wizard with confirmation | INV-01 | Interactive UI behavior | Select store, upload file, change store, verify confirmation dialog and reset |
| Inventory mapping step shows inventory-specific fields | INV-02 | Visual verification | Upload inventory file, advance to Map step, verify inventory field groups |
| Full inventory import uploads single CSV to S3 | INV-02, INV-03 | End-to-end with Treez API | Complete full inventory wizard flow, verify CSV uploaded and import triggered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
