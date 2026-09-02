import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('negative25.locale', 'en'));
  const photo = (id: string, title: string, description: string, rating: number, aspectRatio = 1.5) => ({
    id,
    spaceSlug: 'primary',
    title,
    description,
    capturedAt: '2025-10-12T03:04:05.000Z',
    rating,
    aspectRatio,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 900, height: 600, format: 'jpeg' },
    media: [],
    location: null,
    metadata: {},
  });
  const defaultPhotos = [
    photo('44444444-4444-4444-8444-444444444444', 'Alpine light', 'Quiet light across the high country', 6),
    photo('55555555-5555-4555-8555-555555555555', 'After rain', 'A short pause on the forest trail', 5, 0.8),
    photo('66666666-6666-4666-8666-666666666666', 'First tide', 'The shore before the town wakes', 7, 1.33),
  ];
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: defaultPhotos, pagination: { nextCursor: null, hasMore: false } }) });
  });
});

test('gallery opens a photo detail view', async ({ page }) => {
  const alpine = { id: '44444444-4444-4444-8444-444444444444', spaceSlug: 'primary', title: 'Alpine light', description: 'Quiet light across the high country', capturedAt: '2025-10-12T03:04:05.000Z', rating: 6, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/alpine.jpg', width: 900, height: 600, format: 'jpeg' }, media: [], location: null, metadata: {} };
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [alpine], pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.goto('http://127.0.0.1:5173/');
  await expect(page.getByRole('heading', { name: 'Featured work' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await expect(page.getByRole('dialog', { name: 'Alpine light' })).toBeVisible();
});

test('negative25 branding and canonical metadata are present', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('N25');
  await expect(page.getByRole('button', { name: 'Go to negative25 home' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://n25.world/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /negative25/);
});

test('header utility navigation keeps user search and about actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Get the app' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Social' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search users' })).toBeVisible();
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByText('Find your negative 25. A quiet archive')).toBeVisible();
});

test('gallery modes sit beside the brand and remain interactive', async ({ page }) => {
  await page.goto('/');
  const brand = page.locator('.brand');
  const modes = page.locator('.category-bar.is-inline');
  await expect(modes).toBeVisible();
  const [brandBox, modesBox] = await Promise.all([brand.boundingBox(), modes.boundingBox()]);
  expect(brandBox).not.toBeNull();
  expect(modesBox).not.toBeNull();
  expect(modesBox?.x).toBeGreaterThan(brandBox?.x! + brandBox?.width!);
  await page.getByRole('button', { name: 'Recent' }).click();
  await expect(page).toHaveURL(/mode=recent/);
});

test('recent and shuffle pagination keeps loaded rows anchored', async ({ page }) => {
  const requests: Array<{ mode: string; cursor: string | null; seed: string | null }> = [];
  const photo = (id: string, title: string, aspectRatio = 1.5) => ({
    id,
    spaceSlug: 'primary',
    title,
    description: '',
    capturedAt: '2025-10-12T03:04:05.000Z',
    rating: 5,
    aspectRatio,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 900, height: 600, format: 'jpeg' },
    media: [],
    location: null,
    metadata: {},
  });
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode') ?? 'featured';
    const cursor = url.searchParams.get('cursor');
    const seed = url.searchParams.get('seed');
    requests.push({ mode, cursor, seed });
    const offset = cursor ? Number(cursor) : 0;
    const photos = Array.from({ length: 24 }, (_, index) => photo(`${mode}-${offset + index}`, `${mode} ${offset + index}`, index % 3 === 0 ? 0.8 : 1.5));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos, pagination: { nextCursor: String(offset + 24), hasMore: true } }) });
  });

  await page.goto('/');
  for (const mode of ['Recent', 'Shuffle']) {
    await page.getByRole('button', { name: mode }).click();
    await expect(page.getByRole('button', { name: new RegExp(`Open ${mode.toLowerCase()} 0`, 'i') })).toBeVisible();
    const firstColumnTop = await page.locator('.photo-column').first().evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    await page.locator('.gallery-sentinel').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: new RegExp(`Open ${mode.toLowerCase()} 23`, 'i') })).toBeVisible();
    await expect.poll(() => requests.filter((request) => request.mode === mode.toLowerCase() && request.cursor === '24')).toHaveLength(1);
    const anchoredColumnTop = await page.locator('.photo-column').first().evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    expect(anchoredColumnTop).toBe(firstColumnTop);
  }
  const shuffleRequests = requests.filter((request) => request.mode === 'shuffle');
  expect(shuffleRequests.length).toBeGreaterThanOrEqual(2);
  expect(shuffleRequests[0]?.seed).toBeTruthy();
  expect(shuffleRequests[1]?.seed).toBe(shuffleRequests[0]?.seed);
});

