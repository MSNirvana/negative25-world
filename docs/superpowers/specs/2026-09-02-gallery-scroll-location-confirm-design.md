# Gallery Scroll And Location Confirmation

## Goal

Keep recent and shuffle browsing smooth while making location selection explicit.

## Design

- Preserve the server-provided order for recent and shuffle modes and avoid rebuilding completed justified rows while a page is appended.
- Keep an uncommitted location choice inside the picker. Apply it only after the user presses a confirmation action.
- Closing the picker, clicking outside, or pressing Escape discards the pending choice and leaves the current gallery unchanged.
- Reduce scroll-time rendering work for offscreen rows, avoid browser-level smooth scrolling for wheel input, and guard pagination against overlapping or stale requests.
- Add regression coverage for recent/shuffle append stability and for location selection requiring confirmation.

## Scope

This change affects gallery navigation state, justified-row rendering, pagination coordination, and the location picker interaction. Photo data, sorting rules, and location matching remain unchanged.
