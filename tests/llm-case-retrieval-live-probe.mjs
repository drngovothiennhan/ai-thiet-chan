import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

process.env.VERCEL_ENV='preview';
process.env.AITC_CASE_RETRIEVAL_REMOTE_TIMEOUT_MS=process.env.AITC_CASE_RETRIEVAL_REMOTE_TIMEOUT_MS||'15000';
delete process.env.AITC_CASE_RETRIEVAL_DB;

const mod=await import('../case-retrieval.mjs?live-probe=1');

const health=await mod.caseRetrievalRuntimeHealth();
assert.equal(health.ready,true,JSON.stringify(health));
assert.equal(health.mode,'remote');
assert.equal(health.records,44643);
assert.equal(health.sourceCounts['tcmchat-medical-case-sft-v1'],44623);
assert.equal(health.sourceCounts['pmc-ccby-cc0-case-reports-v1'],20);

const result=await mod.retrieveSimilarCasesRuntime(
  'Người dùng mô tả đau đầu, chóng mặt; quan sát cấu trúc: lưỡi đỏ, rêu vàng mỏng.',
  {limit:4}
);
assert.equal(result.mode,'remote');
assert.ok(result.returned>0,JSON.stringify(result));
assert.ok(result.returned<=4);

console.log('CURRENT_HEAD_LIVE_RETRIEVAL',JSON.stringify({
  health:{ready:health.ready,mode:health.mode,records:health.records,sourceCounts:health.sourceCounts},
  query:{terms:result.terms,returned:result.returned},
  cases:result.cases.map(x=>({id:x.id,sourceId:x.sourceId,sourceRecordId:x.sourceRecordId,rank:x.rank}))
}));

const server=spawn(process.execPath,['--import','./runtime-guard.mjs','server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:'3100',GEMINI_API_KEY:''},
  stdio:['ignore','pipe','pipe']
});
let serverLog='';
server.stdout.on('data',d=>{serverLog+=d.toString();});
server.stderr.on('data',d=>{serverLog+=d.toString();});
try{
  let localHealth=null;
  for(let i=0;i<45;i++){
    try{
      const r=await fetch('http://127.0.0.1:3100/api/health');
      if(r.ok){localHealth=await r.json();break;}
    }catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(localHealth,'current-head server did not become healthy: '+serverLog.slice(-1200));
  assert.equal(localHealth.caseReasoningRetrieval.ready,true,JSON.stringify(localHealth.caseReasoningRetrieval));
  assert.equal(localHealth.caseReasoningRetrieval.mode,'remote');
  assert.equal(localHealth.caseReasoningRetrieval.records,44643);
  console.log('CURRENT_HEAD_API_HEALTH',JSON.stringify({
    retrieval:localHealth.caseReasoningRetrieval,
    providerConfigured:localHealth.providerConfigured,
    vision:localHealth.vision
  }));

  const symptomResponse=await fetch('http://127.0.0.1:3100/api/symptom-next',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      assessment:{
        mode:'normal',
        top:{
          quality:'good',
          confidence:0.72,
          visualValidity:{tongueVisible:true,wholeTongueVisible:true,rootVisible:true,framing:'adequate',occlusion:'none',colorReliability:'good'},
          tongueColor:'Đỏ',shape:'Bình thường',coatingColor:'Vàng',coatingThickness:'Mỏng',
          coatingTexture:'Bình thường',moisture:'Nhuận',
          morphology:{medianSulcus:{status:'unknown'},fissure:{status:'unknown',depth:'not-assessable-from-2d-image'}},
          toothmarks:'Không xác định',pricklesSpots:'Không xác định',stasisMarks:'Không xác định',
          otherVisibleFeatures:[],theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:[]},limitations:[]
        },
        bottom:null,
        combined:{confidence:0.72,summary:'Quan sát cấu trúc: chất lưỡi đỏ, rêu vàng mỏng.',generalSignals:[],stomachPatternSignals:[],cannotConclude:[]},
        approvedClinicalKnowledge:[],knowledgeVersion:'live-rag-ci'
      },
      symptomContext:'Tôi đau đầu'
    })
  });
  const symptomData=await symptomResponse.json().catch(()=>({}));
  assert.equal(symptomResponse.status,200,JSON.stringify(symptomData));
  assert.equal(symptomData.ok,true);
  assert.equal(symptomData.engine,'deterministic-case-rag-v2');
  assert.ok(symptomData.caseRetrieval?.returned>0,JSON.stringify(symptomData));
  assert.equal(typeof symptomData.reply,'string');
  assert.ok(symptomData.reply.length>0);
  console.log('CURRENT_HEAD_ADAPTIVE_SYMPTOM_RAG',JSON.stringify({
    status:symptomResponse.status,
    engine:symptomData.engine,
    evidenceBased:symptomData.evidenceBased,
    selectedConcept:symptomData.selectedConcept,
    supportCases:symptomData.supportCases,
    returned:symptomData.caseRetrieval?.returned,
    mode:symptomData.caseRetrieval?.mode,
    timingMs:symptomData.timingMs,
    reply:symptomData.reply
  }));
} finally {
  server.kill('SIGTERM');
}

