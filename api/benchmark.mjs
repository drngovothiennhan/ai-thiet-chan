function num(v,max=120000){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.round(n))):null;}
function text(v,limit=80){return String(v||'').slice(0,limit);}
export default function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const b=req.body||{};
  const event={
    event:text(b.event||'analysis_benchmark'),
    clickToResultMs:num(b.clickToResultMs),
    requestToResultMs:num(b.requestToResultMs),
    localVisionMs:num(b.localVisionMs),
    upstreamMs:num(b.upstreamMs),
    fusionMs:num(b.fusionMs),
    fallback:Boolean(b.fallback),
    fallbackReason:text(b.fallbackReason),
    inferenceSource:text(b.inferenceSource),
    mode:b.mode==='general'?'general':'normal',
    success:Boolean(b.success),
    at:new Date().toISOString()
  };
  console.info('analysis_benchmark',JSON.stringify(event));
  return res.status(204).end();
}
