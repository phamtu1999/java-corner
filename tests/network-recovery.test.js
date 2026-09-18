import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../web/emulator/src/network.js',import.meta.url),'utf8').replaceAll('export ','');
test('relay toggle preserves page, initializes disabled preference, and needs no Tailscale',async()=>{
 const nodes=[],calls=[];const control={useRelay:async x=>calls.push(x),setEnabled:async x=>calls.push(x)};
 const context={URL,URLSearchParams,passedControl:control,location:{origin:'http://localhost',href:'http://localhost/play?network=0'},history:{replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},document:{createElement:()=>{const n={setAttribute(){},append(){}};nodes.push(n);return n;},querySelector:()=>({append(){}})}};
 vm.createContext(context);const options=vm.runInContext(source+';setupNetwork()',context);assert.equal(Object.keys(options).length,0);
 await vm.runInContext('bindGameNetwork(passedControl)',context);await nodes[1].onclick();await nodes[1].onclick();assert.deepEqual(calls,['http://localhost',false,true,false]);
});

test('network preference persists separately for each game',async()=>{
 const saved=new Map();
 const open=async app=>{
  const nodes=[],calls=[];const context={URL,location:{origin:'http://localhost',href:'http://localhost/play?app='+app},history:{replaceState(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},window:{addEventListener(){}},document:{createElement:()=>{const n={setAttribute(){},append(){}};nodes.push(n);return n;},querySelector:()=>({append(){}})},controlValue:{useRelay:async()=>{},setEnabled:async x=>calls.push(x)}};
  vm.createContext(context);vm.runInContext(source+';setupNetwork()',context);await vm.runInContext('bindGameNetwork(controlValue)',context);return{toggle:()=>nodes[1].onclick(),calls};
 };
 const first=await open('first');await first.toggle();assert.deepEqual(first.calls,[true,false]);
 assert.deepEqual((await open('second')).calls,[true]);assert.deepEqual((await open('first')).calls,[false]);
});
