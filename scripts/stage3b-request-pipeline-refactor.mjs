import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(path,from,to){
  let s=read(path);const first=s.indexOf(from);if(first<0)throw new Error(`${path}: missing replacement anchor: ${from.slice(0,80)}`);if(s.indexOf(from,first+from.length)>=0)throw new Error(`${path}: replacement anchor not unique`);s=s.slice(0,first)+to+s.slice(first+from.length);write(path,s);
}
function replaceOptional(path,from,to){let s=read(path);if(!s.includes(from))return false;s=s.replace(from,to);write(path,s);return true;}
function findFunctionEnd(source,braceStart){
  let depth=0,state='code',quote='',regexClass=false;
  const prevSignificant=i=>{for(let j=i-1;j>=0;j--){if(!/\s/.test(source[j]))return source[j];}return '';};
  for(let i=braceStart;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(state==='line'){if(c==='\n')state='code';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){state='code';i++;}continue;}
    if(state==='string'){if(c==='\\'){i++;continue;}if(c===quote)state='code';continue;}
    if(state==='template'){if(c==='\\'){i++;continue;}if(c==='`')state='code';continue;}
    if(state==='regex'){if(c==='\\'){i++;continue;}if(c==='[')regexClass=true;else if(c===']')regexClass=false;else if(c==='/'&&!regexClass){state='code';while(/[a-z]/i.test(source[i+1]||''))i++;}continue;}
    if(c==='/'&&n==='/'){state='line';i++;continue;}
    if(c==='/'&&n==='*'){state='block';i++;continue;}
    if(c==='\''||c==='"'){state='string';quote=c;continue;}
    if(c==='`'){state='template';continue;}
    if(c==='/'){
      const p=prevSignificant(i);
      if(!p||'([=,:;!&|?{}'.includes(p)){state='regex';regexClass=false;continue;}
    }
    if(c==='{')depth++;
    else if(c==='}'){depth--;if(depth===0)return i;}
  }
  throw new Error('unterminated fetch wrapper');
}
function transformArrow(path,name,priority){
  let s=read(path);const marker='window.fetch=';const at=s.indexOf(marker);if(at<0)throw new Error(`${path}: window.fetch assignment missing`);if(s.indexOf(marker,at+marker.length)>=0)throw new Error(`${path}: multiple window.fetch assignments`);
  const rhs=at+marker.length,arrow=s.indexOf('=>',rhs),brace=s.indexOf('{',arrow);if(arrow<0||brace<0)throw new Error(`${path}: fetch assignment is not arrow function`);
  const close=findFunctionEnd(s,brace);let end=close+1;while(/\s/.test(s[end]||''))end++;if(s[end]!==';')throw new Error(`${path}: expected semicolon after fetch wrapper`);end++;
  const lineStart=s.lastIndexOf('\n',at)+1,indent=s.slice(lineStart,at);const varName='__aitcStage3bFetch';
  const replacement=`const ${varName}=${s.slice(rhs,end)}`+`\n${indent}requestClient.register('${name}',${varName},${priority});`;
  s=s.slice(0,at)+replacement+s.slice(end);write(path,s);
}
function check(...args){execFileSync(process.execPath,args,{stdio:'inherit'});}
function shell(cmd,args=[]){execFileSync(cmd,args,{stdio:'inherit'});}
function bind(path,oldLine,newLine){replaceOnce(path,oldLine,newLine);}

// Shared client must load before any request layer and remain available offline.
replaceOnce('public/index.html','  <script src="/app.js" defer></script>\n  <script src="/image-enhancement.js" defer></script>','  <script src="/app.js" defer></script>\n  <script src="/request-client.js" defer></script>\n  <script src="/image-enhancement.js" defer></script>');
replaceOnce('public/sw.js',"const REQUIRED_SHELL=['/','/release-meta.js','/styles.css','/app.js','/manifest.webmanifest','/icon.svg'];","const REQUIRED_SHELL=['/','/release-meta.js','/styles.css','/app.js','/request-client.js','/manifest.webmanifest','/icon.svg'];");

// Group 1 — access/auth headers.
bind('public/access-control.js',"  const nativeFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const nativeFetch=(input,init)=>requestClient.fetchAfter('access-control',input,init);");
transformArrow('public/access-control.js','access-control',400);
check('--check','public/request-client.js');check('--check','public/access-control.js');check('tests/access-control-smoke.mjs');

