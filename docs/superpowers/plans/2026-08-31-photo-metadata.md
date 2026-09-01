# Photo Metadata Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable seven-star ratings, complete camera settings, and an automatic AMap location detail view to photo details.

**Architecture:** Keep the current metadata JSON as the source for EXIF-derived camera and GPS fields, mirror coordinates to the existing photo columns, and extend the shared photo contract with rating. The viewer will compose a compact `PhotoMeta` row with an expanded local detail drawer, while Studio continues to edit the same persisted fields.

**Tech Stack:** Vue 3, Pinia, TypeScript, Zod, PostgreSQL/Drizzle, exifr, AMap JS API, Playwright, Vitest.

---

### Task 1: Extend metadata and rating contracts

**Files:**
- Modify: `packages/contracts/src/photos.ts`
- Modify: `packages/contracts/src/imports.ts`
- Modify: `apps/api/src/db/schema/photos.ts`
- Modify: `apps/api/src/db/migrations/0001_initial.sql`
- Create: `apps/api/src/db/migrations/0004_photo_rating_seven_stars.sql`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] Change the rating constraints and schemas from 0-5 to 0-7, keeping null for un-rated photos.
- [ ] Add a migration that drops/recreates the rating check constraint as `rating IS NULL OR rating BETWEEN 0 AND 7`.
- [ ] Add contract coverage for rating 7 and rejection of rating 8.

### Task 2: Preserve imported EXIF location and camera fields

**Files:**
- Modify: `apps/worker/src/metadata/exif-reader.ts`
- Modify: `apps/worker/src/jobs/import-batch.ts`
- Modify: `apps/web/src/views/admin/AdminImportsView.vue`
- Test: `apps/worker/src/metadata/exif-reader.test.ts`

- [ ] Map `GPSAltitude`/`GPSAltitudeRef` to a numeric `altitude` field while retaining existing latitude/longitude mapping.
- [ ] Normalize focal length, aperture, exposure time, and ISO without discarding valid numeric zero-like values.
- [ ] Read an optional rating field from manifest/XMP input and validate it in the 0-7 range.
- [ ] Show the complete parameter summary in the import preview metadata list.

### Task 3: Expose and map metadata in the web client

**Files:**
- Modify: `packages/contracts/src/photos.ts`
- Modify: `apps/web/src/stores/gallery.ts`
- Modify: `apps/web/src/i18n.ts`
- Test: `apps/web/src/stores/gallery.test.ts`

- [ ] Include `rating` in the public/admin photo contract and map it to `GalleryPhoto`.
- [ ] Add typed camera fields, altitude, and raw coordinates to `GalleryPhoto` with localized “Not recorded” fallbacks.
- [ ] Add labels for rating, parameters, focal length, aperture, shutter, ISO, altitude, coordinates, and the detail tabs.

### Task 4: Build the reference-style viewer metadata UI

**Files:**
- Modify: `apps/web/src/components/PhotoMeta.vue`
- Modify: `apps/web/src/components/PhotoViewer.vue`
- Create: `apps/web/src/components/PhotoDetailPanel.vue`
- Test: `tests/e2e/gallery.spec.ts`

- [ ] Render seven accessible stars with only the first `rating` stars filled.
- [ ] Render compact parameter/camera/place sections without overflow on desktop or mobile.
- [ ] Add a more-action drawer with Basic parameters and Location tabs.
- [ ] Reuse the existing AMap loader and theme-aware map style for the location tab.

### Task 5: Update Studio editing and verify end to end

**Files:**
- Modify: `apps/web/src/views/admin/AdminPhotosView.vue`
- Modify: `apps/api/src/modules/admin/admin.test.ts`
- Modify: `tests/e2e/discover.spec.ts`
- Modify: `tests/visual/gallery.spec.ts`

- [ ] Allow Studio rating input from 0 through 7 and reject larger values before sending.
- [ ] Verify API round-trips rating 7 and metadata location fields.
- [ ] Add E2E checks for the drawer, star state, and responsive layout.
- [ ] Run typecheck, lint, unit tests, build, E2E, visual tests, and `git diff --check`.
