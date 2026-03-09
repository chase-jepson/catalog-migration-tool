---
phase: 3
slug: transform-validate-and-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | XFRM-01 | unit | `npx vitest run tests/category-mapper.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | XFRM-02, XFRM-03, VAL-03 | unit | `npx vitest run tests/transformer.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | VAL-01, VAL-02 | unit | `npx vitest run tests/validator.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | IMP-01 | unit | `npx vitest run tests/csv-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | IMP-02 | unit | `npx vitest run tests/file-uploader.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | IMP-03 | unit | `npx vitest run tests/import-poller.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/category-mapper.test.ts` — stubs for XFRM-01 (category/subcategory resolution, keyword rules, name overrides)
- [ ] `tests/transformer.test.ts` — stubs for XFRM-02, XFRM-03, VAL-03 (deriveRows, weight parsing, classification, applyFixes)
- [ ] `tests/validator.test.ts` — stubs for VAL-01, VAL-02 (validateDerivedRows, error grouping, error/warning severity)
- [ ] `tests/csv-generator.test.ts` — stubs for IMP-01 (buildOutputCSVs, CSV serialization, ZIP generation)
- [ ] `tests/file-uploader.test.ts` — stubs for IMP-02 (upload payload construction, presigned URL flow)
- [ ] `tests/import-poller.test.ts` — stubs for IMP-03 (polling logic, ETA calculation, adaptive intervals)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| User sees transformed values in review UI | XFRM-01 | Visual rendering in extension popup | Load test data → advance to Review step → verify category/weight columns show transformed values |
| User can fix validation errors inline | VAL-03 | Interactive UI flow in extension | Trigger validation errors → click error row → edit field → re-validate → confirm error clears |
| S3 upload with presigned URLs | IMP-02 | Requires live API credentials and CORS | Run full import flow against staging → verify files appear in S3 bucket |
| Import progress with ETA display | IMP-03 | Requires live import API polling | Start import → verify progress bar updates → confirm ETA countdown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