// Group 2 — analyze/request interceptors. Preserve exact legacy downstream order.
bind('public/image-enhancement.js',"  const nativeFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const nativeFetch=(input,init)=>requestClient.fetchAfter('image-enhancement',input,init);");
transformArrow('public/image-enhancement.js','image-enhancement',100);
bind('public/capture-metadata.js',"  const nativeFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const nativeFetch=(input,init)=>requestClient.fetchAfter('capture-metadata',input,init);");
transformArrow('public/capture-metadata.js','capture-metadata',200);
replaceOnce('public/consultation.js',"window.__aitcRawFetch=window.__aitcRawFetch||window.fetch.bind(window);\n",'');
bind('public/consultation.js',"  const nativeFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const nativeFetch=(input,init)=>requestClient.fetchAfter('consultation',input,init);");
transformArrow('public/consultation.js','consultation',300);
bind('public/feedback-lifecycle.js',"  const previousFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const previousFetch=(input,init)=>requestClient.fetchAfter('feedback-lifecycle',input,init);");
transformArrow('public/feedback-lifecycle.js','feedback-lifecycle',500);
replaceOnce('public/clinical-learning.js',"  const previousFetch=window.fetch.bind(window);\n  const rawFetch=window.__aitcRawFetch||previousFetch;","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const previousFetch=(input,init)=>requestClient.fetchAfter('clinical-learning',input,init);\n  const rawFetch=(input,init)=>requestClient.fetchAfter('consultation',input,init);");
transformArrow('public/clinical-learning.js','clinical-learning',600);
bind('public/session-persistence.js',"  const rawFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const rawFetch=(input,init)=>requestClient.fetchAfter('session-persistence',input,init);");
transformArrow('public/session-persistence.js','session-persistence',700);
replaceOnce('tests/clinical-learning-smoke.mjs',"assert.ok(consultation.includes(\"window.__aitcRawFetch=window.__aitcRawFetch||window.fetch.bind(window);\"),'missing raw fetch bootstrap');","assert.ok(consultation.includes(\"requestClient.fetchAfter('consultation'\"),'consultation must use the shared request client');");
for(const f of ['public/image-enhancement.js','public/capture-metadata.js','public/consultation.js','public/feedback-lifecycle.js','public/clinical-learning.js','public/session-persistence.js'])check('--check',f);
check('tests/image-enhancement-smoke.mjs');check('tests/clinical-learning-smoke.mjs');

// Group 3 — local vision fallback and supplied-knowledge fallback.
bind('public/analysis-hotfix.js',"const priorFetch=window.fetch.bind(window);","const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\nconst priorFetch=(input,init)=>requestClient.fetchAfter('analysis-hotfix',input,init);");
transformArrow('public/analysis-hotfix.js','analysis-hotfix',800);
bind('public/book-fallback.js',"const priorFetch=window.fetch.bind(window);","const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\nconst priorFetch=(input,init)=>requestClient.fetchAfter('book-fallback',input,init);");
transformArrow('public/book-fallback.js','book-fallback',900);
check('--check','public/analysis-hotfix.js');check('--check','public/book-fallback.js');check('tests/analysis-hotfix-smoke.mjs');check('tests/book-fallback-smoke.mjs');

// Group 4 — benchmark telemetry.
bind('public/benchmark-telemetry.js',"const priorFetch=window.fetch.bind(window);","const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\nconst priorFetch=(input,init)=>requestClient.fetchAfter('benchmark-telemetry',input,init);");
transformArrow('public/benchmark-telemetry.js','benchmark-telemetry',1000);
check('--check','public/benchmark-telemetry.js');check('tests/benchmark-hardware-smoke.mjs');

// Group 5 — final policy guard + request integrity ingress/seal.
bind('public/consultation-lock.js',"  const priorFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const priorFetch=(input,init)=>requestClient.fetchAfter('consultation-lock',input,init);");
transformArrow('public/consultation-lock.js','consultation-lock',1100);
bind('public/request-integrity.js',"  const priorFetch=window.fetch.bind(window);","  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');\n  const priorFetch=(input,init)=>requestClient.fetchAfter('request-integrity',input,init);");
replaceOnce('public/request-integrity.js',"  window.fetch=guardedFetch;\n  try{\n    const descriptor=Object.getOwnPropertyDescriptor(window,'fetch');\n    if(!descriptor||descriptor.configurable!==false){Object.defineProperty(window,'fetch',{value:guardedFetch,writable:false,configurable:false,enumerable:true});state.sealed=true;}\n  }catch{state.sealed=false;}","  requestClient.register('request-integrity',guardedFetch,1200);\n  state.sealed=requestClient.seal();");
check('--check','public/consultation-lock.js');check('--check','public/request-integrity.js');

