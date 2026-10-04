# atlascode-rs 0.1.0 — portable application

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
.\atlascode-rs.exe --version
.\atlascode-rs.exe doctor
.\atlascode-rs.exe -C C:\path\to\project
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
