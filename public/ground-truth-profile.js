export const GROUND_TRUTH_PROFILE_VERSION='owner-ground-truth-profile-v1';
export const GROUND_TRUTH_SOURCE='KNOWLEDGE-5DOC';
export const GROUND_TRUTH_DESIGNATION='owner-designated-ground-truth-v1';

export const GROUND_TRUTH_SOURCES=Object.freeze([
  Object.freeze({id:'TC1',title:'Thiệt chẩn hoàn chỉnh.pdf',driveId:'1FhwZfsWErcL-9YK9Tysss-1jmhjYftQO',pdfSha256:'72afb5595e20e0f6311b2166ad8103129cf42a1299528b58bfea09892d49218e',imageOccurrences:44,diagnosticTongueSignatures:0,diagnosticSource:true}),
  Object.freeze({id:'DY1',title:'Đông y chẩn đoán bệnh trên lưỡi.pdf',driveId:'1etBY4s9_jD-totEIpZvGdwwgRTQj1Ise',pdfSha256:'802d949b0e512fbe3ab34f699b9a1e73a75fc2679f282b98ab33b55736511c22',imageOccurrences:302,diagnosticTongueSignatures:257,diagnosticSource:true}),
  Object.freeze({id:'MC1',title:'Chẩn đoán bằng mạch chẩn và thiệt chẩn.pdf',driveId:'17kFAC-7WOFbzqpr-WGeq5eDkS9eXzQXS',pdfSha256:'336de613f28b26b3122ccee33d395bd57ed91ee3342df42fd84a99d0eadf3dea',imageOccurrences:92,diagnosticTongueSignatures:1,diagnosticSource:true}),
  Object.freeze({id:'AT1',title:'Thiệt chẩn bằng hình ảnh_967525.pdf',driveId:'1wX4WhR9pcfsbVrfVhQQks4lS4UZWkjEn',pdfSha256:'2105100126eba2fb7ea59ad7a048a1fdd269caed8d7de243ff8001617df4fc3f',imageOccurrences:41,diagnosticTongueSignatures:40,diagnosticSource:true}),
  Object.freeze({id:'PSY1',title:'Tâm bệnh học.pdf',driveId:'1pm6Rx0LoJKFjbJCqqS-cWqDZUTLhWdNd',pdfSha256:'f4a78b248d83dfbaa2364fd203bc25c440956c92c568f98802ec8645c824fd67',imageOccurrences:548,diagnosticTongueSignatures:0,diagnosticSource:false,role:'context-only'})
]);

// All 1,027 image occurrences have source-derived global visual vectors [r,g,b,s,v].
// The 298 records with a tongue-specific segmentation signature are the positive
// diagnostic-reference subset. The remaining 729 records are retained as
// background/negative/context training samples and are never forced into a
// positive tongue nearest-neighbour match.
export const GROUND_TRUTH_PROFILE=Object.freeze({
  source:GROUND_TRUTH_SOURCE,
  designation:GROUND_TRUTH_DESIGNATION,
  profileVersion:GROUND_TRUTH_PROFILE_VERSION,
  indexedImageOccurrences:1027,
  ownerDesignatedTrainingSamples:1027,
  globalVisualVectors:1027,
  diagnosticTongueSignatures:298,
  contextOrNegativeSamples:729,
  trainingVectorCoverage:1,
  diagnosticSignatureCoverage:Number((298/1027).toFixed(6)),
  global:Object.freeze({count:1027,mean:Object.freeze([0.884541,0.867187,0.860807,0.041277,0.886205]),std:Object.freeze([0.118052,0.129018,0.134996,0.069513,0.116754])}),
  diagnostic:Object.freeze({count:298,mean:Object.freeze([0.824636,0.764906,0.742846,0.141486,0.830149]),std:Object.freeze([0.063075,0.06044,0.064964,0.049455,0.059962])}),
  context:Object.freeze({count:729,mean:Object.freeze([0.909029,0.908997,0.909027,0.000314,0.909119]),std:Object.freeze([0.126254,0.126223,0.126233,0.004968,0.126193])}),
  sources:GROUND_TRUTH_SOURCES
});

function finiteVector(v){return Array.isArray(v)&&v.length>=5&&v.slice(0,5).every(x=>Number.isFinite(Number(x)));}
function zDistance(vector,profile){
  if(!finiteVector(vector))return null;
  let sum=0;
  for(let i=0;i<5;i++){
    const std=Math.max(1e-6,Number(profile.std[i])||1);
    const z=(Number(vector[i])-Number(profile.mean[i]))/std;
    sum+=z*z;
  }
  return Number(Math.sqrt(sum/5).toFixed(4));
}
export function classifyGlobalContext(globalFeatures){
  const diagnosticDistance=zDistance(globalFeatures,GROUND_TRUTH_PROFILE.diagnostic);
  const contextDistance=zDistance(globalFeatures,GROUND_TRUTH_PROFILE.context);
  if(diagnosticDistance===null||contextDistance===null)return Object.freeze({available:false});
  const margin=Number((contextDistance-diagnosticDistance).toFixed(4));
  return Object.freeze({
    available:true,
    profileVersion:GROUND_TRUTH_PROFILE_VERSION,
    trainingSamples:1027,
    diagnosticSamples:298,
    contextSamples:729,
    diagnosticDistance,
    contextDistance,
    margin,
    referenceRegion:margin>=0?'diagnostic-reference-like':'context-background-like',
    policy:'global-vector context gate only; never convert this score into a diagnosis'
  });
}
