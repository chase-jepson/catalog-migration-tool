import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Catalog Migration Tool',
    description: 'Migrate product catalog and inventory data into Treez',
    action: {},
    permissions: ['storage', 'unlimitedStorage', 'activeTab', 'tabs', 'sidePanel', 'scripting', 'webNavigation'],
    host_permissions: [
      'https://app.treez.io/*',
      'https://app.sandbox.treez.io/*',
      'https://app.dev.treez.io/*',
      'https://api.treez.io/*',
      'https://api.sandbox.treez.io/*',
      'https://api-dev.treez.io/*',
      'https://api-prod.treez.io/*',
      'https://api.mso.treez.io/*',
      'https://api.mso.sandbox.treez.io/*',
      'https://api-mso-dev.treez.io/*',
      'https://oauth.treez.io/*',
      'https://oauth-dev.treez.io/*',
      'https://*.s3.us-west-2.amazonaws.com/*',
    ],
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // Remove default side_panel entry so we control it programmatically
      delete (manifest as any).side_panel;
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
