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
