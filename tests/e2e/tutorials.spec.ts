import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'zh'));
});

test('basic tutorial is one complete interactive photography lab', async ({ page }) => {
  await page.goto('/tutorials');
  await expect(page).toHaveURL(/\/tutorials$/);
  await expect(page.getByRole('heading', { name: '拿起相机，然后走出去。' })).toBeVisible();
  await expect(page.getByText('别把摄影当作任务，它只是生活的点缀。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '一张照片，现场调出来' }).first()).toBeVisible();
  await expect(page.getByText('浏览全部教程')).toHaveCount(0);

  const camera = page.getByTestId('camera-360');
  await expect(camera).toBeVisible();
  await expect(camera).toHaveAttribute('data-rendered', 'true');
  const box = await camera.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.45, { steps: 8 });
    await page.mouse.up();
  }
  await expect(camera).toHaveAttribute('data-interacted', 'true');

  await expect(page.getByRole('slider')).toHaveCount(7);
  for (const name of ['光圈', '快门', '感光度', '曝光补偿', '焦距', '对焦位置', '白平衡']) {
    await expect(page.getByRole('slider', { name })).toBeVisible();
  }

  await page.getByRole('tab', { name: '夜间车流' }).click();
  await expect(page.locator('.sim-stage-scene')).toHaveText('夜间车流');
  await page.getByRole('button', { name: '原始画面' }).click();
  await expect(page.locator('.sim-stage-label')).toHaveText('原始画面');
});

test('simulator updates settings and reset restores its defaults', async ({ page }) => {
  await page.goto('/tutorials');
  const current = page.getByTestId('simulator-current');
  await expect(current).toContainText('f/2.8');
  await page.getByRole('slider', { name: '光圈' }).fill('8');
  await page.getByRole('slider', { name: '感光度' }).fill('6');
  await expect(current).toContainText('f/8');
  await expect(current).toContainText('ISO 6400');
  await page.getByRole('tab', { name: '溪流与水面' }).click();
  await page.getByRole('button', { name: '重置参数' }).click();
  await expect(current).toContainText('f/2.8');
  await expect(current).toContainText('ISO 400');
  await expect(page.getByRole('tab', { name: '窗边人像' })).toHaveAttribute('aria-selected', 'true');
});

test('equipment atlas switches categories and explains concrete use cases', async ({ page }) => {
  await page.goto('/tutorials?category=equipment');
  await expect(page.getByRole('heading', { name: '设备要解决什么问题' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '全画幅相机' })).toBeVisible();

  await page.getByRole('button', { name: '镜头', exact: true }).click();
  await expect(page.getByRole('button', { name: /NIKKOR Z 100-400mm/ })).toBeVisible();
  await page.getByRole('button', { name: /NIKKOR Z 14-24mm f\/2.8/ }).click();
  await expect(page.getByRole('heading', { name: 'NIKKOR Z 14-24mm f/2.8' })).toBeVisible();
  await expect(page.getByText('大景与建筑：容纳更多现场信息，注意边缘的线条和人物比例。')).toBeVisible();

  await page.getByRole('button', { name: '支撑与周边', exact: true }).click();
  await page.getByRole('button', { name: /三脚架/ }).click();
  await expect(page.getByText('光轨与车轨：让建筑不动，只让车灯留下线条。')).toBeVisible();
});

test('advanced tutorial switches complete shooting and post workflows', async ({ page }) => {
  await page.goto('/tutorials?category=advanced');
  await expect(page.getByRole('heading', { name: '从一张案例图到成片' })).toBeVisible();
  await expect(page.getByRole('button', { name: /山谷银河/ })).toHaveClass(/active/);
  await expect(page.getByText('14mm · f/2.8 · 15s · ISO 3200')).toBeVisible();

  await page.getByRole('button', { name: /桌面焦点合成/ }).click();
  await expect(page.getByText('现场拍摄')).toBeVisible();
  await expect(page.getByText('后期处理')).toBeVisible();
  await expect(page.getByText('固定主体和机位，先标出最近和最远的清晰位置。')).toBeVisible();
  await expect(page.getByText('在 Lightroom、Photoshop 或 Helicon Focus 对齐并自动混合。')).toBeVisible();
});

test('all tutorial categories stay inside a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const category of ['basic', 'equipment', 'advanced']) {
    await page.goto(`/tutorials?category=${category}`);
    await expect(page.locator('.tutorial-intro')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await expect(page.locator('.case-browser')).toBeVisible();
  await page.getByRole('button', { name: /溪流长曝光/ }).click();
  await expect(page.getByText('20mm · f/11 · 1.3s · ISO 64')).toBeVisible();
});
