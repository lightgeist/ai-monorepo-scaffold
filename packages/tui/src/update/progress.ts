export type AtlasCodeUpdatePhase =
  | 'checking'
  | 'downloading'
  | 'staging'
  | 'installing'
  | 'validating'
  | 'activating'
  | 'completed';

export interface AtlasCodeUpdatePhaseEvent {
  readonly phase: AtlasCodeUpdatePhase;
  readonly cancellable: boolean;
}

export interface AtlasCodeUpdateOperationOptions {
  readonly signal?: AbortSignal;
  readonly onOutput?: (chunk: string) => void;
  readonly onPhase?: (event: AtlasCodeUpdatePhaseEvent) => void;
}

export class AtlasCodeUpdateCancelledError extends Error {
  constructor(message = 'AtlasCode update cancelled; the previous installation remains active.') {
    super(message);
    this.name = 'AtlasCodeUpdateCancelledError';
  }
}

export class AtlasCodeUpdateAdmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasCodeUpdateAdmissionError';
  }
}

export function throwIfAtlasCodeUpdateCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AtlasCodeUpdateCancelledError();
}

export function reportAtlasCodeUpdatePhase(
  options: Pick<AtlasCodeUpdateOperationOptions, 'onPhase'>,
  phase: AtlasCodeUpdatePhase,
  cancellable: boolean,
): void {
  try {
    options.onPhase?.({ phase, cancellable });
  } catch {
    // Presentation observers must not change update safety or outcome.
  }
}

export function isAtlasCodeUpdateCancelledError(error: unknown): error is AtlasCodeUpdateCancelledError {
  return error instanceof AtlasCodeUpdateCancelledError;
}

export function isAtlasCodeUpdateAdmissionError(error: unknown): error is AtlasCodeUpdateAdmissionError {
  return error instanceof AtlasCodeUpdateAdmissionError;
}
