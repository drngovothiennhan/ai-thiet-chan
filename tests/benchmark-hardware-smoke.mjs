import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const telemetry=await readFile(new URL('../public/benchmark-telemetry.js',import.meta.url),'utf8');
assert.match(telemetry,/hardwareTelemetry/);
assert.match(telemetry,/hardwareTier/);
assert.match(telemetry,/hardwareCores/);
assert.match(telemetry,/hardwareMemory/);
assert.match(telemetry,/connectionClass/);
assert.match(telemetry,/enhancementProfile/);
assert.match(telemetry,/enhancementOutputPixels/);
assert.match(telemetry,/enhancementElapsedMs/);
assert.match(telemetry,/__aitcLastEnhancementMeta/);
assert.match(telemetry,/deviceRuntimeState/);
assert.match(telemetry,/deviceComputeElapsedMs/);
assert.match(telemetry,/__aitcLastDeviceCompute/);
assert.match(telemetry,/localVisionMs:deviceMs\|\|Number\(timing\.localVisionMs\)\|\|null/);
assert.doesNotMatch(telemetry,/serialNumber|deviceId|advertisingId/i);
console.log('BENCHMARK HARDWARE SMOKE PASS: adaptive processing telemetry is coarse and non-identifying.');
