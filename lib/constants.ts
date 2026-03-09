import type { TreezEnv } from './env';

export const IMPORT_PAGE_PATTERNS = [
  'https://app.treez.io/treez-admin/import/home*',
  'https://app.sandbox.treez.io/treez-admin/import/home*',
  'https://app.dev.treez.io/treez-admin/import/home*',
];

export const STEP_LABELS = ['Upload', 'Map', 'Review', 'Import'] as const;

export const TREEZ_HOSTS: Record<TreezEnv, string> = {
  production: 'app.treez.io',
  sandbox: 'app.sandbox.treez.io',
  dev: 'app.dev.treez.io',
};

export const IMPORT_PATH = '/treez-admin/import/home';
