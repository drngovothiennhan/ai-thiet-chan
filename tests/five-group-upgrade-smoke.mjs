import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evidenceReadiness,learningPriorityFromSimilarity,ACADEMIC_HEALTH} from '../academic-server.mjs';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [scope,runtime,academic,dashboard,benchmark,pkgText,styles,corpus]=await Promise.all([
  read('docs/PRE_RELEASE_SUPER_PROMPT_5_GROUPS.md'),
  read('runtime-guard.mjs'),
  read('academic-server.mjs'),
  read('public/quality-dashboard.js'),
  read('scripts/benchmark-analyze.mjs'),
  read('package.json'),
  read('public/styles.css'),
  read('knowledge-corpus.mjs')
]);

// Locked scope: exactly the five pre-release quality groups, no production merge/deploy.
for(const marker of ['NHÓM A — UI/UX','NHÓM B — A.I / XỬ LÝ HÌNH ẢNH','NHÓM C — AGENT / LOGIC PIPELINE','NHÓM D — DỮ LIỆU / HỌC MÁY / CA MỚI','NHÓM E — QA / RELEASE']) assert.match(scope,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(scope,/không deployment production/i);
assert.match(scope,/không thay đổi trọng số fusion 45% direct image \/ 35% atlas \/ 20% Gemini academic/i);

// AI/Agent: one provider chain, deterministic circuit breaker, no third model.
assert.match(runtime,/RUNTIME_AGENT_VERSION='aitc-provider-agent-v1'/);
assert.match(runtime,/MODEL_FAILURE_OPEN_THRESHOLD=3/);
assert.match(runtime,/MODEL_COOLDOWN_MS=45_000/);
assert.match(runtime,/const GEMINI_MODEL_CHAIN=\[GEMINI_MODEL,GEMINI_FALLBACK_MODEL\]/);
assert.doesNotMatch(runtime,/gemini-2\.5|gemini-2\.0|gpt-|claude-/i);
assert.match(runtime,/VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE/);

// Pipeline evidence readiness: 3 layers, 2 required, no weight changes.
const assessment={top:{quality:'good',theoryAssessment:{generalSignals:[{label:'x',confidence:.5}]}},combined:{generalSignals:[{label:'x',confidence:.5}],stomachPatternSignals:[],cannotConclude:[]}};
const profile=evidenceReadiness(assessment,{direct:[{label:'x'}],matches:[{similarity:.44}]});
assert.equal(profile.activeLayers,3);
assert.equal(profile.minimumRequired,2);
assert.equal(profile.minimumMet,true);
assert.equal(profile.topAtlasSimilarity,.44);
assert.equal(ACADEMIC_HEALTH.minimumLayers,2);
assert.deepEqual(ACADEMIC_HEALTH.weights,{directImage:0.45,atlasSimilarity:0.35,geminiAcademic:0.2});

// Learning: novelty remains focused, poor QC excluded, fair novel downgraded inside fusion policy.
assert.equal(learningPriorityFromSimilarity(.42,{quality:'good',signaturePresent:true}).status,'novel');
assert.equal(learningPriorityFromSimilarity(.82,{quality:'good',signaturePresent:true}).status,'covered');
assert.equal(learningPriorityFromSimilarity(.30,{quality:'poor',signaturePresent:true}).learningCandidate,false);
assert.match(academic,/novel-but-fair-image-quality/);
assert.match(academic,/minimum-evidence-layers-not-met/);
assert.equal(ACADEMIC_HEALTH.learningCollection.autoPromoteToKnowledge,false);
assert.equal(ACADEMIC_HEALTH.learningCollection.minimumEvidenceLayersForLearning,2);

// Data/UI: expose pipeline cleanliness and Knowledge integrity without claiming clinical accuracy.
assert.match(dashboard,/qualityPipeline/);
assert.match(dashboard,/browser-local-vision/);
assert.match(dashboard,/Knowledge 5-doc/);
assert.match(dashboard,/không phải độ chính xác chẩn đoán/);
assert.match(styles,/@media\(max-width:420px\)/);
assert.match(styles,/@media\(min-width:760px\)/);

// QA/release: benchmark refuses canonical production by default and measures percentile latency.
assert.match(benchmark,/Refusing to benchmark canonical production/);
assert.match(benchmark,/p50:pct\(latencies,50\)/);
assert.match(benchmark,/p95:pct\(latencies,95\)/);
assert.match(benchmark,/successRate/);

// Do not install a stack of extra AI frameworks during this phase.
const pkg=JSON.parse(pkgText);
const deps=Object.keys(pkg.dependencies||{}).join(' ');
assert.doesNotMatch(deps,/langgraph|monai|evidently|onnxruntime|segment-anything|torch|tensorflow/i);

// Knowledge corpus remains the complete five-document corpus with safety boundary intact.
assert.match(corpus,/sourceCount:5/);
assert.match(corpus,/noSilentOmission:true/);
assert.match(corpus,/positiveDiagnosticVisualSources:\['TC1','DY1','MC1','AT1'\]/);
assert.match(corpus,/PSY1 context-only; never infer psychiatric state from tongue image/);

console.log('FIVE-GROUP UPGRADE SMOKE PASS: locked scope, provider agent, evidence gate, novel-case policy, pipeline integrity metrics, benchmark guard and 5-doc Knowledge boundary are preserved.');
