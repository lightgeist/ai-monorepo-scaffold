import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  installAtlasCodeToolsLauncher,
  validateAtlasCodeToolsResource,
} from '../../src/resource.js';

function fixture(): { dataDir: string; resourceDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'atlascode-tools-host-resource-'));
  const resourceDir = path.join(root, 'embedded', 'atlascode-tools');
  mkdirSync(resourceDir, { recursive: true });
  const cli = 'console.log("embedded")\n';
  writeFileSync(path.join(resourceDir, 'cli.mjs'), cli);
  writeFileSync(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 3,
      packageName: '@atlascode/atlascode-tools-test',
      version: '0.0.0-test',
      gitSha: 'abc1234',
      buildEnv: 'test',
      bedrockLane: 'oauth',
      nodeRange: '>=20',
      entry: 'cli.mjs',
      auth: {
        mode: 'shared-broker',
        protocol: {
          name: '@atlascode/oauth-lease-protocol',
          version: '0.1.0-beta.0',
          wireVersion: 1,
        },
      },
      nativePackages: [],
      resources: [{
        path: 'cli.mjs',
        sha256: createHash('sha256').update(cli).digest('hex'),
      }],
    }, null, 2)}\n`,
  );
  return { dataDir: path.join(root, 'profile'), resourceDir };
}

describe('atlascode-tools embedded resource', () => {
  it('validates the exact shared-broker artifact and installs a POSIX launcher', async () => {
    const input = fixture();
    expect(validateAtlasCodeToolsResource({
      resourceDir: input.resourceDir,
      expectedBuildEnv: 'test',
    }).manifest.packageName).toBe('@atlascode/atlascode-tools-test');

    const installed = await installAtlasCodeToolsLauncher({
      ...input,
      expectedBuildEnv: 'test',
      executable: '/path with spaces/node',
      platform: 'darwin',
      region: 'cn',
      bedrockLane: 'oauth2',
      brokerEndpoint: '/profile/run/atlascode-auth-lease-v1.sock',
      brokerCapabilityFile: '/profile/run/atlascode-auth-lease-v1.cap',
    });
    const launcher = readFileSync(installed.regionalLauncherPath, 'utf8');
    expect(launcher).toContain("export ATLASCODE_AUTH_PROVIDER=shared-broker");
    expect(launcher).toContain(
      "export ATLASCODE_EXTRA_HEADERS='bedrock_lane:oauth2,bedrock-lane:oauth2'",
    );
    expect(launcher).toContain('IS_SANDBOX');
    expect(launcher).toContain('ATLASCODE_API_BASE_URL');
    expect(launcher).toContain('ATLASCODE_AUTH_BASE_URL');
    expect(launcher).toContain('ATLASCODE_CLIENT_ID');
    expect(launcher).toContain('ATLASCODE_SCOPE');
    expect(launcher).toContain("'/path with spaces/node'");
  });

  it('clears inherited auth and routing overrides in the Windows launcher', async () => {
    const input = fixture();
    const installed = await installAtlasCodeToolsLauncher({
      ...input,
      expectedBuildEnv: 'test',
      executable: 'C:\\Program Files\\node.exe',
      platform: 'win32',
      region: 'cn',
      brokerEndpoint: '\\\\.\\pipe\\atlascode-auth-lease-v1',
      brokerCapabilityFile: 'C:\\profile\\run\\atlascode-auth-lease-v1.cap',
    });
    const launcher = readFileSync(installed.regionalLauncherPath, 'utf8');
    for (const name of [
      'IS_SANDBOX',
      'ATLASCODE_API_BASE_URL',
      'ATLASCODE_AUTH_BASE_URL',
      'ATLASCODE_CLIENT_ID',
      'ATLASCODE_SCOPE',
    ]) {
      expect(launcher).toContain(`set "${name}="`);
    }
  });

  it('rejects a modified cli', () => {
    const input = fixture();
    chmodSync(path.join(input.resourceDir, 'cli.mjs'), 0o600);
    writeFileSync(path.join(input.resourceDir, 'cli.mjs'), 'modified\n');
    expect(() => validateAtlasCodeToolsResource({
      resourceDir: input.resourceDir,
      expectedBuildEnv: 'test',
    })).toThrow(/sha256/u);
  });
});
