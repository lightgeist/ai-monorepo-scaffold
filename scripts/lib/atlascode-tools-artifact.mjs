import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Parser } from 'tar';

export const ATLASCODE_TOOLS_ARTIFACT = Object.freeze({
  url: 'https://registry.npmjs.org/@minimax-ai/code/-/code-0.3.11.tgz',
  integrity: 'sBOd8yvQRVuQNoGvzCDwXKaj5rQxLI3gKnojWS4+0wnMU9IXtxObSqbfBxz30Lze/zitRtSG2v76iJGHOmHRUA==',
  version: '0.0.4',
  sourceSha256: 'e5a59ec5362e395b519317ad6fecd99f6e92308b9d985be44b64eb2f2b73a722',
});

// Verify the pinned original bytes before applying the product-identity-only map.
// Vendored Pi is not part of this helper and is never changed here.
export function rebrandEmbeddedToolCli(bytes) {
  const protectedText = [];
  let text = bytes.toString('utf8').replace(/https?:\/\/[^\s"'`<>\\]+|mcode_tool|mcode-public|mcode-internal/g, value => {
    protectedText.push(value);
    return `\uFFF0KEEP${protectedText.length - 1}\uFFF1`;
  });
  for (const [oldName, newName] of [
    ['@minimax/mcode-tools', '@atlascode/atlascode-tools'],
    ['@mavis/', '@atlascode/'],
    ['__MAVIS_MCODE_TOOLS', '__ATLASCODE_TOOLS'],
    ['MAVIS_REGION', 'ATLASCODE_RUNTIME_REGION'],
    ['MAVIS_DATA_DIR', 'ATLASCODE_RUNTIME_DATA_DIR'],
    ['MCode', 'AtlasCode'], ['Mcode', 'AtlasCode'],
    ['MCODE', 'ATLASCODE'], ['mcode', 'atlascode'],
    ['Mavis', 'AtlasCode'], ['MAVIS', 'ATLASCODE'], ['mavis', 'atlascode'],
    ['.minimax', '.atlascode'],
  ]) text = text.split(oldName).join(newName);
  for (let i = protectedText.length - 1; i >= 0; i--)
    text = text.split(`\uFFF0KEEP${i}\uFFF1`).join(protectedText[i]);
  return Buffer.from(text, 'utf8');
}

export async function extractAtlasCodeToolsArtifact(bytes) {
  if (createHash('sha512').update(bytes).digest('base64') !== ATLASCODE_TOOLS_ARTIFACT.integrity)
    throw new Error('Public AtlasCode archive integrity mismatch.');
  const files = new Map();
  const prefix = 'package/embedded/mcode-tools/';
  await new Promise((resolve, reject) => {
    const parser = new Parser({
      strict: true,
      onReadEntry(entry) {
        if (![`${prefix}cli.mjs`, `${prefix}manifest.json`, 'package/THIRD_PARTY_NOTICES.md'].includes(entry.path)) {
          entry.resume();
          return;
        }
        if (entry.type !== 'File' || files.has(entry.path)) {
          reject(new Error('Unexpected atlascode-tools archive entry.'));
          entry.resume();
          return;
        }
        const chunks = [];
        entry.on('data', chunk => chunks.push(chunk));
        entry.on('end', () => files.set(entry.path, Buffer.concat(chunks)));
      },
    });
    parser.on('error', reject);
    parser.on('end', resolve);
    Readable.from([bytes]).pipe(parser);
  });
  const cli = files.get(`${prefix}cli.mjs`);
  const manifestBytes = files.get(`${prefix}manifest.json`);
  const notices = files.get('package/THIRD_PARTY_NOTICES.md');
  if (!cli || !manifestBytes || !notices) throw new Error('Public archive is missing atlascode-tools or its notices.');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.version !== ATLASCODE_TOOLS_ARTIFACT.version || manifest.buildEnv !== 'prod' ||
      manifest.entry !== 'cli.mjs' || manifest.packageName !== '@minimax/mcode-tools' ||
      createHash('sha256').update(cli).digest('hex') !== ATLASCODE_TOOLS_ARTIFACT.sourceSha256)
    throw new Error('Embedded atlascode-tools manifest or entry integrity mismatch.');
  if (manifest.auth?.protocol?.name !== '@mavis/oauth-lease-protocol' ||
      manifest.auth?.protocol?.wireVersion !== 1 || manifest.auth?.mode !== 'shared-broker')
    throw new Error('Unexpected embedded tool authentication contract.');
  const brandedCli = rebrandEmbeddedToolCli(cli);
  const brandedSha = createHash('sha256').update(brandedCli).digest('hex');
  manifest.packageName = '@atlascode/atlascode-tools';
  manifest.auth.protocol.name = '@atlascode/oauth-lease-protocol';
  manifest.resources = manifest.resources.map(resource =>
    resource.path === 'cli.mjs' ? { ...resource, sha256: brandedSha } : resource);
  return { cli: brandedCli, sha256: brandedSha, manifest: Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), notices };
}

export async function copyAtlasCodeToolsArtifact(root, outdir, fetchImpl = fetch) {
  const cache = path.join(root, '.cache', 'artifacts', 'code-0.3.11.tgz');
  let bytes;
  try { bytes = await readFile(cache); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetchImpl(ATLASCODE_TOOLS_ARTIFACT.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Cannot download public atlascode-tools artifact: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const artifact = await extractAtlasCodeToolsArtifact(bytes);
  await mkdir(path.dirname(cache), { recursive: true });
  await writeFile(cache, bytes);
  const destination = path.join(outdir, 'embedded', 'atlascode-tools');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'cli.mjs'), artifact.cli);
  await writeFile(path.join(destination, 'manifest.json'), artifact.manifest);
  await writeFile(path.join(outdir, 'ATLASCODE_TOOLS_NOTICES.md'), artifact.notices);
}
