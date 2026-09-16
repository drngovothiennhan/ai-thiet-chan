import fs from 'node:fs';
import assert from 'node:assert/strict';

const quality=fs.readFileSync(new URL('../public/quality-grounding-v4.js',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../public/admin-enhancement-collapse.js',import.meta.url),'utf8');
const consultation=fs.readFileSync(new URL('../public/consultation.js',import.meta.url),'utf8');

assert.match(quality,/quality-grounding-v4\.0\.0/);
assert.match(quality,/AITCImageEnhancement\.enhanceDataUrl/);
assert.match(quality,/Cần chụp lại/);
assert.match(quality,/approvedClinicalKnowledge/);
assert.match(quality,/Y văn đã nạp/);
assert.match(quality,/ATLAS_VISIBLE_THRESHOLD=\.72/);
assert.match(quality,/atlasLanguage/);
assert.match(consultation,/clinical-learning\.js\?v=2\.9\.0/);
assert.match(loader,/clinicalFeedbackCard/);
assert.doesNotMatch(loader,/loadRuntime\('\/clinical-learning\.js/);
assert.match(loader,/quality-grounding-v4\.js/);

console.log('quality-grounding-v4-smoke: ok');
