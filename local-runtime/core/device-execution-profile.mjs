export const DEVICE_EXECUTION_PROFILE_VERSION = 'aitc-device-execution-profile-v1';

const INPUT_SIDE_BY_TIER = Object.freeze({L0:384,L1:512,L2:640,L3:704,L4:768});
const VALID_PLATFORM = new Set(['android','windows']);
const VALID_ACCELERATOR_TYPES = new Set(['cpu','gpu','npu']);

function finiteOrNull(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:null;
}

function normalizeAccelerator(raw={}){
  const type=String(raw.type||'').toLowerCase();
  if(!VALID_ACCELERATOR_TYPES.has(type))return null;
  const provider=String(raw.provider||'').trim();
  if(!provider)return null;
  return Object.freeze({
    id:String(raw.id||provider).slice(0,120),
    type,
    provider:provider.slice(0,120),
    ready:raw.ready===true,
    precisions:Object.freeze([...new Set((Array.isArray(raw.precisions)?raw.precisions:[]).map(x=>String(x).toLowerCase()).filter(x=>['fp32','fp16','int8'].includes(x)))])
  });
}

export function normalizeDeviceProbe(raw={}){
  const platform=String(raw.platform||'').toLowerCase();
  return Object.freeze({
    schemaVersion:'aitc-device-probe-v1',
    platform:VALID_PLATFORM.has(platform)?platform:'unknown',
    osVersion:String(raw.osVersion||'').slice(0,120),
    arch:String(raw.arch||'unknown').slice(0,80),
    logicalCores:Math.max(1,Math.trunc(finiteOrNull(raw.logicalCores)||1)),
    memoryMb:finiteOrNull(raw.memoryMb),
    storageFreeMb:finiteOrNull(raw.storageFreeMb),
    accelerators:Object.freeze((Array.isArray(raw.accelerators)?raw.accelerators:[]).map(normalizeAccelerator).filter(Boolean)),
    limitations:Object.freeze((Array.isArray(raw.limitations)?raw.limitations:[]).map(x=>String(x).slice(0,240)).filter(Boolean))
  });
}

function normalizeBenchmark(raw={}){
  const medianMs=finiteOrNull(raw.medianMs);
  const provider=String(raw.provider||'').trim();
  if(!provider||medianMs===null)return null;
  return Object.freeze({
    provider:provider.slice(0,120),
    success:raw.success===true,
    medianMs,
    inputSide:Math.max(0,Math.trunc(finiteOrNull(raw.inputSide)||0)),
    memoryMb:finiteOrNull(raw.memoryMb),
    thermalLimited:raw.thermalLimited===true,
    errorCode:raw.errorCode?String(raw.errorCode).slice(0,120):null
  });
}

function choosePrecision(accelerator){
  const p=accelerator?.precisions||[];
  if(p.includes('int8'))return 'int8';
  if(p.includes('fp16'))return 'fp16';
  return 'fp32';
}

function rankBenchmarks(probe,benchmarks){
  const byProvider=new Map(probe.accelerators.filter(x=>x.ready).map(x=>[x.provider,x]));
  const valid=benchmarks.map(normalizeBenchmark).filter(Boolean).filter(x=>x.success&&!x.thermalLimited&&byProvider.has(x.provider));
  valid.sort((a,b)=>a.medianMs-b.medianMs);
  return valid.map(b=>({benchmark:b,accelerator:byProvider.get(b.provider)}));
}

function tierFor({probe,best}){
  const memory=probe.memoryMb;
  const ms=best?.benchmark?.medianMs ?? Infinity;
  const accel=best?.accelerator?.type||'cpu';
  if(memory!==null&&memory<3072)return 'L0';
  if(!Number.isFinite(ms))return 'L0';
  if(ms<=40&&memory!==null&&memory>=8192&&(accel==='gpu'||accel==='npu'))return 'L4';
  if(ms<=70&&memory!==null&&memory>=6144&&(accel==='gpu'||accel==='npu'))return 'L3';
  if(ms<=120&&(accel==='gpu'||accel==='npu'))return 'L2';
  if(ms<=250)return 'L1';
  return 'L0';
}

export function selectDeviceExecutionProfile(rawProbe={},rawBenchmarks=[]){
  const probe=normalizeDeviceProbe(rawProbe);
  const ranked=rankBenchmarks(probe,Array.isArray(rawBenchmarks)?rawBenchmarks:[]);
  const best=ranked[0]||null;
  const fallbackCpu=probe.accelerators.find(x=>x.ready&&x.type==='cpu')||null;
  const accelerator=best?.accelerator||fallbackCpu;
  const tier=tierFor({probe,best});
  const activeBackend=accelerator?.provider||'unavailable';
  const degraded=activeBackend==='unavailable'||!best;
  const reasons=[];
  if(activeBackend==='unavailable')reasons.push('no-ready-execution-provider');
  if(!best)reasons.push('no-successful-benchmark');
  if(probe.memoryMb!==null&&probe.memoryMb<3072)reasons.push('memory-below-3072mb');
  if(best?.benchmark?.thermalLimited)reasons.push('thermal-limited');
  return Object.freeze({
    schemaVersion:DEVICE_EXECUTION_PROFILE_VERSION,
    platform:probe.platform,
    tier,
    activeBackend,
    acceleratorType:accelerator?.type||'unknown',
    precision:accelerator?choosePrecision(accelerator):'fp32',
    inputSide:INPUT_SIDE_BY_TIER[tier],
    batchSize:1,
    multipass:['L3','L4'].includes(tier),
    degraded,
    benchmark:best?Object.freeze({...best.benchmark}):null,
    reasons:Object.freeze(reasons),
    probe
  });
}

export function degradeExecutionProfile(profile={},errorCode='runtime-error'){
  const tierOrder=['L0','L1','L2','L3','L4'];
  const current=tierOrder.includes(profile.tier)?profile.tier:'L0';
  const next=tierOrder[Math.max(0,tierOrder.indexOf(current)-1)];
  return Object.freeze({
    ...profile,
    schemaVersion:DEVICE_EXECUTION_PROFILE_VERSION,
    tier:next,
    inputSide:INPUT_SIDE_BY_TIER[next],
    batchSize:1,
    multipass:false,
    degraded:true,
    reasons:Object.freeze([...(Array.isArray(profile.reasons)?profile.reasons:[]),String(errorCode).slice(0,120)])
  });
}
