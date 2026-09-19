import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import spawn from 'cross-spawn';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { retryWindowsFileSystemOperation } from '@atlascode/shared';
import {
  AtlasCodeUpdateCancelledError,
  reportAtlasCodeUpdatePhase,
  throwIfAtlasCodeUpdateCancelled,
  type AtlasCodeUpdateOperationOptions,
} from './progress.js';
import {
  assertAtlasCodeReleaseTargetAvailable,
  compareAtlasCodeVersions,
  parseAndVerifyAtlasCodeReleaseManifest,
  parseAtlasCodeUpdateChannel,
  parseAtlasCodeVersion,
  resolveAtlasCodeReleaseTarget,
  type AtlasCodeReleaseManifestV1,
  type AtlasCodeUpdateChannel,
} from './release.js';

const DEFAULT_RELEASE_BASE_URL = '';
const DEFAULT_TIMEOUT_MS = 8_000;

export interface AtlasCodeUpdateRequest extends AtlasCodeUpdateOperationOptions {
  channel?: string;
  version?: string;
  timeoutMs?: number;
}

export interface AtlasCodeUpdateCheckResult {
  status: 'available' | 'current' | 'ahead';
  channel: AtlasCodeUpdateChannel;
  currentVersion: string;
  latestVersion: string;
  manifest: AtlasCodeReleaseManifestV1;
}

export interface AtlasCodeUpdateApplyResult extends AtlasCodeUpdateCheckResult {
  applied: boolean;
  installRoot: string;
}

export interface AtlasCodeUpdateDependencies {
  fetchBytes(
    url: string,
    options?: { signal?: AbortSignal; proxyEnvironment?: NodeJS.ProcessEnv },
  ): Promise<Buffer>;
  installArtifact(input: {
    artifact: string;
    prefix: string;
    registry: string;
    proxyEnvironment: NodeJS.ProcessEnv;
  }): Promise<void>;
  validateInstalledVersion(prefix: string, version: string): Promise<void>;
}

export interface AtlasCodeUpdateServiceOptions {
  currentVersion: string;
  installRoot?: string;
  releaseBaseUrl?: string;
  publicKey?: string;
  environment?: NodeJS.ProcessEnv;
  dependencies?: Partial<AtlasCodeUpdateDependencies>;
}

export class AtlasCodeUpdateService {
  private readonly currentVersion: string;
  private readonly installRoot: string;
  private readonly releaseBaseUrl: string;
  private readonly publicKey?: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly dependencies: AtlasCodeUpdateDependencies;

  constructor(options: AtlasCodeUpdateServiceOptions) {
    this.currentVersion = parseAtlasCodeVersion(options.currentVersion);
    this.installRoot = options.installRoot ?? resolveAtlasCodeInstallRoot(options.environment);
    this.releaseBaseUrl = (options.releaseBaseUrl ?? DEFAULT_RELEASE_BASE_URL).replace(/\/+$/u, '');
    this.publicKey = options.publicKey;
    this.environment = options.environment ?? process.env;
    this.dependencies = {
      fetchBytes: defaultFetchBytes,
      installArtifact: defaultInstallArtifact,
      validateInstalledVersion: defaultValidateInstalledVersion,
      ...options.dependencies,
    };
  }

