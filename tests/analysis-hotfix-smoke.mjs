import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../runtime-guard.mjs',import.meta.url),'utf8');
const hotfix=fs.readFileSync(new URL('../public/analysis-hotfix.js',import.meta.url),'utf8');
const telemetry=fs.readFileSync(new URL('../public/benchmark-telemetry.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

assert.match(runtime,/GEMINI_VISION_TIMEOUT_MS=8_000/);
assert.match(runtime,/GEMINI_VISION_FALLBACK_MODEL='gemini-3\.6-flash'/);
assert.match(runtime,/GEMINI_VISION_FALLBACK_TIMEOUT_MS=6_000/);
assert.match(runtime,/model:GEMINI_VISION_FALLBACK_MODEL/);
assert.match(runtime,/gemini_vision_model_fallback/);
assert.match(runtime,/gemini_attempt_complete/);
assert.match(hotfix,/FALLBACK_DEADLINE_MS=8_500/);
assert.match(hotfix,/prepareLocal\(body\)/);
assert.match(hotfix,/Promise\.race/);
assert.match(hotfix,/fallback:true/);
assert.match(hotfix,/local-open-source-vision-v1/);
assert.match(hotfix,/FALLBACK_CONFIDENCE_CAP=\.62/);
assert.match(hotfix,/academicSignature/);
assert.match(hotfix,/clickToResultMs/);
assert.match(telemetry,/ai_thiet_chan_benchmark_record_v1/);
assert.match(telemetry,/clickToResultMs/);
assert.match(telemetry,/requestToResultMs/);
assert.match(telemetry,/fallbackReason/);
assert.match(releaseUi,/analysis-hotfix\.js/);
assert.match(releaseUi,/benchmark-telemetry\.js/);
assert.match(sw,/benchmark-telemetry\.js/);

console.log('ANALYSIS HOTFIX SMOKE PASS: vision uses bounded Gemini 3.8 -> 3.6 provider failover, local CV runs in parallel, fallback is provenance-tagged/capped, and exact client benchmark telemetry is persisted.');
