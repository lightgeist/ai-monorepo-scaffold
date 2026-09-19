export const ATLASCODE_PROVIDER_API_FORMATS = [
  'anthropic-messages',
  'openai-completions',
  'openai-responses',
] as const;
export type AtlasCodeProviderApiFormat = (typeof ATLASCODE_PROVIDER_API_FORMATS)[number];

const ATLASCODE_PROVIDER_API_FORMAT_SET = new Set<string>(ATLASCODE_PROVIDER_API_FORMATS);

export function isModelProviderApiFormat(value: unknown): value is AtlasCodeProviderApiFormat {
  return typeof value === 'string' && ATLASCODE_PROVIDER_API_FORMAT_SET.has(value);
}
export type AtlasCodeMiniMaxModelSource = 'token_plan' | 'minimax_api_key';
export type AtlasCodeProviderKind = 'codex-oauth' | 'minimax-oauth' | 'minimax-api-key' | 'custom';

export interface AtlasCodeProviderStatus {
  readonly state: string;
  readonly lastTestedAt?: number;
  readonly lastErrorCode?: string;
  readonly lastErrorMessage?: string;
}

export interface AtlasCodeProviderModel {
  readonly modelId: string;
  readonly displayName?: string;
  readonly selected?: boolean;
  readonly contextLimit?: number;
  readonly maxOutputTokens?: number;
  readonly status?: AtlasCodeProviderStatus;
}

export interface AtlasCodeRuntimeProviderView {
  readonly providerId: string;
  readonly name?: string;
  readonly kind?: string;
  readonly enabled?: boolean;
  readonly apiFormat?: string;
  readonly baseUrl?: string;
  readonly hasApiKey?: boolean;
  readonly maskedApiKey?: string;
  readonly rawApiKey?: string;
  readonly configRevision?: string;
  readonly models?: readonly AtlasCodeProviderModel[];
  readonly status?: AtlasCodeProviderStatus;
}

export interface AtlasCodeProviderView {
  readonly providerId: string;
  readonly name: string;
  readonly kind: AtlasCodeProviderKind;
  readonly active: boolean;
  readonly enabled: boolean;
  readonly readOnly: boolean;
  readonly configRevision?: string;
  readonly apiFormat?: AtlasCodeProviderApiFormat;
  readonly baseUrl?: string;
  readonly hasApiKey: boolean;
  readonly maskedApiKey?: string;
  readonly models: readonly AtlasCodeProviderModel[];
  readonly status?: AtlasCodeProviderStatus;
}

export interface AtlasCodeProviderSnapshot {
  readonly minimaxModelSource: AtlasCodeMiniMaxModelSource;
  readonly providers: readonly AtlasCodeProviderView[];
}

export interface AtlasCodeProviderModelInput {
  readonly modelId: string;
  readonly displayName?: string;
  readonly configurationSource?: 'manual' | 'discovered';
  readonly enabled?: boolean;
  readonly attachment?: boolean;
  readonly reasoning?: boolean;
  readonly toolCall?: boolean;
  readonly temperature?: boolean;
  readonly modalities?: { readonly input?: readonly string[]; readonly output?: readonly string[] };
  readonly limit?: { readonly context?: number; readonly output?: number };
}

export interface AtlasCodeProviderTemplate {
  readonly providerId: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly apiFormat: AtlasCodeProviderApiFormat;
  readonly models: readonly AtlasCodeProviderModelInput[];
}

export type AtlasCodeCodexOAuthState = 'hidden' | 'disconnected' | 'pending' | 'connected' | 'failed';

export type AtlasCodeCodexOAuthLoginMethod = 'browser' | 'device_code';
export interface AtlasCodeCodexOAuthLoginOptions {
  readonly method?: AtlasCodeCodexOAuthLoginMethod;
}
export interface AtlasCodeCodexOAuthStatus {
  readonly state: AtlasCodeCodexOAuthState;
  readonly providerId: 'openai-codex';
  readonly error?: string;
  readonly loginId?: string;
  readonly method?: AtlasCodeCodexOAuthLoginMethod;
  readonly authUrl?: string;
  readonly deviceCode?: {
    readonly userCode: string;
    readonly verificationUri: string;
    readonly expiresAt: number;
  };
}

