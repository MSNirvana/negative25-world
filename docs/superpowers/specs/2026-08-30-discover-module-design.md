# negative25 Discover module design

## Goal

Upgrade `/discover` into a high-fidelity, data-driven version of the authorized reference experience while keeping the negative25 identity and avoiding any import of reference-site photo data. The page must feel like a real world map, make the relationship between photographs and places explicit, and remain a stable foundation for the future iPhone client.

## Confirmed decisions

- Use the AMap JavaScript API as the world map provider. AMap supplies complete world and China basemaps, labels, roads, dark styling, and runtime tile updates; the app only owns photo locations, clustering, controls, and the surrounding panel.
- Only photos with valid coordinates create map points. Photos without coordinates appear in a dedicated `未定位照片` panel section and never get a fabricated map location.
- On desktop, selecting a point or place card opens an in-context place detail layer over Discover. On mobile, the same action navigates to `/discover/:slug`; the route is a first-class deep link and has a back-to-map action.
- The reference site's imagery is not copied. Place cards use thumbnails from the current negative25 gallery; empty locations use an intentional neutral state instead of reference imagery.

## Experience and visual system

The map occupies the complete viewport behind the floating public header and view selector. The visual hierarchy is deliberately restrained:

- AMap uses its dark map style with complete world coverage enabled via `showOversea: true`; China receives the detailed AMap basemap and labels. The bottom-right app attribution identifies AMap, while AMap's own logo/copyright remains visible in the map canvas.
- Location points use a small palette of muted warm/cool colors, a soft halo, and a larger active state. Nearby coordinates are clustered at lower zoom levels and fan out when the map is zoomed or selected.
- The left panel follows the reference proportions: 395px maximum width, 8px desktop inset, rounded top corners, translucent light surface, and horizontal snap-scrolling cards. The panel never covers the view selector or attribution.
- Mobile uses a bottom sheet with a visible drag handle. Collapsed state retains the search field and first card row; expanded state is capped near 62% of the viewport and respects safe-area insets. The Gallery/Discover selector stays above the sheet's scrollable content.
- All controls retain visible focus rings, readable text, and stable dimensions at 390px wide. No horizontal page overflow is permitted.

## Data model and flow

### Frontend photo shape

Extend `GalleryPhoto` with optional geographic fields:

```ts
type PhotoCoordinates = { latitude: number; longitude: number };
type GalleryPhoto = {
  // existing fields...
  locationId?: string;
  coordinates?: PhotoCoordinates;
};
```

`toGalleryPhoto` reads `metadata.latitude` and `metadata.longitude` when both values pass the existing coordinate bounds. A location object remains the display-name source. Invalid or partial coordinates are treated as absent.

### Location records

Add a typed `fetchDiscoverLocations` client helper backed by `/api/v1/discover/locations`. The Discover view combines API locations with photo-derived locations, de-duplicates by location id/name, and keeps the API as the source of truth when it supplies coordinates. The existing API route remains compatible with the future database-backed location service.

Each view model location contains:

```ts
type DiscoverLocation = {
  id: string;
  slug: string;
  name: string;
  coordinates: PhotoCoordinates;
  photoIds: string[];
  coverPhoto?: GalleryPhoto;
  group: DiscoverGroup;
};
```

### Grouping

Use deterministic client-side grouping until the admin location taxonomy is persisted. Groups are ordered as `精选`, `近期更新`, `亚洲探索`, `欧洲都市`, `美洲魅力`, `英伦风情`, `小城故事`, and `未定位照片`. A location can appear in one geographic group and in `精选` or `近期更新` when it matches those curation rules; the UI de-duplicates a location within each section.

The `未定位照片` section is built from photos without valid coordinates and uses the same card primitive with an explicit explanatory empty state when there are no such photos. No synthetic coordinate is generated.

## Components and boundaries

