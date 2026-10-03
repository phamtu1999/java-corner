import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadJavaRuntime} from '../web/emulator/src/java-runtime.js';

test('Java loader yields to the library UI and reports load failures', async () => {
    const scripts=[];
    const runtime={};
    const document={createElement:()=>({}),head:{append:script=>scripts.push(script)}};
    let loaded=false;
    const pending=loadJavaRuntime(document,runtime).then(()=>{loaded=true;});
    assert.equal(loaded,false);
    assert.equal(scripts[0].async,true);
    runtime.cheerpjInit=()=>{};
    scripts[0].onload();
    await pending;
    await loadJavaRuntime(document,runtime);
    assert.equal(scripts.length,1,'already-loaded runtime must not download again');
    const failed=loadJavaRuntime(document,{});
    scripts[1].onerror();
    await assert.rejects(failed,/Không tải được/);
    const invalid=loadJavaRuntime(document,{});
    scripts[2].onload();
    await assert.rejects(invalid,/không khởi tạo/);
});

test('library reads overlap within a bounded batch and preserve metadata/order', async () => {
    const source=fs.readFileSync(new URL('../web/emulator/src/launcher.js',import.meta.url),'utf8');
    const body=source.slice(source.indexOf('async function loadGames()'),source.indexOf('const gameSort ='));
    const ids=Array.from({length:9},(_,i)=>'game_'+i);
    let active=0,peak=0;
    const cjFileBlob=async path=>{
        if(path==='/files/apps.list')return new Blob([ids.join('\n')]);
        active++;peak=Math.max(peak,active);
        await new Promise(resolve=>setTimeout(resolve,2));active--;
        if(path.endsWith('/icon'))return null;
        if(path.endsWith('/name'))return new Blob(['Tên '+path.split('/')[2]]);
        return new Blob(['volume: 7']);
    };
    const load=vm.runInNewContext(body+';loadGames',{
        defaultSettings:{default:true},emptyIcon:'fallback',cjFileBlob,
        maybeReadCheerpJFileText:async path=>(await cjFileBlob(path))?.text(),
        getDataUrlFromBlob:()=>{throw Error('missing icons must retain fallback');},
        readToKv:(text,kv)=>{kv.volume=text.split(': ')[1];}
    });
    const games=await load();
    assert.deepEqual(Array.from(games,g=>g.appId),ids);
    assert.ok(peak>5,'multiple apps should be read concurrently');
    assert.ok(peak<=20,'at most four apps with five reads each');
    for(const game of games){
        assert.equal(game.name,'Tên '+game.appId);
        assert.equal(game.icon,'fallback');
        assert.equal(game.settings.default,true);
        assert.equal(game.settings.volume,'7');
        assert.equal(game.appProperties.volume,'7');
        assert.equal(game.systemProperties.volume,'7');
    }
});

test('cached library browsing is ready while Java download is still pending', async () => {
    const source=fs.readFileSync(new URL('../web/emulator/src/launcher.js',import.meta.url),'utf8');
    const body=source.slice(source.indexOf('async function main()'),source.indexOf('async function maybeReadCheerpJFileText'));
    const mainElement={style:{},setAttribute(){}};
    const loading={};
    const sort={disabled:false};
    const dataControl={disabled:false};
    const cache=[{appId:'local_game',name:'Cached game',icon:'data:image/png;base64,AA=='}];
    let failDownload,toolCalls=0,preview,javaStarted=false;
    const pending=new Promise((resolve,reject)=>{failDownload=reject;});
    const state={games:[]};
    const main=vm.runInNewContext(body+';main',{
        state,communityUser:null,localStorage:{},gameSort:sort,
        document:{querySelectorAll:()=>[sort,dataControl],getElementById:id=>id==='main'?mainElement:id==='loading'?loading:{}},
        currentUser:async()=>null,readLibraryPreview:()=>cache,
        fillGamesList:(games,isPreview)=>{preview={games,isPreview};},
        setupLibraryTools:render=>{assert.equal(render,false);toolCalls++;},
        loadJavaRuntime:()=>pending,cheerpjInit:()=>{javaStarted=true;}
    });
    const initializing=main();
    await Promise.resolve();
    assert.equal(toolCalls,1);
    assert.equal(mainElement.style.display,'');
    assert.equal(sort.disabled,false);
    assert.equal(dataControl.disabled,true,'save writes stay disabled until Java is ready');
    assert.equal(javaStarted,false);
    assert.equal(preview.games,cache);
    assert.equal(preview.isPreview,true);
    assert.equal(state.games,cache,'search must filter the cached games');
    failDownload(new Error('offline'));
    await assert.rejects(initializing,/offline/);
});
