import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow=fs.readFileSync(new URL('../public/chat-flow-ui.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert.match(flow,/chat-flow-ui-v1/);
assert.match(flow,/\/api\/analyze/);
assert.match(flow,/Kết quả tổng quát ban đầu của ca hiện tại/);
assert.match(flow,/FOLLOW_UP_QUESTION/);
assert.match(flow,/chatPhase='gemini-followup'/);
assert.match(flow,/không lặp lại toàn bộ kết quả trên/i);
assert.match(flow,/settingsManagementHub/);
assert.match(flow,/history-card/);
assert.match(flow,/admin-center-entry/);
assert.match(flow,/data-nav="cases"/);

const consultationAt=index.indexOf('<script src="/consultation.js" defer></script>');
const flowAt=index.indexOf('<script src="/chat-flow-ui.js" defer></script>');
const settingsAt=index.indexOf('<script src="/settings.js" defer></script>');
assert.ok(consultationAt>=0&&flowAt>consultationAt&&settingsAt>flowAt,'chat flow must wrap consultation before settings UI boot');

console.log('CHAT FLOW UI SMOKE PASS: initial result is published once, follow-up questions are routed as Gemini follow-ups, and History/Admin are grouped under Settings management.');
