import type { AuthLeaseStatus } from '@atlascode/oauth-lease-protocol';

export interface AtlasCodeToolsAccessTokenLease {
  accessToken: string;
  expiresAtMs: number;
  generation: number;
  scopes: readonly ['agent.default'];
  audience: 'agent-backend';
}

export interface AtlasCodeToolsAuthStatusSnapshot {
  status: AuthLeaseStatus;
  generation: number;
  expiresAtMs?: number;
}

export interface AtlasCodeToolsHostAuthSession {
  getStatus(): Promise<AtlasCodeToolsAuthStatusSnapshot>;
  getAccessToken(minValidityMs: number): Promise<AtlasCodeToolsAccessTokenLease>;
  handleUnauthorized(generation: number): Promise<'retry' | 'logout'>;
  watch(listener: (status: AtlasCodeToolsAuthStatusSnapshot) => void): () => void;
}

export interface AtlasCodeToolsHostLogger {
  info(message: string): void;
  warn(message: string): void;
}
