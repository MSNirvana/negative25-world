import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'zh'));
});

test('tutorial library exposes the three learning sections and a detail route', async ({ page }) => {
  await page.goto('/tutorials');
  await expect(page).toHaveURL(/\/tutorials$/);
  await expect(page.getByRole('heading', { name: '拿起相机，然后走出去。' })).toBeVisible();
  await expect(page.getByText('别把摄影当作任务，它只是生活的点缀。')).toBeVisible();
  await expect(page.getByAltText('Nikon Z6 III 相机')).toBeVisible();
  await expect(page.getByText('浏览全部教程')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '全部' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '先理解一张照片如何成立' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '知道设备在什么时候真正有用' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '把时间、光线和细节变成方法' })).toBeVisible();
  await expect(page.getByRole('button', { name: /曝光三要素/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /曝光三要素/ }).first().click();
  await expect(page).toHaveURL(/\/tutorials\/exposure-triangle$/);
  await expect(page.getByRole('heading', { name: '曝光三要素：光圈、快门、ISO' })).toBeVisible();
  await expect(page.getByRole('region', { name: '曝光三要素：光圈、快门、ISO' })).toBeVisible();
});

test('exposure simulator updates its current settings and can reset', async ({ page }) => {
  await page.goto('/tutorials/exposure-triangle');
  const current = page.getByTestId('simulator-current');
  await expect(current).toContainText('f/2.8');
  const aperture = page.getByRole('slider', { name: '光圈' });
  await aperture.fill('8');
  await expect(current).toContainText('f/8');
  await page.getByRole('button', { name: '重置参数' }).click();
  await expect(current).toContainText('f/2.8');
});

test('tutorial pages keep the mobile layout inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tutorials');
  await expect(page.locator('.tutorial-intro')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button', { name: /曝光三要素/ }).first().click();
  await expect(page.locator('.tutorial-simulator')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
