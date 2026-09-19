import {
  AtlasCodeUpdateService,
  resolveAtlasCodeInstallRoot,
  type AtlasCodeUpdateApplyResult,
  type AtlasCodeUpdateCheckResult,
  type AtlasCodeUpdateRequest,
} from './service.js';
import {
  buildAtlasCodePackageManagerCommand,
  bindAtlasCodeNpmCommandToRuntime,
  createAtlasCodeNpmRuntimeEnvironment,
  detectAtlasCodeInstallSource,
  resolveAtlasCodeNpmDistribution,
  resolveAtlasCodeNpmDistTag,
  resolveAtlasCodeNpmPrefixInstall,
  resolveInstalledAtlasCodePackageVersion,
  resolveLatestAtlasCodeRegistryVersion,
  runAtlasCodePackageManagerCommand,
  type AtlasCodeInstallSource,
  type AtlasCodeNpmDistTag,
  type AtlasCodeNpmDistribution,
  type AtlasCodeNpmPackageName,
  type AtlasCodeNpmPrefixInstall,
  type AtlasCodePackageManagerCommand,
  type AtlasCodePackageManagerInstallSource,
  type AtlasCodePackageManagerRunOptions,
} from './install-source.js';
import { compareAtlasCodeVersions } from './release.js';
import { reportAtlasCodeUpdatePhase } from './progress.js';
import {
  atlascodePrefixNonPrefixPlanMessage,
  atlascodePrefixNotStagedMessage,
  atlascodePrefixOwnershipMissingMessage,
  atlascodePrefixPendingActivationMessage,
  atlascodePrefixPendingCleanupMessage,
  atlascodePrefixVersionedInstalledMessage,
  atlascodePrefixStagedVersionMismatchMessage,
} from './messages.js';
import {
  countAtlasCodePrefixUpdateBlockers,
  inspectPendingAtlasCodePrefixUpdate,
  readAtlasCodePrefixPackageMetadata,
  removeAtlasCodePrefixUpdateStaging,
  validateAtlasCodePrefixPackage,
  type AtlasCodePrefixPackageMetadata,
} from './prefix-update.js';
import {
  acquireAtlasCodeVersionedPrefixUpdateLock,
  activateAtlasCodeVersionedPrefixInstall,
  createAtlasCodeVersionedPrefixStagingPrefix,
  prepareAtlasCodeVersionedPrefixStaging,
  type AtlasCodeVersionedPrefixActivation,
} from './versioned-prefix.js';

interface ManagedUpdateService {
  check(request?: AtlasCodeUpdateRequest): Promise<AtlasCodeUpdateCheckResult>;
  apply(request?: AtlasCodeUpdateRequest): Promise<AtlasCodeUpdateApplyResult>;
}

interface AtlasCodeManagedUpdatePlan {
  readonly source: 'managed-installer';
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly channel: 'stable' | 'preview';
}

interface AtlasCodePackageManagerVersionPlan {
  readonly source: AtlasCodePackageManagerInstallSource;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly packageTag: AtlasCodeNpmDistTag;
}

export type AtlasCodeUpdatePlan =
  | (AtlasCodeManagedUpdatePlan & { readonly kind: 'current' })
  | (AtlasCodeManagedUpdatePlan & { readonly kind: 'ahead' })
  | (AtlasCodeManagedUpdatePlan & { readonly kind: 'available' })
  | (AtlasCodePackageManagerVersionPlan & { readonly kind: 'current' })
  | (AtlasCodePackageManagerVersionPlan & { readonly kind: 'ahead' })
  | {
      readonly kind: 'package-manager';
      readonly source: AtlasCodePackageManagerInstallSource;
      readonly currentVersion: string;
      readonly latestVersion: string;
      readonly packageTag: AtlasCodeNpmDistTag;
      readonly command: AtlasCodePackageManagerCommand;
    }
  | {
      readonly kind: 'manual';
      readonly source: 'unsupported';
      readonly currentVersion: string;
      readonly command: string;
    };

export interface AtlasCodeUpdateOutcome {
  readonly applied: boolean;
  readonly message: string;
  readonly restartRequired?: boolean;
}

export type AtlasCodeUpdateApplyOptions = AtlasCodePackageManagerRunOptions;

export interface AtlasCodeUpdateApplicationOptions {
  readonly currentVersion: string;
  readonly installRoot?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly packageTag?: AtlasCodeNpmDistTag;
  readonly packageName?: AtlasCodeNpmPackageName;
  readonly prefixInstall?: AtlasCodeNpmPrefixInstall;
  readonly entryFile?: string;
  readonly runtimeExecutable?: string;
}

