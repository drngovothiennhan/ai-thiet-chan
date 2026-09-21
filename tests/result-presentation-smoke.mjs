import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const vision=fs.readFileSync('local-vision-engine.mjs','utf8');
const release=fs.readFileSync('public/release-meta.js','utf8');
const css=fs.readFileSync('public/styles.css','utf8');

assert.match(home,/<strong>Bàn luận<\/strong><div id="summaryText" class="discussion-content"><\/div>/);
assert.match(home,/<strong>Giới hạn<\/strong>Kết quả hỗ trợ học tập và đối chiếu YHCT; không thay thế tứ chẩn và khám trực tiếp\./);
assert.doesNotMatch(home,/<strong>Tóm tắt<\/strong>/);
assert.match(app,/Kết luận sơ bộ/);
assert.match(app,/Dữ liệu máy học/);
assert.match(app,/Đối chiếu y văn/);
assert.doesNotMatch(app,/<div class="theory-title">Chưa thể kết luận<\/div>/);
assert.doesNotMatch(app,/Gemini\/LLM không được phép tạo quan sát hình ảnh/);
assert.match(vision,/Gemini\/LLM không được phép tạo quan sát hình ảnh/);
assert.match(app,/cleanMachineLearningSummary/);
assert.match(app,/Đã đối chiếu\\s\+\\d\+\\s\+ca tương tự từ corpus/);
assert.match(app,/Giới hạn:\\s\*\.\*\$/);
assert.match(app,/evidence-block/);
assert.match(app,/Mức phù hợp dấu hiệu/);
assert.match(app,/Cảnh báo mức cao/);
assert.match(app,/không phải xác suất chẩn đoán/);
assert.match(css,/preliminary-conclusion/);
assert.match(css,/evidence-list/);
assert.match(app,/function cleanDiscussionSummary/);
assert.match(app,/function renderDiscussion/);
assert.match(app,/discussion-list/);
assert.match(css,/\.discussion-box/);
assert.match(css,/\.discussion-list/);
assert.match(css,/line-height:1\.62/);
assert.match(release,/2026\.09\.20-responsive-admin-r1/);

console.log('RESULT PRESENTATION PASS: preliminary conclusion and Discussion use professional spacing; Discussion is rendered as separated bullets and duplicate long limitations are presentation-filtered.');
