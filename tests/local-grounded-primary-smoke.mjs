import assert from 'node:assert/strict';
import fs from 'node:fs';
import {localGroundedChat,localGroundedReport,LOCAL_REASONING_HEALTH} from '../local-grounded-reasoning.mjs';
import {OPEN_SOURCE_VISION_REGISTRY,OPEN_SOURCE_VISION_POLICY} from '../open-source-vision-registry.mjs';

const assessment={
  mode:'normal',
  top:{
    quality:'good',
    tongueColor:'đỏ',
    shape:'Không xác định',
    coatingColor:'vàng',
    coatingThickness:'mỏng',
    toothmarks:'Không xác định',
    pricklesSpots:'Có tín hiệu điểm đỏ/gai cần đối chiếu',
    stasisMarks:'Không xác định',
    morphology:{
      medianSulcus:{status:'unknown'},
      fissure:{status:'unknown',legacyDarkLineSignal:true}
    },
    limitations:['Không suy đoán độ sâu nứt từ ảnh 2D.'],
    theoryAssessment:{generalSignals:[],cannotConclude:['Cần phối hợp Vấn chẩn/Tứ chẩn.']}
  },
  combined:{
    confidence:.61,
    summary:'Ảnh ghi nhận chất lưỡi đỏ và rêu vàng mỏng; cần phối hợp dữ kiện khác.',
    generalSignals:[{label:'Tín hiệu nhiệt / thực nhiệt',evidence:'Chất lưỡi đỏ phối hợp rêu vàng.',confidence:.66}],
    cannotConclude:['Không chẩn đoán bệnh từ ảnh lưỡi đơn độc.'],
    academicFusion:{
      acceptedPatterns:[{label:'Tín hiệu nhiệt / thực nhiệt',score:.66,directEvidence:'Chất lưỡi đỏ phối hợp rêu vàng.'}],
      evidence:[{source:'TC1',page:20,text:'Hàn nhiệt cần đối chiếu chất lưỡi và rêu trong bối cảnh.'}]
    }
  }
};

assert.equal(LOCAL_REASONING_HEALTH.requiresExternalProvider,false);
const chat=localGroundedChat({assessment,message:'Kết quả này nghĩa là gì?'});
assert.equal(chat.ok,true);
assert.equal(chat.engine,'aitc-local-grounded-reasoning-v1');
assert.match(chat.reply,/Thiệt tượng mặt trên quan sát được/);
assert.match(chat.reply,/đỏ/);
assert.match(chat.reply,/rêu vàng/);
assert.match(chat.reply,/Tín hiệu nhiệt/);

const fissure=localGroundedChat({assessment,message:'Có nứt lưỡi không?'});
assert.match(fissure.reply,/chưa đủ căn cứ gọi là nứt/);
assert.doesNotMatch(fissure.reply,/nứt lưỡi đã được xác nhận/i);

const report=localGroundedReport({assessment,mode:'normal'});
assert.equal(report.ok,true);
assert.match(report.report,/BÁO CÁO THIỆT CHẨN/);
assert.match(report.report,/Thiệt tượng mặt trên/);
assert.match(report.report,/QUAN SÁT VÀ ĐỐI CHIẾU Y VĂN/);
assert.ok(Array.isArray(report.sections));
assert.ok(report.sections.some(s=>/Quan sát mặt trên/.test(s.title)));
assert.ok(report.sections.some(s=>/Đối chiếu kiến thức/.test(s.title)));
assert.ok(report.sections.some(s=>/Bàn luận/.test(s.title)));
assert.match(report.modeLabel,/Bình thường/);

assert.equal(OPEN_SOURCE_VISION_POLICY.weightRule.includes('not assumed'),true);
for(const item of OPEN_SOURCE_VISION_REGISTRY){
  assert.ok(item.name&&item.repo&&item.license&&item.use&&item.adoption);
}
const agpl=OPEN_SOURCE_VISION_REGISTRY.find(x=>x.license==='AGPL-3.0');
assert.equal(agpl.adoption,'no-code-or-weight-copy-into-production');

const server=fs.readFileSync('server.mjs','utf8');
assert.match(server,/localGroundedChat/);
assert.match(server,/localGroundedReport/);
assert.match(server,/AITC_CASE_STORE_TOKEN/);
assert.match(server,/provider:'local-grounded'/);
assert.match(server,/role:'optional-post-analysis-augmentation'/);
assert.match(server,/auxiliaryStatus:'unavailable'/);
assert.doesNotMatch(server,/app\.post\('\/api\/chat'[\s\S]{0,260}AI_PROVIDER_NOT_CONFIGURED/);
assert.doesNotMatch(server,/app\.post\('\/api\/report'[\s\S]{0,260}AI_PROVIDER_NOT_CONFIGURED/);

console.log('LOCAL GROUNDED PRIMARY PASS: consultation/reporting run without Gemini, Gemini is optional and external 429/503 cannot replace the grounded primary result.');
