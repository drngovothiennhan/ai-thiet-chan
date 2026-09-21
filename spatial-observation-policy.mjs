export const SPATIAL_OBSERVATION_POLICY_VERSION='tongue-spatial-policy-v2';

const UNKNOWN='Không xác định';
function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function oneOf(value,allowed){const text=String(value||'');return allowed.includes(text)?text:'';}

export function interpretSpatialObservation(spatial={},qc={}){
  const valid=spatial&&typeof spatial==='object'&&['tongue-spatial-observation-v1','tongue-spatial-observation-v2','tongue-spatial-observation-v3'].includes(spatial.schemaVersion);
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:SPATIAL_OBSERVATION_POLICY_VERSION,
      active:false,
      bodyColorCandidate:'',
      coatingColorCandidate:'',
      coatingThicknessCandidate:'',
      coatingDistribution:UNKNOWN,
      medianSulcus:Object.freeze({status:'unknown',confidence:null,source:'spatial-observation-unavailable'}),
      fissure:Object.freeze({status:'unknown',source:'separate-from-median-sulcus'}),
      reason:valid?'qc-poor':'spatial-missing'
    });
  }
  const s=spatial.medianSulcus&&typeof spatial.medianSulcus==='object'?spatial.medianSulcus:{};
  const score=unit(s.score),continuity=unit(s.continuity),centrality=unit(s.centrality);
  const sulcusVisible=Boolean(s.visibleSignal===true&&score>=.62&&continuity>=.22&&centrality>=.35);
  const distributionCandidate=oneOf(spatial.coatingDistributionCandidate,['trung tâm–sau','lan tỏa','không rõ']);
  const coatRatio=unit(spatial.coatingCandidateRatio);
  const coatingDistribution=coatRatio>=.09&&['trung tâm–sau','lan tỏa'].includes(distributionCandidate)?distributionCandidate:UNKNOWN;
  const bodyColorCandidate=oneOf(spatial.bodyColorCandidate,['đỏ nhạt','đỏ','nhợt']);
  const coatingColorCandidate=oneOf(spatial.coatingColorCandidate,['trắng','vàng']);
  const coatingThicknessCandidate=coatRatio>=.07?oneOf(spatial.coatingThicknessCandidate,['rất mỏng','mỏng','dày']):'';
  return Object.freeze({
    version:SPATIAL_OBSERVATION_POLICY_VERSION,
    active:true,
    observationSchema:String(spatial.schemaVersion),
    bodyColorCandidate,
    coatingColorCandidate,
    coatingThicknessCandidate,
    coatingDistribution,
    coatingCandidateRatio:coatRatio,
    colorNormalization:spatial.colorNormalization&&typeof spatial.colorNormalization==='object'?Object.freeze({...spatial.colorNormalization}):null,
    medianSulcus:Object.freeze({
      status:sulcusVisible?'visible-signal':'unknown',
      confidence:sulcusVisible?Number(Math.min(.78,score).toFixed(3)):null,
      score,continuity,centrality,
      source:sulcusVisible?String(s.source||spatial.schemaVersion):'spatial-signal-below-gate'
    }),
    fissure:Object.freeze({
      status:'unknown',
      source:'separate-from-median-sulcus',
      rule:'Tín hiệu rãnh giữa không được tự chuyển thành nứt lưỡi bệnh lý.'
    })
  });
}
