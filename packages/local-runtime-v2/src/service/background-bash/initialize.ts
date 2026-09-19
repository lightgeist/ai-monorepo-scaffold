import type { BashEnvPolicy } from '@atlascode/agent-core/bash-subprocess-env';
import type { LocalSandboxBashOperationsFactory } from '@atlascode/agent-tools/desktop';

import { createLocalBackgroundBashExecutor } from './executor.js';

export function initializeLocalBackgroundBashExecutor(
  operationsFactory: LocalSandboxBashOperationsFactory,
  envPolicy: BashEnvPolicy,
) {
  return createLocalBackgroundBashExecutor(operationsFactory, envPolicy);
}
