import assert from 'node:assert/strict';
import {knowledgeForQuery} from '../knowledge.mjs';
import {evidenceFor} from '../public/academic-fusion-core.js';
import {localGroundedChat} from '../local-grounded-reasoning.mjs';
await import('../public/qc-engine.js');

const qcEngine=globalThis.AITCQC;
assert.ok(qcEngine?.computePixelsQc,'ROI QC engine must be globally available');

function synthetic({sharp=true}={}){
  const w=640,h=640,d=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){d[p*4]=10;d[p*4+1]=10;d[p*4+2]=10;d[p*4+3]=255;}
  const cx=320,cy=350,rx=150,ry=220;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy>1)continue;
    const p=(y*w+x)*4,texture=sharp?(((x+y)%12<6)?22:-18):0;
    d[p]=Math.max(0,Math.min(255,188+texture));
    d[p+1]=Math.max(0,Math.min(255,112+texture));
    d[p+2]=Math.max(0,Math.min(255,122+texture));
    d[p+3]=255;
  }
  return {d,w,h};
}
const sharp=synthetic({sharp:true});
const sharpQc=qcEngine.computePixelsQc(sharp.d,sharp.w,sharp.h,{view:'top'});
assert.equal(sharpQc.roiDetected,true,'tongue ROI should be detected despite a mostly dark whole frame');
assert.equal(sharpQc.checks.shadow,true,'dark pixels outside tongue ROI must not fail the shadow check');
assert.ok(sharpQc.grade!=='poor','sharp tongue ROI should remain usable');

const downsampled=synthetic({sharp:true});
const sourceAware=qcEngine.computePixelsQc(downsampled.d,downsampled.w,downsampled.h,{view:'top',sourceWidth:1440,sourceHeight:1920});
assert.equal(sourceAware.checks.resolution,true,'QC must score original capture resolution rather than the downsample dimensions');
assert.ok(sourceAware.roi.sourceMin>=110,'source-mapped tongue ROI must retain enough effective pixels');

const flat=synthetic({sharp:false});
const flatQc=qcEngine.computePixelsQc(flat.d,flat.w,flat.h,{view:'top'});
assert.equal(flatQc.checks.focus,false,'uniform tongue ROI must fail focus');

function softUsable(){
  const w=640,h=640,d=new Uint8ClampedArray(w*h*4);
  for(let p=0;p<w*h;p++){d[p*4]=12;d[p*4+1]=12;d[p*4+2]=12;d[p*4+3]=255;}
  const cx=320,cy=350,rx=150,ry=220;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy>1)continue;
    const p=(y*w+x)*4,texture=Math.round(10*Math.sin(x/3.5)+5*Math.sin(y/5.5));
    d[p]=190+texture;d[p+1]=116+texture;d[p+2]=125+texture;d[p+3]=255;
  }
  return {d,w,h};
}
const usable=softUsable();
const usableQc=qcEngine.computePixelsQc(usable.d,usable.w,usable.h,{view:'top'});
assert.equal(usableQc.checks.focus,true,'low-texture but structured tongue ROI must be accepted as usable focus');
assert.equal(typeof usableQc.checks.focusOptimal,'boolean','QC must expose usable vs optimal focus separately');

const assessment={
  top:{tongueColor:'đỏ nhạt',coatingColor:'trắng',coatingThickness:'mỏng',coatingTexture:'mỏng đều',moisture:'nhuận',toothmarks:'Không thấy dấu răng',morphology:{fissure:{status:'unknown'}}},
  bottom:{visualValidity:{undersideVisible:true,vesselsVisible:true},undersideColor:'hồng đỏ',vessels:{visible:true,color:'xanh tím',dilation:'giãn',prominence:'thấy rõ'}}
};
const grounded=knowledgeForQuery('đối chiếu màu tím của tĩnh mạch mặt dưới lưỡi',{limit:12,assessment});
assert.ok(grounded.includes('[AT1, tr. 22]'),'ventral purple-vessel observation should retrieve the ventral atlas citation');
assert.ok(!grounded.includes('[AT1, tr. 8]'),'top-surface purple atlas must be rejected when top tongue is not purple');
assert.deepEqual(evidenceFor([]),[],'academic fusion must not pad evidence when no direct pattern exists');

const simulated={...assessment,combined:{academicFusion:{evidence:[{source:'AT1',page:8,text:'Màu tím mặt trên.'}]},generalSignals:[],cannotConclude:[]}};
const chat=localGroundedChat({assessment:simulated,message:'Cho nguồn đối chiếu tĩnh mạch mặt dưới lưỡi',knowledgeText:grounded});
assert.ok(chat.reply.includes('[AT1, tr. 22]'),'ventral source request must prioritize ventral evidence');
assert.ok(!chat.reply.includes('[AT1, tr. 8]'),'ventral source request must not reuse irrelevant top-surface fusion evidence');

console.log('ROI QC + EVIDENCE GROUNDING PASS: QC is tongue-ROI aware, focus is multi-scale, exposure is split, and atlas citations respect top/ventral observations.');
