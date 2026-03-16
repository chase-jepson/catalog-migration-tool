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
      if (!anchor) return;

      // The button sits inside a flex-column parent. Wrap the button
      // and our migrate buttons together in an inline row.
      const parent = anchor.parentElement!;
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'row';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '12px';
      wrapper.style.flexWrap = 'wrap';

      // Move the wizard button into the wrapper, then insert wrapper
      // where the button was
      parent.insertBefore(wrapper, anchor);
      wrapper.appendChild(anchor);

      // Mount our buttons inside the wrapper, after the wizard button
      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        tag: 'span',
        anchor: wrapper,
        onMount: (container) => {
          container.id = MOUNT_ID;
          container.style.display = 'inline-flex';
          container.style.gap = '12px';
          container.style.alignItems = 'center';
          const root = ReactDOM.createRoot(container);
          root.render(<App />);
          return root;
        },
        onRemove: (root) => {
          root?.unmount();
          // Restore original button position
          if (wrapper.parentElement) {
            wrapper.parentElement.insertBefore(anchor, wrapper);
            wrapper.remove();
          }
        },
      });

      ui.mount();
    }

    // Use a persistent MutationObserver that re-mounts after SPA navigation
    // (back/forward can tear down and re-render the anchor button)
    const observer = new MutationObserver(() => {
      if (findAnchor() && !document.getElementById(MOUNT_ID)) {
        mountUi();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Try to mount immediately
    if (findAnchor()) {
      mountUi();
    }

    ctx.onInvalidated(() => {
      observer.disconnect();
    });
  },
});
