# atlascode-rs release tooling

These scripts are retained, rebranded and tested from the pinned upstream. The
initial fork qualification workflow selects the checks described below; the
upstream's nightly automation and public npm publication are not inherited.

## Runtime and packages

`runtime/stage-bun-runtime.mjs` validates and stages private Bun 1.4.0 binaries
from the checked-in checksum manifest. `runtime/verify-staged-bun-runtimes.mjs`
checks those staged bytes. `shared/npm-package-config.mjs` defines the six
supported OS/architecture packages and the atlascode-rs identities.

`npm/generate-npm-packages.mjs` builds private npm package directories.
`npm/verify-npm-packages.mjs` validates layout and notices. The install smoke
runner can exercise actual binaries with `--real-binary --no-system-runtime`.
Private tarballs are engineering artifacts; no public npm namespace is claimed.
The retained publication helpers are not a release instruction. Do not remove
`private: true`, publish packages, or change registry ownership as a branding task.

`install/generate-install-archives.mjs` assembles portable archives with the
native UI, private runtime, production SDK/bridge, attribution and quickstart.
`install/verify-install-archives.mjs` checks all six layouts.
`install/smoke-install-archive.mjs --platform <platform> --real-binary --no-system-runtime`
runs the matching real archive, verifies version/help/completions/manuals and
diagnostics, exercises the bridge contract, and checks missing-runtime/script
failure behavior. It requires a matching native host.

`--mock-native-binary` and `--mock-binaries` are for packaging fixtures only.
Never distribute those artifacts or describe their checks as a native runtime test.

## Installers and advisories

`install/install.sh` and `install/install.ps1` use their own atlascode-rs paths,
checksum verification and version-qualified `atlascode-rs-v*` release URLs.
For 0.1.0, the default release selector resolves the pinned 0.1.0 tag, not the
hosting repository's global latest release. In-app updates are disabled.

`install/release-advisories.json` starts empty: upstream version ranges do not
describe this fork. Its schema allows bounded version ranges and restricted
plain-text summaries. The installers fetch the version-pinned fork advisory file,
not a mutable upstream or main-branch file. A fetch failure does not replace the
archive checksum check. Introducing advisories for a later release requires
updating and testing that release's policy; public npm deprecation is not available
unless a registry publication decision is made separately.

## Verification

```sh
node scripts/runtime/stage-bun-runtime.mjs --check
node scripts/shared/verify-third-party-notices.mjs
node --test scripts/npm/npm-resolver.test.cjs scripts/npm/smoke-npm-package-install.test.mjs scripts/runtime/verify-staged-bun-runtimes.test.mjs scripts/install/release-advisories.test.mjs scripts/install/install-version-guard.test.mjs
cargo fmt --all -- --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets
python3 tools/verify-brand.py
```

Run the installer path/progress tests using their required mock archive fixtures,
and the PowerShell installer tests on Windows. A successful development check
is not the entire release gate. Actual qualification also binds native build
metadata to the source tree, assembles real archives, runs each on a matching
host, and independently checks architecture, paths, hashes and notices.

The retained `release/generate-release-bundle.mjs` and paired verifier are optional
engineering helpers, not evidence that a public or nightly workflow ran. The
release report, recorded workflow runs and downloaded artifact hashes describe
what was actually executed. See CONTRIBUTING.md and AGENTS.md for boundaries.
