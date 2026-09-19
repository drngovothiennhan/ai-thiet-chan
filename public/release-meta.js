(()=>{
  'use strict';
  const RELEASE_ID='2026.09.20-stasis-ventral-topography-r1';
  globalThis.AITC_RELEASE_ID=RELEASE_ID;
  globalThis.AITC_RELEASE_META=Object.freeze({releaseId:RELEASE_ID,schemaVersion:'release-meta-v1',deviceRuntime:'device-runtime-v2',deviceAnalysisSchema:'device-analysis-payload-v2',deviceWorker:'device-analysis-worker-v4',groundTruthProfile:'owner-ground-truth-profile-v1'});
  if(typeof document!=='undefined'&&!document.querySelector('script[data-aitc-device-runtime]')){
    const script=document.createElement('script');
    script.src='/device-runtime.js';
    script.async=true;
    script.dataset.aitcDeviceRuntime='1';
    document.head.appendChild(script);
  }
})();
