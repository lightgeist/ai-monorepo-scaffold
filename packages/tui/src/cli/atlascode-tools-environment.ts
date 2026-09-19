import path from 'node:path';

import { stripRuntimeBoundaryKeysFrom } from '@atlascode/shared/runtime-boundary-env';

type ProcessEnvironment = Record<string, string | undefined>;

const HOST_ENVIRONMENT_KEYS = {
  runtimeExecutable: '__ATLASCODE_TOOLS_RUNTIME_EXECUTABLE',
  brokerEndpoint: '__ATLASCODE_TOOLS_BROKER_ENDPOINT',
  brokerCapabilityFile: '__ATLASCODE_TOOLS_BROKER_CAPABILITY_FILE',
  configDir: '__ATLASCODE_TOOLS_CONFIG_DIR',
  region: '__ATLASCODE_TOOLS_REGION',
  extraHeaders: '__ATLASCODE_TOOLS_EXTRA_HEADERS',
} as const;

const CHILD_ENVIRONMENT_KEYS_TO_CLEAR = [
  'IS_SANDBOX',
  'ATLASCODE_API_BASE_URL',
  'ATLASCODE_AUTH_BASE_URL',
  'ATLASCODE_CLIENT_ID',
  'ATLASCODE_SCOPE',
  'ATLASCODE_AUTH_PROVIDER',
  'ATLASCODE_AUTH_BROKER_ENDPOINT',
  'ATLASCODE_AUTH_BROKER_CAPABILITY_FILE',
  'ATLASCODE_EXTRA_HEADERS',
  'ATLASCODE_REGION',
  'ATLASCODE_CONFIG_DIR',
] as const;

export interface TuiAtlasCodeToolsHostEnvironmentActivation {
  ensureCommandPath(): void;
  restore(): void;
}

export function activateTuiAtlasCodeToolsHostEnvironment(
  environment: ProcessEnvironment,
  options: {
    runtimeExecutable: string;
    brokerEndpoint: string;
    brokerCapabilityFile: string;
    configDir: string;
    region: 'cn' | 'en';
    commandBinDir: string;
    bedrockLane?: string;
  },
): TuiAtlasCodeToolsHostEnvironmentActivation {
  if (!path.isAbsolute(options.runtimeExecutable)) {
    throw new Error('The AtlasCode atlascode-tools runtime executable must be absolute.');
  }
  const assigned: ProcessEnvironment = {
    [HOST_ENVIRONMENT_KEYS.runtimeExecutable]: options.runtimeExecutable,
    [HOST_ENVIRONMENT_KEYS.brokerEndpoint]: options.brokerEndpoint,
    [HOST_ENVIRONMENT_KEYS.brokerCapabilityFile]: options.brokerCapabilityFile,
    [HOST_ENVIRONMENT_KEYS.configDir]: options.configDir,
    [HOST_ENVIRONMENT_KEYS.region]: options.region,
    [HOST_ENVIRONMENT_KEYS.extraHeaders]: options.bedrockLane
      ? `bedrock_lane:${options.bedrockLane},bedrock-lane:${options.bedrockLane}`
      : undefined,
  };
  const previous = Object.fromEntries(
    Object.keys(assigned).map((key) => [key, environment[key]]),
  ) as ProcessEnvironment;
  for (const [key, value] of Object.entries(assigned)) setEnvironmentValue(environment, key, value);

  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const commandBinDir = path.normalize(options.commandBinDir);
  const commandPathWasPresent = splitPath(environment[pathKey]).includes(commandBinDir);
  const ensureCommandPath = (): void => {
    const entries = splitPath(environment[pathKey]).filter((entry) => entry !== commandBinDir);
    environment[pathKey] = [commandBinDir, ...entries].join(path.delimiter);
  };
  ensureCommandPath();

  let restored = false;
  return {
    ensureCommandPath,
    restore(): void {
      if (restored) return;
      restored = true;
      for (const [key, value] of Object.entries(previous)) {
        if (environment[key] === assigned[key]) setEnvironmentValue(environment, key, value);
      }
      if (!commandPathWasPresent) {
        environment[pathKey] = splitPath(environment[pathKey])
          .filter((entry) => entry !== commandBinDir)
          .join(path.delimiter);
      }
    },
  };
}

export function configureAtlasCodeToolsChildEnvironment(
  environment: ProcessEnvironment = process.env,
): boolean {
  const brokerEndpoint = environment[HOST_ENVIRONMENT_KEYS.brokerEndpoint]?.trim();
  const brokerCapabilityFile = environment[HOST_ENVIRONMENT_KEYS.brokerCapabilityFile]?.trim();
  const configDir = environment[HOST_ENVIRONMENT_KEYS.configDir]?.trim();
  const region = environment[HOST_ENVIRONMENT_KEYS.region]?.trim();
  const extraHeaders = environment[HOST_ENVIRONMENT_KEYS.extraHeaders]?.trim();
  const runtimeExecutable = environment[HOST_ENVIRONMENT_KEYS.runtimeExecutable]?.trim();
  const hostValues = [runtimeExecutable, brokerEndpoint, brokerCapabilityFile, configDir, region];
  if (hostValues.every((value) => !value)) return false;
  if (hostValues.some((value) => !value) || (region !== 'cn' && region !== 'en')) {
    throw new Error('The AtlasCode atlascode-tools host environment is incomplete. Restart AtlasCode.');
  }

  stripRuntimeBoundaryKeysFrom(environment, 'agent-runtime');
  const hostEnvironmentKeys: readonly string[] = Object.values(HOST_ENVIRONMENT_KEYS);
  for (const key of Object.keys(environment)) {
    const normalizedKey = key.toUpperCase();
    if (
      CHILD_ENVIRONMENT_KEYS_TO_CLEAR.includes(
        normalizedKey as (typeof CHILD_ENVIRONMENT_KEYS_TO_CLEAR)[number],
      ) ||
      hostEnvironmentKeys.includes(normalizedKey)
    ) {
      delete environment[key];
    }
  }

  environment.ELECTRON_RUN_AS_NODE = '1';
  environment.ATLASCODE_REGION = region;
  environment.ATLASCODE_CONFIG_DIR = configDir;
  environment.ATLASCODE_AUTH_PROVIDER = 'shared-broker';
  environment.ATLASCODE_AUTH_BROKER_ENDPOINT = brokerEndpoint;
  environment.ATLASCODE_AUTH_BROKER_CAPABILITY_FILE = brokerCapabilityFile;
  if (extraHeaders) environment.ATLASCODE_EXTRA_HEADERS = extraHeaders;
  return true;
}

function splitPath(value: string | undefined): string[] {
  return (value ?? '').split(path.delimiter).filter(Boolean).map(path.normalize);
}

function setEnvironmentValue(
  environment: ProcessEnvironment,
  key: string,
  value: string | undefined,
): void {
  if (value === undefined) delete environment[key];
  else environment[key] = value;
}
