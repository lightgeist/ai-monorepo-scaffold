import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractAtlasCodeToolsArtifact, ATLASCODE_TOOLS_ARTIFACT } from '../scripts/lib/atlascode-tools-artifact.mjs';

test('public archive verifies upstream bytes and yields the exact branded production tool artifact', async () => {
  const archive = readFileSync(new URL('../.cache/artifacts/code-0.3.11.tgz', import.meta.url));
  const extracted = await extractAtlasCodeToolsArtifact(archive);
  const built = readFileSync(new URL('../dist/embedded/atlascode-tools/cli.mjs', import.meta.url));
  assert.deepEqual(extracted.cli, built);
  assert.equal(createHash('sha256').update(built).digest('hex'), extracted.sha256);
  assert.equal(JSON.parse(extracted.manifest).auth.mode, 'shared-broker');
});

test('modified public archives fail before any artifact is accepted', async () => {
  const archive = readFileSync(new URL('../.cache/artifacts/code-0.3.11.tgz', import.meta.url));
  archive[archive.length - 1] ^= 1;
  await assert.rejects(extractAtlasCodeToolsArtifact(archive), /integrity mismatch/);
});

test('the built atlascode-tools CLI starts independently and exposes its commands', () => {
  const cli = fileURLToPath(new URL('../dist/atlascode-tools.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /atlascode-tools/);
});

test('the built image preview worker processes a synthetic PNG and exits cleanly', { timeout: 15000 }, async (t) => {
  const { Worker } = await import('node:worker_threads');
  const worker = new Worker(new URL('../dist/image-preview-worker.js', import.meta.url), {
    workerData: {
      bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGP4n8LwnxLMMGrAqAGjBgwXAwCOqWIfmQV0zAAAAABJRU5ErkJggg==', 'base64'),
      mimeType: 'image/png',
      maxWidth: 960,
    },
  });
  // Allow normal Worker/WASM teardown after the reply. A message alone does
  // not prove a clean exit; force termination is only timeout/failure cleanup.
  t.after(() => worker.terminate());
  const preview = await new Promise((resolve, reject) => {
    let response;
    worker.once('message', (value) => { response = value; });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Preview worker exited with code ${code}`));
      else resolve(response);
    });
  });
  assert.equal(typeof preview, 'string');
  assert.deepEqual([...Buffer.from(preview, 'base64').subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
