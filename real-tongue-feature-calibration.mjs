export const REAL_TONGUE_FEATURE_CALIBRATION_VERSION='rtb20260922-feature-rule-calibration-v2-multiscale-toothmark';

const UNKNOWN='Không xác định';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const unit=v=>clamp(v,0,1);
const q=(v,n=3)=>Number(Number(v||0).toFixed(n));
const grade=qc=>['good','fair','poor'].includes(qc?.grade)?qc.grade:'poor';
const validLabel=(v)=>String(v||'').trim();

function colorNormalizationReady(spatial,qc){
  const c=spatial?.colorNormalization||{};
  return grade(qc)!=='poor'&&c.applied===true&&Number(c.neutralPixels)>=64&&c.bounded===true;
}
function moistureFlashRisk(spatial){
  const m=spatial?.moisture||{},surface=m?.surface||{},qc=m?.qc||{};
  const over=unit(qc.overexposedRatio??surface.overexposedRatio);
  const largest=unit(qc.largestGlossComponentRatio??surface.largestGlossComponentRatio);
  const distributed=unit(surface.distributedGlossRatio);
  return clamp(over*3.2+Math.max(0,largest-.72)*1.7+Math.max(0,.22-distributed)*.9);
}
function labelObj(label,confidence,reason){
  return Object.freeze({label:label||UNKNOWN,confidence:confidence==null?null:q(confidence),reason});
}

