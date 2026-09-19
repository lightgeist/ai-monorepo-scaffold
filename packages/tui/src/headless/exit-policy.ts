import { TuiFailure } from '../failure.js';
import type { ExecResult } from './contract.js';

export const ATLASCODE_EXEC_EXIT_CODES = Object.freeze({
  success: 0,
  invocation: 2,
  config: 3,
  runtime: 4,
  timeout: 6,
  limit: 7,
  internal: 70,
  cancelled: 130,
  brokenPipe: 141,
});

export type TuiExecErrorKind = keyof Pick<
  typeof ATLASCODE_EXEC_EXIT_CODES,
  'invocation' | 'config' | 'runtime' | 'internal' | 'cancelled' | 'brokenPipe'
>;

export class TuiExecError extends TuiFailure {
  constructor(
    public readonly kind: TuiExecErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(kind, message, {
      code: `exec.${kind}`,
      retryable: kind === 'runtime',
      ...options,
    });
    this.name = 'TuiExecError';
  }
}

export function exitCodeForExecResult(result: ExecResult): number {
  switch (result.status) {
    case 'succeeded':
      return ATLASCODE_EXEC_EXIT_CODES.success;
    case 'failed':
      if (result.error?.category === 'config') return ATLASCODE_EXEC_EXIT_CODES.config;
      if (result.error?.category === 'internal') return ATLASCODE_EXEC_EXIT_CODES.internal;
      return ATLASCODE_EXEC_EXIT_CODES.runtime;
    case 'timeout':
      return ATLASCODE_EXEC_EXIT_CODES.timeout;
    case 'cancelled':
      return ATLASCODE_EXEC_EXIT_CODES.cancelled;
    case 'limit_exceeded':
      return ATLASCODE_EXEC_EXIT_CODES.limit;
  }
  return ATLASCODE_EXEC_EXIT_CODES.internal;
}

export function exitCodeForExecError(error: unknown): number {
  if (error instanceof TuiExecError) {
    return ATLASCODE_EXEC_EXIT_CODES[error.kind];
  }
  return ATLASCODE_EXEC_EXIT_CODES.internal;
}
