import type { PluginHookDiagnostic } from '@atlascode/plugin-hooks';

import type { PluginReaderDiagnostic } from '../types.js';

export function projectPluginHookDiagnostics(
  diagnostics: readonly PluginHookDiagnostic[],
): PluginReaderDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    capability: 'HOOK',
    name: diagnostic.event ?? diagnostic.sourcePath,
  }));
}
