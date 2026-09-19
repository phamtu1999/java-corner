import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyArchive} from '../server/verify-archive.js';
import {readFile} from 'node:fs/promises';
test('remote Inspector returns static report only after hash verification',async()=>{
 const bytes=await readFile(new URL('./fixtures/inspector.jar',import.meta.url));
 const hash=createHash('sha256').update(bytes).digest('hex');
 const result=await verifyArchive('https://storage.test/a',hash,async()=>new Response(bytes),'game240x320.jar');
 assert.equal(result.inspection.manifest['midlet-vendor'],'Acme');
 assert.equal(result.inspection.sha256,hash);
 assert.equal(result.inspection.scanLimited,true);
 await assert.rejects(verifyArchive('https://storage.test/a','bad',async()=>new Response(bytes),'game.jar'),/SHA-256/);
});
test('remote archive verification rejects HTTP errors, oversized responses, hash mismatch and invalid JAR',async()=>{
 await assert.rejects(verifyArchive('https://storage.test/a','',async()=>new Response('',{status:404})),/Không tải/);
 await assert.rejects(verifyArchive('https://storage.test/a','',async()=>new Response('',{headers:{'content-length':String(51*1048576)}})),/50 MB/);
 await assert.rejects(verifyArchive('https://storage.test/a','bad',async()=>new Response('bad')),/SHA-256/);
 const hash=createHash('sha256').update('bad').digest('hex');
 await assert.rejects(verifyArchive('https://storage.test/a',hash,async(url,opts)=>{assert.equal(opts.redirect,'error');return new Response('bad');}),/JAR/);
});

test('valid remote Java ME archive matches its registered digest',async()=>{const bytes=Buffer.from('UEsDBBQAAAAIAIyUMF0C6Ce+OgAAAGUAAAAUAAAATUVUQS1JTkYvTUFOSUZFU1QuTUbzTczLTEstLtENSy0qzszPs1Iw1DPg8vV0yUkt0fVLzE21UggBSsNEDCFcHR1kQWxaw1LzUvKLoJoBUEsDBBQAAAAIAIyUMF0dVx21BgAAAAQAAAAKAAAAVGVzdC5jbGFzczv1b9c+AFBLAQIUAxQAAAAIAIyUMF0C6Ce+OgAAAGUAAAAUAAAAAAAAAAAAAACAAQAAAABNRVRBLUlORi9NQU5JRkVTVC5NRlBLAQIUAxQAAAAIAIyUMF0dVx21BgAAAAQAAAAKAAAAAAAAAAAAAACAAWwAAABUZXN0LmNsYXNzUEsFBgAAAAACAAIAegAAAJoAAAAAAA==','base64');const hash=createHash('sha256').update(bytes).digest('hex');const result=await verifyArchive('https://storage.test/a',hash,async()=>new Response(bytes));assert.equal(result.size,bytes.length);assert.equal(result.sha256,hash);});
