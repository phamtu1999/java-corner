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
    for(const raw of ['bad JSON','{}','[null]',JSON.stringify([{...game,icon:'https://external.invalid/icon'}])]){
        storage.getItem=()=>raw;
        assert.equal(readLibraryPreview(storage,user),null);
    }
    const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('full');}};
    assert.equal(readLibraryPreview(blocked,user),null);
    assert.doesNotThrow(()=>writeLibraryPreview(blocked,user,[game]));
});
