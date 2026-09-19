import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jarDiff,preservationScore} from '../server/preservation.js';
test('preservation score uses evidence, diff covers entries beyond display samples',()=>{
 assert.equal(preservationScore({},null,{}).percent,0);
 const a={entries:[{name:'A.class',crc:1,size:2},{name:'old.png',crc:2,size:3}],endpoints:['socket://old'],scanLimited:false};
 const b={entries:[{name:'A.class',crc:3,size:2},{name:'new.class',crc:2,size:3}],endpoints:['socket://new'],scanLimited:true};
 const d=jarDiff(a,b);assert.deepEqual(d.added,['new.class']);assert.deepEqual(d.removed,['old.png']);assert.deepEqual(d.changed,['A.class']);assert.equal(d.partial,true);
 assert.throws(()=>jarDiff({},b),/Inspector/);
});
