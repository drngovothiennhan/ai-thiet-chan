import assert from 'node:assert/strict';
import { fuse } from '../public/academic-fusion-core.js';

const assessment={
  top:{
    quality:'good',
    confidence:0.72,
    tongueColor:'Đỏ nhạt',
    coatingColor:'Trắng',
    coatingThickness:'Mỏng',
    coatingTexture:'Bình thường',
    moisture:'Nhuận',
    fissures:'Chưa đủ căn cứ đánh giá nứt lưỡi.',
    toothmarks:'Không xác định',
    pricklesSpots:'Không xác định',
    stasisMarks:'Không xác định'
  },
  combined:{confidence:0.72,summary:'Quan sát cục bộ',generalSignals:[]}
};
const reasoning={
  patternCandidates:[{
    label:'Tín hiệu kiểm thử',
    directEvidence:'Dữ kiện cấu trúc',
    academicEvidence:'Đối chiếu học thuật',
    score:0.7
  }],
  cannotConclude:[]
};

const out=fuse(structuredClone(assessment),{},[{id:'x',sourceId:'TC1',page:1,kind:'test',similarity:0.7,hash:'x'}],reasoning,[]);
assert.equal(out.combined.academicFusion.academicReasoning.patternCandidates.length,1);
assert.ok(Array.isArray(out.combined.academicFusion.acceptedPatterns));
console.log('ACADEMIC FUSION LOCAL REASONING PASS: no stale Gemini variable is referenced.');
