import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/device-validation.html',import.meta.url),'utf8');

assert.match(html,/aitc-real-device-validation-v1/);
assert.match(html,/Không mô phỏng thiết bị/);
assert.match(html,/No synthetic data\. No tier override/);
assert.match(html,/navigator\.mediaDevices\.getUserMedia/);
assert.match(html,/tracks\.forEach\(t=>t\.stop\(\)\)/);
assert.match(html,/tracks\.every\(t=>t\.readyState==='ended'\)/);
assert.match(html,/manualLedRequired:true/);
assert.match(html,/AITCAcademicVision\?\.signatureFromDataUrl/);
assert.match(html,/AITCDeviceRuntime\.analyzeViews/);
assert.match(html,/stable\(direct\)===stable\(worker\)/);
assert.match(html,/expected-fallback/);
assert.match(html,/local-worker-vision-unavailable/);
assert.match(html,/navigator\.serviceWorker\.getRegistration/);
assert.match(html,/AITC_RELEASE_STATUS/);
assert.match(html,/controllerChangesDuringObservation/);
assert.match(html,/reloadRecovery/);
assert.match(html,/performance\?\.memory/);
assert.match(html,/manual\.thermal/);
assert.doesNotMatch(html,/tierOverride|simulateTier|mockTier/i,'real-device harness must not simulate hardware tiers');
assert.doesNotMatch(html,/fetch\([^)]*supabase|benchmark_record/i,'validation evidence must not silently pollute benchmark telemetry');

console.log('REAL DEVICE VALIDATION HARNESS PASS: physical-device evidence is collected without simulated tiers or fabricated PASS states.');
