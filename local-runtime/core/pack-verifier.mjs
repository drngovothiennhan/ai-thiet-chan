import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';

export const PACK_VERIFIER_VERSION='aitc-pack-verifier-v1';
const SHA_RE=/^[a-f0-9]{64}$/i;

function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
export function canonicalUnsignedManifest(manifest={}){
  const copy=JSON.parse(JSON.stringify(manifest));delete copy.signature;return canonical(copy);
}
export function sha256Hex(bytes){return createHash('sha256').update(bytes).digest('hex');}
function rawEd25519PublicKeyToKeyObject(raw){
  const buf=Buffer.isBuffer(raw)?raw:Buffer.from(raw);
  if(buf.length!==32)throw new Error('PACK_PUBLIC_KEY_LENGTH_INVALID');
  const prefix=Buffer.from('302a300506032b6570032100','hex');
  return createPublicKey({key:Buffer.concat([prefix,buf]),format:'der',type:'spki'});
}
function validateShape(manifest={}){
  if(manifest.schemaVersion!=='aitc-pack-manifest-v1')return 'manifest-schema-invalid';
  if(!manifest.packId||!manifest.version||!manifest.minimumAppVersion)return 'manifest-identity-invalid';
  if(!Array.isArray(manifest.artifacts)||!manifest.artifacts.length)return 'manifest-artifacts-missing';
  for(const item of manifest.artifacts){
    if(!item?.id||!item?.kind||!item?.version||!item?.path)return 'artifact-metadata-invalid';
    if(!Number.isInteger(item.size)||item.size<0||!SHA_RE.test(String(item.sha256||'')))return 'artifact-integrity-metadata-invalid';
    if(!Array.isArray(item.platforms)||!item.platforms.length)return 'artifact-platforms-missing';
  }
  const sig=manifest.signature;
  if(sig?.algorithm!=='Ed25519'||!sig.keyId||!sig.value)return 'manifest-signature-metadata-invalid';
  return null;
}
export function verifyPackManifest(manifest,{trustedPublicKeys={}}={}){
  const reason=validateShape(manifest);if(reason)return {verified:false,reason};
  const raw=trustedPublicKeys[manifest.signature.keyId];
  if(!raw)return {verified:false,reason:'trusted-key-not-found'};
  let signature;
  try{signature=Buffer.from(String(manifest.signature.value),'base64');}catch{return {verified:false,reason:'signature-base64-invalid'};}
  if(signature.length!==64)return {verified:false,reason:'signature-length-invalid'};
  try{
    const key=rawEd25519PublicKeyToKeyObject(typeof raw==='string'?Buffer.from(raw,'hex'):raw);
    const payload=Buffer.from(canonicalUnsignedManifest(manifest),'utf8');
    const verified=verifySignature(null,payload,key,signature);
    return {verified,reason:verified?null:'signature-invalid',payloadSha256:sha256Hex(payload)};
  }catch(err){return {verified:false,reason:String(err?.message||'signature-verify-failed')};}
}
export function verifyArtifactBytes(artifact,bytes){
  if(!artifact||!SHA_RE.test(String(artifact.sha256||'')))return {verified:false,reason:'artifact-sha-invalid'};
  const buf=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  if(Number(artifact.size)!==buf.length)return {verified:false,reason:'artifact-size-mismatch'};
  const digest=sha256Hex(buf);return {verified:digest.toLowerCase()===String(artifact.sha256).toLowerCase(),reason:digest.toLowerCase()===String(artifact.sha256).toLowerCase()?null:'artifact-digest-mismatch',sha256:digest};
}
