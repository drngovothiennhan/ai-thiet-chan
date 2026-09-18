#!/usr/bin/env node
import fs from 'node:fs';

export function decodeRle(rle){
  if(!rle||!Array.isArray(rle.size)||rle.size.length!==2||!Array.isArray(rle.counts))throw new Error('RLE_INVALID');
  const [h,w]=rle.size.map(Number);
  if(!Number.isInteger(h)||!Number.isInteger(w)||h<=0||w<=0)throw new Error('RLE_SIZE_INVALID');
  const total=h*w,out=new Uint8Array(total);
  let value=0,index=0;
  for(const raw of rle.counts){
    const count=Number(raw);
    if(!Number.isInteger(count)||count<0)throw new Error('RLE_COUNT_INVALID');
    const end=index+count;
    if(end>total)throw new Error('RLE_OVERFLOW');
    if(value===1)out.fill(1,index,end);
    index=end;value=value?0:1;
  }
  if(index!==total)throw new Error('RLE_LENGTH_MISMATCH');
  return {h,w,data:out};
}

export function diceIou(gold,pred){
  if(gold.h!==pred.h||gold.w!==pred.w)throw new Error('MASK_SIZE_MISMATCH');
  let g=0,p=0,intersection=0;
  for(let i=0;i<gold.data.length;i++){
    const gv=gold.data[i]===1,pv=pred.data[i]===1;
    if(gv)g++;if(pv)p++;if(gv&&pv)intersection++;
  }
  const union=g+p-intersection;
  return {
    dice:g+p?2*intersection/(g+p):1,
    iou:union?intersection/union:1,
    goldPixels:g,predPixels:p,intersection
  };
}

function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function xorshift(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function bootstrapMean(values,iterations=2000,seed=20260918){
  if(!values.length)return null;
  if(values.length===1)return {lower:values[0],upper:values[0],iterations:0};
  const rand=xorshift(seed),samples=[];
  for(let b=0;b<iterations;b++){
    let sum=0;
    for(let i=0;i<values.length;i++)sum+=values[Math.floor(rand()*values.length)];
    samples.push(sum/values.length);
  }
  samples.sort((a,b)=>a-b);
  const q=p=>samples[Math.min(samples.length-1,Math.max(0,Math.floor(p*(samples.length-1))))];
  return {lower:q(.025),upper:q(.975),iterations};
}

export function evaluateRows(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error('GOLD_HOLDOUT_ROWS_REQUIRED');
  const holdoutVersions=new Set(),modelShas=new Set(),sampleIds=new Set();
  const usable=[],excluded=[];
  let tp=0,tn=0,fp=0,fn=0;

  for(const row of rows){
    if(row?.schema_version!=='aitc-gold-eval-row-v1')throw new Error('GOLD_EVAL_SCHEMA_INVALID');
    if(row?.holdout_locked!==true)throw new Error('HOLDOUT_MUST_BE_LOCKED');
    if(row?.gold?.status!=='adjudicated_gold')throw new Error('ADJUDICATED_GOLD_REQUIRED');
    if(!row?.holdout_version)throw new Error('HOLDOUT_VERSION_REQUIRED');
    if(!/^[0-9a-f]{64}$/i.test(String(row?.candidate?.model_sha256||'')))throw new Error('MODEL_SHA256_REQUIRED');
    if(sampleIds.has(row.sample_id))throw new Error('DUPLICATE_SAMPLE_ID');
    sampleIds.add(row.sample_id);holdoutVersions.add(row.holdout_version);modelShas.add(row.candidate.model_sha256);

    const quality=String(row.gold.image_quality||'');
    if(quality!=='usable'){
      excluded.push({sample_id:row.sample_id,image_quality:quality||'missing'});
      continue;
    }
    const goldPresent=row.gold.tongue_present===true;
    const predPresent=row.candidate.tongue_present===true;
    if(goldPresent&&predPresent)tp++; else if(goldPresent&&!predPresent)fn++; else if(!goldPresent&&predPresent)fp++; else tn++;

    const entry={sample_id:row.sample_id,goldPresent,predPresent,dice:null,iou:null};
    if(goldPresent){
      if(!row.gold.roi_mask_rle)throw new Error('GOLD_MASK_REQUIRED');
      if(!row.candidate.roi_mask_rle)throw new Error('CANDIDATE_MASK_REQUIRED');
      const score=diceIou(decodeRle(row.gold.roi_mask_rle),decodeRle(row.candidate.roi_mask_rle));
      entry.dice=score.dice;entry.iou=score.iou;
    }
    usable.push(entry);
  }

  if(holdoutVersions.size!==1)throw new Error('MIXED_HOLDOUT_VERSIONS');
  if(modelShas.size!==1)throw new Error('MIXED_MODEL_ARTIFACTS');

  const positiveMasks=usable.filter(x=>x.goldPresent);
  const dice=positiveMasks.map(x=>x.dice),iou=positiveMasks.map(x=>x.iou);
  const sensitivity=(tp+fn)?tp/(tp+fn):null;
  const specificity=(tn+fp)?tn/(tn+fp):null;
  const presenceAccuracy=(tp+tn)/(tp+tn+fp+fn);

  return {
    schemaVersion:'aitc-gold-holdout-metrics-v1',
    metricSemantics:'agreement with independent adjudicated gold for tongue presence/ROI; not clinical diagnostic accuracy',
    holdoutVersion:[...holdoutVersions][0],
    modelSha256:[...modelShas][0],
    sampleCount:rows.length,
    usableCount:usable.length,
    excludedCount:excluded.length,
    excluded,
    presence:{
      tp,tn,fp,fn,
      sensitivity,
      specificity,
      accuracy:presenceAccuracy
    },
    roi:{
      evaluatedPositiveMasks:positiveMasks.length,
      meanDice:mean(dice),
      meanIoU:mean(iou),
      dice95BootstrapCI:bootstrapMean(dice),
      iou95BootstrapCI:bootstrapMean(iou)
    },
    perSample:usable,
    promotionDecision:'none',
    productionActivation:'none'
  };
}

function parseJsonl(path){
  return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line);}catch{throw new Error(`INVALID_JSONL_LINE_${i+1}`);}
  });
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2],output=process.argv[3];
  if(!input)throw new Error('USAGE: evaluate_gold_holdout.mjs <input.jsonl> [output.json]');
  const result=evaluateRows(parseJsonl(input));
  const text=JSON.stringify(result,null,2)+'\n';
  if(output)fs.writeFileSync(output,text);else process.stdout.write(text);
}
