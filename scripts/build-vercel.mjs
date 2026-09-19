import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, basename} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
// Only runtime assets. Never copy data, environment files, downloaded games,
// Java build inputs or obsolete runtime builds into the public deployment.
const entries = ['community','ui','icon.png','sw.js','manifest.webmanifest','offline.html','offline.js','offline.css','pwa-192.png','pwa-512.png',
  'emulator/src','emulator/libjs','emulator/libmedia','emulator/libmidi',
  'emulator/launcher.css','emulator/player.css','emulator/LICENSE.txt',
  'emulator/upstream-source.zip','emulator/freej2me-web.jar',
  'emulator/freej2me-web-relay-v3.jar'];
for (const entry of entries) await cp(resolve(root,'web',entry), resolve(output,entry), {
  recursive:true,
  filter: path => !['test','.DS_Store'].includes(basename(path))
});
console.log('Vercel static assets ready; pages and API are served by api/index.js.');
