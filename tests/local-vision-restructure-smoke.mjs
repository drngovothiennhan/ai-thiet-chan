import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calibrateRealTongueFeatures,REAL_TONGUE_FEATURE_CALIBRATION_VERSION} from '../real-tongue-feature-calibration.mjs';

const server=fs.readFileSync('server.mjs','utf8');
const guard=fs.readFileSync('runtime-guard.mjs','utf8');
const engine=fs.readFileSync('local-vision-engine.mjs','utf8');
const academic=fs.readFileSync('academic-server.mjs','utf8');
const releaseUi=fs.readFileSync('public/release-ui.js','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');

const analyzeStart=server.indexOf("app.post('/api/analyze'");
const chatStart=server.indexOf("app.post('/api/chat'",analyzeStart);
assert.ok(analyzeStart>=0&&chatStart>analyzeStart,'analyze route must exist before chat');
const analyzeRoute=server.slice(analyzeStart,chatStart);

assert.match(server,/analyzeLocalVision/);
assert.match(server,/geminiVision:false/);
assert.match(analyzeRoute,/analyzeLocalVision\(body,\{mode,topQc,bottomQc\}\)/);
assert.doesNotMatch(analyzeRoute,/geminiGenerate\(/,'image analysis must not call Gemini');
assert.doesNotMatch(analyzeRoute,/inline_data|inlineData/,'image analysis must not build provider media payloads');
assert.doesNotMatch(analyzeRoute,/AI_PROVIDER_NOT_CONFIGURED/,'image analysis must not require Gemini configuration');

assert.match(engine,/local-vision-engine-v1/);
assert.match(engine,/verifyClientVisualPayload/);
assert.match(engine,/coarse,matchAtlas/);
assert.match(engine,/geminiVision:false/);
assert.match(engine,/Tầng thị giác không tự suy luận thể bệnh YHCT/);
assert.match(engine,/calibrateRealTongueFeatures/);
assert.match(engine,/REAL_TONGUE_FEATURE_CALIBRATION_VERSION/);

const spatialBase={
  schemaVersion:'tongue-spatial-observation-v3',
  bodyLuma:.62,bodySaturation:.31,bodyColorCandidate:'đỏ nhạt',
  coatingCandidateRatio:.24,strictCoatingCandidateRatio:.12,
  coatingColorCandidate:'trắng',coatingWhiteLikeRatio:.42,coatingYellowLikeRatio:.08,
  coatingThicknessCandidate:'mỏng',coatingDistributionCandidate:'lan tỏa',
  coatingZones:{central:.28,middle:.24,posterior:.27,anterior:.20},
  colorNormalization:{applied:true,neutralPixels:420,bounded:true,gainR:1,gainG:1,gainB:1},
  shapeMetrics:{aspect:.74,areaFill:.58,midWidthRatio:.82,edgeRowCoverage:.72},
  toothmarkMetrics:{score:.70,bilateralScore:.46,leftEvents:3,rightEvents:3},
  medianSulcus:{visibleSignal:true,score:.75,continuity:.35,centrality:.82},
  moisture:{
    schemaVersion:'tongue-moisture-features-v1',
    coating:{glossRatio:.030,strictGlossRatio:.012,distributedGlossRatio:.70,largestGlossComponentRatio:.28,roughness:.038},
    surface:{glossRatio:.028,strictGlossRatio:.010,distributedGlossRatio:.68,largestGlossComponentRatio:.30,roughness:.038},
    qc:{overexposedRatio:.004,largestGlossComponentRatio:.30}
  }
};
const calibrated=calibrateRealTongueFeatures({signature:{purple:.21,spot:.071},spatial:spatialBase,qc:{grade:'good'},base:{bodyColor:'đỏ nhạt',coatingColor:'trắng',coatingThickness:'mỏng',coatingTexture:'khá đều',shape:'hình thể trung bình',toothmarks:'Không xác định'}});
assert.equal(REAL_TONGUE_FEATURE_CALIBRATION_VERSION,'rtb20260922-feature-rule-calibration-v1');
assert.equal(calibrated.active,true);
assert.equal(calibrated.bodyColor.label,'tím/xanh tím','purple must require QC + normalized-color gate');
assert.equal(calibrated.toothmarks.label,'Có tín hiệu dấu răng','toothmarks require repeated bilateral concavity');
assert.equal(calibrated.coatingTexture.label,'nghi nhờn/trơn','greasy/slippery coating requires distributed gloss + low roughness + low flash risk');
assert.equal(calibrated.shape.label,'rộng/mập tương đối theo ảnh 2D','shape wording must remain relative to 2D rather than claim true swelling');
assert.equal(calibrated.pricklesSpots.label,'Có tín hiệu điểm đỏ/gai');
assert.match(calibrated.fissureGuard,/median-sulcus-visible-do-not-promote-to-fissure/);
assert.equal(calibrated.policy.noBlackCoatingFromGenericDarkPixels,true);
assert.ok(calibrated.unsupportedUntilDedicatedExtractor.includes('rêu đen'));

const flashSpatial=structuredClone(spatialBase);
flashSpatial.moisture.coating={...flashSpatial.moisture.coating,glossRatio:.12,strictGlossRatio:.08,distributedGlossRatio:.05,largestGlossComponentRatio:.94};
flashSpatial.moisture.surface={...flashSpatial.moisture.surface,distributedGlossRatio:.04,largestGlossComponentRatio:.95};
flashSpatial.moisture.qc={overexposedRatio:.13,largestGlossComponentRatio:.95};
const flashed=calibrateRealTongueFeatures({signature:{purple:.05,spot:.01},spatial:flashSpatial,qc:{grade:'good'},base:{coatingTexture:'khá đều'}});
assert.notEqual(flashed.coatingTexture.label,'nghi nhờn/trơn','flash/cháy sáng must never be upgraded to greasy coating');

const unnormalized=structuredClone(spatialBase);
unnormalized.colorNormalization={applied:false,neutralPixels:0,bounded:true};
const noPurple=calibrateRealTongueFeatures({signature:{purple:.30,spot:.01},spatial:unnormalized,qc:{grade:'fair'},base:{bodyColor:'đỏ nhạt'}});
assert.notEqual(noPurple.bodyColor.label,'tím/xanh tím','purple must fail closed without usable color normalization');

assert.match(academic,/export function verifyClientVisualPayload/);
assert.doesNotMatch(academic,/function geminiLayer/);

assert.match(guard,/GEMINI_VISION_DISABLED/);
assert.match(guard,/if\(vision\) return blockedVisionResponse\(\)/);
assert.doesNotMatch(guard,/GEMINI_VISION_FALLBACK_MODEL|gemini_vision_model_fallback/);

assert.doesNotMatch(releaseUi,/analysis-hotfix\.js/);
assert.doesNotMatch(sw,/analysis-hotfix\.js/);

console.log('LOCAL VISION RESTRUCTURE SMOKE PASS: Gemini is excluded from image analysis; verified local vision is the only image-observation authority; Gemini remains text-only after structured results exist.');
