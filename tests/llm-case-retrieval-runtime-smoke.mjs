import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aitc-case-retrieval-'));
const dbPath=path.join(tmp,'snapshot.sqlite');
const db=new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE cases (
  id INTEGER PRIMARY KEY,
  corpus_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_record_id TEXT,
  task TEXT,
  case_text TEXT NOT NULL,
  target TEXT,
  provenance_json TEXT NOT NULL,
  content_sha256 TEXT NOT NULL UNIQUE,
  simhash64 TEXT,
  pmid TEXT,
  pmcid TEXT,
  doi TEXT,
  license TEXT
);
CREATE VIRTUAL TABLE cases_fts USING fts5(case_text,target,source_id,task,content="cases",content_rowid="id",tokenize="unicode61");
`);
const insert=db.prepare('INSERT INTO cases(id,corpus_id,source_id,source_record_id,task,case_text,target,provenance_json,content_sha256,license) VALUES (?,?,?,?,?,?,?,?,?,?)');
insert.run(1,'AITC-LLM-Case-Reasoning-v1','tcmchat-medical-case-sft-v1','tc-1','sft','患者头晕、头痛，舌红，苔黄，食欲不振。','证候示例，仅作教育检索。','{"license":"upstream-dataset"}','a'.repeat(64),'upstream-dataset');
insert.run(2,'AITC-LLM-Case-Reasoning-v1','tcmchat-medical-case-sft-v1','tc-2','sft','患者腹痛腹泻，舌淡苔白。','另一个教育病例。','{"license":"upstream-dataset"}','b'.repeat(64),'upstream-dataset');
insert.run(3,'AITC-LLM-Case-Reasoning-v1','pmc-ccby-cc0-case-reports-v1','pmc-1','case_reasoning','A case report described a black tongue after antibiotic exposure.','Educational case summary.','{"license":"CC-BY-4.0","pmcid":"PMC1"}','c'.repeat(64),'CC-BY-4.0');
db.exec('INSERT INTO cases_fts(rowid,case_text,target,source_id,task) SELECT id,case_text,target,source_id,task FROM cases');
db.close();

process.env.AITC_CASE_RETRIEVAL_DB=dbPath;
process.env.AITC_CASE_RETRIEVAL_TOP_K='2';
const mod=await import('../case-retrieval.mjs?smoke=1');

const health=mod.caseRetrievalHealth();
assert.equal(health.ready,true);
assert.equal(health.records,3);
assert.equal(health.defaultTopK,2);
assert.equal(health.maxTopK,5);

const result=mod.retrieveSimilarCases('Lưỡi đỏ rêu vàng, chóng mặt và đau đầu',{limit:2});
assert.equal(result.active,true);
assert.ok(result.returned>=1);
assert.ok(result.returned<=2);
assert.ok(result.terms.includes('舌红'));
assert.ok(result.terms.includes('苔黄'));
assert.ok(result.terms.includes('头痛'));
const relevant=result.cases.find(item=>item.sourceId==='tcmchat-medical-case-sft-v1'&&/舌红.*苔黄/.test(item.caseText));
assert.ok(relevant,'expected bounded retrieval to include the clinically matching TCM case');

const context=mod.formatCaseRetrievalContext(result);
assert.match(context,/chỉ tham khảo, không phải gold/);
assert.ok(context.length<7601);
assert.ok(!context.includes('data:image/'));

console.log('LLM CASE RETRIEVAL RUNTIME SMOKE PASS: read-only SQLite FTS5 returns bounded top-k case chunks without loading the corpus into request memory.');