const integrityTest=`import assert from 'node:assert/strict';\nimport vm from 'node:vm';\nimport {readFile} from 'node:fs/promises';\n\nconst read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');\nconst [client,integrity,settings,releaseUi,index]=await Promise.all([read('public/request-client.js'),read('public/request-integrity.js'),read('public/settings.js'),read('public/release-ui.js'),read('public/index.html')]);\nassert.match(client,/request-client-v1/);\nassert.match(index,/\\/request-client\\.js/);\nassert.match(settings,/window\\.__aitcSettingsModulesReady=\\(async\\(\\)=>/);\nconst readyAt=releaseUi.indexOf('await window.__aitcSettingsModulesReady');\nconst hotfixAt=releaseUi.indexOf(\"await loadScript('/analysis-hotfix.js')\");\nconst benchmarkAt=releaseUi.indexOf(\"await loadScript('/benchmark-telemetry.js')\");\nconst consultationLockAt=releaseUi.indexOf(\"await loadScript('/consultation-lock.js')\");\nconst guardAt=releaseUi.indexOf(\"await loadScript('/request-integrity.js')\");\nassert.ok(readyAt>=0&&hotfixAt>readyAt&&benchmarkAt>hotfixAt&&consultationLockAt>benchmarkAt&&guardAt>consultationLockAt,'request-integrity must remain the final loaded ingress guard');\nassert.match(integrity,/request-integrity-v1/);assert.match(integrity,/x-aitc-request-id/);assert.match(integrity,/unhandledrejection/);assert.match(integrity,/MAX_FAULTS_PER_MINUTE=8/);assert.match(integrity,/requestClient\\.register\\('request-integrity',guardedFetch,1200\\)/);assert.match(integrity,/requestClient\\.seal\\(\\)/);\nassert.doesNotMatch(integrity,/event\\?\\.message|error\\?\\.message|reason\\?\\.message/);\nlet lastCall=null;const listeners={};const fakeWindow={fetch:async(input,init)=>{lastCall={input,init};return new Response('{}',{status:200,headers:{'content-type':'application/json'}});},addEventListener:(name,fn)=>{listeners[name]=fn;},dispatchEvent:()=>true,AITCHardwareProfile:{profile:{tier:'constrained'}}};\nconst context={window:fakeWindow,location:{href:'https://example.test/',origin:'https://example.test'},performance:{now:()=>100},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},URL,Headers,Request,Response,CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}},Map,Date,Math,Object,String,Boolean,Number,Promise,setTimeout,clearTimeout};\nvm.runInNewContext(client,context,{filename:'request-client.js'});vm.runInNewContext(integrity,context,{filename:'request-integrity.js'});\nassert.ok(fakeWindow.AITCRequestIntegrity);assert.deepEqual([...fakeWindow.AITCRequestClient.snapshot().layers],['request-integrity']);const descriptor=Object.getOwnPropertyDescriptor(fakeWindow,'fetch');assert.equal(descriptor.writable,false);assert.equal(descriptor.configurable,false);\nawait fakeWindow.fetch('/api/health',{cache:'no-store'});assert.ok(lastCall?.init?.headers instanceof Headers);assert.equal(lastCall.init.headers.get('x-aitc-request-id'),'00000000-0000-4000-8000-000000000001');assert.equal(fakeWindow.AITCRequestIntegrity.snapshot().active,0);assert.equal(fakeWindow.AITCRequestIntegrity.snapshot().total,1);await fakeWindow.AITCRequestClient.rawFetch('https://cdn.example.test/file.js',{});\nconsole.log('REQUEST INTEGRITY SMOKE PASS: shared request client preserves final ingress seal, request IDs and bounded fault telemetry.');\n`;
write('tests/request-integrity-smoke.mjs',integrityTest);