test('masonry gallery fills desktop columns with varied photo proportions', async ({ page }) => {
  const photos = Array.from({ length: 13 }, (_, index) => ({
    id: `masonry-${index}`,
    spaceSlug: 'primary',
    title: `Masonry ${index}`,
    description: '',
    capturedAt: '2025-10-12T03:04:05.000Z',
    rating: index % 7,
    aspectRatio: [1.8, 0.58, 1.2, 0.82, 1.55][index % 5],
    thumbnail: { kind: 'thumbnail', url: `https://example.com/masonry-${index}.jpg`, width: 900, height: 600, format: 'jpeg' },
    media: [],
    location: null,
    metadata: {},
  }));
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos, pagination: { nextCursor: null, hasMore: false } }) });
  });

  await page.goto('/');
  await expect(page.locator('.photo-grid')).toBeVisible();
  const columns = page.locator('.photo-column');
  await expect(columns).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) await expect(columns.nth(index).locator('.photo-cell')).not.toHaveCount(0);
  const gridBox = await page.locator('.photo-grid').boundingBox();
  const lastColumnBox = await columns.last().boundingBox();
  expect(gridBox).not.toBeNull();
  expect(lastColumnBox).not.toBeNull();
  expect((lastColumnBox?.x ?? 0) + (lastColumnBox?.width ?? 0)).toBeCloseTo((gridBox?.x ?? 0) + (gridBox?.width ?? 0), 0);
});

