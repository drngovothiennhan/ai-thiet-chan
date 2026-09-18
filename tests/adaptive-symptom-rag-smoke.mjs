import assert from 'node:assert/strict';
import fs from 'node:fs';
import {suggestNextSymptomQuestion} from '../case-retrieval.mjs';

const retrieval={
  cases:[
    {caseText:'患者头痛、头晕、恶心，舌红。'},
    {caseText:'Headache with dizziness and nausea, poor appetite.'},
    {caseText:'患者头晕，食欲不振，乏力。'},
    {caseText:'Dizziness with fatigue.'}
  ]
};
const q1=suggestNextSymptomQuestion('Tôi đau đầu',retrieval);
assert.equal(q1.evidenceBased,true);
assert.equal(q1.conceptId,'dizziness');
assert.equal(q1.supportCases,4);
assert.match(q1.question,/chóng mặt|hoa mắt/iu);

const q2=suggestNextSymptomQuestion('Tôi đau đầu và chóng mặt',retrieval);
assert.equal(q2.evidenceBased,true);
assert.ok(['nausea','poor-appetite','fatigue'].includes(q2.conceptId));
assert.notEqual(q2.conceptId,'dizziness');

const empty=suggestNextSymptomQuestion('Tôi đau đầu',{cases:[]});
assert.equal(empty.evidenceBased,false);
assert.equal(empty.conceptId,null);
assert.match(empty.question,/triệu chứng|khó chịu/iu);

const server=fs.readFileSync('server.mjs','utf8');
const consultation=fs.readFileSync('public/consultation.js','utf8');
assert.match(server,/app\.post\('\/api\/symptom-next'/);
assert.match(server,/suggestNextSymptomQuestion/);
assert.match(server,/symptom_rag_question/);
assert.match(consultation,/requestTarget='\/api\/symptom-next'/);
assert.match(consultation,/requestKind==='adaptive-next'/);
assert.match(consultation,/body\.symptomContext=inquiry\.transcript/);
assert.doesNotMatch(consultation,/\/api\/symptom-next[\s\S]{0,800}GEMINI/i);

console.log('ADAPTIVE SYMPTOM RAG PASS: intermediate questioning uses bounded retrieved case text and deterministic symptom selection without an LLM call; final synthesis remains on the existing consultation path.');