export interface AtlasCodeCodexOAuthStartResult extends AtlasCodeCodexOAuthStatus {
  readonly authUrl?: string;
}

export interface AtlasCodeCreateProviderInput {
  readonly name?: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly apiFormat: AtlasCodeProviderApiFormat;
  readonly models: readonly AtlasCodeProviderModelInput[];
  readonly saveAndUse?: boolean;
}

export interface AtlasCodeUpdateProviderInput {
  readonly providerId: string;
  readonly name?: string;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly apiFormat?: AtlasCodeProviderApiFormat;
  readonly enabled?: boolean;
  readonly models?: readonly AtlasCodeProviderModelInput[];
  readonly saveAndUse?: boolean;
}

export interface AtlasCodeSaveProviderCandidateInput extends Omit<
  AtlasCodeCreateProviderInput,
  'apiKey' | 'apiFormat' | 'models'
> {
  readonly providerId?: string;
  readonly expectedRevision?: string;
  readonly apiKey?: string;
  readonly apiFormat?: AtlasCodeProviderApiFormat;
  readonly models?: readonly AtlasCodeProviderModelInput[];
  readonly modelId: string;
  readonly skipConnectionTest?: boolean;
}

export interface AtlasCodeDiscoverProviderModelsInput {
  readonly providerId: string;
  readonly expectedRevision: string;
  readonly baseUrl: string;
}

export interface AtlasCodeSaveProviderCandidateResult {
  readonly success: boolean;
  readonly status?: AtlasCodeProviderStatus;
  readonly provider?: AtlasCodeRuntimeProviderView;
}

export interface AtlasCodeProviderTestResult {
  readonly success: boolean;
  readonly status: AtlasCodeProviderStatus;
}

export interface AtlasCodeProviderRuntimePort {
  discoverUserModelsCandidate(
    input: AtlasCodeDiscoverProviderModelsInput,
  ): Promise<readonly AtlasCodeProviderModel[]>;
  listProviderPresets(): Promise<readonly AtlasCodeProviderTemplate[]>;
  getCodexOAuthStatus(): Promise<AtlasCodeCodexOAuthStatus>;
  startCodexOAuthLogin(options?: AtlasCodeCodexOAuthLoginOptions): Promise<AtlasCodeCodexOAuthStartResult>;
  cancelCodexOAuthLogin(loginId: string): Promise<AtlasCodeCodexOAuthStatus>;
  listUserModelProviders(): Promise<readonly AtlasCodeRuntimeProviderView[]>;
  getMiniMaxApiKeyStatus(): Promise<{
    readonly hasApiKey: boolean;
    readonly maskedApiKey?: string;
    readonly rawApiKey?: string;
    readonly cachedStatus?: AtlasCodeProviderStatus;
  }>;
  getMiniMaxModelSource(): Promise<AtlasCodeMiniMaxModelSource>;
  setMiniMaxModelSource(source: AtlasCodeMiniMaxModelSource): Promise<AtlasCodeMiniMaxModelSource>;
  upsertMiniMaxApiKey(input: {
    readonly apiKey: string;
    readonly saveAndUse?: boolean;
  }): Promise<void>;
  createUserModelProvider(input: AtlasCodeCreateProviderInput): Promise<void>;
  saveUserModelProviderCandidate(
    input: AtlasCodeSaveProviderCandidateInput,
  ): Promise<AtlasCodeSaveProviderCandidateResult>;
  updateUserModelProvider(input: AtlasCodeUpdateProviderInput): Promise<void>;
  deleteUserModelProvider(providerId: string): Promise<void>;
  testUserModelProvider(providerId: string): Promise<AtlasCodeProviderTestResult>;
  testUserModel(providerId: string, modelId: string): Promise<AtlasCodeProviderTestResult>;
}
