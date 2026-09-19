import type { AtlasCodeUpdatePlan } from './application.js';

export interface AtlasCodeStartupUpdateNotice {
  readonly latestVersion: string;
}

export function resolveAtlasCodeStartupUpdateNotice(
  plan: AtlasCodeUpdatePlan,
): AtlasCodeStartupUpdateNotice | undefined {
  if (plan.kind !== 'available' && plan.kind !== 'package-manager') return undefined;
  const latestVersion = plan.latestVersion.trim();
  return latestVersion ? { latestVersion } : undefined;
}
