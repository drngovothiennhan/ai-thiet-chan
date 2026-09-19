#!/usr/bin/env node
import fs from 'node:fs';

export const VISUAL_MENTOR_GATE=Object.freeze({
  version:'aitc-visual-mentor-gate-v1',
  minimumRows:50,
  minimumSupportPerField:10,
  minimumMicroAgreement:.95,
  minimumMacroAgreement:.95,
  minimumPerFieldAgreement:.95,
  requireZeroSafetyLeaks:true,
  clinicalAccuracy:false,
  interpretation:'engineering structured-observation agreement with independent mentor labels; not clinical diagnostic accuracy'
});

export const VISUAL_MENTOR_FIELDS=Object.freeze([
  'bodyColor',
  'coatingColor',
  'coatingThickness',
  'coatingDistribution',
  'medianSulcus',
  'fissure',
  'moistureSurface',
  'moistureBody',
  'moistureCoating',
  'toothmarks',
  'tongueShape',
  'coatingTexture',
  'stasisSmallSpot',
  'stasisPatch',
  'ventralVesselColor',
  'ventralBilateralStructure'
]);

function norm(v){
  if(v===true||v===false)return v?'true':'false';
  return String(v??'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ').trim();
}
function known(v){
  if(v===true||v===false)return true;
  const n=norm(v);
  return Boolean(n&&!['unknown','khong xac dinh','n a','na','not assessed','not-assessed'].includes(n));
}
function equalValue(a,b){return known(a)&&known(b)&&norm(a)===norm(b);}
function fieldValue(obj,field){return obj&&Object.prototype.hasOwnProperty.call(obj,field)?obj[field]:null;}

