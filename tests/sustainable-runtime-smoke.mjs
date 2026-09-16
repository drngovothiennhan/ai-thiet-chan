import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../public/runtime-stability.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../public/vision-worker.js',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../public/diagnostic-worker-client.js',import.meta.url),'utf8');
const releaseUi=fs.readFileSync(new URL('../public/release-ui.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

for(const marker of ['sustainable-core-v1','PerformanceObserver','longtask','stopActiveCamera','visibilitychange','pagehide'])assert.ok(runtime.includes(marker),`missing runtime stability marker: ${marker}`);
assert.ok(!runtime.includes('window.fetch='),'runtime stability guard must not monkey-patch fetch');
for(const marker of ['OffscreenCanvas','createImageBitmap','purpleRatio','yellowRatio','glareRatio','vision-worker-v1'])assert.ok(worker.includes(marker),`missing worker marker: ${marker}`);
for(const marker of ["new Worker('/vision-worker.js')",'VISION_WORKER_TIMEOUT','AITCVisionWorker'])assert.ok(client.includes(marker),`missing worker client marker: ${marker}`);
for(const marker of ['/runtime-stability.js','/diagnostic-worker-client.js','AITCLoadOperationalRuntime','warmVisionEvidence','requestAnimationFrame'])assert.ok(releaseUi.includes(marker),`missing release runtime marker: ${marker}`);
assert.ok(!releaseUi.includes("document.addEventListener('click'"),'global document click observer must stay removed');
assert.ok(sw.includes('ai-thiet-chan-v2.9.20-sustainable-core'),'PWA cache version mismatch');
for(const asset of ['/runtime-stability.js','/diagnostic-worker-client.js','/vision-worker.js'])assert.ok(sw.includes(`'${asset}'`),`missing sustainable core asset: ${asset}`);
assert.ok(!sw.includes('skipWaiting()'),'service worker must not force mid-session activation');
assert.ok(!sw.includes('clients.claim()'),'service worker must not claim active clients');

console.log('SUSTAINABLE RUNTIME SMOKE PASS: bounded worker vision, throttled observers, camera shutdown, minimal PWA lifecycle and deferred operational runtime are wired.');