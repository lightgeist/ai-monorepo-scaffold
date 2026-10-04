// SPDX-License-Identifier: Apache-2.0
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
        .output()
        .expect("run fork executable");
    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).expect("UTF-8 version").trim(),
        "atlascode-rs 0.1.0"
    );
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
    assert_eq!(
        atlascode_rs::agent::bridge::BRIDGE_RUNTIME_ENV_VAR,
        "ATLASCODE_RS_AGENT_BRIDGE_RUNTIME"
    );
    assert!(!std::hint::black_box(atlascode_rs::brand::UPDATES_ENABLED));
}
