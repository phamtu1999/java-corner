import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLibraryPreview,writeLibraryPreview} from '../web/emulator/src/library-preview.js';

test('library preview isolates accounts, replaces stale entries and tolerates unavailable storage', () => {
    const data=new Map();
    const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
    const user={id:'one'}, other={id:'two'};
    const game={appId:'game',name:'Game',icon:'data:image/png;base64,AA==',settings:{secret:'not cached'}};
    writeLibraryPreview(storage,user,[game]);
    assert.deepEqual(readLibraryPreview(storage,user),[{appId:game.appId,name:game.name,icon:game.icon}]);
    assert.equal(readLibraryPreview(storage,other),null);
    assert.equal(readLibraryPreview(storage,null),null);
    writeLibraryPreview(storage,user,[]);
    assert.deepEqual(readLibraryPreview(storage,user),[]);
    for(const raw of ['bad JSON','{}','[null]']){
        storage.getItem=()=>raw;
        assert.equal(readLibraryPreview(storage,user),null);
    }
    const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('full');}};
    assert.equal(readLibraryPreview(blocked,user),null);
    assert.doesNotThrow(()=>writeLibraryPreview(blocked,user,[game]));
});

test('one invalid icon cannot hide cached games while Java is starting', () => {
    const png='iVBORw0KGgoAAA==';
    const icons=['data:;base64,'+png,'data:application/octet-stream;base64,'+png,
        'https://external.invalid/icon','data:image/svg+xml;base64,AA==',null];
    const games=icons.map((icon,i)=>({appId:'game_'+i,name:'Game '+i,icon}));
    let saved=JSON.stringify(games);
    const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value;}};
    const preview=readLibraryPreview(storage,null);
    assert.deepEqual(preview.map(game=>game.name),games.map(game=>game.name));
    for(const game of preview)assert.match(game.icon,/^data:image\/(png|gif);base64,/);
    assert.equal(preview[0].icon,'data:image/png;base64,'+png);
    assert.equal(preview[1].icon,preview[0].icon);
    writeLibraryPreview(storage,null,games);
    assert.deepEqual(readLibraryPreview(storage,null),preview,'new cache writes must normalize icons too');
});
