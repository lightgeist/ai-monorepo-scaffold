import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveAtlasCodeDataEnvironment, type AtlasCodeDataEnvironment } from '../auth/environment.js';
import { configureTuiRuntimeEnvironment } from '../cli/environment.js';

export type TuiDefaultDataDirResolver = () => string;

export interface TuiDataDirEnvironment {
  ATLASCODE_DATA_DIR?: string;
  ATLASCODE_RUNTIME_DATA_DIR?: string;
  /** Historical launch overrides; accepted only when explicitly supplied. */
  MINIMAX_DATA_DIR?: string;
  MAVIS_DATA_DIR?: string;
}

export interface PrepareTuiDataDirOptions {
  environment?: TuiDataDirEnvironment;
  getBuildEnv?: () => AtlasCodeDataEnvironment;
  getDefaultDataDir?: TuiDefaultDataDirResolver;
  configureRuntimeEnvironment?: typeof configureTuiRuntimeEnvironment;
}

export function resolveDefaultTuiDataDir(_buildEnv: AtlasCodeDataEnvironment): string {
  return join(homedir(), '.atlascode');
}

function getDefaultTuiDataDir(): string {
  return resolveDefaultTuiDataDir(resolveAtlasCodeDataEnvironment());
}

function readDataDirOverride(environment: TuiDataDirEnvironment): string | undefined {
  const atlascodeDataDir = environment.ATLASCODE_DATA_DIR?.trim();
  if (atlascodeDataDir) return atlascodeDataDir;

  const runtimeDataDir = environment.ATLASCODE_RUNTIME_DATA_DIR?.trim();
  return runtimeDataDir || environment.MINIMAX_DATA_DIR?.trim() || environment.MAVIS_DATA_DIR?.trim() || undefined;
}

export function getTuiDataDirPath(
  environment: TuiDataDirEnvironment = process.env,
  getDefaultDataDir: () => string = getDefaultTuiDataDir,
): string {
  return readDataDirOverride(environment) ?? getDefaultDataDir();
}

export function resolveTuiDataDir(
  getDefaultDataDir: TuiDefaultDataDirResolver = getDefaultTuiDataDir,
  environment: TuiDataDirEnvironment = process.env,
): string {
  return getTuiDataDirPath(environment, getDefaultDataDir);
}

export function prepareTuiDataDir(options: PrepareTuiDataDirOptions = {}): Promise<string> {
  const buildEnv = (options.getBuildEnv ?? resolveAtlasCodeDataEnvironment)();
  const dataDir = resolveTuiDataDir(
    options.getDefaultDataDir ?? (() => resolveDefaultTuiDataDir(buildEnv)),
    options.environment ?? process.env,
  );
  (options.configureRuntimeEnvironment ?? configureTuiRuntimeEnvironment)({
    dataDir,
  });
  return Promise.resolve(dataDir);
}
