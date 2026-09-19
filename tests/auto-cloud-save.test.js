import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
test('automatic save debounces changes, skips unchanged data and pauses conflicts',async()=>{
 let tick,now=100000,uploads=0,value=1,conflict=false;
 const status={style:{},setAttribute(){}};
 const context={crypto:webcrypto,Uint8Array,Blob,FormData,AbortSignal,Date:{now:()=>now},console,document:{hidden:false,createElement:()=>status,querySelector:()=>({parentElement:{append(){}}})},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null},setInterval:fn=>{tick=fn;return 1;},clearInterval(){},fetch:async(url,options)=>{
  if(!options.method)return {ok:true,json:async()=>[]};
  uploads++;return conflict?{ok:false,status:409,json:async()=>({error:'conflict'})}:{ok:true,json:async()=>({revision:'r'+uploads})};
 }};
 vm.createContext(context);
 const source=(await readFile(new URL('../web/emulator/src/auto-cloud-save.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'').replace('export async function','async function');
 vm.runInContext(source,context);
 await context.setupAutoCloudSave({gameId:'g',appId:'g',user:{id:'u'},saves:{exportSave:async()=>[value]}});
 await tick();assert.equal(uploads,0);
 now+=10000;await tick();assert.equal(uploads,1);
 now+=10000;await tick();assert.equal(uploads,1);
 value=2;now+=60000;await tick();assert.equal(uploads,1);
 conflict=true;now+=10000;await tick();assert.equal(uploads,2);
 now+=60000;await tick();assert.equal(uploads,2);
});
