# Discover Map Data Refresh Design

Date: 2026-09-02

## Problem

The Discover page requests all public location records, but its photo catalog only loads the first gallery page. Location markers can therefore exist without their associated photo summaries. Circle selection and place details then report zero photos even though the API has public, geotagged photos for that location. The page also only requests location data on its initial mount, so a photo published after the page is opened is not reflected until a full navigation or manual reload.

## Goals

- Keep the existing privacy boundary: only public photos with valid coordinates contribute to the public map.
- Render location markers as soon as the location response arrives.
- Hydrate location cards, place details, circle selection, and the unlocated list from the complete public photo catalog.
- Refresh both data sources when the Discover page is re-entered, a viewed public user changes, or the browser returns to the foreground.
- Prevent stale requests from replacing data for a newer workspace or refresh.
- Avoid database changes and avoid touching unrelated services or projects.

## Non-goals

- Do not expose private, hidden, owner-only, or unpublished photos.
- Do not change the map provider, coordinate conversion, clustering, or visual layout.
- Do not change the gallery page's existing first-page/infinite-scroll behavior.
- Do not infer or fabricate a province/location when the stored photo has no valid coordinates.

## Design

### Discover data model

`DiscoverView` owns a `discoverPhotos` collection separate from the gallery page's visible collection. It is initialized with the local demo collection when the API is disabled and is otherwise populated from the public gallery endpoint. Location records remain the authoritative source for map coordinates and photo IDs; `normalizeLocations(locationRecords, discoverPhotos)` joins those records with hydrated photo summaries.

The collection is merged by photo ID while preserving the first-seen order. This makes repeated refreshes and overlapping pages idempotent and prevents duplicate photos in place details or circle results.

### Public catalog loading

Add a client helper that requests `mode=featured` with a limit of 100 and follows `pagination.nextCursor` until `hasMore` is false. Each request uses the same `spaceSlug` as the location request and `cache: 'no-store'`. The helper accepts an `AbortSignal` and stops immediately when cancelled.

The Discover page starts the location request and the catalog request together. The location response updates the map immediately. Catalog pages are merged as they arrive, so the place panel and circle data progressively become complete without blocking map interaction. A failed catalog request leaves already loaded photos visible and reports the existing location-data notice rather than clearing valid data.

### Refresh and stale-response handling

Refreshes are coordinated by a monotonically increasing request sequence and one shared abort controller. A refresh is started on initial entry, when the effective public workspace changes, when the component is activated again, and on `visibilitychange` when the document becomes visible. Starting a refresh aborts the previous pair of requests and clears the previous discover-only collection before new data is accepted.

Responses are applied only when their sequence, `spaceSlug`, and abort state still match the active request. This prevents a previous user's photos or an older import batch from replacing the current map after a route change.

The existing `gallery.load('featured')` call remains for photo navigation compatibility. Discover-specific joins and circle selection use `discoverPhotos`, so they no longer depend on the gallery's first-page size.

### Privacy and missing data

The API's existing `isPhotoPublic` filter remains unchanged. A public photo contributes to the map only when latitude and longitude are finite and inside their valid ranges. Photos that do not meet those conditions remain eligible for the unlocated list but do not create a map marker. If a region has no API record after refresh, the UI will not create a synthetic point; the underlying photo must be published and contain valid GPS data first.

## Testing

- Unit-test catalog page merging with overlapping IDs, multiple cursors, cancellation, and an empty final page.
- Unit-test that normalized locations associate photos from later pages and that circle selection returns those photos.
- Run web type checking, linting, and the existing unit suite.
- Verify in a browser that the Discover page first renders markers, then fills location counts/details as pages arrive; verify a public photo added before refresh appears after returning to the tab; verify private/unpublished photos remain absent.
- Query the production public endpoints after deployment to confirm the response contains the expected public regions and that no other containers are restarted.
