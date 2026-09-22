import assert from 'node:assert/strict';
import {evaluateMorphologyReference,MORPHOLOGY_REFERENCE_MODEL,MORPHOLOGY_REFERENCE_MODEL_VERSION} from '../tongue-morphology-reference-model.mjs';
import {MORPHOLOGY_STANDARD_DOCUMENTS,MORPHOLOGY_STANDARD_EVIDENCE,MORPHOLOGY_STANDARD_POLICY} from '../knowledge-morphology-standard-v1.mjs';

function spatial(overrides={}){
  return {
    schemaVersion:'tongue-spatial-observation-v3',
    shapeMetrics:{
      aspect:.70,areaFill:.54,rootWidthRatio:.68,shoulderWidthRatio:.78,midWidthRatio:.78,tipWidthRatio:.58,
      meanWidthRatio:.62,widthStdRatio:.09,tipTaperRatio:.74,rootToMidRatio:.87,contourSmoothness:.06,centerlineDeviation:.03,
      roiWidthRatio:.44,roiHeightRatio:.62,topMargin:.05,bottomMargin:.06,edgeRowCoverage:.76,
      ...overrides.shapeMetrics
    },
    toothmarkMetrics:{
      score:.22,leftScore:.20,rightScore:.18,bilateralScore:.18,leftEvents:0,rightEvents:0,
      edgeColorSupport:{leftScore:.10,rightScore:.09,bilateralScore:.09,leftMeanDarkContrast:.005,rightMeanDarkContrast:.004,leftDarkRowFraction:.05,rightDarkRowFraction:.04},
      ...overrides.toothmarkMetrics
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([k])=>!['shapeMetrics','toothmarkMetrics'].includes(k)))
  };
}

assert.equal(MORPHOLOGY_REFERENCE_MODEL_VERSION,'aitc-morphology-reference-v1');
assert.equal(MORPHOLOGY_REFERENCE_MODEL.productionAuthority,false);
assert.equal(MORPHOLOGY_REFERENCE_MODEL.clinicalGold,false);
assert.equal(MORPHOLOGY_STANDARD_POLICY.productionAuthority,false);
assert.ok(MORPHOLOGY_STANDARD_DOCUMENTS.some(x=>x.pmid==='40025207'));
assert.ok(MORPHOLOGY_STANDARD_DOCUMENTS.some(x=>x.pmid==='35492602'));
assert.ok(MORPHOLOGY_STANDARD_EVIDENCE.some(x=>/tỷ lệ rộng-dài đơn độc/.test(x.text)));
assert.ok(MORPHOLOGY_STANDARD_EVIDENCE.some(x=>/thay đổi màu tối hơn/.test(x.text)));

const broad=evaluateMorphologyReference({
  spatial:spatial({shapeMetrics:{aspect:.79,areaFill:.63,rootWidthRatio:.79,midWidthRatio:.87,meanWidthRatio:.75}}),
  qc:{grade:'good'},current:{shape:'bản rộng/mập vừa (hình chiếu 2D)',toothmarks:'Không thấy dấu răng rõ'}
});
assert.equal(broad.active,true);
assert.equal(broad.shape.class,'broad');
assert.equal(broad.physicalSize.enlargedConfirmed,false,'2D broad shape must not become absolute enlarged tongue');
assert.equal(broad.comparison.shapeAgreement,'aligned');

const aspectOnly=evaluateMorphologyReference({
  spatial:spatial({shapeMetrics:{aspect:.80,areaFill:.42,rootWidthRatio:.54,midWidthRatio:.67,meanWidthRatio:.50}}),
  qc:{grade:'good'},current:{shape:'rộng',toothmarks:'Không xác định'}
});
assert.notEqual(aspectOnly.shape.class,'broad','aspect ratio alone must never force broad/puffy reference class');

const narrow=evaluateMorphologyReference({
  spatial:spatial({shapeMetrics:{aspect:.49,areaFill:.39,rootWidthRatio:.46,midWidthRatio:.58,meanWidthRatio:.43}}),
  qc:{grade:'good'},current:{shape:'hẹp/gầy theo hình chiếu 2D',toothmarks:'Không xác định'}
});
assert.equal(narrow.shape.class,'narrow');
assert.equal(narrow.physicalSize.thinConfirmed,false,'2D narrow shape must not become absolute thin tongue');

