import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'en'));
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
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto('/discover');
  const search = page.getByRole('searchbox', { name: 'Search places' });
  await search.fill('Alpine');
  await expect(page.getByRole('button', { name: /Alpine light/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /After rain/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Alpine light/ }).click();
  await expect(page).toHaveURL(/\/photo\/alpine-light(?:\?.*)?$/);
});

test('discover photo return keeps the live map instance', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
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
