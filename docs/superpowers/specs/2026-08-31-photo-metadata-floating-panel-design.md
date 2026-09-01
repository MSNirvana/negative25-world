# Photo Metadata Floating Panel Design

**Date:** 2026-08-31

**Goal:** Make the photo preview metadata action match the supplied references: distinct semantic icons and a compact floating details panel anchored above the metadata row.

## Scope

- Change the public photo preview only. The gallery grid and Studio metadata forms keep their current behavior.
- Keep the existing three-dot action as the only trigger for expanded metadata.
- Replace the right-side detail presentation with a centered floating panel attached to the metadata row.
- Keep the existing Basic parameters and Location tabs, including the theme-aware AMap view.

## Interaction

1. Clicking the three-dot action toggles the floating panel.
2. Clicking outside the panel, pressing `Escape`, changing the photo, or entering zoom mode closes it.
3. The panel is positioned above the compact metadata row, with a small visual caret pointing to the trigger area. On narrow screens it becomes a nearly full-width bottom-aligned panel with safe side margins.
4. The panel uses the active theme tokens for its surface, border, text, and shadow. It does not introduce a second overlay layer beyond the existing viewer.

## Metadata Layout

- The Basic parameters tab uses a two-column card grid for rating, capture date, aperture, shutter speed, focal length, ISO, camera, and lens.
- Each field has a distinct Lucide icon with a stable semantic mapping: `Star`, `CalendarDays`, `Camera`, `ScanLine`, `Aperture`, `Timer`, `Gauge`, and `PanelTop`.
- Missing values continue to use the localized `Not recorded` label and do not collapse the grid.
- The Location tab preserves the current map, coordinates, and altitude content.

## Component Boundaries

- `PhotoMeta.vue` owns the compact row, field icon mapping, and the emitted `more` event.
- `PhotoViewer.vue` owns open/close state, outside-click and keyboard coordination, and zoom-related dismissal.
- `PhotoDetailPanel.vue` owns the floating panel markup, tabs, metadata cards, map lifecycle, and responsive styling.

## Error Handling and Accessibility

- The trigger and close controls retain localized accessible labels and `aria-expanded`/`aria-selected` state.
- The panel remains a modal dialog for assistive technology and closes through the same Escape path as the viewer.
- Map loading and AMap errors continue to use the existing localized status messages.

## Verification

- Update the photo viewer E2E coverage to assert distinct metadata icons, floating-panel visibility, tab switching, outside-click dismissal, and Escape dismissal.
- Run web lint/typecheck, unit tests, build, and `git diff --check`.
