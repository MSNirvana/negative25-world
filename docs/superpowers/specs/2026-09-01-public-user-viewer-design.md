# Public User Viewer Mode

## Goal

Every account has a public profile by default. Selecting a user from the header search changes the public-facing archive context to that user's published photography while preserving the signed-in account and its personal center.

## Design

- The selected public user is represented by the `user` query parameter (for example `/?user=gavin`) so the context survives navigation between Gallery, Discover, Albums, and photo details.
- Public API reads resolve the user's personal workspace server-side and return only photos where `published=true` and `hidden=false`. Private workspace permissions and authentication remain unchanged for `/account` routes.
- The public profile payload includes the resolved personal workspace slug. Public workspace photo and album endpoints accept anonymous requests only when the owner's profile is public.
- Search results navigate directly to the gallery in that user's context. A visible viewer indicator and clear action return to the default archive.
- Existing and newly registered profiles default to `profile_public=true`; the profile setting can still be disabled later, which removes anonymous user browsing/search access unless the product explicitly re-enables it.

## Verification

API tests cover default-public profiles, anonymous public workspace reads, and exclusion of hidden/unpublished photos. Web tests cover search navigation, context persistence, context reset, and keeping the personal-center route tied to the signed-in session.
