import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { HOST_PERMISSIONS } from "./lib/runtime-origins";

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
    host_permissions: [...HOST_PERMISSIONS],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
