import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/snapshots',
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: { command: 'pnpm --filter @negative25/web exec vite --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }, { name: 'mobile', use: { ...devices['iPhone 13'] } }],
});
