export const STASIS_SPOT_POLICY_VERSION='tongue-stasis-spot-policy-v1';
export const TONGUE_TOPOGRAPHY_POLICY_VERSION='tcm-tongue-topography-v1';

const UNKNOWN='Không xác định';
const REGION_MAP=Object.freeze({
  tip:Object.freeze({label:'đầu/phần trước lưỡi',zangFu:Object.freeze(['Tâm','Phế'])}),
  margin:Object.freeze({label:'hai bên/rìa lưỡi',zangFu:Object.freeze(['Can','Đởm'])}),
  center:Object.freeze({label:'trung tâm lưỡi',zangFu:Object.freeze(['Tỳ','Vị'])}),
  root:Object.freeze({label:'gốc/phần sau lưỡi',zangFu:Object.freeze(['Thận','Hạ tiêu']),note:'Một số đồ hình YHCT mở rộng vùng gốc tới ruột/bàng quang.'})
});
function unit(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function int(v,max=1000){const n=Math.round(Number(v)||0);return Math.max(0,Math.min(max,n));}
function regionRows(counts={}){
  const out=[];
  for(const key of ['tip','margin','center','root']){
    const count=int(counts?.[key],100);
    if(!count)continue;
    const map=REGION_MAP[key];
    out.push(Object.freeze({
      region:key,regionLabel:map.label,count,
      zangFu:[...map.zangFu],
      note:String(map.note||''),
      interpretation:'Đồ hình lý luận YHCT dùng để đối chiếu học thuật; không phải ranh giới giải phẫu và không đồng nghĩa bệnh của tạng phủ.'
    }));
  }
  return Object.freeze(out);
}
export function interpretStasisSpotObservation(features={},qc={}){
  const valid=features&&typeof features==='object'&&features.schemaVersion==='tongue-stasis-spot-features-v1';
  const quality=String(qc?.grade||'poor');
  if(!valid||quality==='poor'){
    return Object.freeze({
      version:STASIS_SPOT_POLICY_VERSION,
      topographyVersion:TONGUE_TOPOGRAPHY_POLICY_VERSION,
      active:false,calibrated:false,productionEligible:false,
      smallSpots:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null}),
      patches:Object.freeze({status:'unknown',label:UNKNOWN,confidence:null}),
      regions:Object.freeze([]),
      rule:valid?'Ảnh QC kém: không gán điểm ứ/ban ứ từ tín hiệu màu cục bộ.':'Thiếu feature chuyên biệt: giữ Không xác định.'
    });
  }
  const componentCount=int(features.componentCount,100);
  const smallCount=int(features.smallSpotCount,100);
  const patchCount=int(features.patchCount,100);
  const acceptedAreaRatio=unit(features.acceptedAreaRatio);
  const purple=unit(features.meanPurpleDelta);
  const contrast=unit(features.meanDarkContrast);
  const support=unit(componentCount/4);
  const evidence=unit(support*.35+unit(purple/.08)*.35+unit(contrast/.10)*.30);
  const base=quality==='good'?.86:.66;
  const conf=Number(Math.min(.80,base*(.50+.50*evidence)).toFixed(3));
  const smallPossible=smallCount>0&&acceptedAreaRatio>0;
  const patchPossible=patchCount>0&&acceptedAreaRatio>0;
  return Object.freeze({
    version:STASIS_SPOT_POLICY_VERSION,
    topographyVersion:TONGUE_TOPOGRAPHY_POLICY_VERSION,
    active:true,calibrated:false,productionEligible:false,
    smallSpots:Object.freeze({
      status:smallPossible?'possible':'unknown',
      label:smallPossible?'có ứng viên điểm sẫm/tím nhỏ, gợi hình thái điểm ứ':UNKNOWN,
      confidence:smallPossible?conf:null,
      count:smallCount,
      rule:'Chỉ là ứng viên hình ảnh sẫm/tím cục bộ; không đồng nhất với gai/điểm đỏ và không tự xác lập chứng huyết ứ.'
    }),
    patches:Object.freeze({
      status:patchPossible?'possible':'unknown',
      label:patchPossible?'có ứng viên mảng sẫm/tím lớn hơn, gợi hình thái ban ứ':UNKNOWN,
      confidence:patchPossible?conf:null,
      count:patchCount,
      rule:'Chỉ là ứng viên hình ảnh theo diện tích tương đối trong ROI; không phải chẩn đoán xuất huyết hay huyết ứ.'
    }),
    metrics:Object.freeze({
      componentCount,
      acceptedAreaRatio:Number(acceptedAreaRatio.toFixed(4)),
      meanPurpleDelta:Number(purple.toFixed(4)),
      meanDarkContrast:Number(contrast.toFixed(4)),
      redSpotExcludedRatio:Number(unit(features.redSpotExcludedRatio).toFixed(4))
    }),
    regions:regionRows(features.regionCounts),
    componentSummaries:Array.isArray(features.componentSummaries)?Object.freeze(features.componentSummaries.slice(0,12).map(x=>Object.freeze({
      kind:String(x?.kind||'unknown').slice(0,20),
      region:String(x?.region||'unknown').slice(0,20),
      areaRatio:unit(x?.areaRatio),
      aspect:Math.max(0,Math.min(10,Number(x?.aspect)||0)),
      nx:unit(x?.nx),ny:unit(x?.ny)
    }))):Object.freeze([]),
    rule:'Phân đoạn thân lưỡi -> loại vùng rêu/chói -> tìm thành phần cục bộ sẫm tím theo tương phản tương đối -> phân nhóm điểm/mảng -> định vị vùng. Mọi ngưỡng là engineering candidate, không phải ngưỡng chẩn đoán lâm sàng.',
    topographyRule:'Đầu Tâm-Phế; rìa Can-Đởm; giữa Tỳ-Vị; gốc Thận/Hạ tiêu là đồ hình YHCT dùng để đối chiếu học thuật, không phải bản đồ giải phẫu.'
  });
}
