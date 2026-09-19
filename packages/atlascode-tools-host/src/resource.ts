import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  validateEmbeddedResourceFiles,
  validateEmbeddedResourceManifest,
} from './resource-manifest.mjs';

import {
  AUTH_LEASE_PROTOCOL_PACKAGE_NAME,
  AUTH_LEASE_PROTOCOL_PACKAGE_VERSION,
  AUTH_LEASE_PROTOCOL_VERSION,
} from '@atlascode/oauth-lease-protocol';

export type AtlasCodeToolsBuildEnv = 'test' | 'staging' | 'prod';
export type AtlasCodeToolsRegion = 'cn' | 'en';

export interface AtlasCodeToolsManifest {
  schemaVersion: 3 | 4;
  packageName: string;
  version: string;
  gitSha: string;
  buildEnv: AtlasCodeToolsBuildEnv;
  bedrockLane: string;
  nodeRange: string;
  entry: 'cli.mjs';
  auth: {
    mode: 'shared-broker';
    protocol: {
      name: typeof AUTH_LEASE_PROTOCOL_PACKAGE_NAME;
      version: typeof AUTH_LEASE_PROTOCOL_PACKAGE_VERSION;
      wireVersion: typeof AUTH_LEASE_PROTOCOL_VERSION;
    };
  };
  nativePackages: { name: 'registry-js'; version: string; napiVersion: 3 }[];
  resources: [{ path: 'cli.mjs'; sha256: string }, ...{ path: string; sha256: string }[]];
}

export interface ValidatedAtlasCodeToolsResource {
  rootDir: string;
  cliPath: string;
  manifest: AtlasCodeToolsManifest;
}

export function validateAtlasCodeToolsResource(options: {
  resourceDir: string;
  expectedBuildEnv: AtlasCodeToolsBuildEnv;
}): ValidatedAtlasCodeToolsResource {
  const manifestPath = path.join(options.resourceDir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error('atlascode-tools manifest is missing');

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('atlascode-tools manifest is not valid JSON');
  }
  const manifest = parseManifest(value);
  if (manifest.buildEnv !== options.expectedBuildEnv) {
    throw new Error(
      `atlascode-tools build environment mismatch: expected ${options.expectedBuildEnv}, received ${manifest.buildEnv}`,
    );
  }
  const expectedPackageName = packageNameForBuildEnv(options.expectedBuildEnv);
  if (manifest.packageName !== expectedPackageName) {
    throw new Error(
      `atlascode-tools package mismatch: expected ${expectedPackageName}, received ${manifest.packageName}`,
    );
  }

  const cliPath = path.join(options.resourceDir, manifest.entry);
  if (!existsSync(cliPath)) throw new Error('atlascode-tools embedded cli is missing');
  validateEmbeddedResourceFiles(options.resourceDir, manifest);

  return { rootDir: options.resourceDir, cliPath, manifest };
}

export async function installAtlasCodeToolsLauncher(options: {
  resourceDir: string;
  expectedBuildEnv: AtlasCodeToolsBuildEnv;
  dataDir: string;
  executable: string;
  platform: NodeJS.Platform;
  region: AtlasCodeToolsRegion;
  bedrockLane?: string;
  brokerEndpoint: string;
  brokerCapabilityFile: string;
}): Promise<{
  launcherPath: string;
  regionalLauncherPath: string;
  resource: ValidatedAtlasCodeToolsResource;
}> {
  const resource = validateAtlasCodeToolsResource(options);
  const binDir = path.join(options.dataDir, 'bin');
  const configDir = path.join(options.dataDir, 'integrations', 'atlascode-tools', options.region);
  mkdirSync(binDir, { recursive: true, mode: 0o700 });
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  chmodSync(binDir, 0o700);
  chmodSync(configDir, 0o700);

  const isWindows = options.platform === 'win32';
  const launcherPath = path.join(binDir, isWindows ? 'atlascode-tools.cmd' : 'atlascode-tools');
  const regionLabel = options.region === 'cn' ? 'cn' : 'global';
  const regionalLauncherPath = path.join(
    binDir,
    isWindows ? `atlascode-tools-${regionLabel}.cmd` : `atlascode-tools-${regionLabel}`,
  );
  const staleLauncherPaths = isWindows
    ? ['atlascode-tools', 'atlascode-tools-cn', 'atlascode-tools-global']
    : ['atlascode-tools.cmd', 'atlascode-tools-cn.cmd', 'atlascode-tools-global.cmd'];
  const bedrockLane = resolveManagedBedrockLane(options.bedrockLane);
  const contents = isWindows
    ? renderWindowsLauncher({
        executable: options.executable,
        cliPath: resource.cliPath,
        configDir,
        region: options.region,
        ...(bedrockLane ? { bedrockLane } : {}),
        brokerEndpoint: options.brokerEndpoint,
        brokerCapabilityFile: options.brokerCapabilityFile,
      })
    : renderPosixLauncher({
        executable: options.executable,
        cliPath: resource.cliPath,
        configDir,
        region: options.region,
        ...(bedrockLane ? { bedrockLane } : {}),
        brokerEndpoint: options.brokerEndpoint,
        brokerCapabilityFile: options.brokerCapabilityFile,
      });
  const dispatcher = isWindows ? renderWindowsDispatcher() : renderPosixDispatcher();

  writeFileIfChanged(regionalLauncherPath, contents, isWindows ? 0o600 : 0o755);
  writeFileIfChanged(launcherPath, dispatcher, isWindows ? 0o600 : 0o755);
  for (const staleName of staleLauncherPaths) {
    rmSync(path.join(binDir, staleName), { force: true });
  }
  return { launcherPath, regionalLauncherPath, resource };
}