- `DiscoverView.vue` owns loading, route state, responsive mode selection, and the selected location detail layer.
- `DiscoverMap.vue` owns the AMap viewport, plugin marker clustering, pan/zoom gestures, and panel shell. It converts WGS84 photo EXIF coordinates to GCJ-02 for mainland China and emits `select-location`, `clear-location`, `update-viewport`, and `navigate-place` events.
- `DiscoverPlacePanel.vue` (new) owns search, group headings, horizontal card rails, sheet state, drag handle gestures, and keyboard semantics. It receives normalized locations and unlocated photos and emits location selection.
- `DiscoverPlaceDetail.vue` (new) renders the selected location's photo grid/rail, metadata, and back control. Desktop mounts it inside Discover; mobile is rendered by the `/discover/:slug` route.
- `discover-map-data.ts` contains coordinate validation, WGS84/GCJ-02 conversion, grouping rules, and location clustering utilities. It has no Vue dependencies and is unit-testable.
- `api/client.ts` gains the typed locations request; no browser-only endpoint or response shape is introduced.

The existing `ViewSelector`, `AppHeader`, gallery store, photo viewer, and admin routes remain the shared integration points. The Discover route must not change public storage keys or API compatibility names.

## Interaction behavior

### Map

- Pointer drag pans the map; wheel/pinch zoom changes a bounded zoom level. Double-click zooms in only when it does not conflict with a point click.
- `+` and `−` controls are keyboard accessible and have tooltips/labels. A reset control returns to the world extent.
- Clicking a point selects its location, raises its halo, centers it within the unobscured map area, and synchronizes the corresponding panel card. Clicking the active point again clears the selection.
- At lower zoom, close points render as a cluster with a count; selecting a cluster zooms to its bounds. A location with one photo still renders as a normal point.

### Panel and cards

- Search filters by display name, slug, and photo title/caption. The result count updates per section; no matching state explains how to add GPS data.
- Desktop panel collapse keeps the handle, search field, and the first card row visible, matching the reference site's peek behavior. Mobile starts collapsed, supports tap and pointer drag, and restores the prior state after route return.
- Location cards select the same location as map points. Cards with no cover image use a neutral tonal block and never request reference-site assets.
- Focused cards expose an accessible label containing the location and photo count. Horizontal rails use scroll snapping without causing body-level horizontal overflow.

### Routes

- `/discover` is the world map view.
- `/discover/:slug` resolves a location from the normalized data and renders its place detail. Unknown slugs show the existing not-found treatment with a return-to-map action.
- Desktop place detail is an overlay so the map context remains visible; mobile route navigation is used for a full-height, touch-friendly detail page. Browser back returns to `/discover` with the last viewport and search state restored in memory.

## Loading and error handling

- The map shell renders immediately with an AMap loading state; API/gallery loading only affects points and cards.
- Missing AMap configuration and loader failures show an in-map status message while the place panel remains usable. World-map coverage depends on the AMap account capability being enabled.
- If locations fail to load, retain photo-derived coordinates and show a non-blocking panel notice. If gallery loading fails, show the existing error state inside the panel while keeping map navigation usable.
- Invalid coordinate records are dropped with a development warning and never reach the map marker layer.
- All async requests use abort signals owned by the view lifecycle so route changes cannot update an unmounted Discover view.

## Testing and acceptance criteria

### Unit and component tests

- Projection maps known coordinates to expected normalized positions and rejects out-of-range values.
- Grouping and clustering are deterministic, de-duplicate locations, and keep unlocated photos out of the map point list.
- Search matches name/title/caption and preserves empty-state copy.
- Route selection and back behavior preserve the selected location and viewport state.

### Browser and visual checks

- Capture and inspect `/discover` at 1280x720 and 390x844. Verify the AMap world basemap (with detailed China), point distribution, panel proportions, and no body overflow.
- Test desktop panel collapse/expand, horizontal card scroll, search filtering, point/card synchronization, zoom controls, map drag, and keyboard focus.
- Test mobile sheet collapse/expand/drag, bottom view selector clearance, `/discover/:slug` navigation, and browser-back restoration.
- Check console logs for errors, API failure fallback, no-GPS empty state, and photo thumbnail/private-original behavior.
- Run repository gates: `pnpm -r lint`, `pnpm -r test`, `pnpm -r typecheck`, `pnpm -r build`, `pnpm test:e2e`, and `pnpm test:visual`.

## Out of scope

- Importing or proxying reference-site photos, labels, or private map tokens.
- Persisting location taxonomy edits in Studio; the existing location and import APIs remain the extension point for a later admin feature.
- Offline tile caching or native iPhone UI code. The data shape and route behavior are intentionally API-first so the future app can reuse them.
