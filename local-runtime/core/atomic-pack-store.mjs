import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {verifyPackManifest,verifyArtifactBytes} from './pack-verifier.mjs';

export const ATOMIC_PACK_STORE_VERSION='aitc-atomic-pack-store-v1';
const STATE_SCHEMA='aitc-pack-state-v1';

function safeSegment(value){
  const out=String(value||'').slice(0,80).replace(/[^A-Za-z0-9._-]/g,'_');
  return out||'pack';
}
function validPath(value){
  const text=String(value||'');
  if(!text||text.includes('\\')||text.startsWith('/')||text.includes(':'))return false;
  return text.split('/').every(x=>x&&x!=='.'&&x!=='..');
}
function versionTuple(value){
  const m=String(value||'').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if(!m)throw new Error('PACK_VERSION_INVALID');
  return m.slice(1).map(Number);
}
function compareVersion(a,b){
  const aa=versionTuple(a),bb=versionTuple(b);
  for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}
  return 0;
}
function stateDir(root){const dir=path.join(root,'states');fs.mkdirSync(dir,{recursive:true});return dir;}
function versionDir(root){const dir=path.join(root,'versions');fs.mkdirSync(dir,{recursive:true});return dir;}
function stagingDir(root){const dir=path.join(root,'staging');fs.mkdirSync(dir,{recursive:true});return dir;}
function listStates(root){
  return fs.readdirSync(stateDir(root)).map(name=>{
    const m=name.match(/^state-(\d+)\.json$/);return m?{generation:Number(m[1]),path:path.join(stateDir(root),name)}:null;
  }).filter(Boolean).sort((a,b)=>a.generation-b.generation);
}
export function readPackState(root){
  for(const item of listStates(root).reverse()){
    try{const state=JSON.parse(fs.readFileSync(item.path,'utf8'));if(state.schemaVersion===STATE_SCHEMA)return state;}catch{}
  }
  return {schemaVersion:STATE_SCHEMA,generation:0,active:null,previous:null};
}
function writeState(root,state){
  const next={...state,schemaVersion:STATE_SCHEMA,generation:Number(state.generation||0)+1};
  const dir=stateDir(root),tmp=path.join(dir,'state-'+next.generation+'.tmp'),dest=path.join(dir,'state-'+next.generation+'.json');
  const fd=fs.openSync(tmp,'w');
  try{fs.writeFileSync(fd,JSON.stringify(next,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(tmp,dest);
  for(const item of listStates(root))if(item.generation+2<next.generation)try{fs.unlinkSync(item.path);}catch{}
  return next;
}
function compatible(artifact,platform){return artifact.platforms?.some(x=>x==='all'||x===platform);}
function healthArtifact(artifact,bytes){
  const verified=verifyArtifactBytes(artifact,bytes);if(!verified.verified)throw new Error(verified.reason||'PACK_ARTIFACT_INVALID');
  if(artifact.encrypted===true)throw new Error('PACK_ENCRYPTED_ARTIFACT_DECRYPTOR_NOT_AVAILABLE');
  if(['ontology','rules','prompt-pack','runtime-config'].includes(artifact.kind))JSON.parse(Buffer.from(bytes).toString('utf8'));
}
function healthInstalledFile(artifact,filePath){
  const bytes=fs.readFileSync(filePath);healthArtifact(artifact,bytes);
  if(artifact.kind==='knowledge-db'){
    const db=new DatabaseSync(filePath,{readOnly:true});
    try{
      const quick=String(db.prepare('PRAGMA quick_check').get()?.quick_check||'');
      if(quick.toLowerCase()!=='ok')throw new Error('PACK_SQLITE_CORRUPT');
      if(artifact.path.endsWith('cases.sqlite')){
        const row=db.prepare("SELECT sql FROM sqlite_master WHERE name='cases_fts'").get();
        if(!/fts5/i.test(String(row?.sql||'')))throw new Error('PACK_CASES_FTS_NOT_FTS5');
        db.prepare('SELECT count(*) AS n FROM cases').get();
      }
    }finally{db.close();}
  }
  if(artifact.kind==='vision-model'&&(!artifact.path.toLowerCase().endsWith('.onnx')||bytes.length<128))throw new Error('PACK_ONNX_ARTIFACT_SHAPE_INVALID');
}
export function installVerifiedPack({rootDir,manifest,files,trustedPublicKeys,platform='windows',appVersion='0.1.0'}){
  fs.mkdirSync(rootDir,{recursive:true});versionDir(rootDir);stagingDir(rootDir);stateDir(rootDir);
  const sig=verifyPackManifest(manifest,{trustedPublicKeys});if(!sig.verified)throw new Error(sig.reason||'PACK_SIGNATURE_INVALID');
  if(compareVersion(appVersion,manifest.minimumAppVersion)<0)throw new Error('PACK_REQUIRES_NEWER_APP');
  const applicable=(manifest.artifacts||[]).filter(a=>compatible(a,platform));
  if(!applicable.length)throw new Error('PACK_NO_COMPATIBLE_ARTIFACTS');
  const seen=new Set();
  for(const artifact of manifest.artifacts||[]){
    if(!validPath(artifact.path)||seen.has(artifact.path))throw new Error('PACK_ARTIFACT_PATH_INVALID_OR_DUPLICATE');
    seen.add(artifact.path);
  }
  const state=readPackState(rootDir);
  if(state.active?.packId===manifest.packId){
    const cmp=compareVersion(manifest.version,state.active.version);
    if(cmp<0)throw new Error('PACK_ANTI_ROLLBACK_REJECTED');
    if(cmp===0)throw new Error('PACK_VERSION_ALREADY_ACTIVE');
  }
  const manifestHash=sig.payloadSha256;
  const stage=path.join(stagingDir(rootDir),safeSegment(manifest.packId)+'-'+safeSegment(manifest.version)+'-'+manifestHash.slice(0,12));
  fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
  try{
    fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2));
    for(const artifact of applicable){
      const bytes=files instanceof Map?files.get(artifact.path):files?.[artifact.path];
      if(bytes===undefined)throw new Error('PACK_ARTIFACT_MISSING');
      healthArtifact(artifact,bytes);
      const dest=path.join(stage,...artifact.path.split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
    }
    for(const artifact of applicable)healthInstalledFile(artifact,path.join(stage,...artifact.path.split('/')));
    const relative='versions/'+safeSegment(manifest.packId)+'-'+safeSegment(manifest.version)+'-'+manifestHash.slice(0,12);
    const finalDir=path.join(rootDir,...relative.split('/'));
    if(fs.existsSync(finalDir))fs.rmSync(stage,{recursive:true,force:true});else fs.renameSync(stage,finalDir);
    const active={packId:manifest.packId,version:manifest.version,directory:relative,manifestSha256:manifestHash,installedUnixMs:Date.now()};
    return writeState(rootDir,{...state,active,previous:state.active||null});
  }catch(err){fs.rmSync(stage,{recursive:true,force:true});throw err;}
}
export function rollbackVerifiedPack(rootDir){
  const state=readPackState(rootDir);if(!state.previous)throw new Error('PACK_ROLLBACK_NOT_AVAILABLE');
  const previousDir=path.join(rootDir,...state.previous.directory.split('/'));if(!fs.existsSync(previousDir))throw new Error('PACK_ROLLBACK_DIRECTORY_MISSING');
  return writeState(rootDir,{...state,active:state.previous,previous:state.active||null});
}
export function activeArtifactPath(rootDir,kind,platform='windows'){
  const state=readPackState(rootDir);if(!state.active)return null;
  const dir=path.join(rootDir,...state.active.directory.split('/'));
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  const artifact=(manifest.artifacts||[]).find(a=>a.kind===kind&&compatible(a,platform));if(!artifact)return null;
  const file=path.join(dir,...artifact.path.split('/'));return fs.existsSync(file)?file:null;
}
