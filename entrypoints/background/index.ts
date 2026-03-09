import { IMPORT_PAGE_PATTERNS } from '../../lib/constants';
import { onMessage } from '../../lib/messaging';
import { getValidToken } from './auth';

export default defineBackground(() => {
  // Open side panel when extension action icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  /**
   * Check if a URL matches one of the Treez import page patterns.
   * Patterns use glob-style * wildcards, converted to regex.
   */
  function isImportPageUrl(url: string): boolean {
    return IMPORT_PAGE_PATTERNS.some((pattern) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(url);
    });
  }

  /**
   * Enable or disable the side panel for a specific tab based on URL.
   */
  async function updateSidePanelForTab(
    tabId: number,
    url: string | undefined,
  ): Promise<void> {
    if (!url) return;
    const enabled = isImportPageUrl(url);
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled,
    });
  }

  // Listen for tab URL changes (standard navigation)
  chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
    await updateSidePanelForTab(tabId, tab.url);
  });

  // Listen for SPA navigation (history.pushState / replaceState)
  // Treez is a SPA, so client-side routing won't trigger tabs.onUpdated URL changes
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    await updateSidePanelForTab(details.tabId, details.url);
  });

  // Handle getAuthToken messages from content script
  onMessage('getAuthToken', async (message) => {
    const { appUrl } = message.data;
    // Get the sender tab ID
    const tabId = message.sender.tab?.id;
    if (!tabId) return { token: null };

    const token = await getValidToken(tabId, appUrl);
    return { token };
  });

  // Handle openSidePanel messages from content script
  onMessage('openSidePanel', async (message) => {
    const { wizardType } = message.data;
    const tabId = message.sender.tab?.id;
    if (!tabId) return;

    // Store the wizard type so the side panel knows which wizard to show
    await chrome.storage.session.set({ wizardType });

    // Open the side panel for this tab
    await chrome.sidePanel.open({ tabId });
  });
});
