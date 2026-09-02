import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('negative25.locale', 'en');
    localStorage.setItem('negative25.session', JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh', expiresIn: 3600 }));
  });
  const photo = (id: string, title: string, rating: number) => ({
    id, workspaceId: 'workspace-1', title, description: '', published: true, hidden: false, ownerOnly: false, rating,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}-thumb.jpg`, width: 300, height: 200, format: 'jpeg' },
    media: [{ kind: 'large', url: `https://example.com/${id}-large.jpg`, width: 1200, height: 800, format: 'jpeg' }],
    location: { id: `${id}-location`, name: 'Beijing' }, latitude: 39.9, longitude: 116.4,
    metadata: { displayAddress: 'Forbidden City', displayRegion: 'Beijing', displayRegionEnabled: true, latitude: 39.9, longitude: 116.4 },
  });
  const photos = [photo('source', 'Source frame', 7), photo('target', 'Target frame', 3), photo('third', 'Third frame', 5)];
  await page.route('**/api/v1/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'user-1', username: 'owner', email: 'owner@n25.world', name: 'Owner', emailVerifiedAt: null }) }));
  await page.route('**/api/v1/workspaces', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'workspace-1', slug: 'primary', name: 'negative25', role: 'owner' }]) }));
  await page.route('**/api/v1/admin/spaces/primary/photos', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photos) }));
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
