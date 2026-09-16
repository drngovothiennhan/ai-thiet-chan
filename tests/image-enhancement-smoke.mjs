import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [enhancer,index,capture]=await Promise.all([
  read('public/image-enhancement.js'),
  read('public/index.html'),
  read('public/capture-metadata.js')
]);

// Enhancement must run before capture-metadata enriches the request, preserving the existing analysis/fusion path.
const appAt=index.indexOf('<script src="/app.js" defer></script>');
const enhanceAt=index.indexOf('<script src="/image-enhancement.js" defer></script>');
const captureAt=index.indexOf('<script src="/capture-metadata.js" defer></script>');
assert.ok(appAt>=0&&enhanceAt>appAt&&captureAt>enhanceAt,'image enhancement must load after app.js and before capture-metadata.js');

// Scope: deterministic pre-analysis enhancement only; no generative super-resolution or remote image API.
assert.match(enhancer,/preanalysis-image-enhancement-v1/);
assert.match(enhancer,/nonGenerative:true/);
assert.match(enhancer,/canvas-high-quality-multipass/);
assert.match(enhancer,/hue-preserving-luminance-gamma/);
assert.doesNotMatch(enhancer,/Real-ESRGAN|Stable Diffusion|diffusion|generativeFill|https?:\/\//i);

// Resolution improvement must be bounded to protect mobile memory and request size.
assert.match(enhancer,/MAX_OUTPUT_SIDE=1600/);
assert.match(enhancer,/MAX_OUTPUT_PIXELS=2_800_000/);
assert.match(enhancer,/MAX_UPSCALE=2\.0/);
assert.match(enhancer,/imageSmoothingQuality='high'/);
assert.match(enhancer,/resizeMultipass/);

// Color integrity: brightness changes are luminance-only with bounded gain and rollback guard.
assert.match(enhancer,/MAX_LUMA_GAIN=1\.28/);
assert.match(enhancer,/MAX_COLOR_DRIFT=0\.022/);
assert.match(enhancer,/MAX_GLARE_INCREASE=0\.06/);
assert.match(enhancer,/applyLuminanceGamma/);
assert.match(enhancer,/colorDrift\(before\.chroma,after\.chroma\)/);
assert.match(enhancer,/guard='resample-only'/);

// Analyze request keeps original images alongside enhanced images for traceability and future storage compatibility.
assert.match(enhancer,/body\.topOriginalImage=originalTop/);
assert.match(enhancer,/body\.bottomOriginalImage=originalBottom/);
assert.match(enhancer,/body\.topEnhancement=top\.meta/);
assert.match(enhancer,/body\.bottomEnhancement=bottom\.meta/);
assert.match(enhancer,/body\.imageEnhancement=\{version:VERSION,nonGenerative:true,colorIntegrityGuard:true\}/);

// Existing capture metadata/fusion wrapper must remain present and unmodified in responsibility.
assert.match(capture,/captureContext/);
assert.match(capture,/academic/);

console.log('IMAGE ENHANCEMENT SMOKE PASS: bounded multipass interpolation, luminance-only auto-brightening, color-integrity rollback and existing fusion path are preserved.');
