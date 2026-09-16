// Previous release marker retained for compatibility gate: ai-thiet-chan-v2.9.8-knowledge-5doc-complete
const CACHE='ai-thiet-chan-v2.9.23-asset-coherence';
// Keep the install shell small: first-screen assets plus lightweight stability/worker runtime and the mandatory chat routing guard.
const SHELL=['/','/styles.css','/history.css','/dual-view.css','/settings.css','/quality-dashboard.css','/release-ui.css','/app.js','/image-enhancement.js','/capture-metadata.js','/consultation.js','/chat-flow-ui.js','/settings.js','/quality-dashboard.js','/release-ui.js','/academic-vision.js','/academic-source.js','/runtime-stability.js','/diagnostic-worker-client.js','/vision-worker.js','/manifest.webmanifest','/icon.svg'];
const NAV_TIMEOUT_MS=2500;
const ASSET_TIMEOUT_MS=5000;

try{importScripts('/academic-vision.js');}catch{}
// Preserve the existing lifecycle safety rule: never force takeover of an open session.
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));});

async function fetchWithTimeout(request,timeoutMs=NAV_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{cache:'no-cache',signal:controller.signal});}
  finally{clearTimeout(timer);}
}

async function cacheResponse(request,response){
  if(!response?.ok)return response;
  try{const cache=await caches.open(CACHE);await cache.put(request,response.clone());}catch{}
  return response;
}

async function networkFirst(request,timeoutMs=ASSET_TIMEOUT_MS){
  try{return await cacheResponse(request,await fetchWithTimeout(request,timeoutMs));}
  catch{return (await caches.match(request))||Response.error();}
}

async function enrichAnalyzeRequest(request){
  try{
    const body=await request.clone().json();const image=body?.topImage||body?.image;const vision=self.AITCAcademicVision;
    if(!image||!vision?.signatureFromDataUrl)return request;
    const signature=await vision.signatureFromDataUrl(image);if(!signature)return request;
    body.academicSignature=signature;body.academicSource=vision.source;
    const headers=new Headers(request.headers);headers.set('content-type','application/json');return new Request(request,{headers,body:JSON.stringify(body)});
  }catch{return request;}
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.method==='POST'&&url.pathname==='/api/analyze'){
    event.respondWith((async()=>{const forwarded=await enrichAnalyzeRequest(request);const response=await fetch(forwarded);if(response.status!==429)return response;const body=await response.clone().text();const headers=new Headers(response.headers);headers.delete('retry-after');return new Response(body,{status:403,statusText:'Forbidden',headers});})());return;
  }
  if(request.method!=='GET')return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
  if(request.mode==='navigate'){
    event.respondWith((async()=>{try{const response=await fetchWithTimeout(request,NAV_TIMEOUT_MS);if(response.ok){const cache=await caches.open(CACHE);await cache.put('/',response.clone());}return response;}catch{return (await caches.match('/'))||(await caches.match(request))||Response.error();}})());return;
  }
  // Executable UI assets are network-first. Versioned script URLs in index.html also
  // bypass older cache entries even when an older worker is still controlling the tab.
  if(request.destination==='script'||request.destination==='style'||request.destination==='worker'){
    event.respondWith(networkFirst(request,ASSET_TIMEOUT_MS));return;
  }
  event.respondWith((async()=>{const cached=await caches.match(request);const refresh=fetch(request,{cache:'no-cache'}).then(response=>cacheResponse(request,response)).catch(()=>null);if(cached){event.waitUntil(refresh.then(()=>{}));return cached;}return (await refresh)||Response.error();})());
});