export function removeAtlasCodeToolsLaunchers(dataDir: string, region?: AtlasCodeToolsRegion): void {
  const binDir = path.join(dataDir, 'bin');
  const regionLabels = region ? [region === 'cn' ? 'cn' : 'global'] : ['cn', 'global'];
  for (const name of regionLabels.flatMap((label) => [
    `atlascode-tools-${label}`,
    `atlascode-tools-${label}.cmd`,
  ])) {
    rmSync(path.join(binDir, name), { force: true });
  }
  const hasRegionalLauncher = ['cn', 'global'].some(
    (label) =>
      existsSync(path.join(binDir, `atlascode-tools-${label}`)) ||
      existsSync(path.join(binDir, `atlascode-tools-${label}.cmd`)),
  );
  if (!hasRegionalLauncher) {
    rmSync(path.join(binDir, 'atlascode-tools'), { force: true });
    rmSync(path.join(binDir, 'atlascode-tools.cmd'), { force: true });
  }
}

function renderPosixDispatcher(): string {
  return [
    '#!/bin/sh',
    'atlascode_tools_bin_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    ['atlascode_tools_region=$', '{ATLASCODE_REGION:-$', '{ATLASCODE_RUNTIME_REGION:-}}'].join(''),
    'case "$atlascode_tools_region" in',
    '  cn) atlascode_tools_target="$atlascode_tools_bin_dir/atlascode-tools-cn" ;;',
    '  en|global) atlascode_tools_target="$atlascode_tools_bin_dir/atlascode-tools-global" ;;',
    '  "")',
    '    if [ -x "$atlascode_tools_bin_dir/atlascode-tools-cn" ] && [ ! -x "$atlascode_tools_bin_dir/atlascode-tools-global" ]; then',
    '      atlascode_tools_target="$atlascode_tools_bin_dir/atlascode-tools-cn"',
    '    elif [ -x "$atlascode_tools_bin_dir/atlascode-tools-global" ] && [ ! -x "$atlascode_tools_bin_dir/atlascode-tools-cn" ]; then',
    '      atlascode_tools_target="$atlascode_tools_bin_dir/atlascode-tools-global"',
    '    else',
    '      echo "ATLASCODE_REGION must be cn or global when both regional atlascode-tools launchers are installed." >&2',
    '      exit 2',
    '    fi',
    '    ;;',
    '  *) echo "Invalid ATLASCODE_REGION; expected cn or global." >&2; exit 2 ;;',
    'esac',
    'exec "$atlascode_tools_target" "$@"',
    '',
  ].join('\n');
}

function renderWindowsDispatcher(): string {
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    'set "atlascode_tools_region=%ATLASCODE_REGION%"',
    'if not defined atlascode_tools_region set "atlascode_tools_region=%ATLASCODE_RUNTIME_REGION%"',
    'if /i "%atlascode_tools_region%"=="cn" goto atlascode_tools_cn',
    'if /i "%atlascode_tools_region%"=="en" goto atlascode_tools_global',
    'if /i "%atlascode_tools_region%"=="global" goto atlascode_tools_global',
    'if defined atlascode_tools_region goto atlascode_tools_invalid',
    'if exist "%~dp0atlascode-tools-cn.cmd" if not exist "%~dp0atlascode-tools-global.cmd" goto atlascode_tools_cn',
    'if exist "%~dp0atlascode-tools-global.cmd" if not exist "%~dp0atlascode-tools-cn.cmd" goto atlascode_tools_global',
    'echo ATLASCODE_REGION must be cn or global when both regional atlascode-tools launchers are installed. 1>&2',
    'exit /b 2',
    ':atlascode_tools_cn',
    'call "%~dp0atlascode-tools-cn.cmd" %*',
    'exit /b %ERRORLEVEL%',
    ':atlascode_tools_global',
    'call "%~dp0atlascode-tools-global.cmd" %*',
    'exit /b %ERRORLEVEL%',
    ':atlascode_tools_invalid',
    'echo Invalid ATLASCODE_REGION; expected cn or global. 1>&2',
    'exit /b 2',
    '',
  ].join('\r\n');
}

