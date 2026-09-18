import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_morphology_labels_v1.sql','utf8');
const contribute=fs.readFileSync('public/clinical-contribute-v1.html','utf8');
const adjudicate=fs.readFileSync('public/gold-review-v1.html','utf8');

assert.match(sql,/tongue-morphology-label-v1/);
assert.match(sql,/median_sulcus_prominence_invalid/);
assert.match(sql,/fissure_visual_status_invalid/);
assert.match(sql,/fissure_branching_invalid/);
assert.match(sql,/fissure_pattern_invalid/);
assert.match(sql,/fissure_depth_must_not_be_inferred_from_2d/);
assert.match(sql,/not_collected_from_2d/);
assert.match(sql,/ai_thiet_chan_verified_contribution_morphology_guard_v1/);
assert.match(sql,/ai_thiet_chan_gold_adjudication_morphology_guard_v1/);

for(const page of [contribute,adjudicate]){
  assert.match(page,/tongue-morphology-label-v1/);
  assert.match(page,/medianSulcus/);
  assert.match(page,/fissureStatus/);
  assert.match(page,/fissureBranching/);
  assert.match(page,/fissurePattern/);
  assert.match(page,/toothmarks/);
  assert.match(page,/bodyShape/);
  assert.match(page,/not_collected_from_2d/);
}
assert.match(contribute,/Rãnh giữa và nứt là hai nhãn khác nhau/);
assert.match(adjudicate,/Rãnh giữa và nứt được quyết định riêng/);

console.log('MORPHOLOGY LABEL CONTRACT PASS: verified contributors and adjudicators collect separate median-sulcus/fissure labels; 2D depth inference is forbidden.');
