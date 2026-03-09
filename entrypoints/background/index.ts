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
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    await updateSidePanelForTab(details.tabId, details.url);
  });

  // Handle getAuthToken messages via typed messaging
  onMessage('getAuthToken', async (message) => {
    const { appUrl } = message.data;
    const tabId = message.sender.tab?.id;
    if (!tabId) return { token: null };

    const token = await getValidToken(tabId, appUrl);
    return { token };
  });

  // Handle openSidePanel via raw chrome.runtime.onMessage.
  // chrome.sidePanel.open() requires a user gesture — it MUST be the first
  // call in the handler. Any await/then before it breaks the gesture chain.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== 'openSidePanel') return;

    const tabId = sender.tab?.id;
    if (!tabId) return;

    // Open IMMEDIATELY — must be first call to preserve gesture context
    chrome.sidePanel.open({ tabId });

    // Store wizard type after (panel reads it on mount)
    chrome.storage.session.set({ wizardType: message.data.wizardType });
  });
});
