# Changelog

## 0.1.0 — 2026-10-04

Initial atlascode-rs derivative of upstream 0.14.9 at `ddcf1eb5513b02ca2a68964220f115da0a69a80a`.

Rebrands application, native and npm distribution identities, own settings/logs,
CLI/man/completions, installer environment and runtime diagnostics. Replaces
the original mascot with an angular terminal mark and a blue accent. Preserves
SDK 0.3.288, Bun 1.4.0 and provider compatibility. Disables in-app updates; uses
version-qualified fork release endpoints and private npm artifacts. Adds
provenance, modification ledger, archive attribution, and release verification.

The upstream changelog is preserved unchanged in `docs/upstream/CHANGELOG.md`.

Final qualification corrects the blocked-stdin shutdown fixture to keep its non-reading child alive until reaped; the 50 ms deadline and two-second bound remain. Security and release-tooling documentation no longer inherit upstream services, publishing instructions or response promises.

### Qualification repairs

The full native gate caught three stale branding assertions (release URL, mark,
and truncated path width); they now verify the new identities. Bridge test
selection now quotes its recursive glob so Unix and Windows execute the same
439-test suite rather than omitting the root tests on Unix. The external-SDK
fixture intercepts ESM imports only, keeping the production version lookup real.
Portable verification removes both system runtimes from the app PATH, executes
the real binary/bridge and checks missing-runtime/script failure controls.
The macOS configuration fixture compares canonical existing file paths so /var
and /private/var name the same expected project file. The Windows ARM PowerShell
fixture has a bounded 30-second response deadline instead of five seconds;
exact NDJSON identity, ordering and completion assertions remain unchanged.
These verification changes do not alter SDK, permissions, model routing or billing.

### Final installer qualification

Fixed a Unix single-key confirmation Ctrl-C race by reading ETX explicitly while the prompt owns the terminal; saved terminal flags are restored by the existing exit trap. The unchanged real-PTY cancellation test passed ten consecutive local runs before final CI. Windows version-guard fixtures now assert the namespaced fork release and advisory URLs, including a namespaced API tag fixture. Rust, bridge, executable launcher, dependencies and native regression tests remain byte-identical to the six-host native build. NATIVE-INPUTS.json records the equivalence boundary. Final package and installer tests run against these corrected scripts.
