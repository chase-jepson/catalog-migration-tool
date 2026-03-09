import ReactDOM from 'react-dom/client';
import App from './App';
import { IMPORT_PAGE_PATTERNS } from '../../lib/constants';

export default defineContentScript({
  matches: IMPORT_PAGE_PATTERNS,
  runAt: 'document_idle',

  main(ctx) {
    // Maximum time to wait for the target anchor element (ms)
    const MOUNT_TIMEOUT = 10_000;

    /**
     * Try to find the "Launch Import Wizard" button's parent container
     * to inject our buttons next to it. Falls back to a known page element.
     */
    function findAnchor(): Element | null {
      // Look for the Import Wizard button and use its parent as anchor
      const importWizardBtn = document.querySelector(
        'button[class*="import"], button[class*="wizard"], [data-testid="launch-import-wizard"]',
      );
      if (importWizardBtn?.parentElement) return importWizardBtn.parentElement;

      // Fallback: look for common header/toolbar containers
      const toolbar = document.querySelector(
        '.page-toolbar, .page-header, [class*="toolbar"], [class*="header-actions"]',
      );
      if (toolbar) return toolbar;

      return null;
    }

    function mountUi() {
      const anchor = findAnchor() ?? document.body;

      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        anchor,
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
    }

    // Try to mount immediately
    const anchor = findAnchor();
    if (anchor) {
      mountUi();
      return;
    }

    // If anchor not found (SPA may not have rendered it yet), use MutationObserver
    const observer = new MutationObserver((_mutations) => {
      const found = findAnchor();
      if (found) {
        observer.disconnect();
        mountUi();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback: mount to body if anchor never appears
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      mountUi();
    }, MOUNT_TIMEOUT);

    // Clean up observer and timeout when content script is invalidated
    ctx.onInvalidated(() => {
      observer.disconnect();
      clearTimeout(timeoutId);
    });
  },
});
