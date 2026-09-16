(()=>{
  'use strict';

  const VERSION='hardware-profile-v1';

  function numberOrNull(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?n:null;
  }

  function connectionClass(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c)return 'unknown';
    if(c.saveData)return 'save-data';
    const type=String(c.effectiveType||'').toLowerCase();
    if(type==='slow-2g'||type==='2g')return 'slow';
    if(type==='3g')return 'moderate';
    if(type==='4g')return 'fast';
    return 'unknown';
  }

  function classify({logicalCores,deviceMemoryGb,network}){
    let score=1;
    const reasons=[];

    if(logicalCores!==null){
      if(logicalCores<=4){score-=1;reasons.push('cores<=4');}
      else if(logicalCores>=8){score+=1;reasons.push('cores>=8');}
    }
    if(deviceMemoryGb!==null){
      if(deviceMemoryGb<=4){score-=1;reasons.push('memory<=4gb');}
      else if(deviceMemoryGb>=8){score+=1;reasons.push('memory>=8gb');}
    }
    if(network==='save-data'||network==='slow'){score-=1;reasons.push(network);}

    const tier=score<=0?'constrained':score>=3?'high':'balanced';
    return {tier,reasons};
  }

  function detect(){
    const logicalCores=numberOrNull(navigator.hardwareConcurrency);
    const deviceMemoryGb=numberOrNull(navigator.deviceMemory);
    const network=connectionClass();
    const classified=classify({logicalCores,deviceMemoryGb,network});
    return Object.freeze({
      version:VERSION,
      tier:classified.tier,
      reasons:Object.freeze([...classified.reasons]),
      logicalCores,
      deviceMemoryGb,
      network,
      capabilities:Object.freeze({
        offscreenCanvas:typeof OffscreenCanvas!=='undefined',
        createImageBitmap:typeof createImageBitmap==='function',
        webWorker:typeof Worker!=='undefined',
        requestIdleCallback:typeof requestIdleCallback==='function'
      })
    });
  }

  function imagePolicy(profile=detect(),{frontCamera=false}={}){
    const tier=profile?.tier||'balanced';
    if(tier==='constrained'){
      return Object.freeze({
        tier,
        maxOutputSide:frontCamera?1500:1440,
        targetSide:frontCamera?1500:1440,
        maxOutputPixels:2_000_000,
        maxUpscale:frontCamera?1.75:1.55,
        multipassThreshold:1.65,
        allowRecoverableSharpen:true,
        sharpenScale:0.75
      });
    }
    if(tier==='high'){
      return Object.freeze({
        tier,
        maxOutputSide:1800,
        targetSide:frontCamera?1800:1600,
        maxOutputPixels:3_200_000,
        maxUpscale:frontCamera?2.2:2.0,
        multipassThreshold:1.45,
        allowRecoverableSharpen:true,
        sharpenScale:1
      });
    }
    return Object.freeze({
      tier:'balanced',
      maxOutputSide:frontCamera?1680:1600,
      targetSide:frontCamera?1680:1600,
      maxOutputPixels:2_600_000,
      maxUpscale:frontCamera?2.0:1.8,
      multipassThreshold:1.55,
      allowRecoverableSharpen:true,
      sharpenScale:0.9
    });
  }

  const profile=detect();
  window.AITCHardwareProfile=Object.freeze({
    version:VERSION,
    profile,
    detect,
    classify,
    imagePolicy
  });
})();