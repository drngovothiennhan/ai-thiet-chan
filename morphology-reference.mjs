export const MORPHOLOGY_POLICY_VERSION='tongue-morphology-grounding-v1';

export const MORPHOLOGY_REFERENCE=Object.freeze({
  basis:'user-provided-tongue-diagnosis-materials',
  normal:{
    description:'Lưỡi bình thường mềm mại, linh hoạt, không quá thon cũng không quá bệu, nhỏ dần về phía đầu lưỡi; chất lưỡi đỏ nhạt và rêu trắng mỏng, hơi nhuận.',
    use:'Mốc bình thường là hình thái tương đối, không phải một kích thước pixel hay tỷ lệ ảnh cố định.'
  },
  puffy:{
    description:'Lưỡi mập/bệu theo tài liệu là thân lưỡi căng to và dày; trường hợp rõ có thể chiếm/chất đầy khoang miệng. Dấu răng có thể đi kèm nhưng không phải tiêu chí duy nhất.',
    forbiddenShortcut:'Không được gọi lưỡi mập/bệu chỉ vì tỷ lệ rộng/dài của mask cao.'
  },
  thin:{
    description:'Lưỡi gầy/mỏng là thể lưỡi gầy nhỏ và mỏng; tài liệu cũng mô tả lưỡi mỏng hơn bình thường, có thể teo trong trường hợp rõ.',
    forbiddenShortcut:'Không được gọi gầy/mỏng chỉ vì đường bao ảnh trông hẹp; ảnh mặt trên 2D không đo trực tiếp được độ dày thân lưỡi.'
  },
  color:{
    description:'Màu chất lưỡi bình thường là đỏ nhạt/đỏ nhạt mà nhuận. Các nhãn nhợt, đỏ, đỏ sẫm, xanh/tím phải được hiểu là lệch so với mốc bình thường và chỉ đáng tin khi ánh sáng phù hợp.',
    confounders:['ánh sáng ám màu','thiếu/cháy sáng','thức ăn hoặc đồ uống có màu','đưa lưỡi quá mạnh','đưa lưỡi quá lâu']
  },
  sublingual:{
    description:'Tĩnh mạch dưới lưỡi bình thường tím nhạt, mềm, không giãn/uốn lượn. Tài liệu nêu đường kính không quá khoảng 2.7 mm và chiều dài thường không quá 3/5 đoạn từ đầu lưỡi đến thắng lưỡi.',
    measurementRule:'Chỉ dùng mm hoặc tỷ lệ chiều dài khi ảnh có chuẩn kích thước/điểm mốc đủ tin cậy; ảnh thông thường chỉ mô tả định tính.'
  },
  imaging:{
    pose:'Lưỡi đưa tự nhiên, thả lỏng, mặt lưỡi tương đối phẳng, bộc lộ đủ; không thè quá mạnh vì có thể đổi hình dạng và làm đỏ lưỡi.',
    time:'Không nên giữ lưỡi đưa ra quá lâu; tài liệu nêu khoảng 15-20 giây là giới hạn thực hành để tránh đỏ giả.',
    light:'Ưu tiên ánh sáng tự nhiên/trung tính; ánh sáng vàng hoặc ám màu làm giảm độ tin cậy màu.'
  }
});

