#!/usr/bin/env python3
"""Resume the public JAR inventory in downloads/giaitri321/manifest.json."""
import concurrent.futures,fcntl,hashlib,json,os,signal,threading,time,urllib.request,urllib.error,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'downloads'/'giaitri321'
ROOT.mkdir(parents=True,exist_ok=True)
WORKERS=max(1,min(8,int(os.environ.get('JAR_DOWNLOAD_WORKERS','8'))))
cooldown_until=0
cooldown_lock=threading.Lock()
lock=open(ROOT/'download.lock','w')
try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:raise SystemExit('A downloader is already running.')
lock.write(str(os.getpid()));lock.flush()
manifest=ROOT/'manifest.json'
data=json.loads(manifest.read_text());records=data['files'];stop=threading.Event()
for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda *_:stop.set())
def atomic(path,value):
 tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8');tmp.replace(path)
def partial_progress():
 sizes=[]
 for path in ROOT.rglob('*.part'):
  try:sizes.append(path.stat().st_size)
  except FileNotFoundError:pass
 return {'partial_files':len(sizes),'partial_bytes':sum(sizes)}
def persist(running=True):
 atomic(manifest,data)
 summary={'running':running,'pid':os.getpid(),'workers':WORKERS,'updated_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'total_links':len(records),'downloaded':sum(r.get('status')=='downloaded' for r in records),'failed':sum(r.get('status')=='failed' for r in records),'pending':sum(r.get('status') not in ['downloaded','failed','external-link-not-downloaded'] for r in records),'bytes':sum(r.get('bytes',0) for r in records),'page_errors':data.get('page_errors',[])}
 summary.update(partial_progress())
 atomic(ROOT/'summary.json',summary)
 print(json.dumps(summary,ensure_ascii=False),flush=True)
class SafeRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  from urllib.parse import urlsplit
  if urlsplit(newurl).hostname not in ('giaitri321.vip','www.giaitri321.vip'):raise ValueError('redirect outside source website')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def valid(path):
 with zipfile.ZipFile(path) as z:
  entries=z.infolist()
  if len(entries)>30000 or sum(e.file_size for e in entries)>200*1024*1024:raise ValueError('archive safety limit')
  if not any(e.filename.endswith('.class') for e in entries):raise ValueError('No Java classes')
  if any(e.flag_bits & 1 for e in entries):raise ValueError('Encrypted ZIP entries: password required; not retried')
  if z.testzip():raise ValueError('ZIP CRC check failed')
def download(record):
 global cooldown_until
 r=dict(record)
 if r.get('status')=='external-link-not-downloaded':return r
 if r.get('status')=='failed' and ('password required' in r.get('error','').lower() or 'encrypted zip entries' in r.get('error','').lower()):return r
 folder=ROOT/r['folder'];folder.mkdir(parents=True,exist_ok=True)
 name=Path(r['filename']);path=folder/(name.stem+'--'+hashlib.sha256(r['url'].encode()).hexdigest()[:8]+'.jar');part=path.with_suffix('.part')
 for attempt in range(3):
  if stop.is_set():r['status']='pending';return r
  try:
   while time.monotonic()<cooldown_until:
    if stop.wait(min(5,max(0,cooldown_until-time.monotonic()))):
     r['status']='pending';return r
   if path.exists():valid(path)
   else:
    req=urllib.request.Request(r['url'],headers={'User-Agent':'JavaCorner-Archive/1.0 (public JAR download)','Accept-Encoding':'identity'})
    opener=urllib.request.build_opener(SafeRedirect())
    with opener.open(req,timeout=30) as response,open(part,'wb') as out:
     total=0;started=time.monotonic()
     while True:
      if stop.is_set():raise InterruptedError('Stopped; restart to continue')
      if time.monotonic()-started>1800:raise TimeoutError('Download exceeded 30 minutes')
      chunk=response.read(32768)
      if not chunk:break
      total+=len(chunk)
      if total>30*1024*1024:raise ValueError('JAR exceeds 30 MiB')
      out.write(chunk)
    valid(part);part.replace(path)
   r.update(status='downloaded',path=str(path.relative_to(ROOT)),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest());r.pop('error',None)
   return r
  except Exception as e:
   part.unlink(missing_ok=True)
   if isinstance(e,InterruptedError):r['status']='pending';return r
   r.update(status='failed',error=str(e))
   if isinstance(e,urllib.error.HTTPError) and e.code in (429,503):
    value=e.headers.get('Retry-After','60')
    delay=int(value) if value.isdigit() else 60
    with cooldown_lock:cooldown_until=max(cooldown_until,time.monotonic()+max(60,delay))
   if isinstance(e,(ValueError,zipfile.BadZipFile)) or isinstance(e,urllib.error.HTTPError) and e.code in (403,404,410):break
   if attempt<2:stop.wait(3*(attempt+1))
 return r
# Revalidate existing JARs and retry failures; bounded concurrency and shared server backoff.
persist()
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
  pending={};iterator=iter(enumerate(records))
  def fill():
   while len(pending)<WORKERS and not stop.is_set():
    try:i,r=next(iterator)
    except StopIteration:break
    pending[pool.submit(download,r)]=i
  fill()
  while pending:
   done,_=concurrent.futures.wait(pending,timeout=15,return_when=concurrent.futures.FIRST_COMPLETED)
   for f in done:records[pending.pop(f)]=f.result()
   persist();fill()
finally:persist(False)
