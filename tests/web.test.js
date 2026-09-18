import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import handler from 'serve-handler';
import { codeMap } from '../web/emulator/src/key.js';

test('game URLs retain parameters, binary ranges work, keypad keys are mapped', async () => {
  const config = JSON.parse(await readFile(new URL('../web/serve.json', import.meta.url)));
  const server = createServer((req, res) => handler(req, res, { ...config, public: 'web' }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('cache-control'), /must-revalidate/);
    assert.match(await home.text(), /Java Corner/);
    for (const asset of ['/ui/site.css?v=20260916-3', '/community/community.css?v=20260916-3', '/emulator/launcher.css?v=20260916-3', '/ui/site.js?v=20260916-3']) {
      const response = await fetch(base + asset);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /must-revalidate/);
      await response.arrayBuffer();
    }
    const manager = await fetch(`${base}/emulator/index.html`);
    assert.equal(manager.status, 200);
    assert.match(await manager.text(), /Xuất bản lưu/);
    const page = await fetch(`${base}/emulator/run.html?app=test-game&mobile=1`, { redirect: 'manual' });
    assert.equal(page.status, 200, 'must not redirect and drop game parameters');
    const html = await page.text();
    for (const [, key] of html.matchAll(/data-key="([^"]+)"/g)) {
      assert.ok(key === 'Maximize' || codeMap[key], `unmapped control: ${key}`);
    }
    for (const path of ['/emulator/freej2me-web.jar']) {
      const res = await fetch(base + path, { headers: { Range: 'bytes=0-3' } });
      assert.equal(res.status, 206);
      assert.match(res.headers.get('content-range'), /^bytes 0-3\//);
      assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [80, 75, 3, 4]);
    }
    for (const path of ['/emulator/libmidi/libmidi.wasm', '/emulator/libmedia/transcode/transcode.wasm']) {
      const res = await fetch(base + path, { headers: { Range: 'bytes=0-3' } });
      assert.equal(res.headers.get('content-type'), 'application/wasm');
      assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [0, 97, 115, 109]);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
