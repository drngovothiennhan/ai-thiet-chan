import assert from 'node:assert/strict';
import {buildVisualMentorEvidence,holdoutManifestDigest} from '../ml/evaluation/build_visual_mentor_evidence.mjs';

const hash=n=>String(n).padStart(64,'a').slice(-64);
const manifest={
  schemaVersion:'aitc-visual-mentor-holdout-v1',
  locked:true,labelBlind:true,candidateBlind:true,policyVersion:'aitc-visual-mentor-holdout-policy-v1',
  members:Array.from({length:50},(_,i)=>({sampleId:'s'+i,imageSha256:hash(i+1),groupHash:hash(i+101),role:i%5===0?'ventral':'dorsal',qcGrade:'good'}))
};
const labels={
  bodyColor:'đỏ nhạt',coatingColor:'trắng',coatingThickness:'mỏng',coatingDistribution:'trung tâm–sau',
  medianSulcus:'visible-signal',fissure:'absent',moistureSurface:'balanced',moistureBody:'balanced',moistureCoating:'balanced',ventralBilateralStructure:true
};
const mentor=manifest.members.map(m=>({schemaVersion:'aitc-visual-mentor-label-v1',sampleId:m.sampleId,imageSha256:m.imageSha256,blindToCandidate:true,modelOutputVisible:false,locked:true,labels:{...labels}}));
const candidate=manifest.members.map(m=>({schemaVersion:'aitc-visual-candidate-observation-v1',sampleId:m.sampleId,imageSha256:m.imageSha256,candidateVersion:'moisture-vision-r1',labels:{...labels}}));
const built=buildVisualMentorEvidence(manifest,mentor,candidate);
assert.equal(built.rows.length,50);
assert.match(built.holdoutManifestSha256,/^[0-9a-f]{64}$/);
assert.equal(built.holdoutManifestSha256,holdoutManifestDigest(manifest));
assert.ok(built.rows.every(r=>r.holdoutManifestSha256===built.holdoutManifestSha256&&r.mentorBlindToCandidate===true));

assert.throws(()=>buildVisualMentorEvidence(manifest,mentor.map((x,i)=>i===0?{...x,blindToCandidate:false}:x),candidate),/MENTOR_MUST_BE_CANDIDATE_BLIND/);
assert.throws(()=>buildVisualMentorEvidence(manifest,mentor,candidate.map((x,i)=>i===0?{...x,imageSha256:hash(999)}:x)),/IMAGE_SHA_MISMATCH/);
assert.throws(()=>buildVisualMentorEvidence(manifest,mentor,candidate.map((x,i)=>i===0?{...x,candidateVersion:'other'}:x)),/MIXED_CANDIDATE_VERSIONS/);

console.log('VISUAL MENTOR EVIDENCE INTEGRITY PASS: locked holdout membership, image digests, mentor blinding and one candidate version are enforced before agreement scoring.');
