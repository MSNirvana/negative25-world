# Discover Map Circle Selection Design

## Purpose

The Discover map lets visitors inspect a local collection of photographs directly from the map. A pointer-following circle selects all mapped photographs within its visible area, then presents those photographs in a concise left-side result panel grouped by Chinese province or overseas country/region.

## Interaction

- On desktop pointers, show a fixed 160 pixel diameter selection circle while the pointer is over the map canvas. The circle is visual feedback only until a map click occurs.
- A map click fixes the circle at the click position and selects every photo marker whose current container pixel lies inside the circle. The physical geographical area therefore changes naturally as the map zoom changes.
- Clicking another location replaces the previous result. Pressing Escape or using the existing reset control clears the result and restores the ordinary Discover place panel.
- Existing marker activation remains available. Selecting an individual marker continues to open its location detail behavior; it must not accidentally trigger a circle query.
- Touch devices retain the existing map and place-panel flow. They do not display a hover circle because touch has no stable hover position.

## Result Panel

- While a circle query is active, the normal left-side Discover place panel is replaced by a circle-result panel.
- The panel header has a back/clear action, the count of selected photos, and no explanatory feature copy.
- Photos are grouped in stable headings. Mainland Chinese photos use a province, municipality, autonomous region, or SAR heading. Overseas photos use country or region as the equivalent heading. Photos which cannot be resolved use a final `未分类` / `Unclassified` group.
- Each group displays a compact three-column thumbnail grid. Image tiles preserve a stable square footprint, crop with `object-fit: cover`, and open the selected photo when clicked.
- The panel scrolls independently of the map. On narrow screens the existing bottom sheet remains the fallback, and circle selection is not introduced.

## Geographic Classification

- Classification is derived per photo, not per location, since nearby photos can belong to different administrative regions.
- First resolve Chinese provinces from the existing `CHINA_REGION_DEFINITIONS` aliases using the photo location name. This covers manually named locations and avoids a network request.
- When an alias cannot determine a group, use AMap `Geocoder` reverse geocoding for the photo coordinate. Use `province` for Chinese addresses and `country` or `countryCode` for overseas addresses.
- Cache successful and unsuccessful reverse-geocode attempts by photo ID for the active browser session. The cache is invalidated on page reload and is never persisted or written to the API/database.
- If AMap geocoding is unavailable, denied, or returns incomplete data, retain the photo in the unclassified group. A classification failure must not hide any selected photo or block opening it.

## Components and Data Flow

- `DiscoverMap.vue` owns AMap pointer/click lifecycle, projection to container pixels, the selection circle overlay, and the selected-photo collection.
- A focused `DiscoverCircleResults.vue` component renders only the selected-photo panel and emits clear/open-photo actions.
- Geographic grouping helpers belong in `discover-map-data.ts` and receive photos plus an optional async reverse-geocoder. They return display-ready section records and do not modify gallery state.
- `DiscoverView.vue` continues to own navigation to a photo route. It receives the selected photo from the map result panel through existing event conventions.

## Verification

- Unit tests cover pixel-circle inclusion, Chinese alias classification, country/province geocoding normalization, cache reuse, unknown fallback, and result group ordering.
- Component tests cover the replacement of the normal place panel during an active circle result and opening a selected thumbnail.
- Browser verification covers a desktop hover circle, a click selecting multiple markers, clearing via Escape and reset, theme-compatible visuals, and no circle on a touch-width viewport.
