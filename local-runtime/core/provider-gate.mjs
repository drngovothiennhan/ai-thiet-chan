export const PROVIDER_GATE_VERSION='aitc-provider-gate-v1';
export function readyProviders(probe={}){
  if(probe.onnxRuntimeLoadable!==true||!probe.activeVisionModel)return [];
  return (Array.isArray(probe.providers)?probe.providers:[]).filter(p=>
    p?.libraryLoadable===true&&
    p?.sessionLoadSuccess===true&&
    p?.benchmarkSuccess===true&&
    p?.outputValidated===true&&
    p?.ready===true
  );
}
export function selectReadyProvider(probe={}){
  const ready=readyProviders(probe);
  if(!ready.length)return {ready:false,provider:null,reason:'no-validated-benchmarked-provider'};
  const sorted=[...ready].sort((a,b)=>Number(a.benchmarkMs??Infinity)-Number(b.benchmarkMs??Infinity));
  return {ready:true,provider:sorted[0],reason:null};
}
