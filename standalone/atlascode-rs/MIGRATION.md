# Migration to atlascode-rs 0.1.0

The new command is `atlascode-rs` (`atlascode-rs.exe` on Windows). The original
`claude-rs` and official `claude` commands are not replaced, aliased or removed.
Install beside them. Uninstalling this fork must target only its own paths.

| Surface | atlascode-rs |
| --- | --- |
| Cargo package / library | `atlascode-rs` / `atlascode_rs` |
| Executable / npm wrapper | `atlascode-rs` |
| Private bridge runtime | `atlascode-rs-bridge-bun` |
| Own settings/logs directory component | `atlascode-rs` |
| Own environment variable prefix | `ATLASCODE_RS_` |
| Update-check override | `ATLASCODE_RS_NO_UPDATE_CHECK` (updates already disabled) |
| Unix default install directory | `${XDG_DATA_HOME:-$HOME/.local/share}/atlascode-rs` |
| Windows default install directory | `%LOCALAPPDATA%\Programs\atlascode-rs` |

No automatic copy or deletion of the original application's settings, logs or
update cache occurs. Legacy `CLAUDE_RS_*` variables intentionally do not control
this fork. Update scripts, shell profiles and test harnesses to the new prefix.

Provider-owned `.claude`, `CLAUDE.md`, `CLAUDE_CONFIG_DIR`,
`CLAUDE_CODE_PROJECT_DIR_NAME`, `CLAUDE_CODE_EXECUTABLE`, model names, credentials,
session formats, SDK package names, and provider configuration remain unchanged.
This means provider configuration and sessions may be shared with the official
CLI. This fork isolates its own app state, **not all provider state**. Use a separate
`CLAUDE_CONFIG_DIR` and project if provider isolation is required.

Do not blindly copy old update-result caches or secret-bearing debug logs.
Inspect `atlascode-rs doctor` and `atlascode-rs config --help` before use. Normal
trust and tool permission checks remain enabled; the rebrand does not authorize
additional filesystem, network, or command access.