const selected=result.cases.map((x,i)=>({
  index:i+1,
  sourceId:x.sourceId,
  sourceRecordId:x.sourceRecordId,
  rank:x.rank,
  caseText:String(x.caseText||'').slice(0,650)
}));
const ragContext=selected.map(x=>[
  `CA ${x.index} | source=${x.sourceId} | record=${x.sourceRecordId} | bm25=${x.rank}`,
  x.caseText
].join('\n')).join('\n\n');

const payload={
  assessment:{
    mode:'normal',
    top:{
      quality:'good',
      confidence:0.72,
      visualValidity:{tongueVisible:true,wholeTongueVisible:true,rootVisible:true,framing:'adequate',occlusion:'none',colorReliability:'good'},
      tongueColor:'Đỏ',shape:'Bình thường',coatingColor:'Vàng',coatingThickness:'Mỏng',
      coatingTexture:'Bình thường',moisture:'Nhuận',
      morphology:{
        medianSulcus:{status:'possible',prominence:'mild',orientation:'midline',source:'local-vision'},
        fissure:{status:'unknown',branching:'unknown',pattern:'unknown',location:'unknown',width:'unknown',depth:'not-assessable-from-2d-image',source:'local-vision'}
      },
      toothmarks:'Không xác định',pricklesSpots:'Không xác định',stasisMarks:'Không xác định',
      otherVisibleFeatures:[],
      theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:['Chưa đủ tứ chẩn để kết luận thể.']},
      limitations:[]
    },
    bottom:null,
    combined:{
      confidence:0.72,
      summary:'Quan sát cấu trúc: chất lưỡi đỏ, rêu vàng mỏng.',
      generalSignals:[],stomachPatternSignals:[],
      cannotConclude:['Chưa đủ tứ chẩn để chẩn đoán xác định.']
    },
    approvedClinicalKnowledge:[],
    knowledgeVersion:'live-rag-ci'
  },
  message:`[MÔ PHỎNG RAG - DỮ LIỆU TRUY HỒI THẬT, KHÔNG PHẢI GOLD]
Các ca dưới đây chỉ để đối chiếu tương đồng, không được biến đáp án lịch sử thành chẩn đoán hiện tại và không kê đơn từ ca cũ.

${ragContext}

Dữ kiện hiện tại: người dùng cho biết đau đầu và chóng mặt; quan sát cấu trúc ghi chất lưỡi đỏ, rêu vàng mỏng.
Hãy đối chiếu điểm giống/khác với các ca trên theo hướng học tập, nêu rõ giới hạn và không chẩn đoán xác định.`
};

const response=await fetch('https://ai-thiet-chan.vercel.app/api/chat',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(payload)
});
const data=await response.json().catch(()=>({}));
assert.equal(response.status,200,JSON.stringify(data));
assert.equal(data.ok,true);

console.log('REAL_PRODUCTION_CONSULTATION_WITH_LIVE_RETRIEVAL_CONTEXT',JSON.stringify({
  retrievalReturned:result.returned,
  retrievalCases:selected.map(x=>({sourceId:x.sourceId,sourceRecordId:x.sourceRecordId,rank:x.rank})),
  consultationStatus:response.status,
  model:data.model,
  grounding:data.grounding,
  replyPreview:String(data.reply||'').slice(0,800)
}));
console.log('LIVE_RAG_PROBE_PASS');
