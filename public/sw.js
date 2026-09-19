// Previous release marker retained for compatibility gate: ai-thiet-chan-v2.9.8-knowledge-5doc-complete
// Previous cache marker retained for regression compatibility: ai-thiet-chan-v2.9.15-rollback-mobile-layout
// Moisture vision generation marker: 2026.09.19-moisture-vision-r1
// Consultation duplicate-question hotfix marker: 2026.09.20-consult-dedup-yhct-r1
// Surface phenotype generation marker: 2026.09.20-surface-phenotype-r1
let RELEASE_ID='2026.09.17-hardening-r1';
try{importScripts('/release-meta.js');RELEASE_ID=String(self.AITC_RELEASE_ID||RELEASE_ID);}catch{}
const CACHE_PREFIX='ai-thiet-chan-shell-';
const CACHE=`${CACHE_PREFIX}${RELEASE_ID}`;
const REQUIRED_SHELL=['/','/release-meta.js','/styles.css','/app.js','/request-client.js','/access-control.js','/consultation-lock.js','/request-integrity.js','/manifest.webmanifest','/icon.svg'];
const OPTIONAL_SHELL=[
  '/history.css','/dual-view.css','/settings.css','/quality-dashboard.css','/release-ui.css',
  '/hardware-profile.js','/device-runtime.js','/device-analysis-worker.js','/ground-truth-profile.js',
  '/local-vision/model-manifest.js','/local-vision/model-runtime.js','/local-vision/shadow-pixel-mlp.js','/local-vision/shadow-worker.js','/local-vision/models/aitc-tongue-roi-mlp-bootstrap-v1.json',
  '/device-shadow-validation-v3.html',
  '/clinical-contribute-v1.html','/gold-review-v1.html',
  '/image-enhancement.js','/capture-metadata.js','/consultation.js','/settings.js','/quality-dashboard.js','/release-ui.js',
  '/book-fallback.js','/benchmark-telemetry.js','/admin-enhancement-collapse.js',
  '/session-persistence.js','/clinical-learning.js','/feedback-lifecycle.js','/torch.js','/ui-controls.js','/admin-center.js','/user-admin.js','/admin-credentials.js','/upload-controls.js',
  '/academic-vision.js','/academic-source.js','/academic-signature.js','/academic-atlas-a.js','/academic-atlas-b.js','/academic-atlas-thiet-chan-1.js','/academic-atlas-thiet-chan-2.js','/academic-atlas-thiet-chan-3.js','/academic-atlas-thiet-chan-4.js','/academic-page-meta.js','/academic-page-atlas-1.js','/academic-page-atlas-2.js','/academic-page-atlas-3.js','/academic-page-atlas-4.js','/academic-page-atlas-5.js','/open-source.html'
];
const NAV_TIMEOUT_MS=2500;

try{importScripts('/academic-vision.js');}catch{}

async function fetchFresh(path){
  const response=await fetch(path,{cache:'no-cache'});
  if(!response.ok)throw new Error(`SW_ASSET_${response.status}`);
  return response;
}
async function cacheRequired(cache){
  for(const path of REQUIRED_SHELL){const response=await fetchFresh(path);await cache.put(path,response.clone());}
}
async function cacheOptional(cache){
  await Promise.allSettled(OPTIONAL_SHELL.map(async path=>{const response=await fetchFresh(path);await cache.put(path,response.clone());}));
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cacheRequired(cache);
    await cacheOptional(cache);
    // Cache the complete shell first, then take over immediately. This repairs the
    // production update race where an old PWA shell can keep sending legacy visual
    // payloads after the server has already moved to the current verification contract.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event?.data?.type==='AITC_ACTIVATE_UPDATE')self.skipWaiting();
  if(event?.data?.type==='AITC_RELEASE_STATUS')event.source?.postMessage?.({type:'AITC_RELEASE_STATUS',releaseId:RELEASE_ID,cache:CACHE});
});

async function fetchWithTimeout(request,timeoutMs=NAV_TIMEOUT_MS){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{cache:'no-cache',signal:controller.signal});}finally{clearTimeout(timer);}
}
function base64Payload(dataUrl){const text=String(dataUrl||'');return text.includes(',')?text.slice(text.indexOf(',')+1):text;}
async function digestBase64Payload(dataUrl){
  try{
    const bytes=new TextEncoder().encode(base64Payload(dataUrl));
    const out=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(out)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch{return '';}
}
function hasCompleteDevicePayload(body){
  return Boolean(body?.deviceRuntime?.status==='complete'&&body?.academicSignature&&body?.academicSource?.execution==='device-worker'&&body?.academicSource?.topImageDigest);
}
async function enrichAnalyzeRequest(request){
  try{
    const body=await request.clone().json();
    const image=body?.topImage||body?.image;const vision=self.AITCAcademicVision;
    if(hasCompleteDevicePayload(body)){
      const claimed=String(body?.academicSource?.topImageDigest||'');
      const actual=await digestBase64Payload(image);
      if(actual&&claimed===actual)return request;
    }
    if(!image||!vision?.signatureFromDataUrl)return request;
    const signature=await vision.signatureFromDataUrl(image);if(!signature)return request;
    const topImageDigest=await digestBase64Payload(image);
    body.academicSignature=signature;
    body.academicSource={
      ...(vision.source||{}),
      execution:'service-worker-fallback',
      runtimeVersion:'service-worker-academic-vision-v1',
      schemaVersion:'legacy-academic-signature-v1',
      topImageDigest
    };
    const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.delete('content-length');
    return new Request(request,{headers,body:JSON.stringify(body)});
  }catch{return request;}
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.method==='POST'&&url.pathname==='/api/analyze'){
    event.respondWith((async()=>{
      const forwarded=await enrichAnalyzeRequest(request);
      return fetch(forwarded);
    })());return;
  }
  if(request.method!=='GET')return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
  if(['/release-meta.js','/release-ui.js','/release-ui.css'].includes(url.pathname)){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:'no-cache'});
        if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
        return response;
      }catch{return (await caches.match(request))||Response.error();}
    })());return;
  }
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetchWithTimeout(request);
        if(response.ok){const cache=await caches.open(CACHE);await cache.put('/',response.clone());}
        return response;
      }catch{return (await caches.match('/'))||(await caches.match(request))||Response.error();}
    })());return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const refresh=fetch(request,{cache:'no-cache'}).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
      return response;
    }).catch(()=>null);
    if(cached){event.waitUntil(refresh.then(()=>{}));return cached;}
    return (await refresh)||Response.error();
  })());
});
