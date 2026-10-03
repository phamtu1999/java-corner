import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
    return {promise,resolve,reject};
};

test('player fetches Java and profile together but imports preferences after both', async () => {
    const source=fs.readFileSync(new URL('../web/emulator/src/player-entry.js',import.meta.url),'utf8');
    const body=source.slice(source.indexOf('async function startPlayer()'),source.indexOf('startPlayer().catch'))
        .replace(/await import\([^;]+\);/,'await importMain();');
    const java=deferred(),profile=deferred(),calls=[];
    const start=vm.runInNewContext(body+';startPlayer',{
        document:{},loadJavaRuntime:()=>{calls.push('java');return java.promise;},
        restorePlayerProfile:()=>{calls.push('profile');return profile.promise;},
        importMain:async()=>{calls.push('preferences');},
        watchPlayerProfile:()=>{calls.push('watch');},
    });
    const pending=start();
    assert.deepEqual(calls,['java','profile']);
    java.resolve();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calls,['java','profile'],'preferences must not read unrestored storage');
    profile.resolve();await pending;
    assert.deepEqual(calls,['java','profile','preferences','watch']);
});

test('Java starts while MIDI is pending and the game waits for both', async () => {
    const source=fs.readFileSync(new URL('../web/emulator/src/main.js',import.meta.url),'utf8');
    const body=source.slice(source.indexOf('async function init()'),source.indexOf('init().catch'));
    const java=deferred(),midi=deferred();
    let javaStarted=false,midiStarted=false,gameStarted=false,listenerReady=false;
    const init=vm.runInNewContext(body+';init',{
        sp:new URLSearchParams('app=local_game'),display:null,screenCtx:null,reportCrash:null,communitySource:null,
        document:{getElementById:()=>({getContext:()=>({})})},window:{dispatchEvent(){}},
        evtQueue:{},setupDiagnostics:()=>()=>{},setListeners(){},
        LibMidi:class {
            init(){midiStarted=true;return midi.promise;}
            midiPlayer={addEventListener:()=>{listenerReady=true;}};
        },
        createUnlockingAudioContext(){},LibMedia:class {},
        networkOptions:{},relayNatives:{},canvasFontNatives:{},canvasGraphicsNatives:{},
        gles2Natives:{},jsReferenceNatives:{},mediaBridgeNatives:{},midiBridgeNatives:{},
        cheerpjInit:()=>{javaStarted=true;return java.promise;},
        CustomEvent:class {},cheerpjWebRoot:'/app/emulator',
        cheerpjRunLibrary:()=>{gameStarted=true;throw Error('stop before executing game');},
    });
    const pending=init();
    assert.equal(midiStarted,true);assert.equal(javaStarted,true);
    assert.equal(gameStarted,false);assert.equal(listenerReady,false);
    java.resolve();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(gameStarted,false,'MIDI must be ready before Java can call its audio bridges');
    midi.resolve();await assert.rejects(pending,/stop before executing game/);
    assert.equal(listenerReady,true);assert.equal(gameStarted,true);
});
