import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const home=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/release-ui.css',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

assert.equal(pkg.version,'2.9.2');
assert.ok(server.includes("const VERSION = '2.9.2'"),'server release metadata must be 2.9.2');
assert.ok(server.includes('knowledgeForQuery'),'chat must use grounded retrieval');
assert.ok(server.includes('retrievedKnowledge'),'chat retrieval context missing');
assert.ok(!server.includes('knowledgeVersion:KNOWLEDGE_VERSION,knowledgeSources:KNOWLEDGE_SOURCES'),'analysis payload must not expose knowledge sources');
assert.ok(server.includes('localGroundedReport({assessment:llmData'),'local grounded report path missing');
assert.ok(server.includes("provider:'local-grounded'"),'local grounded provider boundary missing');
assert.ok(home.includes('/release-ui.css')&&home.includes('/release-ui.js'),'release UI assets not loaded');
for(const marker of ['workflow-stepper','aitc-bottom-nav','Thiệt chẩn','Kết quả','Đối chiếu','Ca','Hệ thống','setWorkspace','aitc-workspace-hidden','sanitizeNonChatReferences']) assert.ok(ui.includes(marker),`release UI missing ${marker}`);
assert.ok(ui.includes("grid-template-columns:repeat(5")||css.includes('grid-template-columns:repeat(5'),'taskbar must expose five separated workspaces');
assert.ok(ui.includes("data-nav=\"symptoms\"")&&ui.includes("data-nav=\"system\""),'taskbar must use functional workspaces instead of scroll targets');
assert.ok(!ui.includes("capture.scrollIntoView")&&!ui.includes("chat.scrollIntoView")&&!ui.includes("history.scrollIntoView"),'taskbar must switch workspaces instead of stretching one long scrolling page');
assert.ok(css.includes('.aitc-workspace-hidden{display:none!important}'),'inactive functional workspaces must be visually isolated without removing their DOM/runtime state');
assert.ok(ui.includes("(name==='result'||name==='symptoms')&&result.hidden"),'result and adaptive symptom workspaces must stay locked until analysis exists');
assert.ok(ui.includes("targets=[result,$('#reportBox')]")||ui.includes("targets=[result,$('#reportBox')].filter"),'source sanitizer must target result/report only');
assert.ok(!ui.includes("targets=[result,$('#reportBox'),$('#chatLog')]"),'chat references must remain visible');
assert.ok(css.includes('.capture-card .analyze-btn')&&css.includes('position:static')&&css.includes('bottom:auto'),'mobile primary action must remain in normal flow without covering image controls');
assert.ok(sw.includes('ai-thiet-chan-v2.9.8-knowledge-5doc-complete')&&sw.includes("'/release-ui.js'")&&sw.includes("'/release-ui.css'"),'PWA shell release gate failed');
console.log('RELEASE 2.9.2 SMOKE PASS: five-document RAG boundary, streamlined UI, local-grounded consultation policy and PWA release wiring are enforced');
