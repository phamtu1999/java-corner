import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {inspectJar} from '../server/jar-inspector.js';

test('inspector reads static hints and skips oversized decompression',async()=>{
  const result=await inspectJar(fileURLToPath(new URL('./fixtures/inspector.jar',import.meta.url)));
  assert.equal(result.classes,1);assert.equal(result.resources,3);
  assert.equal(result.manifest['midlet-vendor'],'Acme');
  assert.equal(result.manifest['midlet-version'],'1.2');
  assert.deepEqual(result.resolutionHints,['240x320']);
  assert.deepEqual(result.endpoints,['socket://game.example:14444','https://example.test/login']);
  assert.equal(result.permissions[0].name,'javax.wireless.messaging.sms.send');
  assert.equal(result.scanLimited,true);
  assert.match(result.compatibility,/Chưa chạy thử/);
});
