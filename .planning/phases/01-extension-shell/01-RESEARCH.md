# Phase 1: Extension Shell - Research

**Researched:** 2026-03-09
**Domain:** Chrome Extension (MV3) with WXT framework, Side Panel UI, Treez session auth
**Confidence:** HIGH

## Summary

This phase builds a Chrome extension skeleton using WXT (v0.20.x), React 19, and Tailwind CSS 4 that injects buttons on the Treez import page, opens a side panel with a 4-step wizard shell, and reads Treez session tokens from localStorage. The v1 codebase at `projects/chrome-extension/` provides proven patterns for button injection, token reading, environment detection, and service worker token refresh that should be adapted (not copied wholesale) to WXT conventions.

WXT replaces CRXJS from v1 and provides file-based entrypoint routing, automatic manifest generation, HMR in development, and first-class side panel support. The key architectural shift from v1 is moving from a popup-in-iframe approach to a native Chrome Side Panel (`chrome.sidePanel` API), and from content-script-injected floating panels to proper extension-managed UI surfaces.

**Primary recommendation:** Use WXT with `@wxt-dev/module-react`, Tailwind CSS 4 via `@tailwindcss/vite`, and `@webext-core/messaging` for type-safe content script to background communication. Restrict the side panel to Treez import pages using `chrome.sidePanel.setOptions()` with per-tab enable/disable in the background script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Side panel (not popup) -- docked to the right, full height, more room for data tables
- Side panel only available on the import page (`/treez-admin/import/home`), not across the whole Treez app
- Content script injects on the Treez import page only: `https://app.treez.io/treez-admin/import/home` (and sandbox/dev equivalents)
- Two buttons: "Migrate Catalog" and "Migrate Inventory" (separate wizards, not a combined flow)
- Buttons appear to the right of the existing "Launch Import Wizard" button
- Must detect environment from URL: `app.treez.io`, `app.sandbox.treez.io`, `app.dev.treez.io`
- 4-step wizard (same as v1): Upload -> Map -> Review -> Import
- Each migration type (catalog/inventory) uses its own 4-step wizard instance
- Step navigation with progress indicator
- Steps are empty placeholders in this phase -- just the shell and navigation
- Read Treez session token from `tz-tokens` in localStorage (same approach as v1)
- Service worker handles token refresh (check JWT exp claim, use refresh_token)
- No separate login -- piggyback on existing Treez session

### Claude's Discretion
- Side panel width and styling
- Step indicator visual design (stepper, progress bar, tabs)
- Icon design for extension
- WXT project structure and configuration details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXT-01 | Chrome extension injects "Migrate Products" button on Treez Catalog module pages | WXT content script with `createIntegratedUi` for button injection; v1 `inject-button.ts` pattern adapted for import page targeting |
| EXT-02 | Extension authenticates using Treez session tokens (no separate login) | Content script reads `tz-tokens` from localStorage, syncs to background via messaging; background handles JWT refresh using v1 service worker pattern |
| EXT-03 | Extension works across Treez environments (production, sandbox, dev) | WXT manifest `host_permissions` for all three domains; URL hostname detection for environment-aware API routing |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.20.x | Extension framework | File-based routing, auto manifest, HMR, replaces CRXJS (maintenance concerns) |
| @wxt-dev/module-react | latest | React integration for WXT | Official WXT module, adds Vite React plugin + auto-imports |
| react | ^19.2.0 | UI framework | Same as v1, team familiarity |
| react-dom | ^19.2.0 | React DOM rendering | Required by React |
| tailwindcss | ^4.x | Utility CSS | Same as v1, CSS-first config in v4 |
| @tailwindcss/vite | ^4.x | Tailwind Vite plugin | Required for Tailwind 4 in WXT (replaces PostCSS approach) |
| typescript | ~5.9.x | Type safety | Same as v1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @webext-core/messaging | latest | Type-safe messaging | Content script <-> background communication for auth tokens |
| @webext-core/fake-browser | latest | Test mocking | Unit tests -- polyfills chrome.* APIs in Vitest |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @webext-core/messaging | Raw chrome.runtime.sendMessage | Lose type safety, more boilerplate, error-prone |
| @tailwindcss/vite | PostCSS + tailwindcss | Tailwind 4 recommends Vite plugin; PostCSS path has known WXT compatibility issues |
| createIntegratedUi (for buttons) | createShadowRootUi | Shadow DOM isolates styles but adds complexity; buttons need to match Treez page styling |

