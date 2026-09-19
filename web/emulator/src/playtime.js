export function startPlaytime(gameId) {
    const session=crypto.randomUUID();
    let stopped=false, pending=Promise.resolve();
    const send=active=>{
        pending=pending.then(()=>fetch(`/api/games/${encodeURIComponent(gameId)}/playtime`,{
            method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'},
            body:JSON.stringify({session,active}),
        })).catch(()=>{});
    };
    const visible=()=>send(!document.hidden&&!stopped);
    const interval=setInterval(()=>{if(!document.hidden&&!stopped)send(true);},15000);
    const stop=()=>{if(stopped)return;stopped=true;clearInterval(interval);send(false);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',stop);};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('pagehide',stop);
    if(!document.hidden)send(true);
    return stop;
}
