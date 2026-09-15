import fs from 'node:fs';
import assert from 'node:assert/strict';
import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, KNOWLEDGE_DOCUMENTS, TONGUE_KNOWLEDGE, knowledgeForQuery } from '../knowledge.mjs';
import { TONGUE_EVIDENCE } from '../knowledge-evidence.mjs';
import { EXTENDED_EVIDENCE, EXTENDED_KNOWLEDGE_DOCUMENTS, PSYCH_CONTEXT_RULES } from '../knowledge-extended.mjs';

const extendedSource=fs.readFileSync(new URL('../knowledge-extended.mjs',import.meta.url),'utf8');

assert.equal(KNOWLEDGE_VERSION,'thiet-chan-kb-2026-09-15.5doc');
assert.equal(KNOWLEDGE_DOCUMENTS.length,5);
assert.equal(EXTENDED_KNOWLEDGE_DOCUMENTS.length,3);
for(const title of ['Thiệt chẩn hoàn chỉnh','Đông y chẩn đoán bệnh trên lưỡi','Chẩn đoán bằng mạch chẩn và thiệt chẩn','Thiệt chẩn bằng hình ảnh','Tâm bệnh học']) assert.ok(KNOWLEDGE_SOURCES.some(x=>x.includes(title)),`missing knowledge source: ${title}`);
for(const id of ['TC1-005','TC1-048','DY1-012','DY1-027']) assert.ok(TONGUE_EVIDENCE.some(e=>e.id===id),`base evidence corpus missing id: ${id}`);
for(const id of ['MC1-077','MC1-083','AT1-001','AT1-022','PSY1-014','PSY1-044']) assert.ok(EXTENDED_EVIDENCE.some(e=>e.id===id),`extended evidence corpus missing id: ${id}`);
for(const marker of ["id:'MC1'","id:'AT1'","id:'PSY1'",'driveFileId','sha256']) assert.ok(extendedSource.includes(marker),`extended source missing marker: ${marker}`);
assert.ok(TONGUE_KNOWLEDGE.includes('Năm tài liệu PDF người dùng cung cấp được phối hợp theo vai trò'));
assert.ok(TONGUE_KNOWLEDGE.includes('Nguồn/trang chỉ được hiển thị trong chatbot sau khi đã có kết quả thiệt chẩn'));
assert.ok(!/\[(?:TC1|DY1|MC1|AT1|PSY1),\s*tr\./.test(TONGUE_KNOWLEDGE),'analysis knowledge must not render citations');
assert.ok(PSYCH_CONTEXT_RULES.includes('Không suy rối loạn tâm thần'));

const tongue=knowledgeForQuery('lưỡi đỏ rêu vàng dày khô nứt',{limit:12});
assert.ok(/\[(?:TC1|DY1|MC1|AT1), tr\. \d+\]/.test(tongue),'chat retrieval must include page-grounded citations');
assert.ok(tongue.includes('Nguồn đối chiếu'),'chat retrieval must carry source-display instruction');
const psych=knowledgeForQuery('sau phân tích người dùng nói stress lo âu và mất ngủ',{limit:12});
assert.ok(psych.includes('[PSY1, tr.'),'psych knowledge must only become retrievable for relevant chat context');
console.log('KNOWLEDGE EVIDENCE SMOKE PASS: five user PDFs are grounded, psych context is gated, and citations are chatbot-only');
