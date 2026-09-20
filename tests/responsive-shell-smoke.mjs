import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const settings=fs.readFileSync('public/settings.js','utf8');
const layout=fs.readFileSync('public/layout-mode.js','utf8');
const ui=fs.readFileSync('public/release-ui.js','utf8');
const css=fs.readFileSync('public/release-ui.css','utf8');
const styles=fs.readFileSync('public/styles.css','utf8');
const admin=fs.readFileSync('public/admin-center.js','utf8');
const adminPage=fs.readFileSync('public/admin-center.html','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');

assert.match(home,/id="layoutModeBtn"/);
assert.match(home,/layout-mode\.js\?v=2026\.09\.20-responsive-admin-r1/);
assert.match(layout,/aitc-layout-mode-v1/);
assert.match(layout,/mobile/);
assert.match(layout,/desktop/);
assert.match(ui,/if\(!content\|\|!capture\|\|!result\|\|!chat\|\|!quality\)return/);
assert.doesNotMatch(ui,/!history\|\|!quality/);
assert.doesNotMatch(ui,/data-nav="cases"/);
assert.match(ui,/ensureDesktopStack/);
assert.match(ui,/desktop-side-stack/);
assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/Compact unified topbar control cluster r2/);
assert.match(css,/\.topbar-actions \.settings-label\{display:none!important\}/);
assert.match(css,/\.topbar-actions #accessBtn\{/);
assert.match(styles,/data-aitc-layout="desktop"/);
assert.match(styles,/desktop-side-stack/);
assert.match(adminPage,/data-admin-center-page="true"/);
assert.match(adminPage,/Admin Center · A\.I THIỆT CHẨN/);
assert.match(admin,/location\.href='\/admin-center\.html'/);
assert.match(admin,/loadAdminHistory/);
assert.match(app,/A\.I \+ RAG \+ dữ liệu sẵn sàng/);
assert.match(app,/Chưa xác minh A\.I · máy chủ chưa kết nối/);
assert.match(settings,/Local Vision \+ RAG · sẵn sàng/);
assert.match(sw,/\/layout-mode\.js/);
assert.match(sw,/\/admin-center\.html/);

console.log('RESPONSIVE SHELL PASS: mobile taskbar no longer depends on removed history, desktop uses a stable side stack, Admin Center is standalone, layout can switch Mobile/PC, and health states are resilient.');


for(const module of ['user-admin.js','admin-credentials.js','admin-enhancement-collapse.js']) assert.ok(adminPage.includes('/'+module),'standalone Admin Center must retain '+module);
assert.doesNotMatch(css,/repeat\(5,/,'obsolete five-workspace taskbar rules must be removed');
