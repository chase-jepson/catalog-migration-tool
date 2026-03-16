import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';

import App from '../entrypoints/import-page.content/App';

describe('Content Script App', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders a "Migrate Catalog" button', () => {
    render(createElement(App));
    expect(screen.getByText('Migrate Catalog')).toBeDefined();
  });

  it('renders a "Migrate Inventory" button', () => {
    render(createElement(App));
    expect(screen.getByText('Migrate Inventory')).toBeDefined();
  });

  it('dispatches cmt:open-wizard event with wizardType "catalog" on click', () => {
    const handler = vi.fn();
    document.addEventListener('cmt:open-wizard', handler);
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Catalog'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ wizardType: 'catalog' });
    document.removeEventListener('cmt:open-wizard', handler);
  });

  it('dispatches cmt:open-wizard event with wizardType "inventory" on click', () => {
    const handler = vi.fn();
    document.addEventListener('cmt:open-wizard', handler);
    render(createElement(App));
    fireEvent.click(screen.getByText('Migrate Inventory'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ wizardType: 'inventory' });
    document.removeEventListener('cmt:open-wizard', handler);
  });
});
