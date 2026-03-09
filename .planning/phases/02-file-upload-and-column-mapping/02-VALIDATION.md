---
phase: 2
slug: file-upload-and-column-mapping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
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
| 02-01-01 | 01 | 1 | FILE-01 | unit | `pnpm vitest run tests/parser.test.ts -t "parseFile"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FILE-01 | unit | `pnpm vitest run tests/parser.test.ts -t "validateFile"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | FILE-04 | unit | `pnpm vitest run tests/parser.test.ts -t "large file"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | FILE-02 | unit | `pnpm vitest run tests/pos-detection.test.ts -t "detectPOS"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | FILE-03 | unit | `pnpm vitest run tests/pos-detection.test.ts -t "manual"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | MAP-01 | unit | `pnpm vitest run tests/mapping.test.ts -t "POS defaults"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | MAP-02 | unit | `pnpm vitest run tests/mapping.test.ts -t "override"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/parser.test.ts` — stubs for FILE-01, FILE-04 (parseFile, validateFile, large file handling)
- [ ] `tests/pos-detection.test.ts` — stubs for FILE-02, FILE-03 (detectPOS, manual override)
- [ ] `tests/mapping.test.ts` — stubs for MAP-01, MAP-02 (POS defaults, manual override)
- [ ] `tests/fixtures/` — sample CSV/XLSX files for each POS (small, 5-10 rows each)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop file upload in side panel | FILE-01 | Browser DnD API requires real browser context | Open extension, drag CSV onto upload zone, verify parse |
| XLSX sheet picker UI | FILE-01 | Interactive UI flow | Upload multi-sheet XLSX, verify sheet selector appears |
| 10k+ row UI responsiveness | FILE-04 | Performance perception requires real browser | Upload large file, verify no freezing during parse |
| Column mapping dropdown interaction | MAP-02 | Interactive dropdown UX | Change a mapping via dropdown, verify it updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
