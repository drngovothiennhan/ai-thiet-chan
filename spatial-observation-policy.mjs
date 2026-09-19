export const SPATIAL_OBSERVATION_POLICY_VERSION='tongue-spatial-policy-v1';

const UNKNOWN='Không xác định';
function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}

export function interpretSpatialObservation(spatial={},qc={}){
  const valid=spatial&&typeof spatial==='object'&&spatial.schemaVersion==='tongue-spatial-observation-v1';
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:SPATIAL_OBSERVATION_POLICY_VERSION,
      active:false,
      coatingDistribution:UNKNOWN,
      medianSulcus:Object.freeze({status:'unknown',confidence:null,source:'spatial-observation-unavailable'}),
      fissure:Object.freeze({status:'unknown',source:'separate-from-median-sulcus'}),
      reason:valid?'qc-poor':'spatial-missing'
    });
  }
  const s=spatial.medianSulcus&&typeof spatial.medianSulcus==='object'?spatial.medianSulcus:{};
  const score=unit(s.score),continuity=unit(s.continuity),centrality=unit(s.centrality);
  const sulcusVisible=Boolean(s.visibleSignal===true&&score>=.62&&continuity>=.22&&centrality>=.35);
  const candidate=String(spatial.coatingDistributionCandidate||'');
  const coatRatio=unit(spatial.coatingCandidateRatio);
  const coatingDistribution=coatRatio>=.10&&['trung tâm–sau','lan tỏa'].includes(candidate)?candidate:UNKNOWN;
  return Object.freeze({
    version:SPATIAL_OBSERVATION_POLICY_VERSION,
    active:true,
    coatingDistribution,
    coatingCandidateRatio:coatRatio,
    medianSulcus:Object.freeze({
      status:sulcusVisible?'visible-signal':'unknown',
      confidence:sulcusVisible?Number(Math.min(.78,score).toFixed(3)):null,
      score,continuity,centrality,
      source:sulcusVisible?'tongue-spatial-observation-v1':'spatial-signal-below-gate'
    }),
    fissure:Object.freeze({
      status:'unknown',
      source:'separate-from-median-sulcus',
      rule:'Tín hiệu rãnh giữa không được tự chuyển thành nứt lưỡi bệnh lý.'
    }),
    bodyColorCandidate:String(spatial.bodyColorCandidate||''),
    coatingThicknessCandidate:String(spatial.coatingThicknessCandidate||'')
  });
}
