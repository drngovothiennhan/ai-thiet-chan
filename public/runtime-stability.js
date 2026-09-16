(()=>{
'use strict';
if(window.AITCRuntime?.version)return;
const VERSION='sustainable-core-v1';
const state={version:VERSION,longTasks:0,maxLongTaskMs:0,errors:0,rejections:0,degraded:false,recoveredAfterInterruptedBoot:false,startedAt:Date.now()};
const BOOT_KEY='aitc-runtime-boot-marker-v1';
try{
  const previous=Number(sessionStorage.getItem(BOOT_KEY)||0);
  if(previous&&Date.now()-previous<120000)state.recoveredAfterInterruptedBoot=true;
  sessionStorage.setItem(BOOT_KEY,String(Date.now()));
  setTimeout(()=>{try{sessionStorage.removeItem(BOOT_KEY);}catch{}},8000);
}catch{}
function whenIdle(fn,timeout=2500){
  if(typeof requestIdleCallback==='function')return requestIdleCallback(()=>fn(),{timeout});
  return setTimeout(fn,Math.min(900,timeout));
}
function withTimeout(promise,ms=8000,label='AITC_TIMEOUT'){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);});
  return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
}
function stopActiveCamera(){
  try{
    const video=document.getElementById('video');
    const stream=video?.srcObject;
    if(stream?.getTracks)stream.getTracks().forEach(track=>{try{track.stop();}catch{}});
    if(video)video.srcObject=null;
  }catch{}
}
try{
  if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
    const observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        const duration=Math.round(entry.duration||0);
        if(duration<50)continue;
        state.longTasks+=1;
        state.maxLongTaskMs=Math.max(state.maxLongTaskMs,duration);
        if(duration>=120||state.longTasks>=5)state.degraded=true;
      }
    });
    observer.observe({entryTypes:['longtask']});
  }
}catch{}
window.addEventListener('error',()=>{state.errors+=1;},{passive:true});
window.addEventListener('unhandledrejection',()=>{state.rejections+=1;},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopActiveCamera();},{passive:true});
window.addEventListener('pagehide',stopActiveCamera,{passive:true});
window.AITCRuntime={
  version:VERSION,
  state,
  whenIdle,
  withTimeout,
  stopActiveCamera,
  snapshot:()=>({...state,uptimeMs:Date.now()-state.startedAt})
};
})();