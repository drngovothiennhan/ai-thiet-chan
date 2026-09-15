import assert from 'node:assert/strict';
import {ACADEMIC_HEALTH,learningPriorityFromSimilarity} from '../academic-server.mjs';

const novel=learningPriorityFromSimilarity(0.42,{quality:'good',signaturePresent:true});
assert.equal(novel.status,'novel');
assert.equal(novel.priority,'high');
assert.equal(novel.learningCandidate,true);
assert.equal(novel.noveltyScore,0.58);

const uncommon=learningPriorityFromSimilarity(0.62,{quality:'fair',signaturePresent:true});
assert.equal(uncommon.status,'uncommon');
assert.equal(uncommon.priority,'medium');
assert.equal(uncommon.learningCandidate,true);

const covered=learningPriorityFromSimilarity(0.82,{quality:'good',signaturePresent:true});
assert.equal(covered.status,'covered');
assert.equal(covered.priority,'low');
assert.equal(covered.learningCandidate,false);

const poor=learningPriorityFromSimilarity(0.31,{quality:'poor',signaturePresent:true});
assert.equal(poor.status,'excluded-qc');
assert.equal(poor.priority,'reject-qc');
assert.equal(poor.learningCandidate,false);

const missing=learningPriorityFromSimilarity(0,{quality:'good',signaturePresent:false});
assert.equal(missing.status,'unscored');
assert.equal(missing.priority,'review');
assert.equal(missing.learningCandidate,false);

assert.equal(ACADEMIC_HEALTH.learningCollection.policyVersion,'novelty-priority-v1');
assert.equal(ACADEMIC_HEALTH.learningCollection.focus,'novel-cases-first');
assert.equal(ACADEMIC_HEALTH.learningCollection.poorQcExcludedFromLearning,true);
assert.equal(ACADEMIC_HEALTH.learningCollection.autoPromoteToKnowledge,false);

console.log('PRE-RELEASE GATE SMOKE PASS: learning collection prioritizes novel, usable cases and never auto-promotes them into Knowledge.');
