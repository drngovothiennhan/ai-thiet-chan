import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonicalUnsignedManifest,sha256Hex} from '../core/pack-verifier.mjs';
import {installVerifiedPack,readPackState,rollbackVerifiedPack,activeArtifactPath} from '../core/atomic-pack-store.mjs';
import {selectReadyProvider} from '../core/provider-gate.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'aitc-pack-'));
const source=path.join(root,'source.sqlite');
const db=new DatabaseSync(source);
db.exec("CREATE TABLE cases(id INTEGER PRIMARY KEY,source_id TEXT,source_record_id TEXT,task TEXT,case_text TEXT,target TEXT,provenance_json TEXT,pmid TEXT,pmcid TEXT,doi TEXT,license TEXT); CREATE VIRTUAL TABLE cases_fts USING fts5(case_text,target,content='cases',content_rowid='id'); INSERT INTO cases VALUES(1,'test','1','tongue','red tongue','sample','{}','','','','CC0'); INSERT INTO cases_fts(rowid,case_text,target) VALUES(1,'red tongue','sample');");
db.close();
const dbBytes=fs.readFileSync(source);
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const rawPublic=publicKey.export({format:'der',type:'spki'}).subarray(-32);
function manifest(version,bytes=dbBytes){
  const m={schemaVersion:'aitc-pack-manifest-v1',packId:'cases-test',version,createdAt:'2026-09-21T03:20:00.000Z',minimumAppVersion:'0.1.0',artifacts:[{id:'cases',kind:'knowledge-db',version,path:'knowledge/cases.sqlite',size:bytes.length,sha256:sha256Hex(bytes),platforms:['all'],encrypted:false}],signature:{algorithm:'Ed25519',keyId:'test-key',value:''}};
  m.signature.value=sign(null,Buffer.from(canonicalUnsignedManifest(m),'utf8'),privateKey).toString('base64');return m;
}
const keys={'test-key':rawPublic};
installVerifiedPack({rootDir:root,manifest:manifest('1.0.0'),files:new Map([['knowledge/cases.sqlite',dbBytes]]),trustedPublicKeys:keys});
assert.equal(readPackState(root).active.version,'1.0.0');
assert.ok(activeArtifactPath(root,'knowledge-db'));
installVerifiedPack({rootDir:root,manifest:manifest('1.1.0'),files:new Map([['knowledge/cases.sqlite',dbBytes]]),trustedPublicKeys:keys});
let state=readPackState(root);assert.equal(state.active.version,'1.1.0');assert.equal(state.previous.version,'1.0.0');
state=rollbackVerifiedPack(root);assert.equal(state.active.version,'1.0.0');assert.equal(state.previous.version,'1.1.0');
assert.throws(()=>installVerifiedPack({rootDir:root,manifest:manifest('0.9.0'),files:new Map([['knowledge/cases.sqlite',dbBytes]]),trustedPublicKeys:keys}),/ANTI_ROLLBACK/);
const bad=Buffer.from(dbBytes);bad[bad.length-1]^=1;
assert.throws(()=>installVerifiedPack({rootDir:root,manifest:manifest('1.2.0'),files:new Map([['knowledge/cases.sqlite',bad]]),trustedPublicKeys:keys}),/artifact-digest-mismatch/i);
assert.equal(readPackState(root).active.version,'1.0.0');

const blocked=selectReadyProvider({onnxRuntimeLoadable:true,activeVisionModel:'m.onnx',providers:[{id:'qnn',libraryLoadable:true,sessionLoadSuccess:false,benchmarkSuccess:false,outputValidated:false,ready:false}]});
assert.equal(blocked.ready,false);
const allowed=selectReadyProvider({onnxRuntimeLoadable:true,activeVisionModel:'m.onnx',providers:[{id:'cpu',libraryLoadable:true,sessionLoadSuccess:true,benchmarkSuccess:true,outputValidated:true,ready:true,benchmarkMs:50},{id:'gpu',libraryLoadable:true,sessionLoadSuccess:true,benchmarkSuccess:true,outputValidated:true,ready:true,benchmarkMs:20}]});
assert.equal(allowed.ready,true);assert.equal(allowed.provider.id,'gpu');
fs.rmSync(root,{recursive:true,force:true});
console.log('SIGNED_PACK_PROVIDER_GATE_SMOKE_PASS');
