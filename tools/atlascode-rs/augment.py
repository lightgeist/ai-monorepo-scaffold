#!/usr/bin/env python3
"""Add fork-specific executable/PTY gates without weakening upstream tests."""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()

def add(path, text):
    p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(p.read_text()+text if p.exists() else text,encoding='utf-8',newline='\n')

add('src/app/update_check.rs','''
#[cfg(test)]
mod atlascode_release_policy_tests {
    #[test]
    fn fork_disables_checks_even_without_a_flag_or_environment_override() {
        assert!(super::update_check_disabled(false));
    }
}
''')
add('tests/rebrand_contract.rs','''// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 atlascode-rs contributors

use atlascode_rs::Cli;
use clap::CommandFactory;
use std::process::Command;

#[test]
fn command_factory_exposes_the_fork_identity_and_provider_boundary() {
    let mut command = Cli::command();
    assert_eq!(command.get_name(), "atlascode-rs");
    assert_eq!(command.get_version(), Some("0.1.0"));
    let help = command.render_long_help().to_string();
    assert!(help.contains("Claude Agent SDK"));
    assert!(!help.contains("claude-rs"));
}

#[test]
fn executable_version_is_the_fork_version_without_a_runtime_or_provider() {
    let output = Command::new(env!("CARGO_BIN_EXE_atlascode-rs"))
        .arg("--version")
        .env("ATLASCODE_RS_AGENT_BRIDGE", "missing-runtime-test.js")
        .env("CLAUDE_RS_AGENT_BRIDGE", "legacy-must-not-control-the-fork.js")
        .output().expect("run fork executable");
    assert!(output.status.success());
    assert_eq!(String::from_utf8(output.stdout).expect("UTF-8 version").trim(), "atlascode-rs 0.1.0");
    assert!(output.stderr.is_empty());
}

#[test]
fn own_diagnostic_paths_do_not_reuse_upstream_app_state() {
    let path = atlascode_rs::logging::default_diagnostics_dir().expect("diagnostic directory");
    assert_eq!(path.file_name().and_then(|part| part.to_str()), Some("logs"));
    let app = path.parent().and_then(std::path::Path::file_name).and_then(|part| part.to_str());
    assert!(matches!(app, Some("atlascode-rs" | ".atlascode-rs")), "{}", path.display());
}

#[test]
fn own_runtime_overrides_are_namespaced() {
    assert_eq!(atlascode_rs::agent::bridge::BRIDGE_SCRIPT_ENV_VAR, "ATLASCODE_RS_AGENT_BRIDGE");
    assert_eq!(atlascode_rs::agent::bridge::BRIDGE_RUNTIME_ENV_VAR, "ATLASCODE_RS_AGENT_BRIDGE_RUNTIME");
    assert!(!std::hint::black_box(atlascode_rs::brand::UPDATES_ENABLED));
}
''')
add('tests/terminal_resize.rs',r'''

#[test]
fn atlascode_welcome_identity_survives_resize_and_a_real_pty_turn() {
    let mut test = TerminalTest::start("stream", 3);
    test.wait_screen("atlascode-rs 0.1.0");
    let welcome = test.screen();
    assert!(welcome.contains(r"/_/  \_\"), "missing terminal mark: {welcome}");
    assert!(!welcome.contains("_~^~^~_"), "upstream mascot remains");
    if let Some(directory) = std::env::var_os("ATLASCODE_RS_CAPTURE_DIR") {
        let directory = PathBuf::from(directory);
        std::fs::create_dir_all(&directory).expect("capture directory");
        std::fs::write(directory.join("welcome.txt"), &welcome).expect("welcome capture");
        let captured = test.output.lock().expect("capture output");
        std::fs::write(directory.join("welcome.ansi"), captured.parser.screen().contents_formatted())
            .expect("ANSI welcome capture");
    }
    test.resize(TALL_ROWS, 50);
    test.wait_screen("atlascode-rs");
    test.resize(TALL_ROWS, 120);
    test.wait_screen("atlascode-rs 0.1.0");
    test.submit("Explain the atlascode-rs architecture", "atlascode-rs architecture");
    test.wait_journal("turn_complete");
    test.assert_prompts(&["Explain the atlascode-rs architecture"]);
    if let Some(directory) = std::env::var_os("ATLASCODE_RS_CAPTURE_DIR") {
        let directory = PathBuf::from(directory);
        std::fs::write(directory.join("mock-turn.txt"), test.screen()).expect("turn capture");
        let captured = test.output.lock().expect("capture output");
        std::fs::write(directory.join("mock-turn.ansi"), captured.parser.screen().contents_formatted())
            .expect("ANSI turn capture");
    }
    test.shutdown();
}
''')
add('START-HERE.md','''# atlascode-rs 0.1.0 — portable application

Keep this directory together. It contains the native Rust terminal, its private
Bun runtime, the compiled bridge and official Claude Agent SDK dependencies.
No separate Node.js, Bun or Rust installation is needed for this package.

## Run

macOS / Linux, from this directory:

```sh
./atlascode-rs --version
./atlascode-rs doctor
./atlascode-rs -C /path/to/project
```

Windows PowerShell, from this directory:

```powershell
.\\atlascode-rs.exe --version
.\\atlascode-rs.exe doctor
.\\atlascode-rs.exe -C C:\\path\\to\\project
```

Use a supported provider account. Install/authenticate the official `claude` CLI
for CLI-backed login/logout, plugin management and other documented operations.
This fork does not include credentials, a subscription or a promise about billing.
`doctor` may report unavailable account/CLI capabilities on a new installation;
a passing package smoke test does not supply those credentials.

The command is atlascode-rs, not claude or claude-rs. Its own settings, logs,
launcher and environment variables are isolated under atlascode-rs / ATLASCODE_RS_.
Provider configuration and sessions remain compatible and may be shared. See MIGRATION.md.
In-app updates are disabled. Install a verified fork archive explicitly to upgrade.

Verify this archive against SHA256SUMS from the same release. Packages are not
macOS-notarized or Windows Authenticode-signed. Do not globally disable OS protections.
The release's verification report records actual tested platforms and remaining limits.

Apache-2.0 source; original attribution is in LICENSE and NOTICE. SDK/runtime
licenses remain separate. See THIRD-PARTY-NOTICES.md and PROVENANCE.json.

Source/manual:
https://github.com/lightgeist/ai-monorepo-scaffold/tree/atlascode-rs-v0.1.0/standalone/atlascode-rs
''')
p=root/'scripts/install/generate-install-archives.mjs'
s=p.read_text().replace('copyFileFromRepo("NOTICE", path.join(appRoot, "NOTICE"));','copyFileFromRepo("NOTICE", path.join(appRoot, "NOTICE"));\n    copyFileFromRepo("START-HERE.md", path.join(appRoot, "START-HERE.md"));\n    copyFileFromRepo("MIGRATION.md", path.join(appRoot, "MIGRATION.md"));')
p.write_text(s,encoding='utf-8',newline='\n')
p=root/'scripts/install/verify-install-archives.mjs';s=p.read_text().replace('    "NOTICE",','    "NOTICE",\n    "START-HERE.md",\n    "MIGRATION.md",');p.write_text(s,encoding='utf-8',newline='\n')
print('Added 6 fork-specific executable/PTY tests and portable quickstart/migration docs.')

