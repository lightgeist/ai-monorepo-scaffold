export const TUI_BUNDLE_CHUNKS_DIRECTORY = "chunks";
const TUI_BUNDLE_STABLE_MODULE_URL_IDENTIFIER = "__atlascode_tuiPackageEntryUrl";

export function createTuiBundleModuleLocationConfig() {
  const banner =
    'import { createRequire as __atlascode_cR } from "module"; ' +
    'import { basename as __atlascode_basename, dirname as __atlascode_dirname, join as __atlascode_join } from "path"; ' +
    'import { fileURLToPath as __atlascode_fileURLToPath, pathToFileURL as __atlascode_pathToFileURL } from "url"; ' +
    "const __atlascode_tuiCurrentModuleDir = __atlascode_dirname(__atlascode_fileURLToPath(import.meta.url)); " +
    `const __atlascode_tuiPackageRoot = __atlascode_basename(__atlascode_tuiCurrentModuleDir) === ${JSON.stringify(TUI_BUNDLE_CHUNKS_DIRECTORY)} ? __atlascode_dirname(__atlascode_tuiCurrentModuleDir) : __atlascode_tuiCurrentModuleDir; ` +
    `const ${TUI_BUNDLE_STABLE_MODULE_URL_IDENTIFIER} = __atlascode_pathToFileURL(__atlascode_join(__atlascode_tuiPackageRoot, "cli.js")).href; ` +
    `const require = __atlascode_cR(${TUI_BUNDLE_STABLE_MODULE_URL_IDENTIFIER}); ` +
    "const __dirname = __atlascode_tuiPackageRoot;";
  return {
    banner,
    define: Object.freeze({
      "import.meta.url": TUI_BUNDLE_STABLE_MODULE_URL_IDENTIFIER,
    }),
  };
}
