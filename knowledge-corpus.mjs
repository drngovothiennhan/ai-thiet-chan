import {brotliDecompressSync} from 'node:zlib';
import c01 from './knowledge-corpus-chunks/c01.mjs';
import c02 from './knowledge-corpus-chunks/c02.mjs';
import c03 from './knowledge-corpus-chunks/c03.mjs';
import c04 from './knowledge-corpus-chunks/c04.mjs';
import c05 from './knowledge-corpus-chunks/c05.mjs';
import c06 from './knowledge-corpus-chunks/c06.mjs';
import c07 from './knowledge-corpus-chunks/c07.mjs';
import c08 from './knowledge-corpus-chunks/c08.mjs';
import c09 from './knowledge-corpus-chunks/c09.mjs';
import c10 from './knowledge-corpus-chunks/c10.mjs';
import c11 from './knowledge-corpus-chunks/c11.mjs';
import c12 from './knowledge-corpus-chunks/c12.mjs';
import c13 from './knowledge-corpus-chunks/c13.mjs';
import c14 from './knowledge-corpus-chunks/c14.mjs';
import c15 from './knowledge-corpus-chunks/c15.mjs';
import c16 from './knowledge-corpus-chunks/c16.mjs';
import c17 from './knowledge-corpus-chunks/c17.mjs';
import c18 from './knowledge-corpus-chunks/c18.mjs';
import c19 from './knowledge-corpus-chunks/c19.mjs';
import c20 from './knowledge-corpus-chunks/c20.mjs';
import c21 from './knowledge-corpus-chunks/c21.mjs';
const packed=[c01,c02,c03,c04,c05,c06,c07,c08,c09,c10,c11,c12,c13,c14,c15,c16,c17,c18,c19,c20,c21].join('');
const DATA=JSON.parse(brotliDecompressSync(Buffer.from(packed,'base64')).toString('utf8'));
export const SOURCES=['TC1','DY1','MC1','AT1','PSY1'].map(id=>DATA[id].meta);
export const SOURCE_BY_ID=new Map(SOURCES.map(s=>[s.id,s]));
export const PAGE_ROWS=SOURCES.flatMap(s=>DATA[s.id].pages);
export const ASSET_ROWS=SOURCES.flatMap(s=>DATA[s.id].assets);
export const TEXT_ROWS=SOURCES.flatMap(s=>DATA[s.id].texts);
const SIG_KEYS=['r','g','b','s','v','purple','white','yellow','dark','spot','aspect','coverage'];
function signatureObject(values){return values?Object.fromEntries(SIG_KEYS.map((k,i)=>[k,Number(values[i])||0])):null;}
function pageRecord(row){const [sourceId,page,hash,globalFeatures,values,imageCount,textChars]=row;return {id:`${sourceId}-page-${String(page).padStart(3,'0')}`,sourceId,page,kind:'page',hash,globalFeatures,d:signatureObject(values),imageCount,textChars,diagnosticVisualEligible:Boolean(SOURCE_BY_ID.get(sourceId)?.diagnosticVisualEligible)};}
function assetRecord(row){const [sourceId,page,ordinal,xref,hash,width,height,globalFeatures,values]=row;return {id:`${sourceId}-p${String(page).padStart(3,'0')}-img${String(ordinal).padStart(2,'0')}`,sourceId,page,ordinal,xref,kind:'embedded-image',hash,width,height,globalFeatures,d:signatureObject(values),diagnosticVisualEligible:Boolean(SOURCE_BY_ID.get(sourceId)?.diagnosticVisualEligible)};}
export const PAGE_CORPUS=PAGE_ROWS.map(pageRecord);
export const IMAGE_CORPUS=ASSET_ROWS.map(assetRecord);
export const TEXT_CORPUS=TEXT_ROWS.map(([sourceId,page,text])=>({sourceId,page,text}));
export const VISUAL_CORPUS=[...PAGE_CORPUS,...IMAGE_CORPUS];
export const POSITIVE_ATLAS=VISUAL_CORPUS.filter(r=>r.d&&r.diagnosticVisualEligible);
const totals={pages:SOURCES.reduce((n,s)=>n+s.pages,0),indexedPages:SOURCES.reduce((n,s)=>n+s.indexedPages,0),embeddedImageOccurrences:SOURCES.reduce((n,s)=>n+s.embeddedImageOccurrences,0),indexedImageOccurrences:SOURCES.reduce((n,s)=>n+s.indexedImageOccurrences,0),pageVisualSignatures:SOURCES.reduce((n,s)=>n+s.pageVisualSignatures,0),imageVisualSignatures:SOURCES.reduce((n,s)=>n+s.imageVisualSignatures,0),extractableTextChars:SOURCES.reduce((n,s)=>n+s.extractableTextChars,0)};
export const KNOWLEDGE_CORPUS_MANIFEST=Object.freeze({id:'AITC-KNOWLEDGE-5DOC-2026-09-15',folder:'A.I thiệt chẩn/Knowledge',folderDriveId:'1SXEo1EPZDw3KTdlFgf1NV1ibM-p4baUT',registryDocId:'1QzoIeB3LWwiJ8roQtcU_KmE72rGkboMcX8pdg5rsje0',knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',sourceCount:SOURCES.length,sources:SOURCES,totals,policies:{noSilentOmission:true,allPagesIndexed:totals.pages===totals.indexedPages,allEmbeddedImageOccurrencesIndexed:totals.embeddedImageOccurrences===totals.indexedImageOccurrences,positiveDiagnosticVisualSources:['TC1','DY1','MC1','AT1'],psychologySourceRole:'PSY1 context-only; never infer psychiatric state from tongue image.',nonTongueOrLowConfidenceVisuals:'Retained and used as background/negative/context visual records; never forced into positive tongue matches.'}});
export const ACADEMIC_PAGE_CORPUS=KNOWLEDGE_CORPUS_MANIFEST;
export function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));}
function centroid(records){const vals=records.map(r=>r.globalFeatures).filter(v=>Array.isArray(v)&&v.length>=5);if(!vals.length)return null;const out=new Array(5).fill(0);for(const v of vals)for(let i=0;i<5;i++)out[i]+=Number(v[i])||0;return out.map(v=>v/vals.length);}
const ELIGIBLE_GLOBAL=VISUAL_CORPUS.filter(r=>r.diagnosticVisualEligible),CONTEXT_GLOBAL=VISUAL_CORPUS.filter(r=>!r.diagnosticVisualEligible),ELIGIBLE_CENTROID=centroid(ELIGIBLE_GLOBAL),CONTEXT_CENTROID=centroid(CONTEXT_GLOBAL);
function centroidSimilarity(sig,c){if(!sig||!c)return 0;const s=[sig.r,sig.g,sig.b,sig.s,sig.v];let d=0;for(let i=0;i<5;i++)d+=Math.min(1,Math.abs((Number(s[i])||0)-c[i]));return clamp(1-d/5);}
export function corpusContext(sig){return {visualRecords:VISUAL_CORPUS.length,eligibleVisualRecords:ELIGIBLE_GLOBAL.length,contextOnlyVisualRecords:CONTEXT_GLOBAL.length,positiveAtlasRecords:POSITIVE_ATLAS.length,eligibleCentroidSimilarity:Number(centroidSimilarity(sig,ELIGIBLE_CENTROID).toFixed(3)),contextOnlyCentroidSimilarity:Number(centroidSimilarity(sig,CONTEXT_CENTROID).toFixed(3)),allPagesIndexed:totals.pages===totals.indexedPages,allEmbeddedImageOccurrencesIndexed:totals.embeddedImageOccurrences===totals.indexedImageOccurrences};}
function normText(v){return String(v||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function tokens(v){return [...new Set(normText(v).split(' ').filter(x=>x.length>=3))];}
export function searchTextCorpus(query,limit=6){const q=tokens(query);if(!q.length)return[];return TEXT_CORPUS.map(r=>{const hay=normText(r.text);let score=0;for(const t of q)if(hay.includes(t))score++;return {...r,score};}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,Math.max(1,limit)).map(r=>({sourceId:r.sourceId,page:r.page,score:r.score,text:r.text.slice(0,1600)}));}
export function coarse(d){const tongue=d.purple>.13?'tím':d.r>d.g*1.24&&d.s>.34?'đỏ':d.s<.22&&d.v>.60?'nhợt':'đỏ nhạt';const coat=d.yellow>.075&&d.yellow>d.white*.55?'vàng':d.white>.10?'trắng':'ít rêu';const thick=Math.max(d.white,d.yellow)>.34?'dày':Math.max(d.white,d.yellow)>.15?'mỏng':'rất mỏng';return {tongue,coat,thick,fissure:d.dark>.025,spots:d.spot>.055};}
function similarity(a,b){const dims=[['r',.06,1],['g',.05,1],['b',.05,1],['s',.07,1],['v',.06,1],['purple',.13,.35],['white',.13,.55],['yellow',.12,.40],['dark',.08,.12],['spot',.08,.55],['aspect',.08,1.4],['coverage',.09,.75]];let dist=0,total=0;for(const [k,w,scale] of dims){dist+=w*Math.min(1,Math.abs((a?.[k]||0)-(b?.[k]||0))/scale);total+=w;}const ca=coarse(a),cb=coarse(b);let cat=0;cat+=(ca.tongue===cb.tongue?.3:0);cat+=(ca.coat===cb.coat?.3:0);cat+=(ca.thick===cb.thick?.2:0);cat+=(ca.fissure===cb.fissure?.1:0);cat+=(ca.spots===cb.spots?.1:0);return clamp((1-dist/Math.max(.001,total))*.82+cat*.18);}
export function matchAtlas(sig){if(!sig)return[];const ranked=POSITIVE_ATLAS.map(r=>({...r,similarity:Number(similarity(sig,r.d).toFixed(3))})).sort((a,b)=>b.similarity-a.similarity);const out=[],seen=new Set();for(const r of ranked){const key=`${r.sourceId}:${r.page}:${r.hash}`;if(seen.has(key))continue;seen.add(key);out.push(r);if(out.length>=3)break;}return out;}
