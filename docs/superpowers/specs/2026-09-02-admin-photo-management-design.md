# Admin Photo Management Enhancements

## Goal

Improve the personal-center photo manager for large libraries without changing the public archive model. Administrators and editors should be able to select several photos, copy metadata between them, inspect a thumbnail without leaving the list, and remove one or many photos safely.

## Design

- The photo table gains a selection checkbox on every row and a select-all control for the current filtered result. A bulk toolbar appears only when rows are selected.
- The first selected photo is the source for metadata copy. The toolbar exposes copy-all plus separate actions for location, address, and rating. The API validates that source and targets belong to the same workspace and returns the updated records.
- Location copy includes the named place, coordinates, and altitude/location metadata. Address copy includes display address, region, and its visibility flag. Rating copy preserves a nullable 0-7 rating. Existing target fields outside the selected action remain unchanged.
- Clicking a thumbnail opens a lightweight viewport overlay using the best available preview URL. Clicking the backdrop or pressing Escape closes it; the row list remains mounted underneath.
- Delete actions require confirmation. Single and bulk deletion use workspace-scoped admin endpoints. PostgreSQL foreign keys cascade photo files and album links, while the service removes the associated object-storage keys before deleting the database row. The response reports deleted IDs so the UI can update without a full reload.
- The homepage gallery keeps the justified-row layout but lowers its target row height for oversized featured images, preserving aspect ratios and responsive behavior.

## Error Handling

- Viewer-only members can still view the table but cannot copy or delete.
- A missing source/target is reported as not found; a partial bulk request returns successfully deleted and skipped IDs.
- Storage deletion errors stop the database deletion and surface an actionable error to the caller.

## Verification

- API tests cover role enforcement, metadata-copy field isolation, single deletion, bulk deletion, workspace scoping, and storage-key cleanup.
- Web tests cover selection state, copy/delete controls, preview dismissal, and filtered select-all behavior.
- Run lint, typecheck, unit tests, production build, and a deployed smoke check for the photo-management routes.
