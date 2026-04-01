import { IMPORT_PAGE_PATTERNS } from "../../lib/constants";
import { onMessage } from "../../lib/messaging";
import { PORTAL_BASE_URL } from "../../lib/runtime-origins";
import { getValidToken } from "./auth";

export default defineBackground(() => {
  // Allow content scripts to access session storage
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

  // When extension icon is clicked, tell the content script to open the drawer
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;
    if (isImportPageUrl(tab.url)) {
      // Content script is already injected — dispatch custom event to open drawer
      chrome.tabs.sendMessage(tab.id, { type: "openDrawer", wizardType: "catalog" });
    }
  });

  /**
   * Check if a URL matches one of the Treez import page patterns.
   * Patterns use glob-style * wildcards, converted to regex.
   */
  function isImportPageUrl(url: string): boolean {
    return IMPORT_PAGE_PATTERNS.some((pattern) => {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(url);
    });
  }

  // Handle getAuthToken messages via typed messaging
  onMessage("getAuthToken", async (message) => {
    const { appUrl } = message.data;
    // Side panel messages don't have sender.tab, so query the active tab
    let tabId = message.sender.tab?.id;
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = activeTab?.id;
    }
    if (!tabId) return { token: null };

    const token = await getValidToken(tabId, appUrl);
    return { token };
  });

  // Handle getPresignedUrl -- fetch presigned S3 upload URL from Treez file-management API
  onMessage("getPresignedUrl", async (message) => {
    const { apiBaseUrl, token, params } = message.data;
    const res = await fetch(`${apiBaseUrl}/file/v1/presignedUrl`, {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        contentType: "text/csv",
        checksumAlgorithm: "SHA256",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Presigned URL request failed (${res.status}): ${text}`);
    }

    return res.json();
  });

  // Handle uploadToS3 -- PUT CSV content to presigned S3 URL (bypasses CORS)
  onMessage("uploadToS3", async (message) => {
    const { presignedUrl, csvContent } = message.data;
    try {
      const res = await fetch(presignedUrl, {
        method: "PUT",
        credentials: "omit",
        headers: { "Content-Type": "text/csv" },
        body: csvContent,
      });

      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `S3 upload failed (${res.status}): ${text}` };
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "S3 upload failed",
      };
    }
  });

  // Handle fetchImportReport -- GET import job statuses from Treez API
  onMessage("fetchImportReport", async (message) => {
    const { apiBaseUrl, token } = message.data;
    const res = await fetch(`${apiBaseUrl}/import/v1/report`, {
      credentials: "omit",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Import report request failed (${res.status})`);
    }

    const body = await res.json();
    return body.data;
  });

  // Handle fetchStores -- POST to MSO API to get entity/store details
  onMessage("fetchStores", async (message) => {
    const { apiBaseUrl, token, orgId, entityIds } = message.data;
    const res = await fetch(
      `${apiBaseUrl}/organization/v1/organizations/${orgId}/entities/details`,
      {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entityIds }),
      },
    );
    if (!res.ok) throw new Error(`Store fetch failed (${res.status})`);
    const data = await res.json();
    // Map API response fields to StoreInfo shape
    return (data as any[]).map((entity: any) => ({
      entityId: entity.id,
      name: entity.name,
    }));
  });

  // ── Portal API handlers ──────────────────────────────────────────────────

  // Handle portalLogin -- authenticate with portal and return token + user info
  onMessage("portalLogin", async (message) => {
    const { username, password } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/auth/login`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.status === 401) {
      throw new Error("Invalid credentials");
    }
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? "Missing required role");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Portal login failed (${res.status}): ${text}`);
    }

    return res.json();
  });

  // Handle portalFetchStores -- get list of configured stores from portal
  onMessage("portalFetchStores", async (message) => {
    const { portalToken } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/stores`, {
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
    });

    if (!res.ok) {
      throw new Error(`Portal store fetch failed (${res.status})`);
    }

    return res.json();
  });

  // Handle portalValidate -- upload CSV to portal for server-side validation
  onMessage("portalValidate", async (message) => {
    const { portalToken, csvContent, storeId, fileName } = message.data;

    // Build multipart form data
    const blob = new Blob([csvContent], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("store_id", storeId);

    const res = await fetch(`${PORTAL_BASE_URL}/api/import/upload`, {
      method: "POST",
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
      body: formData,
    });

    if (res.status === 409) {
      throw new Error("This store is currently locked. Please unlock it before uploading.");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Portal validation failed (${res.status}): ${text}`);
    }

    return res.json();
  });

  // Handle portalExecute -- approve and launch a VALIDATED import job
  onMessage("portalExecute", async (message) => {
    const { portalToken, jobId } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/import/jobs/${jobId}/execute`, {
      method: "POST",
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    if (res.status === 409) {
      throw new Error(
        "This job can no longer be executed. It may have already been started, cancelled, or rolled back.",
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Portal execute failed (${res.status}): ${text}`);
    }
    return res.json();
  });

  // Handle portalGetJob -- poll job status
  onMessage("portalGetJob", async (message) => {
    const { portalToken, jobId } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/import/jobs/${jobId}`, {
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    if (!res.ok) {
      throw new Error(`Portal job fetch failed (${res.status})`);
    }
    return res.json();
  });

  // Handle portalRollback -- rollback a completed/failed import
  onMessage("portalRollback", async (message) => {
    const { portalToken, jobId } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/import/jobs/${jobId}/rollback`, {
      method: "POST",
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    if (res.status === 409) {
      throw new Error(
        "This job cannot be rolled back. Only completed or failed imports can be rolled back.",
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Portal rollback failed (${res.status}): ${text}`);
    }
    return res.json();
  });

  // Handle portalCancel -- cancel a VALIDATED import job
  onMessage("portalCancel", async (message) => {
    const { portalToken, jobId } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/import/jobs/${jobId}/cancel`, {
      method: "POST",
      credentials: "omit",
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    if (res.status === 409) {
      throw new Error(
        "This job can no longer be cancelled. It may have already been executed or cancelled.",
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Portal cancel failed (${res.status}): ${text}`);
    }
    return res.json();
  });

  // Handle portalReindex -- trigger OpenSearch reindex for a store
  onMessage("portalReindex", async (message) => {
    const { portalToken, storeId, username, password } = message.data;
    const res = await fetch(`${PORTAL_BASE_URL}/api/import/reindex/${storeId}`, {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${portalToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    if (res.status === 401) {
      throw new Error("IOMT authentication failed. Check your credentials.");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Reindex failed (${res.status}): ${text}`);
    }
    return res.json();
  });
});
