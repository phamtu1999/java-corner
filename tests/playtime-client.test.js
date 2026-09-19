import test from "node:test";
import assert from "node:assert/strict";
import {startPlaytime} from "../web/emulator/src/playtime.js";

test("playtime pauses when hidden and stops once on exit", async t=>{
  const document=new EventTarget(), window=new EventTarget(), calls=[];
  document.hidden=false;
  let tick,cleared=false;
  t.mock.method(globalThis,"setInterval",fn=>{tick=fn;return 1;});
  t.mock.method(globalThis,"clearInterval",()=>{cleared=true;});
  t.mock.method(globalThis,"fetch",async(url,options)=>{calls.push(JSON.parse(options.body));return {};});
  const originalDocument=globalThis.document,originalWindow=globalThis.window;
  globalThis.document=document;globalThis.window=window;
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  try {
    const stop=startPlaytime("game");await flush();
    tick();await flush();
    document.hidden=true;document.dispatchEvent(new Event("visibilitychange"));await flush();
    tick();await flush();
    assert.deepEqual(calls.map(c=>c.active),[true,true,false]);
    document.hidden=false;document.dispatchEvent(new Event("visibilitychange"));await flush();
    window.dispatchEvent(new Event("pagehide"));stop();await flush();
    assert.deepEqual(calls.map(c=>c.active),[true,true,false,true,false]);
    assert.equal(new Set(calls.map(c=>c.session)).size,1);
    assert.equal(cleared,true);
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  }
});