export function calibrateRealTongueFeatures({signature={},spatial={},qc={},base={}}={}){
  const quality=grade(qc);
  const valid=spatial&&typeof spatial==='object'&&['tongue-spatial-observation-v2','tongue-spatial-observation-v3'].includes(spatial.schemaVersion);
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:REAL_TONGUE_FEATURE_CALIBRATION_VERSION,
      active:false,
      reason:valid?'qc-poor':'spatial-unavailable',
      sourceDataset:'RTB20260922',
      clinicalGold:false,
      productionRuleCalibration:true
    });
  }

  const qcBase=quality==='good'?.90:.70;
  const normReady=colorNormalizationReady(spatial,qc);
  const purple=unit(signature?.purple),spot=unit(signature?.spot);
  const bodySat=unit(spatial?.bodySaturation),bodyLuma=unit(spatial?.bodyLuma);
  const coat=unit(spatial?.coatingCandidateRatio),strict=unit(spatial?.strictCoatingCandidateRatio);
  const white=unit(spatial?.coatingWhiteLikeRatio),yellow=unit(spatial?.coatingYellowLikeRatio);
  const zones=spatial?.coatingZones||{};
  const central=unit(zones.central),middle=unit(zones.middle),posterior=unit(zones.posterior),anterior=unit(zones.anterior);
  const shape=spatial?.shapeMetrics||{},tm=spatial?.toothmarkMetrics||{};
  const aspect=Number(shape.aspect)||0,areaFill=unit(shape.areaFill),mid=unit(shape.midWidthRatio),edgeCoverage=unit(shape.edgeRowCoverage);
  const tScore=unit(tm.score),bilateral=unit(tm.bilateralScore);
  const leftEvents=Math.max(0,Number(tm.leftEvents)||0),rightEvents=Math.max(0,Number(tm.rightEvents)||0);
  const totalEvents=leftEvents+rightEvents,maxSideEvents=Math.max(leftEvents,rightEvents),minSideEvents=Math.min(leftEvents,rightEvents);
  const toothColor=tm.edgeColorSupport&&typeof tm.edgeColorSupport==='object'?tm.edgeColorSupport:{};
  const toothColorBilateral=unit(toothColor.bilateralScore),toothColorLeft=unit(toothColor.leftScore),toothColorRight=unit(toothColor.rightScore);
  const flashRisk=moistureFlashRisk(spatial);
  const coatMoist=spatial?.moisture?.coating||{};
  const coatGloss=unit(coatMoist.glossRatio),coatStrictGloss=unit(coatMoist.strictGlossRatio);
  const coatDistributed=unit(coatMoist.distributedGlossRatio),coatLargest=unit(coatMoist.largestGlossComponentRatio);
  const coatRough=unit(coatMoist.roughness);

  let bodyLabel=validLabel(base?.bodyColor)||validLabel(spatial.bodyColorCandidate)||UNKNOWN;
  let bodyConfidence=null,bodyReason='base-observation';
  const purpleGate=quality==='good'?.17:.22;
  if(normReady&&purple>=purpleGate&&bodySat>=.20){
    bodyLabel='tím/xanh tím';
    bodyConfidence=qcBase*clamp(.66+(purple-purpleGate)*1.6);
    bodyReason='rtb-purple-qc-gated';
  }else if(normReady&&spatial.bodyColorCandidate==='nhợt'&&bodyLuma>=.58&&bodySat<=.22){
    bodyLabel='nhợt';
    bodyConfidence=qcBase*.82;
    bodyReason='normalized-pale-gate';
  }else if(normReady&&spatial.bodyColorCandidate==='đỏ'&&bodySat>=(quality==='good'?.43:.47)){
    bodyLabel='đỏ';
    bodyConfidence=qcBase*.84;
    bodyReason='normalized-red-gate';
  }else if(spatial.bodyColorCandidate==='đỏ nhạt'){
    bodyLabel='đỏ nhạt';
    bodyConfidence=qcBase*(normReady?.78:.62);
    bodyReason=normReady?'normalized-light-red':'light-red-with-limited-color-reference';
  }

  let coatColor=validLabel(base?.coatingColor)||validLabel(spatial.coatingColorCandidate)||UNKNOWN;
  let coatColorConfidence=null,coatColorReason='base-observation';
  if(coat<.055&&strict<.025&&quality==='good'){
    coatColor='ít/không rêu rõ';
    coatColorConfidence=.74;
    coatColorReason='low-coating-coverage-gate';
  }else if(coat>=.09&&yellow>=.30&&yellow>white*1.28){
    coatColor='vàng';
    coatColorConfidence=qcBase*clamp(.70+(yellow-.30)*.55);
    coatColorReason='yellow-dominance-gate';
  }else if(coat>=.075&&white>=.14&&yellow<.24){
    coatColor='trắng';
    coatColorConfidence=qcBase*clamp(.68+(white-.14)*.35);
    coatColorReason='white-coating-gate';
  }

  let coatThickness=validLabel(base?.coatingThickness)||validLabel(spatial.coatingThicknessCandidate)||UNKNOWN;
  let coatThicknessConfidence=null,coatThicknessReason='base-observation';
  if(coat<.055&&strict<.025&&quality==='good'){
    coatThickness='rất mỏng/ít rêu';
    coatThicknessConfidence=.76;
    coatThicknessReason='low-coating-coverage-gate';
  }else if(coat>=.42&&strict>=.18){
    coatThickness='dày';
    coatThicknessConfidence=qcBase*clamp(.72+(coat-.42)*.45);
    coatThicknessReason='thick-coating-dual-coverage-gate';
  }else if(coat>=.10){
    coatThickness='mỏng';
    coatThicknessConfidence=qcBase*.74;
    coatThicknessReason='thin-coating-coverage-gate';
  }

  let shapeLabel=validLabel(base?.shape)||UNKNOWN;
  let shapeConfidence=null,shapeReason='base-observation';
  if(aspect>=.72&&mid>=.80&&areaFill>=.56){
    shapeLabel='rộng/mập tương đối theo ảnh 2D';
    shapeConfidence=qcBase*clamp(.67+(aspect-.72)*.45+(mid-.80)*.35);
    shapeReason='rtb-broad-2d-conservative';
  }else if(aspect>0&&aspect<=.54&&mid>0&&mid<=.66){
    shapeLabel='hẹp/gầy tương đối theo ảnh 2D';
    shapeConfidence=qcBase*clamp(.67+(.54-aspect)*.55+(.66-mid)*.35);
    shapeReason='rtb-thin-2d-conservative';
  }

  let toothLabel=validLabel(base?.toothmarks)||UNKNOWN;
  let toothConfidence=null,toothReason='base-observation';
  const repeatedContour=maxSideEvents>=2;
  const oppositeSupport=minSideEvents>=1||toothColorBilateral>=.45;
  const strongToothmark=edgeCoverage>=.60&&tScore>=.60&&repeatedContour&&oppositeSupport;
  const moderateToothmark=edgeCoverage>=.58&&tScore>=.44&&totalEvents>=2&&(bilateral>=.24||toothColorBilateral>=.30);
  if(strongToothmark){
    toothLabel='Có tín hiệu dấu răng';
    toothConfidence=qcBase*clamp(.72+(tScore-.60)*.45+Math.min(.10,totalEvents*.012)+toothColorBilateral*.06);
    toothReason='multiscale-repeated-concavity-with-bilateral-or-color-support';
  }else if(moderateToothmark){
    toothLabel='Nghi dấu răng nhẹ';
    toothConfidence=qcBase*clamp(.60+tScore*.12+toothColorBilateral*.06);
    toothReason='multiscale-concavity-suspicion-gate';
  }else if(edgeCoverage>=.68&&tScore<.24&&totalEvents===0&&toothColorBilateral<.18){
    toothLabel='Không thấy dấu răng rõ';
    toothConfidence=qcBase*.68;
    toothReason='adequate-edge-negative-gate';
  }

  let textureLabel=validLabel(base?.coatingTexture)||UNKNOWN;
  let textureConfidence=null,textureReason='base-observation';
  const greasyCandidate=coat>=.12&&coatGloss>=.022&&coatStrictGloss<=.035&&coatDistributed>=.55&&coatLargest<=.58&&coatRough<=.055&&flashRisk<.45;
  if(greasyCandidate){
    textureLabel='nghi nhờn/trơn';
    textureConfidence=qcBase*clamp(.67+(coatGloss-.022)*2.2+(coatDistributed-.55)*.22);
    textureReason='distributed-gloss-plus-low-roughness-flash-gated';
  }else if(coat>=.10&&coatRough>=.078){
    textureLabel='thô/không đều';
    textureConfidence=qcBase*.69;
    textureReason='coating-roughness-gate';
  }else if(coat>=.10&&coatRough>0&&coatRough<=.050){
    textureLabel='khá đều';
    textureConfidence=qcBase*.68;
    textureReason='low-roughness-gate';
  }

  const spotGate=quality==='good'?.065:.080;
  const spotLabel=spot>=spotGate?'Có tín hiệu điểm đỏ/gai':'Không thấy tín hiệu điểm đỏ/gai nổi bật';
  const spotConfidence=qcBase*(spot>=spotGate?clamp(.64+(spot-spotGate)*1.8):.62);

  const zoneValues=[central,middle,posterior,anterior];
  const zoneSpread=Math.max(...zoneValues)-Math.min(...zoneValues);
  const patchyCandidate=quality==='good'&&coat>=.07&&coat<=.52&&String(spatial.coatingDistributionCandidate||'')==='không rõ'&&zoneSpread>=.38;
  const lowCoatingCandidate=quality==='good'&&coat<.055&&strict<.025;

  const medianSulcus=spatial?.medianSulcus||{};
  const fissureGuard=medianSulcus.visibleSignal===true
    ?'median-sulcus-visible-do-not-promote-to-fissure'
    :'no-dedicated-fissure-geometry-do-not-promote-dark-pixel-signal';

  return Object.freeze({
    version:REAL_TONGUE_FEATURE_CALIBRATION_VERSION,
    active:true,
    sourceDataset:'RTB20260922',
    sourceRole:'real-image-derived operational calibration; not clinical gold',
    clinicalGold:false,
    productionRuleCalibration:true,
    bodyColor:labelObj(bodyLabel,bodyConfidence,bodyReason),
    coatingColor:labelObj(coatColor,coatColorConfidence,coatColorReason),
    coatingThickness:labelObj(coatThickness,coatThicknessConfidence,coatThicknessReason),
    coatingTexture:labelObj(textureLabel,textureConfidence,textureReason),
    shape:labelObj(shapeLabel,shapeConfidence,shapeReason),
    toothmarks:labelObj(toothLabel,toothConfidence,toothReason),
    pricklesSpots:labelObj(spotLabel,spotConfidence,'red-spot-ratio-qc-gate'),
    candidates:Object.freeze({
      greasy:greasyCandidate,
      patchyOrPeeling:patchyCandidate,
      lowCoating:lowCoatingCandidate,
      purple:normReady&&purple>=purpleGate&&bodySat>=.20
    }),
    metrics:Object.freeze({
      purple:q(purple),spot:q(spot),bodySaturation:q(bodySat),bodyLuma:q(bodyLuma),
      coatingCoverage:q(coat),strictCoatingCoverage:q(strict),whiteLike:q(white),yellowLike:q(yellow),
      coatingGloss:q(coatGloss),coatingStrictGloss:q(coatStrictGloss),coatingDistributedGloss:q(coatDistributed),
      coatingLargestGlossComponent:q(coatLargest),coatingRoughness:q(coatRough),flashRisk:q(flashRisk),
      toothmarkScore:q(tScore),toothmarkBilateral:q(bilateral),toothmarkEvents:totalEvents,toothmarkMaxSideEvents:maxSideEvents,toothmarkMinSideEvents:minSideEvents,toothmarkColorBilateral:q(toothColorBilateral),toothmarkColorLeft:q(toothColorLeft),toothmarkColorRight:q(toothColorRight),
      coatingZoneSpread:q(zoneSpread)
    }),
    fissureGuard,
    unsupportedUntilDedicatedExtractor:Object.freeze(['rêu đen','bong tróc xác định','lồi/lõm phân khu tạng phủ']),
    policy:Object.freeze({
      noDiseaseInference:true,
      noSyndromeInference:true,
      noBlackCoatingFromGenericDarkPixels:true,
      noFissureFromMedianSulcus:true,
      noMoistureFromFlash:true,
      noPuffyOrThinFromAspectAlone:true
    })
  });
}
