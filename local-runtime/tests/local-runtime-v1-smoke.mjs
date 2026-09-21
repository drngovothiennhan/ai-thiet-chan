import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {selectDeviceExecutionProfile,degradeExecutionProfile} from '../core/device-execution-profile.mjs';
import {adaptNativeVisionResult} from '../core/local-vision-adapter.mjs';
import {emptyQueue,enqueue,dueJobs,markSending,markRetry,markSent} from '../core/offline-queue.mjs';
import {buildLocalAnalysisEnvelope} from '../core/local-envelope.mjs';
import {canonicalUnsignedManifest,verifyPackManifest,verifyArtifactBytes,sha256Hex} from '../core/pack-verifier.mjs';

const hash='a'.repeat(64);
const profile=selectDeviceExecutionProfile({platform:'android',logicalCores:8,memoryMb:8192,accelerators:[{type:'cpu',provider:'ort-cpu',ready:true,precisions:['fp32','int8']},{type:'npu',provider:'qnn',ready:true,precisions:['int8']}]},[{provider:'ort-cpu',success:true,medianMs:220,inputSide:384},{provider:'qnn',success:true,medianMs:65,inputSide:640}]);
assert.equal(profile.tier,'L3');
assert.equal(profile.activeBackend,'qnn');
assert.equal(profile.precision,'int8');
assert.equal(profile.multipass,true);
assert.equal(degradeExecutionProfile(profile,'oom').tier,'L2');

const shadow=adaptNativeVisionResult({taskId:'top',imageHash:hash,qc:{grade:'good'},artifact:{id:'shadow',validationStatus:'candidate-shadow',productionEligible:false},signature:{}});
assert.equal(shadow.accepted,false);
assert.ok(shadow.limitations.includes('shadow-or-candidate-output-not-promoted'));
const signature={r:.5,g:.4,b:.4,s:.3,v:.7,purple:.1,white:.2,yellow:.1,dark:.1,spot:.02,coverage:.8,aspect:1.2};
const accepted=adaptNativeVisionResult({taskId:'top',imageHash:hash,qc:{grade:'fair'},artifact:{id:'validated-1',version:'1',sha256:'b'.repeat(64),validationStatus:'validated',productionEligible:true},signature,observations:{tongueColor:'đỏ nhạt',medianSulcus:{status:'visible-signal'},fissure:{status:'unknown'}}});
assert.equal(accepted.accepted,true);
assert.equal(accepted.observations.fissure.status,'unknown');

const envelope=buildLocalAnalysisEnvelope({appVersion:'0.1.0',runtimeVersion:'local-runtime-v1',modelSetVersion:'validated-1',knowledgeVersion:'none',deviceProfile:{platform:'android'},executionProfile:profile,imageHashes:{top:hash},qc:{grade:'fair'},observations:accepted.observations,localRetrieval:{active:false},localReasoning:{status:'bounded'},confidence:.51,limitations:['offline-local-only'],provenance:{model:'validated-1'},degraded:false,offline:true,timestamp:'2026-09-21T02:30:00.000Z'});
assert.equal(envelope.schemaVersion,'aitc-local-analysis-envelope-v1');
assert.equal('topImage' in envelope,false);

let queue=emptyQueue();
queue=enqueue(queue,{idempotencyKey:'case:12345678',caseId:'123',createdAt:'2026-09-21T02:30:00.000Z',nextAttemptAt:'2026-09-21T02:30:00.000Z',envelope});
queue=enqueue(queue,{idempotencyKey:'case:12345678',caseId:'123',envelope});
assert.equal(queue.jobs.length,1);
assert.equal(dueJobs(queue,new Date('2026-09-21T02:31:00.000Z')).length,1);
queue=markSending(queue,'case:12345678');
assert.equal(queue.jobs[0].attempts,1);
queue=markRetry(queue,'case:12345678',{now:new Date('2026-09-21T02:31:00.000Z'),errorCode:'offline'});
assert.equal(queue.jobs[0].state,'pending');
queue=markSending(queue,'case:12345678');
queue=markSent(queue,'case:12345678');
assert.equal(queue.jobs[0].state,'sent');

const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const rawPublic=publicKey.export({format:'der',type:'spki'}).subarray(-32);
const bytes=Buffer.from('artifact-data');
const manifest={schemaVersion:'aitc-pack-manifest-v1',packId:'test-pack',version:'1.0.0',createdAt:'2026-09-21T02:30:00.000Z',minimumAppVersion:'0.1.0',artifacts:[{id:'ontology',kind:'ontology',version:'1',path:'knowledge/ontology.json',size:bytes.length,sha256:sha256Hex(bytes),platforms:['all']}],signature:{algorithm:'Ed25519',keyId:'test-key',value:''}};
manifest.signature.value=sign(null,Buffer.from(canonicalUnsignedManifest(manifest),'utf8'),privateKey).toString('base64');
assert.equal(verifyPackManifest(manifest,{trustedPublicKeys:{'test-key':rawPublic}}).verified,true);
assert.equal(verifyArtifactBytes(manifest.artifacts[0],bytes).verified,true);
assert.equal(verifyArtifactBytes(manifest.artifacts[0],Buffer.from('tampered')).verified,false);

console.log('LOCAL_RUNTIME_V1_SMOKE_PASS');
