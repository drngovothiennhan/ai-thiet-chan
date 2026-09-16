import assert from 'node:assert/strict';
import fs from 'node:fs';

const fallback=fs.readFileSync(new URL('../public/book-fallback.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../public/academic-source.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../runtime-guard.mjs',import.meta.url),'utf8');
const consultation=fs.readFileSync(new URL('../public/consultation.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const academic=fs.readFileSync(new URL('../academic-server.mjs',import.meta.url),'utf8');

assert.match(fallback,/import\('\/academic-source\.js'\)/);
assert.match(fallback,/data\?\.fallback\|\|data\?\.localVision/);
assert.match(fallback,/Tham Vấn: âm dịch\/hư nhiệt cần đối chiếu/);
assert.match(fallback,/Tham Vấn: nguyên tắc đọc thiệt tượng/);
assert.match(fallback,/Đã Tham Vấn kho tri thức/);
assert.doesNotMatch(fallback,/Tài liệu đã nạp:/);
assert.match(fallback,/x-aitc-book-grounding/);
assert.match(source,/âm hư/);
assert.match(source,/tĩnh mạch dưới lưỡi/);
assert.ok(releaseUi.indexOf("/analysis-hotfix.js")<releaseUi.indexOf("/book-fallback.js"));
assert.ok(releaseUi.indexOf("/book-fallback.js")<releaseUi.indexOf("/benchmark-telemetry.js"));
assert.match(sw,/ai-thiet-chan-v2\.9\.11-thamvan-gemini/);
assert.match(sw,/book-fallback\.js/);
assert.match(sw,/academic-source\.js/);

assert.match(server,/app\.post\('\/api\/chat',async\(req,res\)=>/);
assert.doesNotMatch(server,/app\.post\('\/api\/chat',aiRateLimit/);
assert.match(server,/outsideKnowledgeSuffix:'\[A\.I\]'/);
assert.match(server,/\[CHAT_GROUNDING_PROTOCOL\]/);
assert.match(server,/GROUNDING\\s\*=\\s\*\(IN\|OUT\)/);
assert.match(server,/applicationRateLimit:false/);
assert.match(server,/Không coi lưỡi gà là một phần của lưỡi/);
assert.match(server,/atlasLanguageThreshold/);
assert.match(runtime,/groundingProtocol/);
assert.match(runtime,/GROUNDING=IN/);

assert.match(consultation,/Chatbot Gemini có thể được hỏi trực tiếp không giới hạn lượt ở tầng ứng dụng/);
assert.doesNotMatch(consultation,/Bạn có thể bắt đầu Thập vấn hoặc chọn “Bỏ qua Thập vấn” để xem ngay nhận định hiện tại/);
assert.match(index,/Tham Vấn · Gemini/);
assert.match(index,/vòm miệng\/lưỡi gà dùng làm mốc định hướng phía sau/);
assert.match(index,/Giữ trọn lưỡi từ đầu đến gốc trong khung/);

assert.match(academic,/ATLAS_LANGUAGE_THRESHOLD=\.85/);
assert.match(academic,/Tham Vấn: tương đồng atlas/);
assert.match(academic,/Ngôn từ được giữ theo tài liệu khi đối chiếu hình ảnh đạt từ 85% trở lên/);

console.log('THAM VAN / GEMINI UPGRADE SMOKE PASS: backup-safe naming, unrestricted app-level chat, [A.I] grounding marker, full-tongue landmark guidance, and >=85% atlas wording gate are present.');
