import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [index,styles,dual,settings,quality,release]=await Promise.all([
  read('public/index.html'),
  read('public/styles.css'),
  read('public/dual-view.css'),
  read('public/settings.css'),
  read('public/quality-dashboard.css'),
  read('public/release-ui.css')
]);

// Mobile viewport and safe-area support must remain present.
assert.match(index,/name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/);
assert.match(styles,/env\(safe-area-inset-top\)/);
assert.match(styles,/env\(safe-area-inset-bottom\)/);
assert.match(styles,/@media\(max-width:420px\)/);
assert.match(styles,/@media\(min-width:760px\)/);

// Branding must remain exactly two logical lines and compact on small screens.
assert.match(index,/<div class="brand">A\.I THIỆT CHẨN<\/div>\s*<div class="subtitle">HIU CLB YHCT<\/div>/);
assert.match(styles,/@media\(max-width:420px\)[\s\S]*?\.brand\{font-size:16px\}/);
assert.match(styles,/\.topbar\{[^}]*position:sticky/);

// Primary workflow controls must remain visible and operable from the main document.
for(const id of ['normalModeBtn','generalModeBtn','topCameraBtn','topFileInput','bottomCameraBtn','bottomFileInput','analyzeBtn','reportBtn','startInquiryBtn','settingsBtn']){
  assert.match(index,new RegExp(`id="${id}"`),`missing primary UI control ${id}`);
}
assert.match(index,/id="analyzeBtn"[^>]*>Phân tích bằng A\.I<\/button>/);
assert.match(index,/id="resultCard" class="card" hidden/);

// Touch targets and mobile result readability must not regress.
assert.match(styles,/\.btn,\.analyze-btn\{[^}]*min-height:46px/);
assert.match(styles,/@media\(max-width:420px\)[\s\S]*?\.result-grid\{grid-template-columns:1fr\}/);
assert.match(styles,/\.card\{[^}]*border-radius:22px/);

// The supplemental modules can be present but may not replace the capture -> result flow.
assert.match(index,/class="card capture-card"/);
assert.match(index,/id="resultCard"/);
assert.match(index,/class="card quality-card"/);
assert.match(index,/class="card history-card"/);
assert.match(index,/class="card chat-card"/);

// Imported UI styles must stay materialized; empty files would silently break mobile layout.
for(const [name,source] of [['dual-view.css',dual],['settings.css',settings],['quality-dashboard.css',quality],['release-ui.css',release]]){
  assert.ok(source.trim().length>80,`${name} unexpectedly empty`);
}

// Medical-use boundary must remain visible in the result section.
assert.match(index,/Giới hạn sử dụng y tế/);
assert.match(index,/không phải sensitivity\/specificity/);

console.log('PRE-RELEASE UI SMOKE PASS: responsive shell, two-line branding, primary controls, touch targets and clinical boundary remain intact.');
