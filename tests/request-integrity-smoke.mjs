import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [integrity,settings,releaseUi]=await Promise.all([
  read('public/request-integrity.js'),read('public/settings.js'),read('public/release-ui.js')
]);

assert.match(settings,/window\.__aitcSettingsModulesReady=\(async\(\)=>/);
const settingsAccess=settings.indexOf("await load('/access-control.js'");
const settingsAdmin=settings.indexOf("await load('/admin-center.js'");
assert.ok(settingsAccess>=0&&settingsAdmin>settingsAccess,'settings runtime modules must load serially with access-control before admin modules');

const readyAt=releaseUi.indexOf('await window.__aitcSettingsModulesReady');
const clinicalAt=releaseUi.indexOf("await import('/clinical-learning.js?v=2.9.0')");
const hotfixAt=releaseUi.indexOf("await loadScript('/analysis-hotfix.js')");
const benchmarkAt=releaseUi.indexOf("await loadScript('/benchmark-telemetry.js')");
const consultationLockAt=releaseUi.indexOf("await loadScript('/consultation-lock.js')");
const guardAt=releaseUi.indexOf("await loadScript('/request-integrity.js')");
assert.ok(readyAt>=0&&clinicalAt>readyAt&&hotfixAt>clinicalAt&&benchmarkAt>hotfixAt&&consultationLockAt>benchmarkAt&&guardAt>consultationLockAt,'critical request wrappers must bootstrap in a deterministic order and request-integrity must be last');

assert.match(integrity,/request-integrity-v1/);
assert.match(integrity,/x-aitc-request-id/);
assert.match(integrity,/unhandledrejection/);
assert.match(integrity,/addEventListener\('error'/);
assert.match(integrity,/MAX_FAULTS_PER_MINUTE=8/);
assert.match(integrity,/event:'client_error'/);
assert.match(integrity,/configurable:false/);
assert.doesNotMatch(integrity,/event\?\.message|error\?\.message|reason\?\.message/,'client telemetry must not persist raw exception messages');

let lastCall=null;
const listeners={};
const fakeWindow={
  fetch:async(input,init)=>{lastCall={input,init};return new Response('{}',{status:200,headers:{'content-type':'application/json'}});},
  addEventListener:(name,fn)=>{listeners[name]=fn;},
  dispatchEvent:()=>true,
  AITCHardwareProfile:{profile:{tier:'constrained'}}
};
const context={
  window:fakeWindow,
  location:{href:'https://example.test/',origin:'https://example.test'},
  performance:{now:()=>100},
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  URL,Headers,Request,Response,
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  Map,Date,Math,Object,String,Boolean,Number,Promise,setTimeout,clearTimeout
};
vm.runInNewContext(integrity,context,{filename:'request-integrity.js'});
assert.ok(fakeWindow.AITCRequestIntegrity,'request integrity API must be exposed');
const descriptor=Object.getOwnPropertyDescriptor(fakeWindow,'fetch');
assert.equal(descriptor.writable,false);
assert.equal(descriptor.configurable,false);
await fakeWindow.fetch('/api/health',{cache:'no-store'});
assert.ok(lastCall?.init?.headers instanceof Headers);
assert.equal(lastCall.init.headers.get('x-aitc-request-id'),'00000000-0000-4000-8000-000000000001');
assert.equal(fakeWindow.AITCRequestIntegrity.snapshot().active,0);
assert.equal(fakeWindow.AITCRequestIntegrity.snapshot().total,1);

await fakeWindow.fetch('https://cdn.example.test/file.js',{});
assert.equal(lastCall.init?.headers?.get?.('x-aitc-request-id')||null,null,'cross-origin calls must not receive the app request id header');

console.log('REQUEST INTEGRITY SMOKE PASS: deterministic boot order, final fetch seal, request IDs and privacy-bounded client fault telemetry are wired.');
