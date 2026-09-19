import type { AtlasCodeBuildEnv, AtlasCodeRegion } from '@atlascode/config';
import type {
  AuthStatusSnapshot,
  DeviceAuthorizationPrompt,
  LoginOptions,
  LoginResult,
  LogoutResult,
} from '@atlascode/oauth-core';

import type {
  AtlasCodeBusinessEventMap,
  AtlasCodeBusinessTelemetry,
  AtlasCodeLoginFailReason,
  AtlasCodeLoginSource,
} from '../analytics/business-telemetry.js';
import { resolveAtlasCodeAuthEnvironment } from './environment.js';
import { buildAtlasCodeLogoutUrl } from './logout-url.js';

export type AtlasCodeAuthProgress = {
  readonly state: 'device-authorization';
} & DeviceAuthorizationPrompt;

export interface AtlasCodeAuthResult {
  readonly state: 'already-authenticated' | 'authenticated' | 'already-signed-out' | 'signed-out';
  readonly message: string;
  readonly restartRequired?: boolean;
  readonly logoutUrl?: string;
}

export interface AtlasCodeAuthPort {
  login(
    onProgress?: (progress: AtlasCodeAuthProgress) => void,
    region?: AtlasCodeRegion,
  ): Promise<AtlasCodeAuthResult>;
  logout(): Promise<AtlasCodeAuthResult>;
}

export interface AtlasCodeSharedAuthCore {
  getStatus(): Promise<AuthStatusSnapshot>;
  login(options?: LoginOptions): Promise<LoginResult>;
  logout(options: { revoke: boolean }): Promise<LogoutResult>;
}

export interface AtlasCodeAuthApplicationOptions {
  readonly dataDir: string;
  readonly sharedAuthCore: AtlasCodeSharedAuthCore;
  readonly resolveSharedAuthCore?: (region: AtlasCodeRegion) => AtlasCodeSharedAuthCore;
  readonly region?: AtlasCodeRegion;
  readonly buildEnv?: AtlasCodeBuildEnv;
  readonly telemetry?: AtlasCodeBusinessTelemetry;
  readonly telemetrySource?: AtlasCodeLoginSource;
  readonly writeRegionPreference?: (
    dataDir: string,
    preference: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv },
  ) => unknown;
}

