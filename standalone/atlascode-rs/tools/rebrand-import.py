#!/usr/bin/env python3
"""Deterministic, pinned atlascode-rs rebrand. Run only against the recorded upstream."""
from pathlib import Path
import hashlib, json, re, shutil, subprocess, sys

PIN = 'ddcf1eb5513b02ca2a68964220f115da0a69a80a'
VERSION = '0.1.0'
REPO = 'lightgeist/ai-monorepo-scaffold'
BRANCH = 'atlascode-rs/rebrand-20261004'
SUBDIR = 'standalone/atlascode-rs'
TAG = 'atlascode-rs-v' + VERSION
ROOT = Path(sys.argv[1]).resolve()
head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
if head != PIN or subprocess.check_output(['git','-C',str(ROOT),'status','--porcelain'],text=True):
    raise SystemExit('Refusing: require pristine pinned upstream ' + PIN)
paths = subprocess.check_output(['git','-C',str(ROOT),'ls-files','-z']).decode().split('\0')[:-1]
original = {p: (ROOT / p).read_bytes() for p in paths}
changes = []

def put(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8', newline='\n')

def edit(path, before, after, count=1):
    p = ROOT/path
    s = p.read_text()
    n = s.count(before)
    if n != count:
        raise RuntimeError(f'{path}: expected {count} matches, found {n}: {before!r}')
    put(path, s.replace(before,after))

# Preserve original legal/historical material without relabeling its authorship.
put('docs/upstream/INDEX.md', '# Historical upstream documents\n\nThese are unmodified documents from srothgan/claude-code-rust at `' + PIN + '`.\nThey describe the upstream project, not the atlascode-rs release or its publisher.\nDo not follow their installation links to install atlascode-rs.\n')
for f in ['README.md','CHANGELOG.md','CODE_OF_CONDUCT.md','AGENTS.md']:
    if f in original:
        (ROOT/'docs/upstream'/f).write_bytes(original[f])

replacements = [
 ('https://raw.githubusercontent.com/srothgan/claude-code-rust/main/', f'https://raw.githubusercontent.com/{REPO}/{TAG}/{SUBDIR}/'),
 ('https://github.com/srothgan/claude-code-rust/blob/main/', f'https://github.com/{REPO}/blob/{BRANCH}/{SUBDIR}/'),
 ('https://github.com/srothgan/claude-code-rust/edit/main/', f'https://github.com/{REPO}/edit/{BRANCH}/{SUBDIR}/'),
 ('https://api.github.com/repos/srothgan/claude-code-rust/releases/latest', f'https://api.github.com/repos/{REPO}/releases/tags/{TAG}'),
 ('https://github.com/srothgan/claude-code-rust/releases/download/',f'https://github.com/{REPO}/releases/download/atlascode-rs-'),
 ('https://github.com/srothgan/claude-code-rust',f'https://github.com/{REPO}'),
 ('@srothgan', '@atlascode-rs'),
 ('srothgan-atlascode-rs-', 'atlascode-rs-atlascode-rs-'),
 ('srothgan-claude-code-rust-', 'atlascode-rs-atlascode-rs-'),
 ('CLAUDE_RUST_NO_UPDATE_CHECK','ATLASCODE_RS_NO_UPDATE_CHECK'),
 ('CLAUDE_RS_', 'ATLASCODE_RS_'),
 ('claude_code_rust', 'atlascode_rs'),
 ('claude-code-rust','atlascode-rs'),
 ('claude_rust','atlascode_rs'),
 ('claude_rs','atlascode_rs'),
 ('ClaudeRs','AtlasCodeRs'),
 ('claude-rs','atlascode-rs'),
 ('CLAUDE-RS','ATLASCODE-RS'),
 ('Claude Code Rust','atlascode-rs'),
 ('Claude Rust','atlascode-rs'),
 ('Claude, in Rust','atlascode-rs'),
 ('RUST_ORANGE','ACCENT'),
 ('FERRIS','BRAND_MARK'),
 ('ferris','brand_mark'),
]
for rel in paths:
    if rel == 'LICENSE' or rel.startswith('assets/') or rel.startswith('recordings/') or rel.startswith('.github/workflows/'):
        continue
    try: s = original[rel].decode('utf-8')
    except UnicodeError: continue
    for a,b in replacements: s = s.replace(a,b)
    s = re.sub(r'https://srothgan\.github\.io/atlascode-rs/([a-z-]+)\.html',
               lambda m: f'https://github.com/{REPO}/blob/{BRANCH}/{SUBDIR}/docs/src/{m[1]}.md',s)
    s = s.replace('https://srothgan.github.io/atlascode-rs/', f'https://github.com/{REPO}/tree/{BRANCH}/{SUBDIR}/docs/src/')
    if s.encode() != original[rel]:
        put(rel,s)

shutil.rmtree(ROOT/'assets')
shutil.rmtree(ROOT/'recordings')
shutil.rmtree(ROOT/'.github/workflows')
(ROOT/'.github/FUNDING.yml').unlink()
put('.github/CODEOWNERS', '* @lightgeist\n')
put('.github/ISSUE_TEMPLATE/config.yml','blank_issues_enabled: true\n')
(ROOT/'CHANGELOG.md').unlink()
(ROOT/'bin/claude-rs.js').rename(ROOT/'bin/atlascode-rs.js')

edit('Cargo.toml','version = "0.14.9"','version = "0.1.0"')
edit('Cargo.toml','license = "Apache-2.0"','license = "Apache-2.0"\npublish = false')
edit('Cargo.toml','description = "A native Rust terminal interface for Claude Code"',
     'description = "atlascode-rs: a native coding terminal powered by the Claude Agent SDK"')
edit('Cargo.lock','name = "atlascode-rs"\nversion = "0.14.9"','name = "atlascode-rs"\nversion = "0.1.0"')
for rel in ['package.json','agent-sdk/package.json']:
    p=ROOT/rel; obj=json.loads(p.read_text()); obj['version']=VERSION; obj['private']=True
    if rel=='package.json':
        obj['description']='atlascode-rs: a native coding terminal powered by the Claude Agent SDK'
        obj['repository']['directory']=SUBDIR
        obj['homepage']=f'https://github.com/{REPO}/tree/{BRANCH}/{SUBDIR}#readme'
        obj['files'] += ['NOTICE','PROVENANCE.json']
    else:
        obj['name']='@atlascode-rs/agent-bridge'
    put(rel,json.dumps(obj,indent=2)+'\n')
    lockrel=rel.replace('package.json','package-lock.json')
    lock=json.loads((ROOT/lockrel).read_text())
    lock['name']=obj['name']; lock['version']=VERSION
    lock['packages']['']['name']=obj['name']; lock['packages']['']['version']=VERSION
    put(lockrel,json.dumps(lock,indent=2)+'\n')

put('src/brand.rs','''// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 atlascode-rs contributors

//! Product identity and conservative release policy. Provider identifiers stay unchanged.

pub const NAME: &str = "atlascode-rs";
/// There is no automatic or in-app update channel in the first fork release.
pub const UPDATES_ENABLED: bool = false;
''')
edit('src/lib.rs','pub mod agent;','pub mod agent;\npub mod brand;')
edit('src/lib.rs','about = "Native Rust terminal for Claude Code"','about = "atlascode-rs: native coding terminal powered by the Claude Agent SDK"')
edit('src/app/update_check.rs','if no_update_check_flag {','if !crate::brand::UPDATES_ENABLED || no_update_check_flag {')
edit('src/app/update_check.rs','reason = "disabled_by_flag_or_env"','reason = "release_policy_flag_or_env"')
edit('src/main.rs','    let method_label = method.label();','''    if !atlascode_rs::brand::UPDATES_ENABLED {
        eprintln!("In-app updates are disabled in atlascode-rs. Install a verified fork release explicitly.");
        return 1;
    }
    let method_label = method.label();''')
edit('src/app/settings.rs','format!("{GITHUB_RELEASE_BASE_URL}/v{version}")','format!("{GITHUB_RELEASE_BASE_URL}/atlascode-rs-v{version}")')
p=ROOT/'src/app/settings.rs'; put('src/app/settings.rs',p.read_text().replace(f'https://github.com/{REPO}/releases/tag/v',f'https://github.com/{REPO}/releases/tag/atlascode-rs-v'))

edit('src/ui/welcome.rs',
 'const BRAND_MARK_ART: &[&str] =\n    &[r"    _~^~^~_     ", r"\\) /  o o  \\ (/ ", r"  \'_   -   _\'   ", r"  / \'-----\' \\   "];',
 'const BRAND_MARK_ART: &[&str] =\n    &[r"       /\\       ", r"      /  \\      ", r"     / /\\ \\     ", r"    /_/  \\_\\    "];')
edit('src/ui/welcome.rs','rows.extend(welcome_field_lines("Version", &block.version, dim, width));',
 'rows.extend(welcome_field_lines("Version", &format!("{} {}", crate::brand::NAME, block.version), dim, width));')
edit('src/ui/welcome.rs','line.contains("_~^~^~_")','line.contains(r"/_/  \\_\\")', count=2)
edit('src/ui/welcome.rs','assert!(!lines.iter().any(|line| line.contains("Welcome back to atlascode-rs!")));',
 'assert!(lines.iter().any(|line| line.contains(crate::brand::NAME)));')
edit('src/ui/theme.rs','Color::Rgb(244, 118, 0)','Color::Rgb(98, 181, 229)')

for rel in ['scripts/install/install.sh','scripts/install/install.ps1']:
    s=(ROOT/rel).read_text().replace('repo_owner="srothgan"','repo_owner="lightgeist"').replace('repo_name="atlascode-rs"','repo_name="ai-monorepo-scaffold"')
    s=s.replace('$RepoOwner = "srothgan"','$RepoOwner = "lightgeist"').replace('$RepoName = "atlascode-rs"','$RepoName = "ai-monorepo-scaffold"')
    s=s.replace('$repo_slug/main/scripts/',f'$repo_slug/{TAG}/{SUBDIR}/scripts/').replace('$RepoSlug/main/scripts/',f'$RepoSlug/{TAG}/{SUBDIR}/scripts/')
    s=s.replace('releases/latest',f'releases/tags/{TAG}').replace('releases/download/$tag','releases/download/atlascode-rs-$tag')
    if rel.endswith('.sh'):
        s=s.replace("printf '%s\\n' \"$tag\"", "printf '%s\\n' \"${tag#atlascode-rs-}\"")
    else:
        s=s.replace('return [string]$releaseInfo.tag_name','return ([string]$releaseInfo.tag_name) -replace "^atlascode-rs-", ""')
    put(rel,s)
for p in (ROOT/'scripts/install').iterdir():
    if 'test' in p.name and p.is_file():
        s=p.read_text().replace('*/releases/latest)',f'*/releases/tags/{TAG})')
        s=s.replace('*/releases/latest',f'*/releases/tags/{TAG}')
        put(p.relative_to(ROOT),s)
put('scripts/install/release-advisories.json','{\n  "advisories": []\n}\n')
edit('scripts/install/release-advisories.test.mjs', 'assert.ok(advisories.length > 0, "expected at least one release advisory");', 'assert.deepEqual(advisories, [], "the initial fork has no inherited version advisories");')

for rel in ['scripts/npm/generate-npm-packages.mjs','scripts/install/generate-install-archives.mjs']:
    s=(ROOT/rel).read_text()
    s=re.sub(r'(\s*)copyFileFromRepo\("LICENSE", path.join\((packageDir|appRoot), "LICENSE"\)\);',
             r'\1copyFileFromRepo("LICENSE", path.join(\2, "LICENSE"));\1copyFileFromRepo("NOTICE", path.join(\2, "NOTICE"));\1copyFileFromRepo("PROVENANCE.json", path.join(\2, "PROVENANCE.json"));',s)
    put(rel,s)
for rel in ['scripts/shared/npm-package-config.mjs','scripts/npm/verify-npm-packages.mjs']:
    s=(ROOT/rel).read_text()
    s=s.replace('"LICENSE",','"LICENSE", "NOTICE", "PROVENANCE.json",').replace('"README.md", "LICENSE"]','"README.md", "LICENSE", "NOTICE", "PROVENANCE.json"]')
    if rel.endswith('npm-package-config.mjs'):
        s=s.replace('    version,\n','    version,\n    private: true,\n')
    put(rel,s)
edit('scripts/install/verify-install-archives.mjs','    "LICENSE",','    "LICENSE",\n    "NOTICE",\n    "PROVENANCE.json",')

put('README.md',f'''# atlascode-rs

**A native coding terminal. Rust UI. Official Claude Agent SDK.**

```text
       /\\          atlascode-rs 0.1.0
      /  \\         Native terminal. Visible tools. Explicit permissions.
     / /\\ \\
    /_/  \\_\\
```

atlascode-rs is an independently branded derivative of
[srothgan/claude-code-rust](https://github.com/srothgan/claude-code-rust),
pinned at `{PIN}` (upstream 0.14.9).
It is not Anthropic's official CLI and is not a new inference engine.

```text
atlascode-rs (Rust / Ratatui / Crossterm)
      | local NDJSON
      v
private Bun runtime -> official Claude Agent SDK -> Anthropic services
      |                                     |
      +---------- tools / permissions -------+
```

## Run a verified release

Use the matching **atlascode-rs-0.1.0-<platform>** archive and verify its SHA256
against `SHA256SUMS` before extraction. Each portable archive carries the Rust
binary, a private Bun runtime, the bridge, and production SDK dependencies.
There is no Node.js, Bun, or Rust installation requirement for the portable archive.

```sh
# macOS / Linux: from the extracted platform directory
./atlascode-rs --version
./atlascode-rs doctor
./atlascode-rs -C /path/to/project
```

```powershell
# Windows: from the extracted platform directory
.\\atlascode-rs.exe --version
.\\atlascode-rs.exe doctor
.\\atlascode-rs.exe -C C:\\path\\to\\project
```

A supported Claude account or provider configuration is still required for real
model work. Keep the official `claude` CLI installed and authenticated for the
CLI-backed operations described in [About](docs/src/about.md). Its login and
billing remain controlled by Anthropic; this fork does not create an entitlement.

[Installation](docs/src/installation.md) · [Usage](docs/src/usage.md) ·
[Commands](docs/src/commands.md) · [Settings](docs/src/settings.md) ·
[Troubleshooting](docs/src/troubleshooting.md) · [Migration](MIGRATION.md)

## Build from source

Prerequisites: Rust 1.89 (see `rust-toolchain.toml`), Node.js 24+ with npm, and Bun 1.4.0 for development launches.

```sh
npm ci --prefix agent-sdk
npm --prefix agent-sdk test
cargo test --locked --all-targets
cargo build --locked --release
./target/release/atlascode-rs --version
```

A debug source-tree launch (`cargo run`) uses Bun from PATH to run `agent-sdk/dist/bridge.js`.
A release-mode source launch also needs the private runtime beside the binary; see
[Development](docs/src/development.md). Packaged releases include this runtime.

## What changed

Product/crate/npm/launcher identities, terminal wordmark and accent, own app data,
diagnostics schemas, environment variables, installer and release artifact names,
manuals, completion output, package notices, and release automation are rebranded.
The engine, SDK version, wire protocol, tools, permission semantics, and provider
configuration keys are retained. No telemetry endpoint or alternative provider is added.

**In-app update checking and installation are disabled in 0.1.0.** Explicit
installation uses namespaced `atlascode-rs-v*` releases, never another project's
`latest` release. The npm artifacts are private installable tarballs, not a claim
that a public npm package or namespace has been registered.

## License and provenance

Apache-2.0 for this source derivative; the original copyright notices remain.
See [LICENSE](LICENSE), [NOTICE](NOTICE), [PROVENANCE.json](PROVENANCE.json), and
[historical upstream documents](docs/upstream/INDEX.md). The official SDK and
bundled runtimes retain their own licenses and terms. A rebrand is not an audit
of third-party licensing or a warranty of compatibility with future provider changes.

Native build/test evidence and exact artifact hashes accompany the release.
Authenticated model calls, OS signing/notarization, and physical-device UX are
not implied by a passing mock-bridge or packaging test.
''')
put('NOTICE',f'''atlascode-rs 0.1.0
Copyright 2026 atlascode-rs contributors (fork-specific modifications).

Derived from claude-code-rust by Simon Peter Rothgang and upstream contributors.
Copyright 2025 Simon Peter Rothgang. Original source-file copyright notices
remain authoritative; they have not been removed or reassigned.
Upstream: https://github.com/srothgan/claude-code-rust
Upstream commit: {PIN}
Upstream version: 0.14.9
Source license: Apache License, Version 2.0 (see LICENSE).

Modified in 2026: product/crate/CLI/package identities; own data and diagnostic
namespaces; terminal mark/accent; distribution, installer and update policy;
manuals, notices and rebrand verification. Provider identifiers and the official
Claude Agent SDK are intentionally preserved. See PROVENANCE.json and the
source rebrand ledger for the exact file-level changes.

Claude and Anthropic identify third-party services. atlascode-rs is independent
and does not claim their sponsorship, approval, or ownership of their SDK.
Bun and bundled SDK components retain their own licenses and notices.
''')
put('CHANGELOG.md',f'''# Changelog

## 0.1.0 — 2026-10-04

Initial atlascode-rs derivative of upstream 0.14.9 at `{PIN}`.

Rebrands application, native and npm distribution identities, own settings/logs,
CLI/man/completions, installer environment and runtime diagnostics. Replaces
the original mascot with an angular terminal mark and a blue accent. Preserves
SDK 0.3.288, Bun 1.4.0 and provider compatibility. Disables in-app updates; uses
version-qualified fork release endpoints and private npm artifacts. Adds
provenance, modification ledger, archive attribution, and release verification.

The upstream changelog is preserved unchanged in `docs/upstream/CHANGELOG.md`.
''')
put('MIGRATION.md','''# Migration to atlascode-rs 0.1.0

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
| Windows default install directory | `%LOCALAPPDATA%\\Programs\\atlascode-rs` |

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
''')
put('AGENTS.md','''# atlascode-rs development

This is a narrow, attributed derivative. Read README.md, NOTICE and MIGRATION.md.
Keep the native Rust UI and official SDK bridge behavior intact. Do not rename
provider-owned `CLAUDE_*`, `.claude`, model identifiers or wire fields.

Before release run Rust formatting, strict Clippy, all targets/tests, the bridge
build/test suite, packaging and installer tests, the brand audit, and the native
archive smoke suite. Preserve the exact upstream pin and locked dependencies.
Never treat mock bridge coverage as evidence of authenticated provider behavior.

Do not publish npm packages (private by default), re-enable automatic updates,
change provider routing or bypass permissions as part of a branding patch.
Keep LICENSE and NOTICE in every source and binary distribution. Record modified
files in the rebrand ledger. Do not overwrite another application's commands,
settings, registry identities, release channel, or CI credentials.
''')
put('CODE_OF_CONDUCT.md','''# Community conduct

Treat contributors respectfully. Discuss code and behavior rather than personal
attributes. Do not post secrets, private logs, harassment, or others' personal data.

Use the atlascode-rs issue thread in the hosting repository for non-sensitive
project questions. A dedicated confidential reporting channel has not yet been
established for this fork; do not send fork reports to the upstream maintainer's
personal address. The historical upstream policy is retained for attribution in
`docs/upstream/CODE_OF_CONDUCT.md`, not as this fork's reporting procedure.
''')
put('docs/src/governance.md','''# Governance

atlascode-rs is an independent derivative maintained in a dedicated source
subdirectory and release branch. Original authorship is credited in NOTICE.
The upstream maintainer is not responsible for this fork's releases or support.

No npm namespace, hosted documentation domain, dedicated private reporting inbox,
or affiliation with Anthropic is claimed. See the root CODE_OF_CONDUCT.md for
conduct/reporting boundaries and the release verification report for qualification.
''')
put('docs/src/installation.md',f'''# Installation

Version: atlascode-rs 0.1.0. Release tag: `{TAG}`.

## Portable archives (recommended)

Choose exactly one matching OS/architecture archive, verify SHA256SUMS, and
extract it into a new directory. Run `./atlascode-rs --version` on macOS/Linux
or `.\\atlascode-rs.exe --version` on Windows. Run `doctor` next.

Platforms: macOS arm64/x64; Linux glibc arm64/x64; Windows arm64/x64.
Linux musl is not supported. Each archive contains the native UI, private Bun
runtime, compiled bridge and SDK production dependencies. Keep that directory
together: copying the UI binary alone does not copy its bridge or runtime.

The portable archive does not need Node.js, Bun or Rust installed. The official
`claude` CLI remains necessary for the CLI-backed operations in [About](about.md).
Authentication, usage charges and service access remain provider responsibilities.

## Optional install scripts

Inspect the version-pinned script before running it. The script verifies downloaded
archive hashes, uses this fork's own paths and command name, and requires confirmation
before replacement or cleanup. The initial release does not modify upstream installs.

```sh
sh scripts/install/install.sh --release 0.1.0 --verify
```

```powershell
& .\\scripts\\install\\install.ps1 -Release 0.1.0 -Verify
```

These scripts fetch assets only from namespaced `atlascode-rs-v*` release tags in
`{REPO}`. The `latest` selector resolves the pinned 0.1.0 tag for this release,
not the repository-wide latest release. In-app update checking/installation is disabled.
For offline use, prefer the already verified portable archive rather than the script.

Use `--help` / `-Help` for custom installation directories and uninstall options.
Default Unix data path: `${{XDG_DATA_HOME:-$HOME/.local/share}}/atlascode-rs`;
default executable path: `$HOME/.local/bin/atlascode-rs`. Windows uses its own
`%LOCALAPPDATA%\\Programs\\atlascode-rs` directory.

## npm and source builds

The npm tarballs are private distribution artifacts for packaging/integration tests.
Do not run `npm install -g atlascode-rs` expecting a verified public registry package.
See the root README for a source build. Development needs Node.js 24+ and Rust 1.89;
release bundles use the private Bun 1.4.0 runtime.

## Upgrade and rollback

Keep the previous verified portable directory until the new one passes `doctor`
and a harmless test in a disposable project. Switching directories rolls back the
application binary/runtime; it does not roll back shared provider data. No migration
of upstream app settings is implicit. See [Migration](../../MIGRATION.md).

## Integrity and platform limits

Checksums detect changed bytes; they are not OS code signing. macOS packages are
not notarized and Windows binaries are not Authenticode-signed. Review the publisher
and hashes before granting OS execution permission. Do not disable OS security
protections globally. Native CI is not a physical-device UX certification.
''')
put('docs/theme/head.hbs','<meta name="application-name" content="atlascode-rs">\n<meta property="og:title" content="atlascode-rs">\n<meta property="og:description" content="Native coding terminal powered by the official Claude Agent SDK.">\n')
edit('docs/book.toml', 'default-theme = "rust"', 'default-theme = "light"')
edit('docs/book.toml','authors = ["Simon Peter Rothgang"]','authors = ["atlascode-rs contributors", "Simon Peter Rothgang (upstream)"]')
for p in (ROOT/'docs/src').glob('*.md'):
    s=p.read_text()
    s=re.sub(r'^.*(?:assets/(?:demo|banner|social-preview)|recordings/demo|simonrothgang@icloud\.com).*$','',s,flags=re.M)
    put(p.relative_to(ROOT),s)

put('.github/workflows/ci.yml','''name: atlascode-rs source verification
on: [push, pull_request]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '24'
      - run: npm ci --prefix agent-sdk
      - run: npm --prefix agent-sdk test
      - run: cargo fmt --all -- --check
      - run: cargo clippy --locked --all-targets --all-features -- -D warnings
      - run: cargo test --locked --all-targets
      - run: python3 tools/verify-brand.py
''')
put('PROVENANCE.json',json.dumps({
 'schema':'atlascode-rs-provenance/v1','name':'atlascode-rs','version':VERSION,
 'upstream':{'repository':'https://github.com/srothgan/claude-code-rust','commit':PIN,'version':'0.14.9','license':'Apache-2.0','license_sha256':hashlib.sha256(original['LICENSE']).hexdigest()},
 'distribution':{'repository':'https://github.com/'+REPO,'directory':SUBDIR,'release_tag':TAG,'npm_registry_published':False,'signed_or_notarized':False},
 'engine':{'sdk':'@anthropic-ai/claude-agent-sdk','sdk_version':'0.3.288','bun_version':'1.4.0','provider_changed':False},
 'policy':{'in_app_updates':False,'upstream_state_migrated':False,'provider_state_shared':True},
 'date':'2026-10-04'
},indent=2)+'\n')

edit('docs/src/development.md','git clone https://github.com/lightgeist/ai-monorepo-scaffold.git\ncd atlascode-rs',
     'git clone --branch atlascode-rs/rebrand-20261004 https://github.com/lightgeist/ai-monorepo-scaffold.git\ncd ai-monorepo-scaffold/standalone/atlascode-rs')
edit('docs/src/development.md','Rust 1.88.0 or newer','the pinned Rust 1.89 toolchain')
p=ROOT/'docs/src/about.md';s=p.read_text()
s=s.replace('This list was audited against Agent SDK `0.3.286` on October 2, 2026, by checking', 'The upstream authors audited this list against Agent SDK `0.3.286` on October 2, 2026, by checking')
s=s.replace('The comparison was checked against', 'The upstream comparison was checked against')
s=s[:s.index('## Billing Note')]+'''## Billing Note

Provider authentication, billing and eligibility are controlled by Anthropic.
This release includes SDK 0.3.288; it does not promise subscription inclusion,
a billing rate, or a permanent entitlement to third-party application use.
Check the provider's current terms for the account you use before making calls.
Live account authentication and billable calls were not part of the offline rebrand tests.
'''
put('docs/src/about.md',s)
p=ROOT/'docs/src/troubleshooting.md';put('docs/src/troubleshooting.md',p.read_text().replace('npm install -g atlascode-rs', '# No public npm package is published. Re-extract the verified portable archive.'))
put('CONTRIBUTING.md','''# Contributing

Use a feature branch; preserve the upstream attribution and narrow rebrand scope.
See AGENTS.md and docs/src/development.md for build setup. Run:

```sh
npm ci --prefix agent-sdk
npm --prefix agent-sdk test
cargo fmt --all -- --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets
python3 tools/verify-brand.py
```

The fork release pipeline also builds native binaries, verifies package layouts,
runs installers in isolated temporary homes and executes archive runtime contracts.
Keep actual evidence distinct from intended tests. Never put private credentials,
provider session files or unredacted user logs in a pull request or release archive.

Do not publish the private npm artifacts or enable in-app updates without a
separate reviewed release-channel and namespace-ownership decision.
''')

for rel, before in original.items():
    p=ROOT/rel
    if p.is_file() and p.read_bytes()!=before:
        try:s=p.read_text()
        except UnicodeError:continue
        if rel.endswith(('.rs','.ts','.js','.mjs','.cjs')):
            if s.startswith('#!'):
                first,rest=s.split('\n',1); s=first+'\n// Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.\n'+rest
            else:s='// Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.\n'+s
            put(rel,s)
        elif rel.endswith(('.sh','.ps1')):
            lines=s.splitlines(keepends=True); pos=1 if s.startswith('#!') else 0
            lines.insert(pos,'# Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.\n'); put(rel,''.join(lines))
p=ROOT/'bin/atlascode-rs.js';s=p.read_text(); a,b=s.split('\n',1);put('bin/atlascode-rs.js',a+'\n// Modified for atlascode-rs, 2026; see NOTICE and PROVENANCE.json.\n'+b)
for rel in ['bin/atlascode-rs.js','scripts/install/install.sh']:(ROOT/rel).chmod(0o755)
for rel,before in original.items():
    p=ROOT/rel
    if not p.exists():changes.append({'path':rel,'change':'removed_or_replaced','upstream_sha256':hashlib.sha256(before).hexdigest()})
    elif p.read_bytes()!=before:changes.append({'path':rel,'change':'modified','upstream_sha256':hashlib.sha256(before).hexdigest()})
put('REBRAND-LEDGER.json',json.dumps({'schema':'atlascode-rs-rebrand-ledger/v1','upstream_commit':PIN,'changes':changes},indent=2)+'\n')
print(f'Applied atlascode-rs {VERSION}: {len(changes)} modified/removed upstream paths; added fork files separately.')
