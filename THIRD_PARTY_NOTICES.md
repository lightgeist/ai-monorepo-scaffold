# Third-party notices

- **Pi**: `third_party/pi-mono` and derived terminal code, MIT. Full notices are in `third_party/pi-mono/LICENSE` and `packages/tui/THIRD_PARTY_NOTICES.md`. Local modifications are recorded in `third_party/pi-mono/MINIMAX_CHANGES.md`.
- **Sandbox Runtime**: `third_party/sandbox-runtime`, Apache-2.0. See its README, LICENSE, and upstream.json for the upstream version, source revision, fork changes, and native build instructions.
- **models.dev**: the bundled provider / model catalog snapshot, MIT; notices are in `packages/tui/THIRD_PARTY_NOTICES.md`.
- **Bundled assets**: LICENSE, NOTICE, and file-level declarations in each asset directory retain their original attribution.
- **npm dependencies**: versions and declared licenses are recorded in `release/dependency-licenses.json`; `pnpm-lock.yaml` is authoritative for dependency resolution and integrity.
- **Upstream command helper 0.0.4**: sourced from the authenticated public `@minimax-ai/code@0.3.11` archive, under its original MIT declaration. `scripts/lib/atlascode-tools-artifact.mjs` verifies the original archive and CLI digests before applying a product-identity-only transform. The shipped helper is named `@atlascode/atlascode-tools`; its new digest is recorded independently. Original dependency notices are retained in `dist/ATLASCODE_TOOLS_NOTICES.md`. This does not claim original authorship or unchanged bytes for the transformed helper.

The root MIT license does not replace these materials' separate licenses or copyright notices.
