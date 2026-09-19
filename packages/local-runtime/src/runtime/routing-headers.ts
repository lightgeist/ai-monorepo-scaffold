import type { AtlasCodeBuildEnv } from '@atlascode/config';
import {
  managedBackendRoutingHeaders as buildManagedBackendRoutingHeaders,
  normalizeManagedBackendRoutingContext,
  type ManagedBackendRoutingContext,
} from '@atlascode/agent-tools/desktop';

export type LocalRuntimeRoutingContext = ManagedBackendRoutingContext;

export interface LocalRuntimeRoutingOptions {
  routingContextGetter?: () => LocalRuntimeRoutingContext | undefined;
}

export function normalizeLocalRuntimeRoutingContext(
  value: unknown,
  buildEnv: AtlasCodeBuildEnv | undefined = getRawRuntimeBuildEnv(),
): LocalRuntimeRoutingContext | undefined {
  return normalizeManagedBackendRoutingContext(value, buildEnv);
}

export function managedBackendRoutingHeaders(
  context: LocalRuntimeRoutingContext | undefined,
  buildEnv: AtlasCodeBuildEnv | undefined = getRawRuntimeBuildEnv(),
): Record<string, string> {
  return buildManagedBackendRoutingHeaders(context, buildEnv);
}

/** Raw build-env gate for managed routing; intentionally has no config fallback. */
export function getRawRuntimeBuildEnv(): AtlasCodeBuildEnv | undefined {
  const value = process.env.ATLASCODE_BUILD_ENV;
  return value === 'dev' || value === 'test' || value === 'staging' || value === 'prod'
    ? value
    : undefined;
}
