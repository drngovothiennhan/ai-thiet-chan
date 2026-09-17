import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const manifestSrc=fs.readFileSync('public/local-vision/model-manifest.js','utf8');
const runtimeSrc=fs.readFileSync('public/local-vision/model-runtime.js','utf8');

const sandbox={globalThis:{},Object};
sandbox.globalThis=sandbox;
vm.runInNewContext(manifestSrc,sandbox,{filename:'model-manifest.js'});
const manifest=sandbox.AITCLocalVisionModelManifest;

assert.equal(manifest.schemaVersion,'aitc-local-vision-model-manifest-v1');
assert.equal(manifest.status,'awaiting-trained-artifacts');
assert.equal(manifest.activation,'shadow-only');
assert.equal(manifest.runtime.preferred,'onnxruntime-web');
assert.equal(manifest.runtime.baselineProvider,'wasm');
assert.equal(manifest.runtime.optionalProvider,'webgpu');
assert.equal(manifest.runtime.webgpuRequiresParityGate,true);
assert.equal(manifest.artifacts.length,0,'no fake model artifact may be registered');
assert.equal(manifest.provenance.trainingDatasetVersion,null);
assert.equal(manifest.provenance.evaluationDatasetVersion,null);
assert.equal(manifest.safety.noProviderVision,true);
assert.equal(manifest.safety.noSyntheticObservation,true);
assert.equal(manifest.safety.unknownOnUnsupportedFeature,true);
assert.ok(manifest.tasks.some(x=>x.id==='tongue-presence'&&x.required));
assert.ok(manifest.tasks.some(x=>x.id==='tongue-roi'&&x.kind==='segmentation'));
assert.doesNotMatch(manifestSrc,/https?:\/\//,'manifest must not depend on remote model/CDN URLs before an approved artifact exists');

assert.match(runtimeSrc,/LOCAL_VISION_MODEL_NOT_READY/);
assert.match(runtimeSrc,/LOCAL_VISION_MODEL_DIGEST_MISMATCH/);
assert.match(runtimeSrc,/artifact\.webgpuParityApproved===true/);
assert.match(runtimeSrc,/providers\.push\('wasm'\)/);
assert.match(runtimeSrc,/providerVision:false/);
assert.doesNotMatch(runtimeSrc,/generativelanguage\.googleapis\.com|Gemini/i);

console.log('LOCAL VISION MODEL CONTRACT PASS: Stage-2 runtime is fail-closed, provenance-locked, WASM-first, WebGPU parity-gated, and contains no fabricated model artifact.');
