import {
  ATLASCODE_OAUTH_SCOPES,
  type AccessTokenLease,
  type UnauthorizedContext,
} from './contracts.js';
import type {
  AuthStatusSnapshot,
  DeviceAuthorizationPrompt,
  LoginOptions,
  LoginResult,
  LogoutResult,
  AtlasCodeOAuthCore,
} from './auth-core.js';

export interface AtlasCodeTokenProvider {
  getStatus(): Promise<AuthStatusSnapshot>;
  getAccessToken(options: { minValidityMs: number }): Promise<AccessTokenLease>;
  handleUnauthorized(context: UnauthorizedContext): Promise<'retry' | 'logout'>;
}

export interface AtlasCodeAuthManager extends AtlasCodeTokenProvider {
  login(options?: LoginOptions): Promise<LoginResult>;
  cancelLogin(): Promise<void>;
  logout(options: { revoke: boolean }): Promise<LogoutResult>;
  watch(listener: (status: AuthStatusSnapshot) => void): () => void;
}

export function createTokenProvider(core: AtlasCodeOAuthCore): AtlasCodeTokenProvider {
  return Object.freeze({
    getStatus: () => core.getStatus(),
    getAccessToken: (options: { minValidityMs: number }) =>
      core.getAccessToken({
        requiredScopes: [...ATLASCODE_OAUTH_SCOPES],
        minValidityMs: options.minValidityMs,
      }),
    handleUnauthorized: (context: UnauthorizedContext) => core.handleUnauthorized(context),
  });
}

export function createAuthManager(core: AtlasCodeOAuthCore): AtlasCodeAuthManager {
  const provider = createTokenProvider(core);
  return Object.freeze({
    ...provider,
    login: (options?: {
      onDeviceAuthorization?: (authorization: DeviceAuthorizationPrompt) => void;
    }) => core.login(options),
    cancelLogin: () => core.cancelLogin(),
    logout: (options: { revoke: boolean }) => core.logout(options),
    watch: (listener: (status: AuthStatusSnapshot) => void) => core.watch(listener),
  });
}
