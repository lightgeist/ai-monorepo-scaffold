/**
 * Child-process environment builder — re-exported from `@atlascode/shared` so the
 * runtime-boundary key lists live in a single lower-layer home that both the
 * config package and the bash-subprocess-env sanitizer (in `@atlascode/agent-core`)
 * can share without a package-boundary violation.
 *
 * The implementation moved to `@atlascode/shared/runtime-boundary-env`; this file
 * keeps the historical `@atlascode/config` import surface stable.
 *
 * @module
 */

export {
  MANAGED_RUNTIME_KEYS,
  LEGACY_RUNTIME_ENV_KEYS,
  RUNTIME_IDENTITY_KEYS,
  PARENT_HINT_KEYS,
  ASR_PROXY_AUTH_ENV_KEYS,
  buildChildEnv,
  stripManagedRuntimeEnv,
  stripRuntimeBoundaryKeysFrom,
  findLegacyRuntimeEnvKeys,
} from '@atlascode/shared/runtime-boundary-env';
export type { BuildChildEnvMode } from '@atlascode/shared/runtime-boundary-env';
