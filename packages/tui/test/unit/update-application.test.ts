import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  AtlasCodeUpdateApplication,
  type AtlasCodeUpdateApplicationDependencies,
} from '../../src/update/application.js';
import {
  buildAtlasCodePackageManagerCommand,
  classifyAtlasCodeInstallPath,
  classifyNpmGlobalInstall,
  detectAtlasCodeInstallSource,
  isInternalAtlasCodePackageName,
  resolveAtlasCodeNpmDistribution,
  resolveAtlasCodeNpmDistTag,
  resolveAtlasCodeNpmPrefixInstall,
  resolveAtlasCodePackageName,
  resolveInstalledAtlasCodePackageVersion,
  resolveLatestAtlasCodeRegistryVersion,
} from '../../src/update/install-source.js';
import {
  resolveAtlasCodePrefixLauncherPairs,
  resolveAtlasCodePrefixModulesRoot,
  writeAtlasCodePrefixUpdatePending,
} from '../../src/update/prefix-update.js';

describe('AtlasCodeUpdateApplication', () => {
  it('keeps signed managed-installer check and apply behind one product intent', async () => {
    const check = vi.fn(async () => ({
      status: 'available' as const,
      channel: 'stable' as const,
      currentVersion: '1.2.3',
      latestVersion: '1.2.4',
      manifest: {} as never,
    }));
    const apply = vi.fn(async () => ({
      ...(await check()),
      applied: true,
      installRoot: '/managed',
    }));
    const application = createApplication({
      detectInstallSource: async () => 'managed-installer',
      createManagedService: () => ({ check, apply }),
    });

    const plan = await application.inspect();

    expect(plan).toMatchObject({
      kind: 'available',
      source: 'managed-installer',
      currentVersion: '1.2.3',
      latestVersion: '1.2.4',
      channel: 'stable',
    });
    const signal = new AbortController().signal;
    const onPhase = vi.fn();
    await expect(application.apply(plan, { signal, onPhase })).resolves.toMatchObject({
      applied: true,
      message: 'AtlasCode 1.2.4 is installed. Restart running AtlasCode sessions to use it.',
    });
    expect(apply).toHaveBeenCalledWith({
      channel: 'stable',
      version: '1.2.4',
      signal,
      onPhase,
    });
  });

  it('delegates global package installations to their owning package manager', async () => {
    const runPackageManager = vi.fn(async () => undefined);
    const createManagedService = vi.fn();
    const resolveLatestPackageVersion = vi.fn(async () => '1.2.4');
    const application = createApplication(
      {
        detectInstallSource: async () => 'pnpm-global',
        createManagedService,
        runPackageManager,
        resolveLatestPackageVersion,
      },
      { packageTag: 'test' },
    );

    const plan = await application.inspect();

    expect(plan).toEqual({
      kind: 'package-manager',
      source: 'pnpm-global',
      currentVersion: '1.2.3',
      latestVersion: '1.2.4',
      packageTag: 'test',
      command: {
        executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        args: [
          'add',
          '--global',
          '@deepintuition/atlascode@1.2.4',
          '--registry',
          'https://registry.npmjs.org/',
        ],
        display:
          'pnpm add --global @deepintuition/atlascode@1.2.4 --registry https://registry.npmjs.org/',
      },
    });
    const onOutput = vi.fn();
    const onPhase = vi.fn();
    const signal = new AbortController().signal;
    await expect(application.apply(plan, { onOutput, onPhase, signal })).resolves.toMatchObject({
      applied: true,
      message: 'AtlasCode 1.2.4 was installed through pnpm. Restart AtlasCode to use the installed version.',
    });
    expect(createManagedService).not.toHaveBeenCalled();
    expect(resolveLatestPackageVersion).toHaveBeenCalledWith('test');
    expect(runPackageManager).toHaveBeenCalledWith(plan.command, { onOutput, onPhase, signal });
    expect(onPhase).toHaveBeenNthCalledWith(1, { phase: 'installing', cancellable: false });
    expect(onPhase).toHaveBeenNthCalledWith(2, { phase: 'completed', cancellable: false });
  });

  it('does not reinstall a package-manager installation already at the registry version', async () => {
    const runPackageManager = vi.fn(async () => undefined);
    const application = createApplication({
      detectInstallSource: async () => 'npm-global',
      resolveLatestPackageVersion: async () => '1.2.3',
      runPackageManager,
    });

    const plan = await application.inspect();

    expect(plan).toEqual({
      kind: 'current',
      source: 'npm-global',
      currentVersion: '1.2.3',
      latestVersion: '1.2.3',
      packageTag: 'latest',
    });
    await expect(application.apply(plan)).rejects.toThrow(/cannot be applied automatically/i);
    expect(runPackageManager).not.toHaveBeenCalled();
  });

  it('does not downgrade a package-manager installation newer than the registry version', async () => {
    const application = createApplication({
      detectInstallSource: async () => 'bun-global',
      resolveLatestPackageVersion: async () => '1.2.2',
    });

    await expect(application.inspect()).resolves.toEqual({
      kind: 'ahead',
      source: 'bun-global',
      currentVersion: '1.2.3',
      latestVersion: '1.2.2',
      packageTag: 'latest',
    });
  });

  it('follows the test dist-tag when a custom prerelease sorts ahead of the tagged build', async () => {
    const resolveLatestPackageVersion = vi.fn(
      async () => '0.0.1-beta.1786162945.e3fdada2',
    );
    const application = createApplication(
      {
        detectInstallSource: async () => 'npm-global',
        resolveLatestPackageVersion,
      },
      {
        currentVersion: '0.0.1-beta.matrixfix.7069818510',
        packageTag: 'test',
      },
    );

    await expect(application.inspect()).resolves.toEqual({
      kind: 'package-manager',
      source: 'npm-global',
      currentVersion: '0.0.1-beta.matrixfix.7069818510',
      latestVersion: '0.0.1-beta.1786162945.e3fdada2',
      packageTag: 'test',
      command: {
        executable: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: [
          'install',
          '--global',
          '@deepintuition/atlascode@0.0.1-beta.1786162945.e3fdada2',
          '--ignore-scripts=false',
          '--include=optional',
          '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
          '--registry',
          'https://registry.npmjs.org/',
        ],
        display:
          'npm install --global @deepintuition/atlascode@0.0.1-beta.1786162945.e3fdada2 ' +
          '--ignore-scripts=false --include=optional --allow-scripts=@deepintuition/atlascode,better-sqlite3 ' +
          '--registry https://registry.npmjs.org/',
      },
    });
    expect(resolveLatestPackageVersion).toHaveBeenCalledWith('test');
  });

  it('follows the preview dist-tag instead of applying SemVer downgrade protection', async () => {
    const application = createApplication(
      {
        detectInstallSource: async () => 'npm-global',
        resolveLatestPackageVersion: async () => '0.2.1-previewtrain.41',
      },
      {
        currentVersion: '0.2.1-previewtrain.hotfix.42',
        packageTag: 'preview',
      },
    );

    await expect(application.inspect()).resolves.toMatchObject({
      kind: 'package-manager',
      currentVersion: '0.2.1-previewtrain.hotfix.42',
      latestVersion: '0.2.1-previewtrain.41',
      packageTag: 'preview',
    });
  });

  it('fails closed when the installation owner cannot be identified', async () => {
    const runPackageManager = vi.fn(async () => undefined);
    const createManagedService = vi.fn();
    const resolveLatestPackageVersion = vi.fn(async () => '9.9.9');
    const application = createApplication({
      detectInstallSource: async () => 'unsupported',
      createManagedService,
      runPackageManager,
      resolveLatestPackageVersion,
    });

    const plan = await application.inspect();

    expect(plan).toMatchObject({
      kind: 'manual',
      source: 'unsupported',
      command:
        'npm install --global @deepintuition/atlascode@latest ' +
        '--ignore-scripts=false --include=optional --allow-scripts=@deepintuition/atlascode,better-sqlite3 ' +
        '--registry https://registry.npmjs.org/',
    });
    await expect(application.apply(plan)).rejects.toThrow(/cannot be applied automatically/i);
    expect(createManagedService).not.toHaveBeenCalled();
    expect(resolveLatestPackageVersion).not.toHaveBeenCalled();
    expect(runPackageManager).not.toHaveBeenCalled();
  });

  it.each([
    '/Users/demo/project/pnpm/global/5/source/@deepintuition/atlascode',
    '/Users/demo/project/.config/yarn/global/source/@deepintuition/atlascode',
    '/Users/demo/project/.yarn/global/source/@deepintuition/atlascode',
    '/Users/demo/project/.bun/install/global/source/@deepintuition/atlascode',
  ])(
    'treats a local checkout containing a global-install marker as unsupported: %s',
    async (packageRoot) => {
      const createManagedService = vi.fn();
      const resolveLatestPackageVersion = vi.fn(async () => '9.9.9');
      const application = createApplication({
        detectInstallSource: () =>
          detectAtlasCodeInstallSource({
            installRoot: '/source',
            platform: 'darwin',
            packageRoot: () => packageRoot,
            npmGlobalPrefix: async () => '/usr/local',
            managedInstall: () => false,
          }),
        createManagedService,
        resolveLatestPackageVersion,
      });

      await expect(application.inspect()).resolves.toMatchObject({
        kind: 'manual',
        source: 'unsupported',
      });
      expect(createManagedService).not.toHaveBeenCalled();
      expect(resolveLatestPackageVersion).not.toHaveBeenCalled();
    },
  );

  it('keeps a future public package on the official npm registry', async () => {
    const application = createApplication(
      { detectInstallSource: async () => 'unsupported' },
      { packageName: '@deepintuition/atlascode' },
    );

    await expect(application.inspect()).resolves.toMatchObject({
      kind: 'manual',
      command:
        'npm install --global @deepintuition/atlascode@latest ' +
        '--ignore-scripts=false --include=optional --allow-scripts=@deepintuition/atlascode,better-sqlite3 ' +
        '--registry https://registry.npmjs.org/',
    });
  });

  it('keeps a China mirror prefix on the same registry during updates', async () => {
    const resolveLatestPackageVersion = vi.fn(async () => '1.2.4');
    const application = createApplication(
      {
        detectInstallSource: async () => 'npm-prefix',
        resolveLatestPackageVersion,
      },
      {
        packageName: '@deepintuition/atlascode',
        prefixInstall: {
          executable: '/opt/atlascode/runtime/node/bin/npm',
          packageName: '@deepintuition/atlascode',
          prefix: '/opt/atlascode',
          registry: 'https://registry.npmmirror.com/',
        },
      },
    );

    await expect(application.inspect()).resolves.toMatchObject({
      kind: 'package-manager',
      source: 'npm-prefix',
      command: {
        args: [
          'install',
          '--global',
          '--prefix',
          '/opt/atlascode',
          '@deepintuition/atlascode@1.2.4',
          '--ignore-scripts=false',
          '--include=optional',
          '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
          '--registry',
          'https://registry.npmmirror.com/',
        ],
      },
    });
    expect(resolveLatestPackageVersion).toHaveBeenCalledWith('latest');
  });

  it('reads the installed public package identity from its real entry path', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-public-'));
    const packageRoot = path.join(
      temporaryRoot,
      'lib',
      'node_modules',
      '@deepintuition',
      'code',
    );
    try {
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode' }),
      );
      const entryFile = path.join(packageRoot, 'cli.js');
      writeFileSync(entryFile, '');

      expect(resolveAtlasCodePackageName(entryFile)).toBe('@deepintuition/atlascode');
      expect(resolveInstalledAtlasCodePackageVersion(entryFile)).toBeUndefined();
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('recognizes only the internal package identity as environment-selectable', () => {
    expect(isInternalAtlasCodePackageName('@atlascode/atlascode')).toBe(true);
    expect(isInternalAtlasCodePackageName('@deepintuition/atlascode')).toBe(false);
    expect(isInternalAtlasCodePackageName(undefined)).toBe(false);
  });

  it('rejects a package-manager update when the installed exact version does not match', async () => {
    const application = createApplication({
      detectInstallSource: async () => 'npm-global',
      resolveLatestPackageVersion: async () => '1.2.4',
      runPackageManager: async () => undefined,
      readInstalledPackageVersion: () => '1.2.3',
    });

    const plan = await application.inspect();

    await expect(application.apply(plan)).rejects.toThrow(
      'AtlasCode update installed 1.2.3; expected 1.2.4.',
    );
  });
});

describe('AtlasCode update install-source commands', () => {
  it.each([
    ['/opt/homebrew/lib/node_modules/@deepintuition/atlascode', 'npm-global'],
    ['C:\\Users\\demo\\AppData\\Roaming\\npm\\node_modules\\@atlascode\\atlascode', 'npm-global'],
    ['/usr/local/lib/node_modules/@deepintuition/atlascode', 'npm-global'],
    ['/Users/demo/.local/share/pnpm/global/5/node_modules/@deepintuition/atlascode', 'pnpm-global'],
    [
      '/Users/demo/Library/pnpm/global/v11/10c0afe5/node_modules/@deepintuition/atlascode',
      'pnpm-global',
    ],
    [
      'C:\\Users\\demo\\AppData\\Local\\pnpm\\global\\5\\node_modules\\@atlascode\\atlascode',
      'pnpm-global',
    ],
    [
      'C:\\Users\\demo\\AppData\\Local\\pnpm\\global\\v11\\10c0afe5\\node_modules\\@deepintuition\\atlascode',
      'pnpm-global',
    ],
    ['/Users/demo/.config/yarn/global/node_modules/@deepintuition/atlascode', 'yarn-global'],
    [
      'C:\\Users\\demo\\.config\\yarn\\global\\node_modules\\@atlascode\\atlascode',
      'yarn-global',
    ],
    ['/Users/demo/.bun/install/global/node_modules/@deepintuition/atlascode', 'bun-global'],
    [
      'C:\\Users\\demo\\.bun\\install\\global\\node_modules\\@atlascode\\atlascode',
      'bun-global',
    ],
  ] as const)('classifies %s as %s', (packageRoot, expected) => {
    expect(classifyAtlasCodeInstallPath(packageRoot)).toBe(expected);
  });

  it('uses Windows command shims for the Windows-aware process launcher', () => {
    expect(buildAtlasCodePackageManagerCommand('npm-global', '1.2.4', 'win32')).toEqual({
      executable: 'npm.cmd',
      args: [
        'install',
        '--global',
        '@deepintuition/atlascode@1.2.4',
        '--ignore-scripts=false',
        '--include=optional',
        '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      display:
        'npm install --global @deepintuition/atlascode@1.2.4 --ignore-scripts=false --include=optional ' +
        '--allow-scripts=@deepintuition/atlascode,better-sqlite3 --registry https://registry.npmjs.org/',
    });
    expect(buildAtlasCodePackageManagerCommand('bun-global', '1.2.4', 'win32')).toEqual({
      executable: 'bun.exe',
      args: [
        'add',
        '--global',
        '@deepintuition/atlascode@1.2.4',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      display:
        'bun add --global @deepintuition/atlascode@1.2.4 --registry https://registry.npmjs.org/',
    });
  });

  it('uses the installer-owned npm executable, prefix, package, and registry', () => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');
    const command = buildAtlasCodePackageManagerCommand(
      'npm-prefix',
      '1.2.4',
      'linux',
      distribution,
      {
        executable: '/opt/atlascode/runtime/node/bin/npm',
        packageName: '@deepintuition/atlascode',
        prefix: '/opt/atlascode',
        registry: 'https://registry.npmjs.org/',
      },
    );

    expect(command).toEqual({
      executable: '/opt/atlascode/runtime/node/bin/npm',
      args: [
        'install',
        '--global',
        '--prefix',
        '/opt/atlascode',
        '@deepintuition/atlascode@1.2.4',
        '--ignore-scripts=false',
        '--include=optional',
        '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      display:
        '/opt/atlascode/runtime/node/bin/npm install --global --prefix /opt/atlascode ' +
        '@deepintuition/atlascode@1.2.4 --ignore-scripts=false --include=optional --allow-scripts=@deepintuition/atlascode,better-sqlite3 --registry https://registry.npmjs.org/',
    });
  });

  it('keeps the explicit public mirror for installer-owned updates', () => {
    const distribution = resolveAtlasCodeNpmDistribution(
      '@deepintuition/atlascode',
      'https://registry.npmmirror.com',
    );
    const command = buildAtlasCodePackageManagerCommand(
      'npm-prefix',
      '1.2.4',
      'linux',
      distribution,
      {
        executable: '/opt/atlascode/runtime/node/bin/npm',
        packageName: '@deepintuition/atlascode',
        prefix: '/opt/atlascode',
        registry: 'https://registry.npmmirror.com/',
      },
    );

    expect(command.args).toEqual([
      'install',
      '--global',
      '--prefix',
      '/opt/atlascode',
      '@deepintuition/atlascode@1.2.4',
      '--ignore-scripts=false',
      '--include=optional',
      '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
      '--registry',
      'https://registry.npmmirror.com/',
    ]);
    expect(() =>
      resolveAtlasCodeNpmDistribution('@deepintuition/atlascode', 'https://registry.example.com/'),
    ).toThrow('Unsupported AtlasCode npm registry');
  });

  it('uses the active package manifest entry when argv points at the npm bin shim', async () => {
    const runPackageManager = vi.fn(async () => undefined);
    const activateVersionedPrefix = vi.fn(() => '/opt/atlascode/releases/1.2.4');
    const releasePrefixUpdateLock = vi.fn();
    const application = createApplication(
      {
        detectInstallSource: async () => 'npm-prefix',
        resolveLatestPackageVersion: async () => '1.2.4',
        runPackageManager,
        createVersionedPrefixStaging: () => '/opt/atlascode/releases/.staging-1.2.4',
        prepareVersionedPrefixStaging: vi.fn(),
        readPrefixPackageMetadata: (prefix, packageName) => ({
          packageRoot: `${prefix}/lib/node_modules/${packageName}`,
          version: '1.2.4',
          binEntry: 'dist/index.js',
          atlascodeToolsBinEntry: 'atlascode-tools.js',
        }),
        validatePrefixPackage: vi.fn(async () => undefined),
        activateVersionedPrefix,
        acquirePrefixUpdateLock: () => releasePrefixUpdateLock,
      },
      {
        entryFile: '/opt/atlascode/bin/atlascode',
        packageName: '@deepintuition/atlascode',
        prefixInstall: {
          executable: '/opt/atlascode/runtime/node/bin/npm',
          packageName: '@deepintuition/atlascode',
          prefix: '/opt/atlascode',
          registry: 'https://registry.npmjs.org/',
        },
      },
    );

    const plan = await application.inspect();
    await expect(application.apply(plan)).resolves.toEqual({
      applied: true,
      restartRequired: false,
      message:
        'AtlasCode 1.2.4 is installed. New AtlasCode sessions will use it; running sessions can continue normally.',
    });
    expect(activateVersionedPrefix).toHaveBeenCalledWith({
      stagingPrefix: '/opt/atlascode/releases/.staging-1.2.4',
      activePrefix: '/opt/atlascode',
      packageName: '@deepintuition/atlascode',
      expectedVersion: '1.2.4',
      runtimeExecutable: process.execPath,
      npmExecutable: '/opt/atlascode/runtime/node/bin/npm',
      registry: 'https://registry.npmjs.org/',
    });
    expect(releasePrefixUpdateLock).toHaveBeenCalledOnce();
  });

  it('reports malformed pending metadata instead of treating it as a staged update', async () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-malformed-pending-'));
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition/atlascode');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    const pendingFile = path.join(prefix, '.atlascode-update-pending.json');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3' }),
      );
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({ updateOwner: 'npm-prefix', prefix }),
      );
      writeFileSync(pendingFile, '{}');

      const application = new AtlasCodeUpdateApplication(
        {
          currentVersion: '1.2.3',
          entryFile,
          environment: {},
          installRoot: prefix,
          prefixInstall: {
            executable: path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm'),
            packageName: '@deepintuition/atlascode',
            prefix,
            registry: 'https://registry.npmjs.org/',
          },
        },
        {
          detectInstallSource: async () => 'npm-prefix',
          resolveLatestPackageVersion: async () => '1.2.4',
        },
      );

      await expect(application.inspect()).rejects.toThrow(
        `AtlasCode pending update metadata is invalid at ${pendingFile}.`,
      );
    } finally {
      rmSync(prefix, { recursive: true, force: true });
    }
  });

  it('rejects a pending journal owned by a different active prefix', async () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-foreign-pending-'));
    const foreignPrefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-foreign-owner-'));
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition/atlascode');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    const pendingFile = path.join(prefix, '.atlascode-update-pending.json');
    const foreignStaging = path.join(path.dirname(foreignPrefix), '.foreign-staging');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3' }),
      );
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({ updateOwner: 'npm-prefix', prefix }),
      );
      writeFileSync(
        pendingFile,
        JSON.stringify({
          schemaVersion: 1,
          stagingPrefix: foreignStaging,
          activePrefix: foreignPrefix,
          activeModulesRoot: resolveAtlasCodePrefixModulesRoot(foreignPrefix, process.platform),
          stagedModulesRoot: resolveAtlasCodePrefixModulesRoot(foreignStaging, process.platform),
          backupModulesRoot: `${resolveAtlasCodePrefixModulesRoot(foreignPrefix, process.platform)}.atlascode-update-backup`,
          packageName: '@deepintuition/atlascode',
          expectedVersion: '1.2.4',
          launchers: resolveAtlasCodePrefixLauncherPairs(foreignPrefix, foreignStaging, process.platform),
        }),
      );

      const application = new AtlasCodeUpdateApplication(
        {
          currentVersion: '1.2.3',
          entryFile,
          environment: {},
          installRoot: prefix,
          prefixInstall: {
            executable: path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm'),
            packageName: '@deepintuition/atlascode',
            prefix,
            registry: 'https://registry.npmjs.org/',
          },
        },
        {
          detectInstallSource: async () => 'npm-prefix',
          resolveLatestPackageVersion: async () => '1.2.4',
        },
      );

      await expect(application.inspect()).rejects.toThrow(
        `AtlasCode pending update file is outside its active prefix: ${pendingFile}`,
      );
    } finally {
      rmSync(prefix, { recursive: true, force: true });
      rmSync(foreignPrefix, { recursive: true, force: true });
      rmSync(foreignStaging, { recursive: true, force: true });
    }
  });

  it('resumes a valid staged update without checking for a newer registry version', async () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-valid-pending-'));
    const stagingPrefix = path.join(path.dirname(prefix), `.${path.basename(prefix)}.staging`);
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition/atlascode');
    const stagedPackageRoot = path.join(resolveAtlasCodePrefixModulesRoot(stagingPrefix), '@deepintuition/atlascode');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      mkdirSync(path.join(stagedPackageRoot, 'dist'), { recursive: true });
      mkdirSync(path.join(prefix, 'bin'), { recursive: true });
      mkdirSync(path.join(stagingPrefix, 'bin'), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3', bin: { atlascode: 'dist/index.js' } }),
      );
      writeFileSync(
        path.join(stagedPackageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.4', bin: { atlascode: 'dist/index.js' } }),
      );
      writeFileSync(path.join(prefix, process.platform === 'win32' ? 'atlascode' : 'bin/atlascode'), '1.2.3');
      writeFileSync(path.join(stagingPrefix, process.platform === 'win32' ? 'atlascode' : 'bin/atlascode'), '1.2.4');
      for (const pair of resolveAtlasCodePrefixLauncherPairs(prefix, stagingPrefix)) {
        mkdirSync(path.dirname(pair.activePath), { recursive: true });
        mkdirSync(path.dirname(pair.stagedPath), { recursive: true });
        writeFileSync(pair.activePath, '1.2.3');
        writeFileSync(pair.stagedPath, '1.2.4');
      }
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({ updateOwner: 'npm-prefix', prefix }),
      );
      const activeModulesRoot = resolveAtlasCodePrefixModulesRoot(prefix, process.platform);
      writeAtlasCodePrefixUpdatePending({
        stagingPrefix,
        activePrefix: prefix,
        activeModulesRoot,
        stagedModulesRoot: resolveAtlasCodePrefixModulesRoot(stagingPrefix, process.platform),
        backupModulesRoot: `${activeModulesRoot}.atlascode-update-backup`,
        packageName: '@deepintuition/atlascode',
        expectedVersion: '1.2.4',
        launchers: resolveAtlasCodePrefixLauncherPairs(prefix, stagingPrefix, process.platform),
      });

      const resolveLatestPackageVersion = vi.fn(async () => '1.2.5');
      const application = new AtlasCodeUpdateApplication(
        {
          currentVersion: '1.2.3',
          entryFile,
          environment: {},
          installRoot: prefix,
          platform: process.platform,
          prefixInstall: {
            executable: path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm'),
            packageName: '@deepintuition/atlascode',
            prefix,
            registry: 'https://registry.npmjs.org/',
          },
        },
        {
          detectInstallSource: async () => 'npm-prefix',
          resolveLatestPackageVersion,
        },
      );

      const plan = await application.inspect();

      expect(resolveLatestPackageVersion).not.toHaveBeenCalled();
      await expect(application.apply(plan)).resolves.toEqual({
        applied: false,
        restartRequired: true,
        message: 'AtlasCode 1.2.4 is already staged. It will activate after this process exits.',
      });
    } finally {
      rmSync(prefix, { recursive: true, force: true });
      rmSync(stagingPrefix, { recursive: true, force: true });
    }
  });

  it('rejects a pending update whose staged package and launchers are missing', async () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-missing-staging-'));
    const stagingPrefix = path.join(path.dirname(prefix), `.${path.basename(prefix)}.missing`);
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition/atlascode');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      mkdirSync(path.join(prefix, 'bin'), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3', bin: { atlascode: 'dist/index.js' } }),
      );
      writeFileSync(path.join(prefix, process.platform === 'win32' ? 'atlascode' : 'bin/atlascode'), '1.2.3');
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({ updateOwner: 'npm-prefix', prefix }),
      );
      const activeModulesRoot = resolveAtlasCodePrefixModulesRoot(prefix, process.platform);
      const pendingFile = writeAtlasCodePrefixUpdatePending({
        stagingPrefix,
        activePrefix: prefix,
        activeModulesRoot,
        stagedModulesRoot: resolveAtlasCodePrefixModulesRoot(stagingPrefix, process.platform),
        backupModulesRoot: `${activeModulesRoot}.atlascode-update-backup`,
        packageName: '@deepintuition/atlascode',
        expectedVersion: '1.2.4',
        launchers: resolveAtlasCodePrefixLauncherPairs(prefix, stagingPrefix, process.platform),
      });

      const application = new AtlasCodeUpdateApplication(
        {
          currentVersion: '1.2.3',
          entryFile,
          environment: {},
          installRoot: prefix,
          platform: process.platform,
          prefixInstall: {
            executable: path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm'),
            packageName: '@deepintuition/atlascode',
            prefix,
            registry: 'https://registry.npmjs.org/',
          },
        },
        {
          detectInstallSource: async () => 'npm-prefix',
          resolveLatestPackageVersion: async () => '1.2.4',
        },
      );

      await expect(application.inspect()).rejects.toThrow(
        `AtlasCode pending update artifacts are incomplete at ${pendingFile}.`,
      );
    } finally {
      rmSync(prefix, { recursive: true, force: true });
      rmSync(stagingPrefix, { recursive: true, force: true });
    }
  });

  it('finishes cleanup when the staged version is already active', async () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-pending-cleanup-'));
    const stagingPrefix = path.join(path.dirname(prefix), `.${path.basename(prefix)}.activated`);
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition/atlascode');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      mkdirSync(path.join(prefix, 'bin'), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.4', bin: { atlascode: 'dist/index.js' } }),
      );
      writeFileSync(path.join(prefix, process.platform === 'win32' ? 'atlascode' : 'bin/atlascode'), '1.2.4');
      for (const pair of resolveAtlasCodePrefixLauncherPairs(prefix, stagingPrefix)) {
        mkdirSync(path.dirname(pair.activePath), { recursive: true });
        writeFileSync(pair.activePath, '1.2.4');
      }
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({ updateOwner: 'npm-prefix', prefix }),
      );
      const activeModulesRoot = resolveAtlasCodePrefixModulesRoot(prefix, process.platform);
      writeAtlasCodePrefixUpdatePending({
        stagingPrefix,
        activePrefix: prefix,
        activeModulesRoot,
        stagedModulesRoot: resolveAtlasCodePrefixModulesRoot(stagingPrefix, process.platform),
        backupModulesRoot: `${activeModulesRoot}.atlascode-update-backup`,
        packageName: '@deepintuition/atlascode',
        expectedVersion: '1.2.4',
        launchers: resolveAtlasCodePrefixLauncherPairs(prefix, stagingPrefix, process.platform),
      });

      const resolveLatestPackageVersion = vi.fn(async () => '1.2.4');
      const application = new AtlasCodeUpdateApplication(
        {
          currentVersion: '1.2.4',
          entryFile,
          environment: {},
          installRoot: prefix,
          platform: process.platform,
          prefixInstall: {
            executable: path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm'),
            packageName: '@deepintuition/atlascode',
            prefix,
            registry: 'https://registry.npmjs.org/',
          },
        },
        {
          detectInstallSource: async () => 'npm-prefix',
          resolveLatestPackageVersion,
        },
      );

      const plan = await application.inspect();

      expect(plan).toMatchObject({
        kind: 'package-manager',
        source: 'npm-prefix',
        currentVersion: '1.2.4',
        latestVersion: '1.2.4',
      });
      expect(resolveLatestPackageVersion).not.toHaveBeenCalled();
      await expect(application.apply(plan)).resolves.toEqual({
        applied: false,
        restartRequired: true,
        message: 'AtlasCode 1.2.4 is already active. Restarting will finish update cleanup.',
      });
    } finally {
      rmSync(prefix, { recursive: true, force: true });
      rmSync(stagingPrefix, { recursive: true, force: true });
    }
  });

  it.each(['https://registry.npmjs.org/', 'https://registry.npmmirror.com/'])(
    'recovers installer prefix ownership from the versioned receipt using %s',
    async (registry) => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-prefix-'));
    const packageRoot = path.join(
      temporaryRoot,
      ...(process.platform === 'win32' ? [] : ['lib']),
      'node_modules',
      '@deepintuition',
      'code',
    );
    const npmExecutable = path.join(temporaryRoot, 'runtime', 'node', ...(process.platform === 'win32' ? ['npm.cmd'] : ['bin', 'npm']));
    const entryFile = path.join(packageRoot, 'cli.js');
    try {
      mkdirSync(packageRoot, { recursive: true });
      mkdirSync(path.dirname(npmExecutable), { recursive: true });
      writeFileSync(npmExecutable, '');
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3' }),
      );
      writeFileSync(
        path.join(temporaryRoot, 'install.json'),
        `\uFEFF${JSON.stringify({
          schemaVersion: 1,
          product: 'atlascode',
          updateOwner: 'npm-prefix',
          packageManager: 'npm',
          packageName: '@deepintuition/atlascode',
          registry,
          distTag: 'latest',
          prefix: temporaryRoot,
          npmExecutable,
        })}`,
      );

      const prefixInstall = resolveAtlasCodeNpmPrefixInstall(entryFile, process.platform);
      expect(prefixInstall).toEqual({
        executable: npmExecutable,
        packageName: '@deepintuition/atlascode',
        prefix: realpathSync(temporaryRoot),
        registry,
      });
      expect(resolveInstalledAtlasCodePackageVersion(entryFile)).toBe('1.2.3');
      await expect(
        detectAtlasCodeInstallSource({
          installRoot: temporaryRoot,
          platform: process.platform,
          packageRoot: () => packageRoot,
          prefixInstall: () => prefixInstall,
          managedInstall: () => false,
        }),
      ).resolves.toBe('npm-prefix');
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
    },
  );

  it('resolves versioned installer ownership from a release package entry', () => {
    const prefix = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-versioned-prefix-'));
    const packageRoot = path.join(
      prefix,
      'releases/1.2.3',
      ...(process.platform === 'win32' ? [] : ['lib']),
      'node_modules/@deepintuition/atlascode',
    );
    const npmExecutable = path.join(prefix, process.platform === 'win32' ? 'runtime/node/npm.cmd' : 'runtime/node/bin/npm');
    const entryFile = path.join(packageRoot, 'dist/index.js');
    try {
      mkdirSync(path.dirname(entryFile), { recursive: true });
      mkdirSync(path.dirname(npmExecutable), { recursive: true });
      writeFileSync(entryFile, '');
      writeFileSync(npmExecutable, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3' }),
      );
      writeFileSync(
        path.join(prefix, 'install.json'),
        JSON.stringify({
          schemaVersion: 2,
          product: 'atlascode',
          updateOwner: 'npm-prefix',
          packageManager: 'npm',
          packageName: '@deepintuition/atlascode',
          registry: 'https://registry.npmjs.org/',
          distTag: 'latest',
          prefix,
          npmExecutable,
          layoutVersion: 2,
          releasesDirectory: 'releases',
          currentFile: 'current',
        }),
      );

      expect(resolveAtlasCodeNpmPrefixInstall(entryFile, process.platform)).toEqual({
        executable: npmExecutable,
        packageName: '@deepintuition/atlascode',
        prefix: realpathSync(prefix),
        registry: 'https://registry.npmjs.org/',
      });
    } finally {
      rmSync(prefix, { recursive: true, force: true });
    }
  });

  it('recovers a legacy installer prefix only from its package root and adjacent npm', () => {
    const temporaryParent = mkdtempSync(path.join(os.tmpdir(), 'atlascode-update-legacy-'));
    const prefix = path.join(temporaryParent, '.atlascode');
    const packageRoot = path.join(resolveAtlasCodePrefixModulesRoot(prefix), '@deepintuition', 'code');
    const nodeExecutable = path.join(prefix, 'runtime', 'node', ...(process.platform === 'win32' ? ['node.exe'] : ['bin', 'node']));
    const npmExecutable = path.join(prefix, 'runtime', 'node', ...(process.platform === 'win32' ? ['npm.cmd'] : ['bin', 'npm']));
    const entryFile = path.join(packageRoot, 'cli.js');
    try {
      mkdirSync(packageRoot, { recursive: true });
      mkdirSync(path.dirname(nodeExecutable), { recursive: true });
      writeFileSync(nodeExecutable, '');
      writeFileSync(npmExecutable, '');
      writeFileSync(entryFile, '');
      writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@deepintuition/atlascode', version: '1.2.3' }),
      );

      expect(resolveAtlasCodeNpmPrefixInstall(entryFile, process.platform, nodeExecutable)).toEqual({
        executable: npmExecutable,
        packageName: '@deepintuition/atlascode',
        prefix: realpathSync(prefix),
        registry: 'https://registry.npmjs.org/',
      });
    } finally {
      rmSync(temporaryParent, { recursive: true, force: true });
    }
  });

  it.each([
    ['npm-global', 'npm install --global'],
    ['pnpm-global', 'pnpm add --global'],
    ['yarn-global', 'yarn global add'],
    ['bun-global', 'bun add --global'],
  ] as const)('pins %s updates to the internal registry', (source, prefix) => {
    const command = buildAtlasCodePackageManagerCommand(source, '1.2.4', 'linux');
    const scriptOptions =
      source === 'npm-global'
        ? ' --ignore-scripts=false --include=optional --allow-scripts=@deepintuition/atlascode,better-sqlite3'
        : '';

    expect(command.args.slice(-2)).toEqual([
      '--registry',
      'https://registry.npmjs.org/',
    ]);
    expect(command.display).toBe(
      `${prefix} @deepintuition/atlascode@1.2.4${scriptOptions} --registry https://registry.npmjs.org/`,
    );
  });

  it('resolves the target version from the internal registry with npm shipped by Node', async () => {
    const run = vi.fn(async () => '"1.2.4"');

    await expect(
      resolveLatestAtlasCodeRegistryVersion('test', { platform: 'linux', run }),
    ).resolves.toBe('1.2.4');
    expect(run).toHaveBeenCalledWith('npm', [
      'view',
      '@deepintuition/atlascode@test',
      'version',
      '--json',
      '--registry',
      'https://registry.npmjs.org/',
      '--fetch-timeout',
      '30000',
    ]);
  });

  it('uses installer-owned npm for a prefix installation registry lookup', async () => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');
    const run = vi.fn(async () => '"1.2.4"');

    await expect(
      resolveLatestAtlasCodeRegistryVersion('latest', {
        platform: 'linux',
        run,
        distribution,
        npmExecutable: '/opt/atlascode/runtime/node/bin/npm',
      }),
    ).resolves.toBe('1.2.4');
    expect(run).toHaveBeenCalledWith('/opt/atlascode/runtime/node/bin/npm', [
      'view',
      '@deepintuition/atlascode@latest',
      'version',
      '--json',
      '--registry',
      'https://registry.npmjs.org/',
      '--fetch-timeout',
      '30000',
    ]);
  });

  it('accepts npm registry metadata returned as a single-item JSON array', async () => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');

    await expect(
      resolveLatestAtlasCodeRegistryVersion('latest', {
        platform: 'linux',
        run: async () => '["1.2.4"]',
        distribution,
      }),
    ).resolves.toBe('1.2.4');
  });

  it('keeps public package lookup and installation on the official npm registry', async () => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');
    const run = vi.fn(async () => '"1.2.4"');

    expect(distribution).toEqual({
      packageName: '@deepintuition/atlascode',
      registry: 'https://registry.npmjs.org/',
    });
    await expect(
      resolveLatestAtlasCodeRegistryVersion('latest', {
        platform: 'linux',
        run,
        distribution,
      }),
    ).resolves.toBe('1.2.4');
    expect(run).toHaveBeenCalledWith('npm', [
      'view',
      '@deepintuition/atlascode@latest',
      'version',
      '--json',
      '--registry',
      'https://registry.npmjs.org/',
      '--fetch-timeout',
      '30000',
    ]);
    expect(
      buildAtlasCodePackageManagerCommand('npm-global', '1.2.4', 'linux', distribution),
    ).toMatchObject({
      args: [
        'install',
        '--global',
        '@deepintuition/atlascode@1.2.4',
        '--ignore-scripts=false',
        '--include=optional',
        '--allow-scripts=@deepintuition/atlascode,better-sqlite3',
        '--registry',
        'https://registry.npmjs.org/',
      ],
    });
  });

  it('does not fall back to the internal registry when the public package is absent', async () => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');
    const run = vi.fn(async () => {
      throw new Error('E404 Not Found');
    });

    await expect(
      resolveLatestAtlasCodeRegistryVersion('latest', {
        platform: 'linux',
        run,
        distribution,
      }),
    ).rejects.toThrow('E404 Not Found');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['[]', /invalid latest version/u],
    ['"1.2.4-beta.1"', /stable semantic version/u],
  ])('rejects invalid public latest metadata: %s', async (metadata, error) => {
    const distribution = resolveAtlasCodeNpmDistribution('@deepintuition/atlascode');

    await expect(
      resolveLatestAtlasCodeRegistryVersion('latest', {
        platform: 'linux',
        run: async () => metadata,
        distribution,
      }),
    ).rejects.toThrow(error);
  });

  it.each([
    ['prod', 'latest'],
    ['staging', 'preview'],
    ['test', 'test'],
    [undefined, 'latest'],
  ] as const)('maps the %s build to the %s update tag', (environment, tag) => {
    expect(resolveAtlasCodeNpmDistTag(environment)).toBe(tag);
  });

  it('keeps an explicitly embedded preview update channel independent of the backend', () => {
    expect(resolveAtlasCodeNpmDistTag('prod', 'preview')).toBe('preview');
  });

  it.each([
    ['/usr/local/lib/node_modules/@deepintuition/atlascode', '/usr/local', 'linux'],
    [
      'C:\\Users\\demo\\AppData\\Roaming\\npm\\node_modules\\@atlascode\\atlascode',
      'C:\\Users\\demo\\AppData\\Roaming\\npm',
      'win32',
    ],
  ] as const)('recognizes npm global ownership for %s', (packageRoot, prefix, platform) => {
    expect(classifyNpmGlobalInstall(packageRoot, prefix, platform)).toBe('npm-global');
  });
});

function createApplication(
  dependencies: Partial<AtlasCodeUpdateApplicationDependencies>,
  options: {
    currentVersion?: string;
    packageTag?: 'latest' | 'test' | 'preview';
    packageName?: '@deepintuition/atlascode' | '@deepintuition/atlascode';
    prefixInstall?: {
      executable: string;
      packageName: '@deepintuition/atlascode' | '@deepintuition/atlascode';
      prefix: string;
      registry: string;
    };
  } = {},
): AtlasCodeUpdateApplication {
  return new AtlasCodeUpdateApplication(
    { currentVersion: '1.2.3', installRoot: '/managed', ...options },
    { readInstalledPackageVersion: () => '1.2.4', ...dependencies },
  );
}
