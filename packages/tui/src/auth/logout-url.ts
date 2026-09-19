import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';

const WEB_ORIGINS: Record<AtlasCodeRegion, Record<AtlasCodeBuildEnv, string>> = {
  cn: {
    dev: 'https://matrix-test.example.invalid',
    test: 'https://matrix-test.example.invalid',
    staging: 'https://matrix-pre.example.invalid',
    prod: 'https://agent.minimax.cn',
  },
  en: {
    dev: 'https://matrix-overseas-test.example.invalid',
    test: 'https://matrix-overseas-test.example.invalid',
    staging: 'https://matrix-overseas-pre.example.invalid',
    prod: 'https://agent.minimax.io',
  },
};

export function buildAtlasCodeLogoutUrl(scope: {
  readonly region: AtlasCodeRegion;
  readonly buildEnv: AtlasCodeBuildEnv;
}): string {
  const origin = WEB_ORIGINS[scope.region][scope.buildEnv];
  return `${origin}/auth/logout?logout_redirect_uri=${encodeURIComponent(origin)}`;
}
