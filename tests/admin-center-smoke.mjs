import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync(new URL('../public/admin-center.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/ui-controls.js',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../public/settings.js',import.meta.url),'utf8');
const quality=fs.readFileSync(new URL('../public/quality-dashboard.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

for(const marker of [
  'Admin Center','adminCenterToken','sessionStorage','ai_thiet_chan_admin_verify_v1',
  'ai_thiet_chan_admin_list_feedback_v1','ai_thiet_chan_admin_review_feedback_v1',
  'ai_thiet_chan_admin_create_backup_v1','ai_thiet_chan_admin_list_backups_v1',
  'ai_thiet_chan_admin_export_backup_v1','ai_thiet_chan_admin_import_backup_v1',
  'ai_thiet_chan_admin_restore_backup_v1','KHOI_PHUC','Thư mục Backups'
]) assert.ok(admin.includes(marker),`missing Admin Center marker: ${marker}`);
assert.ok(!admin.includes('localStorage.setItem(TOKEN_KEY'),'admin token must not persist in localStorage');
for(const marker of ['qualityToggleBtn','clinicalFeedbackToggleBtn','aitc:quality-open','body.hidden=true']) assert.ok(ui.includes(marker),`missing collapsed UI marker: ${marker}`);
for(const marker of ['/ui-controls.js?v=2.7.0','/admin-center.js?v=2.7.0']) assert.ok(settings.includes(marker),`missing settings loader: ${marker}`);
assert.ok(quality.includes("window.addEventListener('aitc:quality-open'"),'quality metrics must load on demand');
assert.ok(!quality.includes('requestIdleCallback(()=>load()'),'quality metrics must not auto-load');
assert.ok(sw.includes("ai-thiet-chan-v2.7.0"),'PWA cache must be v2.7.0');
assert.ok(sw.includes("'/ui-controls.js'")&&sw.includes("'/admin-center.js'"),'new Admin Center assets missing from PWA shell');
console.log('ADMIN CENTER SMOKE PASS: separate admin login, collapsed panels, diagnostics, backup and restore UI are wired');
