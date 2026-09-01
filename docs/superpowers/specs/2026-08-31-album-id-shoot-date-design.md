# Album IDs and Shoot Dates

## Goal

Remove the manually managed album URL slug, use the persisted album ID in public album URLs, and add an optional date representing the album's shooting or travel date. Also fix the current album save flow so the form and API agree on the fields being persisted.

## Scope

- Admin album create/edit form removes the URL slug input and adds an optional date input.
- Public and admin album responses expose `shootDate` as `YYYY-MM-DD` or `null`.
- Public album detail URLs use `/album/:id`; the API detail endpoint uses `/spaces/:spaceSlug/albums/:albumId`.
- Album create/update requests no longer accept `slug`.
- PostgreSQL migration removes the album slug column and uniqueness constraint, and adds nullable `shoot_date DATE`.
- Existing album photo selection, cover validation, permissions, and public visibility behavior remain unchanged.

## Data Flow

The browser sends `shootDate` as an HTML date value or `null`. The API validates it as a calendar date, stores it in PostgreSQL as a `DATE`, and returns the same date-only string. No timezone conversion is applied. The in-memory repository uses the same string representation.

The public albums list includes each album ID and date. The list view links to the album ID. The detail view reads the ID route parameter and requests the matching API resource. The workspace slug remains in the API path because it identifies the workspace, not the album URL slug.

## Validation and Errors

- Title remains required.
- `shootDate` is optional; when present it must match `YYYY-MM-DD` and represent a real calendar date.
- Invalid request data returns the existing 400 validation response.
- Missing albums and invalid photo/cover IDs retain existing 404 behavior.
- Save failures keep the editor open and preserve entered values so the user can correct or retry.

## Compatibility and Migration

Migration `0003_album_shoot_date.sql` adds `shoot_date`, drops the old workspace/slug uniqueness constraint, and drops `slug`. This is a deliberate schema cleanup for the confirmed ID-only URL design. All repository queries and route parameters are updated in the same release.

## Testing

- Contract tests cover public/admin album payloads with and without `shootDate`.
- API tests cover creation, update, ID-based detail lookup, invalid date rejection, and the absence of slug requirements.
- Repository tests cover in-memory date persistence.
- Web typecheck/build verifies the admin form and ID-based navigation.
