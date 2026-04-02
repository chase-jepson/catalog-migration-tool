import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  ImportJob,
  PortalJobStatus,
  PortalReindexResult,
  PortalRollbackResult,
  PortalSessionInfo,
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
  portalLogin(data: { username: string; password: string }): PortalSessionInfo;
  portalGetSession(data: Record<string, never>): PortalSessionInfo | null;
  portalFetchStores(data: Record<string, never>): PortalStore[];
  portalValidate(data: { csvContent: string; storeId: string; fileName: string }): PortalValidationResult;
  portalExecute(data: { jobId: string }): { status: string; job_id: string };
  portalGetJob(data: { jobId: string }): PortalJobStatus;
  portalRollback(data: { jobId: string }): PortalRollbackResult;
  portalCancel(data: { jobId: string }): { status: string; job_id: string };
  portalReindex(data: {
    storeId: string;
    username: string;
    password: string;
  }): PortalReindexResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
