# Gallery Location Selection Confirmation

## Goal

Keep the gallery stable while a visitor explores locations, and apply a new location filter only after explicit confirmation.

## Design

- Opening the picker copies the parent-provided `selectedLocation` into a temporary selection.
- Clicking `All locations` or an available location updates only the temporary selection and keeps the popover open.
- The selected checkmark and `aria-selected` state reflect the temporary selection while the picker is open.
- Clicking `Confirm` emits `select-location` with the temporary selection and closes the popover.
- `Cancel`, the close icon, Escape, outside click, and inactive-gallery cleanup discard the temporary selection without changing the gallery.
- Disabled locations remain non-selectable and do not close the picker.

## Testing

- Run lint, typecheck, unit/API tests, production build, and gallery/discover E2E tests.
- Run `git diff --check` to catch whitespace errors.

## Scope

Only `apps/web/src/components/LocationPicker.vue`, its end-to-end coverage, and this design record are changed for this interaction. Location catalog construction, filtering, and parent gallery state remain unchanged.
