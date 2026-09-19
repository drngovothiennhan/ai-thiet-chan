export const SURFACE_PHENOTYPE_POLICY_VERSION='tongue-surface-phenotype-policy-v1';

const UNKNOWN='Không xác định';
function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function finite(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function confidence(base,signal){return Number(Math.min(.82,Math.max(0,base)*(.55+.45*Math.max(0,Math.min(1,signal)))).toFixed(3));}

export function interpretSurfacePhenotype(features={},qc={}){
  const quality=String(qc?.grade||'poor');
  const valid=features&&typeof features==='object'&&features.schemaVersion==='tongue-surface-phenotype-features-v1';
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:SURFACE_PHENOTYPE_POLICY_VERSION,
      active:false,
      productionEligible:false,
      calibrated:false,
      toothmarks:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'features-missing'}),
      shape:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'features-missing'}),
      coatingTexture:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'features-missing'}),
      rule:'QC kém hoặc thiếu feature chuyên biệt thì giữ Không xác định.'
    });
  }

  const base=quality==='good'?.92:.70;
  const t=features.toothmarks&&typeof features.toothmarks==='object'?features.toothmarks:{};
  const s=features.shape&&typeof features.shape==='object'?features.shape:{};
  const c=features.coatingTexture&&typeof features.coatingTexture==='object'?features.coatingTexture:{};

  const edgeSupport=unit(finite(t.edgeSampleRows)/48);
  const maxDepth=unit(finite(t.maxNotchDepthRatio)/.06);
  const notchCount=Math.max(0,Math.min(8,Math.round(finite(t.totalNotches))));
  const bilateral=Boolean(t.bilateralSignal);
  const toothSignal=unit(maxDepth*.48+unit(notchCount/4)*.34+(bilateral ? .18 : 0))*edgeSupport;
  const toothVisible=edgeSupport>=.55&&notchCount>=2&&finite(t.maxNotchDepthRatio)>=.022&&toothSignal>=.58;
  const toothmarks=Object.freeze({
    status:toothVisible?'possible':'unknown',
    label:toothVisible?'có tín hiệu hằn/dấu răng ở bờ lưỡi':UNKNOWN,
    confidence:toothVisible?confidence(base,toothSignal):null,
    reason:toothVisible?'repeated-lateral-contour-concavities':'edge-concavity-signal-below-gate',
    metrics:Object.freeze({
      leftNotches:Math.max(0,Math.round(finite(t.leftNotches))),
      rightNotches:Math.max(0,Math.round(finite(t.rightNotches))),
      maxNotchDepthRatio:unit(t.maxNotchDepthRatio),
      bilateralSignal:bilateral,
      edgeSampleRows:Math.max(0,Math.round(finite(t.edgeSampleRows)))
    }),
    rule:'Dấu răng được xem là tín hiệu lõm lặp lại ở bờ lưỡi; không suy thể bệnh từ dấu này đơn độc.'
  });

  const aspect=finite(s.boxAspect);
  const midWidthToHeight=finite(s.midWidthToHeight);
  const fill=unit(s.boxFillRatio);
  const broadSignal=unit(
    unit((aspect-.94)/.28)*.46+
    unit((midWidthToHeight-.68)/.30)*.34+
    unit((fill-.48)/.30)*.20
  );
  const slenderSignal=unit(
    unit((.92-aspect)/.24)*.50+
    unit((.68-midWidthToHeight)/.24)*.34+
    unit((.58-fill)/.24)*.16
  );
  let shapeStatus='unknown',shapeLabel=UNKNOWN,shapeSignal=0,shapeReason='geometry-not-extreme-enough';
  if(finite(s.profileRows)>=24&&broadSignal>=.70&&broadSignal-slenderSignal>=.22){
    shapeStatus='broad-full';shapeLabel='hình thể rộng/đầy, gợi dạng mập-bệu';shapeSignal=broadSignal;shapeReason='relative-width-and-silhouette-fullness';
  }else if(finite(s.profileRows)>=24&&slenderSignal>=.70&&slenderSignal-broadSignal>=.22){
    shapeStatus='slender';shapeLabel='hình thể hẹp/gầy';shapeSignal=slenderSignal;shapeReason='relative-narrow-silhouette';
  }else if(finite(s.profileRows)>=24&&Math.max(broadSignal,slenderSignal)<.58){
    shapeStatus='intermediate';shapeLabel='hình thể trung gian';shapeSignal=1-Math.max(broadSignal,slenderSignal);shapeReason='no-strong-broad-or-slender-signal';
  }
  const shape=Object.freeze({
    status:shapeStatus,label:shapeLabel,
    confidence:shapeStatus==='unknown'?null:confidence(base,shapeSignal),
    reason:shapeReason,
    metrics:Object.freeze({
      boxAspect:Number(aspect.toFixed(4)),
      midWidthToHeight:Number(midWidthToHeight.toFixed(4)),
      boxFillRatio:Number(fill.toFixed(4)),
      profileRows:Math.max(0,Math.round(finite(s.profileRows)))
    }),
    rule:'Đây là hình thể 2D tương đối. “Mập-bệu” chỉ mô tả rộng/đầy nhìn thấy; độ mềm/non không thể suy từ ảnh tĩnh.'
  });

  const coatSupport=unit(finite(c.sampledPixels)/700);
  const coatCoverage=unit(c.coatingCandidateRatio);
  const rough=unit(c.meanMicrotexture);
  const highFreq=unit(c.highFrequencyRatio);
  const coarse=unit(c.coarseGranuleRatio);
  const fine=unit(c.fineGranuleRatio);
  const patch=unit(c.patchiness);
  const centerBias=unit((finite(c.centerMinusEdgeCoverage)+.05)/.35);
  let textureStatus='unknown',textureLabel=UNKNOWN,textureSignal=0,textureReason='texture-signal-below-gate';

  const smoothSignal=unit((.035-rough)/.025)*coatSupport;
  const roughSignal=unit((rough-.028)/.055*.55+highFreq*.30+coarse*.15)*coatSupport;
  const fineDenseSignal=unit(fine*.45+highFreq*.20+centerBias*.20+unit(coatCoverage/.32)*.15)*coatSupport;
  const patchSignal=unit(patch*.62+unit((.20-coatCoverage)/.20)*.18+highFreq*.20)*coatSupport;
  const coarseUnevenSignal=unit(coarse*.55+roughSignal*.30+patch*.15)*coatSupport;

  const candidates=[
    ['patchy','bong/tróc dạng mảng',patchSignal,'discontinuous-coating-patches'],
    ['coarse-uneven','thô/hạt không đều, gợi dạng vữa-hủ',coarseUnevenSignal,'coarse-uneven-granularity'],
    ['fine-dense','hạt mịn dày/đan xen, gợi dạng nhầy-nhớt',fineDenseSignal,'fine-dense-granularity-with-central-bias'],
    ['rough','thô/không đều',roughSignal,'high-local-texture-variation'],
    ['smooth','mịn/trơn tương đối',smoothSignal,'low-local-texture-variation']
  ].sort((a,b)=>b[2]-a[2]);
  const best=candidates[0];
  if(coatSupport>=.45&&coatCoverage>=.06&&best[2]>=.64){
    textureStatus=best[0];textureLabel=best[1];textureSignal=best[2];textureReason=best[3];
  }

  const coatingTexture=Object.freeze({
    status:textureStatus,label:textureLabel,
    confidence:textureStatus==='unknown'?null:confidence(base*.90,textureSignal),
    reason:textureReason,
    metrics:Object.freeze({
      coatingCandidateRatio:Number(coatCoverage.toFixed(4)),
      meanMicrotexture:Number(rough.toFixed(4)),
      highFrequencyRatio:Number(highFreq.toFixed(4)),
      fineGranuleRatio:Number(fine.toFixed(4)),
      coarseGranuleRatio:Number(coarse.toFixed(4)),
      patchiness:Number(patch.toFixed(4)),
      centerMinusEdgeCoverage:Number(finite(c.centerMinusEdgeCoverage).toFixed(4)),
      sampledPixels:Math.max(0,Math.round(finite(c.sampledPixels)))
    }),
    rule:'Ảnh tĩnh chỉ mô tả texture nhìn thấy. Các thuộc tính cần thao tác như “dính chặt” hoặc “dễ cạo” không được suy ra từ ảnh.'
  });

  return Object.freeze({
    version:SURFACE_PHENOTYPE_POLICY_VERSION,
    active:true,
    productionEligible:false,
    calibrated:false,
    toothmarks,shape,coatingTexture,
    rule:'Đây là feature quan sát hình học/kết cấu đã QC; chưa phải clinical gold và không tự chuyển thành chẩn đoán YHCT.'
  });
}
