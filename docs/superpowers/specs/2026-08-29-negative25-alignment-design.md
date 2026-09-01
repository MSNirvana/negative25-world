# negative25 public experience alignment

## Goal

Align the public photography experience with the authorized reference while establishing **negative25** as the sole public identity, using the canonical domain `n25.world` and the line “Don't just dream it, live it. Find your negative 25.” Existing imported photo data, API contracts, and the admin workflow remain intact.

## Visual direction

- Use a near-black public canvas (`#0f0f10`) with warm-white type and restrained gray secondary text.
- Use a compact header with a wordmark lockup on the left, auxiliary links on the right, and a pill switch for Gallery / Discover. The header fades out on scroll while the view switch and gallery category bar remain available.
- Use a three-column, image-first gallery at wide widths. Photo cards have no visible captions or metadata until focus/hover, retain stable aspect-ratio boxes, and use a subtle tilt/glare treatment without changing layout dimensions.
- Use a full-bleed Discover map surface with the dark AMap base, muted location points, and a bottom-left search/curation drawer that collapses on small screens.
- Use a dark editorial photo detail page: centered large image, tiny metadata line, attribution, related place breadcrumbs, and a compact app/API callout. The close/back and previous/next controls remain keyboard and touch accessible.
- Keep Studio pages legible and operational. They inherit the dark token system but use stronger dividers, form surfaces, and action contrast than the public gallery.
- Breakpoints: three columns at >= 960px, two columns at 640-959px, one column below 640px; mobile header and drawers must fit within 390px without horizontal scrolling.

## Brand and canonical metadata

- Replace public labels, titles, descriptions, seed workspace names, footer copy, PWA manifest fields, and default page metadata with negative25 wording.
- Set the canonical URL to `https://n25.world/`, add Open Graph/Twitter title and description metadata, and update the PWA theme/background colors.
- Use the `@negative25/*` package namespace, `N25_*` environment variables, and `negative25` queue/storage names throughout the project.
- Replace browser/session storage keys with `negative25.*`; read the pre-negative25 keys once for a non-breaking migration.

## Data and navigation

- Gallery modes remain Featured, Recent, Shuffle, Nearby, and Faraway. Nearby/Faraway continue to use the API ordering when available and fall back to the local collection.
- The Discover drawer is backed by imported locations when available and displays an honest empty state when no geocoded data exists; it does not import or proxy reference-site photos.
- Public photo links use `/photo/:id`; albums remain available as a secondary route and use the same photo grid and viewer primitives.
- The existing API remains the source of truth for future iPhone clients; no browser-only data shape is introduced.

## Components

- Add shared `BrandMark`, `PublicFooter`, and `DiscoverMap` primitives.
- Refine `AppHeader`, `ViewSelector`, `CategoryNav`, `PhotoCard`, `PhotoGrid`, `PhotoViewer`, `GalleryView`, `DiscoverView`, `AlbumsView`, `AlbumView`, and global tokens.
- Keep admin views functionally unchanged, updating visible labels and shell styling only where needed.

## Quality bar

- Run lint, unit tests, typecheck, production build, E2E, and visual tests.
- Capture desktop (1280px) and mobile (390px) screenshots for gallery, Discover, album, photo detail, and Studio. Verify no horizontal overflow, focus-visible states, keyboard photo navigation, touch swipe navigation, and anonymous thumbnail/private original behavior.