export function renderPosixLauncher(options: {
  executable: string;
  cliPath: string;
  configDir: string;
  region: AtlasCodeToolsRegion;
  bedrockLane?: string;
  brokerEndpoint: string;
  brokerCapabilityFile: string;
}): string {
  const lines = [
    '#!/bin/sh',
    'unset ATLASCODE_ACCESS_TOKEN ATLASCODE_RUNTIME_DATA_DIR ATLASCODE_DATA_DIR ATLASCODE_PORT ATLASCODE_PROFILE IS_SANDBOX ATLASCODE_API_BASE_URL ATLASCODE_AUTH_BASE_URL ATLASCODE_CLIENT_ID ATLASCODE_SCOPE ATLASCODE_AUTH_PROVIDER ATLASCODE_AUTH_BROKER_ENDPOINT ATLASCODE_AUTH_BROKER_CAPABILITY_FILE ATLASCODE_EXTRA_HEADERS',
    "for atlascode_tools_name in $(env | sed -n 's/^\\([^=]*\\)=.*$/\\1/p'); do",
    '  case "$atlascode_tools_name" in',
    '    __ATLASCODE_PARENT_*|__ATLASCODE_RUNTIME_*|AGENTARCHON_*|AGENT_ARCHON_*) unset "$atlascode_tools_name" ;;',
    '  esac',
    'done',
    'unset atlascode_tools_name',
    'export ELECTRON_RUN_AS_NODE=1',
    `export ATLASCODE_REGION=${quotePosix(options.region)}`,
    `export ATLASCODE_CONFIG_DIR=${quotePosix(options.configDir)}`,
  ];
  lines.push(
    'export ATLASCODE_AUTH_PROVIDER=shared-broker',
    `export ATLASCODE_AUTH_BROKER_ENDPOINT=${quotePosix(options.brokerEndpoint)}`,
    `export ATLASCODE_AUTH_BROKER_CAPABILITY_FILE=${quotePosix(options.brokerCapabilityFile)}`,
  );
  if (options.bedrockLane) {
    lines.push(
      `export ATLASCODE_EXTRA_HEADERS=${quotePosix(`bedrock_lane:${options.bedrockLane},bedrock-lane:${options.bedrockLane}`)}`,
    );
  }
  lines.push(`exec ${quotePosix(options.executable)} ${quotePosix(options.cliPath)} "$@"`, '');
  return lines.join('\n');
}

export function renderWindowsLauncher(options: {
  executable: string;
  cliPath: string;
  configDir: string;
  region: AtlasCodeToolsRegion;
  bedrockLane?: string;
  brokerEndpoint: string;
  brokerCapabilityFile: string;
}): string {
  const lines = [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    'set "ATLASCODE_ACCESS_TOKEN="',
    'set "ATLASCODE_RUNTIME_DATA_DIR="',
    'set "ATLASCODE_DATA_DIR="',
    'set "ATLASCODE_PORT="',
    'set "ATLASCODE_PROFILE="',
    'set "IS_SANDBOX="',
    'set "ATLASCODE_API_BASE_URL="',
    'set "ATLASCODE_AUTH_BASE_URL="',
    'set "ATLASCODE_CLIENT_ID="',
    'set "ATLASCODE_SCOPE="',
    'set "ATLASCODE_AUTH_PROVIDER="',
    'set "ATLASCODE_AUTH_BROKER_ENDPOINT="',
    'set "ATLASCODE_AUTH_BROKER_CAPABILITY_FILE="',
    'set "ATLASCODE_EXTRA_HEADERS="',
    'for /f "tokens=1 delims==" %%V in (\'set __ATLASCODE_PARENT_ 2^>nul\') do set "%%V="',
    'for /f "tokens=1 delims==" %%V in (\'set __ATLASCODE_RUNTIME_ 2^>nul\') do set "%%V="',
    'for /f "tokens=1 delims==" %%V in (\'set AGENTARCHON_ 2^>nul\') do set "%%V="',
    'for /f "tokens=1 delims==" %%V in (\'set AGENT_ARCHON_ 2^>nul\') do set "%%V="',
    'set "ELECTRON_RUN_AS_NODE=1"',
    `set "ATLASCODE_REGION=${escapeWindowsBatchValue(options.region)}"`,
    `set "ATLASCODE_CONFIG_DIR=${escapeWindowsBatchValue(options.configDir)}"`,
  ];
  lines.push(
    'set "ATLASCODE_AUTH_PROVIDER=shared-broker"',
    `set "ATLASCODE_AUTH_BROKER_ENDPOINT=${escapeWindowsBatchValue(options.brokerEndpoint)}"`,
    `set "ATLASCODE_AUTH_BROKER_CAPABILITY_FILE=${escapeWindowsBatchValue(options.brokerCapabilityFile)}"`,
  );
  if (options.bedrockLane) {
    lines.push(
      `set "ATLASCODE_EXTRA_HEADERS=${escapeWindowsBatchValue(`bedrock_lane:${options.bedrockLane},bedrock-lane:${options.bedrockLane}`)}"`,
    );
  }
  lines.push(
    `"${escapeWindowsBatchValue(options.executable)}" "${escapeWindowsBatchValue(options.cliPath)}" %*`,
    'exit /b %ERRORLEVEL%',
    '',
  );
  return lines.join('\r\n');
}

