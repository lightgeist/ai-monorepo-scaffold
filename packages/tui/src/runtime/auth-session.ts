import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';
import {
  createAuthNamespace,
  createCredentialStore,
  HttpOAuthClient,
  migrateLegacyAuthNamespace,
  AtlasCodeOAuthCore,
  type HttpOAuthClientOptions,
  type OAuthClient,
} from '@atlascode/oauth-core';

export interface CreateAtlasCodeSharedAuthSessionOptions {
  dataDir: string;
  region: AtlasCodeRegion;
  buildEnv: AtlasCodeBuildEnv;
  oauthClient?: OAuthClient;
  oauthEndpoints?: Pick<
    HttpOAuthClientOptions,
    'deviceAuthorizationEndpoint' | 'tokenEndpoint' | 'revocationEndpoint'
  >;
}

export function createAtlasCodeSharedAuthSession(
  options: CreateAtlasCodeSharedAuthSessionOptions,
): AtlasCodeOAuthCore {
  const namespace = createAuthNamespace({
    dataDir: options.dataDir,
    buildEnv: options.buildEnv,
    region: options.region,
  });
  const oauthClient = options.oauthClient ?? createHttpOAuthClient(options.oauthEndpoints);
  const credentialStore = createCredentialStore({ authHome: namespace.namespaceHome });
  return new AtlasCodeOAuthCore({
    namespace,
    oauthClient,
    credentialStore,
    initialize: () => migrateLegacyAuthNamespace(namespace),
  });
}

function createHttpOAuthClient(
  endpoints: CreateAtlasCodeSharedAuthSessionOptions['oauthEndpoints'],
): HttpOAuthClient {
  if (!endpoints) {
    throw new TypeError(
      'Shared AtlasCode OAuth requires explicit device authorization, token, and revocation endpoints.',
    );
  }
  return new HttpOAuthClient(endpoints);
}
