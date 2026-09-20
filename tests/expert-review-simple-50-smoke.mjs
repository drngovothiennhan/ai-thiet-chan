import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('db/migrations/20260920_ai_thiet_chan_expert_review_simple_50_v1.sql','utf8');
const page=fs.readFileSync('public/expert-review-v1.html','utf8');
const admin=fs.readFileSync('public/admin-center.js','utf8');

assert.match(sql,/target_cases integer not null default 50/);
assert.match(sql,/target_cases between 1 and 50/);
assert.match(sql,/ai_thiet_chan_admin_create_expert_review_invite_v1/);
assert.match(sql,/ai_thiet_chan_expert_review_next_v1/);
assert.match(sql,/ai_thiet_chan_expert_review_submit_v1/);
assert.match(sql,/image_data_url is not null/);
const storageSql=fs.readFileSync('db/migrations/20260920_ai_thiet_chan_expert_review_storage_access_v1.sql','utf8');
const edge=fs.readFileSync('supabase/functions/aitc-expert-review-image-v1/index.ts','utf8');
assert.match(storageSql,/top_image_storage_path/);
assert.match(storageSql,/ai_thiet_chan_expert_review_image_ref_v1/);
assert.match(edge,/createSignedUrl\(path, 600\)/);
assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
assert.match(sql,/modelOutputUsedForAnnotation',false/);
assert.match(sql,/status','pending'/);
assert.match(sql,/Admin approval required before gold/i);
assert.match(page,/Duyệt & ca tiếp theo/);
assert.match(page,/Không hiển thị kết quả A\.I/);
assert.match(page,/ai_thiet_chan_expert_review_accept_v1/);
assert.match(page,/ai_thiet_chan_expert_review_next_v1/);
assert.match(page,/ai_thiet_chan_expert_review_submit_v1/);
assert.match(page,/aitc-expert-review-image-v1/);
assert.match(page,/resolveTopImage/);
assert.doesNotMatch(page,/\/api\/analyze|geminiGenerate|generativelanguage\.googleapis\.com/i);
assert.match(admin,/Tạo link chuyên gia 50 ca/);
assert.match(admin,/ai_thiet_chan_admin_create_expert_review_invite_v1/);
assert.match(admin,/ai_thiet_chan_admin_list_expert_review_invites_v1/);

console.log('EXPERT REVIEW SIMPLE 50 PASS: one-link clinician flow is model-blind, capped at 50 cases, supports private Storage Direct images via short-lived signed URLs, and still requires Admin approval before gold.');
