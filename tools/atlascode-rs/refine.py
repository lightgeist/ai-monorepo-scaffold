#!/usr/bin/env python3
"""Repairs discovered by native qualification; retains production SDK semantics."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(sys.argv[1]).resolve()
PIN='ddcf1eb5513b02ca2a68964220f115da0a69a80a'
def edit(path,before,after):
 p=ROOT/path;s=p.read_text();n=s.count(before)
 if n != 1:raise RuntimeError(f'{path}: expected one replacement, got {n}: {before!r}')
 p.write_text(s.replace(before,after),encoding='utf-8',newline='\n')
if '--finalize' in sys.argv:
 originals=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',PIN]).decode().split('\0')[:-1]
 current={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.relative_to(ROOT).parts}
 changes=[]
 for rel in sorted(set(originals)|current):
  if rel=='REBRAND-LEDGER.json':continue
  before=subprocess.check_output(['git','-C',str(ROOT),'show',f'{PIN}:{rel}']) if rel in originals else None
  after=(ROOT/rel).read_bytes() if rel in current else None
  if before==after:continue
  changes.append({'path':rel,'change':'added' if before is None else 'removed' if after is None else 'modified',
   'upstream_sha256':hashlib.sha256(before).hexdigest() if before is not None else None,
   'fork_sha256':hashlib.sha256(after).hexdigest() if after is not None else None})
 (ROOT/'REBRAND-LEDGER.json').write_text(json.dumps({'schema':'atlascode-rs-rebrand-ledger/v2','upstream_commit':PIN,'self_excluded':'REBRAND-LEDGER.json','changes':changes},indent=2)+'\n')
 print(f'Finalized {len(changes)} added/modified/removed paths after formatting.')
 sys.exit(0)

p=ROOT/'agent-sdk/package.json';obj=json.loads(p.read_text())
assert obj['scripts']['test']=='npm run build && node --test dist/**/*.test.js'
obj['scripts']['test']='npm run build && node --test "dist/**/*.test.js"'
p.write_text(json.dumps(obj,indent=2)+'\n')
edit('agent-sdk/src/bridge.contract.test.ts',
 'return specifier === "@anthropic-ai/claude-agent-sdk"\n        ?',
 'return specifier === "@anthropic-ai/claude-agent-sdk" && context.conditions.includes("import")\n        ?')
edit('src/app/events/tests/client_events.rs','releases/tag/v0.3.0','releases/tag/atlascode-rs-v0.3.0')
edit('src/ui/inline_chat_rows.rs','line.contains("_~^~^~_")','line.contains(r"/_/  \\_\\")')
edit('src/ui/footer_rows.rs',
 'let fitted = fit_footer_suffix_text(text, 14).expect("fitted text");\n        assert!(fitted.starts_with("..."));\n        assert!(fitted.ends_with("atlascode_rs"));\n        assert!(UnicodeWidthStr::width(fitted.as_str()) <= 14);',
 'let width = UnicodeWidthStr::width("atlascode_rs") + 3;\n        let fitted = fit_footer_suffix_text(text, width).expect("fitted text");\n        assert!(fitted.starts_with("..."));\n        assert!(fitted.ends_with("atlascode_rs"));\n        assert!(UnicodeWidthStr::width(fitted.as_str()) <= width);')

p='scripts/install/smoke-install-archive.mjs'
edit(p,'import { envWithoutSystemRuntimePath }','import { envWithoutSystemRuntimePath, resolveExecutablesOnPath }')
edit(p,'options.noSystemRuntime ? envWithoutSystemRuntimePath() : { ...process.env }','options.noSystemRuntime ? portableEnvironment() : { ...process.env }')
edit(p,'  printCommandOutput("atlascode-rs --version", versionOutput);',
 '''  if (versionOutput.stdout.trim() !== `atlascode-rs ${version}`) {
    throw new Error(`Packaged identity/version mismatch: ${versionOutput.stdout}`);
  }
  printCommandOutput("atlascode-rs --version", versionOutput);''')
edit(p,'  runBridgeRuntimeContract(doctorDetails.runtimePath, doctorDetails.bridgeScriptPath, appRoot);',
 '''  runBridgeRuntimeContract(doctorDetails.runtimePath, doctorDetails.bridgeScriptPath, appRoot, commandState.env);
  assertMissingOwnedFileFails(commandState, doctorDetails.runtimePath, "bridge_runtime");
  assertMissingOwnedFileFails(commandState, doctorDetails.bridgeScriptPath, "bridge_script");''')
edit(p,'function runBridgeRuntimeContract(runtimePath, bridgeScriptPath, appRoot) {','function runBridgeRuntimeContract(runtimePath, bridgeScriptPath, appRoot, env) {')
edit(p,'    cwd: appRoot,\n    stdio: "inherit",','    cwd: appRoot,\n    env,\n    stdio: "inherit",')
addition=r'''

// The verification harness uses an absolute Node path; the app and Bun child
// receive a PATH from which *both* system runtimes have been removed.
function portableEnvironment() {
  const env = envWithoutSystemRuntimePath();
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === "path") ?? "PATH";
  const blocked = new Set();
  for (const executable of resolveExecutablesOnPath("node", env, process.platform, { includeWhere: false })) {
    blocked.add(normalizePathForCompare(path.dirname(executable.path)));
    if (executable.realPath) blocked.add(normalizePathForCompare(path.dirname(executable.realPath)));
  }
  env[pathKey] = (env[pathKey] ?? "").split(path.delimiter)
    .filter(entry => entry && !blocked.has(normalizePathForCompare(entry))).join(path.delimiter);
  for (const command of ["node", "bun"]) {
    if (resolveExecutablesOnPath(command, env, process.platform, { includeWhere: false }).length) {
      throw new Error(`Portable test PATH still exposes ${command}`);
    }
  }
  for (const key of ["ATLASCODE_RS_AGENT_BRIDGE", "ATLASCODE_RS_AGENT_BRIDGE_RUNTIME", "NODE_OPTIONS"]) delete env[key];
  console.log("Verified application PATH has no system Node.js or Bun executable.");
  return env;
}

function assertMissingOwnedFileFails(commandState, filename, checkId) {
  const hidden = `${filename}.qualification-missing`;
  if (fs.existsSync(hidden)) throw new Error(`Unexpected negative-control path: ${hidden}`);
  fs.renameSync(filename, hidden);
  try {
    let result;
    try {
      execFileSync(commandState.command, commandState.args(["doctor", "--json", "--strict"]), {
        cwd: commandState.cwd, env: commandState.env, encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
    } catch (error) { result = error; }
    if (!result || result.status !== 1) throw new Error(`${checkId} missing-file control did not fail with status 1`);
    const report = JSON.parse(bufferToString(result.stdout));
    const check = report.checks?.find(entry => entry.id === checkId);
    if (check?.status !== "fail" || check.hard_failure !== true) {
      throw new Error(`${checkId} missing-file control did not fail its owned-path check`);
    }
    console.log(`Negative control passed: missing ${checkId} fails closed without a system-runtime fallback.`);
  } finally {
    fs.renameSync(hidden, filename);
  }
}
'''
with (ROOT/p).open('a') as f:f.write(addition)
edit('tools/verify-brand.py','report={\'schema\':',
 '''check('Bridge tests use a quoted recursive glob', json.loads(text('agent-sdk/package.json'))['scripts']['test'] == 'npm run build && node --test "dist/**/*.test.js"')
report={'schema':''')
with (ROOT/'CHANGELOG.md').open('a') as f:f.write('''
### Qualification repairs

The full native gate caught three stale branding assertions (release URL, mark,
and truncated path width); they now verify the new identities. Bridge test
selection now quotes its recursive glob so Unix and Windows execute the same
439-test suite rather than omitting the root tests on Unix. The external-SDK
fixture intercepts ESM imports only, keeping the production version lookup real.
Portable verification removes both system runtimes from the app PATH, executes
the real binary/bridge and checks missing-runtime/script failure controls.
These verification changes do not alter SDK, permissions, model routing or billing.
''')
print('Applied native-discovered test repairs and stronger real portable runtime qualification.')
