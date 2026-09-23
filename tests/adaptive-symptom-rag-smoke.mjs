import assert from 'node:assert/strict';
import fs from 'node:fs';
import {suggestNextSymptomQuestion,buildRemoteCaseRetrievalTerms} from '../case-retrieval.mjs';

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
assert.ok(['headache','nausea','poor-appetite','fatigue'].includes(q3.conceptId));

const empty=suggestNextSymptomQuestion('Tôi đau đầu',{cases:[]});
assert.equal(empty.evidenceBased,false);
assert.equal(empty.conceptId,null);
assert.match(empty.question,/triệu chứng|khó chịu/iu);

const tcmCases={cases:[{caseText:'发热恶寒，自汗，口渴，失眠，便秘，小便短少。'}]};
const fever=suggestNextSymptomQuestion('Người dùng mệt',tcmCases,{excludeConceptIds:['fatigue']});
assert.equal(fever.conceptId,'fever-chills');
assert.match(fever.question,/sốt|ớn lạnh|sợ lạnh/iu);
const sweat=suggestNextSymptomQuestion('Người dùng mệt',tcmCases,{excludeConceptIds:['fatigue','fever-chills']});
assert.equal(sweat.conceptId,'sweating');
assert.match(sweat.question,/mồ hôi/iu);
const terms=buildRemoteCaseRetrievalTerms('sốt ớn lạnh ra mồ hôi khát mất ngủ táo bón tiểu tiện');
for(const term of ['发热','恶寒','汗出','口渴','失眠','便秘','小便'])assert.ok(terms.includes(term),`missing retrieval hint ${term}`);

const server=fs.readFileSync('server.mjs','utf8');
const consultation=fs.readFileSync('public/consultation.js','utf8');
assert.match(server,/app\.post\('\/api\/symptom-next'/);
assert.match(server,/suggestNextSymptomQuestion/);
assert.match(server,/symptom_rag_question/);
assert.match(server,/excludeConceptIds:excludedConceptIds/);
assert.match(consultation,/MAX_FOLLOWUPS=3/);
assert.match(consultation,/Bổ sung triệu chứng/);
assert.match(consultation,/Sẵn sàng đối chiếu/);
assert.match(consultation,/\/api\/symptom-next/);
assert.match(consultation,/askedConceptIds/);
assert.match(consultation,/rememberAskedConcept/);
assert.match(consultation,/DUAL_CONSULT_FINAL/);\nassert.match(consultation,/chất lưỡi\\/thân lưỡi/);\nassert.match(consultation,/dẫn chứng tri thức được cung cấp/);
assert.doesNotMatch(consultation,/const questions=\[/);
assert.doesNotMatch(consultation,/\[THAP_VAN_CONTEXT\]/);

console.log('DUAL CONSULT RAG PASS: both symptom-supplement and ready-compare paths reuse deterministic case-RAG, deduplicate asked concepts, ask at most 3 follow-ups, then finalize.');
