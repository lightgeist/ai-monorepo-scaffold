import type { ResolvedAgentCapabilities } from '@atlascode/config';

import type { HostedAgentCapabilityRestrictions } from './hosted-agent-capabilities.js';

export function applyHostedCapabilityRestrictions(
  capabilities: ResolvedAgentCapabilities,
  restrictions: HostedAgentCapabilityRestrictions,
): ResolvedAgentCapabilities {
  if (!restrictions.disableAtlasCode) return capabilities;
  return {
    ...capabilities,
    features: {
      ...capabilities.features,
      atlascode: false,
    },
  };
}
