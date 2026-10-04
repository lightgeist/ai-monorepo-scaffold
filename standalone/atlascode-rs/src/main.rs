// Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Simon Peter Rothgang

use atlascode_rs::Cli;
use atlascode_rs::app::PostExitAction;
use atlascode_rs::error::AppError;
use atlascode_rs::install_method::InstallMethod;
use clap::Parser;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::time::Instant;
use tracing::info_span;

#[cfg(not(target_os = "windows"))]
const UNIX_INSTALLER_URL: &str = "https://raw.githubusercontent.com/lightgeist/ai-monorepo-scaffold/atlascode-rs-v0.1.0/standalone/atlascode-rs/scripts/install/install.sh";
#[cfg(target_os = "windows")]
const WINDOWS_INSTALLER_URL: &str = "https://raw.githubusercontent.com/lightgeist/ai-monorepo-scaffold/atlascode-rs-v0.1.0/standalone/atlascode-rs/scripts/install/install.ps1";

#[allow(clippy::exit)]
fn main() {
    atlascode_rs::failure::install_panic_hook();
    match run() {
        Ok(0) => {}
        Ok(code) => std::process::exit(code),
        Err(err) => {
            if let Some(app_error) = extract_app_error(&err) {
                let mut stderr = std::io::stderr().lock();
                let detail = format!("{err:#}");
                if let Err(report_error) = atlascode_rs::failure::write_app_error_report_with_detail(
                    &mut stderr,
                    &app_error,
                    Some(&detail),
                ) {
                    eprintln!("{}", app_error.user_message());
                    eprintln!("failed to write failure report: {report_error}");
                }
                std::process::exit(app_error.exit_code());
            }
            eprintln!("{err:#}");
            std::process::exit(1);
        }
    }
}

fn run() -> anyhow::Result<i32> {
    let cli = Cli::parse();
    if let Err(error) = cli.validate() {
        error.print()?;
        return Ok(error.exit_code());
    }
    if let Some(exit_code) = atlascode_rs::cli::run_support_command(
        &cli,
        &mut std::io::stdout().lock(),
        &mut std::io::stderr().lock(),
    )? {
        return Ok(exit_code);
    }

    let _logging = atlascode_rs::logging::LoggingRuntime::init(&cli)?;
    {
        let startup_bootstrap_span = info_span!(
            target: atlascode_rs::logging::targets::APP_LIFECYCLE,
            "startup_bootstrap",
            resume_requested = cli.startup_launch().resume_requested(),
            explicit_bridge_script = cli.bridge_script.is_some(),
        );
        let _entered = startup_bootstrap_span.enter();
        let resolve_started = Instant::now();
        let bridge_launcher =
            atlascode_rs::agent::bridge::resolve_bridge_launcher(cli.bridge_script.as_deref())?;
        let duration_ms = u64::try_from(resolve_started.elapsed().as_millis()).unwrap_or(u64::MAX);
        tracing::info!(
            target: atlascode_rs::logging::targets::BRIDGE_LIFECYCLE,
            event_name = "bridge_launcher_resolved",
            message = "resolved agent bridge launcher",
            duration_ms,
            launcher = %bridge_launcher.describe(),
        );
    }

    let rt = tokio::runtime::Runtime::new()?;
    let local_set = tokio::task::LocalSet::new();

    let exit_code = rt.block_on(local_set.run_until(async move {
        // Phase 1: create app in Connecting state (instant, no I/O)
        let mut app = atlascode_rs::app::create_app(&cli);

        // Phase 2: start non-session startup work + TUI.
        // The bridge itself is started from the TUI loop only after trust is accepted.
        atlascode_rs::app::start_update_check(&app, &cli);
        let result = atlascode_rs::app::run_tui(&mut app).await;
        let post_exit_action = app.post_exit_action.take();
        maybe_print_resume_hint(&app);

        // Kill any spawned terminal child processes before exiting

        if let Some(app_error) = app.exit_error.take() {
            return Err(anyhow::Error::new(app_error));
        }

        result?;

        if let Some(action) = post_exit_action {
            return Ok(run_post_exit_action(&mut app, action));
        }

        Ok(0)
    }))?;

    Ok(exit_code)
}

fn run_post_exit_action(app: &mut atlascode_rs::app::App, action: PostExitAction) -> i32 {
    match action {
        PostExitAction::InstallUpdate { latest_version, method } => {
            run_update_install(app, &latest_version, method)
        }
    }
}

