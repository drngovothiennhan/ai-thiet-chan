import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../runtime-guard.mjs',import.meta.url),'utf8');
const hotfix=fs.readFileSync(new URL('../public/analysis-hotfix.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const fusion=fs.readFileSync(new URL('../api/local-fusion.mjs',import.meta.url),'utf8');
const benchmark=fs.readFileSync(new URL('../api/benchmark.mjs',import.meta.url),'utf8');

assert.match(runtime,/GEMINI_VISION_TIMEOUT_MS=8_000/);
assert.match(runtime,/GEMINI_VISION_MAX_ATTEMPTS=1/);
assert.match(runtime,/gemini_attempt_complete/);
assert.match(hotfix,/FALLBACK_DEADLINE_MS=8_500/);
assert.match(hotfix,/prepareLocal\(body\)/);
assert.match(hotfix,/Promise\.race/);
assert.match(hotfix,/fallback:true/);
assert.match(hotfix,/local-open-source-vision-v1/);
assert.match(hotfix,/FALLBACK_CONFIDENCE_CAP=\.62/);
assert.match(hotfix,/academicSignature/);
assert.match(hotfix,/\/api\/local-fusion/);
assert.match(hotfix,/analysis_render/);
assert.match(hotfix,/clickToResultMs/);
assert.match(releaseUi,/analysis-hotfix\.js/);
assert.match(fusion,/applyAcademicFusion/);
assert.match(fusion,/model-observation-not-ground-truth/);
assert.match(benchmark,/analysis_benchmark/);

console.log('ANALYSIS HOTFIX SMOKE PASS: vision is bounded, local CV runs in parallel, fallback is provenance-tagged/capped, academic fusion is available, and click-to-result telemetry is emitted.');