const pipelineTest=`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport vm from 'node:vm';\nconst publicFiles=fs.readdirSync('public').filter(f=>f.endsWith('.js'));const offenders=[];for(const file of publicFiles){if(file==='request-client.js')continue;const src=fs.readFileSync('public/'+file,'utf8');if(/window\\.fetch\\s*=/.test(src))offenders.push(file);}\nassert.deepEqual(offenders,[],'only request-client.js may assign window.fetch');\nconst allPublic=publicFiles.map(f=>fs.readFileSync('public/'+f,'utf8')).join('\\n');assert.doesNotMatch(allPublic,/__aitcRawFetch/,'legacy raw-fetch global must be removed');\nconst access=fs.readFileSync('public/access-control.js','utf8'),analysis=fs.readFileSync('public/analysis-hotfix.js','utf8'),book=fs.readFileSync('public/book-fallback.js','utf8'),telemetry=fs.readFileSync('public/benchmark-telemetry.js','utf8'),integrity=fs.readFileSync('public/request-integrity.js','utf8');\nassert.match(access,/authorization/);assert.match(access,/x-aitc-admin-token/);assert.match(access,/requestClient\\.register\\('access-control'/);assert.match(analysis,/\\/api\\/analyze/);assert.match(analysis,/localVision/);assert.match(book,/bookGroundedFallback/);assert.match(telemetry,/analysis_render/);assert.match(integrity,/requestClient\\.seal\\(\\)/);\nconst client=fs.readFileSync('public/request-client.js','utf8');let raw=0;const order=[];const fakeWindow={fetch:async()=>{raw++;return new Response('{}',{status:200});}};vm.runInNewContext(client,{window:fakeWindow,Response,Map,Object,String,Number,TypeError,Error},{filename:'request-client.js'});const rc=fakeWindow.AITCRequestClient;const layers=[['image-enhancement',100],['capture-metadata',200],['consultation',300],['access-control',400],['feedback-lifecycle',500],['clinical-learning',600],['session-persistence',700],['analysis-hotfix',800],['book-fallback',900],['benchmark-telemetry',1000],['consultation-lock',1100],['request-integrity',1200]];for(const [name,priority] of layers)rc.register(name,async(input,init)=>{order.push(name);return rc.fetchAfter(name,input,init);},priority);await fakeWindow.fetch('/api/analyze',{method:'POST'});assert.equal(raw,1,'one pipeline call must produce exactly one downstream request');assert.deepEqual(order,layers.slice().reverse().map(x=>x[0]));assert.deepEqual([...rc.snapshot().layers],layers.slice().reverse().map(x=>x[0]));\nconsole.log('REQUEST PIPELINE CLEANUP PASS: one deterministic chain, preserved layer order, no wrapper race and no double request.');\n`;
write('tests/request-pipeline-cleanup-smoke.mjs',pipelineTest);

// Wire the new client and regression gate into the normal CI without removing existing tests.
const pkg=JSON.parse(read('package.json'));
if(!pkg.scripts.test.includes('request-pipeline-cleanup-smoke.mjs'))pkg.scripts.test=pkg.scripts.test.replace('node tests/request-integrity-smoke.mjs','node tests/request-pipeline-cleanup-smoke.mjs && node tests/request-integrity-smoke.mjs');
if(!pkg.scripts.check.includes('node --check public/request-client.js'))pkg.scripts.check=pkg.scripts.check.replace('node --check public/app.js','node --check public/app.js && node --check public/request-client.js');
if(!pkg.scripts.check.includes('request-pipeline-cleanup-smoke.mjs'))pkg.scripts.check=pkg.scripts.check.replace('node tests/request-integrity-smoke.mjs','node tests/request-pipeline-cleanup-smoke.mjs && node tests/request-integrity-smoke.mjs');
write('package.json',JSON.stringify(pkg,null,2)+'\n');

check('tests/request-pipeline-cleanup-smoke.mjs');check('tests/request-integrity-smoke.mjs');check('tests/gemini-resilience-smoke.mjs');

// Hard gate: no legacy fetch assignment remains outside the one shared client.
const remaining=shell('bash',['-lc',"set -e; hits=$(grep -RInE 'window\\.fetch[[:space:]]*=' public --include='*.js' | grep -v '^public/request-client.js:' || true); if [ -n \"$hits\" ]; then echo \"$hits\"; exit 1; fi; if grep -RInF '__aitcRawFetch' public --include='*.js'; then exit 1; fi"]);

// Full existing regression suite is mandatory before committing the transformed branch.
shell('npm',['run','check']);
console.log('STAGE3B_TRANSFORM_AND_CHECK_PASS');
