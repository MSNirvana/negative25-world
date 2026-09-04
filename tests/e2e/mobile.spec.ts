import { test, expect } from '@playwright/test';

type MockPhoto = {
  id: string;
  title: string;
  aspectRatio: number;
  rating: number;
  thumbnail: { kind: 'thumbnail'; url: string; width: number; height: number; format: string };
  media: Array<{ kind: 'large'; url: string; width: number; height: number; format: string }>;
  spaceSlug: string;
  description: string;
  capturedAt: string;
  location: null | { id: string; name: string };
  metadata: Record<string, unknown>;
};

function photo(id: string, aspectRatio = 1.5): MockPhoto {
  return {
    id,
    title: `Mobile frame ${id}`,
    aspectRatio,
    rating: 5,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 900, height: 600, format: 'jpeg' },
    media: [{ kind: 'large', url: `https://example.com/${id}-large.jpg`, width: 1800, height: 1200, format: 'jpeg' }],
    spaceSlug: 'primary',
    description: 'Mobile test frame',
    capturedAt: '2026-01-02T03:04:05.000Z',
    location: null,
    metadata: {},
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'en'));
});

test('mobile gallery uses two stable columns without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const photos = Array.from({ length: 8 }, (_, index) => photo(String(index), index % 2 ? 0.8 : 1.5));
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos, pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.goto('/');
  await expect(page.locator('.photo-grid')).toBeVisible();
  await expect(page.locator('.photo-column')).toHaveCount(2);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    grid: document.querySelector('.photo-grid')?.getBoundingClientRect().toJSON(),
    columns: [...document.querySelectorAll('.photo-column')].map((element) => element.getBoundingClientRect().toJSON()),
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.columns[0]?.width).toBeLessThan((metrics.grid?.width ?? 0) * 0.6);
});

test('mobile album spread fits its container', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cover = photo('cover', 1.5);
  const second = photo('second', 0.8);
  const third = photo('third', 1.2);
  const albumId = 'mobile-album';
  await page.route('**/api/v1/spaces/primary/albums', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ albums: [{ id: albumId, spaceSlug: 'primary', title: 'Mobile album', shootDate: '2026-01-02', cover, photoCount: 3 }] }) });
  });
  await page.route(`**/api/v1/spaces/primary/albums/${albumId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: albumId, spaceSlug: 'primary', title: 'Mobile album', shootDate: '2026-01-02', cover, photoCount: 3, photos: [cover, second, third] }) });
  });
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [], pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Albums' }).click();
  await page.getByRole('button', { name: 'Expand album Mobile album' }).click();
  await expect(page.locator('.album-expanded')).toBeVisible();
  const metrics = await page.evaluate(() => {
    const spread = document.querySelector('.album-spread')?.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.album-photo-row')].map((element) => element.getBoundingClientRect());
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, spread, rows };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.rows.every((row) => row.right <= (metrics.spread?.right ?? 0) + 1)).toBe(true);
});

test('mobile photo viewer keeps image and metadata inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  const current = photo('detail', 0.8);
  current.title = 'Mobile detail';
  current.metadata = { camera: 'NIKON Z6_3', lens: '24-70mm', focalLength: '50mm', aperture: 'f/2.8', shutterSpeed: '1/250s', iso: 'ISO 100' };
  await page.route('**/api/v1/photos/detail', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) });
  });
  await page.goto('/photo/detail?space=primary');
  await expect(page.getByRole('dialog', { name: 'Mobile detail' })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    image: document.querySelector('.viewer-image img')?.getBoundingClientRect().toJSON(),
    info: document.querySelector('.viewer-info')?.getBoundingClientRect().toJSON(),
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect((metrics.image?.right ?? 0)).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect((metrics.info?.left ?? 0)).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'View detailed photo metadata' }).click();
  await expect(page.getByRole('dialog', { name: 'Detailed photo information' })).toBeVisible();
  const detailRect = await page.locator('.detail-panel').boundingBox();
  expect(detailRect).not.toBeNull();
  expect((detailRect?.right ?? 0)).toBeLessThanOrEqual(430);
});
