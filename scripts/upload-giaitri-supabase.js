import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Run with: node --env-file-if-exists=.env scripts/upload-giaitri-supabase.js
// Upload only completed inventory entries. Never overwrite a different remote file.
const root = fileURLToPath(new URL('../downloads/giaitri321/', import.meta.url));
const reportPath = resolve(root, 'supabase-upload.json');
const origin = new URL(process.env.SUPABASE_URL);
const key = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;
if (origin.protocol !== 'https:' || !key || !bucket) throw new Error('Missing valid Supabase configuration');
const headers = { apikey: key };
if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
const files = JSON.parse(readFileSync(resolve(root, 'manifest.json'))).files.filter(f => f.status === 'downloaded');
const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath)) : null;
const records = previous?.origin === origin.origin && previous?.bucket === bucket ? previous.files : {};
let stopping = false, cursor = 0, done = 0;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = path => path.split('/').map(encodeURIComponent).join('/');
function persist(running) {
  const selected = files.map(f => records[f.path]).filter(Boolean);
  const verified = selected.filter(f => f.status === 'verified');
  const report = { origin: origin.origin, bucket, prefix: 'giaitri321/', running, updated_at: new Date().toISOString(), total: files.length, verified: verified.length, failed: selected.filter(f => f.status === 'failed').length, bytes: verified.reduce((n, f) => n + f.bytes, 0), files: records };
  writeFileSync(reportPath + '.tmp', JSON.stringify(report, null, 2));
  renameSync(reportPath + '.tmp', reportPath);
}
async function request(path, options = {}) {
  return fetch(new URL('/storage/v1/' + path, origin), { ...options, headers: { ...headers, ...options.headers }, redirect: 'error', signal: AbortSignal.timeout(120000) });
}
async function upload(file) {
  const local = resolve(root, file.path);
  if (relative(root, local).startsWith('..' + sep) || !file.path.endsWith('.jar')) throw new Error('Invalid inventory path');
  const bytes = readFileSync(local);
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Local integrity mismatch');
  const object = 'giaitri321/' + file.path;
  const encoded = encode(bucket + '/' + object);
  // A verified checkpoint can be resumed without writing the same object again.
  if (records[file.path]?.status !== 'verified' || records[file.path]?.sha256 !== file.sha256) {
    const response = await request('object/' + encoded, { method: 'POST', headers: { 'Content-Type': 'application/java-archive', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' }, body: bytes });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status !== 409 && String(error.statusCode) !== '409' && error.error !== 'Duplicate') throw new Error('Upload HTTP ' + response.status);
    } else await response.arrayBuffer();
  }
  const check = await request('object/authenticated/' + encoded);
  if (!check.ok) throw new Error('Verification HTTP ' + check.status);
  const downloaded = Buffer.from(await check.arrayBuffer());
  if (downloaded.length !== bytes.length || digest(downloaded) !== file.sha256) throw new Error('Remote integrity mismatch; not overwritten');
  records[file.path] = { status: 'verified', object, bytes: bytes.length, sha256: file.sha256, verified_at: new Date().toISOString() };
}
const bucketResponse = await request('bucket/' + encodeURIComponent(bucket));
if (!bucketResponse.ok) throw new Error('Bucket HTTP ' + bucketResponse.status);
await bucketResponse.arrayBuffer();
persist(true);
try {
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (!stopping && cursor < files.length) {
      const file = files[cursor++];
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await upload(file); failure = null; break; }
        catch (error) {
          failure = /^(Upload HTTP|Verification HTTP|Local integrity|Remote integrity|Invalid inventory)/.test(error.message) ? error.message : 'Network or file read error';
          if (stopping || failure.includes('integrity') || failure.includes('Invalid')) break;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      if (failure) records[file.path] = { status: 'failed', error: failure };
      done++; persist(true);
      if (done % 20 === 0 || failure) console.log(JSON.stringify({ processed: done, total: files.length, failed: Object.values(records).filter(r => r.status === 'failed').length }));
    }
  }));
} finally { persist(false); }
const result = JSON.parse(readFileSync(reportPath));
console.log(JSON.stringify({ total: result.total, verified: result.verified, failed: result.failed, bytes: result.bytes, paused: stopping }));
if (result.failed || result.verified !== result.total) process.exitCode = 1;
