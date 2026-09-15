// Test process only: every external request is handled locally, never sent out.
import {Server} from 'node:http';
const listen=Server.prototype.listen;
Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({port:this.address().port}));return listen.apply(this,args);};
globalThis.fetch=async(input,init={})=>{
  const url=String(input),body=JSON.parse(init.body||'{}');
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(url.includes('generativelanguage.googleapis.com')){
    if(url.includes('gemini-3.8'))return json({error:{message:'overload'}},429);
    const prompt=body.contents[0].parts.map(p=>p.text||'').join(' ');
    if(prompt.includes('test-malformed'))return json({candidates:[{content:{parts:[{text:'{}'}]}}]});
    const a={top:{summary:prompt.includes('stall-store')?'stall-store':'test case',quality:'good',visualValidity:{tongueVisible:true},tongueColor:'đỏ',coatingColor:'vàng',confidence:.8,theoryAssessment:{generalSignals:[]}},combined:{summary:prompt.includes('stall-store')?'stall-store':'test case',confidence:.8,generalSignals:[],stomachPatternSignals:[]}};
    return json({candidates:[{content:{parts:[{text:JSON.stringify(a)}]}}]});
  }
  if(url.includes('register_secret'))return json(true);
  if(url.includes('guest_consume'))return json({ok:true,role:'guest'});
  if(url.includes('store_case_v2')){
    if(body.p_feature_vector.combined.confidence!==body.p_analysis.combined.confidence)throw new Error('stale stored confidence');
    if(body.p_analysis.top.summary.includes('stall-store'))return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}}));
    return json({stored:true,id:'test-only'});
  }
  throw new Error('Unexpected external test request');
};