export function evaluateVisualMentorAgreement(rows,policy=VISUAL_MENTOR_GATE){
  if(!Array.isArray(rows)||!rows.length)throw new Error('VISUAL_MENTOR_ROWS_REQUIRED');
  const seen=new Set(),manifestDigests=new Set(),candidateVersions=new Set();
  const SHA=/^[0-9a-f]{64}$/i;
  const fields=Object.fromEntries(VISUAL_MENTOR_FIELDS.map(field=>[field,{support:0,matches:0,mismatches:0,agreement:null}]));
  let microSupport=0,microMatches=0,safetyLeaks=0,usableRows=0,poorQcRows=0,mentorUnknownSlots=0;
  const safetyLeakSamples=[];
  for(const row of rows){
    if(row?.schemaVersion!=='aitc-visual-mentor-row-v1')throw new Error('VISUAL_MENTOR_SCHEMA_INVALID');
    if(row?.independentHoldout!==true)throw new Error('INDEPENDENT_HOLDOUT_REQUIRED');
    if(row?.mentorLocked!==true||row?.mentorBlindToCandidate!==true)throw new Error('MENTOR_BLIND_LOCK_REQUIRED');
    const imageSha=String(row?.imageSha256||''),groupHash=String(row?.groupHash||''),manifestSha=String(row?.holdoutManifestSha256||'');
    if(!SHA.test(imageSha))throw new Error('IMAGE_SHA256_REQUIRED');
    if(!SHA.test(groupHash))throw new Error('GROUP_HASH_REQUIRED');
    if(!SHA.test(manifestSha))throw new Error('HOLDOUT_MANIFEST_SHA256_REQUIRED');
    manifestDigests.add(manifestSha.toLowerCase());
    const candidateVersion=String(row?.candidateVersion||'');if(!candidateVersion)throw new Error('CANDIDATE_VERSION_REQUIRED');
    candidateVersions.add(candidateVersion);
    const role=String(row?.role||'');if(!['dorsal','ventral'].includes(role))throw new Error('ROLE_INVALID');
    const id=String(row.sampleId||'');if(!id)throw new Error('SAMPLE_ID_REQUIRED');
    if(seen.has(id))throw new Error('DUPLICATE_SAMPLE_ID');seen.add(id);
    const mentor=row.mentor&&typeof row.mentor==='object'?row.mentor:{};
    const candidate=row.candidate&&typeof row.candidate==='object'?row.candidate:{};
    const qc=String(row?.qc?.grade||'poor');
    if(qc==='poor'){
      poorQcRows++;
      for(const field of VISUAL_MENTOR_FIELDS){
        const cv=fieldValue(candidate,field);
        if(known(cv)){safetyLeaks++;if(safetyLeakSamples.length<25)safetyLeakSamples.push({sampleId:id,field,reason:'candidate-known-on-poor-qc'});}
      }
      continue;
    }
    usableRows++;
    for(const field of VISUAL_MENTOR_FIELDS){
      const mv=fieldValue(mentor,field),cv=fieldValue(candidate,field);
      if(!known(mv)){
        mentorUnknownSlots++;
        if(known(cv)){safetyLeaks++;if(safetyLeakSamples.length<25)safetyLeakSamples.push({sampleId:id,field,reason:'candidate-known-when-mentor-unknown'});}
        continue;
      }
      const f=fields[field];f.support++;microSupport++;
      if(equalValue(mv,cv)){f.matches++;microMatches++;}else f.mismatches++;
    }
  }
  if(manifestDigests.size!==1)throw new Error('MIXED_HOLDOUT_MANIFESTS');
  if(candidateVersions.size!==1)throw new Error('MIXED_CANDIDATE_VERSIONS');
  for(const field of VISUAL_MENTOR_FIELDS){
    const f=fields[field];f.agreement=f.support?f.matches/f.support:null;
  }
  const supported=VISUAL_MENTOR_FIELDS.filter(field=>fields[field].support>=policy.minimumSupportPerField);
  const insufficient=VISUAL_MENTOR_FIELDS.filter(field=>fields[field].support<policy.minimumSupportPerField);
  const macroAgreement=supported.length?supported.reduce((sum,field)=>sum+fields[field].agreement,0)/supported.length:null;
  const microAgreement=microSupport?microMatches/microSupport:null;
  const lowAgreementFields=VISUAL_MENTOR_FIELDS.filter(field=>fields[field].support>=policy.minimumSupportPerField&&fields[field].agreement<policy.minimumPerFieldAgreement);
  const gates={
    minimumRows:rows.length>=policy.minimumRows,
    perFieldSupport:insufficient.length===0,
    perFieldAgreement:lowAgreementFields.length===0,
    microAgreement:microAgreement!==null&&microAgreement>=policy.minimumMicroAgreement,
    macroAgreement:macroAgreement!==null&&macroAgreement>=policy.minimumMacroAgreement,
    failClosedSafety:policy.requireZeroSafetyLeaks?safetyLeaks===0:true
  };
  const productionPromotionEligible=Object.values(gates).every(Boolean);
  return {
    schemaVersion:'aitc-visual-mentor-benchmark-v1',
    gateVersion:policy.version,
    metricSemantics:policy.interpretation,
    clinicalAccuracy:false,
    rowCount:rows.length,
    holdoutManifestSha256:[...manifestDigests][0],
    candidateVersion:[...candidateVersions][0],
    usableRows,
    poorQcRows,
    micro:{support:microSupport,matches:microMatches,agreement:microAgreement},
    macro:{supportedFieldCount:supported.length,agreement:macroAgreement},
    fields,
    insufficientSupportFields:insufficient,
    lowAgreementFields,
    mentorUnknownSlots,
    safetyLeaks,
    safetyLeakSamples,
    thresholds:{
      minimumRows:policy.minimumRows,
      minimumSupportPerField:policy.minimumSupportPerField,
      minimumMicroAgreement:policy.minimumMicroAgreement,
      minimumMacroAgreement:policy.minimumMacroAgreement,
      minimumPerFieldAgreement:policy.minimumPerFieldAgreement,
      requireZeroSafetyLeaks:policy.requireZeroSafetyLeaks
    },
    gates,
    productionPromotionEligible,
    productionActivation:'none'
  };
}

function parseJsonl(path){
  return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line);}catch{throw new Error('INVALID_JSONL_LINE_'+(i+1));}
  });
}
if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2],output=process.argv[3];
  if(!input)throw new Error('USAGE: evaluate_visual_mentor_agreement.mjs <input.jsonl> [output.json]');
  const result=evaluateVisualMentorAgreement(parseJsonl(input));
  const payload=JSON.stringify(result,null,2)+'\n';
  if(output)fs.writeFileSync(output,payload);else process.stdout.write(payload);
}