test('albums mode renders public stacks and collapses on blank space', async ({ page }) => {
  const albumId = '11111111-1111-4111-8111-111111111111';
  const photo = (id: string, title: string, aspectRatio = 1.5) => ({
    id,
    spaceSlug: 'primary',
    title,
    description: `${title} description`,
    capturedAt: '2026-01-02T03:04:05.000Z',
    rating: 5,
    aspectRatio,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 900, height: 600, format: 'jpeg' },
    media: [],
    location: null,
    metadata: {},
  });
  const cover = { ...photo('22222222-2222-4222-8222-222222222222', 'Dawn cover'), rating: 7 };
  const second = { ...photo('33333333-3333-4333-8333-333333333333', 'Dawn second', 0.8), rating: 5 };
  await page.route('**/api/v1/spaces/primary/albums', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ albums: [{ id: albumId, spaceSlug: 'primary', title: 'Dawn trip', shootDate: '2026-01-02', cover, photoCount: 2 }] }) });
  });
  await page.route(`**/api/v1/spaces/primary/albums/${albumId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: albumId, spaceSlug: 'primary', title: 'Dawn trip', shootDate: '2026-01-02', cover, photoCount: 2, photos: [cover, second] }) });
  });
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [], pagination: { nextCursor: null, hasMore: false } }) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Albums' }).click();
  await expect(page).toHaveURL(/mode=faraway/);
  await expect(page.getByRole('button', { name: 'Expand album Dawn trip' })).toBeVisible();
  await expect(page.locator('.stack-photo')).toHaveCount(2);
  await expect(page.locator('.album-stack-copy time')).toHaveText('2026-01-02');
  await expect(page.locator('.album-stack-copy')).not.toContainText('2 photographs');
  expect((await page.locator('.album-stack-card').boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(220);
  await page.getByRole('button', { name: 'Expand album Dawn trip' }).click();
  await expect(page.locator('.album-expanded')).toBeVisible();
  await expect(page.locator('.album-photo')).toHaveCount(2);
  await expect(page.locator('.album-photo').nth(0)).toHaveAccessibleName('Open Dawn cover');
  await expect(page.locator('.album-photo').nth(1)).toHaveAccessibleName('Open Dawn second');
  const [spreadBox, contentBox] = await Promise.all([page.locator('.album-spread').boundingBox(), page.locator('.gallery-content').boundingBox()]);
  expect((spreadBox?.width ?? 0) / (contentBox?.width ?? 1)).toBeGreaterThanOrEqual(0.9);
  await expect(page.getByRole('button', { name: 'Expand album Dawn trip' })).toHaveCount(0);
  await page.locator('.album-expanded').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('button', { name: 'Expand album Dawn trip' })).toBeVisible();
});

test('location mode opens a searchable picker and filters the gallery', async ({ page }) => {
  const photos = [
    { id: 'beijing-frame', spaceSlug: 'primary', title: 'Beijing frame', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: 5, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/beijing.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: { id: 'beijing-location', name: '北京市朝阳区' }, metadata: {} },
    { id: 'dolomites-frame', spaceSlug: 'primary', title: 'Dolomites frame', description: '', capturedAt: '2025-10-12T03:04:05.000Z', rating: 6, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/dolomites.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: { id: 'dolomites-location', name: 'Dolomites, Italy' }, metadata: {} },
  ];
  const galleryRequests: string[] = [];
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    const location = new URL(route.request().url()).searchParams.get('location');
    galleryRequests.push(location ?? 'all');
    const filtered = location === 'dolomites-italy' ? photos.slice(1) : location === 'beijing' ? photos.slice(0, 1) : photos;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: filtered, pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Region' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a location' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search location' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'China' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Beijing' })).toBeEnabled();
  await expect(page.getByRole('option', { name: 'Sichuan' })).toBeDisabled();
  const picker = page.getByRole('dialog', { name: 'Choose a location' });
  const requestsBeforePendingSelection = galleryRequests.length;
  await picker.getByRole('option', { name: /Dolomites, Italy/ }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(galleryRequests.length).toBe(requestsBeforePendingSelection);
  await expect(page.getByRole('button', { name: 'Open Beijing frame' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Dolomites frame' })).toBeVisible();
  await picker.getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/mode=location&location=dolomites-italy/);
  await expect(page.getByRole('button', { name: 'Open Dolomites frame' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Beijing frame' })).toHaveCount(0);
  const singlePhotoCell = page.locator('.photo-column .photo-cell');
  const [singleCellBox, singleGridBox] = await Promise.all([singlePhotoCell.boundingBox(), page.locator('.photo-grid').boundingBox()]);
  expect(singleCellBox).not.toBeNull();
  expect(singleGridBox).not.toBeNull();
  expect(singleCellBox?.width).toBeGreaterThan((singleGridBox?.width ?? 0) * 0.9);
  await page.getByRole('button', { name: 'Region' }).click();
  const beijingPicker = page.getByRole('dialog', { name: 'Choose a location' });
  await beijingPicker.getByRole('option', { name: 'Beijing' }).click();
  await expect(page).toHaveURL(/mode=location&location=dolomites-italy/);
  await expect(page.getByRole('button', { name: 'Open Dolomites frame' })).toBeVisible();
  await beijingPicker.getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/mode=location&location=beijing/);
  await expect(page.getByRole('button', { name: 'Open Beijing frame' })).toBeVisible();
  await page.getByRole('button', { name: 'Region' }).click();
  const reopenedPicker = page.getByRole('dialog', { name: 'Choose a location' });
  await reopenedPicker.getByRole('option', { name: 'All locations' }).click();
  await expect(page).toHaveURL(/mode=location&location=beijing/);
  await expect(page.getByRole('button', { name: 'Open Beijing frame' })).toBeVisible();
  await reopenedPicker.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/mode=location&location=beijing/);
  await page.getByRole('button', { name: 'Region' }).click();
  await page.getByRole('dialog', { name: 'Choose a location' }).getByRole('option', { name: 'All locations' }).click();
  await page.getByRole('dialog', { name: 'Choose a location' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/mode=location(?:$|&)/);
  await expect(page.getByRole('button', { name: 'Open Beijing frame' })).toBeVisible();
});

test('photo metadata action is an ellipsis and viewer hides the image name', async ({ page }) => {
  await page.route('**/api/v1/spaces/primary/photos*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [{ id: 'detail-frame', spaceSlug: 'primary', title: 'Detail frame', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: 5, aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://example.com/detail.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: null, metadata: {} }], pagination: { nextCursor: null, hasMore: false } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Detail frame' }).click();
  await expect(page.locator('.viewer-title')).toHaveCount(0);
  await expect(page.locator('.viewer')).toHaveAttribute('aria-label', 'Detail frame');
  await expect(page.locator('.meta-action svg')).toHaveCount(1);
  await expect(page.locator('.meta-action .sr-only')).toHaveText('View detailed photo metadata');
  await page.getByRole('button', { name: 'View detailed photo metadata' }).click();
  const panel = page.getByRole('dialog', { name: 'Detailed photo information' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.detail-header .eyebrow, .detail-header h2')).toHaveCount(0);
});

test('theme switcher changes and persists the visual theme', async ({ page }) => {
  await page.goto('/');
  const themeButton = page.getByRole('button', { name: 'Change theme' });
  await expect(themeButton).toBeVisible();
  await themeButton.click();
  await page.getByRole('menuitemradio', { name: 'Paper' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
});

test('photo viewer follows the selected visual theme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Change theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Paper' }).click();
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await expect(page.locator('.viewer')).toHaveCSS('background-color', 'rgb(246, 245, 241)');
  await expect(page.locator('.viewer')).toHaveCSS('color', 'rgb(37, 39, 36)');
});

test('language switcher uses the current locale as its trigger', async ({ page }) => {
  await page.goto('/');
  const languageButton = page.getByRole('button', { name: 'Language' });
  await expect(languageButton).toHaveText('EN');
  await languageButton.click();
  await expect(page.getByRole('menuitemradio', { name: '中文' })).toBeVisible();
  await page.getByRole('menuitemradio', { name: '中文' }).click();
  await expect(page.getByRole('button', { name: '语言' })).toHaveText('中');
  await page.getByRole('button', { name: '语言' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'Language' })).toHaveText('EN');
});

test('view selector shares the utility row bottom edge', async ({ page }) => {
  await page.goto('/');
  const utilityNav = page.locator('.utility-nav');
  const viewSelector = page.locator('.global-view-selector');
  await expect(utilityNav).toBeVisible();
  await expect(viewSelector).toBeVisible();
  const [utilityBox, viewBox] = await Promise.all([utilityNav.boundingBox(), viewSelector.boundingBox()]);
  expect(utilityBox).not.toBeNull();
  expect(viewBox).not.toBeNull();
  expect(Math.abs((viewBox?.y ?? 0) + (viewBox?.height ?? 0) - ((utilityBox?.y ?? 0) + (utilityBox?.height ?? 0)))).toBeLessThanOrEqual(1);
});

test('public view switch opens the discover map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Discover' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole('region', { name: 'Places map' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible();
});

test('photo detail supports keyboard navigation and close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'After rain' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/?(?:\?mode=featured)?$/);
});

test('photo detail exposes seven-star rating and metadata tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await expect(page.locator('.viewer-info .stars svg')).toHaveCount(7);
  await expect(page.locator('.viewer-info .stars svg.filled')).toHaveCount(6);
  await expect(page.locator('.viewer-info .stars svg:not(.filled)')).toHaveCount(1);
  await page.getByRole('button', { name: 'View detailed photo metadata' }).click();
  const panel = page.getByRole('dialog', { name: 'Detailed photo information' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('button', { name: 'View detailed photo metadata' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.detail-grid .detail-card')).toHaveCount(8);
  await expect(page.locator('.detail-grid .detail-card dt svg')).toHaveCount(8);
  const [panelBox, actionBox] = await Promise.all([panel.boundingBox(), page.locator('.meta-action').boundingBox()]);
  expect(panelBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect((panelBox?.y ?? Number.POSITIVE_INFINITY) + (panelBox?.height ?? 0)).toBeLessThan(actionBox?.y ?? Number.POSITIVE_INFINITY);
  expect(Math.abs(((panelBox?.x ?? 0) + (panelBox?.width ?? 0)) - ((actionBox?.x ?? 0) + (actionBox?.width ?? 0)))).toBeLessThanOrEqual(2);
  await expect(panel.locator('.detail-rating strong')).toHaveCount(0);
  const cards = await panel.locator('.detail-card').all();
  for (const card of cards) {
    const box = await card.boundingBox();
    expect(box?.height ?? 999).toBeLessThanOrEqual(100);
  }
  await expect(page.getByRole('button', { name: 'Close photo' })).toHaveCount(1);
  await expect(panel.getByRole('tab', { name: 'Basic parameters' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByText('Focal length')).toBeVisible();
  await panel.getByRole('tab', { name: 'Location' }).click();
  await expect(panel.getByRole('tab', { name: 'Location' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByText('Location map is unavailable')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Close photo' })).toHaveCount(1);
});

test('photo metadata floating panel closes when clicking outside', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await page.getByRole('button', { name: 'View detailed photo metadata' }).click();
  await expect(page.getByRole('dialog', { name: 'Detailed photo information' })).toBeVisible();
  await page.locator('.detail-overlay').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('dialog', { name: 'Detailed photo information' })).not.toBeVisible();
});

test('photo detail supports fullscreen and hidden zoom gestures', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Alpine light' }).click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Language' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close photo' })).toHaveCount(1);
  await expect(page.locator('.viewer-controls')).toHaveCount(0);
  await expect(page.locator('.viewer-caption')).toHaveText('Quiet light across the high country');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect(page.locator('.viewer')).toHaveClass(/is-zoomed/);
  await expect(page.locator('.viewer-caption')).toHaveCSS('opacity', '0');
  await expect(page.locator('.viewer-image')).toHaveAttribute('style', /scale\(1\.5\)/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer')).not.toHaveClass(/is-zoomed/);
  await expect(page.locator('.viewer-image')).toHaveAttribute('style', /scale\(1\)/);
  await page.locator('.viewer-stage').dblclick();
  await expect(page.locator('.viewer-image')).toHaveAttribute('style', /scale\(2\)/);
});

test('photo captions reserve one line above the image', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open First tide' }).click();
  const caption = page.locator('.viewer-caption');
  await expect(caption).toBeVisible();
  await expect(caption).toHaveCSS('white-space', 'nowrap');
  await expect(caption).toHaveCSS('max-height', '19.5px');
  const [captionBox, imageBox] = await Promise.all([caption.boundingBox(), page.locator('.viewer-image').boundingBox()]);
  expect(captionBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox?.y).toBeGreaterThan(captionBox?.bottom ?? 0);
});

test('about and Studio entry points use the new brand', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: /Don't just dream it/ })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page.getByText('negative25 · Personal center')).toBeVisible();
});
