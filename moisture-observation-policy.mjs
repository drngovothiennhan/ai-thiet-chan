export const MOISTURE_OBSERVATION_POLICY_VERSION='tongue-moisture-policy-v1';

const UNKNOWN='Không xác định';
function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function finite(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function region(raw={}){
  return {
    sampledPixels:Math.max(0,Math.round(finite(raw.sampledPixels))),
    glossRatio:unit(raw.glossRatio),
    strictGlossRatio:unit(raw.strictGlossRatio),
    largestGlossComponentRatio:unit(raw.largestGlossComponentRatio),
    distributedGlossRatio:unit(raw.distributedGlossRatio),
    roughness:unit(raw.roughness),
    meanValue:unit(raw.meanValue)
  };
}
function evidenceScores(r){
  const glossStrength=Math.max(0,Math.min(1,
    unit(r.glossRatio/.018)*.50+
    unit(r.strictGlossRatio/.006)*.25+
    unit(r.distributedGlossRatio/.65)*.25
  ));
  const roughDry=unit((r.roughness-.030)/.040);
  const dryStrength=(r.glossRatio<=.010&&roughDry>=.30)
    ?Math.max(0,Math.min(1,(1-glossStrength)*.45+roughDry*.55))
    :0;
  const balancedStrength=(r.glossRatio>.004&&r.glossRatio<.020&&r.roughness<.060)
    ?Math.max(0,Math.min(1,.55+(.060-r.roughness)*3))
    :0;
  return {glossStrength,dryStrength,balancedStrength};
}
function classify(raw,qcReliability,flashRisk){
  const r=region(raw);
  const score=evidenceScores(r);
  if(r.sampledPixels<80||qcReliability<.48||flashRisk>=.62){
    return Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:r.sampledPixels<80?'insufficient-region-pixels':flashRisk>=.62?'flash-or-specular-confounded':'qc-insufficient',metrics:Object.freeze(r),scores:Object.freeze(score)});
  }
  let status='unknown',label=UNKNOWN,strength=0,reason='evidence-below-gate';
  const wet=score.glossStrength*(1-flashRisk*.72);
  const dry=score.dryStrength*(1-flashRisk*.35);
  if(wet>=.62){status='moist';label='nhuận/ướt';strength=wet;reason='distributed-specular-signal';}
  else if(dry>=.64){status='dry';label='khô';strength=dry;reason='low-gloss-plus-roughness-signal';}
  else if(score.balancedStrength>=.62&&wet<.58&&dry<.58){status='balanced';label='khô ướt vừa phải';strength=score.balancedStrength;reason='intermediate-gloss-low-roughness-signal';}
  const confidence=status==='unknown'?null:Number(Math.min(.82,qcReliability*(.55+.45*strength)).toFixed(3));
  return Object.freeze({status,label,confidence,reason,metrics:Object.freeze(r),scores:Object.freeze({...score,wet:unit(wet),dry:unit(dry)})});
}

export function interpretMoistureObservation(raw={},qc={}){
  const valid=raw&&typeof raw==='object'&&raw.schemaVersion==='tongue-moisture-features-v1';
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:MOISTURE_OBSERVATION_POLICY_VERSION,
      active:false,productionEligible:false,calibrated:false,
      surface:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'moisture-features-missing'}),
      body:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'moisture-features-missing'}),
      coating:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null,reason:valid?'qc-poor':'moisture-features-missing'}),
      qc:Object.freeze({quality,flashRisk:1,reliability:0}),
      rule:'Không ép nhãn khô/ướt khi QC kém hoặc chưa có tín hiệu chuyên biệt.'
    });
  }
  const rawQc=raw.qc&&typeof raw.qc==='object'?raw.qc:{};
  const overexposed=unit(rawQc.overexposedRatio);
  const dominance=unit(rawQc.largestGlossComponentRatio);
  const wholeGloss=unit(raw?.surface?.glossRatio);
  const flashRisk=unit(
    unit(overexposed/.045)*.45+
    unit((dominance-.62)/.38)*.35+
    unit((wholeGloss-.060)/.080)*.20
  );
  const base=quality==='good'?.92:.68;
  const coverage=unit(rawQc.roiCoverage);
  const sampleSupport=unit(finite(raw?.surface?.sampledPixels)/900);
  const reliability=unit(base*(.55+.25*unit(coverage/.18)+.20*sampleSupport)*(1-flashRisk*.62));
  const surface=classify(raw.surface,reliability,flashRisk);
  const body=classify(raw.body,reliability,flashRisk);
  const coating=classify(raw.coating,reliability*.92,flashRisk);
  return Object.freeze({
    version:MOISTURE_OBSERVATION_POLICY_VERSION,
    active:true,
    observationSchema:String(raw.schemaVersion),
    productionEligible:false,
    calibrated:false,
    surface,body,coating,
    qc:Object.freeze({quality,flashRisk:Number(flashRisk.toFixed(3)),reliability:Number(reliability.toFixed(3)),overexposedRatio:overexposed,roiCoverage:coverage}),
    rule:'Độ ẩm là tín hiệu quan sát từ gloss/texture đã QC; flash/cháy sáng không được đồng nhất với ướt, nứt đơn độc không được đồng nhất với khô. Các ngưỡng hiện là gate kỹ thuật bảo thủ và chưa phải ngưỡng chẩn đoán/clinical gold.'
  });
}