  async check(request: AtlasCodeUpdateRequest = {}): Promise<AtlasCodeUpdateCheckResult> {
    throwIfAtlasCodeUpdateCancelled(request.signal);
    if (!this.releaseBaseUrl) {
      throw new Error('No AtlasCode signed update feed is configured. Install a verified AtlasCode release archive.');
    }
    reportAtlasCodeUpdatePhase(request, 'checking', true);
    const channel = request.channel
      ? parseAtlasCodeUpdateChannel(request.channel)
      : readAtlasCodeUpdateChannel(this.installRoot);
    const version = request.version ? parseAtlasCodeVersion(request.version) : undefined;
    const manifestUrl = version
      ? `${this.releaseBaseUrl}/releases/${encodeURIComponent(version)}/manifest.json`
      : `${this.releaseBaseUrl}/channels/${channel}.json`;
    const publicKey = this.publicKey ?? readInstalledPublicKey(this.installRoot, this.environment);
    const timeoutMs = normalizeTimeout(request.timeoutMs);
    const controller = new AbortController();
    const detachRequestAbort = forwardAbort(request.signal, controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`AtlasCode update check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    timeout.unref?.();
    try {
      const [manifestBytes, signatureBytes] = await Promise.all([
        this.dependencies.fetchBytes(manifestUrl, {
          signal: controller.signal,
          proxyEnvironment: this.environment,
        }),
        this.dependencies.fetchBytes(`${manifestUrl}.sig`, {
          signal: controller.signal,
          proxyEnvironment: this.environment,
        }),
      ]);
      const manifest = parseAndVerifyAtlasCodeReleaseManifest(
        manifestBytes,
        signatureBytes.toString('utf8'),
        publicKey,
      );
      if (!version && manifest.channel !== channel) {
        throw new Error(
          `Signed AtlasCode release channel mismatch: expected ${channel}, got ${manifest.channel}.`,
        );
      }
      if (version && manifest.version !== version) {
        throw new Error(
          `Signed AtlasCode release version mismatch: expected ${version}, got ${manifest.version}.`,
        );
      }
      assertAtlasCodeReleaseTargetAvailable(manifest, resolveAtlasCodeReleaseTarget());
      const comparison = compareAtlasCodeVersions(this.currentVersion, manifest.version);
      return {
        status: comparison < 0 ? 'available' : comparison > 0 ? 'ahead' : 'current',
        channel,
        currentVersion: this.currentVersion,
        latestVersion: manifest.version,
        manifest,
      };
    } catch (error) {
      if (request.signal?.aborted) throw new AtlasCodeUpdateCancelledError();
      if (timedOut) {
        throw new Error(`AtlasCode update check timed out after ${timeoutMs}ms.`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      detachRequestAbort();
    }
  }

  async apply(request: AtlasCodeUpdateRequest = {}): Promise<AtlasCodeUpdateApplyResult> {
    const check = await this.check(request);
    if (check.status === 'current') {
      return { ...check, applied: false, installRoot: this.installRoot };
    }
    if (check.status === 'ahead' && !request.version) {
      throw new Error(
        `Installed AtlasCode ${this.currentVersion} is newer than ${check.channel} ` +
          `${check.latestVersion}; pass --to to downgrade explicitly.`,
      );
    }

    const artifactTimeoutMs = normalizeTimeout(request.timeoutMs);
    throwIfAtlasCodeUpdateCancelled(request.signal);
    reportAtlasCodeUpdatePhase(request, 'downloading', true);
    const artifactController = new AbortController();
    const detachRequestAbort = forwardAbort(request.signal, artifactController);
    let artifactTimedOut = false;
    const artifactTimeout = setTimeout(() => {
      artifactTimedOut = true;
      artifactController.abort(
        new Error(`AtlasCode artifact download timed out after ${artifactTimeoutMs}ms.`),
      );
    }, artifactTimeoutMs);
    artifactTimeout.unref?.();
    let artifactBytes: Buffer;
    try {
      artifactBytes = await this.dependencies.fetchBytes(check.manifest.installArtifact.url, {
        signal: artifactController.signal,
        proxyEnvironment: this.environment,
      });
    } catch (error) {
      if (request.signal?.aborted) throw new AtlasCodeUpdateCancelledError();
      if (artifactTimedOut) {
        throw new Error(`AtlasCode artifact download timed out after ${artifactTimeoutMs}ms.`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(artifactTimeout);
      detachRequestAbort();
    }
    throwIfAtlasCodeUpdateCancelled(request.signal);
    verifyArtifact(artifactBytes, check.manifest);

    const versionsRoot = path.join(this.installRoot, 'versions');
    const finalPrefix = path.join(versionsRoot, check.latestVersion);
    const stagingPrefix = path.join(
      versionsRoot,
      `.staging-${check.latestVersion}-${process.pid}-${Date.now()}`,
    );
    const artifactFile = path.join(stagingPrefix, `atlascode-${check.latestVersion}.tgz`);
    mkdirSync(stagingPrefix, { recursive: true });
    let createdFinalPrefix = false;
    try {
      reportAtlasCodeUpdatePhase(request, 'staging', true);
      throwIfAtlasCodeUpdateCancelled(request.signal);
      writeFileSync(artifactFile, artifactBytes, { mode: 0o600 });
      throwIfAtlasCodeUpdateCancelled(request.signal);
      reportAtlasCodeUpdatePhase(request, 'installing', false);
      await this.dependencies.installArtifact({
        artifact: artifactFile,
        prefix: stagingPrefix,
        registry: check.manifest.registry,
        proxyEnvironment: this.environment,
      });
      throwIfAtlasCodeUpdateCancelled(request.signal);
      retryWindowsFileSystemOperation(() => rmSync(artifactFile, { force: true }));
      reportAtlasCodeUpdatePhase(request, 'validating', false);
      await this.dependencies.validateInstalledVersion(stagingPrefix, check.latestVersion);
      throwIfAtlasCodeUpdateCancelled(request.signal);
      reportAtlasCodeUpdatePhase(request, 'activating', false);
      if (existsSync(finalPrefix)) {
        await this.dependencies.validateInstalledVersion(finalPrefix, check.latestVersion);
        removeUpdateTree(stagingPrefix);
      } else {
        retryWindowsFileSystemOperation(() => renameSync(stagingPrefix, finalPrefix));
        createdFinalPrefix = true;
      }
      activateVersion(this.installRoot, check.latestVersion);
      reportAtlasCodeUpdatePhase(request, 'completed', false);
      return { ...check, applied: true, installRoot: this.installRoot };
    } catch (error) {
      removeUpdateTree(stagingPrefix);
      if (createdFinalPrefix && readActiveVersion(this.installRoot) !== check.latestVersion) {
        removeUpdateTree(finalPrefix);
      }
      if (error instanceof AtlasCodeUpdateCancelledError || request.signal?.aborted) {
        throw new AtlasCodeUpdateCancelledError();
      }
      throw new Error(
        `AtlasCode ${check.latestVersion} was not activated; the previous version is unchanged: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
}

export function resolveAtlasCodeInstallRoot(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.ATLASCODE_INSTALL_ROOT) return path.resolve(environment.ATLASCODE_INSTALL_ROOT);
  if (process.platform === 'win32') {
    const localAppData = environment.LOCALAPPDATA;
    if (!localAppData)
      throw new Error('LOCALAPPDATA is required to resolve the AtlasCode install root.');
    return path.join(localAppData, 'AtlasCode');
  }
  const dataHome = environment.XDG_DATA_HOME || path.join(homedir(), '.local', 'share');
  return path.join(dataHome, 'atlascode');
}

export function readAtlasCodeUpdateChannel(installRoot: string): AtlasCodeUpdateChannel {
  const file = path.join(installRoot, 'update.json');
  if (!existsSync(file)) return 'stable';
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`AtlasCode update channel config is invalid: ${errorMessage(error)}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('channel' in parsed) ||
    typeof parsed.channel !== 'string'
  ) {
    throw new Error('AtlasCode update channel config is missing channel.');
  }
  return parseAtlasCodeUpdateChannel(parsed.channel);
}

export function isManagedAtlasCodeInstallRoot(installRoot: string): boolean {
  const metadataFile = path.join(installRoot, 'install.json');
  try {
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as Record<string, unknown>;
    return metadata.product === 'atlascode' && metadata.updateOwner === 'atlascode-installer';
  } catch {
    return false;
  }
}

function readInstalledPublicKey(installRoot: string, environment: NodeJS.ProcessEnv): string {
  const explicitFile = environment.ATLASCODE_RELEASE_PUBLIC_KEY_FILE;
  if (explicitFile) return readFileSync(path.resolve(explicitFile), 'utf8');
  const metadataFile = path.join(installRoot, 'install.json');
  if (!existsSync(metadataFile)) {
    throw new Error(
      'AtlasCode update trust root is missing. Install with the official Shell/PowerShell installer first.',
    );
  }
  const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as { publicKey?: unknown };
  if (typeof metadata.publicKey !== 'string' || !metadata.publicKey.includes('BEGIN PUBLIC KEY')) {
    throw new Error('AtlasCode installer metadata does not contain a valid release public key.');
  }
  return metadata.publicKey;
}

function normalizeTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 100 || value > 60_000) {
    throw new Error('AtlasCode update timeout must be an integer between 100 and 60000 milliseconds.');
  }
  return value;
}

async function defaultFetchBytes(
  url: string,
  options: { signal?: AbortSignal; proxyEnvironment?: NodeJS.ProcessEnv } = {},
): Promise<Buffer> {
  const dispatcher = new EnvHttpProxyAgent({
    httpProxy: options.proxyEnvironment?.HTTP_PROXY ?? options.proxyEnvironment?.http_proxy,
    httpsProxy: options.proxyEnvironment?.HTTPS_PROXY ?? options.proxyEnvironment?.https_proxy,
    noProxy: options.proxyEnvironment?.NO_PROXY ?? options.proxyEnvironment?.no_proxy,
  });
  try {
    const response = await fetch(url, {
      signal: options.signal,
      dispatcher,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`AtlasCode release server returned HTTP ${response.status} for ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    await dispatcher.close();
  }
}

