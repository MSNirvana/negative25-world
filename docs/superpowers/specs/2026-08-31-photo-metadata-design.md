# Photo Metadata Detail Design

**Date:** 2026-08-31

**Goal:** Expand photo detail metadata to include a seven-star rating, complete camera settings, and automatic location details without losing imported EXIF data.

## Scope

- Read focal length, aperture, shutter speed, ISO, GPS latitude/longitude/altitude, and rating from EXIF/XMP/manifest input when available.
- Persist rating as an integer from 0 through 7. Preserve null for an explicitly un-rated photo.
- Keep the existing AMap integration as the map renderer. Center the location tab from stored coordinates; do not invent altitude when EXIF does not contain it.
- Present a compact metadata row in the photo viewer and an expanded two-tab detail panel matching the supplied references.
- Allow Studio editors to update a photo rating from 0 through 7 and continue using the existing AMap place-selection flow.

## Data Flow

1. The import worker reads EXIF fields and merges manifest overrides using the existing field precedence rules.
2. The API/database validates and stores `rating`, coordinates, altitude, and the other camera fields in the photo metadata JSON, with coordinates mirrored into the location columns already used by Discover.
3. The public photo payload exposes the stored rating and metadata through the existing `PhotoSummary` contract.
4. The web gallery maps metadata into a typed `GalleryPhoto`; `PhotoMeta` renders the compact row and a detail drawer renders the full metadata.

## UI Behavior

- The compact viewer row has sections for rating, parameters, place, camera, and lens.
- Rating always renders seven stars. Filled stars represent the integer rating; remaining stars are outlined/muted. Null and zero both render no filled stars.
- The detail drawer opens from the existing more action and contains `Basic parameters` and `Location` tabs.
- Location shows AMap, formatted latitude/longitude, and altitude when present; absent values use the localized “Not recorded” label.
- Missing camera fields remain visible as “Not recorded” rather than shifting the layout.

## Error Handling

- Invalid numeric metadata is ignored during import and reported through the existing warning channel.
- Ratings outside 0-7 are rejected by API validation and Studio form validation.
- A photo with coordinates but no altitude remains usable on the map and displays the missing altitude label.

## Testing

- Unit tests cover EXIF field mapping/number formatting and the seven-star rating bounds.
- API tests cover accepting rating 7 and rejecting rating 8.
- E2E tests cover metadata row/drawer visibility and seven-star fill behavior for a demo photo.
