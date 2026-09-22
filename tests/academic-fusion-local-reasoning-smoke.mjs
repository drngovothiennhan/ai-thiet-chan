import assert from 'node:assert/strict';
import { directPatterns, fuse } from '../public/academic-fusion-core.js';

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


const screenshotLikeAssessment={
  top:{
    tongueColor:'đỏ nhạt',
    shape:'Không xác định',
    coatingColor:'trắng',
    coatingThickness:'mỏng',
    coatingTexture:'Không xác định',
    moisture:'khô ướt vừa phải',
    fissures:'Chưa đủ căn cứ đánh giá nứt lưỡi.',
    toothmarks:'Không xác định',
    pricklesSpots:'Không thấy tín hiệu điểm đỏ/gai nổi bật',
    stasisMarks:'Không xác định'
  }
};
const screenshotPatterns=directPatterns(screenshotLikeAssessment);
const nearNormal=screenshotPatterns.find(x=>/gần bình thường/.test(x.label));
assert.ok(nearNormal,'light-red + thin white coating must surface the near-normal tongue pattern');
assert.ok(nearNormal.score>=.80,'balanced moisture should strengthen the near-normal pattern above the 80% review band');
assert.ok(screenshotPatterns.some(x=>/biểu \/ hàn nhẹ/.test(x.label)),'thin white coating may remain a weak differential signal');
assert.equal(screenshotPatterns.some(x=>/hư hàn/.test(x.label)),false,'đỏ nhạt must not be misread as pallor/hư hàn');
assert.equal(screenshotPatterns.some(x=>/ứ trệ/.test(x.label)),false);
assert.equal(screenshotPatterns.some(x=>/âm dịch hao tổn/.test(x.label)),false);

const truePallorAssessment={
  top:{
    tongueColor:'trắng nhợt',
    shape:'mập bệu',
    coatingColor:'trắng',
    coatingThickness:'mỏng',
    coatingTexture:'bình thường',
    moisture:'nhuận',
    fissures:'Chưa đủ căn cứ',
    toothmarks:'Có hằn răng',
    pricklesSpots:'Không xác định',
    stasisMarks:'Không xác định'
  }
};
const pallorPatterns=directPatterns(truePallorAssessment);
const deficiency=pallorPatterns.find(x=>x.label==='Tín hiệu hư hàn');
assert.ok(deficiency,'true pallor + white coating must retain the deficiency-cold differential');
assert.ok(deficiency.score>=.70,'supporting moist/toothmark/puffy features should cross the 70% warning band');

const positiveMorphologyAssessment={
  top:{
    tongueColor:'đỏ',
    coatingColor:'vàng',
    coatingThickness:'mỏng',
    coatingTexture:'bình thường',
    moisture:'khô',
    fissures:'Có nứt lưỡi đã được tầng thị giác xác nhận.',
    toothmarks:'Không xác định',
    pricklesSpots:'Không xác định',
    stasisMarks:'Không xác định'
  }
};
const positivePatterns=directPatterns(positiveMorphologyAssessment).map(x=>x.label);
assert.ok(positivePatterns.includes('Tín hiệu nhiệt / thực nhiệt'));
assert.ok(positivePatterns.includes('Tín hiệu âm dịch hao tổn / nhiệt thương tân'));

const darkVentralAssessment={top:{tongueColor:'đỏ nhạt',shape:'rộng tương đối',coatingColor:'nghi xám/đen',coatingThickness:'dày',coatingTexture:'nghi nhờn/trơn',moisture:'nhuận',fissures:'Chưa đủ căn cứ',toothmarks:'Không xác định',pricklesSpots:'Không xác định',stasisMarks:'Không xác định'},bottom:{undersideColor:'hồng/đỏ nhạt',vessels:{visible:true,color:'Tím/xanh tím',dilation:'Chưa đánh giá định lượng vì ảnh không có chuẩn kích thước tuyệt đối'}}};
const darkPatterns=directPatterns(darkVentralAssessment);
assert.ok(darkPatterns.some(x=>/xám\/đen nhuận/.test(x.label)));
assert.ok(darkPatterns.some(x=>/thấp trọc|đàm/.test(x.label)));
assert.ok(darkPatterns.some(x=>/mạch dưới lưỡi tím/.test(x.label)));
const out=fuse(structuredClone(assessment),{},[{id:'x',sourceId:'TC1',page:1,kind:'test',similarity:0.7,hash:'x'}],reasoning,[]);
assert.equal(out.combined.academicFusion.academicReasoning.patternCandidates.length,1);
assert.ok(Array.isArray(out.combined.academicFusion.acceptedPatterns));
console.log('ACADEMIC FUSION LOCAL REASONING PASS: structured positive evidence prevents negation/unknown substring false positives and no stale Gemini variable is referenced.');