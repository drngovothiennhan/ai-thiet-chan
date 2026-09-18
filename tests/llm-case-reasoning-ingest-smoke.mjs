import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aitc-case-'));
const input=path.join(tmp,'in.json');
const output=path.join(tmp,'out.jsonl');
const state=path.join(tmp,'state.json');
fs.writeFileSync(input,JSON.stringify([
  {id:'a',instruction:'Analyze this clinical case carefully.',input:'Patient has fatigue, poor appetite and a thick tongue coating after a recent illness.',output:'Summarize observations, uncertainty and next evidence needed.'},
  {id:'b',instruction:'Analyze this clinical case carefully.',input:'Patient has fatigue, poor appetite and a thick tongue coating after a recent illness.',output:'Summarize observations, uncertainty and next evidence needed.'},
  {id:'c',instruction:'Analyze another case.',input:'Patient has recurrent dry mouth, dry eyes and sleep disturbance with a confirmed biomedical diagnosis.',output:'Separate biomedical diagnosis from TCM pattern reasoning.'}
],null,2));
const run=spawnSync(process.execPath,['scripts/case-reasoning-ingest.mjs','--source-id','pmc-ccby-cc0-case-reports-v1','--input',input,'--output',output,'--state',state],{encoding:'utf8'});
assert.equal(run.status,0,run.stderr||run.stdout);
const lines=fs.readFileSync(output,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
assert.equal(lines.length,2);
const st=JSON.parse(fs.readFileSync(state,'utf8'));
assert.equal(st.accepted,2);
assert.equal(st.rejected.exactDuplicate,1);
assert.equal(st.clinicalGoldOperationalRequirement,false);
for(const row of lines){
  assert.equal(row.schemaVersion,'aitc-case-record-v1');
  assert.equal(row.corpusId,'AITC-LLM-Case-Reasoning-v1');
  assert.ok(row.hashes.contentSha256);
  assert.ok(row.hashes.simhash64);
}
console.log('llm case reasoning ingest smoke: PASS');
