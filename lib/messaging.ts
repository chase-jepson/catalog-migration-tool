import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ImportJob, StoreInfo } from './types';

interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  openSidePanel(data: {
    tabId: number;
    wizardType: 'catalog' | 'inventory';
  }): void;
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
  uploadToS3(data: {
    presignedUrl: string;
    csvContent: string;
    contentLength: number;
  }): { ok: boolean; error?: string };
  fetchImportReport(data: {
    apiBaseUrl: string;
    token: string;
  }): ImportJob[];
  fetchStores(data: {
    apiBaseUrl: string;
    token: string;
    orgId: string;
    entityIds: string[];
  }): StoreInfo[];
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
