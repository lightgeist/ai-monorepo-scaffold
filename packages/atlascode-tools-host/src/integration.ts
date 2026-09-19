import {
  installAtlasCodeToolsLauncher,
  removeAtlasCodeToolsLaunchers,
  validateAtlasCodeToolsResource,
  type AtlasCodeToolsBuildEnv,
  type AtlasCodeToolsRegion,
} from './resource.js';
import { startAtlasCodeToolsAuthLeaseBroker, type AtlasCodeToolsAuthLeaseBroker } from './lease-broker.js';
import type { AtlasCodeToolsHostAuthSession, AtlasCodeToolsHostLogger } from './contracts.js';

export interface StartAtlasCodeToolsHostIntegrationOptions {
  dataDir: string;
  resourceDir: string;
  expectedBuildEnv: AtlasCodeToolsBuildEnv;
  executable: string;
  platform: NodeJS.Platform;
  region: AtlasCodeToolsRegion;
  bedrockLane?: string;
  session: AtlasCodeToolsHostAuthSession;
  logger?: AtlasCodeToolsHostLogger;
}

export interface ActiveAtlasCodeToolsHostIntegration {
  readonly launcherPath: string;
  readonly brokerEndpoint: string;
  readonly packageName: string;
  readonly version: string;
  dispose(): Promise<void>;
}

export interface AtlasCodeToolsHostIntegrationDependencies {
  validateResource: typeof validateAtlasCodeToolsResource;
  startBroker: typeof startAtlasCodeToolsAuthLeaseBroker;
  installLauncher: typeof installAtlasCodeToolsLauncher;
  removeLaunchers: typeof removeAtlasCodeToolsLaunchers;
}

const DEFAULT_DEPENDENCIES: AtlasCodeToolsHostIntegrationDependencies = {
  validateResource: validateAtlasCodeToolsResource,
  startBroker: startAtlasCodeToolsAuthLeaseBroker,
  installLauncher: installAtlasCodeToolsLauncher,
  removeLaunchers: removeAtlasCodeToolsLaunchers,
};

export async function startAtlasCodeToolsHostIntegration(
  options: StartAtlasCodeToolsHostIntegrationOptions,
  dependencies: AtlasCodeToolsHostIntegrationDependencies = DEFAULT_DEPENDENCIES,
): Promise<ActiveAtlasCodeToolsHostIntegration> {
  const resource = dependencies.validateResource({
    resourceDir: options.resourceDir,
    expectedBuildEnv: options.expectedBuildEnv,
  });
  const broker = await dependencies.startBroker({
    dataDir: options.dataDir,
    session: options.session,
    ...(options.logger ? { logger: options.logger } : {}),
  });
  try {
    const installed = await dependencies.installLauncher({
      resourceDir: options.resourceDir,
      expectedBuildEnv: options.expectedBuildEnv,
      dataDir: options.dataDir,
      executable: options.executable,
      platform: options.platform,
      region: options.region,
      ...(options.bedrockLane ? { bedrockLane: options.bedrockLane } : {}),
      brokerEndpoint: broker.endpoint,
      brokerCapabilityFile: broker.capabilityFile,
    });
    return activeIntegration(options, dependencies, broker, installed.launcherPath, resource);
  } catch (error) {
    let cleanupError: unknown;
    try {
      dependencies.removeLaunchers(options.dataDir, options.region);
    } catch (cause) {
      cleanupError = cause;
    }
    try {
      await broker.dispose();
    } catch (cause) {
      cleanupError = cleanupError
        ? new AggregateError([cleanupError, cause], 'atlascode-tools startup cleanup failed')
        : cause;
    }
    if (cleanupError) {
      throw new AggregateError([error, cleanupError], 'atlascode-tools host integration failed');
    }
    throw error;
  }
}

function activeIntegration(
  options: StartAtlasCodeToolsHostIntegrationOptions,
  dependencies: AtlasCodeToolsHostIntegrationDependencies,
  broker: AtlasCodeToolsAuthLeaseBroker,
  launcherPath: string,
  resource: ReturnType<typeof validateAtlasCodeToolsResource>,
): ActiveAtlasCodeToolsHostIntegration {
  let disposed = false;
  return {
    launcherPath,
    brokerEndpoint: broker.endpoint,
    packageName: resource.manifest.packageName,
    version: resource.manifest.version,
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      let launcherError: unknown;
      try {
        dependencies.removeLaunchers(options.dataDir, options.region);
      } catch (error) {
        launcherError = error;
      }
      try {
        await broker.dispose();
      } catch (error) {
        if (launcherError) {
          throw new AggregateError([launcherError, error], 'atlascode-tools cleanup failed');
        }
        throw error;
      }
      if (launcherError) throw launcherError;
    },
  };
}
