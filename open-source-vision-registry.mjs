export const OPEN_SOURCE_VISION_POLICY=Object.freeze({
  policyVersion:'aitc-open-source-vision-registry-v1',
  preferredLicenses:Object.freeze(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause']),
  copyleftRule:'AGPL/GPL code or weights are not copied into the production path unless a separate compatibility review explicitly approves it.',
  weightRule:'Repository code license is not assumed to cover externally hosted pretrained weights; each weight artifact must have its own verified provenance/license before adoption.',
  attributionRule:'Retain upstream copyright/license notices for copied or modified permitted components.'
});

export const OPEN_SOURCE_VISION_REGISTRY=Object.freeze([
  Object.freeze({
    name:'TongueSAM',
    repo:'https://github.com/cshan-github/TongueSAM',
    license:'MIT',
    copyright:'Copyright (c) 2023 Shan Cao',
    use:'segmentation-architecture-and-training-reference',
    adoption:'clean-room/reference-first',
    weightPolicy:'do-not-import-until-weight-license-and-dataset-provenance-are-verified'
  }),
  Object.freeze({
    name:'SelectorNet',
    repo:'https://github.com/cshan-github/SelectorNet',
    license:'MIT',
    copyright:'Copyright (c) 2023 ShanCao',
    use:'tongue-body/coating feature-engineering reference',
    adoption:'clean-room/reference-first',
    weightPolicy:'do-not-import-until-weight-license-and-training-data-provenance-are-verified'
  }),
  Object.freeze({
    name:'Tongue-Segmentation-and-classification',
    repo:'https://github.com/zin-Fu/Tongue-Segmentation-and-classification',
    license:'MIT',
    copyright:'Copyright (c) 2024 zin-Fu',
    use:'SAM+ViT segmentation/classification workflow reference',
    adoption:'reference-first',
    weightPolicy:'externally hosted weights are not adopted without separate license/provenance verification'
  }),
  Object.freeze({
    name:'Segment Anything',
    repo:'https://github.com/facebookresearch/segment-anything',
    license:'Apache-2.0',
    copyright:'Meta AI Research',
    use:'segmentation architecture/runtime reference',
    adoption:'permitted-with-license-notice'
  }),
  Object.freeze({
    name:'ONNX Runtime',
    repo:'https://github.com/microsoft/onnxruntime',
    license:'MIT',
    copyright:'Microsoft Corporation',
    use:'portable inference runtime reference',
    adoption:'permitted-with-license-notice'
  }),
  Object.freeze({
    name:'OpenCV',
    repo:'https://github.com/opencv/opencv',
    license:'Apache-2.0',
    copyright:'OpenCV contributors',
    use:'image QC, color, morphology and preprocessing reference',
    adoption:'permitted-with-license-notice'
  }),
  Object.freeze({
    name:'TensorFlow.js',
    repo:'https://github.com/tensorflow/tfjs',
    license:'Apache-2.0',
    copyright:'TensorFlow contributors',
    use:'browser inference/training reference',
    adoption:'permitted-with-license-notice'
  }),
  Object.freeze({
    name:'TongueDiagnosis.AI',
    repo:'https://github.com/TonguePicture-SKaRD/TongueDiagnosis',
    license:'AGPL-3.0',
    copyright:'Upstream contributors',
    use:'architecture-reference-only',
    adoption:'no-code-or-weight-copy-into-production'
  })
]);