export class AtlasCodeAuthApplication implements AtlasCodeAuthPort {
  private readonly scope: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv };

  constructor(private readonly options: AtlasCodeAuthApplicationOptions) {
    const environment = resolveAtlasCodeAuthEnvironment({
      runtimeRegion: process.env.ATLASCODE_RUNTIME_REGION === 'en' ? 'en' : 'cn',
    });
    this.scope = {
      region: options.region ?? environment.region,
      buildEnv: options.buildEnv ?? environment.buildEnv,
    };
  }

  async login(
    onProgress?: (progress: AtlasCodeAuthProgress) => void,
    region: AtlasCodeRegion = this.scope.region,
  ): Promise<AtlasCodeAuthResult> {
    this.track('login_click', {});
    try {
      const requestedScope = { ...this.scope, region };
      const switchesRegion = !isSameScope(requestedScope, this.scope);
      let sharedAuthCore = this.options.sharedAuthCore;
      if (switchesRegion) {
        if (!this.options.resolveSharedAuthCore) {
          throw new Error(formatEnvironmentConflict(this.scope, requestedScope));
        }
        sharedAuthCore = this.options.resolveSharedAuthCore(region);
      }
      const wasAuthenticated = (await sharedAuthCore.getStatus()).status === 'authenticated';
      let deviceFlowStarted = false;
      await sharedAuthCore.login({
        onDeviceAuthorization: (authorization: DeviceAuthorizationPrompt) => {
          deviceFlowStarted = true;
          onProgress?.({ state: 'device-authorization', ...authorization });
        },
      });
      this.persistRegionPreference(requestedScope);
      const alreadyAuthenticated = wasAuthenticated && !deviceFlowStarted;
      const result = {
        state: alreadyAuthenticated
          ? ('already-authenticated' as const)
          : ('authenticated' as const),
        message: alreadyAuthenticated
          ? switchesRegion
            ? `Already signed in with ${formatRegion(requestedScope.region)}.`
            : 'Already signed in with MiniMax.'
          : switchesRegion
            ? `Signed in with ${formatRegion(requestedScope.region)}.`
            : 'Signed in with MiniMax.',
        ...(switchesRegion ? { restartRequired: true as const } : {}),
      };
      this.trackLoginResult('1', '');
      return result;
    } catch (error) {
      this.trackLoginResult('2', classifyLoginFailure(error));
      throw error;
    }
  }

  async logout(): Promise<AtlasCodeAuthResult> {
    this.track('logout_click', {});
    const status = await this.options.sharedAuthCore.getStatus();
    // Always run the shared logout: signing out while already signed out is a
    // safe no-op in the core, and never blocking /logout keeps a wedged local
    // state recoverable.
    const result = await this.options.sharedAuthCore.logout({ revoke: true });
    const logoutUrl = buildAtlasCodeLogoutUrl(this.scope);
    if (status.status === 'anonymous' && result.status === 'anonymous') {
      return { state: 'already-signed-out', message: 'Already signed out of MiniMax.', logoutUrl };
    }
    return {
      state: 'signed-out',
      logoutUrl,
      message:
        result.status === 'logout_pending'
          ? `Signed out locally from ${formatRegion(this.scope.region)} across AtlasCode. Server revocation is pending until the network recovers.`
          : `Signed out of ${formatRegion(this.scope.region)} on Desktop, CLI/TUI, and embedded atlascode-tools.`,
    };
  }

  private trackLoginResult(resultType: '1' | '2', failReason: AtlasCodeLoginFailReason): void {
    this.track('login_result', {
      source: this.options.telemetrySource ?? 'atlascode_cli',
      result_type: resultType,
      fail_reason: failReason,
      login_type: 'minimax_oauth',
    });
  }

  private persistRegionPreference(scope: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv }): void {
    try {
      this.options.writeRegionPreference?.(this.options.dataDir, scope);
    } catch {
      // Region persistence must not invalidate an already completed OAuth login.
    }
  }

  private track<Event extends 'login_click' | 'logout_click' | 'login_result'>(
    event: Event,
    properties: AtlasCodeBusinessEventMap[Event],
  ): void {
    try {
      this.options.telemetry?.track(event, properties);
    } catch {
      // Business telemetry must not affect authentication.
    }
  }
}

function classifyLoginFailure(error: unknown): AtlasCodeLoginFailReason {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancel/iu.test(message)) return '3';
  if (/network|offline|fetch|ECONN|ENOTFOUND|ETIMEDOUT/iu.test(message)) return '2';
  if (/oauth|authorization|login failed|invalid login state/iu.test(message)) return '5';
  if (/server|HTTP 5\d\d/iu.test(message)) return '1';
  return '4';
}

function isSameScope(
  left: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv },
  right: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv },
): boolean {
  return left.region === right.region && left.buildEnv === right.buildEnv;
}

function formatEnvironmentConflict(
  active: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv },
  requested: { region: AtlasCodeRegion; buildEnv: AtlasCodeBuildEnv },
): string {
  if (active.region !== requested.region) {
    return `Signed in to ${formatRegion(active.region)}. Run \`atlascode logout\` before signing in to ${formatRegion(requested.region)}.`;
  }
  return `Signed in to another MiniMax ${active.buildEnv} environment. Run \`atlascode logout\` before signing in to ${requested.buildEnv}.`;
}

function formatRegion(region: AtlasCodeRegion): string {
  return region === 'cn' ? 'MiniMax China' : 'MiniMax Global';
}
