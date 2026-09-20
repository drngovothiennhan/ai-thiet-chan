import fs from 'node:fs';
import assert from 'node:assert/strict';
import {installAccessControl} from '../access-control.mjs';

const server=fs.readFileSync('server.mjs','utf8');
const module=fs.readFileSync('access-control.mjs','utf8');
const client=fs.readFileSync('public/access-control.js','utf8');
const admin=fs.readFileSync('public/user-admin.js','utf8');
const adminCredentials=fs.readFileSync('public/admin-credentials.js','utf8');
const settings=fs.readFileSync('public/settings.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

assert.equal(pkg.version,'2.9.2');
const release=fs.readFileSync('public/release-meta.js','utf8').match(/RELEASE_ID='([^']+)'/)[1];
assert.equal(settings.match(/const RELEASE='([^']+)'/)[1],release,'settings loader must match the active shell release');
assert.match(server,/installAccessControl/);
assert.match(server,/consumeCaseAccess\(req\)/);
assert.match(server,/studentAccess\?\.role==='student'/);
assert.match(server,/guestAnalysesPerDay:5/);
assert.match(module,/ai_thiet_chan_guest_status_v1/);
assert.match(module,/armGuestQuotaCommit/);
assert.match(module,/res\.statusCode>=400/);
assert.match(module,/ai_thiet_chan_guest_consume_v1/);
assert.match(module,/ACCESS_COMMIT_UNAVAILABLE/);
assert.match(module,/ai_thiet_chan_student_login_v1/);
assert.match(module,/ai_thiet_chan_admin_verify_v1/);
assert.match(module,/adminAccess\?\.role==='admin'/);
assert.match(module,/adminBridge:true/);
assert.match(module,/Khách đã dùng đủ 5 lượt thiệt chẩn hôm nay/);
assert.match(module,/STUDENT_SESSION_INVALID/);
assert.match(module,/STUDENT_SESSION_UNAVAILABLE/);
assert.match(module,/if\(bearerToken\(req\)\) throw studentSessionError/);
assert.match(client,/aitcStudentSessionV1/);
assert.match(client,/aitcClinicalAdminToken/);
assert.match(client,/x-aitc-admin-token/);
assert.match(client,/role==='admin'/);
assert.match(client,/Không giới hạn tính năng/);
assert.match(client,/Mật khẩu lần đầu là chính MSSV/);
assert.match(client,/requestClient\.register\('access-control',__aitcStage3bFetch,40\)/);
assert.match(client,/AUTH_STATE_DOWNGRADE_BLOCKED/);
assert.doesNotMatch(client,/role==='guest'&&token\(\)\)setToken\(''\)/);
assert.match(adminCredentials,/aitc:access-refresh/);
assert.match(admin,/Nạp file Excel/);
assert.match(admin,/STT · Họ tên · Năm sinh · MSSV · Khoa · Lớp/);
assert.match(admin,/duplicatesRemoved/);
assert.match(admin,/1okZqMuLd73sfQVLZxL5XN-t7r1aptXHY/);
assert.match(settings,/access-control\.js/);
assert.match(settings,/user-admin\.js/);
const originalFetch=globalThis.fetch;
const middlewares=[],gets={},posts={};
const fakeApp={
  use(fn){middlewares.push(fn);},
  get(path,fn){gets[path]=fn;},
  post(path,fn){posts[path]=fn;}
};
let guestStatusCalls=0;
globalThis.fetch=async(url,init={})=>{
  const name=String(url).split('/rpc/')[1]||'';
  const body=JSON.parse(String(init.body||'{}'));
  if(name==='ai_thiet_chan_student_verify_v1'){
    if(body.p_token==='good')return new Response(JSON.stringify({ok:true,role:'student',unlimited:true,student:{mssv:'TEST'}}),{status:200,headers:{'content-type':'application/json'}});
    if(body.p_token==='bad')return new Response(JSON.stringify({message:'invalid_session'}),{status:400,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({message:'backend unavailable'}),{status:503,headers:{'content-type':'application/json'}});
  }
  if(name==='ai_thiet_chan_guest_status_v1'){
    guestStatusCalls+=1;
    return new Response(JSON.stringify({ok:true,role:'guest',limit:5,remaining:0}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(name==='ai_thiet_chan_guest_consume_v1'){
    return new Response(JSON.stringify({ok:true,role:'guest',limit:5,remaining:4}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
};
try{
  const access=installAccessControl(fakeApp,{supabaseUrl:'https://example.test',supabaseKey:'public-key',requestIdentity:()=> '127.0.0.1'});
  const runContext=async token=>{
    const req={path:'/api/analyze',headers:{authorization:`Bearer ${token}`,'user-agent':'smoke',accept:'application/json'}};
    const res={};
    await new Promise((resolve,reject)=>{
      Promise.resolve(middlewares[0](req,res,resolve)).catch(reject);
    });
    return req;
  };

  const studentReq=await runContext('good');
  const studentAccess=await access.consumeCaseAccess(studentReq);
  assert.equal(studentAccess.role,'student');
  assert.equal(studentAccess.unlimited,true);
  assert.equal(guestStatusCalls,0,'verified student requests must never touch guest quota');

  const invalidReq=await runContext('bad');
  await assert.rejects(()=>access.consumeCaseAccess(invalidReq),err=>err?.code==='STUDENT_SESSION_INVALID'&&err?.status===401);
  assert.equal(guestStatusCalls,0,'invalid bearer requests must not downgrade into guest quota');

  const unavailableReq=await runContext('down');
  await assert.rejects(()=>access.consumeCaseAccess(unavailableReq),err=>err?.code==='STUDENT_SESSION_UNAVAILABLE'&&err?.status===503);
  assert.equal(guestStatusCalls,0,'unavailable student verification must fail closed instead of consuming guest quota');
}finally{
  globalThis.fetch=originalFetch;
}

console.log('student/admin access smoke: OK; verified student requests stay unlimited, bearer failures never downgrade to guest, and guest quota is charged only on successful JSON response');

