import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=fs.readFileSync('server.mjs','utf8');
const module=fs.readFileSync('access-control.mjs','utf8');
const client=fs.readFileSync('public/access-control.js','utf8');
const admin=fs.readFileSync('public/user-admin.js','utf8');
const settings=fs.readFileSync('public/settings.js','utf8');

assert.match(server,/installAccessControl/);
assert.match(server,/consumeCaseAccess\(req\)/);
assert.match(server,/studentAccess\?\.role==='student'/);
assert.match(server,/guestAnalysesPerDay:5/);
assert.match(module,/ai_thiet_chan_guest_consume_v1/);
assert.match(module,/ai_thiet_chan_student_login_v1/);
assert.match(module,/Khách đã dùng đủ 5 lượt thiệt chẩn hôm nay/);
assert.match(client,/aitcStudentSessionV1/);
assert.match(client,/Không giới hạn tính năng/);
assert.match(client,/Mật khẩu lần đầu là chính MSSV/);
assert.match(admin,/Nạp file Excel/);
assert.match(admin,/STT · Họ tên · Năm sinh · MSSV · Khoa · Lớp/);
assert.match(admin,/duplicatesRemoved/);
assert.match(admin,/1okZqMuLd73sfQVLZxL5XN-t7r1aptXHY/);
assert.match(settings,/access-control\.js/);
assert.match(settings,/user-admin\.js/);
console.log('student access smoke: OK');
