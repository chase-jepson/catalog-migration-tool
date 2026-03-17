import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  ImportJob,
  PortalAuthState,
  PortalJobStatus,
  PortalReindexResult,
  PortalRollbackResult,
  PortalStore,
  PortalValidationResult,
  StoreInfo,
} from "./types";

interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  getPresignedUrl(data: {
    apiBaseUrl: string;
    token: string;
    params: {
      name: string;
      contentLength: number;
      objectType: string;
      objectId: string;
    };
  }): { fileId: string; presignedUrl: string };
  uploadToS3(data: { presignedUrl: string; csvContent: string; contentLength: number }): {
    ok: boolean;
    error?: string;
  };
  fetchImportReport(data: { apiBaseUrl: string; token: string }): ImportJob[];
  fetchStores(data: {
    apiBaseUrl: string;
    token: string;
    orgId: string;
    entityIds: string[];
  }): StoreInfo[];
  portalLogin(data: { username: string; password: string }): PortalAuthState;
  portalFetchStores(data: { portalToken: string }): PortalStore[];
  portalValidate(data: {
    portalToken: string;
    csvContent: string;
    storeId: string;
    fileName: string;
  }): PortalValidationResult;
  portalExecute(data: { portalToken: string; jobId: string }): { status: string; job_id: string };
  portalGetJob(data: { portalToken: string; jobId: string }): PortalJobStatus;
  portalRollback(data: { portalToken: string; jobId: string }): PortalRollbackResult;
  portalCancel(data: { portalToken: string; jobId: string }): { status: string; job_id: string };
  portalReindex(data: {
    portalToken: string;
    storeId: string;
    username: string;
    password: string;
  }): PortalReindexResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
