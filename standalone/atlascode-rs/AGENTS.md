# atlascode-rs development

This is a narrow, attributed derivative. Read README.md, NOTICE and MIGRATION.md.
Keep the native Rust UI and official SDK bridge behavior intact. Do not rename
provider-owned `CLAUDE_*`, `.claude`, model identifiers or wire fields.

Before release run Rust formatting, strict Clippy, all targets/tests, the bridge
build/test suite, packaging and installer tests, the brand audit, and the native
archive smoke suite. Preserve the exact upstream pin and locked dependencies.
Never treat mock bridge coverage as evidence of authenticated provider behavior.

Do not publish npm packages (private by default), re-enable automatic updates,
change provider routing or bypass permissions as part of a branding patch.
Keep LICENSE and NOTICE in every source and binary distribution. Record modified
files in the rebrand ledger. Do not overwrite another application's commands,
settings, registry identities, release channel, or CI credentials.
