import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRequire = createRequire(import.meta.url);
const ATLASCODE_PACKAGE_JSON = '@atlascode/atlascode/package.json';

export interface NativeModuleCandidateOptions {
  moduleUrl?: string;
  execPath?: string;
  resolvePackage?: (specifier: string) => string;
}

export function getNativeModuleCandidates(
  nativePath: string,
  options: NativeModuleCandidateOptions = {},
): string[] {
  const moduleDir = dirname(fileURLToPath(options.moduleUrl ?? import.meta.url));
  const candidates: string[] = [];

  try {
    const packageJson = (options.resolvePackage ?? moduleRequire.resolve)(ATLASCODE_PACKAGE_JSON);
    candidates.push(join(dirname(packageJson), nativePath));
  } catch {
    // Standalone binaries do not have an installed @atlascode/atlascode package.
  }

  candidates.push(
    join(moduleDir, '..', nativePath),
    join(moduleDir, nativePath),
    join(dirname(options.execPath ?? process.execPath), nativePath),
  );
  return Array.from(new Set(candidates));
}