async function defaultInstallArtifact(input: {
  artifact: string;
  prefix: string;
  registry: string;
  proxyEnvironment: NodeJS.ProcessEnv;
}): Promise<void> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await runAtlasCodeUpdateCommand(
    npm,
    [
      'install',
      '--global',
      '--prefix',
      input.prefix,
      input.artifact,
      '--registry',
      input.registry,
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
    ],
    input.proxyEnvironment,
    true,
  );
}

async function defaultValidateInstalledVersion(prefix: string, version: string): Promise<void> {
  const executable =
    process.platform === 'win32'
      ? path.join(prefix, 'atlascode.cmd')
      : path.join(prefix, 'bin', 'atlascode');
  const output = await runAtlasCodeUpdateCommand(executable, ['--version'], process.env, true);
  if (output.trim() !== version) {
    throw new Error(`Installed AtlasCode version mismatch: expected ${version}, got ${output.trim()}`);
  }
}

export function runAtlasCodeUpdateCommand(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  capture = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      env: environment,
      shell: false,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once('exit', (code, exitSignal) => {
      if (settled) return;
      settled = true;
      if (code === 0) return resolve(Buffer.concat(stdout).toString('utf8'));
      const details = Buffer.concat(stderr).toString('utf8').trim();
      reject(
        new Error(
          `${command} failed (${
            exitSignal ? `signal ${exitSignal}` : `exit ${String(code)}`
          })${details ? `: ${details}` : ''}`,
        ),
      );
    });
  });
}

function forwardAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => undefined;
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

function verifyArtifact(bytes: Buffer, manifest: AtlasCodeReleaseManifestV1): void {
  if (bytes.length !== manifest.installArtifact.size) {
    throw new Error(
      `AtlasCode artifact checksum/size verification failed: expected ` +
        `${manifest.installArtifact.size} bytes, got ${bytes.length}.`,
    );
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== manifest.installArtifact.sha256) {
    throw new Error('AtlasCode artifact checksum verification failed.');
  }
}

function activateVersion(installRoot: string, version: string): void {
  mkdirSync(installRoot, { recursive: true });
  const current = path.join(installRoot, 'current');
  const temporary = `${current}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${version}\n`, { mode: 0o600 });
  retryWindowsFileSystemOperation(() => renameSync(temporary, current));
}

function removeUpdateTree(target: string): void {
  rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 });
}

function readActiveVersion(installRoot: string): string | undefined {
  const current = path.join(installRoot, 'current');
  if (!existsSync(current)) return undefined;
  return readFileSync(current, 'utf8').trim() || undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
