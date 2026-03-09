---
phase: 1
slug: extension-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, via WXT plugin) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | - | setup | `pnpm vitest run` | No — W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | EXT-01 | unit | `pnpm vitest run tests/content-script.test.ts -t "injects buttons"` | No — W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | EXT-03 | unit | `pnpm vitest run tests/env.test.ts -t "environment"` | No — W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | EXT-02 | unit | `pnpm vitest run tests/auth.test.ts -t "token"` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — WxtVitest plugin setup + jsdom environment
- [ ] `tests/auth.test.ts` — JWT decode, expiry check, refresh flow stubs
- [ ] `tests/env.test.ts` — environment detection from URLs stubs
- [ ] `tests/content-script.test.ts` — button injection logic stubs (DOM assertions)
- [ ] Framework install: `pnpm i -D vitest @webext-core/fake-browser` — test infrastructure

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side panel opens on button click | EXT-01 | Requires running Chrome instance with extension loaded | Load extension in Chrome, navigate to import page, click "Migrate Catalog" button, verify side panel opens |
| Side panel restricted to import pages | EXT-01 | Browser-level sidePanel API not mockable in unit tests | Navigate to non-import Treez page, verify side panel is not available |
| SPA navigation re-injection | EXT-01 | Requires real Treez SPA routing | Navigate away from import page and back, verify buttons re-appear |
| Token read from real localStorage | EXT-02 | Requires active Treez session | Log into Treez, load extension, verify token is read without separate login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
