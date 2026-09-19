import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedBootRequest} from '../scripts/boot-runner.mjs';

test('boot browser permits runtime CDN and local assets only',()=>{
 const origin='http://127.0.0.1:54321';
 assert.equal(allowedBootRequest(origin+'/emulator/jar/boot.jar',origin),true);
 assert.equal(allowedBootRequest('https://cjrtnc.leaningtech.com/runtime.js',origin),true);
 for(const url of [origin+'/api/me','http://127.0.0.1:80/','http://169.254.169.254/','https://example.com/','https://cjrtnc.leaningtech.com.evil.test/','file:///etc/passwd','invalid'])assert.equal(allowedBootRequest(url,origin),false,url);
});
