import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const manifestSrc=fs.readFileSync('public/local-vision/model-manifest.js','utf8');
const runtimeSrc=fs.readFileSync('public/local-vision/model-runtime.js','utf8');
const shadowSrc=fs.readFileSync('public/local-vision/shadow-pixel-mlp.js','utf8');
const shadowWorker=fs.readFileSync('public/local-vision/shadow-worker.js','utf8');
const deviceRuntime=fs.readFileSync('public/device-runtime.js','utf8');
const telemetry=fs.readFileSync('public/benchmark-telemetry.js','utf8');
const modelPath='public/local-vision/models/aitc-tongue-roi-mlp-bootstrap-v1.json';
const modelBytes=fs.readFileSync(modelPath);
const model=JSON.parse(modelBytes.toString('utf8'));
const dataset=JSON.parse(fs.readFileSync('ml/datasets/aitc-stage2-bootstrap-479-v1.json','utf8'));
const metrics=JSON.parse(fs.readFileSync('ml/evaluation/aitc-tongue-roi-mlp-bootstrap-v1.json','utf8'));

const sandbox={};
sandbox.globalThis=sandbox;
vm.runInNewContext(manifestSrc,sandbox,{filename:'model-manifest.js'});
vm.runInNewContext(shadowSrc,sandbox,{filename:'shadow-pixel-mlp.js'});
const manifest=sandbox.AITCLocalVisionModelManifest;

assert.equal(manifest.schemaVersion,'aitc-local-vision-model-manifest-v1');
assert.equal(manifest.status,'candidate-shadow');
assert.equal(manifest.activation,'shadow-only');
assert.equal(manifest.runtime.preferred,'onnxruntime-web');
assert.equal(manifest.runtime.baselineProvider,'wasm');
assert.equal(manifest.runtime.optionalProvider,'webgpu');
assert.equal(manifest.runtime.webgpuRequiresParityGate,true);
assert.equal(manifest.runtime.currentCandidateAdapter,'native-js-pixel-mlp-shadow');

const artifact=manifest.artifacts.find(x=>x.id==='tongue-roi-mlp-bootstrap-v1');
assert.ok(artifact,'real bootstrap ROI artifact must be registered');
assert.equal(artifact.kind,'pixel-mlp-json');
assert.equal(artifact.clinicalGold,false);
assert.equal(artifact.productionEligible,false);
assert.equal(artifact.weakSupervision,true);
assert.equal(artifact.webgpuParityApproved,false);
assert.equal(artifact.sha256,crypto.createHash('sha256').update(modelBytes).digest('hex'));
assert.equal(artifact.sha256,metrics.modelJsonSha256);
assert.equal(manifest.provenance.trainingDatasetVersion,'aitc-stage2-bootstrap-479-v1');
assert.equal(manifest.provenance.evaluationDatasetVersion,'aitc-stage2-bootstrap-479-v1');
assert.equal(manifest.provenance.labelPolicy,'weak-supervision-not-clinician-gold');

const roi=manifest.tasks.find(x=>x.id==='tongue-roi');
assert.equal(roi.artifactId,artifact.id);
assert.equal(roi.shadowOnly,true);
assert.equal(roi.threshold,.8);
assert.equal(manifest.safety.noProviderVision,true);
assert.equal(manifest.safety.noSyntheticObservation,true);
assert.equal(manifest.safety.unknownOnUnsupportedFeature,true);
assert.doesNotMatch(manifestSrc,/https?:\/\//,'model artifact must remain same-origin; no remote model/CDN URL');

assert.equal(dataset.clinicalGold,false);
assert.equal(dataset.productionEligible,false);
assert.equal(dataset.counts.total.n,479);
assert.equal(dataset.counts.train.n,337);
assert.equal(dataset.counts.validation.n,60);
assert.equal(dataset.counts.test.n,82);
assert.equal(dataset.leakageAudit.groupCrossSplit,0);
assert.equal(dataset.leakageAudit.exactDerivedShaCrossSplit,0);
assert.equal(dataset.leakageAudit.AT1ExternalHoldout,true);
assert.equal(metrics.clinicalAccuracyPublished,false);
assert.equal(metrics.goldHoldoutAvailable,false);
assert.equal(metrics.productionApproval,false);
assert.match(metrics.metricSemantics,/NOT clinical accuracy/);

assert.equal(model.schemaVersion,'aitc-pixel-mlp-v1');
assert.deepEqual(model.architecture,[12,24,12,1]);
assert.equal(model.training.dataset,'aitc-stage2-bootstrap-479-v1');
assert.match(model.training.labelPolicy,/NOT clinician gold/);
const fixture=[.78,.52,.48,.38,.80,.15,.9887,0,.15,.1061,.28,.58];
const probability=sandbox.AITCLocalVisionShadow.inferFeatureVector(model,fixture);
assert.ok(Math.abs(probability-0.9997785104440412)<1e-10,'JS inference must match the training-side parity fixture');

assert.match(runtimeSrc,/candidate-shadow/);
assert.match(runtimeSrc,/LOCAL_VISION_SHADOW_POLICY_REQUIRED/);
assert.match(runtimeSrc,/LOCAL_VISION_ONNX_ARTIFACT_REQUIRED/);
assert.match(runtimeSrc,/artifact\.webgpuParityApproved===true/);
assert.match(runtimeSrc,/providers\.push\('wasm'\)/);
assert.match(runtimeSrc,/providerVision:false/);
assert.doesNotMatch(runtimeSrc,/generativelanguage\.googleapis\.com|Gemini/i);

assert.match(shadowSrc,/SHADOW_MODEL_DIGEST_MISMATCH/);
assert.match(shadowSrc,/productionEligible:false/);
assert.match(shadowSrc,/clinicalGold:false/);
assert.doesNotMatch(shadowSrc,/generativelanguage\.googleapis\.com|Gemini/i);
assert.match(shadowWorker,/candidate-shadow/);
assert.match(deviceRuntime,/none-fire-and-forget-after-response/);
assert.match(deviceRuntime,/aitc:vision-shadow/);
assert.match(telemetry,/event:'vision_shadow'/);
assert.match(telemetry,/clinicalGold:false/);
assert.match(telemetry,/productionEligible:false/);

console.log('LOCAL VISION MODEL CONTRACT PASS: real weak-supervision ROI candidate is checksum-locked, leakage-audited, shadow-only, non-blocking and explicitly not a clinical-accuracy model.');