fn run_update_install(
    app: &mut atlascode_rs::app::App,
    latest_version: &str,
    method: InstallMethod,
) -> i32 {
    if !atlascode_rs::brand::UPDATES_ENABLED {
        eprintln!(
            "In-app updates are disabled in atlascode-rs. Install a verified fork release explicitly."
        );
        return 1;
    }
    let method_label = method.label();
    let result = match method {
        InstallMethod::Npm => run_npm_update(),
        InstallMethod::Script { install_dir } => {
            run_script_update(latest_version, install_dir.as_deref())
        }
        InstallMethod::Unknown => Err("no update install method was selected".to_owned()),
    };

    match result {
        Ok(status) if status.success() => {
            clear_install_failure(app);
            0
        }
        Ok(status) => {
            let code = status.code().unwrap_or(1);
            let message = format!(
                "{method_label} update install for v{latest_version} exited with status {status}."
            );
            eprintln!("{message}");
            record_install_failure(app, message);
            code
        }
        Err(error) => {
            let message = format!(
                "Failed to run {method_label} update install for v{latest_version}: {error}"
            );
            eprintln!("{message}");
            record_install_failure(app, message);
            1
        }
    }
}

fn run_npm_update() -> Result<ExitStatus, String> {
    let npm = resolve_npm().map_err(|error| format!("failed to resolve npm: {error}"))?;
    Command::new(&npm)
        .args(["install", "-g", "atlascode-rs"])
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .map_err(|error| format!("failed to start {}: {error}", npm.display()))
}

#[cfg(not(target_os = "windows"))]
fn run_script_update(
    latest_version: &str,
    install_dir: Option<&Path>,
) -> Result<ExitStatus, String> {
    let installer = download_unix_installer()?;
    let mut command = Command::new("sh");
    command
        .arg(&installer.script)
        .args(["--release", latest_version, "--yes", "--keep-npm"])
        .env_remove("ATLASCODE_RS_RELEASE")
        .env_remove("ATLASCODE_RS_INSTALL_DIR")
        .env_remove("ATLASCODE_RS_BIN_DIR")
        .env_remove("ATLASCODE_RS_NO_MODIFY_PATH")
        .env_remove("ATLASCODE_RS_REMOVE_NPM")
        .env_remove("ATLASCODE_RS_RUN")
        .env_remove("ATLASCODE_RS_UNINSTALL")
        .env_remove("ATLASCODE_RS_UPDATE")
        .env_remove("ATLASCODE_RS_VERIFY")
        .env("ATLASCODE_RS_NON_INTERACTIVE", "1")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    if let Some(install_dir) = install_dir {
        command.arg("--update").arg("--install-dir").arg(install_dir);
    }
    command.status().map_err(|error| format!("failed to start install script: {error}"))
}

#[cfg(target_os = "windows")]
fn run_script_update(
    latest_version: &str,
    install_dir: Option<&Path>,
) -> Result<ExitStatus, String> {
    let powershell = resolve_powershell()?;
    let mut command = Command::new(&powershell);
    command
        .args([
            "-NoLogo",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!(
                "$ProgressPreference='SilentlyContinue'; Invoke-Expression (Invoke-RestMethod -Uri '{WINDOWS_INSTALLER_URL}')"
            ),
        ])
        .env_remove("ATLASCODE_RS_INSTALL_DIR")
        .env_remove("ATLASCODE_RS_NO_MODIFY_PATH")
        .env_remove("ATLASCODE_RS_REMOVE_NPM")
        .env_remove("ATLASCODE_RS_RUN")
        .env_remove("ATLASCODE_RS_UNINSTALL")
        .env_remove("ATLASCODE_RS_UPDATE")
        .env_remove("ATLASCODE_RS_UPDATE_PARENT_PID")
        .env_remove("ATLASCODE_RS_VERIFY")
        .env("ATLASCODE_RS_RELEASE", latest_version)
        .env("ATLASCODE_RS_NON_INTERACTIVE", "1")
        .env("ATLASCODE_RS_KEEP_NPM", "1")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    if let Some(install_dir) = install_dir {
        command
            .env("ATLASCODE_RS_INSTALL_DIR", install_dir)
            .env("ATLASCODE_RS_UPDATE", "1")
            .env("ATLASCODE_RS_UPDATE_PARENT_PID", std::process::id().to_string());
    }
    command.status().map_err(|error| format!("failed to start {}: {error}", powershell.display()))
}

#[cfg(not(target_os = "windows"))]
struct DownloadedInstaller {
    root: PathBuf,
    script: PathBuf,
}

