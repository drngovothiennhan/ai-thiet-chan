import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow=fs.readFileSync(new URL('../public/chat-flow-ui.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const lock=fs.readFileSync(new URL('../public/consultation-lock.js',import.meta.url),'utf8');
const fallback=fs.readFileSync(new URL('../public/book-fallback.js',import.meta.url),'utf8');

assert.match(flow,/chat-flow-ui-v2-gemini-followup-admin/);
assert.match(flow,/\/api\/analyze/);
assert.match(flow,/Kết quả tổng quát ban đầu của ca hiện tại/);
assert.doesNotMatch(flow,/Từ câu hỏi tiếp theo, Trợ lý tham vấn sẽ xử lý đúng câu hỏi mới/);
assert.match(flow,/FOLLOW_UP_QUESTION/);
assert.match(flow,/chatPhase='gemini-followup'/);
assert.match(flow,/consultationEngine='gemini'/);
assert.match(flow,/externalReasoning='required'/);
assert.match(flow,/requireConcreteAnswer=true/);
assert.match(flow,/Vui lòng chờ, Trợ lý tham vấn đang tra cứu và đối chiếu ngữ cảnh/);
assert.match(flow,/không dùng cùng một đoạn trả lời cho các câu hỏi khác nhau/);
assert.match(flow,/recentConversationContext/);
assert.match(flow,/quality-card/);
assert.match(flow,/history-card/);
assert.match(flow,/data-aitc-admin-only/);
assert.match(flow,/adminDashboard/);
assert.match(flow,/adminProtectedViews/);
assert.doesNotMatch(flow,/settingsManagementHub/);
assert.match(flow,/data-nav="cases"/);
assert.match(flow,/Trợ lý tham vấn/);
assert.match(flow,/replace\(\/Chatbot\/gi,'Trợ lý tham vấn'\)/);

assert.match(lock,/localFallbackForChat:false/);
assert.match(lock,/body\.consultationEngine='gemini'/);
assert.match(lock,/body\.externalReasoning='required'/);
assert.match(lock,/FOLLOW_UP_QUESTION/);
assert.match(lock,/tra cứu và đối chiếu theo ngữ cảnh ca hiện tại/);
assert.doesNotMatch(lock,/Trong khung chatbot/);

assert.match(fallback,/Đã đối chiếu kho dữ liệu máy học\./);
assert.doesNotMatch(fallback,/Đã Tham Vấn kho tri thức trong chế độ dự phòng không dùng Gemini\./);

const consultationAt=index.indexOf('<script src="/consultation.js" defer></script>');
const flowAt=index.indexOf('<script src="/chat-flow-ui.js" defer></script>');
const settingsAt=index.indexOf('<script src="/settings.js" defer></script>');
assert.ok(consultationAt>=0&&flowAt>consultationAt&&settingsAt>flowAt,'chat flow must wrap consultation before settings UI boot');

console.log('CHAT FLOW UI SMOKE PASS: initial result is published once; post-result questions are forced through contextual Gemini with loading feedback; quality/history are admin-only.');
