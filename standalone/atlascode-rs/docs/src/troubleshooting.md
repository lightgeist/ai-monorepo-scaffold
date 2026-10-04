# Troubleshooting

Start with `atlascode-rs doctor`. It runs installation, runtime, config path, log path, npm metadata, and credential checks, and it names the failing boundary for most of the problems below.

```bash
atlascode-rs doctor
atlascode-rs doctor --json
```

When you need the underlying detail, enable diagnostics and read the log. See [Diagnostics](diagnostics.md) for presets, log locations, and debug bundles.

```bash
atlascode-rs logs
atlascode-rs logs --tail 200
```

## The App Will Not Start Or The Bridge Will Not Spawn

The TUI depends on the Agent SDK bridge, which runs as a child process under a private Bun runtime. If the bridge cannot start, the app reports the failing boundary as spawn, initialization, stdout close, SDK or protocol failure, or timeout.

Check what the app actually resolved:

```bash
atlascode-rs doctor --json
```

The `bridge_runtime`, `bridge_runtime_version`, and `bridge_script` checks show which runtime and bridge script the binary picked. A missing or unexpected path there is the usual cause: a source build without the bridge built, a partially extracted install, or a stale `ATLASCODE_RS_AGENT_BRIDGE` override left in the environment.

For a source build, the bridge has to be built before the app can spawn it. See [Development](development.md).

To capture the bridge's own startup output, run with bridge logging enabled and inspect the log:

```bash
atlascode-rs --enable-logs --diagnostics-preset bridge
atlascode-rs logs --latest
```

## Login And Authentication Failures

Authentication is owned by the Claude Code CLI, not by this project. `atlascode-rs` reuses the credentials the CLI already holds.

Sign in from inside the app with `/login`, or from a shell:

```bash
claude auth login
```

If login appears to succeed but sessions still fail, confirm that the CLI itself works, then re-check the credential state:

```bash
atlascode-rs doctor
```

Billing, model availability, and service limits are controlled by Anthropic and surface here as session errors rather than install problems. For the authentication and permission flow in the log, use the `session` preset:

```bash
atlascode-rs --enable-logs --diagnostics-preset session
```

## The Wrong `atlascode-rs` Runs

The script install and the npm install use different layouts, and neither owns the other's files. If both are present, `PATH` order decides which one runs, so an update can appear to do nothing.

Multiple script installations can also coexist after installing into a [custom directory](installation.md#custom-install-locations). The installer shows the current and other locations, then offers `y Yes / N No` cleanup for recognized copies after the new installation passes verification. Check the named directory before confirming; a temporary test installation may be offering to remove your normal copy. Unknown copies receive manual guidance instead.

List every `atlascode-rs` that is visible on macOS/Linux:

```bash
command -v atlascode-rs
which -a atlascode-rs
```

On Windows:

```powershell
Get-Command atlascode-rs -All
```

Compare the resolved path with the install layout reported by:

```bash
atlascode-rs --version
atlascode-rs doctor
```

If the wrong one wins, remove the install you do not want, or reorder `PATH` so the one you want comes first. See [Switching Install Methods](installation.md#switching-install-methods) and [Uninstall](installation.md#uninstall).

## Troubleshooting npm Installs

If npm omitted optional dependencies, the launcher cannot find the native platform package. Check your npm config and reinstall:

```bash
npm config get omit
# No public npm package is published. Re-extract the verified portable archive.
```

If the resolver reports a missing platform package, npm optional dependencies were likely omitted. Check `npm config get omit` and reinstall without `--omit=optional`.

Linux npm packages currently require glibc. On musl-based distributions, [build from source](development.md) until a matching npm package is available.

If `atlascode-rs` resolves to an older global shim, ensure your npm global bin directory comes first on `PATH` or remove the stale shim before retrying.

## Reporting A Problem

For install failures, see [Reporting Install Problems](installation.md#reporting-install-problems). For anything else, see [Useful Issue Reports](diagnostics.md#useful-issue-reports) and attach a redacted bundle:

```bash
atlascode-rs logs --bundle --yes
```
