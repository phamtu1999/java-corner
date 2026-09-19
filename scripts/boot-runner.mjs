import puppeteer from 'puppeteer-core';
import {createServer} from 'node:http';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import handler from 'serve-handler';

export function allowedBootRequest(url,origin) {
 try {const u=new URL(url);return u.origin===origin&&!u.pathname.startsWith('/api/')||u.origin==='https://cjrtnc.leaningtech.com';}catch{return false;}
}
// This server exposes only runtime assets and one JAR. No account, API, or credentials.
export async function runBoot(bytes,{executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome',timeout=120000}={}) {
 const web=resolve('web'),html=await readFile(resolve(web,'emulator/run.html'));
 const directory=await mkdtemp(resolve(tmpdir(),'boot-jar-'));
 await writeFile(resolve(directory,'boot.jar'),bytes);
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cjrtnc.leaningtech.com; connect-src 'self' https://cjrtnc.leaningtech.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob: https://cjrtnc.leaningtech.com; frame-src https://cjrtnc.leaningtech.com; media-src 'self' blob:");
  if(path.startsWith('/api/')){res.writeHead(403);return res.end();}
  if(path==='/play'){res.setHeader('Content-Type','text/html');return res.end(html);}
  if(path==='/emulator/jar/boot.jar'){req.url='/boot.jar';return handler(req,res,{public:directory,cleanUrls:false,directoryListing:false});}
  return handler(req,res,{public:web,cleanUrls:false,directoryListing:false});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser,timer;
 const report={screenshots:[],errors:[],statuses:[],blocked:[],summary:'Chưa kết luận',state:'review'};
 try{
  browser=await puppeteer.launch({executablePath,headless:true,env:{PATH:process.env.PATH,HOME:process.env.HOME},args:['--disable-background-networking','--disable-extensions','--js-flags=--max-old-space-size=512']});
  timer=setTimeout(()=>browser.process()?.kill('SIGKILL'),timeout);
  const page=await browser.newPage();await page.setViewport({width:480,height:800});
  await page.setRequestInterception(true);
  page.on('request',r=>{if(allowedBootRequest(r.url(),origin))r.continue().catch(()=>{});else{if(report.blocked.length<30)report.blocked.push(r.url().slice(0,300));r.abort().catch(()=>{});}});
  page.on('popup',p=>p.close());
  page.on('console',message=>{const text=message.text();if(/(?:Exception|ClassFormatError|NoClassDefFoundError|VerifyError|OutOfMemoryError|Could not load|Failed to load MIDlet)/i.test(text)&&report.errors.length<20)report.errors.push(text.slice(0,500));});
  page.on('pageerror',error=>{if(report.errors.length<20)report.errors.push(error.message.slice(0,500));});
  await page.evaluateOnNewDocument(()=>{
   window.bootEvents=[];
   window.addEventListener('game-startup-status',e=>{window.bootEvents.push(String(e.detail).slice(0,300));if(window.bootEvents.length>20)window.bootEvents.shift();});
  });
  await page.goto(origin+'/play?jar=boot.jar&network=0',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{const c=document.querySelector('#display');return c&&getComputedStyle(c).display!=='none'&&c.width>0;},{timeout:80000});
  let previous=0,visible=false;
  for(const seconds of [5,10,20]){
   await new Promise(resolve=>setTimeout(resolve,(seconds-previous)*1000));previous=seconds;
   const frame=await page.$eval('#display',c=>{
    if(c.width*c.height>1048576)throw Error('Canvas vượt giới hạn 1 megapixel');
    const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;
    let varied=false;for(let i=4;i<d.length;i+=4)if(d[i]!==d[0]||d[i+1]!==d[1]||d[i+2]!==d[2]){varied=true;break;}
    return {varied,png:c.toDataURL('image/png').split(',')[1]};
   });
   visible ||= frame.varied;
   if(frame.png.length<=1000000)report.screenshots.push({seconds,png:frame.png});
  }
  report.statuses=await page.evaluate(()=>window.bootEvents.slice(-20));
  const exited=report.statuses.some(s=>/thoát|Lỗi khi khởi động/.test(s));
  report.state=visible&&!exited&&!report.errors.length?'captured':'review';
  report.summary=report.state==='captured'?'Có khung hình sau 20 giây; chưa xác minh gameplay.':'Cần xem lại: màn hình trống, lỗi hoặc game thoát.';
 }catch(error){report.state='error';report.summary='Không kết luận: '+error.message.slice(0,300);}
 finally{clearTimeout(timer);await browser?.close().catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
 return report;
}
