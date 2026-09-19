import type { AuthNamespaceInput } from './contracts.js';
import { AtlasCodeOAuthCore } from './auth-core.js';
import { createCredentialStore } from './credential-store/factory.js';
import { createAuthNamespace } from './namespace.js';
import { migrateLegacyAuthNamespace } from './namespace-migration.js';
import { HttpOAuthClient, type HttpOAuthClientOptions } from './oauth-client.js';
import {
  createAuthManager,
  createTokenProvider,
  type AtlasCodeAuthManager,
  type AtlasCodeTokenProvider,
} from './token-provider.js';

export interface CreateAtlasCodeLocalAuthOptions extends AuthNamespaceInput {
  fetchImpl?: typeof fetch;
  endpoints: Pick<
    HttpOAuthClientOptions,
    | 'deviceAuthorizationEndpoint'
    | 'deviceAuthorizationHeaders'
    | 'tokenEndpoint'
    | 'revocationEndpoint'
  >;
}

export function createAtlasCodeTokenProvider(options: CreateAtlasCodeLocalAuthOptions): AtlasCodeTokenProvider {
  return createTokenProvider(createCore(options));
}

export function createAtlasCodeAuthManager(options: CreateAtlasCodeLocalAuthOptions): AtlasCodeAuthManager {
  return createAuthManager(createCore(options));
}

function createCore(options: CreateAtlasCodeLocalAuthOptions): AtlasCodeOAuthCore {
  const namespace = createAuthNamespace(options);
  return new AtlasCodeOAuthCore({
    namespace,
    credentialStore: createCredentialStore({ authHome: namespace.namespaceHome }),
    oauthClient: new HttpOAuthClient({ ...options.endpoints, fetchImpl: options.fetchImpl }),
    initialize: () => migrateLegacyAuthNamespace(namespace),
  });
}
