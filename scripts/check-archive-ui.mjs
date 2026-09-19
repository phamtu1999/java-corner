import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const root=resolve('web'),sent=[];
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/test'){res.setHeader('Content-Type','text/html');res.end('<div class="player-toolbar"></div><div class="player-network"><button aria-pressed="false"></button></div><canvas id="display" width="240" height="320"></canvas>');return;}
  if(url.pathname==='/api/me'){res.setHeader('Content-Type','application/json');res.end('{"user":null}');return;}
  if(url.pathname.endsWith('/telemetry')){let body='';for await(const chunk of req)body+=chunk;sent.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
  const file=resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/'))throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}
}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome'});
try{
 const page=await browser.newPage();await page.setViewport({width:390,height:844});await page.goto(base+'/test');
 await page.evaluate(async()=>{const {setupDiagnostics,currentReplay}=await import('/emulator/src/diagnostics.js');window.queue={events:[],queueEvent(e){this.observe?.(e);this.events.push(e);}};window.report=setupDiagnostics(queue,{game:{id:'test',sha256:'a'.repeat(64)},user:{role:'admin'}});window.readReplay=currentReplay;});
 await page.click('.player-toolbar button');await page.click('[data-record]');
 const data=await page.evaluate(()=>{queue.queueEvent({kind:'keydown',args:[49,'1',false,false]});queue.queueEvent({kind:'keydown',args:[38,'\0',false,false]});queue.queueEvent({kind:'keyup',args:[38,'\0',false,false]});queue.queueEvent({kind:'textinput',code:65,character:'secret'});queue.queueEvent({kind:'keydown',args:[39,'\0',false,false]});report(Error('not consented'));return readReplay();});
 assert.equal(data.events.length,2);assert.ok(!JSON.stringify(data).includes('secret'));assert.equal(sent.length,0);
 await page.click('.player-toolbar button');await page.click('[data-telemetry]');await page.evaluate(()=>report(new TypeError('secret password')));
 await page.waitForFunction(()=>true);await new Promise(r=>setTimeout(r,300));assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('secret'));assert.match(sent[0].signature,/^[a-f0-9]{64}$/);
 await page.evaluate(()=>{const input=document.querySelector('input[type=file]'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(readReplay())],'replay.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));});
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('Đã dừng'));
 assert.ok(await page.evaluate(()=>queue.events.filter(e=>e.kind==='keyup'&&e.args?.[0]===38).length>=2));
 await page.evaluate(async()=>{
  document.body.innerHTML='<main></main><dialog id="modal"><div id="modal-body"></div></dialog>';
  const {setupArchiveTools}=await import('/community/archive-tools.js');
  setupArchiveTools({root:document.querySelector('main'),r:{view:'admin'},user:{role:'admin'},api:async()=>({at:'now',uploads_minute:0,boot_queued:0,boot_running:0,jar_bytes:0,cloud_bytes:0,db_ms:1,relay_sockets:0,events:[]}),esc:x=>String(x),openModal:html=>{document.querySelector('#modal-body').innerHTML=html;document.querySelector('#modal').showModal();},notify:m=>{throw Error(m);}});
 });
 await page.click('main button');await page.waitForSelector('#modal[open]');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(base+'/offline.html');await page.evaluate(()=>localStorage.setItem('java-corner.library-preview.v1:guest',JSON.stringify([{appId:'private-id',name:'Offline test',icon:'data:image/png;base64,AA=='}])));await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('#games').textContent.includes('Offline test'));
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 assert.ok(await page.evaluate(async()=>{const keys=await (await caches.open('java-corner-offline-v1')).keys();return keys.every(r=>!r.url.includes('/api/')&&!r.url.includes('cheerpj'));}));
 await new Promise(r=>server.close(r));await page.setOfflineMode(true);await page.goto(base+'/games');await page.waitForFunction(()=>document.querySelector('#games').textContent.includes('Offline test'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.click('#clear');assert.equal(await page.$eval('#games',el=>el.children.length),0);
 console.log('PASS replay privacy, telemetry opt-in, replay execution, PWA offline navigation and metadata clear at 390px');
}finally{await browser.close();if(server.listening)await new Promise(r=>server.close(r));}
