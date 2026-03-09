import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  openSidePanel(data: {
    tabId: number;
    wizardType: 'catalog' | 'inventory';
  }): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
