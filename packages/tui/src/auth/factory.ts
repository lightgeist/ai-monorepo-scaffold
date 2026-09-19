import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';
import {
  resolveAtlasCodeOAuthEndpointConfig,
  type AtlasCodeOAuthEndpointEnvironment,
} from '@atlascode/oauth-core';

import { createAtlasCodeSharedAuthSession } from '../runtime/auth-session.js';
import { AtlasCodeAuthApplication, type AtlasCodeAuthApplicationOptions } from './application.js';
import { resolveAtlasCodeAuthEnvironment } from './environment.js';
import { writeTuiRegionPreference } from './region-preference.js';

export interface CreateDefaultAtlasCodeAuthApplicationOptions {
  dataDir: string;
  region?: AtlasCodeRegion;
  buildEnv?: AtlasCodeBuildEnv;
  oauthEndpointEnvironment?: AtlasCodeOAuthEndpointEnvironment;
  createSharedSession?: typeof createAtlasCodeSharedAuthSession;
  telemetry?: AtlasCodeAuthApplicationOptions['telemetry'];
  telemetrySource?: AtlasCodeAuthApplicationOptions['telemetrySource'];
  writeRegionPreference?: AtlasCodeAuthApplicationOptions['writeRegionPreference'];
  sharedAuthCore?: AtlasCodeAuthApplicationOptions['sharedAuthCore'];
}

export function createDefaultAtlasCodeAuthApplication(
  options: CreateDefaultAtlasCodeAuthApplicationOptions,
): AtlasCodeAuthApplication {
  const environment = resolveAtlasCodeAuthEnvironment({
    runtimeRegion: options.region,
    runtimeBuildEnv: options.buildEnv,
  });
  const region = options.region ?? environment.region;
  const buildEnv = options.buildEnv ?? environment.buildEnv;
  const applicationOptions = {
    dataDir: options.dataDir,
    region,
    buildEnv,
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
    ...(options.telemetrySource ? { telemetrySource: options.telemetrySource } : {}),
    writeRegionPreference: options.writeRegionPreference ?? writeTuiRegionPreference,
  } satisfies Omit<AtlasCodeAuthApplicationOptions, 'sharedAuthCore'>;
  const createSharedAuthCore = (requestedRegion: AtlasCodeRegion) =>
    (options.createSharedSession ?? createAtlasCodeSharedAuthSession)({
      dataDir: options.dataDir,
      region: requestedRegion,
      buildEnv,
      oauthEndpoints: resolveAtlasCodeOAuthEndpointConfig(
        options.oauthEndpointEnvironment ?? process.env,
        { buildEnv, region: requestedRegion },
      ),
    });
  const sharedAuthCore = options.sharedAuthCore ?? createSharedAuthCore(region);
  return new AtlasCodeAuthApplication({
    ...applicationOptions,
    sharedAuthCore,
    resolveSharedAuthCore: createSharedAuthCore,
  });
}
