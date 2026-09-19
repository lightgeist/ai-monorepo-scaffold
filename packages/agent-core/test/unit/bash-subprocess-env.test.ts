import { describe, expect, it } from 'vitest';

import {
  createBashEnvSpawnHook,
  resolveBashEnvPolicy,
  sanitizeBashSubprocessEnv,
} from '../../src/bash-subprocess-env.js';

const providerEnv = {
  ATLASCODE_PROVIDER_API_KEY: 'synthetic-provider-value',
  INPUT_ATLASCODE_PROVIDER_API_KEY: 'synthetic-input-value',
  ATLASCODE_PROVIDER_BASE_URL: 'https://provider.example.invalid',
  ATLASCODE_PROVIDER_MODEL: 'synthetic-model',
  CUSTOM_PROVIDER_API_KEY: 'synthetic-custom-value',
  GH_TOKEN: 'synthetic-gh-value',
  GITHUB_TOKEN: 'synthetic-github-value',
  NPM_TOKEN: 'synthetic-npm-value',
};

describe('bash subprocess default provider credentials', () => {
  it.each([{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { ATLASCODE_BASH_ENV_SANITIZE: 'scrub' }])(
    'scrubs both provider key names using policy %j',
    (markers) => {
      const original = { ...providerEnv, ...markers };
      const policy = resolveBashEnvPolicy(undefined, original);
      expect(policy.mode).toBe('scrub');
      const { env, removed } = sanitizeBashSubprocessEnv(original, policy);
      const { ATLASCODE_PROVIDER_API_KEY, INPUT_ATLASCODE_PROVIDER_API_KEY, ...preserved } = original;
      expect(env).toEqual(preserved);
      expect(removed).toEqual(['ATLASCODE_PROVIDER_API_KEY', 'INPUT_ATLASCODE_PROVIDER_API_KEY']);
      expect(original.ATLASCODE_PROVIDER_API_KEY).toBe(ATLASCODE_PROVIDER_API_KEY);
      expect(original.INPUT_ATLASCODE_PROVIDER_API_KEY).toBe(INPUT_ATLASCODE_PROVIDER_API_KEY);
    },
  );

  it('applies scrub to the actual spawn-hook environment without mutating its input', () => {
    const original = { command: 'echo synthetic', cwd: '.', env: { ...providerEnv } };
    const result = createBashEnvSpawnHook({ mode: 'scrub' })(original);
    expect(result.env).not.toHaveProperty('ATLASCODE_PROVIDER_API_KEY');
    expect(result.env).not.toHaveProperty('INPUT_ATLASCODE_PROVIDER_API_KEY');
    expect(result.command).toBe(original.command);
    expect(original.env).toEqual(providerEnv);
  });

  it('preserves credentials when off is explicitly selected, including in CI', () => {
    const policy = resolveBashEnvPolicy({ mode: 'off' }, { CI: 'true' });
    expect(sanitizeBashSubprocessEnv(providerEnv, policy)).toEqual({
      env: providerEnv,
      removed: [],
    });
  });

  it('continues to strip both provider names in strict mode', () => {
    const { env, removed } = sanitizeBashSubprocessEnv(providerEnv, { mode: 'strict' });
    expect(env).not.toHaveProperty('ATLASCODE_PROVIDER_API_KEY');
    expect(env).not.toHaveProperty('INPUT_ATLASCODE_PROVIDER_API_KEY');
    expect(removed).toContain('ATLASCODE_PROVIDER_API_KEY');
    expect(removed).toContain('INPUT_ATLASCODE_PROVIDER_API_KEY');
    expect(env.ATLASCODE_PROVIDER_MODEL).toBe(providerEnv.ATLASCODE_PROVIDER_MODEL);
    expect(env.ATLASCODE_PROVIDER_BASE_URL).toBe(providerEnv.ATLASCODE_PROVIDER_BASE_URL);
  });

  it('retains the explicit strict allowlist escape hatch', () => {
    const { env } = sanitizeBashSubprocessEnv(providerEnv, {
      mode: 'strict',
      allowlist: ['ATLASCODE_PROVIDER_API_KEY', 'INPUT_ATLASCODE_PROVIDER_API_KEY'],
    });
    expect(env.ATLASCODE_PROVIDER_API_KEY).toBe(providerEnv.ATLASCODE_PROVIDER_API_KEY);
    expect(env.INPUT_ATLASCODE_PROVIDER_API_KEY).toBe(providerEnv.INPUT_ATLASCODE_PROVIDER_API_KEY);
  });
});
