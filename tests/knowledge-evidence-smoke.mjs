import fs from 'node:fs';
import assert from 'node:assert/strict';
import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, TONGUE_KNOWLEDGE } from '../knowledge.mjs';
import { TONGUE_EVIDENCE, KNOWLEDGE_DOCUMENTS, citationInstruction } from '../knowledge-evidence.mjs';

const evidenceSource=fs.readFileSync(new URL('../knowledge-evidence.mjs',import.meta.url),'utf8');

assert.equal(KNOWLEDGE_VERSION,'thiet-chan-kb-2026-09-15.2doc');
assert.equal(KNOWLEDGE_DOCUMENTS.length,2);
assert.ok(KNOWLEDGE_SOURCES.some(x=>x.includes('Thiệt chẩn hoàn chỉnh')));
assert.ok(KNOWLEDGE_SOURCES.some(x=>x.includes('Đông y chẩn đoán bệnh trên lưỡi')));
for(const marker of ['QUY TẮC DẪN CHỨNG','Nguồn đối chiếu','[TC1, tr. 20]','[DY1, tr. 24]']) assert.ok(TONGUE_KNOWLEDGE.includes(marker),`rendered knowledge missing marker: ${marker}`);
for(const id of ['TC1-005','TC1-048','DY1-012','DY1-027']) assert.ok(TONGUE_EVIDENCE.some(e=>e.id===id),`evidence corpus missing id: ${id}`);
for(const marker of ["id:'TC1'","id:'DY1'",'sha256','trang PDF']) assert.ok(evidenceSource.includes(marker),`evidence source missing marker: ${marker}`);
assert.ok(citationInstruction().includes('Không bịa tên sách/trang'));
console.log('KNOWLEDGE EVIDENCE SMOKE PASS: two user PDFs are indexed with page-grounded evidence and citation rules');