const tooth=evaluateMorphologyReference({
  spatial:spatial({toothmarkMetrics:{
    score:.76,leftScore:.73,rightScore:.69,bilateralScore:.69,leftEvents:3,rightEvents:4,
    edgeColorSupport:{leftScore:.36,rightScore:.31,bilateralScore:.31,leftMeanDarkContrast:.024,rightMeanDarkContrast:.021,leftDarkRowFraction:.42,rightDarkRowFraction:.37}
  }}),
  qc:{grade:'good'},current:{shape:'trung bình',toothmarks:'Có tín hiệu dấu răng'}
});
assert.equal(tooth.toothmarks.class,'present');
assert.equal(tooth.comparison.toothmarkAgreement,'aligned');

const uploadedFalseNegative=evaluateMorphologyReference({
  spatial:spatial({
    shapeMetrics:{
      aspect:1.045,areaFill:.649,rootWidthRatio:.913,shoulderWidthRatio:.913,midWidthRatio:.855,tipWidthRatio:.565,
      meanWidthRatio:.722,widthStdRatio:.236,tipTaperRatio:.661,rootToMidRatio:1.068,contourSmoothness:.044,centerlineDeviation:.022,
      roiWidthRatio:.333,roiHeightRatio:.147,topMargin:.400,bottomMargin:.453,edgeRowCoverage:.985
    },
    toothmarkMetrics:{
      score:.828,leftScore:.851,rightScore:.816,bilateralScore:.816,leftEvents:2,rightEvents:2,leftMaxDepthRatio:.055,rightMaxDepthRatio:.043,
      edgeColorSupport:{leftScore:1,rightScore:1,bilateralScore:1,leftMeanDarkContrast:.047,rightMeanDarkContrast:.048,leftDarkRowFraction:.572,rightDarkRowFraction:.524}
    },
    morphologyRoi:{
      method:'dark-oral-aperture-anchor-plus-adaptive-blue-green-separation-v1',
      mouthWidthRatio:.295,tongueWidthRatio:.333,tongueHeightRatio:.147,
      skinBlueGreenRatio:.851,coreBlueGreenRatio:.976,blueGreenThreshold:.929,
      sourceResolution:{width:207,height:448}
    }
  }),
  qc:{grade:'good'},current:{shape:'rộng/mập tương đối theo ảnh 2D',toothmarks:'Không thấy dấu răng rõ'}
});
assert.equal(uploadedFalseNegative.toothmarks.class,'present','uploaded false-negative derived fixture must be positive in reference model');
assert.equal(uploadedFalseNegative.comparison.toothmarkAgreement,'conflict','reference model must surface conflict with the previous negative app result');
assert.equal(uploadedFalseNegative.shape.visibility.anchored,true,'mouth-anchored high-resolution ROI must be accepted even when tongue occupies a small fraction of a full-face image');

const colorOnly=evaluateMorphologyReference({
  spatial:spatial({toothmarkMetrics:{
    score:.20,leftScore:.18,rightScore:.16,bilateralScore:.16,leftEvents:0,rightEvents:0,
    edgeColorSupport:{leftScore:.72,rightScore:.68,bilateralScore:.68,leftMeanDarkContrast:.05,rightMeanDarkContrast:.047,leftDarkRowFraction:.72,rightDarkRowFraction:.68}
  }}),
  qc:{grade:'good'},current:{shape:'trung bình',toothmarks:'Không xác định'}
});
assert.notEqual(colorOnly.toothmarks.class,'present','edge darkening without contour indentation must not be called tooth marks');

const occluded=evaluateMorphologyReference({
  spatial:spatial({shapeMetrics:{edgeRowCoverage:.43,topMargin:0,bottomMargin:0},toothmarkMetrics:{score:.80,bilateralScore:.70,leftEvents:4,rightEvents:4}}),
  qc:{grade:'good'},current:{shape:'rộng',toothmarks:'Có tín hiệu dấu răng'}
});
assert.equal(occluded.shape.class,'unknown');
assert.notEqual(occluded.toothmarks.class,'present','inadequate lateral-edge visibility must fail closed');

const poor=evaluateMorphologyReference({spatial:spatial(),qc:{grade:'poor'},current:{}});
assert.equal(poor.active,false);

console.log('MORPHOLOGY REFERENCE MODEL PASS: independent size/shape/toothmark reference is multi-feature, QC-gated, color-assisted but contour-primary, and cannot claim absolute size from unscaled 2D.');
