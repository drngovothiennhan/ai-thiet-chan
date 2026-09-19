import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [home,sw,releaseMeta]=await Promise.all([
  read('public/index.html'),read('public/sw.js'),read('public/release-meta.js')
]);

const releaseMatch=releaseMeta.match(/RELEASE_ID='([^']+)'/);
assert.ok(releaseMatch?.[1],'release-meta must define one release id');
const releaseId=releaseMatch[1];
assert.ok(sw.includes("importScripts('/release-meta.js')"),'service worker must consume the same release metadata');
assert.ok(sw.includes('self.AITC_RELEASE_ID'),'service worker must derive cache generation from release metadata');
assert.ok(home.includes('<script src="/release-meta.js" defer></script>'),'browser shell must load the same release metadata');

assert.doesNotMatch(sw,/cache\.addAll\(/,'one failed optional asset must not abort the whole service-worker install');
assert.match(sw,/cacheRequired/);
assert.match(sw,/Promise\.allSettled\(OPTIONAL_SHELL/);
assert.match(sw,/\/hardware-profile\.js/);
assert.match(sw,/\/request-integrity\.js/);
assert.match(sw,/const REQUIRED_SHELL=\[[^\]]*\/access-control\.js/);
assert.match(sw,/const REQUIRED_SHELL=\[[^\]]*\/consultation-lock\.js/);
assert.match(sw,/const REQUIRED_SHELL=\[[^\]]*\/request-integrity\.js/);
const analyzeFetch=sw.slice(sw.indexOf("if(request.method==='POST'&&url.pathname==='/api/analyze')"),sw.indexOf("if(request.method!=='GET')"));
assert.doesNotMatch(analyzeFetch,/status:403|response\.status!==429/,'service worker must preserve server auth/quota status codes');
assert.match(sw,/AITC_ACTIVATE_UPDATE/);

const installBody=sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'"));
assert.match(installBody,/self\.skipWaiting\s*\(/,'new workers must take over only after the complete shell is cached so stale payload contracts cannot persist');
assert.doesNotMatch(home,/controllerchange[^]*location\.reload\s*\(/,'controller changes must not force a mid-case page reload');
assert.match(home,/AITCPWAUpdate/);
assert.match(home,/updateReady/);
assert.match(home,/AITC_ACTIVATE_UPDATE/);
assert.ok(home.includes('/release-ui.js?v=2026.09.19-taskbar-r2'),'taskbar JS must use a versioned URL to bypass an older controlling worker cache');
assert.ok(home.includes('/release-ui.css?v=2026.09.19-taskbar-r2'),'taskbar CSS must use a versioned URL to bypass an older controlling worker cache');
assert.match(sw,/\['\/release-meta\.js','\/release-ui\.js','\/release-ui\.css'\]\.includes\(url\.pathname\)/,'release taskbar assets must be network-first in the service worker');

assert.equal(releaseId,'2026.09.20-stasis-ventral-topography-r1');
assert.ok(home.includes('/consultation.js?v=2026.09.20-consult-dedup-yhct-r1'),'consultation hotfix must use a versioned URL so old PWA caches cannot keep the duplicate-question client');
assert.match(sw,/hasCompleteDevicePayload\(body\)[^]*digestBase64Payload\(image\)/,'service worker must verify the actual image digest before trusting a complete device payload');
console.log(`PWA COHERENCE SMOKE PASS: ${releaseId} uses one browser/SW release id, atomic cache-before-takeover, and digest self-healing without forced page reload.`);
