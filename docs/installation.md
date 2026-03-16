# Installation

## Download & Install (Recommended)

No development tools required -- just Chrome.

1. Go to the [Releases page](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/releases) and download the latest ZIP
2. Create a new folder (e.g., `catalog-migration-tool` on your Desktop)
3. Extract the ZIP contents **into that folder** -- you should see these files inside:
   ```
   catalog-migration-tool/
   ├── manifest.json
   ├── background.js
   └── content-scripts/
       ├── import-page.js
       ├── wizard-drawer.js
       └── wizard-drawer.css
   ```
4. Open Chrome and go to `chrome://extensions/`
5. Enable **Developer mode** using the toggle in the top-right corner
6. Click **Load unpacked**
7. Select the folder you created in step 2 (the one containing `manifest.json`)
8. The extension icon should appear in your Chrome toolbar

> **Important:** Do not delete or move this folder after loading -- Chrome references it directly. If you move it, you'll need to re-load the extension from the new location.

## Build from Source

If you prefer to build from source (or want to contribute):

### Prerequisites

- **Node.js** 18 or later
- **pnpm** (recommended) or npm
- **Google Chrome** (the extension requires Manifest V3 APIs)

```bash
# Clone the repository
git clone https://gitlab.com/chase_jepson/catalog-migration-tool-v2.git
cd catalog-migration-tool-v2

# Install dependencies
pnpm install

# Build for production
pnpm build
```

The build output is in `.output/chrome-mv3/`.

## Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` directory
5. The extension icon should appear in your Chrome toolbar

## Verify Installation

1. Navigate to any Treez environment:
   - Production: `https://app.treez.io/treez-admin/import/home`
   - Sandbox: `https://app.sandbox.treez.io/treez-admin/import/home`
   - Dev: `https://app.dev.treez.io/treez-admin/import/home`
2. You should see **Migrate Catalog** and **Migrate Inventory** buttons on the page
3. Make sure you are logged into Treez -- the extension uses your existing session token

## Development Mode

For development with hot reload:

```bash
pnpm dev
```

This starts a dev server that watches for file changes and automatically reloads the extension in Chrome. After running `pnpm dev`, load the extension from `.output/chrome-mv3-dev/` instead.

## Generating an Installable ZIP

To create a distributable ZIP file:

```bash
pnpm zip
```

This generates a ZIP in the `.output/` directory that can be shared with other users who can then load it as an unpacked extension.

## Supported Environments

The extension works across all Treez environments without reconfiguration:

| Environment | URL |
|------------|-----|
| Production | `app.treez.io` |
| Sandbox | `app.sandbox.treez.io` |
| Dev | `app.dev.treez.io` |

The extension automatically detects which environment you're on and uses the correct API endpoints.
