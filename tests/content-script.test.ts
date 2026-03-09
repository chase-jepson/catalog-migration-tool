import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';

// Mock the messaging module before importing App
vi.mock('../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

import { sendMessage } from '../lib/messaging';
import App from '../entrypoints/import-page.content/App';

const mockSendMessage = vi.mocked(sendMessage);

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

  it('calls sendMessage with wizardType "catalog" when Migrate Catalog is clicked', () => {
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Catalog'));
    expect(mockSendMessage).toHaveBeenCalledWith(
      'openSidePanel',
      expect.objectContaining({ wizardType: 'catalog' }),
    );
  });

  it('calls sendMessage with wizardType "inventory" when Migrate Inventory is clicked', () => {
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Inventory'));
    expect(mockSendMessage).toHaveBeenCalledWith(
      'openSidePanel',
      expect.objectContaining({ wizardType: 'inventory' }),
    );
  });
});
