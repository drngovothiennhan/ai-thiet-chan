import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GROUND_TRUTH_PROFILE,GROUND_TRUTH_SOURCES,classifyGlobalContext} from '../public/ground-truth-profile.js';

const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('public/device-runtime.js');
const worker=read('public/device-analysis-worker.js');
const enhancement=read('public/image-enhancement.js');
const release=read('public/release-meta.js');
const releaseUi=read('public/release-ui.js');
const source=read('public/academic-source.js');
const vision=read('public/academic-vision.js');
const sw=read('public/sw.js');
const serverFusion=read('academic-server.mjs');
const doc=read('docs/DEVICE-FIRST-HYBRID-V1.md');

assert.equal(GROUND_TRUTH_PROFILE.indexedImageOccurrences,1027);
assert.equal(GROUND_TRUTH_PROFILE.ownerDesignatedTrainingSamples,1027);
assert.equal(GROUND_TRUTH_PROFILE.globalVisualVectors,1027);
assert.equal(GROUND_TRUTH_PROFILE.diagnosticTongueSignatures,298);
assert.equal(GROUND_TRUTH_PROFILE.contextOrNegativeSamples,729);
assert.equal(GROUND_TRUTH_SOURCES.reduce((n,s)=>n+s.imageOccurrences,0),1027);
assert.equal(GROUND_TRUTH_SOURCES.reduce((n,s)=>n+s.diagnosticTongueSignatures,0),298);
assert.deepEqual(GROUND_TRUTH_SOURCES.map(s=>[s.id,s.imageOccurrences,s.diagnosticTongueSignatures]),[['TC1',44,0],['DY1',302,257],['MC1',92,1],['AT1',41,40],['PSY1',548,0]]);
const contextProbe=classifyGlobalContext([0.82,0.76,0.74,0.14,0.83]);
assert.equal(contextProbe.available,true);
assert.equal(contextProbe.trainingSamples,1027);

assert.match(runtime,/device-runtime-v2/);
assert.match(runtime,/device-analysis-payload-v2/);
assert.match(runtime,/const DEVICE_COMPUTE_PRIORITY=90/);
assert.match(enhancement,/register\('image-enhancement',[\s\S]*,100\)/);
assert.match(runtime,/workerCount/);
assert.match(runtime,/parallelViews/);
assert.match(runtime,/activeBackend:localVisionReady\?'worker-canvas-cpu':'server-fallback'/);
assert.match(runtime,/acceleratorUsed:false/);
assert.match(runtime,/localVisionReady/);
assert.match(runtime,/terminateWorkers/);
assert.match(runtime,/AITCRequestClient/);
assert.match(runtime,/device-compute/);
assert.match(runtime,/body\.academicSignature=deviceAnalysis\.top\.signature/);
assert.match(runtime,/body\.academicSource=/);
assert.match(runtime,/ownerDesignatedTrainingSamples:1027/);
assert.match(runtime,/globalVisualVectors:1027/);
assert.match(runtime,/diagnosticTongueSignatures:298/);
assert.match(runtime,/contextOrNegativeSamples:729/);
assert.match(runtime,/publishLastRun/);
assert.match(runtime,/aitc:device-analysis/);
assert.match(runtime,/lastRun/);

assert.match(worker,/device-analysis-worker-v2/);
assert.match(worker,/GROUND_TRUTH_PROFILE/);
assert.match(worker,/classifyGlobalContext/);
assert.match(worker,/inspectPixels/);
assert.match(worker,/bottom-device-feature-v1/);
assert.match(worker,/vesselCandidateRatio/);
assert.match(worker,/matchAtlas/);
assert.match(worker,/AITCAcademicVision/);
assert.match(worker,/coarseVisual/);
assert.match(worker,/digestText\(base64Payload\(dataUrl\)\)/);

assert.match(release,/device-runtime-v2/);
assert.match(release,/device-analysis-payload-v2/);
const deviceLoaderIndex=releaseUi.indexOf("loadScript('/device-runtime.js')");
const sealLoaderIndex=releaseUi.indexOf("loadScript('/request-integrity.js')");
assert.ok(deviceLoaderIndex>=0&&sealLoaderIndex>deviceLoaderIndex,'device runtime must load before request-integrity seals the pipeline');

assert.match(source,/indexedImageOccurrences:1027/);
assert.match(source,/ownerDesignatedGroundTruthSamples:1027/);
assert.match(source,/globalVisualVectors:1027/);
assert.match(source,/diagnosticTongueSignatures:298/);
assert.match(source,/contextOrNegativeSamples:729/);
assert.match(source,/imageVisualSignatures:298/);
assert.match(vision,/indexedImageOccurrences:1027/);
assert.match(vision,/imageVisualSignatures:298/);

assert.match(sw,/device-runtime\.js/);
assert.match(sw,/device-analysis-worker\.js/);
assert.match(sw,/ground-truth-profile\.js/);
assert.match(sw,/hasCompleteDevicePayload/);
assert.match(sw,/service-worker-fallback/);
assert.match(sw,/topImageDigest/);

assert.match(serverFusion,/device-payload-verify-v1/);
assert.match(serverFusion,/verifyClientVisualPayload/);
assert.match(serverFusion,/top-image-digest-mismatch/);
assert.match(serverFusion,/ground-truth-profile-invalid/);
assert.match(serverFusion,/bottom-device-feature-v1/);
assert.match(serverFusion,/matchAtlas\(signature\)/);
assert.match(serverFusion,/ownerDesignatedGroundTruthSamples:1027/);
assert.match(serverFusion,/globalVisualVectors:1027/);

assert.match(doc,/owner-designated ground-truth training samples/);
assert.match(doc,/1\.027\/1\.027 image occurrences/);
assert.match(doc,/298\/1\.027/);
assert.match(doc,/729\/1\.027/);
assert.match(doc,/worker-canvas-cpu/);
assert.match(doc,/INSUFFICIENT REAL-DEVICE TELEMETRY/);
assert.doesNotMatch(doc,/WebGPU acceleration đang hoạt động/i);

console.log('device-first hybrid smoke: ok');
