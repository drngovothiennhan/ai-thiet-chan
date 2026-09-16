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
assert.match(sw,/AITC_ACTIVATE_UPDATE/);

const installBody=sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'"));
assert.doesNotMatch(installBody,/self\.skipWaiting\s*\(/,'new workers must not force takeover while a case can be active');
assert.doesNotMatch(home,/controllerchange[^]*location\.reload\s*\(/,'controller changes must not force a mid-case page reload');
assert.match(home,/AITCPWAUpdate/);
assert.match(home,/updateReady/);
assert.match(home,/AITC_ACTIVATE_UPDATE/);

assert.ok(releaseId.startsWith('2026.09.17-'));
console.log(`PWA COHERENCE SMOKE PASS: ${releaseId} uses one browser/SW release id, required/optional cache gates, and no forced reload or takeover.`);
