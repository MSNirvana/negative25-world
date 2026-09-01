# Photo Viewer Return Design

## Purpose

Opening a photograph from Discover must preserve the visitor's navigation context. Closing that photograph returns to Discover instead of forcing the gallery homepage.

## Behavior

- Discover records its current full route as the photo viewer's return target whenever a visitor opens a photo from a location detail or circle-selection thumbnail.
- The photo viewer close action replaces the photo route with that approved in-app return target. This avoids adding another history entry while returning the visitor to Discover.
- If no valid in-app target exists, closing a photo keeps the current gallery-home fallback.
- Photo navigation within the viewer retains the original return target, so closing after moving to the next or previous photo still restores the Discover source.
- Return targets are limited to same-origin public paths beginning with `/`; external URLs and photo routes are ignored.

## Verification

- Unit coverage verifies target validation and fallback behavior.
- Browser verification opens a photo through Discover circle selection, closes it, and confirms that the Discover route remains active rather than `/`.
