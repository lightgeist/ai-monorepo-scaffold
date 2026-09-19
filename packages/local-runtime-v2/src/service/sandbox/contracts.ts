import type {
  LocalSandboxBashExecutionPort,
  LocalSandboxBashOperationsFactory,
} from '@atlascode/agent-tools/desktop';

export interface DeferredLocalSandboxBashOperationsFactory extends LocalSandboxBashExecutionPort {
  bind(factory: LocalSandboxBashOperationsFactory): void;
}
