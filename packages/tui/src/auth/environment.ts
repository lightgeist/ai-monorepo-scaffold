import { getRuntimeBuildEnv, type AtlasCodeBuildEnv, type AtlasCodeRegion } from '@atlascode/config';
import {
  resolveProductBuildIdentity,
  type ProductBuildIdentity,
} from '@atlascode/shared/product-build-identity';

export type TuiBuildEnvironment = 'test' | 'staging' | 'prod';
export type TuiBuildVariant = 'standard' | 'internal';
export type AtlasCodeDataEnvironment = TuiBuildEnvironment | 'dev';

declare const __TUI_BUILD_ENV__: TuiBuildEnvironment | undefined;
declare const __TUI_BUILD_VARIANT__: TuiBuildVariant | undefined;

export interface ResolveAtlasCodeAuthEnvironmentOptions {
  readonly embeddedBuildEnvironment?: TuiBuildEnvironment;
  readonly embeddedBuildVariant?: TuiBuildVariant;
  readonly runtimeRegion?: AtlasCodeRegion;
  readonly runtimeBuildEnv?: AtlasCodeBuildEnv;
}

export interface AtlasCodeAuthEnvironment {
  readonly region: AtlasCodeRegion;
  readonly buildEnv: AtlasCodeBuildEnv;
}

let startupBuildEnvironment: TuiBuildEnvironment | undefined;

export function setAtlasCodeStartupBuildEnvironment(
  environment: TuiBuildEnvironment | undefined,
): void {
  startupBuildEnvironment = environment;
}

export function resolveAtlasCodeBuildIdentity(
  options: ResolveAtlasCodeAuthEnvironmentOptions = {},
): ProductBuildIdentity {
  const embeddedBuildEnvironment =
    options.embeddedBuildEnvironment ?? readEmbeddedBuildEnvironment();
  const embeddedBuildVariant = options.embeddedBuildVariant ?? readEmbeddedBuildVariant();
  const runtimeBuildEnv = options.runtimeBuildEnv ?? getRuntimeBuildEnv();

  return resolveProductBuildIdentity({
    buildEnv: embeddedBuildEnvironment ?? normalizeRuntimeBuildEnvironment(runtimeBuildEnv),
    internalBuild: embeddedBuildVariant === 'internal',
  });
}

export function resolveAtlasCodeAuthEnvironment(
  options: ResolveAtlasCodeAuthEnvironmentOptions = {},
): AtlasCodeAuthEnvironment {
  const buildIdentity = resolveAtlasCodeBuildIdentity(options);

  return {
    region: options.runtimeRegion ?? 'cn',
    buildEnv: startupBuildEnvironment ?? buildIdentity.buildEnv ?? 'test',
  };
}

export function resolveAtlasCodeDataEnvironment(
  embeddedBuildEnvironment: TuiBuildEnvironment | undefined = readEmbeddedBuildEnvironment(),
): AtlasCodeDataEnvironment {
  return startupBuildEnvironment ?? embeddedBuildEnvironment ?? 'dev';
}

function readEmbeddedBuildEnvironment(): TuiBuildEnvironment | undefined {
  if (typeof __TUI_BUILD_ENV__ === 'undefined') return undefined;
  return __TUI_BUILD_ENV__;
}

function readEmbeddedBuildVariant(): TuiBuildVariant | undefined {
  if (typeof __TUI_BUILD_VARIANT__ === 'undefined') return undefined;
  return __TUI_BUILD_VARIANT__;
}

function normalizeRuntimeBuildEnvironment(environment: AtlasCodeBuildEnv): AtlasCodeBuildEnv {
  return environment === 'dev' ? 'test' : environment;
}
