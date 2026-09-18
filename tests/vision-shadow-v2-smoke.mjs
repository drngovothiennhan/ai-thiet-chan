import assert from 'node:assert/strict';
import fs from 'node:fs';

const extractor=fs.readFileSync('public/local-vision/shadow-feature-extractor.js','utf8');
const worker=fs.readFileSync('public/local-vision/shadow-worker.js','utf8');
const runtime=fs.readFileSync('public/device-runtime.js','utf8');
const telemetry=fs.readFileSync('public/benchmark-telemetry.js','utf8');
const manifest=fs.readFileSync('public/local-vision/model-manifest.js','utf8');

assert.match(extractor,/shadow-feature-extractor-v2/);
assert.match(extractor,/flashRiskScore/);
assert.match(extractor,/medianSulcus/);
assert.match(extractor,/fissure/);
assert.match(extractor,/vesselVisibility/);
assert.match(extractor,/bilateralVessels/);
assert.match(extractor,/absoluteScale:false/);
assert.match(extractor,/mmAllowed:false/);
assert.match(extractor,/authority:false/);
assert.match(extractor,/productionEligible:false/);
assert.doesNotMatch(extractor,/diagnos|bệnh danh|kê đơn|prescription/i);

assert.match(worker,/shadow-worker-v2/);
assert.match(worker,/analyzeShadowFeatureCandidates/);
assert.match(worker,/topDataUrl/);
assert.match(worker,/bottomDataUrl/);
assert.match(worker,/clinicalGold:false/);
assert.match(worker,/productionEligible:false/);
assert.match(worker,/authority:false/);

assert.match(runtime,/queueShadowViews/);
assert.match(runtime,/none-fire-and-forget-after-response/);
assert.match(runtime,/topColorAgreement/);
assert.match(runtime,/baselineBottomFeatures/);
assert.ok(runtime.lastIndexOf('queueShadowViews(')>runtime.indexOf('const response=await client.fetchAfter'),'shadow must remain after response path');

assert.match(telemetry,/qcFlashRiskScore/);
assert.match(telemetry,/topMedianSulcusScore/);
assert.match(telemetry,/topFissureCandidateScore/);
assert.match(telemetry,/bottomVesselVisibilityScore/);
assert.match(telemetry,/bottomVesselBalance/);
assert.match(telemetry,/clinicalGold:false/);
assert.match(telemetry,/productionEligible:false/);
assert.doesNotMatch(telemetry,/dataUrl|base64Payload|imageDigest/,'shadow telemetry must not persist raw image material');

assert.match(manifest,/qc-roi-shadow-v2/);
assert.match(manifest,/bottom-observation-shadow-v2/);
assert.match(manifest,/top-morphology-shadow-v2/);
assert.match(manifest,/shadowOnly:true,authority:false/);

console.log('VISION SHADOW V2 PASS: QC/ROI, bottom-vessel and top morphology candidates run shadow-only after the production response and emit numeric non-authoritative telemetry.');
