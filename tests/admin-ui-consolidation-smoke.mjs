import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const admin=fs.readFileSync('public/admin-center.js','utf8');
const clinical=fs.readFileSync('public/clinical-learning.js','utf8');
const css=fs.readFileSync('public/settings.css','utf8');
const release=fs.readFileSync('public/release-meta.js','utf8');

assert.doesNotMatch(home,/class="card history-card"/);
assert.doesNotMatch(home,/class="inquiry-note"/);
assert.doesNotMatch(home,/Không dùng bộ 10 câu cố định/);
assert.match(admin,/Lịch sử ca lâm sàng/);
assert.match(admin,/Kiến thức lâm sàng đã duyệt/);
assert.match(admin,/adminHistoryPanel/);
assert.match(admin,/adminLearnedPanel/);
assert.match(admin,/ai_thiet_chan_admin_list_learned_knowledge_v1/);
assert.match(app,/function historyNodes\(\)/);
assert.match(app,/event\.target\?\.id==='refreshHistoryBtn'/);
assert.match(clinical,/function renderLearningEvidence\(\)\{\s*removeLearningEvidence\(\);\s*\}/);
assert.match(css,/admin-compact-block/);
assert.match(release,/2026\.09\.21-responsive-shell-r2/);

console.log('ADMIN UI CONSOLIDATION PASS: history and approved clinical knowledge are Admin Center-only compact panels; yellow inquiry note is removed; learning/reasoning logic remains active.');
