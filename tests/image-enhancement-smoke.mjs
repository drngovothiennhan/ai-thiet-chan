import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [enhancer,index,capture,sw,admin]=await Promise.all([
  read('public/image-enhancement.js'),read('public/index.html'),read('public/capture-metadata.js'),read('public/sw.js'),read('public/admin-center.js')
]);

const appAt=index.indexOf('<script src="/app.js" defer></script>');
const enhanceAt=index.indexOf('<script src="/image-enhancement.js" defer></script>');
const captureAt=index.indexOf('<script src="/capture-metadata.js" defer></script>');
assert.ok(appAt>=0&&enhanceAt>appAt&&captureAt>enhanceAt,'image enhancement must load after app.js and before capture-metadata.js');

assert.match(enhancer,/preanalysis-image-enhancement-v2-audit/);
assert.match(enhancer,/nonGenerative:true/);
assert.match(enhancer,/canvas-high-quality-multipass/);
assert.match(enhancer,/hue-preserving-luminance-gamma/);
assert.doesNotMatch(enhancer,/Real-ESRGAN|Stable Diffusion|diffusion|generativeFill/i);

assert.match(enhancer,/MAX_OUTPUT_SIDE=1600/);
assert.match(enhancer,/MAX_OUTPUT_PIXELS=2_800_000/);
assert.match(enhancer,/MAX_UPSCALE=2\.0/);
assert.match(enhancer,/imageSmoothingQuality='high'/);
assert.match(enhancer,/resizeMultipass/);

assert.match(enhancer,/MAX_LUMA_GAIN=1\.28/);
assert.match(enhancer,/MAX_COLOR_DRIFT=0\.022/);
assert.match(enhancer,/MAX_GLARE_INCREASE=0\.06/);
assert.match(enhancer,/applyLuminanceGamma/);
assert.match(enhancer,/colorDrift\(before\.chroma,after\.chroma\)/);
assert.match(enhancer,/guard='resample-only'/);
assert.match(enhancer,/rollbackReason/);
assert.match(enhancer,/glareDeltaPct/);

assert.match(enhancer,/ai_thiet_chan_image_enhancement_config_v1/);
assert.match(enhancer,/if\(!config\.enabled\)return request/);
assert.match(enhancer,/body\.topOriginalImage=originalTop/);
assert.match(enhancer,/body\.bottomOriginalImage=originalBottom/);
assert.match(enhancer,/body\.topEnhancement=top\.meta/);
assert.match(enhancer,/body\.bottomEnhancement=bottom\.meta/);
assert.match(enhancer,/body\.topQc=\{/);
assert.match(enhancer,/enhancement:top\.meta/);
assert.match(enhancer,/body\.imageEnhancement=\{enabled:true,version:VERSION/);

assert.match(admin,/ai_thiet_chan_admin_set_image_enhancement_v1/);
assert.match(admin,/ai_thiet_chan_admin_enhancement_audit_v1/);
assert.match(admin,/scale/);
assert.match(admin,/gamma/);
assert.match(admin,/colorDrift/);
assert.match(admin,/glareDeltaPct/);
assert.match(admin,/rollback/);

assert.match(capture,/captureContext/);
assert.match(capture,/inspectView/);
assert.match(capture,/nativeFetch/);
assert.match(sw,/importScripts\('\/academic-vision\.js'\)/);
assert.match(sw,/\/image-enhancement\.js/);

console.log('IMAGE ENHANCEMENT SMOKE PASS: admin-only toggle, bounded enhancement, color/glare rollback and per-case audit telemetry are wired.');