export interface AtlasCodeUpdateApplicationDependencies {
  readonly detectInstallSource: () => Promise<AtlasCodeInstallSource>;
  readonly createManagedService: () => ManagedUpdateService;
  readonly resolveLatestPackageVersion: (tag: AtlasCodeNpmDistTag) => Promise<string>;
  readonly runPackageManager: (
    command: AtlasCodePackageManagerCommand,
    options?: AtlasCodePackageManagerRunOptions,
  ) => Promise<void>;
  readonly readInstalledPackageVersion: () => string | undefined;
  readonly readPrefixPackageMetadata: (
    prefix: string,
    packageName: AtlasCodeNpmPackageName,
  ) => AtlasCodePrefixPackageMetadata;
  readonly validatePrefixPackage: (
    prefix: string,
    metadata: AtlasCodePrefixPackageMetadata,
    expectedVersion: string,
  ) => Promise<void>;
  readonly countPrefixUpdateBlockers: (activePrefix: string) => number | undefined;
  readonly removePrefixStaging: (stagingPrefix: string) => void;
  readonly createVersionedPrefixStaging: (prefix: string, version: string) => string;
  readonly prepareVersionedPrefixStaging: (stagingPrefix: string) => void;
  readonly activateVersionedPrefix: (activation: AtlasCodeVersionedPrefixActivation) => string;
  readonly acquirePrefixUpdateLock: (activePrefix: string) => () => void;
}

export class AtlasCodeUpdateApplication {
  private readonly currentVersion: string;
  private readonly packageTag: AtlasCodeNpmDistTag;
  private readonly distribution: AtlasCodeNpmDistribution;
  private readonly platform: NodeJS.Platform;
  private readonly prefixInstall?: AtlasCodeNpmPrefixInstall;
  private readonly entryFile?: string;
  private readonly runtimeExecutable: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly dependencies: AtlasCodeUpdateApplicationDependencies;

  constructor(
    options: AtlasCodeUpdateApplicationOptions,
    dependencies: Partial<AtlasCodeUpdateApplicationDependencies> = {},
  ) {
    this.currentVersion = options.currentVersion;
    const environment = options.environment ?? process.env;
    const installRoot = options.installRoot ?? resolveAtlasCodeInstallRoot(environment);
    const platform = options.platform ?? process.platform;
    this.platform = platform;
    this.environment = environment;
    this.entryFile = options.entryFile ?? process.argv[1];
    this.runtimeExecutable = options.runtimeExecutable ?? process.execPath;
    this.prefixInstall =
      options.prefixInstall ?? resolveAtlasCodeNpmPrefixInstall(this.entryFile, platform);
    const packageManagerEnvironment = this.prefixInstall
      ? createAtlasCodeNpmRuntimeEnvironment(environment, this.runtimeExecutable, platform)
      : environment;
    this.packageTag = options.packageTag ?? resolveAtlasCodeNpmDistTag();
    this.distribution = resolveAtlasCodeNpmDistribution(
      options.packageName,
      this.prefixInstall?.registry,
    );
    this.dependencies = {
      detectInstallSource:
        dependencies.detectInstallSource ??
        (() =>
          detectAtlasCodeInstallSource({
            installRoot,
            platform,
            prefixInstall: () => this.prefixInstall,
          })),
      createManagedService:
        dependencies.createManagedService ??
        (() =>
          new AtlasCodeUpdateService({
            currentVersion: options.currentVersion,
            installRoot,
            environment,
          })),
      resolveLatestPackageVersion:
        dependencies.resolveLatestPackageVersion ??
        ((tag) =>
          resolveLatestAtlasCodeRegistryVersion(tag, {
            platform,
            distribution: this.distribution,
            environment: packageManagerEnvironment,
            ...(this.prefixInstall
              ? {
                  npmExecutable: this.prefixInstall.executable,
                  runtimeExecutable: this.runtimeExecutable,
                }
              : {}),
          })),
      runPackageManager:
        dependencies.runPackageManager ??
        ((command, progress) =>
          runAtlasCodePackageManagerCommand(
            this.prefixInstall
              ? bindAtlasCodeNpmCommandToRuntime(command, this.runtimeExecutable)
              : command,
            packageManagerEnvironment,
            progress,
          )),
      readInstalledPackageVersion:
        dependencies.readInstalledPackageVersion ?? resolveInstalledAtlasCodePackageVersion,
      readPrefixPackageMetadata:
        dependencies.readPrefixPackageMetadata ??
        ((prefix, packageName) => readAtlasCodePrefixPackageMetadata(prefix, packageName, platform)),
      validatePrefixPackage:
        dependencies.validatePrefixPackage ??
        ((prefix, metadata, expectedVersion) =>
          validateAtlasCodePrefixPackage(prefix, metadata, this.runtimeExecutable, expectedVersion)),
      countPrefixUpdateBlockers:
        dependencies.countPrefixUpdateBlockers ?? countAtlasCodePrefixUpdateBlockers,
      removePrefixStaging: dependencies.removePrefixStaging ?? removeAtlasCodePrefixUpdateStaging,
      createVersionedPrefixStaging:
        dependencies.createVersionedPrefixStaging ??
        ((prefix, version) => createAtlasCodeVersionedPrefixStagingPrefix(prefix, version, platform)),
      prepareVersionedPrefixStaging:
        dependencies.prepareVersionedPrefixStaging ?? prepareAtlasCodeVersionedPrefixStaging,
      activateVersionedPrefix:
        dependencies.activateVersionedPrefix ??
        ((activation) => activateAtlasCodeVersionedPrefixInstall(activation, platform)),
      acquirePrefixUpdateLock:
        dependencies.acquirePrefixUpdateLock ?? acquireAtlasCodeVersionedPrefixUpdateLock,
    };
  }

