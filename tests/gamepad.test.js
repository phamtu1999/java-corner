import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gamepadKeys,normalizeProfile} from '../web/emulator/src/gamepad.js';
test('standard controller maps buttons, deduplicates directions and ignores stick drift',()=>{
 const pad={mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false})),axes:[.2,-.1]};
 assert.equal(gamepadKeys(pad).size,0);
 pad.buttons[0].pressed=true;pad.buttons[14].pressed=true;pad.axes=[-.8,0];
 assert.deepEqual([...gamepadKeys(pad)].sort(),['ArrowLeft','Enter']);
 assert.equal(gamepadKeys({...pad,mapping:''}).size,0);assert.equal(gamepadKeys(null).size,0);
});

test('custom profiles validate persisted data and support disabling buttons',()=>{
 const profile=normalizeProfile({buttons:{0:'Digit2',1:'',2:'invalid'},deadzone:.8});
 assert.equal(profile.buttons[2],'KeyQ');
 const pad={mapping:'standard',buttons:[{pressed:true},{pressed:true}],axes:[.7,0]};
 assert.deepEqual([...gamepadKeys(pad,profile)],['Digit2']);
 assert.equal(normalizeProfile({deadzone:NaN}).deadzone,.5);
 assert.equal(normalizeProfile({deadzone:3}).deadzone,.85);
 assert.equal(normalizeProfile(null).buttons[0],'Enter');
});
