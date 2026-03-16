import ReactDOM from 'react-dom/client';
import { DrawerApp } from './DrawerApp';
import { IMPORT_PAGE_PATTERNS } from '../../lib/constants';
import './style.css';

const DRAWER_ID = 'cmt-wizard-drawer';

type WizardType = 'catalog' | 'inventory';

export default defineContentScript({
  matches: IMPORT_PAGE_PATTERNS,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    let root: ReactDOM.Root | null = null;
    let mounted = false;
    let currentWizardType: WizardType | null = null;

    const ui = await createShadowRootUi(ctx, {
      name: 'cmt-wizard-drawer',
      position: 'inline',
      anchor: document.body,
      onMount(container) {
        container.id = DRAWER_ID;
        root = ReactDOM.createRoot(container);
        render();
        return root;
      },
      onRemove(r) {
        r?.unmount();
        root = null;
      },
    });

    function render() {
      if (!root) return;
      if (currentWizardType) {
        root.render(
          <DrawerApp
            wizardType={currentWizardType}
            onClose={hideDrawer}
          />,
        );
      } else {
        root.render(<></>);
      }
    }

    function showDrawer(wizardType: WizardType) {
      currentWizardType = wizardType;
      if (!mounted) {
        ui.mount();
        mounted = true;
      } else {
        render();
      }
      // Also set in storage so WizardShell can read it for persistence
      chrome.storage.session.set({ wizardType });
    }

    function hideDrawer() {
      currentWizardType = null;
      chrome.storage.session.remove('wizardType');
      render();
    }

    // Mount immediately (renders empty until a wizard type is set)
    ui.mount();
    mounted = true;

    // Listen for open events from the button content script
    document.addEventListener('cmt:open-wizard', ((e: CustomEvent) => {
      const { wizardType } = e.detail ?? {};
      if (wizardType) {
        showDrawer(wizardType as WizardType);
      }
    }) as EventListener);

    // Listen for messages from the background script (extension icon click)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'openDrawer' && message.wizardType) {
        showDrawer(message.wizardType as WizardType);
      }
    });
  },
});