function parseManifest(value: unknown): AtlasCodeToolsManifest {
  if (!value || typeof value !== 'object') throw new Error('atlascode-tools manifest is invalid');
  const input = value as Record<string, unknown>;
  const buildEnv = input.buildEnv;
  if (buildEnv !== 'test' && buildEnv !== 'staging' && buildEnv !== 'prod') {
    throw new Error('atlascode-tools manifest buildEnv is invalid');
  }
  if (input.entry !== 'cli.mjs') throw new Error('atlascode-tools manifest entry is invalid');
  for (const key of ['packageName', 'version', 'gitSha', 'nodeRange'] as const) {
    if (typeof input[key] !== 'string' || input[key].trim().length === 0) {
      throw new Error(`atlascode-tools manifest ${key} is invalid`);
    }
  }
  if (typeof input.bedrockLane !== 'string') {
    throw new Error('atlascode-tools manifest bedrockLane is invalid');
  }
  if (buildEnv !== 'test' && input.bedrockLane.trim().length > 0) {
    throw new Error('atlascode-tools non-test manifest must not select a Bedrock lane');
  }

  const auth = input.auth as Record<string, unknown> | undefined;
  const protocol = auth?.protocol as Record<string, unknown> | undefined;
  if (
    (input.schemaVersion !== 3 && input.schemaVersion !== 4) ||
    auth?.mode !== 'shared-broker' ||
    protocol?.name !== AUTH_LEASE_PROTOCOL_PACKAGE_NAME ||
    protocol?.version !== AUTH_LEASE_PROTOCOL_PACKAGE_VERSION ||
    protocol?.wireVersion !== AUTH_LEASE_PROTOCOL_VERSION
  ) {
    throw new Error('atlascode-tools shared-broker lease protocol manifest is incompatible');
  }
  if (hasOwn(input, 'sharedLocal') || hasOwn(input, 'platform') || hasOwn(input, 'arch')) {
    throw new Error(
      'atlascode-tools shared-broker manifest must not contain shared-local platform metadata',
    );
  }
  validateEmbeddedResourceManifest(input);
  return input as unknown as AtlasCodeToolsManifest;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function resolveManagedBedrockLane(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const lane = value.trim();
  if (!/^[A-Za-z0-9._-]+$/u.test(lane)) {
    throw new Error('atlascode-tools Bedrock lane is invalid');
  }
  return lane;
}

function packageNameForBuildEnv(buildEnv: AtlasCodeToolsBuildEnv): string {
  if (buildEnv === 'test') return '@atlascode/atlascode-tools-test';
  if (buildEnv === 'staging') return '@atlascode/atlascode-tools-staging';
  return '@atlascode/atlascode-tools';
}

function quotePosix(value: string): string {
  if (/\r|\n|\0/u.test(value)) throw new Error('atlascode-tools launcher path contains control data');
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

function escapeWindowsBatchValue(value: string): string {
  if (/\r|\n|\0|"/u.test(value)) {
    throw new Error('atlascode-tools launcher path contains unsupported characters');
  }
  return value.replace(/%/gu, '%%');
}

function writeFileIfChanged(file: string, contents: string, mode: number): void {
  if (existsSync(file) && readFileSync(file, 'utf8') === contents) {
    chmodSync(file, mode);
    return;
  }
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, contents, { mode });
  try {
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  chmodSync(file, mode);
}