#[cfg(not(target_os = "windows"))]
impl Drop for DownloadedInstaller {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[cfg(not(target_os = "windows"))]
fn download_unix_installer() -> Result<DownloadedInstaller, String> {
    let root = create_update_temp_dir()?;
    let script = root.join("install.sh");
    let installer = DownloadedInstaller { root, script };
    let (downloader, args): (PathBuf, Vec<std::ffi::OsString>) =
        if let Ok(curl) = which::which("curl") {
            (
                curl,
                vec![
                    "-fsSL".into(),
                    UNIX_INSTALLER_URL.into(),
                    "-o".into(),
                    installer.script.as_os_str().to_owned(),
                ],
            )
        } else if let Ok(wget) = which::which("wget") {
            (
                wget,
                vec![
                    "-q".into(),
                    "-O".into(),
                    installer.script.as_os_str().to_owned(),
                    UNIX_INSTALLER_URL.into(),
                ],
            )
        } else {
            return Err("neither curl nor wget was found in PATH".to_owned());
        };

    let status = Command::new(&downloader)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .map_err(|error| format!("failed to start {}: {error}", downloader.display()))?;
    if !status.success() {
        return Err(format!("installer download exited with status {status}"));
    }
    if !installer.script.is_file() {
        return Err("installer download did not create install.sh".to_owned());
    }
    Ok(installer)
}

#[cfg(not(target_os = "windows"))]
fn create_update_temp_dir() -> Result<PathBuf, String> {
    let base = std::env::temp_dir();
    for attempt in 0..100_u32 {
        let candidate = base.join(format!("atlascode-rs-update-{}-{attempt}", std::process::id()));
        match std::fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(error) => {
                return Err(format!("failed to create {}: {error}", candidate.display()));
            }
        }
    }
    Err("could not allocate a temporary update directory".to_owned())
}

fn resolve_npm() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    let candidates = ["npm.cmd", "npm"];
    #[cfg(not(target_os = "windows"))]
    let candidates = ["npm"];

    candidates
        .iter()
        .find_map(|candidate| which::which(candidate).ok())
        .ok_or_else(|| format!("none of {} were found in PATH", candidates.join(", ")))
}

#[cfg(target_os = "windows")]
fn resolve_powershell() -> Result<PathBuf, String> {
    ["powershell.exe", "pwsh.exe"]
        .iter()
        .find_map(|candidate| which::which(candidate).ok())
        .ok_or_else(|| "neither powershell.exe nor pwsh.exe was found in PATH".to_owned())
}

fn record_install_failure(app: &mut atlascode_rs::app::App, message: String) {
    atlascode_rs::app::record_update_install_failure(app, message);
}

fn clear_install_failure(app: &mut atlascode_rs::app::App) {
    atlascode_rs::app::clear_update_install_failure(app);
}

fn extract_app_error(err: &anyhow::Error) -> Option<AppError> {
    err.chain().find_map(|cause| cause.downcast_ref::<AppError>().cloned())
}

fn maybe_print_resume_hint(app: &atlascode_rs::app::App) {
    let mut stderr = std::io::stderr().lock();
    if let Err(err) = write_resume_hint_for_app(&mut stderr, app) {
        tracing::warn!(
            target: atlascode_rs::logging::targets::APP_LIFECYCLE,
            event_name = "resume_hint_write_failed",
            message = "failed to write resume hint",
            outcome = "failure",
            error_message = %err,
        );
    }
}

fn write_resume_hint_for_app(
    mut writer: impl std::io::Write,
    app: &atlascode_rs::app::App,
) -> std::io::Result<()> {
    let Some(session_id) = app.session_runtime.resumable_session_id() else {
        return Ok(());
    };
    write_resume_hint(&mut writer, session_id)
}

fn write_resume_hint(
    mut writer: impl std::io::Write,
    session_id: impl std::fmt::Display,
) -> std::io::Result<()> {
    writeln!(writer, "\r\nResume this session: atlascode-rs resume {session_id}")
}

#[cfg(test)]
mod tests {
    use super::{write_resume_hint, write_resume_hint_for_app};
    use atlascode_rs::agent::model::SessionId;
    use atlascode_rs::app::App;

    #[test]
    fn resume_hint_starts_on_fresh_line_and_ends_with_newline() {
        let mut output = Vec::new();

        assert!(write_resume_hint(&mut output, "abc-123").is_ok());

        assert_eq!(output, b"\r\nResume this session: atlascode-rs resume abc-123\n");
    }

    #[test]
    fn app_resume_hint_uses_available_session_id() {
        let mut app = App::test_default();
        app.session_runtime.session_id = Some(SessionId::new("session-123"));
        let mut output = Vec::new();

        assert!(write_resume_hint_for_app(&mut output, &app).is_ok());

        assert_eq!(output, b"\r\nResume this session: atlascode-rs resume session-123\n");
    }

    #[test]
    fn app_resume_hint_is_empty_before_session_establishment() {
        let app = App::test_default();
        let mut output = Vec::new();

        assert!(write_resume_hint_for_app(&mut output, &app).is_ok());

        assert!(output.is_empty());
    }
}
