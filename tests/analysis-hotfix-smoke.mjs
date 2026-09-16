import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../runtime-guard.mjs',import.meta.url),'utf8');
const hotfix=fs.readFileSync(new URL('../public/analysis-hotfix.js',import.meta.url),'utf8');
const telemetry=fs.readFileSync(new URL('../public/benchmark-telemetry.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

assert.match(runtime,/GEMINI_VISION_TIMEOUT_MS=8_000/);
assert.match(runtime,/GEMINI_VISION_MAX_ATTEMPTS=2/);
assert.match(runtime,/vision&&err\?\.message==='UPSTREAM_TIMEOUT'\) break/);
assert.match(runtime,/gemini_attempt_complete/);
assert.match(hotfix,/FALLBACK_DEADLINE_MS=8_500/);
assert.match(hotfix,/LOCAL_PERSIST_DEADLINE_MS=3_500/);
assert.match(hotfix,/\/api\/cases\/collect-local/);
assert.match(hotfix,/x-aitc-collection/);
assert.ok(server.includes("app.post('/api/local-fusion'"));
assert.ok(server.includes("app.post('/api/cases/collect-local',aiRateLimit"));
assert.match(server,/source:'local-fallback'/);
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

console.log('ANALYSIS HOTFIX SMOKE PASS: local CV fallback is bounded, academically fused, provenance-tagged/capped, and durably persisted before the UI reports data collection success.');
