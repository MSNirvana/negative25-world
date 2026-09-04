import { test, expect, type Page } from '@playwright/test';

const fallbackPhotos = [
  { id: 'alpine-light', spaceSlug: 'primary', title: 'Alpine light', description: 'Quiet light across the high country', capturedAt: '2025-10-12T03:04:05.000Z', rating: 6, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/alpine.jpg', width: 900, height: 600, format: 'jpeg' }, media: [], location: null, metadata: {} },
  { id: 'after-rain', spaceSlug: 'primary', title: 'After rain', description: 'A short pause on the forest trail', capturedAt: '2025-09-08T03:04:05.000Z', rating: 5, aspectRatio: 0.78, thumbnail: { kind: 'thumbnail', url: 'https://example.com/rain.jpg', width: 600, height: 770, format: 'jpeg' }, media: [], location: null, metadata: {} },
];

async function mockFallbackPhotos(page: Page): Promise<void> {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: fallbackPhotos, pagination: { nextCursor: null, hasMore: false } }) });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'en'));
});

test('discover search selects a place result in the left panel without a detail module', async ({ page }) => {
  const photos = [
    { id: '11111111-1111-4111-8111-111111111111', spaceSlug: 'primary', title: 'Dublin rain', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: 5, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/ireland-1.jpg', width: 900, height: 600, format: 'jpeg' }, media: [], location: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Ireland' }, metadata: {} },
    { id: '22222222-2222-4222-8222-222222222222', spaceSlug: 'primary', title: 'Coastal light', description: '', capturedAt: '2025-12-02T03:04:05.000Z', rating: 6, aspectRatio: 0.8, thumbnail: { kind: 'thumbnail', url: 'https://example.com/ireland-2.jpg', width: 600, height: 750, format: 'jpeg' }, media: [], location: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Ireland' }, metadata: {} },
    { id: '33333333-3333-4333-8333-333333333333', spaceSlug: 'primary', title: 'Hokkaido snow', description: '', capturedAt: '2025-11-02T03:04:05.000Z', rating: 7, aspectRatio: 1.33, thumbnail: { kind: 'thumbnail', url: 'https://example.com/japan-1.jpg', width: 800, height: 600, format: 'jpeg' }, media: [], location: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Japan' }, metadata: {} },
  ];
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos, pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.route('**/api/v1/discover/locations*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locations: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Ireland', parentId: null, latitude: 53.35, longitude: -6.26, photoIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Japan', parentId: null, latitude: 43.06, longitude: 141.35, photoIds: ['33333333-3333-4333-8333-333333333333'] },
    ] }) });
  });

  await page.goto('/discover');
  const panel = page.locator('.place-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('searchbox', { name: 'Search places' }).fill('Ireland');
  await expect(panel.locator('.search-result')).toHaveCount(1);
  await expect(panel.locator('.search-result')).toContainText('Ireland');
  await panel.locator('.search-result').click();
  await expect(panel.locator('.location-result')).toBeVisible();
  await expect(panel.locator('.result-photo')).toHaveCount(2);
  await expect(page.locator('.place-detail')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Back to search results' }).click();
  await expect(panel.locator('.search-result')).toHaveCount(1);
});

test('discover featured and recent sections can be collapsed independently', async ({ page }) => {
  const photos = [
    { id: '44444444-4444-4444-8444-444444444444', spaceSlug: 'primary', title: 'Featured frame', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: 5, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/featured-1.jpg', width: 900, height: 600, format: 'jpeg' }, media: [], location: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Featured place' }, metadata: {} },
    { id: '55555555-5555-4555-8555-555555555555', spaceSlug: 'primary', title: 'Recent frame', description: '', capturedAt: '2026-02-02T03:04:05.000Z', rating: 5, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/recent-1.jpg', width: 900, height: 600, format: 'jpeg' }, media: [], location: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Recent place' }, metadata: {} },
  ];
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos, pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.route('**/api/v1/discover/locations*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locations: [
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Featured place', parentId: null, latitude: 50, longitude: 10, photoIds: ['44444444-4444-4444-8444-444444444444'] },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Recent place', parentId: null, latitude: 51, longitude: 11, photoIds: ['55555555-5555-4555-8555-555555555555'] },
    ] }) });
  });

  await page.goto('/discover');
  const sections = page.locator('.place-section');
  const featured = sections.filter({ hasText: 'Featured' }).first();
  const recent = sections.filter({ hasText: 'Recently updated' }).first();
  await expect(featured.locator('.place-rail')).toBeVisible();
  await expect(recent.locator('.place-rail')).toBeVisible();
  await featured.getByRole('button').first().click();
  await expect(featured.locator('.place-rail')).toHaveCount(0);
  await expect(recent.locator('.place-rail')).toBeVisible();
});

