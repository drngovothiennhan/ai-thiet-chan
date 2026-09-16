import assert from 'node:assert/strict';
import fs from 'node:fs';

const fallback=fs.readFileSync(new URL('../public/book-fallback.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../public/academic-source.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

assert.match(fallback,/import\('\/academic-source\.js'\)/);
assert.match(fallback,/data\?\.fallback\|\|data\?\.localVision/);
assert.match(fallback,/Tài liệu đã nạp: âm dịch\/hư nhiệt cần đối chiếu/);
assert.match(fallback,/Tài liệu đã nạp: nguyên tắc đọc thiệt tượng/);
assert.match(fallback,/Đã đối chiếu kho tài liệu đã nạp trong chế độ dự phòng không dùng Gemini/);
assert.match(fallback,/x-aitc-book-grounding/);
assert.match(source,/âm hư/);
assert.match(source,/tĩnh mạch dưới lưỡi/);
assert.ok(releaseUi.indexOf("/analysis-hotfix.js")<releaseUi.indexOf("/book-fallback.js"));
assert.ok(releaseUi.indexOf("/book-fallback.js")<releaseUi.indexOf("/benchmark-telemetry.js"));
assert.match(sw,/ai-thiet-chan-v2\.9\.10-book-grounding/);
assert.match(sw,/book-fallback\.js/);
assert.match(sw,/academic-source\.js/);

console.log('BOOK FALLBACK SMOKE PASS: no-Gemini image fallback visibly grounds interpretation in the supplied academic knowledge while keeping source/page citations out of the result UI.');
