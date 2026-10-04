# Installation

Version: atlascode-rs 0.1.0. Release tag: `atlascode-rs-v0.1.0`.

## Portable archives (recommended)

Choose exactly one matching OS/architecture archive, verify SHA256SUMS, and
extract it into a new directory. Run `./atlascode-rs --version` on macOS/Linux
or `.\atlascode-rs.exe --version` on Windows. Run `doctor` next.

Platforms: macOS arm64/x64; Linux glibc arm64/x64; Windows arm64/x64.
Linux musl is not supported. Each archive contains the native UI, private Bun
runtime, compiled bridge and SDK production dependencies. Keep that directory
together: copying the UI binary alone does not copy its bridge or runtime.

The portable archive does not need Node.js, Bun or Rust installed. The official
`claude` CLI remains necessary for the CLI-backed operations in [About](about.md).
Authentication, usage charges and service access remain provider responsibilities.

## Optional install scripts

Inspect the version-pinned script before running it. The script verifies downloaded
archive hashes, uses this fork's own paths and command name, and requires confirmation
before replacement or cleanup. The initial release does not modify upstream installs.

```sh
sh scripts/install/install.sh --release 0.1.0 --verify
```

```powershell
& .\scripts\install\install.ps1 -Release 0.1.0 -Verify
```

These scripts fetch assets only from namespaced `atlascode-rs-v*` release tags in
`lightgeist/ai-monorepo-scaffold`. The `latest` selector resolves the pinned 0.1.0 tag for this release,
not the repository-wide latest release. In-app update checking/installation is disabled.
For offline use, prefer the already verified portable archive rather than the script.

Use `--help` / `-Help` for custom installation directories and uninstall options.
Default Unix data path: `${XDG_DATA_HOME:-$HOME/.local/share}/atlascode-rs`;
default executable path: `$HOME/.local/bin/atlascode-rs`. Windows uses its own
`%LOCALAPPDATA%\Programs\atlascode-rs` directory.

## npm and source builds

The npm tarballs are private distribution artifacts for packaging/integration tests.
Do not run `npm install -g atlascode-rs` expecting a verified public registry package.
See the root README for a source build. Development needs Node.js 24+ and Rust 1.89;
release bundles use the private Bun 1.4.0 runtime.

## Upgrade and rollback

Keep the previous verified portable directory until the new one passes `doctor`
and a harmless test in a disposable project. Switching directories rolls back the
application binary/runtime; it does not roll back shared provider data. No migration
of upstream app settings is implicit. See [Migration](../../MIGRATION.md).

## Integrity and platform limits

Checksums detect changed bytes; they are not OS code signing. macOS packages are
not notarized and Windows binaries are not Authenticode-signed. Review the publisher
and hashes before granting OS execution permission. Do not disable OS security
protections globally. Native CI is not a physical-device UX certification.
