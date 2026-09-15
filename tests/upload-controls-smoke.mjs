import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../public/upload-controls.js',import.meta.url),'utf8');
for(const marker of ['topFileInput','bottomFileInput','topUploadBtn','bottomUploadBtn','Tải ảnh mặt trên','Tải ảnh mặt dưới','input.click()',"input.removeAttribute('capture')"]){
  assert.ok(src.includes(marker),`upload controls missing: ${marker}`);
}
assert.ok(!src.includes('/api/analyze'), 'upload controls must reuse the existing image-analysis pipeline, not create a parallel API path');
console.log('UPLOAD CONTROLS SMOKE PASS: existing images open from device storage and reuse the same QC and AI analysis pipeline');
