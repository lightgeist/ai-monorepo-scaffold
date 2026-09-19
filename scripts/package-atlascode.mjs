import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
function installedManifest(name) {
  const roots = ['', ...JSON.parse(readFileSync(path.join(root, 'release/extraction.json'), 'utf8')).packageRoots];
  for (const importer of roots) {
    const localRequire = createRequire(path.join(root, importer, 'package.json'));
    for (const modules of localRequire.resolve.paths(name) ?? []) {
      const candidate = path.join(modules, name, 'package.json');
      if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8'));
    }
  }
  throw new Error(`Missing installed package: ${name}`);
}
const output = path.resolve(process.argv[2] ?? path.join(root, 'artifacts'));
const stage = path.join(output, 'npm-stage');
mkdirSync(output, { recursive: true });
rmSync(stage, { recursive: true, force: true });
cpSync(path.join(root, 'dist'), stage, { recursive: true });
rmSync(path.join(stage, 'metafile.json'), { force: true });
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const manifest = {
  name: '@deepintuition/atlascode', version,
  description: 'AtlasCode by Deep Intuition — terminal coding agent',
  type: 'module', bin: { atlascode: './cli.js' }, license: 'MIT',
  engines: { node: '>=22.19 <23 || >=24.2 <27' },
  dependencies: {}, optionalDependencies: {},
};
for (const name of ['better-sqlite3', '@larksuiteoapi/node-sdk']) {
  const p = installedManifest(name);
  manifest.dependencies[name] = p.version;
}
for (const name of ['@mariozechner/clipboard', '@vscode/ripgrep']) {
  const p = installedManifest(name);
  manifest.optionalDependencies[name] = p.version;
}
writeFileSync(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'README.md']) {
  cpSync(path.join(root, name), path.join(stage, name));
}
const packed = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', stage, '--pack-destination', output, '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout);
const result = JSON.parse(packed.stdout);
writeFileSync(path.join(output, 'npm-pack.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ tarball: path.join(output, result[0].filename), sha512: result[0].integrity, files: result[0].entryCount }, null, 2));
