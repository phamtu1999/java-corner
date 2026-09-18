import yauzl from 'yauzl';

// Read only a bounded manifest. Never extract or execute uploaded archives on the server.
export function validateJar(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(new Error('Tệp JAR bị hỏng hoặc không phải ZIP hợp lệ.'));
      let count = 0, total = 0, manifest = '', hasClass = false, settled = false;
      const fail = () => {
        if (settled) return;
        settled = true; zip.close();
        reject(new Error('Cần game Java ME .jar hợp lệ, có MIDlet trong MANIFEST.MF.'));
      };
      zip.on('error', fail);
      zip.on('entry', entry => {
        total += entry.uncompressedSize;
        if (++count > 10000 || total > 150 * 1024 * 1024 || entry.isEncrypted()) return fail();
        if (entry.fileName.endsWith('.class')) hasClass = true;
        if (entry.fileName.toUpperCase() !== 'META-INF/MANIFEST.MF') return zip.readEntry();
        if (entry.uncompressedSize > 65536) return fail();
        zip.openReadStream(entry, (err, stream) => {
          if (err) return fail();
          const chunks = []; let size = 0;
          stream.on('error', fail);
          stream.on('data', chunk => { size += chunk.length; if (size > 65536) { stream.destroy(); fail(); } else chunks.push(chunk); });
          stream.on('end', () => { if (!settled) { manifest = Buffer.concat(chunks).toString('utf8'); zip.readEntry(); } });
        });
      });
      zip.on('end', () => {
        if (settled) return;
        if (!hasClass || !/^MIDlet-1:\s*.+/im.test(manifest)) return fail();
        settled = true; resolve();
      });
      zip.readEntry();
    });
  });
}

// Read a named archive entry with hard limits; never unpack paths onto disk.
function readEntry(path, matches, limit) {
  return new Promise(resolve => {
    yauzl.open(path, { lazyEntries:true }, (error, zip) => {
      if (error) return resolve(null);
      let settled=false, count=0;
      const finish=value=>{if(settled)return;settled=true;zip.close();resolve(value);};
      zip.on('error',()=>finish(null));zip.on('end',()=>finish(null));
      zip.on('entry',entry=>{
        if(++count>10000)return finish(null);
        if(!matches(entry.fileName))return zip.readEntry();
        if(entry.isEncrypted()||entry.uncompressedSize>limit)return finish(null);
        zip.openReadStream(entry,(err,stream)=>{
          if(err)return finish(null);
          let size=0;const chunks=[];
          stream.on('error',()=>finish(null));
          stream.on('data',chunk=>{size+=chunk.length;if(size>limit){stream.destroy();finish(null);}else chunks.push(chunk);});
          stream.on('end',()=>finish(Buffer.concat(chunks)));
        });
      });zip.readEntry();
    });
  });
}
export async function extractJarPublisher(path) {
  const bytes=await readEntry(path,n=>n.toUpperCase()==='META-INF/MANIFEST.MF',65536);
  const vendor=/^MIDlet-Vendor:[ \t]*(.+)$/im.exec(bytes?.toString('utf8').replace(/\r?\n /g,'')||'')?.[1]?.trim()||'';
  return vendor.slice(0,100);
}
export async function extractJarIcon(path) {
  const bytes=await readEntry(path,n=>n.toUpperCase()==='META-INF/MANIFEST.MF',65536);
  if(!bytes)return null;
  const manifest=bytes.toString('utf8').replace(/\r?\n /g,'');
  const main=/^MIDlet-Icon:\s*(.+)$/im.exec(manifest)?.[1];
  const midlet=/^MIDlet-1:\s*(.+)$/im.exec(manifest)?.[1]?.split(',')[1];
  const name=(main||midlet||'').trim().replace(/^\/+/, '');
  if(!name)return null;
  const image=await readEntry(path,n=>n===name,65536);
  if(!image)return null;
  // Only small raster icons; no SVG or arbitrary active content.
  if(image.length>=24 && image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    const w=image.readUInt32BE(16),h=image.readUInt32BE(20);
    if(w>0&&h>0&&w<=512&&h<=512)return 'data:image/png;base64,'+image.toString('base64');
  }
  if(image.length>=10 && /^GIF8[79]a$/.test(image.subarray(0,6).toString())) {
    const w=image.readUInt16LE(6),h=image.readUInt16LE(8);
    if(w>0&&h>0&&w<=512&&h<=512)return 'data:image/gif;base64,'+image.toString('base64');
  }
  return null;
}
