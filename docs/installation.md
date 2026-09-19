# Install AtlasCode v0.1.0

The release is supplied as a ZIP containing source, the npm distribution tarball, and evidence. No public npm publication or automatic hosted installer is implied.

## npm package

Install supported Node.js first: 22.19+ (22.x), or 24.2+ through 26.x. Unzip the release and run:

```bash
npm install -g ./distribution/deepintuition-atlascode-0.1.0.tgz
atlascode --help
atlascode --version
atlascode
```

Do not omit optional dependencies: they supply platform-specific clipboard and repository-search helpers. SQLite is a required native dependency. If no compatible prebuild is available, install your platform's C++ toolchain and Python, then retry. The CLI itself does not install a replacement Node runtime behind your back.

## Provider setup

`atlascode provider --help` and `atlascode provider add --help` list the retained configuration interface. Supply a real provider API key using `ATLASCODE_PROVIDER_API_KEY`, an endpoint, an API format, and the exact provider model identifier. `--use` tests and selects the new provider. Save-only additions do not automatically switch your model.

A managed account is not required for ordinary bring-your-own-key coding. Existing managed-provider integrations remain integrations with their actual provider; they are not Deep Intuition-operated services.

## Source build

From the supplied `source` directory:

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm build
node dist/cli.js
node scripts/package-atlascode.mjs
```

A source build may use `node /absolute/path/to/source/dist/cli.js` from any project. The packaging command writes an installable `.tgz` to `artifacts/`.

## Profile and removal

Fresh installs use `~/.atlascode`. `ATLASCODE_DATA_DIR` selects an explicit profile. Never point qualification tests at your everyday profile. See migration notes before importing legacy data.

Update from a later verified AtlasCode tarball using the same npm install command. `npm uninstall -g @deepintuition/atlascode` removes the CLI, not your sessions or credentials. Deleting `~/.atlascode` removes that separate data only when you deliberately choose to do so.

## Platform claims

The package preserves the upstream operating-system boundaries. A successful build is not proof of every native clipboard, sandbox, or credential-store integration. Consult the attached per-platform CI and terminal evidence for what was exercised and what was skipped.
