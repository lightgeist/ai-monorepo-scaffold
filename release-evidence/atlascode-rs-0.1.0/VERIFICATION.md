# atlascode-rs 0.1.0 — release verification

## Delivered

Six real native portable archives, exact final source ZIP/TAR, checksums and evidence.
The application is a rebrand of upstream 0.14.9 at `ddcf1eb5513b02ca2a68964220f115da0a69a80a`.
It retains the official Claude Agent SDK 0.3.288 and private Bun 1.4.0 runtime.

## Executed tests

| Native platform | Rust tests | Bridge tests | 16 real PTY scenarios | Portable runtime |
|---|---:|---:|---|---|
| darwin-arm64 | 2014 | 439 | Passed | Passed |
| darwin-x64 | 2014 | 439 | Passed | Passed |
| linux-x64-gnu | 2014 | 439 | Passed | Passed |
| linux-arm64-gnu | 2014 | 439 | Passed | Passed |
| win32-x64-msvc | 2018 | 439 | Passed | Passed |
| win32-arm64-msvc | 2018 | 439 | Passed | Passed |

Final packaging and actual portable runtime: https://github.com/lightgeist/ai-monorepo-scaffold/actions/runs/37194909957
Independent Windows installer confirmation: https://github.com/lightgeist/ai-monorepo-scaffold/actions/runs/37195342387
Original native build/test run: https://github.com/lightgeist/ai-monorepo-scaffold/actions/runs/37164321262
Dependency policy audit: https://github.com/lightgeist/ai-monorepo-scaffold/actions/runs/37164474484

The original native run is not described as wholly successful: all six native
Rust/bridge/build steps passed, while installer failures blocked packaging.
Those failures were corrected. Final packaging and all six actual archive runtime
steps passed. The Windows CI wrapper then incorrectly returned LASTEXITCODE left
by an intentionally failing test child, although both suites reported success.
Two additional native Windows jobs reran the unchanged suites in separate
PowerShell processes and verified their actual successful exit statuses.
The release gate requires those jobs; original workflow conclusions remain in
the evidence. No failed assertion was removed or silently discarded.

Each final archive runs its actual binary and bundled Bun/SDK bridge with system
Node.js and Bun removed from the application's PATH. Version, help, completion,
manual generation and strict diagnostics are checked. Removing the private
runtime or bridge script must fail closed. Windows ownership/PATH and version
guards passed. The unchanged Linux real-PTY installer cancellation test passed
10 consecutive final-CI repetitions (and 10 local repetitions).

Additional evidence covers strict Rust formatting/Clippy, TypeScript build,
Biome, Knip (isolated from the enclosing host monorepo), dependency advisories,
44 package/resolver/version tests,
14 installer-progress tests, package
layouts, notices, real Linux npm install smoke, 40 brand
checks, and independent archive path/architecture/executable-hash verification.

## Exact byte boundaries

Final source commit: `60a3929f5cfb5a529b39469000cf9444b58d63e9`.
Final source tree: `906573f0518d808b5c0668fb3e349e372834070f`.
Native build baseline: `8a8a073ee47dc3155e43991a409b7d46a76a9d3c`.

NATIVE-INPUTS.json records 323 Rust, tests, bridge, launcher,
manifest, lockfile and license inputs. Every file is checked byte-for-byte against
both the actual build baseline and final source. The final changes are in Unix
installer Ctrl-C handling, Windows installer test URLs, release notes and
provenance tooling. Native binaries are not rebuilt or patched after their native
tests; their archive bytes are checked against the original build artifacts.
The final installers and archives are tested separately on matching native hosts.

## Rebrand boundary

Application/crate/library/npm/launcher names, own settings/logs/environment,
diagnostics, welcome mark/accent, installer paths, release URLs, documentation
and distribution notices use atlascode-rs. Provider-owned identifiers such as
.claude, CLAUDE.md, credentials, SDK/model names and provider commands remain
compatible. Original authorship/license and historical upstream documents remain
attributed. In-app updates are disabled; explicit installs use fork release tags.

## Limits

This is an unsigned preview: no macOS notarization or Windows Authenticode.
No authenticated model call, account entitlement, billing, physical-device UX,
penetration test, performance benchmark or every-OS-version support is claimed.
Real PTY tests use a scripted peer, not a live model. No public npm or Cargo package
was published. The official claude CLI remains needed for documented CLI-backed
operations. Own application state is separate; provider state may be shared.
Dependency checks are point-in-time under the recorded policy, not a warranty.

## Integrity

CHECKSUMS.sha256 uses flat release filenames. SHA256SUMS retains dist-install/
paths expected by the shipped installers. The evidence ZIP contains the actual
logs, manifests, terminal captures, native-input proof and dependency notices.
Checksums are integrity evidence, not OS code signing.
