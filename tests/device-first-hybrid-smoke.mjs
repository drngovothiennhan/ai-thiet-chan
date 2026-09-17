import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('public/device-runtime.js');
const worker=read('public/device-analysis-worker.js');
const release=read('public/release-meta.js');
const source=read('public/academic-source.js');
const vision=read('public/academic-vision.js');
const doc=read('docs/DEVICE-FIRST-HYBRID-V1.md');

assert.match(runtime,/device-runtime-v1/);
assert.match(runtime,/workerCount/);
assert.match(runtime,/parallelViews/);
assert.match(runtime,/preferredAccelerator:webgpu\?'webgpu':wasm\?'wasm':'cpu'/);
assert.match(runtime,/requestClient|AITCRequestClient/);
assert.match(runtime,/device-compute/);
assert.match(runtime,/indexedImageOccurrences:1027/);
assert.match(runtime,/vectorizedVisualSignatures:298/);
assert.match(worker,/matchAtlas/);
assert.match(worker,/AITCAcademicVision/);
assert.match(worker,/coarseVisual/);
assert.match(worker,/indexedImageOccurrences:1027/);
assert.match(worker,/vectorizedVisualSignatures:298/);
assert.match(release,/device-runtime\.js/);
assert.match(source,/indexedImageOccurrences:1027/);
assert.match(source,/imageVisualSignatures:298/);
assert.match(vision,/indexedImageOccurrences:1027/);
assert.match(vision,/imageVisualSignatures:298/);
assert.match(doc,/owner-designated ground-truth training samples/);
assert.match(doc,/visual signatures hiện có: 298/);
assert.doesNotMatch(doc,/1\.027 vector thật đã có/);

console.log('device-first hybrid smoke: ok');
