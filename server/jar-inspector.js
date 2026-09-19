import yauzl from 'yauzl';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {validateJar} from './jar.js';

// Static hints only: never execute classes or contact discovered endpoints.
export async function inspectJar(path, filename='') {
  await validateJar(path);
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  const report={sha256:hash.digest('hex'),manifest:{},classes:0,resources:0,classSamples:[],resourceSamples:[],resolutionHints:[],endpoints:[],permissions:[],scanLimited:false,compatibility:'Chưa chạy thử trên emulator; cấu trúc MIDlet hợp lệ không đảm bảo chơi được.'};
  const resolutions=new Set(),endpoints=new Set();
  report.entries=[];
  const hints=text=>{
    for(const m of text.matchAll(/\b\d{2,4}[xX]\d{2,4}\b/g))if(resolutions.size<50)resolutions.add(m[0].toLowerCase());
    for(const m of text.matchAll(/(?:https?|socket|ssl):\/\/[^\s\x00-\x20<>"'()\\]{1,512}/g))if(endpoints.size<100)endpoints.add(m[0]);
  };
  hints(filename);
  await new Promise((resolve,reject)=>yauzl.open(path,{lazyEntries:true},(error,zip)=>{
    if(error)return reject(error);
    let scanned=0,settled=false;
    const fail=error=>{if(settled)return;settled=true;zip.close();reject(error);};
    zip.on('error',fail);
    zip.on('end',()=>{if(!settled){settled=true;resolve();}});
    zip.on('entry',entry=>{
      if(entry.fileName.endsWith('/'))return zip.readEntry();
      const cls=entry.fileName.endsWith('.class'),manifest=entry.fileName.toUpperCase()==='META-INF/MANIFEST.MF';
      report.entries.push({name:entry.fileName,size:entry.uncompressedSize,crc:entry.crc32});
      report[cls?'classes':'resources']++;
      const samples=report[cls?'classSamples':'resourceSamples'];if(samples.length<100)samples.push(entry.fileName.slice(0,300));
      hints(entry.fileName);
      if(!manifest&&(entry.uncompressedSize>2*1048576||scanned+entry.uncompressedSize>32*1048576)){report.scanLimited=true;return zip.readEntry();}
      scanned+=entry.uncompressedSize;
      zip.openReadStream(entry,(error,stream)=>{
        if(error)return fail(error);
        const chunks=[];let size=0;
        stream.on('error',fail);
        stream.on('data',chunk=>{size+=chunk.length;if(size>2*1048576){stream.destroy();fail(new Error('Entry JAR vượt giới hạn phân tích.'));}else chunks.push(chunk);});
        stream.on('end',()=>{
          if(settled)return;
          const text=Buffer.concat(chunks).toString('utf8');hints(text);
          if(manifest)for(const line of text.replace(/\r?\n /g,'').split(/\r?\n/)){
            const match=/^([^:]+):\s*(.*)$/.exec(line);if(!match)continue;
            const key=match[1].toLowerCase();
            if(['midlet-name','midlet-vendor','midlet-version','microedition-profile','microedition-configuration'].includes(key))report.manifest[key]=match[2].slice(0,500);
            if(/^midlet-permissions(?:-opt)?$/.test(key))report.permissions.push(...match[2].split(',').slice(0,100).map(p=>({name:p.trim().slice(0,300),optional:key.endsWith('-opt')})));
          }
          zip.readEntry();
        });
      });
    });zip.readEntry();
  }));
  report.resolutionHints=[...resolutions];report.endpoints=[...endpoints];
  return report;
}