function plain(value){
  return String(value||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function unique(items){return [...new Set(items.filter(Boolean))];}
function containsAny(text,patterns){return patterns.some(p=>text.includes(p));}

export function groundTongueMorphology(assessment,body={}){
  if(!assessment||typeof assessment!=='object')return assessment;
  const top=assessment.top&&typeof assessment.top==='object'?assessment.top:null;
  if(!top)return assessment;

  const signature=body?.academicSignature&&typeof body.academicSignature==='object'?body.academicSignature:{};
  const aspect=finite(signature.aspect);
  const coverage=finite(signature.coverage);
  const rawShape=String(top.shape||'').trim();
  const text=plain([rawShape,top.toothmarks,...(Array.isArray(top.otherVisibleFeatures)?top.otherVisibleFeatures:[])].join(' '));
  const puffyClaim=containsAny(text,['map','beu','phu to','phong to','cang to','to map']);
  const thinClaim=containsAny(text,['gay','mong','thon','teo']);
  const puffyDefEvidence=containsAny(text,['cang','day','chat day khoang','lap day khoang','phu','sung']);
  const toothmarkSupport=containsAny(text,['han rang','dau rang','an rang'])&&!containsAny(text,['khong thay','chua thay']);
  const scaleCalibrated=Boolean(body?.morphologyCalibration?.knownScale||body?.captureCalibration?.knownScale);
  const mouthReference=Boolean(body?.morphologyCalibration?.mouthReferenceVisible)||containsAny(text,['khoang mieng','day khoang','lap day']);

  let groundedShape=rawShape||'Không xác định';
  let classification='descriptive-only';
  let confidencePolicy='relative-2d';
  const evidence=[];
  const limitations=[];

  if(aspect!==null)evidence.push(`aspect2D=${aspect.toFixed(3)}`);
  if(coverage!==null)evidence.push(`coverageFrame=${coverage.toFixed(3)}`);
  if(toothmarkSupport)evidence.push('có dấu răng hỗ trợ');
  if(mouthReference)evidence.push('có mô tả tương quan khoang miệng');

  if(puffyClaim){
    if(puffyDefEvidence&&mouthReference){
      groundedShape='Nghi mập/bệu theo tiêu chí tài liệu; cần đối chiếu thêm độ dày/thể tích thực';
      classification='puffy-supported';
    }else if(puffyDefEvidence||toothmarkSupport){
      groundedShape='Rộng/mập tương đối; chưa đủ tiêu chí để kết luận mập/bệu';
      classification='puffy-candidate';
    }else{
      groundedShape='Rộng tương đối theo hình học ảnh; chưa đủ tiêu chí để kết luận mập/bệu';
      classification='wide-geometry-only';
    }
    limitations.push('Theo tài liệu, mập/bệu cần xét thân lưỡi căng to và dày, tốt nhất có tương quan với khoang miệng; không dùng tỷ lệ rộng/dài đơn độc.');
  }else if(thinClaim){
    groundedShape='Thon/hẹp tương đối theo ảnh 2D; chưa đủ tiêu chí để kết luận gầy/mỏng';
    classification='narrow-geometry-only';
    limitations.push('Theo tài liệu, gầy/mỏng bao gồm yếu tố thân lưỡi mỏng/teo; ảnh mặt trên 2D không đo trực tiếp được độ dày.');
  }

  if(!scaleCalibrated){
    limitations.push('Ảnh không có chuẩn kích thước tuyệt đối: không suy mm/cm hoặc ngưỡng kích thước cơ thể từ pixel.');
  }else confidencePolicy='calibrated-relative';

  const colorReliability=String(top?.visualValidity?.colorReliability||top?.quality||'unknown');
  if(colorReliability==='poor')limitations.push('Độ tin cậy màu thấp: không dùng màu sắc làm mốc mạnh cho biện chứng.');

  top.shapeRaw=rawShape||null;
  top.shape=groundedShape;
  top.limitations=unique([...(Array.isArray(top.limitations)?top.limitations:[]),...limitations]);

  assessment.ml=assessment.ml||{};
  assessment.ml.featureVector=assessment.ml.featureVector||{};
  assessment.ml.featureVector.morphology={
    policyVersion:MORPHOLOGY_POLICY_VERSION,
    rawShape:rawShape||null,
    groundedShape,
    classification,
    geometry2D:{aspect,coverage},
    calibration:{absoluteScale:scaleCalibrated,mouthReferenceVisible:mouthReference},
    colorReliability,
    evidence,
    limitations,
    trainingRule:'store raw observation and grounded label separately; never train puffy/thin from aspect ratio alone'
  };
  assessment.ml.morphologyGrounding={
    version:MORPHOLOGY_POLICY_VERSION,
    reference:MORPHOLOGY_REFERENCE,
    classification,
    confidencePolicy,
    evidence,
    limitations
  };
  assessment.combined=assessment.combined||{};
  assessment.combined.morphologyGrounding={version:MORPHOLOGY_POLICY_VERSION,classification,evidence,limitations};
  return assessment;
}
