# Discover Map Keep-Alive

## Goal

Opening a photograph from Discover and then closing it must return to the same live map, without reloading AMap or resetting its view.

## Design

- Cache `DiscoverView` while a public photo route is active. The cache includes its `DiscoverMap` child and the existing AMap instance; Gallery, albums, and administrative views are not cached by this change.
- On return, Vue reactivates the existing Discover view instead of mounting it again. The map retains its loaded tiles, camera position, zoom level, active place detail, and selected circle results.
- On activation, call AMap's resize operation after the view is visible so its retained canvas fits the viewport. This must not create a new map instance, re-fetch map data, or change its current camera.
- The photo return URL continues to encode the selected desktop place as `place=<location-slug>`, so the detail panel is visible both on browser navigation and on normal viewer close. Circle selection remains in its existing Pinia store.
- A direct photo URL and existing gallery/album photo flows keep their current close destinations.

## Error Handling

- If AMap failed to initialize before the photo route opened, returning exposes the existing error state; it does not retry initialization automatically.
- If no Discover return URL is present, the viewer follows its existing fallback behavior.

## Verification

- Add a focused browser test covering Discover -> photo -> close and assert the same map container persists while the selected place panel returns.
- Run web unit tests, type checking, and the production web build.
