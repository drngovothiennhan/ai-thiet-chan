const CACHE='ai-thiet-chan-v2.6.2';
const SHELL=['/','/styles.css','/history.css','/dual-view.css','/settings.css','/quality-dashboard.css','/app.js','/capture-metadata.js','/consultation.js','/clinical-learning.js','/torch.js','/settings.js','/quality-dashboard.js','/manifest.webmanifest','/icon.svg','/open-source.html'];
const NAV_TIMEOUT_MS=2500;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

async function fetchWithTimeout(request,timeoutMs=NAV_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{cache:'no-cache',signal:controller.signal});}
  finally{clearTimeout(timer);}
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetchWithTimeout(request);
        if(response.ok){const cache=await caches.open(CACHE);cache.put('/',response.clone());}
        return response;
      }catch{
        return (await caches.match('/')) || (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const refresh=fetch(request,{cache:'no-cache'}).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
      return response;
    }).catch(()=>null);
    if(cached){event.waitUntil(refresh.then(()=>{}));return cached;}
    return (await refresh) || Response.error();
  })());
});
