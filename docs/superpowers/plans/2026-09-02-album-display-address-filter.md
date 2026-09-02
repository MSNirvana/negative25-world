# Album Display Address Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a realtime display-address text filter to the photo picker in the admin album editor.

**Architecture:** Keep filtering client-side because the album editor already loads the complete admin photo list. A small pure helper will extract `metadata.displayAddress` and perform trimmed, case-insensitive substring matching; `AdminAlbumsView.vue` will own the input state and feed the filtered list to the existing picker without changing selection or save payloads.

**Tech Stack:** Vue 3 `<script setup>` with TypeScript, Vitest, existing i18n records and scoped CSS.

---

### Task 1: Add the display-address filter helper and tests

**Files:**
- Create: `apps/web/src/lib/album-photo-filter.ts`
- Create: `apps/web/src/lib/album-photo-filter.test.ts`

- [x] **Step 1: Write the failing tests**

Create a minimal photo fixture with `metadata.displayAddress` and cover matching, case-insensitivity, trimming, empty-query reset, and missing-address behavior:

```ts
import { describe, expect, it } from 'vitest';
import { filterAlbumPhotosByDisplayAddress } from './album-photo-filter';

type TestPhoto = { id: string; metadata?: Record<string, unknown> };
const photo = (id: string, displayAddress?: unknown): TestPhoto => ({ id, metadata: displayAddress === undefined ? {} : { displayAddress } });

describe('filterAlbumPhotosByDisplayAddress', () => {
  const photos = [photo('stork', '山西·鹳雀楼'), photo('palace', '北京·故宫'), photo('missing')];

  it('matches a trimmed display address substring without case sensitivity', () => {
    expect(filterAlbumPhotosByDisplayAddress(photos, '  鹳雀楼  ').map((item) => item.id)).toEqual(['stork']);
    expect(filterAlbumPhotosByDisplayAddress([photo('tower', 'Stork Tower')], ' stork ').map((item) => item.id)).toEqual(['tower']);
  });

  it('returns every photo for an empty query and excludes missing addresses for a non-empty query', () => {
    expect(filterAlbumPhotosByDisplayAddress(photos, '').map((item) => item.id)).toEqual(['stork', 'palace', 'missing']);
    expect(filterAlbumPhotosByDisplayAddress(photos, '景区').map((item) => item.id)).toEqual([]);
  });

  it('ignores non-string metadata values', () => {
    expect(filterAlbumPhotosByDisplayAddress([photo('number', 123), photo('valid', '古城')], '古城').map((item) => item.id)).toEqual(['valid']);
  });
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @negative25/web test -- src/lib/album-photo-filter.test.ts --run`

Expected: FAIL because `album-photo-filter.ts` and `filterAlbumPhotosByDisplayAddress` do not exist yet.

- [x] **Step 3: Implement the minimal pure helper**

Create the helper with a generic photo shape so it can accept `AdminPhoto` without importing the API client into the utility:

```ts
type DisplayAddressPhoto = { metadata?: Record<string, unknown> };

export function filterAlbumPhotosByDisplayAddress<T extends DisplayAddressPhoto>(photos: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...photos];
  return photos.filter((photo) => {
    const value = photo.metadata?.displayAddress;
    return typeof value === 'string' && value.toLocaleLowerCase().includes(needle);
  });
}
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter @negative25/web test -- src/lib/album-photo-filter.test.ts --run`

Expected: PASS with 3 tests.

### Task 2: Wire the filter into the admin album editor

**Files:**
- Modify: `apps/web/src/views/admin/AdminAlbumsView.vue:1-62`
- Modify: `apps/web/src/views/admin/AdminAlbumsView.vue:84-86`
- Modify: `apps/web/src/i18n.ts:381-385,495-502`

- [x] **Step 1: Add filter state and computed results**

Import the helper, add `displayAddressFilter`, reset it when opening create/edit, and compute `filteredPhotos` from the complete `photos` list:

```ts
import { filterAlbumPhotosByDisplayAddress } from '../../lib/album-photo-filter';
const displayAddressFilter = ref('');
const filteredPhotos = computed(() => filterAlbumPhotosByDisplayAddress(photos.value, displayAddressFilter.value));
function startCreate(): void { displayAddressFilter.value = ''; draft.value = emptyDraft(); }
function startEdit(album: AdminAlbum): void { displayAddressFilter.value = ''; draft.value = { id: album.id, title: album.title, description: album.description ?? '', shootDate: album.shootDate ?? '', coverPhotoId: album.coverPhotoId ?? '', photoIds: [...album.photoIds] }; }
```

- [x] **Step 2: Add the filter control and use filtered results**

Place the input below the photo picker heading and preserve the existing `photos` list for the cover selector. Replace only the photo picker loop source:

```vue
<div class="photo-picker-heading"><strong>{{ t('admin.photographs') }}</strong><span>{{ t('admin.selected', { count: draft.photoIds.length }) }}</span></div>
<label class="photo-filter">{{ t('admin.filterDisplayAddress') }}<input v-model="displayAddressFilter" :placeholder="t('admin.filterDisplayAddressPlaceholder')" /></label>
<div v-if="!photos.length" class="photos-empty">{{ t('admin.importBeforeAlbum') }}</div>
<div v-else-if="!filteredPhotos.length" class="photos-empty">{{ t('admin.noFilteredPhotos') }}</div>
<div v-else class="photo-picker"><button v-for="photo in filteredPhotos" :key="photo.id" ...></button></div>
```

Keep `togglePhoto`, `draft.photoIds`, and the cover `<select>` tied to the complete loaded photo set so filtering cannot deselect or invalidate existing choices.

- [x] **Step 3: Add localized labels**

Add these keys to both locale records near the existing admin filters:

```ts
'admin.filterDisplayAddress': '按显示地址筛选',
'admin.filterDisplayAddressPlaceholder': '输入显示地址',
```

```ts
'admin.filterDisplayAddress': 'Filter by display address',
'admin.filterDisplayAddressPlaceholder': 'Enter a display address',
```

- [x] **Step 4: Add compact responsive styling**

Reuse the existing editor form appearance without changing picker dimensions:

```css
.photo-filter { color: var(--muted); display: grid; font-size: 11px; gap: 6px; margin: 0 0 10px; }
.photo-filter input { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; font-size: 13px; min-width: 0; padding: 9px 10px; }
.photo-filter input:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }
```

- [x] **Step 5: Run the frontend verification suite**

Run: `pnpm --filter @negative25/web typecheck`

Expected: exit 0 with no type errors.

Run: `pnpm --filter @negative25/web test -- --run`

Expected: all frontend test files pass, including the 3 new filter tests.

Run: `pnpm --filter @negative25/web build`

Expected: Vite production build completes successfully.

Run: `git diff --check`

Expected: no whitespace errors.

### Task 3: Review the final diff

**Files:**
- Review: `apps/web/src/lib/album-photo-filter.ts`
- Review: `apps/web/src/lib/album-photo-filter.test.ts`
- Review: `apps/web/src/views/admin/AdminAlbumsView.vue`
- Review: `apps/web/src/i18n.ts`

- [x] **Step 1: Confirm scope and behavior**

Verify that the diff changes only the album editor filter, reads only `metadata.displayAddress`, leaves selected IDs intact while filtering, and does not alter API payloads or public album behavior.

- [x] **Step 2: Commit the implementation**

```bash
git add apps/web/src/lib/album-photo-filter.ts apps/web/src/lib/album-photo-filter.test.ts apps/web/src/views/admin/AdminAlbumsView.vue apps/web/src/i18n.ts
git commit -m "feat: filter album photos by display address"
```
