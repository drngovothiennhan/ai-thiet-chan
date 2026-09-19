export const VENTRAL_OBSERVATION_POLICY_VERSION='ventral-structure-color-policy-v2';

function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function int(v,max=1000000){const n=Math.round(Number(v)||0);return Math.max(0,Math.min(max,n));}

function colorObservation(features,visible,quality){
  const isV3=features?.schemaVersion==='bottom-device-feature-v3';
  const n=int(features?.vesselColorSamplePixels);
  if(!isV3||!visible||n<12)return Object.freeze({
    status:'unknown',label:'Không xác định',confidence:null,samplePixels:n,
    reason:!isV3?'ventral-color-v3-missing':!visible?'bilateral-vessel-structure-not-verified':'insufficient-vessel-color-samples'
  });
  const blue=unit(features.vesselBluePurpleRatio),red=unit(features.vesselRedPurpleRatio),dark=unit(features.vesselDarkPurpleRatio);
  const delta=unit(features.vesselVsMucosaChromaDelta);
  const r=unit(features.vesselMeanR),g=unit(features.vesselMeanG),b=unit(features.vesselMeanB);
  if(delta<.008||Math.max(r,b)<=g)return Object.freeze({
    status:'unknown',label:'Không xác định',confidence:null,samplePixels:n,
    reason:'relative-chroma-separation-insufficient'
  });
  let status='purple-mixed',label='tím/xanh-tím hỗn hợp',strength=Math.max(delta/.06,.45);
  if(dark>=.58){status='dark-purple';label='tím sẫm';strength=Math.max(strength,dark);}
  else if(blue>=.52){status='blue-purple';label='xanh-tím';strength=Math.max(strength,blue);}
  else if(red>=.52){status='red-purple';label='tím-đỏ';strength=Math.max(strength,red);}
  const base=quality==='good'?.86:.66;
  const confidence=Number(Math.min(.78,base*(.55+.45*unit(strength))).toFixed(3));
  return Object.freeze({
    status,label,confidence,samplePixels:n,
    metrics:Object.freeze({
      meanR:r,meanG:g,meanB:b,
      bluePurpleRatio:blue,redPurpleRatio:red,darkPurpleRatio:dark,
      vesselVsMucosaChromaDelta:delta
    }),
    reason:'relative-color-on-verified-vessel-like-dark-lines',
    rule:'Nhãn màu mô tả màu nhìn thấy tương đối sau QC; không tự suy giãn mạch, ngoằn ngoèo, huyết ứ hoặc bệnh.'
  });
}

export function interpretVentralObservation(features={},qc={}){
  const valid=features&&typeof features==='object'&&['bottom-device-feature-v2','bottom-device-feature-v3'].includes(features.schemaVersion);
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:VENTRAL_OBSERVATION_POLICY_VERSION,
      active:false,calibrated:false,productionEligible:false,
      bilateralStructureVisible:false,
      vesselColor:Object.freeze({status:'unknown',label:'Không xác định',confidence:null}),
      reason:valid?'qc-poor':'ventral-v2-v3-missing',
      forbiddenInferences:['venous-dilation','tortuosity','stasis','absolute-size']
    });
  }
  const leftRatio=unit(features.leftDarkLineRatio),rightRatio=unit(features.rightDarkLineRatio);
  const balance=unit(features.bilateralBalance),leftContinuity=unit(features.leftRowContinuity),rightContinuity=unit(features.rightRowContinuity);
  const visible=Boolean(
    features.bilateralSignal===true&&
    Math.min(leftRatio,rightRatio)>=.05&&
    balance>=.30&&
    leftContinuity>=.60&&rightContinuity>=.60
  );
  return Object.freeze({
    version:VENTRAL_OBSERVATION_POLICY_VERSION,
    active:true,calibrated:false,productionEligible:false,
    bilateralStructureVisible:visible,
    vesselColor:colorObservation(features,visible,quality),
    leftDarkLineRatio:leftRatio,
    rightDarkLineRatio:rightRatio,
    bilateralBalance:balance,
    leftRowContinuity:leftContinuity,
    rightRowContinuity:rightContinuity,
    authority:'direct-role-specific-image-observation-only',
    colorRule:'Chỉ mô tả màu tương đối của cấu trúc mạch đã xác minh; flash/white-balance và niêm mạc xung quanh vẫn là biến nhiễu bắt buộc.',
    forbiddenInferences:['venous-dilation','tortuosity','stasis','absolute-size']
  });
}
