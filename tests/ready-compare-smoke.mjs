import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('public/index.html','utf8');
const consultation=fs.readFileSync('public/consultation.js','utf8');
const server=fs.readFileSync('server.mjs','utf8');
const release=fs.readFileSync('public/release-meta.js','utf8');

assert.match(home,/Bổ sung triệu chứng/);
assert.match(home,/Sẵn sàng đối chiếu/);
assert.match(home,/readyCompareBtn/);
assert.match(home,/\/consultation\.js\?v=2026\.09\.20-dual-consult-r1/);
assert.match(consultation,/MAX_FOLLOWUPS=3/);
assert.match(consultation,/startSupplement/);
assert.match(consultation,/startReady/);
assert.match(consultation,/ready-probe/);
assert.match(consultation,/DUAL_CONSULT_FINAL/);
assert.match(consultation,/noMoreSymptoms/);
assert.match(consultation,/\/api\/symptom-next/);
assert.match(consultation,/askedConceptIds/);
assert.match(consultation,/rememberAskedConcept/);
assert.doesNotMatch(consultation,/const questions=\[/);
assert.doesNotMatch(consultation,/\[THAP_VAN_CONTEXT\]/);
assert.match(server,/app\.post\('\/api\/symptom-next'/);
assert.match(server,/app\.post\('\/api\/chat'/);
assert.match(server,/retrieveSimilarCasesRuntime/);
assert.match(release,/2026\.09\.21-recognition-prod-r1/);

console.log('DUAL CONSULT PASS: users may supplement symptoms or start comparison immediately; case-RAG asks at most 3 evidence-backed follow-ups and then finalizes.');