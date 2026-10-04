# atlascode-rs

**A native coding terminal. Rust UI. Official Claude Agent SDK.**

```text
       /\          atlascode-rs 0.1.0
      /  \         Native terminal. Visible tools. Explicit permissions.
     / /\ \
    /_/  \_\
```

atlascode-rs is an independently branded derivative of
[srothgan/claude-code-rust](https://github.com/srothgan/claude-code-rust),
pinned at `ddcf1eb5513b02ca2a68964220f115da0a69a80a` (upstream 0.14.9).
It is not Anthropic's official CLI and is not a new inference engine.

```text
atlascode-rs (Rust / Ratatui / Crossterm)
      | local NDJSON
      v
private Bun runtime -> official Claude Agent SDK -> Anthropic services
      |                                     |
      +---------- tools / permissions -------+
```

## Run a verified release

Use the matching **atlascode-rs-0.1.0-<platform>** archive and verify its SHA256
against `SHA256SUMS` before extraction. Each portable archive carries the Rust
binary, a private Bun runtime, the bridge, and production SDK dependencies.
There is no Node.js, Bun, or Rust installation requirement for the portable archive.

```sh
# macOS / Linux: from the extracted platform directory
./atlascode-rs --version
./atlascode-rs doctor
./atlascode-rs -C /path/to/project
```

```powershell
# Windows: from the extracted platform directory
.\atlascode-rs.exe --version
.\atlascode-rs.exe doctor
.\atlascode-rs.exe -C C:\path\to\project
```

A supported Claude account or provider configuration is still required for real
model work. Keep the official `claude` CLI installed and authenticated for the
CLI-backed operations described in [About](docs/src/about.md). Its login and
billing remain controlled by Anthropic; this fork does not create an entitlement.

[Installation](docs/src/installation.md) · [Usage](docs/src/usage.md) ·
[Commands](docs/src/commands.md) · [Settings](docs/src/settings.md) ·
[Troubleshooting](docs/src/troubleshooting.md) · [Migration](MIGRATION.md)

## Build from source

Prerequisites: Rust 1.89 (see `rust-toolchain.toml`), Node.js 24+ with npm, and Bun 1.4.0 for development launches.

```sh
npm ci --prefix agent-sdk
npm --prefix agent-sdk test
cargo test --locked --all-targets
cargo build --locked --release
./target/release/atlascode-rs --version
```

A debug source-tree launch (`cargo run`) uses Bun from PATH to run `agent-sdk/dist/bridge.js`.
A release-mode source launch also needs the private runtime beside the binary; see
[Development](docs/src/development.md). Packaged releases include this runtime.

## What changed

Product/crate/npm/launcher identities, terminal wordmark and accent, own app data,
diagnostics schemas, environment variables, installer and release artifact names,
manuals, completion output, package notices, and release automation are rebranded.
The engine, SDK version, wire protocol, tools, permission semantics, and provider
configuration keys are retained. No telemetry endpoint or alternative provider is added.

**In-app update checking and installation are disabled in 0.1.0.** Explicit
installation uses namespaced `atlascode-rs-v*` releases, never another project's
`latest` release. The npm artifacts are private installable tarballs, not a claim
that a public npm package or namespace has been registered.

## License and provenance

Apache-2.0 for this source derivative; the original copyright notices remain.
See [LICENSE](LICENSE), [NOTICE](NOTICE), [PROVENANCE.json](PROVENANCE.json), and
[historical upstream documents](docs/upstream/INDEX.md). The official SDK and
bundled runtimes retain their own licenses and terms. A rebrand is not an audit
of third-party licensing or a warranty of compatibility with future provider changes.

Native build/test evidence and exact artifact hashes accompany the release.
Authenticated model calls, OS signing/notarization, and physical-device UX are
not implied by a passing mock-bridge or packaging test.
