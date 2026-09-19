#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const SHA=/^[0-9a-f]{64}$/i;
export const HOLDOUT_SCHEMA='aitc-visual-mentor-holdout-v1';
export const MENTOR_SCHEMA='aitc-visual-mentor-label-v1';
export const CANDIDATE_SCHEMA='aitc-visual-candidate-observation-v1';

function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function sha256Text(value){return crypto.createHash('sha256').update(value).digest('hex');}
function ensureSha(value,code){const v=String(value||'');if(!SHA.test(v))throw new Error(code);return v.toLowerCase();}
function indexUnique(rows,key,schema,duplicateCode){
  const out=new Map();
  for(const row of rows){
    if(row?.schemaVersion!==schema)throw new Error('SCHEMA_INVALID_'+schema);
    const id=String(row?.[key]||'');if(!id)throw new Error('SAMPLE_ID_REQUIRED');
    if(out.has(id))throw new Error(duplicateCode);
    out.set(id,row);
  }
  return out;
}

export function holdoutManifestDigest(manifest){
  const canonical={
    schemaVersion:manifest.schemaVersion,
    locked:Boolean(manifest.locked),
    labelBlind:Boolean(manifest.labelBlind),
    candidateBlind:Boolean(manifest.candidateBlind),
    policyVersion:String(manifest.policyVersion||''),
    members:(Array.isArray(manifest.members)?manifest.members:[]).map(m=>({
      sampleId:String(m.sampleId||''),
      imageSha256:String(m.imageSha256||'').toLowerCase(),
      groupHash:String(m.groupHash||'').toLowerCase(),
      role:String(m.role||''),
      qcGrade:String(m.qcGrade||'')
    })).sort((a,b)=>a.sampleId.localeCompare(b.sampleId))
  };
  return sha256Text(stable(canonical));
}

export function buildVisualMentorEvidence(manifest,mentorRows,candidateRows){
  if(manifest?.schemaVersion!==HOLDOUT_SCHEMA)throw new Error('HOLDOUT_SCHEMA_INVALID');
  if(manifest.locked!==true)throw new Error('HOLDOUT_MUST_BE_LOCKED');
  if(manifest.labelBlind!==true||manifest.candidateBlind!==true)throw new Error('HOLDOUT_BLINDING_REQUIRED');
  const members=Array.isArray(manifest.members)?manifest.members:[];
  if(!members.length)throw new Error('HOLDOUT_MEMBERS_REQUIRED');

  const memberMap=new Map();
  const groups=new Map();
  for(const m of members){
    const sampleId=String(m?.sampleId||'');if(!sampleId)throw new Error('HOLDOUT_SAMPLE_ID_REQUIRED');
    if(memberMap.has(sampleId))throw new Error('DUPLICATE_HOLDOUT_SAMPLE_ID');
    const imageSha256=ensureSha(m.imageSha256,'HOLDOUT_IMAGE_SHA_REQUIRED');
    const groupHash=ensureSha(m.groupHash,'HOLDOUT_GROUP_HASH_REQUIRED');
    const role=String(m.role||'');if(!['dorsal','ventral'].includes(role))throw new Error('HOLDOUT_ROLE_INVALID');
    const qcGrade=String(m.qcGrade||'');if(!['good','acceptable','poor'].includes(qcGrade))throw new Error('HOLDOUT_QC_INVALID');
    const prior=groups.get(imageSha256);if(prior&&prior!==groupHash)throw new Error('SAME_IMAGE_DIFFERENT_GROUP');
    groups.set(imageSha256,groupHash);
    memberMap.set(sampleId,{sampleId,imageSha256,groupHash,role,qcGrade});
  }

  const mentorMap=indexUnique(mentorRows,'sampleId',MENTOR_SCHEMA,'DUPLICATE_MENTOR_SAMPLE_ID');
  const candidateMap=indexUnique(candidateRows,'sampleId',CANDIDATE_SCHEMA,'DUPLICATE_CANDIDATE_SAMPLE_ID');
  const candidateVersions=new Set();
  const out=[];
  for(const member of memberMap.values()){
    const mentor=mentorMap.get(member.sampleId);if(!mentor)throw new Error('MENTOR_LABEL_MISSING');
    const candidate=candidateMap.get(member.sampleId);if(!candidate)throw new Error('CANDIDATE_OBSERVATION_MISSING');
    const mentorSha=ensureSha(mentor.imageSha256,'MENTOR_IMAGE_SHA_REQUIRED');
    const candidateSha=ensureSha(candidate.imageSha256,'CANDIDATE_IMAGE_SHA_REQUIRED');
    if(mentorSha!==member.imageSha256||candidateSha!==member.imageSha256)throw new Error('IMAGE_SHA_MISMATCH');
    if(mentor.blindToCandidate!==true||mentor.modelOutputVisible===true)throw new Error('MENTOR_MUST_BE_CANDIDATE_BLIND');
    if(mentor.locked!==true)throw new Error('MENTOR_LABEL_MUST_BE_LOCKED');
    if(!mentor.labels||typeof mentor.labels!=='object')throw new Error('MENTOR_LABELS_REQUIRED');
    if(!candidate.labels||typeof candidate.labels!=='object')throw new Error('CANDIDATE_LABELS_REQUIRED');
    const candidateVersion=String(candidate.candidateVersion||'');if(!candidateVersion)throw new Error('CANDIDATE_VERSION_REQUIRED');
    candidateVersions.add(candidateVersion);
    out.push({
      schemaVersion:'aitc-visual-mentor-row-v1',
      sampleId:member.sampleId,
      imageSha256:member.imageSha256,
      groupHash:member.groupHash,
      role:member.role,
      holdoutManifestSha256:null,
      independentHoldout:true,
      mentorLocked:true,
      mentorBlindToCandidate:true,
      candidateVersion,
      qc:{grade:member.qcGrade},
      mentor:mentor.labels,
      candidate:candidate.labels
    });
  }
  if(candidateVersions.size!==1)throw new Error('MIXED_CANDIDATE_VERSIONS');
  if(mentorMap.size!==memberMap.size||candidateMap.size!==memberMap.size)throw new Error('EXTRA_ROWS_OUTSIDE_LOCKED_HOLDOUT');
  const manifestSha256=holdoutManifestDigest(manifest);
  for(const row of out)row.holdoutManifestSha256=manifestSha256;
  return {schemaVersion:'aitc-visual-mentor-evidence-v1',holdoutManifestSha256:manifestSha256,candidateVersion:[...candidateVersions][0],rows:out};
}

function parseJsonl(path){
  return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line);}catch{throw new Error('INVALID_JSONL_LINE_'+(i+1)+'_'+path);}
  });
}
if(import.meta.url===`file://${process.argv[1]}`){
  const [manifestPath,mentorPath,candidatePath,outputPath]=process.argv.slice(2);
  if(!manifestPath||!mentorPath||!candidatePath)throw new Error('USAGE: build_visual_mentor_evidence.mjs <holdout.json> <mentor.jsonl> <candidate.jsonl> [output.jsonl]');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const result=buildVisualMentorEvidence(manifest,parseJsonl(mentorPath),parseJsonl(candidatePath));
  const payload=result.rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
  if(outputPath)fs.writeFileSync(outputPath,payload);else process.stdout.write(payload);
}
