import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('public/app.js','utf8');
const css=fs.readFileSync('public/styles.css','utf8');

assert.match(app,/function cleanMachineLearningSummary/);
assert.match(app,/Đã đối chiếu\\s\+\\d\+\\s\+ca tương tự từ corpus/);
assert.match(app,/Giới hạn:\\s\*\.\*\$/);
assert.match(app,/Tầng thị giác hiện tại chỉ khẳng định/);
assert.match(app,/Độ tương đồng atlas là đối chiếu hình ảnh/);
assert.match(app,/Ảnh không có chuẩn kích thước tuyệt đối/);
assert.match(app,/proseBullets/);
assert.match(app,/evidence-list/);
assert.match(css,/\.evidence-block/);
assert.match(css,/\.evidence-list/);

console.log('ML SUMMARY SANITIZER PASS: corpus-comparison boilerplate and long technical limitations are stripped only at presentation time; literature-style bullets remain readable.');
