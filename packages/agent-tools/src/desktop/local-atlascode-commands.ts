/**
 * Desktop atlascode subcommand vocabulary: single source of truth.
 *
 * A separate module lets `builtin-defs.ts` (definitions) and `local-atlascode.ts` (dispatcher) share
 * the command list without an import cycle. `local-atlascode.ts` depends on `LocalAtlasCodeToolDef` in
 * builtin-defs.ts, so the vocabulary cannot live in the dispatcher.
 *
 * When adding a subcommand, update:
 * 1. `LOCAL_ATLASCODE_COMMANDS` here.
 * 2. `COMMAND_SCHEMAS` and `HANDLERS` in `local-atlascode.ts`.
 * 3. The command list in `LocalAtlasCodeToolDef.schema.properties.command.description` in
 *   `builtin-defs.ts`.
 *
 * Type constraints in `local-atlascode.ts` cause compilation to fail if 1 and 2 drift.
 */

export const LOCAL_ATLASCODE_COMMANDS = [
  'agent list',
  'agent get',
  'agent create',
  'agent update',
  'agent delete',
  'agent help',

  'cron list',
  'cron get',
  'cron resolve-model',
  'cron create',
  'cron self',
  'cron once',
  'cron update',
  'cron delete',
  'cron trigger',
  'cron sessions',
  'cron help',

  'session list',
  'session get',
  'session send',
  'session update',
  'session delete',
  'session messages',
  'session help',

  'mcp list',
  'mcp get',
  'mcp create',
  'mcp update',
  'mcp delete',
  'mcp help',
] as const;

export type LocalAtlasCodeCommandName = (typeof LOCAL_ATLASCODE_COMMANDS)[number];
