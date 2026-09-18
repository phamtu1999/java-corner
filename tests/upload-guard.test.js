import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {uploadGuard,mediaQuota} from '../server/upload-guard.js';
function response(){const r=new EventEmitter();r.status=n=>{r.code=n;return r;};r.json=()=>r;return r;}
test('upload guard bounds concurrency and releases once',()=>{
 const guard=uploadGuard({max:2});let accepted=0;
 const enter=id=>{const res=response();guard({user:{id}},res,()=>accepted++);return res;};
 const a=enter('a');assert.equal(enter('a').code,429);const b=enter('b');assert.equal(enter('c').code,429);
 a.emit('finish');a.emit('close');enter('c');assert.equal(enter('d').code,429);b.emit('finish');enter('d');assert.equal(accepted,4);
});
test('media quota rejects insufficient capacity before multipart upload',async()=>{
 let bytes=170*1048576,accepted=0;
 const quota=mediaQuota({prepare:()=>({get:async()=>({bytes})})});const res=response();
 await quota({user:{id:'a'}},res,()=>accepted++);assert.equal(res.code,413);assert.equal(accepted,0);
 bytes='0';await quota({user:{id:'a'}},response(),()=>accepted++);assert.equal(accepted,1);
});
