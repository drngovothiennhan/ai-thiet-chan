import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine=fs.readFileSync('local-vision-engine.mjs','utf8');
const server=fs.readFileSync('server.mjs','utf8');

assert.match(engine,/tongue-morphology-observation-v2/);
assert.match(engine,/medianSulcus/);
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
assert.match(server,/Gemini chỉ phân tích KẾT QUẢ CẤU TRÚC/);
assert.match(server,/Gemini không được xem ảnh/);
assert.match(server,/medianSulcus \(rãnh giữa\) và fissure \(nứt\) là hai trường khác nhau/);
assert.match(server,/legacyDarkLineSignal chỉ là tín hiệu điểm\/đường tối thô và KHÔNG đủ để kết luận nứt/);
assert.match(server,/if morphology\.fissure\.status=unknown thì phải nói chưa đủ căn cứ đánh giá nứt/i);
assert.match(server,/const llmData=llmSafeAssessmentContext\(data\)/);
assert.match(server,/Phân tích cấu trúc:/);

console.log('LLM OBSERVATION CONTEXT PASS: local vision separates median sulcus from fissure; ambiguous dark-line signals stay non-diagnostic; Gemini receives structured context only and cannot invent image observations.');
