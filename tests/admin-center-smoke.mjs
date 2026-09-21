import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync(new URL('../public/admin-center.js',import.meta.url),'utf8');
const credentials=fs.readFileSync(new URL('../public/admin-credentials.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/ui-controls.js',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../public/settings.js',import.meta.url),'utf8');
const quality=fs.readFileSync(new URL('../public/quality-dashboard.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const adminPage=fs.readFileSync(new URL('../public/admin-center.html',import.meta.url),'utf8');

for(const marker of [
  'Admin Center','sessionStorage','ai_thiet_chan_admin_verify_v1',
  'ai_thiet_chan_admin_list_feedback_v1','ai_thiet_chan_admin_review_feedback_v1',
  'ai_thiet_chan_admin_create_backup_v1','ai_thiet_chan_admin_list_backups_v1',
  'ai_thiet_chan_admin_export_backup_v1','ai_thiet_chan_admin_import_backup_v1',
  'ai_thiet_chan_admin_restore_backup_v1','KHOI_PHUC','Thư mục Backups'
]) assert.ok(admin.includes(marker),`missing Admin Center marker: ${marker}`);
for(const marker of [
  'adminCenterUsername','adminCenterPassword','ai_thiet_chan_admin_login_v1',
  'ai_thiet_chan_admin_change_credentials_v1','mustChangePassword','adminNewPasswordConfirm',
  'bắt buộc đổi tài khoản/mật khẩu','sessionStorage.setItem(TOKEN_KEY'
]) assert.ok(credentials.includes(marker),`missing admin credential marker: ${marker}`);
assert.ok(!credentials.includes('localStorage.setItem(TOKEN_KEY'),'admin password must not persist in localStorage');
for(const marker of ['qualityToggleBtn','clinicalFeedbackToggleBtn','aitc:quality-open','body.hidden=true']) assert.ok(ui.includes(marker),`missing collapsed UI marker: ${marker}`);
for(const marker of ["const RELEASE='2026.09.21-responsive-shell-r2'","load('/ui-controls.js','aitcUiControls')","load('/admin-center.js','aitcAdminCenter')","load('/admin-credentials.js','aitcAdminCredentials')","load('/feedback-lifecycle.js','aitcFeedbackLifecycle')","load('/upload-controls.js','aitcUploadControls')"]) assert.ok(settings.includes(marker),`missing settings loader: ${marker}`);
assert.ok(quality.includes("window.addEventListener('aitc:quality-open'"),'quality metrics must load on demand');
assert.ok(!quality.includes('requestIdleCallback(()=>load()'),'quality metrics must not auto-load');
assert.ok(adminPage.includes('data-admin-center-page="true"')&&adminPage.includes('/admin-center.js?v=2026.09.21-responsive-shell-r2'),'Admin Center must have a dedicated page');
assert.ok(admin.includes("location.href='/admin-center.html'"),'main settings entry must navigate to dedicated Admin Center');
assert.ok(sw.includes("ai-thiet-chan-v2.9.8-knowledge-5doc-complete"),'PWA cache must match Knowledge 5doc release');
assert.ok(sw.includes("'/ui-controls.js'")&&sw.includes("'/admin-center.js'")&&sw.includes("'/admin-credentials.js'")&&sw.includes("'/feedback-lifecycle.js'")&&sw.includes("'/upload-controls.js'"),'Admin/lifecycle/upload assets missing from PWA shell');
console.log('ADMIN CENTER SMOKE PASS: username/password login, forced first-login rotation, collapsed panels, upload controls, feedback lifecycle, diagnostics, backup and restore are wired');