  async inspect(): Promise<AtlasCodeUpdatePlan> {
    const source = await this.dependencies.detectInstallSource();
    if (source === 'managed-installer') {
      const result = await this.dependencies.createManagedService().check();
      return {
        kind: result.status,
        source,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        channel: result.channel,
      };
    }
    if (source === 'unsupported') {
      return {
        kind: 'manual',
        source,
        currentVersion: this.currentVersion,
        command: buildAtlasCodePackageManagerCommand(
          'npm-global',
          this.packageTag,
          this.platform,
          this.distribution,
        ).display,
      };
    }
    const pendingUpdate =
      source === 'npm-prefix' ? inspectPendingAtlasCodePrefixUpdate(this.entryFile) : undefined;
    if (pendingUpdate) {
      const latestVersion = pendingUpdate.activation.expectedVersion;
      return {
        kind: 'package-manager',
        source,
        currentVersion: this.currentVersion,
        latestVersion,
        packageTag: this.packageTag,
        command: buildAtlasCodePackageManagerCommand(
          source,
          latestVersion,
          this.platform,
          this.distribution,
          this.prefixInstall,
        ),
      };
    }
    const latestVersion = await this.dependencies.resolveLatestPackageVersion(this.packageTag);
    const comparison = compareAtlasCodeVersions(this.currentVersion, latestVersion);
    const followsRollingTag = this.packageTag !== 'latest';
    if (comparison === 0) {
      return {
        kind: 'current',
        source,
        currentVersion: this.currentVersion,
        latestVersion,
        packageTag: this.packageTag,
      };
    }
    if (comparison > 0 && !followsRollingTag) {
      return {
        kind: 'ahead',
        source,
        currentVersion: this.currentVersion,
        latestVersion,
        packageTag: this.packageTag,
      };
    }
    return {
      kind: 'package-manager',
      source,
      currentVersion: this.currentVersion,
      latestVersion,
      packageTag: this.packageTag,
      command: buildAtlasCodePackageManagerCommand(
        source,
        latestVersion,
        this.platform,
        this.distribution,
        this.prefixInstall,
      ),
    };
  }

  async apply(
    plan: AtlasCodeUpdatePlan,
    options: AtlasCodeUpdateApplyOptions = {},
  ): Promise<AtlasCodeUpdateOutcome> {
    if (plan.kind === 'manual' || plan.kind === 'current' || plan.kind === 'ahead') {
      throw new Error(`AtlasCode update plan ${plan.kind} cannot be applied automatically.`);
    }
    if (plan.kind === 'available') {
      const result = await this.dependencies.createManagedService().apply({
        channel: plan.channel,
        version: plan.latestVersion,
        ...options,
      });
      return result.applied
        ? {
            applied: true,
            message:
              `AtlasCode ${result.latestVersion} is installed. ` +
              'Restart running AtlasCode sessions to use it.',
          }
        : {
            applied: false,
            message: `AtlasCode ${result.currentVersion} is already active.`,
          };
    }

    if (plan.source === 'npm-prefix') {
      return this.applyNpmPrefixUpdate(plan, options);
    }

    reportAtlasCodeUpdatePhase(options, 'installing', false);
    await this.dependencies.runPackageManager(plan.command, options);
    const installedVersion = this.dependencies.readInstalledPackageVersion();
    if (installedVersion !== plan.latestVersion) {
      throw new Error(
        `AtlasCode update installed ${installedVersion || '<unknown>'}; expected ${plan.latestVersion}.`,
      );
    }
    reportAtlasCodeUpdatePhase(options, 'completed', false);
    return {
      applied: true,
      message:
        `AtlasCode ${plan.latestVersion} was installed through ${packageManagerName(plan.source)}. ` +
        'Restart AtlasCode to use the installed version.',
    };
  }

