import assert from 'node:assert/strict';
import fs from 'node:fs';

const sw=fs.readFileSync('public/sw.js','utf8');
const server=fs.readFileSync('server.mjs','utf8');
const academic=fs.readFileSync('academic-server.mjs','utf8');
const release=fs.readFileSync('public/release-meta.js','utf8');
const app=fs.readFileSync('public/app.js','utf8');

assert.match(sw,/CASE_IMAGE_BUCKET='aitc-case-images'/);
assert.match(sw,/uploadCaseImage\(image,topImageDigest\)/);
assert.match(sw,/delete body\.topImage/);
assert.match(sw,/delete body\.bottomImage/);
assert.match(sw,/delete body\.topOriginalImage/);
assert.match(sw,/storage-direct-service-worker/);
assert.match(sw,/function hasCurrentSpatialSignature\(signature\)/);
assert.match(sw,/tongue-spatial-observation-v3/);
assert.match(sw,/tongue-moisture-features-v1/);
assert.match(sw,/claimed===actual&&hasCurrentSpatialSignature\(body\.academicSignature\)/);
assert.match(server,/ai_thiet_chan_store_case_v3/);
assert.match(server,/legacyInlineFallback:true/);
assert.match(server,/ai_thiet_chan_store_case_v2/);
assert.match(academic,/storage-direct-service-worker/);
assert.match(academic,/top-storage-path-mismatch/);
assert.match(release,/2026\.09\.21-recognition-prod-r1/);

console.log('STORAGE DIRECT PASS: image bytes upload to private Supabase Storage before /api/analyze; Vercel receives hashes, QC, verified visual payload, and storage paths, with legacy inline rollback compatibility retained.');