**Installation:**
```bash
pnpm dlx wxt@latest init  # Select React template
pnpm i react react-dom
pnpm i -D @wxt-dev/module-react tailwindcss @tailwindcss/vite @webext-core/messaging
```

## Architecture Patterns

### Recommended Project Structure
```
catalog-migration-tool/
├── entrypoints/
│   ├── background/
│   │   ├── index.ts              # defineBackground - token refresh, messaging, sidePanel control
│   │   └── auth.ts               # JWT decode, refresh logic (ported from v1 service-worker.ts)
│   ├── import-page.content/
│   │   ├── index.tsx             # defineContentScript - button injection on import page
│   │   └── App.tsx               # React component for injected buttons
│   └── sidepanel/
│       ├── index.html            # Side panel HTML shell
│       ├── main.tsx              # React mount point
│       ├── App.tsx               # Root component with wizard routing
│       └── style.css             # Tailwind entry (@import "tailwindcss")
├── components/
│   ├── wizard/
│   │   ├── WizardShell.tsx       # 4-step wizard container
│   │   ├── StepIndicator.tsx     # Progress/stepper UI
│   │   └── StepPlaceholder.tsx   # Empty step content (Phase 1)
│   └── ui/                       # Shared UI primitives
├── lib/
│   ├── messaging.ts              # @webext-core/messaging protocol definition
│   ├── constants.ts              # Treez URLs, step labels, environment config
│   └── env.ts                    # Environment detection from URL hostname
├── assets/
│   └── tailwind.css              # Global Tailwind styles
├── public/
│   └── icon/                     # Extension icons (16, 48, 128)
├── wxt.config.ts                 # WXT configuration
├── tsconfig.json
└── package.json
```

### Pattern 1: Side Panel Restricted to Import Pages
**What:** The side panel should only be available when the user is on a Treez import page, not globally.
**When to use:** Always -- this is a locked decision.
**Example:**
```typescript
// entrypoints/background/index.ts
// Source: https://github.com/wxt-dev/wxt/issues/1272

const IMPORT_PAGE_PATTERNS = [
  'https://app.treez.io/treez-admin/import/home*',
  'https://app.sandbox.treez.io/treez-admin/import/home*',
  'https://app.dev.treez.io/treez-admin/import/home*',
];

export default defineBackground(() => {
  // Open side panel when extension action icon is clicked
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;

    const isImportPage = IMPORT_PAGE_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(tab.url!);
    });

    await browser.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: isImportPage,
    });
  });
});
```

**WXT config to remove default side_panel manifest entry:**
```typescript
// wxt.config.ts
// Source: https://github.com/wxt-dev/wxt/issues/1272
export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {},
    permissions: ['storage', 'activeTab', 'tabs', 'sidePanel', 'scripting'],
    host_permissions: [
      'https://app.treez.io/*',
      'https://app.sandbox.treez.io/*',
      'https://app.dev.treez.io/*',
      'https://api.treez.io/*',
      'https://api.sandbox.treez.io/*',
      'https://api-dev.treez.io/*',
      'https://api-prod.treez.io/*',
      'https://api.mso.treez.io/*',
      'https://oauth.treez.io/*',
      'https://oauth-dev.treez.io/*',
      'https://*.s3.us-west-2.amazonaws.com/*',
    ],
  },
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // Remove default side_panel entry so we control it programmatically
      delete (manifest as any).side_panel;
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

### Pattern 2: Content Script Button Injection with WXT
**What:** Inject "Migrate Catalog" and "Migrate Inventory" buttons on the import page using WXT's content script API.
**When to use:** For the import page buttons.
**Example:**
```typescript
// entrypoints/import-page.content/index.tsx
// Source: https://wxt.dev/guide/key-concepts/content-script-ui.html
import ReactDOM from 'react-dom/client';
import App from './App';

