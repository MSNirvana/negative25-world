# Discover Map Circle And Search

## Goal

Make the discover map a map-and-left-panel experience without a separate place-detail module, while keeping cluster numbers useful for circle selection and making panel search a two-step result flow.

## Design

- Remove the discover page's `DiscoverPlaceDetail` rendering and route-driven place-detail presentation.
- Hide single-location map markers. Keep numeric cluster markers, and when a numeric marker is clicked, lock the existing fixed-size selection circle at that marker's screen position and select photos inside it without changing map zoom.
- Give the `Featured` and `Recently updated` panel sections independent expanded/collapsed state. Their cards remain horizontally scrollable when expanded.
- When a place search query is non-empty, show matching locations as a result list. Selecting a result switches the panel into a compact photo-result view with a back action; the map remains mounted and is not refreshed.
- Search result selection and panel-card selection stay local to the panel and do not open a right-side detail overlay. Opening an individual photo continues through the existing photo route and return-query behavior.

## Testing

- Add focused unit coverage for panel search/section state helpers where practical.
- Run web typecheck, unit tests, production build, and relevant Playwright discover tests.
- Run `git diff --check`.

## Scope

Changes are limited to discover map rendering, discover panel state/presentation, discover page wiring, and related tests/documentation. Gallery, upload, and location-picker behavior remain unchanged.
