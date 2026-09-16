import assert from 'node:assert/strict';
import {groundTongueMorphology,MORPHOLOGY_POLICY_VERSION,MORPHOLOGY_REFERENCE} from '../morphology-reference.mjs';

const baseAssessment=()=>({
  top:{
    shape:'Khá rộng/bệu',
    toothmarks:'Chưa thấy dấu răng nổi bật',
    otherVisibleFeatures:[],
    visualValidity:{colorReliability:'good'},
    limitations:[]
  },
  combined:{},
  ml:{featureVector:{}}
});

{
  const a=baseAssessment();
  groundTongueMorphology(a,{academicSignature:{aspect:.94,coverage:.22}});
  assert.match(a.top.shape,/Rộng tương đối/);
  assert.doesNotMatch(a.top.shape,/Nghi mập\/bệu/);
  assert.equal(a.ml.featureVector.morphology.classification,'wide-geometry-only');
  assert.equal(a.ml.featureVector.morphology.calibration.absoluteScale,false);
  assert.match(a.ml.featureVector.morphology.trainingRule,/never train puffy\/thin from aspect ratio alone/);
}

{
  const a=baseAssessment();
  a.top.shape='Thể lưỡi gầy mỏng';
  groundTongueMorphology(a,{academicSignature:{aspect:.48,coverage:.12}});
  assert.match(a.top.shape,/Thon\/hẹp tương đối/);
  assert.equal(a.ml.featureVector.morphology.classification,'narrow-geometry-only');
  assert.ok(a.top.limitations.some(x=>/ảnh mặt trên 2D không đo trực tiếp/.test(x)));
}

{
  const a=baseAssessment();
  a.top.shape='Thân lưỡi căng to, dày, chất đầy khoang miệng';
  a.top.toothmarks='Có hằn răng';
  groundTongueMorphology(a,{academicSignature:{aspect:.9,coverage:.28},morphologyCalibration:{mouthReferenceVisible:true}});
  assert.match(a.top.shape,/Nghi mập\/bệu theo tiêu chí tài liệu/);
  assert.equal(a.ml.featureVector.morphology.classification,'puffy-supported');
}

{
  const a=baseAssessment();
  a.top.shape='Trung bình';
  a.top.visualValidity.colorReliability='poor';
  groundTongueMorphology(a,{academicSignature:{aspect:.7,coverage:.2}});
  assert.ok(a.top.limitations.some(x=>/Độ tin cậy màu thấp/.test(x)));
}

assert.equal(MORPHOLOGY_POLICY_VERSION,'tongue-morphology-grounding-v1');
assert.match(MORPHOLOGY_REFERENCE.normal.description,/không quá thon cũng không quá bệu/);
assert.match(MORPHOLOGY_REFERENCE.puffy.description,/căng to và dày/);
assert.match(MORPHOLOGY_REFERENCE.thin.description,/gầy nhỏ và mỏng/);
assert.match(MORPHOLOGY_REFERENCE.sublingual.measurementRule,/chuẩn kích thước/);

console.log('MORPHOLOGY GROUNDING SMOKE PASS: shape labels are grounded in document definitions and uncalibrated 2D geometry cannot become absolute puffy/thin labels.');
