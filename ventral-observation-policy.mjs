export const VENTRAL_OBSERVATION_POLICY_VERSION='ventral-structure-policy-v1';

function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}

export function interpretVentralObservation(features={},qc={}){
  const valid=features&&typeof features==='object'&&features.schemaVersion==='bottom-device-feature-v2';
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:VENTRAL_OBSERVATION_POLICY_VERSION,
      active:false,
      bilateralStructureVisible:false,
      reason:valid?'qc-poor':'ventral-v2-missing'
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
    active:true,
    bilateralStructureVisible:visible,
    leftDarkLineRatio:leftRatio,
    rightDarkLineRatio:rightRatio,
    bilateralBalance:balance,
    leftRowContinuity:leftContinuity,
    rightRowContinuity:rightContinuity,
    authority:'direct-role-specific-image-observation-only',
    forbiddenInferences:['venous-dilation','tortuosity','stasis','absolute-size']
  });
}
