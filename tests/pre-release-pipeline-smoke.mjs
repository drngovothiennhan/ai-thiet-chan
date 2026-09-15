import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [server,runtime,academic,corpus,sw,index,capture]=await Promise.all([
  read('server.mjs'),read('runtime-guard.mjs'),read('academic-server.mjs'),read('knowledge-corpus.mjs'),read('public/sw.js'),read('public/index.html'),read('public/capture-metadata.js')
]);

// AI runtime: primary/fallback chain + measurable latency + no fabricated vision fallback.
assert.match(runtime,/GEMINI_MODEL='gemini-3\.8-flash'/);
assert.match(runtime,/GEMINI_FALLBACK_MODEL='gemini-3\.6-flash'/);
assert.match(runtime,/gemini_request_benchmark/);
assert.match(runtime,/VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE/);
assert.match(runtime,/modelsTried:GEMINI_MODEL_CHAIN/);

// Request semantics: do not rewrite 429 into a misleading 403 at the service-worker layer.
assert.match(sw,/return fetch\(forwarded\)/);
assert.doesNotMatch(sw,/status\s*:\s*403/);

// Client must not replace failed server vision with a separate diagnostic engine or bypass the server training store.
assert.doesNotMatch(capture,/local-open-source-vision-v1/);
assert.doesNotMatch(capture,/ai_thiet_chan_store_local_case_v1/);
assert.doesNotMatch(capture,/browser-localization/);
assert.match(capture,/A\.I thị giác đang tạm quá tải/);

// Pipeline order: normalize -> full Knowledge fusion -> persist the fused feature vector.
const analyzeAt=server.indexOf("app.post('/api/analyze'");
const normalizeAt=server.indexOf('normalizeAssessment(',analyzeAt);
const fusionAt=server.indexOf('applyAcademicFusion(',normalizeAt);
const storeAt=server.indexOf('storeTrainingCase(',fusionAt);
assert.ok(analyzeAt>=0&&normalizeAt>analyzeAt&&fusionAt>normalizeAt&&storeAt>fusionAt,'analysis pipeline order must remain normalize -> fusion -> store');
assert.match(server,/p_feature_vector:assessment\?\.ml\?\.featureVector\|\|\{\}/);

// Learning collection: prioritize truly novel usable cases, exclude poor QC, never auto-promote to Knowledge.
assert.match(academic,/NOVEL_SIMILARITY_THRESHOLD=0\.55/);
assert.match(academic,/REVIEW_SIMILARITY_THRESHOLD=0\.72/);
assert.match(academic,/poorQcExcludedFromLearning:true/);
assert.match(academic,/autoPromoteToKnowledge:false/);
assert.match(academic,/status:'novel',priority:'high',learningCandidate:true/);
assert.match(academic,/status:'covered',priority:'low',learningCandidate:false/);

// Safety boundary: psychology material is context-only and not a positive visual diagnostic source.
assert.match(corpus,/positiveDiagnosticVisualSources:\['TC1','DY1','MC1','AT1'\]/);
assert.match(corpus,/psychologySourceRole:'PSY1 context-only; never infer psychiatric state from tongue image\.'/);

// UI must continue to state that internal confidence is not clinical diagnostic accuracy.
assert.match(index,/Điểm tin cậy hiển thị là độ tự tin nội bộ của A\.I sau QC ảnh/);
assert.match(index,/không phải sensitivity\/specificity/);

console.log('PRE-RELEASE PIPELINE SMOKE PASS: model failover, 429 semantics, single diagnostic pipeline, fusion/storage order, novelty learning gate, PSY1 boundary and UI clinical-limit wording are consistent.');
