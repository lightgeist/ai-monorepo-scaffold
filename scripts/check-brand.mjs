/** Frozen, line-specific legacy-identity audit; never generates its own exceptions. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const digest = b => createHash('sha256').update(b).digest('hex');
const legacy = /minimax|mcode|mavis/i;
const skip = new Set(['.git', 'node_modules', 'dist', '.cache', '.pnpm-store', '.turbo']);
const allow = JSON.parse(readFileSync(path.join(root, 'release/branding/source-allowlist.json'), 'utf8'));
const accepted = new Set(allow.entries.map(e => `${e.path}\0${e.lineSha256}`));
const vendors = JSON.parse(readFileSync(path.join(root, 'release/branding/vendor-sha256.json'), 'utf8'));
const failures = []; let checkedFiles = 0, retainedLines = 0;
function walk(dir, prefix = '') {
  for (const e of readdirSync(dir, {withFileTypes:true})) {
    if (skip.has(e.name) || e.name.endsWith('.tsbuildinfo')) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isSymbolicLink()) { failures.push(`Unreviewed symlink: ${rel}`); continue; }
    if (e.isDirectory()) { walk(abs, rel); continue; }
    checkedFiles++;
    const bytes = readFileSync(abs);
    if (rel.startsWith('third_party/')) {
      if (vendors[rel] !== digest(bytes)) failures.push(`Vendored file changed or added: ${rel}`);
      continue;
    }
    // These two machine manifests are the explicit evidence, not application text.
    if (['release/branding/source-allowlist.json', 'release/branding/vendor-sha256.json'].includes(rel)) continue;
    if (bytes.includes(0)) continue;
    for (const [i,line] of bytes.toString('utf8').split(/\r?\n/).entries()) {
      if (!legacy.test(line)) continue;
      retainedLines++;
      if (!accepted.has(`${rel}\0${digest(line)}`)) failures.push(`${rel}:${i+1}: ${line.slice(0,180)}`);
    }
  }
}
walk(root);
for (const rel of Object.keys(vendors)) if (!existsSync(path.join(root, rel))) failures.push(`Vendored file missing: ${rel}`);
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',checkedFiles,retainedLines,vendorFiles:Object.keys(vendors).length,unreviewed:failures},null,2));
if (failures.length) process.exitCode=1;
