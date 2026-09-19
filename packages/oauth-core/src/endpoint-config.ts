import type { AuthBuildEnv, AuthRegion } from './contracts.js';

export type AtlasCodeOAuthEndpointEnvironment = Partial<
  Record<
    | 'ATLASCODE_OAUTH_DEVICE_AUTHORIZATION_ENDPOINT'
    | 'ATLASCODE_OAUTH_TOKEN_ENDPOINT'
    | 'ATLASCODE_OAUTH_REVOCATION_ENDPOINT',
    string
  >
>;

export interface AtlasCodeOAuthEndpointConfig {
  deviceAuthorizationEndpoint: string;
  deviceAuthorizationHeaders?: Record<string, string>;
  tokenEndpoint: string;
  revocationEndpoint: string;
}

export interface AtlasCodeOAuthEndpointContext {
  buildEnv: AuthBuildEnv;
  region: AuthRegion;
}

const ACCOUNT_ORIGINS: Record<AuthRegion, Record<AuthBuildEnv, string>> = {
  cn: {
    dev: 'https://account-test.example.invalid',
    test: 'https://account-test.example.invalid',
    staging: 'https://account-pre.example.invalid',
    prod: 'https://account.minimax.cn',
  },
  en: {
    dev: 'https://account-overseas-test.example.invalid',
    test: 'https://account-overseas-test.example.invalid',
    staging: 'https://account-overseas-pre.example.invalid',
    prod: 'https://account.minimax.io',
  },
};

export function resolveAtlasCodeOAuthEndpointConfig(
  environment: AtlasCodeOAuthEndpointEnvironment,
  context: AtlasCodeOAuthEndpointContext,
): AtlasCodeOAuthEndpointConfig {
  const configuredValues = [
    environment.ATLASCODE_OAUTH_DEVICE_AUTHORIZATION_ENDPOINT,
    environment.ATLASCODE_OAUTH_TOKEN_ENDPOINT,
    environment.ATLASCODE_OAUTH_REVOCATION_ENDPOINT,
  ];
  if (configuredValues.every((value) => !value?.trim())) {
    const accountOrigin = ACCOUNT_ORIGINS[context.region][context.buildEnv];
    return {
      deviceAuthorizationEndpoint: `${accountOrigin}/oauth2/device/code`,
      ...deviceAuthorizationRequestConfig(context.buildEnv),
      tokenEndpoint: `${accountOrigin}/oauth2/token`,
      revocationEndpoint: `${accountOrigin}/oauth2/revoke`,
    };
  }

  const deviceAuthorizationEndpoint = readHttpsEndpoint(
    environment.ATLASCODE_OAUTH_DEVICE_AUTHORIZATION_ENDPOINT,
  );
  const tokenEndpoint = readHttpsEndpoint(environment.ATLASCODE_OAUTH_TOKEN_ENDPOINT);
  const revocationEndpoint = readHttpsEndpoint(environment.ATLASCODE_OAUTH_REVOCATION_ENDPOINT);
  if (!deviceAuthorizationEndpoint || !tokenEndpoint || !revocationEndpoint) {
    throw new TypeError(
      'Shared AtlasCode OAuth requires all three public OAuth endpoints to be configured.',
    );
  }
  return {
    deviceAuthorizationEndpoint,
    ...deviceAuthorizationRequestConfig(context.buildEnv),
    tokenEndpoint,
    revocationEndpoint,
  };
}

function deviceAuthorizationRequestConfig(
  buildEnv: AuthBuildEnv,
): Pick<AtlasCodeOAuthEndpointConfig, 'deviceAuthorizationHeaders'> {
  return buildEnv === 'staging' ? { deviceAuthorizationHeaders: { 'X-User-Pre': '1' } } : {};
}

function readHttpsEndpoint(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
