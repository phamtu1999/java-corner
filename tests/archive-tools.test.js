import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateReplay} from '../web/emulator/src/replay-format.js';
import {importRecords} from '../scripts/importers/index.js';
import {teamobiRecord} from '../scripts/importers/teamobi/index.js';
import {giaitriRecord} from '../scripts/importers/giaitri321/index.js';
test('replay accepts only bounded control keys and matching JAR',()=>{
 const sha='a'.repeat(64),r={version:1,sha256:sha,events:[{ms:0,code:38,down:true},{ms:50,code:38,down:false}]};
 assert.equal(validateReplay(r,sha),r);
 for(const events of [[{ms:0,code:49,down:true}],[{ms:0,code:65,down:true}],[{ms:0,code:38,down:true,character:'secret'}],[{ms:60001,code:38,down:true}],[{ms:5,code:38,down:true},{ms:1,code:38,down:false}],Array(501).fill(r.events[0])])assert.throws(()=>validateReplay({...r,events},sha));
 assert.throws(()=>validateReplay(r,'b'.repeat(64)));
});
test('importers normalize sources and reject traversal or invalid archives before publishing',async t=>{
 const root=await mkdtemp(join(tmpdir(),'archive-import-'));t.after(()=>rm(root,{recursive:true,force:true}));
 assert.equal(teamobiRecord({path:'downloads/116-10.jar',page:'https://example.com',version:'1'}).title,'Ninja School Online');
 assert.throws(()=>giaitriRecord({path:'../secret.jar'},root));
 const archive=join(root,'manifest.json');await writeFile(archive,JSON.stringify([{title:'Bad',jar:'../bad.jar',sourceUrl:'',publisher:'',version:'',images:[]} ]));
 await assert.rejects(importRecords('archive',archive),/outside/);
 await writeFile(join(root,'invalid.jar'),'not a jar');await assert.rejects(importRecords('local-folder',root));
 await assert.rejects(importRecords('__proto__',root),/Unknown/);
});
