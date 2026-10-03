import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {prepareCommunityGame} from '../web/emulator/src/community-preload.js';

const context = {game:{id:'game-id',filename:'game.jar'},appId:'account-game',user:{id:'account'}};
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes,no) => {resolve=yes;reject=no;});
    return {promise,resolve,reject};
};

test('preloads missing game while Java is pending, using the resolved account cache', async () => {
    const network=deferred();
    let downloaded=false,progress;
    const storage={};
    const prepared=await prepareCommunityGame('game-id', {
        storage, resolve:async()=>context,
        readPreview:(receivedStorage,user)=>{
            assert.equal(receivedStorage,storage);assert.equal(user,context.user);return [];
        },
        onProgress:(received,total)=>{progress=[received,total];},
        download:(url,onProgress)=>{
            assert.equal(url,'/api/games/game-id/file');downloaded=true;
            onProgress(3,10);return network.promise;
        },
    });
    assert.equal(downloaded,true,'download begins without waiting for Java');
    assert.deepEqual(progress,[3,10]);
    const bytes=new ArrayBuffer(10);network.resolve(bytes);
    assert.equal((await prepared.value.bytes).value,bytes);
});

test('installed games and unknown caches defer downloads to the actual storage check', async () => {
    for (const cached of [null,[{appId:context.appId}]]) {
        const prepared=await prepareCommunityGame('game-id', {
            storage:{},resolve:async()=>context,readPreview:()=>cached,
            download:()=>{throw Error('must not download');},
        });
        assert.equal(prepared.value.context,context);
        assert.equal(prepared.value.bytes,null);
    }
});

test('early permission and download failures remain retryable without unhandled rejections', async () => {
    const denied=new Error('private game');
    const result=await prepareCommunityGame('game-id', {
        storage:{},resolve:async()=>{throw denied;},
        download:()=>{throw Error('permission checks precede downloads');},
    });
    assert.equal(result.error,denied);
    const network=deferred();
    const prepared=await prepareCommunityGame('game-id', {
        storage:{},resolve:async()=>context,readPreview:()=>[],download:()=>network.promise,
    });
    const offline=new Error('offline');network.reject(offline);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await prepared.value.bytes).error,offline);
});

test('opening reuses preloaded bytes and still checks the installed JAR before redirecting', async () => {
    const source=fs.readFileSync(new URL('../web/emulator/src/launcher.js',import.meta.url),'utf8');
    const body=source.slice(source.indexOf('async function openCommunityGame('),source.indexOf('main().catch'));
    const bytes=new ArrayBuffer(4),state={};
    let installed=false,checks=0,navigated,processed;
    const open=vm.runInNewContext(body+';openCommunityGame',{
        state,document:{getElementById:()=>({style:{}})},
        resolveCommunityGame:()=>{throw Error('metadata must be reused');},
        downloadGame:()=>{throw Error('bytes must be reused');},
        cjFileBlob:async path=>{assert.equal(path,'/files/account-game/app.jar');checks++;return installed?new Blob([bytes]):null;},
        processGameFile:async(data,filename)=>{
            processed=data;assert.equal(filename,'game.jar');
            state.currentGame={};state.lastLoader={setAppId:async id=>assert.equal(id,context.appId)};
        },
        doAddSaveGame:async()=>{assert.equal(state.currentGame.appId,context.appId);installed=true;},
        location:{replace:url=>{navigated=url;}},
    });
    await open('game-id',Promise.resolve({value:{context,bytes:Promise.resolve({value:bytes})}}));
    assert.equal(processed,bytes);assert.equal(checks,2);
    assert.equal(navigated,'/play?app=account-game&fractionScale=1&mobile=1');
    // A stale cache can preload unnecessarily; the live JAR must win and preserve saves.
    await open('game-id',Promise.resolve({value:{context,bytes:Promise.resolve({error:Error('offline')})}}));
    assert.equal(checks,3);
});