export default defineContentScript({
  matches: [
    'https://app.treez.io/treez-admin/import/home*',
    'https://app.sandbox.treez.io/treez-admin/import/home*',
    'https://app.dev.treez.io/treez-admin/import/home*',
  ],
  runAt: 'document_idle',

  main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
```

### Pattern 3: Type-Safe Messaging Protocol
**What:** Define a messaging protocol for content script <-> background communication.
**When to use:** Token requests, side panel open commands.
**Example:**
```typescript
// lib/messaging.ts
// Source: https://webext-core.aklinker1.io/messaging/installation
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  openSidePanel(data: { tabId: number; wizardType: 'catalog' | 'inventory' }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

### Pattern 4: Token Auth from localStorage (Adapted from v1)
**What:** Read Treez session tokens from the page's localStorage and refresh when expired.
**When to use:** Every API call from the extension.
**Example:**
```typescript
// entrypoints/background/auth.ts
// Adapted from: projects/chrome-extension/src/background/service-worker.ts

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  idToken?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() / 1000 > payload.exp - 60; // 60s buffer
}

async function getTokensViaScripting(tabId: number): Promise<StoredTokens | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const raw = localStorage.getItem('tz-tokens');
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      },
    });
    return results?.[0]?.result ?? null;
  } catch { return null; }
}

// ... refreshAccessToken and getValidToken same pattern as v1
```

### Anti-Patterns to Avoid
- **Polling localStorage from content script:** v1 uses `setInterval(syncAuthToken, 30_000)` -- use on-demand messaging instead. The background script should read tokens via `chrome.scripting.executeScript` when needed.
- **Injecting iframe for UI:** v1 embeds the popup as an iframe in the page. Side Panel is the correct approach now -- native Chrome API, better UX, no z-index fights.
- **Hardcoding environment URLs:** Use a constants file and derive environment from the current tab URL hostname.
- **Using `browser.*` for Chrome-only extension:** Since this targets Chrome only (`extensionApi: 'chrome'`), use `chrome.*` APIs directly. WXT's `browser.*` polyfill adds unnecessary abstraction for a Chrome-only extension.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extension messaging | Custom chrome.runtime.sendMessage wrappers | @webext-core/messaging | Type safety, protocol map, handles async responses correctly |
| JWT decoding | Full JWT library (jose, jsonwebtoken) | Manual base64 decode (same as v1) | Only need to read `exp` claim for refresh logic; full library is overkill and adds bundle size |
| Side panel lifecycle | Custom window management | chrome.sidePanel API | Native Chrome API handles positioning, sizing, tab association |
| CSS isolation (buttons) | Shadow DOM for injected buttons | createIntegratedUi | Buttons should match Treez page styling; shadow DOM would isolate them |
| Extension manifest | Hand-written manifest.json | WXT auto-generation | WXT generates manifest from entrypoint files and config |

**Key insight:** WXT handles most of the build/manifest complexity that v1 managed manually with CRXJS. The main custom code is auth token handling and Treez-specific button injection logic.

## Common Pitfalls

### Pitfall 1: Side Panel Not Appearing on Page Navigation
**What goes wrong:** Treez is a SPA -- navigating to the import page doesn't trigger `tabs.onUpdated` with a URL change because it's client-side routing.
**Why it happens:** `tabs.onUpdated` fires on page load and URL changes, but SPA navigation may use `history.pushState` which doesn't always fire the event.
**How to avoid:** Also listen for `webNavigation.onHistoryStateUpdated` or have the content script send a message when it detects it's on the import page.
**Warning signs:** Side panel works on direct navigation but not when clicking through Treez menu.

### Pitfall 2: Content Script Not Injecting on SPA Navigation
**What goes wrong:** Content script only runs once on initial page load. When user navigates away and back via SPA routing, content script doesn't re-inject.
**Why it happens:** Chrome content scripts run based on URL match at load time. SPA navigation doesn't reload the page.
**How to avoid:** Use `MutationObserver` (as v1 does) to detect page changes and re-inject buttons. WXT's `ctx` provides `isValid` for lifecycle checks.
**Warning signs:** Buttons appear on first visit to import page but not after navigating away and back.

### Pitfall 3: Tailwind CSS 4 Shadow Root Border Issue
**What goes wrong:** Tailwind v4 has a known issue with borders inside shadow roots.
**Why it happens:** Tailwind v4 changed how CSS variables and defaults work.
**How to avoid:** Use `createIntegratedUi` for buttons (no shadow root needed). If shadow root is needed for side panel content script UI, test borders carefully or use explicit border styles.
**Warning signs:** Missing borders, invisible border styles in shadow DOM.

### Pitfall 4: Token Refresh Race Condition
**What goes wrong:** Multiple components request tokens simultaneously, triggering multiple refresh calls.
**Why it happens:** No mutex/lock on the refresh operation.
**How to avoid:** Add a refresh-in-progress guard in the background script. Queue concurrent requests and resolve them all when the single refresh completes.
**Warning signs:** 401 errors after token refresh, "invalid_grant" from OAuth endpoint.

### Pitfall 5: WXT Build Hook for Side Panel Manifest
**What goes wrong:** WXT auto-adds a `side_panel` entry to manifest when sidepanel entrypoint exists, making it available on all pages.
**Why it happens:** WXT's convention assumes side panel should always be available.
**How to avoid:** Use the `build:manifestGenerated` hook to delete the default `side_panel` entry, then control availability programmatically via `chrome.sidePanel.setOptions()` per tab.
**Warning signs:** Side panel appears on non-import pages.

## Code Examples

### WXT Configuration (Complete)
```typescript
// wxt.config.ts
// Source: WXT docs + GitHub issue #1272 + Tailwind v4 issue #1460
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Catalog Migration Tool',
    description: 'Migrate product catalog and inventory data into Treez',
    action: {},
    permissions: ['storage', 'activeTab', 'tabs', 'sidePanel', 'scripting'],
    host_permissions: [
      'https://app.treez.io/*',
      'https://app.sandbox.treez.io/*',
      'https://app.dev.treez.io/*',
      'https://api.treez.io/*',
      'https://api.sandbox.treez.io/*',
      'https://api-dev.treez.io/*',
      'https://api-prod.treez.io/*',
      'https://api.mso.treez.io/*',
      'https://oauth.treez.io/*',
      'https://oauth-dev.treez.io/*',
      'https://*.s3.us-west-2.amazonaws.com/*',
    ],
  },
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      delete (manifest as any).side_panel;
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

### Wizard Shell Component
```typescript
// components/wizard/WizardShell.tsx
const STEP_LABELS = ['Upload', 'Map', 'Review', 'Import'];

interface WizardShellProps {
  wizardType: 'catalog' | 'inventory';
}

export function WizardShell({ wizardType }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b">
        <h1 className="text-lg font-semibold">
          {wizardType === 'catalog' ? 'Migrate Catalog' : 'Migrate Inventory'}
        </h1>
        <StepIndicator steps={STEP_LABELS} current={currentStep} />
      </header>
      <main className="flex-1 overflow-auto p-4">
        <StepPlaceholder stepName={STEP_LABELS[currentStep]} />
      </main>
      <footer className="p-4 border-t flex justify-between">
        <button
          disabled={currentStep === 0}
          onClick={() => setCurrentStep(s => s - 1)}
        >
          Back
        </button>
        <button
          disabled={currentStep === STEP_LABELS.length - 1}
          onClick={() => setCurrentStep(s => s + 1)}
        >
          Next
        </button>
      </footer>
    </div>
  );
}
```

### Environment Detection
```typescript
// lib/env.ts
// Adapted from: v1 manifest.json host patterns

type TreezEnv = 'production' | 'sandbox' | 'dev';

const ENV_MAP: Record<string, TreezEnv> = {
  'app.treez.io': 'production',
  'app.sandbox.treez.io': 'sandbox',
  'app.dev.treez.io': 'dev',
};

export function detectEnvironment(url: string): TreezEnv | null {
  try {
    const hostname = new URL(url).hostname;
    return ENV_MAP[hostname] ?? null;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(env: TreezEnv): string {
  switch (env) {
    case 'production': return 'https://api.treez.io';
    case 'sandbox': return 'https://api.sandbox.treez.io';
    case 'dev': return 'https://api-dev.treez.io';
  }
}
```

## State of the Art

| Old Approach (v1) | Current Approach (v2) | When Changed | Impact |
|--------------------|-----------------------|--------------|--------|
| CRXJS Vite plugin | WXT framework | 2024+ | CRXJS has maintenance concerns; WXT actively maintained, better DX |
| Popup in iframe overlay | Chrome Side Panel API | Chrome 114+ (2023) | Native UI surface, proper lifecycle, no z-index issues |
| Manual manifest.json | WXT auto-generation | WXT convention | Less error-prone, entrypoint-driven manifest |
| setInterval token sync | On-demand messaging | Best practice | Less battery drain, more reliable, avoids stale state |
| Tailwind CSS 3 (PostCSS) | Tailwind CSS 4 (Vite plugin) | 2025 | Faster builds, CSS-first config, simpler setup |

**Deprecated/outdated:**
- CRXJS: Maintenance has stalled; community has moved to WXT or Plasmo
- Manifest V2: Chrome Web Store no longer accepts MV2 extensions
- `chrome.browserAction`: Replaced by `chrome.action` in MV3

## Open Questions

1. **Button anchor element on import page**
   - What we know: v1 injects a fixed-position floating button. v2 should place buttons next to "Launch Import Wizard".
   - What's unclear: The exact DOM selector for the "Launch Import Wizard" button on the import page (v1 targeted product-control page, not import page).
   - Recommendation: During implementation, inspect the import page DOM to find the correct anchor element. Fall back to fixed positioning if the anchor is unreliable.

2. **Side panel open trigger**
   - What we know: Buttons should open the side panel. `chrome.sidePanel.open()` can open it programmatically.
   - What's unclear: Whether clicking an injected button can trigger `chrome.sidePanel.open()` from content script context (may need to message the background).
   - Recommendation: Content script sends message to background, background calls `chrome.sidePanel.open({ tabId })`. This is the documented pattern.

3. **Treez SPA routing detection**
   - What we know: Treez uses client-side routing (likely React Router). v1 uses MutationObserver to detect page changes.
   - What's unclear: Whether `webNavigation.onHistoryStateUpdated` reliably fires for Treez SPA navigation.
   - Recommendation: Use both MutationObserver in content script AND `tabs.onUpdated` in background. Belt and suspenders.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, via WXT plugin) |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-01 | Button injection on import page | unit | `pnpm vitest run tests/content-script.test.ts -t "injects buttons"` | No -- Wave 0 |
| EXT-02 | Token read from localStorage + refresh | unit | `pnpm vitest run tests/auth.test.ts -t "token"` | No -- Wave 0 |
| EXT-03 | Environment detection from URL | unit | `pnpm vitest run tests/env.test.ts -t "environment"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- WxtVitest plugin setup + jsdom environment
- [ ] `tests/auth.test.ts` -- JWT decode, expiry check, refresh flow
- [ ] `tests/env.test.ts` -- environment detection from URLs
- [ ] `tests/content-script.test.ts` -- button injection logic (DOM assertions)
- [ ] Framework install: `pnpm i -D vitest @webext-core/fake-browser` -- test infrastructure

## Sources

### Primary (HIGH confidence)
- [WXT Entrypoints docs](https://wxt.dev/guide/essentials/entrypoints.html) -- sidepanel, content script, background setup
- [WXT Content Script UI docs](https://wxt.dev/guide/key-concepts/content-script-ui.html) -- createIntegratedUi, createShadowRootUi patterns
- [WXT GitHub Issue #1272](https://github.com/wxt-dev/wxt/issues/1272) -- side panel restricted to specific pages pattern
- [WXT GitHub Issue #1460](https://github.com/wxt-dev/wxt/issues/1460) -- Tailwind CSS v4 compatibility setup
- [Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) -- setOptions, setPanelBehavior, per-tab control
- v1 source code at `/Users/chase/projects/chrome-extension/` -- proven auth, injection, and environment patterns

### Secondary (MEDIUM confidence)
- [WXT Modules docs](https://wxt.dev/guide/essentials/wxt-modules) -- @wxt-dev/module-react configuration
- [sidepanel-extension-template](https://github.com/evanlong-me/sidepanel-extension-template) -- WXT + React + Tailwind 4 + shadcn/ui reference implementation
- [@wxt-dev/module-react GitHub](https://github.com/wxt-dev/wxt/tree/main/packages/module-react) -- React module setup
- [WXT Messaging docs](https://wxt.dev/guide/essentials/messaging) -- @webext-core/messaging recommendation

### Tertiary (LOW confidence)
- Tailwind CSS 4 shadow root border issue -- mentioned in GitHub issue but not independently verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- WXT is well-documented, React/Tailwind are team-familiar, v1 patterns are proven
- Architecture: HIGH -- Side Panel API is stable Chrome API, WXT patterns are documented with examples
- Pitfalls: MEDIUM -- SPA navigation edge cases need runtime testing, Tailwind v4 shadow root issue is anecdotal

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain -- Chrome extension APIs change slowly)
