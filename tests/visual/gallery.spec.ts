import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'en'));
});

test('gallery has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Photo gallery' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('location picker stays within the viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Region' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a location' });
  await expect(picker).toBeVisible();
  const box = await picker.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
});

for (const route of ['/discover', '/about', '/albums', '/photo/alpine-light', '/admin/login']) {
  test(`${route} has no horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
