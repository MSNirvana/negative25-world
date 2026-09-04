# Photo Detail Workspace Context

## Problem

Opening or refreshing a photo detail route could lose the active user's workspace and query the default `primary` archive. A photo that existed in a personal archive was then rendered as the application's 404 page.

## Design

Photo routes carry a `space` query parameter. Gallery, discover, and album entry points write the current workspace slug into that parameter. `PhotoView` restores the public profile workspace when a `user` query is present; otherwise it restores the workspace from `space`, with `primary` remaining the fallback for legacy URLs. Previous/next navigation preserves both `space` and `user`.

The API continues to enforce workspace membership and public-photo visibility. The change only restores request context and does not expose private or hidden photos.

## Discover Circle Selection

The retained map keeps the circle result store as the source of truth while the gallery and location catalogs refresh after returning from a photo. A location-prop update re-renders map clusters but does not recalculate a locked circle, so a transient empty response cannot replace the result with an empty list. Explicit circle selection, reset, Escape, or the result back action still replaces or clears the selection.

## Verification

- Frontend typecheck and production build
- Workspace-specific photo detail end-to-end regression
- Full unit and end-to-end test suites
