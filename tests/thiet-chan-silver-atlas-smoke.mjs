import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THIET_CHAN_USER_ATLAS,matchAtlas} from '../public/academic-signature.js';

const manifest=JSON.parse(fs.readFileSync('ml/silver/thiet-chan-atlas-v1.json','utf8'));
assert.equal(manifest.schemaVersion,'aitc-silver-visual-atlas-v1');
assert.equal(manifest.datasetId,'TCATLAS1');
assert.equal(manifest.sourcePdfSha256,'9d7d3a359024fa137b697bd7bc698ebf840fbcef17e35eda199b04cf15639d2c');
assert.equal(manifest.numberedImageCases,39);
assert.deepEqual(manifest.roleCounts,{dorsal:38,ventral:1});
assert.equal(manifest.rawImagesCommittedToGit,false);
assert.equal(manifest.goldEligible,false);
assert.equal(manifest.holdoutEligible,false);
assert.equal(manifest.promotionEligible,false);
assert.equal(manifest.clinicalAccuracyEligible,false);
assert.equal(manifest.ventralSilverReference.page,22);
assert.equal(manifest.ventralSilverReference.runtimeAtlas,false);

assert.equal(THIET_CHAN_USER_ATLAS.length,38);
assert.equal(new Set(THIET_CHAN_USER_ATLAS.map(x=>x.id)).size,38);
assert.ok(!THIET_CHAN_USER_ATLAS.some(x=>x.page===22),'ventral reference must stay out of dorsal matcher');
assert.ok(THIET_CHAN_USER_ATLAS.every(x=>x.sourceId==='TCATLAS1'&&x.sourceTier==='silver-teacher'));
assert.ok(THIET_CHAN_USER_ATLAS.every(x=>x.kind==='silver-textbook-image'&&x.d&&Number(x.d.coverage)>0));
assert.ok(THIET_CHAN_USER_ATLAS.every(x=>/không gán bệnh danh/.test(x.context)));

const exact=matchAtlas(THIET_CHAN_USER_ATLAS[0].d);
assert.equal(exact[0].id,THIET_CHAN_USER_ATLAS[0].id);
assert.equal(exact[0].similarity,1);

console.log('THIET CHAN SILVER ATLAS PASS: 39 owner-provided textbook image cases registered; 38 dorsal references are live in visual retrieval, the ventral page remains isolated for the underside pipeline, and none is eligible as clinical gold.');