# The original 500 ms non-reader can exit during debug serialization on a slow
# native runner. Keep the child alive, retaining the 50 ms deadline and 2 s bound.
p=root/'src/app/connect/bridge_lifecycle.rs'
s=p.read_text()
before='''    async fn bridge_shutdown_deadline_covers_a_blocked_stdin_writer() {
        let fixture = RuntimeFixture::new(delayed_no_output_script()).expect("runtime fixture");'''
after=r'''    async fn bridge_shutdown_deadline_covers_a_blocked_stdin_writer() {
        // A half-second child may exit while an 8 MiB prompt is serialized in
        // a slow debug build. Keep the non-reading process alive until reaped.
        let script = if cfg!(windows) {
            "@echo off\r\n:wait\r\ngoto wait\r\n"
        } else {
            "#!/bin/sh\nexec sleep 30\n"
        };
        let fixture = RuntimeFixture::new(script).expect("runtime fixture");'''
if s.count(before)!=1:raise RuntimeError('blocked-stdin fixture source changed')
p.write_text(s.replace(before,after),encoding='utf-8',newline='\n')
(root/'SECURITY.md').write_text('''# Security and reporting

atlascode-rs 0.1.0 is an independent derivative, not an Anthropic product.
Its source and dependency graphs are pinned in PROVENANCE.json.

## Reporting

Do not put credentials, unredacted diagnostic logs, private code, or exploitable
vulnerability details in public issues. Use the hosting repository's private
vulnerability-reporting option when available. A dedicated confidential reporting
channel and response-time service level have not been established for this fork;
no upstream maintainer contact or response promise is inherited.

Report issues in the official Claude Agent SDK or Claude service to the provider
through its own security process. Do not send this fork's support requests to the
original claude-code-rust maintainer.

## Release controls

The initial release uses locked dependencies, a Cargo Deny policy check, an npm
dependency advisory check, a first-party identity/provenance audit, native tests,
and portable archive runtime checks. See the release verification report for
actual results, source revisions, dates, and limitations. These are point-in-time
checks, not a penetration test or a guarantee that vulnerabilities do not exist.

This fork does not claim a nightly dependency monitor, enforced branch rules,
secret scanning, push protection, registry ownership, or private reporting merely
because the upstream used them. Such repository services must be configured and
verified separately. No ongoing monitoring is implied by the release audit.

## Safe operation

Normal project trust and tool-permission checks remain enabled. Review commands
and filesystem access before approval, especially in unfamiliar repositories.
Provider configuration and sessions may be shared with the official CLI; own
application-state isolation is not a sandbox or a provider-data isolation boundary.
See MIGRATION.md for namespace behavior.

Automatic and in-app updates are disabled in 0.1.0. Use a verified fork archive
for explicit upgrades. SHA256 checksums detect changed bytes but do not replace
publisher authentication, OS signing, or notarization. This release is not
macOS-notarized or Windows Authenticode-signed.

No live-account security evaluation, authenticated model task, or independent
security review is claimed. Third-party SDK/runtime terms remain applicable.
''',encoding='utf-8',newline='\n')
(root/'scripts/README.md').write_text('''# atlascode-rs release tooling

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
''',encoding='utf-8',newline='\n')
with (root/'CHANGELOG.md').open('a') as f:
    f.write('\nFinal qualification corrects the blocked-stdin shutdown fixture to keep its non-reading child alive until reaped; the 50 ms deadline and two-second bound remain. Security and release-tooling documentation no longer inherit upstream services, publishing instructions or response promises.\n')
