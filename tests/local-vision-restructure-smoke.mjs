import assert from 'node:assert/strict';
import fs from 'node:fs';

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

assert.match(academic,/export function verifyClientVisualPayload/);
assert.doesNotMatch(academic,/function geminiLayer/);

assert.match(guard,/GEMINI_VISION_DISABLED/);
assert.match(guard,/if\(vision\) return blockedVisionResponse\(\)/);
assert.doesNotMatch(guard,/GEMINI_VISION_FALLBACK_MODEL|gemini_vision_model_fallback/);

assert.doesNotMatch(releaseUi,/analysis-hotfix\.js/);
assert.doesNotMatch(sw,/analysis-hotfix\.js/);

console.log('LOCAL VISION RESTRUCTURE SMOKE PASS: Gemini is excluded from image analysis; verified local vision is the only image-observation authority; Gemini remains text-only after structured results exist.');
