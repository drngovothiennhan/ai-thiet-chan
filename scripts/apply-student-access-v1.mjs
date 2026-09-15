import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,value){fs.writeFileSync(path,value);}
function replaceOnce(source,needle,replacement,label){
  if(source.includes(replacement))return source;
  const index=source.indexOf(needle);
  if(index<0)throw new Error(`Patch target not found: ${label}`);
  return source.slice(0,index)+replacement+source.slice(index+needle.length);
}

let server=read('server.mjs');
server=replaceOnce(server,
  "import { createHash } from 'node:crypto';",
  "import { createHash } from 'node:crypto';\nimport { installAccessControl } from './access-control.mjs';",
  'server import');
server=server.replace("const VERSION = '2.9.0';","const VERSION = '2.9.1';");
server=replaceOnce(server,
`function requestIdentity(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return (forwarded||req.socket?.remoteAddress||'unknown').slice(0,96);
}
function aiRateLimit(req,res,next){
  const now=Date.now();`,
`function requestIdentity(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return (forwarded||req.socket?.remoteAddress||'unknown').slice(0,96);
}
const { consumeCaseAccess }=installAccessControl(app,{supabaseUrl:CASE_STORE_URL,supabaseKey:CASE_STORE_KEY,requestIdentity});
function aiRateLimit(req,res,next){
  if(req.studentAccess?.role==='student') return next();
  const now=Date.now();`,
  'access install and student bypass');
server=replaceOnce(server,
  "    const bottomBase64=mode==='general'?validateImage(bottomImage,'BOTTOM_IMAGE'):null;\n    const prompt=",
  "    const bottomBase64=mode==='general'?validateImage(bottomImage,'BOTTOM_IMAGE'):null;\n    const accessQuota=await consumeCaseAccess(req);\n    const prompt=",
  'analysis quota consume');
server=replaceOnce(server,
  "    return res.json({ok:true,assessment,analysis:assessment,model:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,collection});",
  "    return res.json({ok:true,assessment,analysis:assessment,model:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,collection,access:accessQuota});",
  'analysis quota response');
server=replaceOnce(server,
  "  aiRateLimit:{windowMs:AI_RATE_LIMIT_WINDOW_MS,max:AI_RATE_LIMIT_MAX},time:new Date().toISOString()",
  "  aiRateLimit:{windowMs:AI_RATE_LIMIT_WINDOW_MS,max:AI_RATE_LIMIT_MAX},access:{guestAnalysesPerDay:5,studentUnlimited:true},time:new Date().toISOString()",
  'health access summary');
write('server.mjs',server);

let settings=read('public/settings.js');
settings=settings.replace("const RELEASE='2.9.0';","const RELEASE='2.9.1';");
settings=replaceOnce(settings,
  "  load('/ui-controls.js','aitcUiControls');\n  load('/admin-center.js','aitcAdminCenter');",
  "  load('/ui-controls.js','aitcUiControls');\n  load('/access-control.js','aitcAccessControl');\n  load('/admin-center.js','aitcAdminCenter');\n  load('/user-admin.js','aitcUserAdmin');",
  'settings loaders');
write('public/settings.js',settings);

const pkg=JSON.parse(read('package.json'));
pkg.version='2.9.1';
if(!pkg.scripts.test.includes('tests/access-control-smoke.mjs')) pkg.scripts.test += ' && node tests/access-control-smoke.mjs';
if(!pkg.scripts.check.includes('node --check access-control.mjs')) pkg.scripts.check = 'node --check access-control.mjs && ' + pkg.scripts.check;
if(!pkg.scripts.check.includes('node --check public/access-control.js')) pkg.scripts.check = pkg.scripts.check.replace('node --check public/app.js','node --check public/app.js && node --check public/access-control.js && node --check public/user-admin.js');
if(!pkg.scripts.check.includes('tests/access-control-smoke.mjs')) pkg.scripts.check += ' && node tests/access-control-smoke.mjs';
write('package.json',JSON.stringify(pkg,null,2)+'\n');

console.log('Applied A.I Thiệt Chẩn student access v1 patch.');
