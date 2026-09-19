export const ATLASCODE_DEFAULT_AGENT_NAME = 'atlascode';

export interface TuiProductContext {
  surface: 'cli' | 'tui' | 'headless';
  defaultAgentName: string;
}

export function createTuiProductContext(
  surface: TuiProductContext['surface'],
  overrides: Partial<Pick<TuiProductContext, 'defaultAgentName'>> = {},
): TuiProductContext {
  return {
    surface,
    defaultAgentName: overrides.defaultAgentName ?? ATLASCODE_DEFAULT_AGENT_NAME,
  };
}
