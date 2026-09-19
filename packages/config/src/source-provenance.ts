import { resolveSourceProvenanceEnabled } from '@atlascode/shared/source-provenance';

/** Local product ownership is supplied by the host, never inferred from env. */
export function isLocalSourceProvenanceEnabled(
  runtimeOwnerKind: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveSourceProvenanceEnabled({
    platform: runtimeOwnerKind,
    internalBuild: env.__ATLASCODE_BUILD_INTERNAL === 'true',
    insideBuild: env.__ATLASCODE_BUILD_INSIDE === 'true',
  });
}
