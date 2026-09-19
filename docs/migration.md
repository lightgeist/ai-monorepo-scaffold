# Profile and session compatibility

Fresh AtlasCode installs use `~/.atlascode`; new sessions use the `atl_` prefix. Historical session IDs remain opaque IDs and are not rewritten. Previous `mvs_` sessions are still recognized when opening a session explicitly.

The historical primary-agent aliases `mavis` and `main` are read as members of the primary identity family. New canonical identity is `atlascode`. Frozen SQL migrations retain their historical payloads. Imported legacy agent metadata and plugin manifests remain readable; new writes use the AtlasCode names.

Explicit legacy data-directory environment variables remain lower-priority compatibility aliases; prefer `ATLASCODE_DATA_DIR` for new use. Existing profile link handling remains explicit. A fresh launch does not create a directory with the former product's name.

Before moving a valuable profile: quit all processes using it, make an independent backup, and test a copy using `ATLASCODE_DATA_DIR`. Never overwrite an existing AtlasCode profile or edit SQLite tables to rename IDs. Platform credential-store entries may require signing in again under the new application identity. Compatibility tests exercise fixtures, not a guarantee for every historical production database.
