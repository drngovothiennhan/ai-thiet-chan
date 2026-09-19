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
assert.match(q1.question,/đối chiếu chứng trạng/iu);

const q2=suggestNextSymptomQuestion('Tôi đau đầu và chóng mặt',retrieval);
assert.equal(q2.evidenceBased,true);
assert.ok(['nausea','poor-appetite','fatigue'].includes(q2.conceptId));
assert.notEqual(q2.conceptId,'dizziness');

const q3=suggestNextSymptomQuestion('Không',retrieval,{excludeConceptIds:['dizziness']});
assert.equal(q3.evidenceBased,true);
assert.notEqual(q3.conceptId,'dizziness');
assert.ok(['nausea','poor-appetite','fatigue'].includes(q3.conceptId));

const empty=suggestNextSymptomQuestion('Tôi đau đầu',{cases:[]});
assert.equal(empty.evidenceBased,false);
assert.equal(empty.conceptId,null);
assert.match(empty.question,/triệu chứng|khó chịu/iu);

const server=fs.readFileSync('server.mjs','utf8');
const consultation=fs.readFileSync('public/consultation.js','utf8');
assert.match(server,/app\.post\('\/api\/symptom-next'/);
assert.match(server,/suggestNextSymptomQuestion/);
assert.match(server,/symptom_rag_question/);
assert.match(server,/excludeConceptIds:excludedConceptIds/);
assert.match(consultation,/requestTarget='\/api\/symptom-next'/);
assert.match(consultation,/requestKind==='adaptive-next'/);
assert.match(consultation,/body\.symptomContext=inquiry\.transcript/);
assert.match(consultation,/body\.askedConceptIds=\[\.\.\.inquiry\.askedConceptIds\]/);
assert.match(consultation,/inquiry\.interactions\.push/);
assert.match(consultation,/Hỏi: /);
assert.match(consultation,/rememberAskedConcept\(payload\?\.selectedConcept\)/);
assert.doesNotMatch(consultation,/\/api\/symptom-next[\s\S]{0,800}GEMINI/i);

console.log('ADAPTIVE SYMPTOM RAG PASS: prior question-answer context and concept IDs block repeated prompts; deterministic case-RAG rotates to an unasked evidence-backed symptom without an LLM call.');
