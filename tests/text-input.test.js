import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textKey, setupTextInput} from '../web/emulator/src/text-input.js';

test('text preserves case, symbols and backspace without swallowing shortcuts', () => {
 for (const key of ['q', 'W', '@', '1', 'ế']) assert.deepEqual(textKey({key}), {code:key.charCodeAt(0), character:key});
 assert.equal(textKey({key:'ArrowUp'}), null);
 assert.equal(textKey({key:'v',ctrlKey:true}), null);
 assert.equal(textKey({key:'a',isComposing:true}), null);
 assert.equal(textKey({key:'Backspace'}).code, 8);
});
test('opt-in typing queues one character per keydown and restores game controls', () => {
 const original=globalThis.document;
 const field={value:''},status={};const panel={querySelector:s=>s==='input'?field:s==='[role=status]'?status:{}};let created=0;
 const button={setAttribute(){},style:{}};
 globalThis.document={createElement:()=>created++?panel:button,querySelector:()=>({append(){},after(){}})};
 try {
  const events=[];
  const handle=setupTextInput({focus(){},addEventListener(){}},{queueEvent:e=>events.push(e)});
  const event={key:'q',type:'keydown',preventDefault(){}};
  assert.equal(handle(event),false);
  button.onclick();
  assert.equal(handle(event),true);
  assert.equal(handle({...event,type:'keyup'}),true);
  assert.deepEqual(events,[{kind:'textinput',code:113,character:'q'}]);
  button.onclick();
  assert.equal(handle(event),false);
 } finally {globalThis.document=original;}
});
