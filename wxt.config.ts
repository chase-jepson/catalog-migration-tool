import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Catalog Migration Tool",
    description:
      "Migrate product catalog and inventory data from other POS systems into Treez.",
    icons: {
      16: "icon-16.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {},
    permissions: ["storage", "unlimitedStorage", "activeTab", "tabs", "scripting"],
    host_permissions: [
      "https://app.treez.io/*",
      "https://app.sandbox.treez.io/*",
      "https://app.dev.treez.io/*",
      "https://api.treez.io/*",
      "https://api.sandbox.treez.io/*",
      "https://api-dev.treez.io/*",
      "https://api-prod.treez.io/*",
      "https://api.mso.treez.io/*",
      "https://api.mso.sandbox.treez.io/*",
      "https://api-mso-dev.treez.io/*",
      "https://oauth.treez.io/*",
      "https://oauth-dev.treez.io/*",
      "https://*.s3.us-west-2.amazonaws.com/*",
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
