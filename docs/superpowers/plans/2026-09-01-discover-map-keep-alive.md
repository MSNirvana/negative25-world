# Discover Map Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the Discover AMap instance alive while viewing a photo so closing the viewer restores the same map without reloading or resetting its view.

**Architecture:** Wrap the public router view in a Vue `KeepAlive` that includes only `DiscoverView`, allowing the map component to be deactivated while the photo route is shown and reactivated on return. On activation, call AMap's `resize()` after the DOM is visible; all existing route return parameters and Pinia circle state remain the source of UI state.

**Tech Stack:** Vue 3, Vue Router 4, AMap JS API, Vitest, Playwright, TypeScript.

---

### Task 1: Add targeted keep-alive rendering

**Files:**
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/views/DiscoverView.vue`

- [ ] **Step 1: Add an explicit component name to DiscoverView**

In `apps/web/src/views/DiscoverView.vue`, add this directly after the imports in the `<script setup>` block:

```ts
defineOptions({ name: 'DiscoverView' });
```

This gives `KeepAlive` a stable include name regardless of compiler-generated names.

- [ ] **Step 2: Wrap RouterView with an include-limited KeepAlive**

In `apps/web/src/App.vue`, replace the bare `<RouterView />` with:

```vue
<RouterView v-slot="{ Component }">
  <KeepAlive include="DiscoverView">
    <component :is="Component" />
  </KeepAlive>
</RouterView>
```

Keep the existing `AppHeader` and `ViewSelector` conditions unchanged. The include list ensures Gallery, Photo, Album, public profile, and account views are not cached by this change.

- [ ] **Step 3: Run the web type check**

Run `pnpm --filter @negative25/web typecheck`.

Expected: exit code 0 with no TypeScript diagnostics.

### Task 2: Resize the retained map after activation

**Files:**
- Modify: `apps/web/src/components/DiscoverMap.vue`

- [ ] **Step 1: Import Vue activation helpers**

Extend the existing Vue import to include `nextTick` and `onActivated`:

```ts
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
```

- [ ] **Step 2: Add a retained-map resize callback**

Add this function near `applyMapTheme`:

```ts
function resizeRetainedMap(): void {
  void nextTick(() => map.value?.resize());
}
```

Register it next to the existing `onMounted` hook:

```ts
onActivated(resizeRetainedMap);
```

Do not call `initMap()` from this hook. The callback must only resize the existing instance and must not alter its center, zoom, markers, selection, or data requests.

- [ ] **Step 3: Run focused web tests and type checking**

Run `pnpm --filter @negative25/web test` and `pnpm --filter @negative25/web typecheck`.

Expected: all existing web tests pass and type checking exits 0.

### Task 3: Verify navigation keeps one map instance

**Files:**
- Modify: `tests/e2e/discover.spec.ts`

- [ ] **Step 1: Add a browser regression test**

Add a test that opens Discover, records the map container identity and zoom, performs an in-app history transition to a known photo with `returnTo=/discover`, closes the viewer, and asserts the map is visible with the same DOM node and zoom readout:

```ts
test('discover photo return keeps the live map instance', async ({ page }) => {
  await page.goto('/discover');
  const map = page.locator('.amap-container');
  await expect(map).toBeVisible();
  await map.evaluate((element) => {
    (element.ownerDocument.defaultView as Window & { __negative25MapIdentity?: Element }).__negative25MapIdentity = element;
  });
  await page.evaluate(() => {
    history.pushState({}, '', '/photo/alpine-light?returnTo=%2Fdiscover');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close photo' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(map).toBeVisible();
  expect(await map.evaluate((element) => (element.ownerDocument.defaultView as Window & { __negative25MapIdentity?: Element }).__negative25MapIdentity === element)).toBe(true);
});
```

Use the existing English test setup and route behavior. The `history.pushState` plus `popstate` sequence keeps the same document alive, allowing the DOM identity assertion to detect a remounted map.

- [ ] **Step 2: Run the focused Playwright suite**

Run `pnpm exec playwright test tests/e2e/discover.spec.ts --project=chromium`.

Expected: the new keep-alive test and existing Discover tests pass. If the existing Alpine fixture test fails because the API-backed local data is unavailable, report that independent fixture failure separately.

- [ ] **Step 3: Run the production build and inspect the diff**

Run `pnpm --filter @negative25/web build` and `git diff --check`.

Expected: Vite production build succeeds and `git diff --check` prints no errors.

- [ ] **Step 4: Commit the implementation**

```bash
git add apps/web/src/App.vue apps/web/src/views/DiscoverView.vue apps/web/src/components/DiscoverMap.vue tests/e2e/discover.spec.ts
git commit -m "fix: keep discover map alive through photo viewer"
```
