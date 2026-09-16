(()=>{
'use strict';
if(window.AITCVisionWorker)return;
let worker=null,seq=0;
const pending=new Map();
function ensureWorker(){
  if(worker)return worker;
  if(typeof Worker!=='function')return null;
  worker=new Worker('/vision-worker.js');
  worker.onmessage=event=>{
    const msg=event.data||{},item=pending.get(msg.id);if(!item)return;
    pending.delete(msg.id);clearTimeout(item.timer);
    if(msg.ok)item.resolve(msg.result);else item.reject(new Error(msg.error||'VISION_WORKER_FAILED'));
  };
  worker.onerror=()=>{
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('VISION_WORKER_FAILED'));}
    pending.clear();try{worker.terminate();}catch{}worker=null;
  };
  return worker;
}
function analyze(dataUrl,view='top',timeoutMs=900){
  const w=ensureWorker();
  if(!w||!dataUrl)return Promise.resolve({supported:false,view,version:'vision-worker-v1'});
  const id=`vw-${Date.now()}-${++seq}`;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('VISION_WORKER_TIMEOUT'));},timeoutMs);
    pending.set(id,{resolve,reject,timer});
    w.postMessage({id,dataUrl,view});
  }).catch(()=>({supported:false,view,version:'vision-worker-v1'}));
}
function close(){if(worker){try{worker.terminate();}catch{}worker=null;}for(const item of pending.values()){clearTimeout(item.timer);item.resolve({supported:false,version:'vision-worker-v1'});}pending.clear();}
window.AITCVisionWorker={version:'vision-worker-v1',analyze,close};
window.addEventListener('pagehide',close,{once:true});
})();