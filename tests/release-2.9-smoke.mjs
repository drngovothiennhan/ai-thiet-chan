import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const home=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/release-ui.css',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../public/settings.js',import.meta.url),'utf8');
const refresh=fs.readFileSync(new URL('../public/refresh.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

assert.equal(pkg.version,'2.9.2');
assert.ok(server.includes("const VERSION = '2.9.2'"),'server release metadata must be 2.9.2');
assert.ok(server.includes('knowledgeForQuery'),'chat must use grounded retrieval');
assert.ok(server.includes('retrievedKnowledge'),'chat retrieval context missing');
assert.ok(!server.includes('knowledgeVersion:KNOWLEDGE_VERSION,knowledgeSources:KNOWLEDGE_SOURCES'),'analysis payload must not expose knowledge sources');
assert.ok(server.includes('Không hiển thị tên tài liệu, nguồn tham khảo, mã citation hoặc số trang'),'report source boundary missing');
assert.ok(home.includes('/release-ui.css')&&home.includes('/release-ui.js'),'release UI assets not loaded');
for(const marker of ['workflow-stepper','aitc-bottom-nav','Thiệt chẩn','Trợ lý','Ca','Cài đặt','sanitizeNonChatReferences']) assert.ok(ui.includes(marker),`release UI missing ${marker}`);
assert.ok(ui.includes("targets=[result,$('#reportBox')]")||ui.includes("targets=[result,$('#reportBox')].filter"),'source sanitizer must target result/report only');
assert.ok(!ui.includes("targets=[result,$('#reportBox'),$('#chatLog')]"),'chat references must remain visible');
assert.ok(css.includes('.capture-card .analyze-btn')&&css.includes('position:sticky'),'mobile primary action must stay reachable');
assert.ok(sw.includes('ai-thiet-chan-v2.9.8-knowledge-5doc-complete')&&sw.includes("'/release-ui.js'")&&sw.includes("'/release-ui.css'"),'PWA shell release gate failed');

assert.ok(settings.includes('afterWindowLoad(async()=>'),'settings secondary modules must load after window load');
assert.ok(settings.includes('whenIdle(()=>loadOrdered(['),'admin settings modules must be idle-loaded');
assert.ok(ui.includes('afterWindowLoad(loadOperationalRuntime)'),'operational hotfix modules must stay off the critical refresh path');
assert.ok(ui.includes("whenIdle(async()=>{for(const src of ['/admin-enhancement-collapse.js','/admin-history.js'])"),'admin runtime must be idle-loaded');
assert.ok(sw.includes('ai-thiet-chan-v2.9.20-operational-latency'),'PWA cache version must include operational latency hotfix');
assert.ok(!sw.includes("'/admin-center.js'")&&!sw.includes("'/user-admin.js'")&&!sw.includes("'/admin-credentials.js'"),'admin modules must not block service-worker installation');
assert.ok(refresh.includes('Promise.allSettled(regs.map(reg=>reg.unregister()))'),'refresh must unregister old workers before navigation');
assert.ok(refresh.includes("key.startsWith('ai-thiet-chan-')")&&refresh.includes('requestAnimationFrame(()=>setTimeout(()=>location.replace(next),60))'),'refresh cache cleanup must be best-effort and non-blocking');

console.log('RELEASE 2.9.2 SMOKE PASS: five-document RAG boundary, streamlined UI, post-load operational modules, bounded refresh path and PWA release wiring are enforced');
