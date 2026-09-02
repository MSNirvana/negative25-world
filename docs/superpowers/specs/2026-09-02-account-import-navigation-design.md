# Account Import Navigation

## Goal

Make the personal-center overview's import action open the existing import module.

## Design

- Use the canonical account route `/account/imports` from the overview action.
- Keep the existing account route guard so unauthenticated users are sent through login before importing.
- Add an end-to-end regression test that clicks the overview action and verifies the import view is rendered.

## Scope

This change only corrects navigation and its regression coverage. Upload, authentication, and import processing behavior remain unchanged.
