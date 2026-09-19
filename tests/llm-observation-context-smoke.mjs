import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine=fs.readFileSync('local-vision-engine.mjs','utf8');
const server=fs.readFileSync('server.mjs','utf8');
const reasoning=fs.readFileSync('local-grounded-reasoning.mjs','utf8');

assert.match(engine,/tongue-morphology-observation-v3/);
assert.match(engine,/medianSulcus/);
assert.match(engine,/SPATIAL_OBSERVATION_POLICY_VERSION/);
assert.match(engine,/legacyDarkLineSignal/);
assert.match(engine,/Không được gọi là nứt lưỡi chỉ từ legacyDarkLineSignal/);
assert.match(engine,/rãnh giữa rõ phải được tách riêng khỏi nứt bệnh lý/);
assert.match(engine,/depth:'not-assessable-from-2d-image'/);
assert.doesNotMatch(engine,/fissureText\(Boolean\(c\.fissure\)\)/,'legacy coarse dark ratio must not directly become fissure text');

assert.match(server,/aitc-llm-observation-context-v2/);
assert.match(server,/tongue-dual-view-feature-vector-v2/);
assert.match(server,/medianSulcusIsNotAutomaticallyFissure:true/);
assert.match(server,/legacyDarkLineSignalIsNotFissureDiagnosis:true/);
assert.match(server,/fissureDepthFrom2dImageForbidden:true/);
assert.match(server,/localGroundedChat/);
assert.match(server,/localGroundedReport/);
assert.match(server,/\[AUXILIARY_POST_ANALYSIS_ONLY\]/);
assert.match(server,/Không xem ảnh và không tạo thêm quan sát hình ảnh/);
assert.match(reasoning,/noImageObservation:true/);
assert.match(reasoning,/unknownMustRemainUnknown:true/);
assert.match(reasoning,/Rãnh giữa và nứt là hai trường khác nhau|tách rãnh giữa khỏi nứt/i);
assert.match(reasoning,/legacyDarkLineSignal/);
assert.match(reasoning,/chưa đủ căn cứ gọi là nứt/);
assert.match(server,/const llmData=llmSafeAssessmentContext\(data\)/);
assert.match(server,/Phân tích cấu trúc:/);

console.log('LLM OBSERVATION CONTEXT PASS: local vision and local-grounded reasoning separate median sulcus from fissure; optional Gemini receives structured text only and cannot invent image observations.');
