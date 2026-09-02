import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('negative25.locale', 'en');
    localStorage.setItem('negative25.session', JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh', expiresIn: 3600 }));
  });
  const photo = (id: string, title: string, rating: number, importBatch?: { id: string; createdAt: string }) => ({
    id, workspaceId: 'workspace-1', title, description: '', published: true, hidden: false, ownerOnly: false, rating,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}-thumb.jpg`, width: 300, height: 200, format: 'jpeg' },
    media: [{ kind: 'large', url: `https://example.com/${id}-large.jpg`, width: 1200, height: 800, format: 'jpeg' }],
    location: { id: `${id}-location`, name: 'Beijing' }, latitude: 39.9, longitude: 116.4,
    metadata: { displayAddress: 'Forbidden City', displayRegion: 'Beijing', displayRegionEnabled: true, latitude: 39.9, longitude: 116.4 },
    importBatch,
  });
  const photos = [photo('source', 'Source frame', 7, { id: 'batch-new', createdAt: '2026-09-02T10:00:00.000Z' }), photo('target', 'Target frame', 3, { id: 'batch-new', createdAt: '2026-09-02T10:00:00.000Z' }), photo('third', 'Third frame', 5, { id: 'batch-old', createdAt: '2026-09-01T10:00:00.000Z' })];
  await page.route('**/api/v1/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'user-1', username: 'owner', email: 'owner@n25.world', name: 'Owner', emailVerifiedAt: null }) }));
  await page.route('**/api/v1/workspaces', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'workspace-1', slug: 'primary', name: 'negative25', role: 'owner' }]) }));
  await page.route('**/api/v1/admin/spaces/primary/photos', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photos) }));
  await page.route('**/api/v1/admin/spaces/primary/summary', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace: { id: 'workspace-1', slug: 'primary', name: 'negative25', role: 'owner' }, stats: { photoCount: 3, publishedPhotoCount: 3, pendingImportCount: 0 }, recentActivity: [] }) }));
  await page.route('**/api/v1/spaces/primary/imports', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
});

test('overview import action opens the import module', async ({ page }) => {
  await page.goto('/account');
  await page.getByRole('link', { name: 'Import photos' }).click();
  await expect(page).toHaveURL(/\/account\/imports$/);
  await expect(page.getByRole('heading', { name: 'Bring in new work.' })).toBeVisible();
});

test('selects photos, copies source metadata, and previews thumbnails', async ({ page }) => {
  let copyRequest: unknown;
  await page.route('**/api/v1/admin/spaces/primary/photos/bulk-copy', async (route) => {
    copyRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [], skippedIds: [] }) });
  });
  await page.goto('/account/photos');
  await expect(page.getByRole('heading', { name: 'Your photographs.' })).toBeVisible();
  const rows = page.locator('.photo-row');
  await rows.nth(0).getByRole('checkbox').check();
  await rows.nth(1).getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Copy all data' })).toBeEnabled();
  await page.getByRole('button', { name: 'Copy all data' }).click();
  await expect.poll(() => copyRequest).toEqual({ sourcePhotoId: 'source', targetPhotoIds: ['target'], fields: ['location', 'address', 'rating'] });
  await rows.nth(0).getByRole('button', { name: 'Preview photo' }).click();
  await expect(page.getByRole('dialog', { name: 'Preview photo' })).toBeVisible();
  await page.locator('.photo-preview-overlay').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('dialog', { name: 'Preview photo' })).toHaveCount(0);
});

test('copies source status and updates the target row', async ({ page }) => {
  let copyRequest: unknown;
  await page.route('**/api/v1/admin/spaces/primary/photos/bulk-copy', async (route) => {
    copyRequest = route.request().postDataJSON();
    const target = {
      id: 'target', workspaceId: 'workspace-1', title: 'Target frame', description: '', published: true, hidden: false, ownerOnly: true, rating: 3,
      thumbnail: { kind: 'thumbnail', url: 'https://example.com/target-thumb.jpg', width: 300, height: 200, format: 'jpeg' },
      media: [{ kind: 'large', url: 'https://example.com/target-large.jpg', width: 1200, height: 800, format: 'jpeg' }],
      location: { id: 'target-location', name: 'Beijing' }, latitude: 39.9, longitude: 116.4,
      metadata: { ownerOnly: true, displayAddress: 'Forbidden City', displayRegion: 'Beijing', displayRegionEnabled: true, latitude: 39.9, longitude: 116.4 },
      importBatch: { id: 'batch-new', createdAt: '2026-09-02T10:00:00.000Z' },
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [target], skippedIds: [] }) });
  });
  await page.goto('/account/photos');
  const rows = page.locator('.photo-row');
  await rows.nth(0).getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Copy status' })).toBeDisabled();
  await rows.nth(1).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Copy status' }).click();
  await expect.poll(() => copyRequest).toEqual({ sourcePhotoId: 'source', targetPhotoIds: ['target'], fields: ['status'] });
  await expect(rows.nth(1).locator('select.status-select')).toHaveValue('ownerOnly');
});

test('groups photos by import batch and keeps each group together', async ({ page }) => {
  await page.goto('/account/photos');
  const headings = page.locator('.photo-batch-heading');
  await expect(headings).toHaveCount(2);
  await expect(headings.nth(0)).toContainText('Import batch');
  await expect(headings.nth(0)).toContainText('2 photos');
  await expect(headings.nth(1)).toContainText('1 photo');
  await expect(page.locator('.photo-row')).toHaveCount(3);
});

test('deletes one selected photo after confirmation', async ({ page }) => {
  let deleteRequest: string | undefined;
  await page.route('**/api/v1/admin/spaces/primary/photos/source', async (route) => {
    if (route.request().method() === 'DELETE') { deleteRequest = route.request().method(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); return; }
    await route.continue();
  });
  await page.goto('/account/photos');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.photo-row').nth(0).getByRole('button', { name: 'Delete photo' }).click();
  await expect.poll(() => deleteRequest).toBe('DELETE');
});
