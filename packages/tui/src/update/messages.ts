import { translateRuntimeText } from '@atlascode/shared/runtime-i18n';

export function atlascodePrefixActivationScheduledMessage(
  _environment: NodeJS.ProcessEnv = process.env,
): string {
  return 'A staged AtlasCode update will activate after this process exits.';
}

export function atlascodePrefixJournalScheduleFailedMessage(
  _environment: NodeJS.ProcessEnv = process.env,
): string {
  return 'AtlasCode update was staged, but its activation journal could not be scheduled.';
}

export function atlascodePrefixNonPrefixPlanMessage(_environment: NodeJS.ProcessEnv): string {
  return 'AtlasCode npm prefix updater received a non-prefix plan.';
}

export function atlascodePrefixOwnershipMissingMessage(_environment: NodeJS.ProcessEnv): string {
  return 'AtlasCode npm prefix ownership metadata is missing.';
}

export function atlascodePrefixPendingActivationMessage(
  version: string,
  options: {
    readonly blockingSessionCount?: number;
    readonly environment?: NodeJS.ProcessEnv;
  } = {},
): string {
  if (options.blockingSessionCount === undefined) {
    return `AtlasCode ${version} is already staged. Restarting will resume activation after running AtlasCode sessions exit.`;
  }
  const blockingSessionCount = Math.max(0, Math.trunc(options.blockingSessionCount));
  if (blockingSessionCount > 0) {
    return `AtlasCode ${version} is already staged. Activation will wait for ${String(blockingSessionCount)} other AtlasCode ${blockingSessionCount === 1 ? 'session' : 'sessions'} to exit.`;
  }
  return `AtlasCode ${version} is already staged. It will activate after this process exits.`;
}

export function atlascodePrefixPendingCleanupMessage(
  version: string,
  options: {
    readonly blockingSessionCount?: number;
    readonly environment?: NodeJS.ProcessEnv;
  } = {},
): string {
  if (options.blockingSessionCount === undefined) {
    return `AtlasCode ${version} is already active. Restarting will finish update cleanup after running AtlasCode sessions exit.`;
  }
  const blockingSessionCount = Math.max(0, Math.trunc(options.blockingSessionCount));
  if (blockingSessionCount > 0) {
    return `AtlasCode ${version} is already active. Update cleanup will wait for ${String(blockingSessionCount)} other AtlasCode ${blockingSessionCount === 1 ? 'session' : 'sessions'} to exit.`;
  }
  return `AtlasCode ${version} is already active. Restarting will finish update cleanup.`;
}

export function atlascodePrefixStagedVersionMismatchMessage(
  actualVersion: string,
  expectedVersion: string,
  _environment: NodeJS.ProcessEnv,
): string {
  return `AtlasCode update staged ${actualVersion}; expected ${expectedVersion}.`;
}

export function atlascodePrefixStagedMessage(
  version: string,
  options: {
    readonly blockingSessionCount?: number;
    readonly environment?: NodeJS.ProcessEnv;
  } = {},
): string {
  if (options.blockingSessionCount === undefined) {
    return `AtlasCode ${version} is downloaded and staged safely. Waiting for running AtlasCode sessions to exit before activation.`;
  }
  const blockingSessionCount = Math.max(0, Math.trunc(options.blockingSessionCount));
  if (blockingSessionCount > 0) {
    return `AtlasCode ${version} is downloaded and staged safely. Waiting for ${String(blockingSessionCount)} other AtlasCode ${blockingSessionCount === 1 ? 'session' : 'sessions'} to exit before activation.`;
  }
  return `AtlasCode ${version} is downloaded and staged safely. It will activate after this process exits.`;
}

export function atlascodePrefixVersionedInstalledMessage(
  version: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const locale = environment.LC_ALL || environment.LC_MESSAGES || environment.LANG;
  return translateRuntimeText(locale, 'update.versionedInstalled').replace('{version}', version);
}

export function atlascodePrefixNotStagedMessage(
  version: string,
  reason: string,
  _environment: NodeJS.ProcessEnv,
): string {
  return `AtlasCode ${version} was not staged; the active installation is unchanged: ${reason}`;
}