  private async applyNpmPrefixUpdate(
    plan: Extract<AtlasCodeUpdatePlan, { kind: 'package-manager' }>,
    options: AtlasCodeUpdateApplyOptions,
  ): Promise<AtlasCodeUpdateOutcome> {
    if (plan.source !== 'npm-prefix') {
      throw new Error(atlascodePrefixNonPrefixPlanMessage(this.environment));
    }
    const prefixInstall = this.prefixInstall;
    if (!prefixInstall) {
      throw new Error(atlascodePrefixOwnershipMissingMessage(this.environment));
    }
    const pendingUpdate = inspectPendingAtlasCodePrefixUpdate(this.entryFile);
    if (pendingUpdate) {
      const blockingSessionCount = this.dependencies.countPrefixUpdateBlockers(
        pendingUpdate.activation.activePrefix,
      );
      return {
        applied: false,
        restartRequired: true,
        message:
          pendingUpdate.state === 'activated'
            ? atlascodePrefixPendingCleanupMessage(pendingUpdate.activation.expectedVersion, {
                blockingSessionCount,
                environment: this.environment,
              })
            : atlascodePrefixPendingActivationMessage(pendingUpdate.activation.expectedVersion, {
                blockingSessionCount,
                environment: this.environment,
              }),
      };
    }
    const releaseLock = this.dependencies.acquirePrefixUpdateLock(prefixInstall.prefix);
    let stagingPrefix: string | undefined;
    try {
      stagingPrefix = this.dependencies.createVersionedPrefixStaging(
        prefixInstall.prefix,
        plan.latestVersion,
      );
      const stagedCommand = buildAtlasCodePackageManagerCommand(
        'npm-prefix',
        plan.latestVersion,
        this.platform,
        this.distribution,
        { ...prefixInstall, prefix: stagingPrefix },
      );
      reportAtlasCodeUpdatePhase(options, 'staging', true);
      this.dependencies.prepareVersionedPrefixStaging(stagingPrefix);
      reportAtlasCodeUpdatePhase(options, 'installing', false);
      await this.dependencies.runPackageManager(stagedCommand, options);
      reportAtlasCodeUpdatePhase(options, 'validating', false);
      const stagedPackage = this.dependencies.readPrefixPackageMetadata(
        stagingPrefix,
        prefixInstall.packageName,
      );
      if (stagedPackage.version !== plan.latestVersion) {
        throw new Error(
          atlascodePrefixStagedVersionMismatchMessage(
            stagedPackage.version,
            plan.latestVersion,
            this.environment,
          ),
        );
      }
      await this.dependencies.validatePrefixPackage(
        stagingPrefix,
        stagedPackage,
        plan.latestVersion,
      );
      reportAtlasCodeUpdatePhase(options, 'activating', false);
      this.dependencies.activateVersionedPrefix({
        stagingPrefix,
        activePrefix: prefixInstall.prefix,
        packageName: prefixInstall.packageName,
        expectedVersion: plan.latestVersion,
        runtimeExecutable: this.runtimeExecutable,
        npmExecutable: prefixInstall.executable,
        registry: prefixInstall.registry,
      });
      reportAtlasCodeUpdatePhase(options, 'completed', false);
      return {
        applied: true,
        restartRequired: false,
        message: atlascodePrefixVersionedInstalledMessage(plan.latestVersion, this.environment),
      };
    } catch (error) {
      if (stagingPrefix) this.dependencies.removePrefixStaging(stagingPrefix);
      throw new Error(
        atlascodePrefixNotStagedMessage(plan.latestVersion, errorMessage(error), this.environment),
        { cause: error },
      );
    } finally {
      releaseLock();
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function packageManagerName(source: AtlasCodePackageManagerInstallSource): string {
  if (source === 'npm-prefix') return 'npm';
  return source.replace('-global', '');
}
