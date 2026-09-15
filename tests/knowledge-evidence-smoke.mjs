import fs from 'node:fs';
import assert from 'node:assert/strict';

const knowledge=fs.readFileSync(new URL('../knowledge.mjs',import.meta.url),'utf8');
const evidence=fs.readFileSync(new URL('../knowledge-evidence.mjs',import.meta.url),'utf8');

for(const marker of [
  "thiet-chan-kb-2026-09-15.2doc",
  'CORE_TONGUE_EVIDENCE',
  'QUY TẮC DẪN CHỨNG',
  'Nguồn đối chiếu',
  '[TC1, tr. 20]',
  '[DY1, tr. 24]'
]) assert.ok(knowledge.includes(marker),`knowledge missing marker: ${marker}`);

for(const marker of [
  "id:'TC1'",
  "id:'DY1'",
  "title:'Thiệt chẩn hoàn chỉnh'",
  'Đông y chẩn đoán bệnh trên lưỡi',
  "id:'TC1-005'",
  "id:'TC1-048'",
  "id:'DY1-012'",
  "id:'DY1-027'",
  'sha256',
  'trang PDF'
]) assert.ok(evidence.includes(marker),`evidence corpus missing marker: ${marker}`);

assert.ok(!evidence.includes('chẩn đoán xác định bệnh'), 'corpus must not claim definitive disease diagnosis');
console.log('KNOWLEDGE EVIDENCE SMOKE PASS: two user PDFs are indexed with page-grounded evidence and citation rules');
