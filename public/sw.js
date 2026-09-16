// Previous release marker retained for compatibility gate: ai-thiet-chan-v2.9.8-knowledge-5doc-complete
const CACHE='ai-thiet-chan-v2.9.9-analysis-hotfix';
const SHELL=['/','/styles.css','/history.css','/dual-view.css','/settings.css','/quality-dashboard.css','/release-ui.css','/app.js','/image-enhancement.js','/capture-metadata.js','/analysis-hotfix.js','/benchmark-telemetry.js','/consultation.js','/session-persistence.js','/clinical-learning.js','/feedback-lifecycle.js','/torch.js','/settings.js','/quality-dashboard.js','/ui-controls.js','/admin-center.js','/admin-credentials.js','/upload-controls.js','/release-ui.js','/academic-vision.js','/manifest.webmanifest','/icon.svg','/open-source.html'];
const NAV_TIMEOUT_MS=2500;

try{importScripts('/academic-vision.js');}catch{}
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
async function fetchWithTimeout(request,timeoutMs=NAV_TIMEOUT_MS){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(request,{cache:'no-cache',signal:controller.signal});}finally{clearTimeout(timer);}}
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
    event.respondWith((async()=>{try{const response=await fetchWithTimeout(request);if(response.ok){const cache=await caches.open(CACHE);cache.put('/',response.clone());}return response;}catch{return (await caches.match('/'))||(await caches.match(request))||Response.error();}})());return;
  }
  event.respondWith((async()=>{const cached=await caches.match(request);const refresh=fetch(request,{cache:'no-cache'}).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;}).catch(()=>null);if(cached){event.waitUntil(refresh.then(()=>{}));return cached;}return (await refresh)||Response.error();})());
});
