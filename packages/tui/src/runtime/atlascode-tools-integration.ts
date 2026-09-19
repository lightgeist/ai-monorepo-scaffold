import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';
import {
  startAtlasCodeToolsAuthLeaseBroker,
  validateAtlasCodeToolsResource,
  type AtlasCodeToolsAuthLeaseBroker,
  type AtlasCodeToolsBuildEnv,
  type AtlasCodeToolsHostAuthSession,
  type AtlasCodeToolsHostLogger,
  type ValidatedAtlasCodeToolsResource,
} from '@atlascode/atlascode-tools-host';

import {
  activateTuiAtlasCodeToolsHostEnvironment,
  type TuiAtlasCodeToolsHostEnvironmentActivation,
} from '../cli/atlascode-tools-environment.js';

export type AtlasCodeToolsReadinessCategory =
  | 'disabled'
  | 'ready'
  | 'resource_unavailable'
  | 'broker_unavailable'
  | 'host_unavailable';

export interface AtlasCodeToolsReadiness {
  readonly requested: boolean;
  readonly ready: boolean;
  readonly category: AtlasCodeToolsReadinessCategory;
  readonly buildEnv: AtlasCodeToolsBuildEnv;
  readonly version?: string;
  ensureCommandPath(): void;
  dispose(): Promise<void>;
}

export interface PrepareTuiAtlasCodeToolsIntegrationOptions {
  requested: boolean;
  dataDir: string;
  buildEnv: AtlasCodeBuildEnv;
  region: AtlasCodeRegion;
  session: AtlasCodeToolsHostAuthSession;
  entryUrl: string;
  bedrockLane?: string;
  environment?: Record<string, string | undefined>;
  logger?: AtlasCodeToolsHostLogger;
}

export interface PrepareTuiAtlasCodeToolsIntegrationDependencies {
  validateResource?: typeof validateAtlasCodeToolsResource;
  startBroker?: typeof startAtlasCodeToolsAuthLeaseBroker;
  createRuntimeDir?: typeof createTuiAtlasCodeToolsRuntimeDir;
  removeRuntimeDir?: typeof removeTuiAtlasCodeToolsRuntimeDir;
  activateEnvironment?: typeof activateTuiAtlasCodeToolsHostEnvironment;
}

const NOOP_DISPOSE = async (): Promise<void> => undefined;
const NOOP = (): void => undefined;

export function resolveBundledAtlasCodeToolsResourceDir(
  entryUrl: string,
  environment: Record<string, string | undefined> = process.env,
): string {
  if (environment.ATLASCODE_DEV_ATLASCODE_TOOLS_MODE === 'published') {
    const override = environment.ATLASCODE_DEV_ATLASCODE_TOOLS_RESOURCE_DIR?.trim();
    if (!override || !path.isAbsolute(override)) {
      throw new Error('ATLASCODE_DEV_ATLASCODE_TOOLS_RESOURCE_DIR must be an absolute path');
    }
    return path.normalize(override);
  }
  return path.join(path.dirname(fileURLToPath(entryUrl)), 'embedded', 'atlascode-tools');
}

export function resolveBundledAtlasCodeToolsCommandBinDir(entryUrl: string): string {
  return path.join(path.dirname(fileURLToPath(entryUrl)), 'internal-bin');
}

