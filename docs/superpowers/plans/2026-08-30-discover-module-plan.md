# Discover module implementation plan

## 1. Data and API foundation

- Extend `GalleryPhoto` and `toGalleryPhoto` with validated coordinate and location id fields.
- Add the typed locations response and `fetchDiscoverLocations` to the web API client.
- Add pure helpers for coordinate validation, slug creation, location de-duplication, grouping, and photo association.
- Keep API failures non-blocking so the AMap shell and photo-derived records still render.

## 2. AMap map engine

- Load the AMap JavaScript API with the local key/security-code configuration and `showOversea: true`.
- Use AMap's dark basemap, detailed China labels/roads, bounded zoom/reset controls, pointer pan, and touch gestures.
- Convert WGS84 EXIF coordinates to GCJ-02 inside mainland China and keep overseas coordinates unchanged.
- Add AMap marker clustering, custom photo points, point selection, and app attribution.

## 3. Place panel and detail surfaces

- Create `DiscoverPlacePanel.vue` for grouped horizontal card rails, search, empty/error states, desktop collapse, and mobile sheet drag/tap behavior.
- Create `DiscoverPlaceDetail.vue` for selected-location photo rails, metadata, close/back actions, and photo viewer integration.
- Use only current gallery thumbnails; provide neutral cover blocks for locations without a cover image.

## 4. Routing and responsive integration

- Update `DiscoverView.vue` to load gallery and locations, normalize view models, preserve viewport/search state, and mount desktop detail overlay.
- Add `/discover/:slug` and route-aware mobile detail rendering with unknown-slug fallback.
- Audit `App.vue`, `AppHeader.vue`, and `ViewSelector.vue` z-index, safe-area spacing, and focus behavior against 1280x720 and 390x844.

## 5. Verification

- Add unit tests for projection, grouping, clustering, search, and route selection state.
- Add focused E2E coverage for point/card synchronization, panel states, search, zoom, map drag, mobile route navigation, and browser back.
- Run lint, unit tests, typecheck, production build, E2E, visual tests, and browser console/overflow checks.
