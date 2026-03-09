import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';

// Mock chrome.runtime.sendMessage (App.tsx uses raw chrome API for gesture context)
const mockSendMessage = vi.fn();
globalThis.chrome = {
  runtime: { sendMessage: mockSendMessage },
} as any;

import App from '../entrypoints/import-page.content/App';

describe('Content Script App', () => {
  beforeEach(() => {
    cleanup();
    mockSendMessage.mockClear();
  });

  it('renders a "Migrate Catalog" button', () => {
    render(createElement(App));
    expect(screen.getByText('Migrate Catalog')).toBeDefined();
  });

  it('renders a "Migrate Inventory" button', () => {
    render(createElement(App));
    expect(screen.getByText('Migrate Inventory')).toBeDefined();
  });

  it('sends openSidePanel message with wizardType "catalog" on click', () => {
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Catalog'));
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'openSidePanel',
      data: { wizardType: 'catalog' },
    });
  });

  it('sends openSidePanel message with wizardType "inventory" on click', () => {
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Inventory'));
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'openSidePanel',
      data: { wizardType: 'inventory' },
    });
  });
});
