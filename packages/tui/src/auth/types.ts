import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';

export interface CliAuthScope {
  readonly region: AtlasCodeRegion;
  readonly buildEnv: AtlasCodeBuildEnv;
}