test('discover renders the AMap world map shell and data-aware panel', async ({ page }) => {
  await page.goto('/discover');
  await expect(page.getByRole('region', { name: 'Places map' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'negative25 field map' })).toBeVisible();
  await expect(page.locator('.amap-container')).toBeVisible();
  await expect(page.locator('.map-attribution')).toContainText('AMap');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset map view' })).toBeVisible();
  await expect(page.locator('.amap-logo')).toBeHidden();
  await expect(page.locator('.amap-copyright')).toBeHidden();
  await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlocated photos' })).toBeVisible();
  await expect(page.locator('.panel-notice')).toHaveCount(0);
  await expect(page.getByText('Asia explored')).toHaveCount(0);
  await expect(page.locator('.panel-scroll')).toHaveCSS('overflow-y', 'auto');

  const search = page.getByRole('searchbox', { name: 'Search places' });
  await search.fill('Alpine');
  await expect(page.locator('.clear-search')).toHaveCount(1);
});

test('discover map surfaces follow the selected visual theme', async ({ page }) => {
  await page.goto('/discover');
  const panel = page.locator('.place-panel');
  const control = page.locator('.map-control').first();
  const themeMenu = page.getByRole('button', { name: 'Change theme' });

  await themeMenu.click();
  await page.getByRole('menuitemradio', { name: 'Paper' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await expect(panel).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.95)');
  await expect(control).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.9)');

  await themeMenu.click();
  await page.getByRole('menuitemradio', { name: 'Mist' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mist');
  await expect(panel).toHaveCSS('background-color', 'rgba(247, 249, 250, 0.95)');
  await expect(control).toHaveCSS('background-color', 'rgba(247, 249, 250, 0.9)');
});

test('discover map controls remain usable and restore the world view', async ({ page }) => {
  await page.goto('/discover');
  const zoomReadout = page.locator('.zoom-readout');
  await expect(zoomReadout).toHaveText('200%');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomReadout).not.toHaveText('200%');
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await expect(zoomReadout).toHaveText('200%');
});

test('discover search filters unlocated photographs and opens the shared photo route', async ({ page }) => {
  await mockFallbackPhotos(page);
  await page.goto('/discover');
  const search = page.getByRole('searchbox', { name: 'Search places' });
  await search.fill('Alpine');
  await expect(page.getByRole('button', { name: /Alpine light/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /After rain/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Alpine light/ }).click();
  await expect(page).toHaveURL(/\/photo\/alpine-light(?:\?.*)?$/);
});

test('discover photo return keeps the live map instance', async ({ page }) => {
  await mockFallbackPhotos(page);
  await page.goto('/discover');
  const map = page.locator('.amap-container');
  await expect(map).toBeVisible();
  await map.evaluate((element) => {
    (element.ownerDocument.defaultView as Window & { __negative25MapIdentity?: Element }).__negative25MapIdentity = element;
  });
  await page.getByRole('button', { name: /Alpine light/ }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close photo' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(map).toBeVisible();
  expect(await map.evaluate((element) => (element.ownerDocument.defaultView as Window & { __negative25MapIdentity?: Element }).__negative25MapIdentity === element)).toBe(true);
});

test('discover mobile panel keeps the view switch clear of the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  const panel = page.locator('.place-panel');
  await expect(panel).toHaveClass(/mobile/);
  const collapsedHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  await page.locator('.panel-toggle').click();
  await expect(panel).toHaveClass(/expanded/);
  await page.waitForTimeout(350);
  const expandedHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  expect(expandedHeight).toBeGreaterThan(collapsedHeight + 250);
  const selector = page.locator('.view-selector');
  const selectorRect = await selector.evaluate((element) => element.getBoundingClientRect().toJSON());
  const panelRect = await panel.evaluate((element) => element.getBoundingClientRect().toJSON());
  expect(selectorRect.bottom).toBeLessThanOrEqual(panelRect.bottom + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
