# Development

This page covers building and running atlascode-rs from source. For CI checks, coding standards, and how to open a pull request, see [CONTRIBUTING.md](https://github.com/lightgeist/ai-monorepo-scaffold/blob/atlascode-rs/rebrand-20261004/standalone/atlascode-rs/CONTRIBUTING.md).

## Build From Source

Use this path when developing the project or testing a fork without installing a global `atlascode-rs` command:

Source development requires the pinned Rust 1.89 toolchain, Node.js 24 with npm, and Bun. These are developer toolchain requirements, not requirements for script-installed users.

```bash
git clone --branch atlascode-rs/rebrand-20261004 https://github.com/lightgeist/ai-monorepo-scaffold.git
cd ai-monorepo-scaffold/standalone/atlascode-rs
npm ci --prefix agent-sdk
npm run build --prefix agent-sdk
cargo run
```

Maintainer and source-build npm tooling targets Node.js 24. Packaged installs use the bundled private Bun runtime for the Agent SDK bridge.

Debug builds resolve `agent-sdk/dist/bridge.js` from the checkout after the bridge is built. They use `bun` from `PATH` unless `ATLASCODE_RS_AGENT_BRIDGE_RUNTIME` points at a specific Bun executable.

For a release-mode source binary, build the bridge and binary, then provide both an explicit bridge script and a Bun runtime using the bundled-runtime filename. Release-mode source binaries do not use the debug PATH fallback for Bun.

```bash
npm ci --prefix agent-sdk
npm run build --prefix agent-sdk
cargo build --release --locked --bin atlascode-rs
cp "$(command -v bun)" ./target/release/atlascode-rs-bridge-bun
./target/release/atlascode-rs --bridge-script ./agent-sdk/dist/bridge.js
```

On Windows, copy `bun.exe` next to the binary as `atlascode-rs-bridge-bun.exe`, then run:

```powershell
Copy-Item (Get-Command bun).Source .\target\release\atlascode-rs-bridge-bun.exe
.\target\release\atlascode-rs.exe --bridge-script .\agent-sdk\dist\bridge.js
```

Do not use `cargo install --path .` if you want to test the npm install shape. `cargo install` writes only the Rust binary to Cargo's bin directory and does not install the bundled Agent SDK bridge, private Bun runtime, or platform package layout.

## Manual Bridge Overrides

If you need to run a manually built binary outside the npm package layout, pass the bridge explicitly:

```bash
atlascode-rs --bridge-script /path/to/atlascode-rs/agent-sdk/dist/bridge.js
```

You can also set:

```bash
ATLASCODE_RS_AGENT_BRIDGE=/path/to/agent-sdk/dist/bridge.js
```

Debug builds can use a local runtime override while developing the bridge:

```bash
ATLASCODE_RS_AGENT_BRIDGE_RUNTIME=/path/to/bun
```

Release npm installs ignore runtime overrides and use the bundled `atlascode-rs-bridge-bun` executable from the platform package.