export async function prepareTuiAtlasCodeToolsIntegration(
  options: PrepareTuiAtlasCodeToolsIntegrationOptions,
  dependencies: PrepareTuiAtlasCodeToolsIntegrationDependencies = {},
): Promise<AtlasCodeToolsReadiness> {
  const buildEnv = normalizeAtlasCodeToolsHostBuildEnv(options.buildEnv);
  if (!options.requested) return inactiveReadiness(false, 'disabled', buildEnv);

  const logger = options.logger ?? { info: () => undefined, warn: () => undefined };
  const environment = options.environment ?? process.env;
  const removeRuntimeDir = dependencies.removeRuntimeDir ?? removeTuiAtlasCodeToolsRuntimeDir;
  let runtimeDir: string | undefined;
  let broker: AtlasCodeToolsAuthLeaseBroker | undefined;
  let activation: TuiAtlasCodeToolsHostEnvironmentActivation | undefined;
  try {
    const resource = (dependencies.validateResource ?? validateAtlasCodeToolsResource)({
      resourceDir: resolveBundledAtlasCodeToolsResourceDir(options.entryUrl, environment),
      expectedBuildEnv: buildEnv,
    });
    runtimeDir = await (dependencies.createRuntimeDir ?? createTuiAtlasCodeToolsRuntimeDir)();
    broker = await (dependencies.startBroker ?? startAtlasCodeToolsAuthLeaseBroker)({
      dataDir: runtimeDir,
      session: options.session,
      logger,
    });
    const configDir = path.join(options.dataDir, 'integrations', 'atlascode-tools', options.region);
    await ensurePrivateDirectory(configDir);
    activation = (dependencies.activateEnvironment ?? activateTuiAtlasCodeToolsHostEnvironment)(
      environment,
      {
        runtimeExecutable: process.execPath,
        brokerEndpoint: broker.endpoint,
        brokerCapabilityFile: broker.capabilityFile,
        configDir,
        region: options.region,
        commandBinDir: resolveBundledAtlasCodeToolsCommandBinDir(options.entryUrl),
        ...(options.bedrockLane ? { bedrockLane: options.bedrockLane } : {}),
      },
    );
    const readiness = activeReadiness({
      buildEnv,
      resource,
      broker,
      runtimeDir,
      removeRuntimeDir,
      activation,
    });
    logger.info(
      `atlascode-tools readiness category=${readiness.category} buildEnv=${buildEnv} region=${options.region} version=${resource.manifest.version}`,
    );
    return readiness;
  } catch (error) {
    activation?.restore();
    await broker?.dispose().catch(() => undefined);
    if (runtimeDir) await removeRuntimeDir(runtimeDir).catch(() => undefined);
    const category = classifyReadinessFailure(error);
    logger.warn(
      `atlascode-tools readiness category=${category} buildEnv=${buildEnv} region=${options.region}`,
    );
    return inactiveReadiness(true, category, buildEnv);
  }
}

export function normalizeAtlasCodeToolsHostBuildEnv(buildEnv: AtlasCodeBuildEnv): AtlasCodeToolsBuildEnv {
  return buildEnv === 'dev' ? 'test' : buildEnv;
}

export async function createTuiAtlasCodeToolsRuntimeDir(): Promise<string> {
  // macOS Unix-domain sockets have a short path limit. `/tmp` keeps the
  // process-private broker endpoint bounded even when the user's dataDir is long.
  const parent = process.platform === 'win32' ? tmpdir() : '/tmp';
  const runtimeDir = await mkdtemp(path.join(parent, `atlascode-tools-tui-${process.pid}-`));
  if (process.platform !== 'win32') await chmod(runtimeDir, 0o700);
  return runtimeDir;
}

export function removeTuiAtlasCodeToolsRuntimeDir(runtimeDir: string): Promise<void> {
  return rm(runtimeDir, { recursive: true, force: true });
}

function activeReadiness(options: {
  buildEnv: AtlasCodeToolsBuildEnv;
  resource: ValidatedAtlasCodeToolsResource;
  broker: AtlasCodeToolsAuthLeaseBroker;
  runtimeDir: string;
  removeRuntimeDir: (runtimeDir: string) => Promise<void>;
  activation: TuiAtlasCodeToolsHostEnvironmentActivation;
}): AtlasCodeToolsReadiness {
  let disposed = false;
  return {
    requested: true,
    ready: true,
    category: 'ready',
    buildEnv: options.buildEnv,
    version: options.resource.manifest.version,
    ensureCommandPath: options.activation.ensureCommandPath,
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      options.activation.restore();
      const errors: unknown[] = [];
      try {
        await options.broker.dispose();
      } catch (error) {
        errors.push(error);
      }
      try {
        await options.removeRuntimeDir(options.runtimeDir);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'atlascode-tools TUI cleanup failed');
    },
  };
}

function inactiveReadiness(
  requested: boolean,
  category: Exclude<AtlasCodeToolsReadinessCategory, 'ready'>,
  buildEnv: AtlasCodeToolsBuildEnv,
): AtlasCodeToolsReadiness {
  return {
    requested,
    ready: false,
    category,
    buildEnv,
    ensureCommandPath: NOOP,
    dispose: NOOP_DISPOSE,
  };
}

async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(directory, 0o700);
}

function classifyReadinessFailure(
  error: unknown,
): Exclude<AtlasCodeToolsReadinessCategory, 'disabled' | 'ready'> {
  if (isErrorCode(error, 'EADDRINUSE')) return 'broker_unavailable';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (
    [
      'manifest',
      'resource',
      'sha256',
      'build environment',
      'package mismatch',
      'embedded cli',
    ].some((needle) => message.includes(needle))
  ) {
    return 'resource_unavailable';
  }
  if (message.includes('broker') || message.includes('socket') || message.includes('named pipe')) {
    return 'broker_unavailable';
  }
  return 'host_unavailable';
}

function isErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === code,
  );
}
