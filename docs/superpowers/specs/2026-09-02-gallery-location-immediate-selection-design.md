# Gallery Location Immediate Selection

## Goal

Restore the gallery location picker to the direct-selection interaction: choosing a location applies the filter immediately and closes the picker.

## Design

- Clicking `All locations` or an available location emits `select-location` with the selected location and closes the popover in the same event.
- The selected checkmark and `aria-selected` state read directly from the parent-provided `selectedLocation` value.
- Remove the temporary selection state and the footer `Cancel`/`Confirm` action row.
- The close icon, Escape key, outside click, and inactive-gallery cleanup only close the popover. They do not emit a new location or undo a selection that already took effect.
- Disabled locations remain non-selectable and do not close the picker.

## Testing

- Typecheck the web package.
- Run the web unit test suite and production build.
- Run `git diff --check` to catch whitespace errors.

## Scope

Only `apps/web/src/components/LocationPicker.vue` and this design record are changed. Location catalog construction, filtering, and parent gallery state remain unchanged.
