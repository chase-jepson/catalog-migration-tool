import ReactDOM from 'react-dom/client';
import App from './App';
import { IMPORT_PAGE_PATTERNS } from '../../lib/constants';

// Guard against double-mounting (SPA navigation can re-trigger)
const MOUNT_ID = 'cmt-migrate-buttons';

export default defineContentScript({
  matches: IMPORT_PAGE_PATTERNS,
  runAt: 'document_idle',

  main(ctx) {
    const MOUNT_TIMEOUT = 10_000;

    /**
     * Find the first "Launch Import Wizard" button on the page.
     */
    function findAnchor(): Element | null {
      return document.querySelector('[data-testid="import-wizard-button"]');
    }

    function mountUi() {
      // Prevent double-mount
      if (document.getElementById(MOUNT_ID)) return;

      const anchor = findAnchor();
      const parent = anchor?.parentElement ?? document.body;

      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        anchor: parent,
        onMount: (container) => {
          container.id = MOUNT_ID;
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
    if (findAnchor()) {
      mountUi();
      return;
    }

    // If anchor not found (SPA may not have rendered yet), use MutationObserver
    const observer = new MutationObserver(() => {
      if (findAnchor()) {
        observer.disconnect();
        mountUi();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      mountUi();
    }, MOUNT_TIMEOUT);

    ctx.onInvalidated(() => {
      observer.disconnect();
      clearTimeout(timeoutId);
    });
  },
});
