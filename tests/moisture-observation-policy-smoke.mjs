import assert from 'node:assert/strict';
import fs from 'node:fs';
import {interpretMoistureObservation,MOISTURE_OBSERVATION_POLICY_VERSION} from '../moisture-observation-policy.mjs';

function region(overrides={}){
  return {sampledPixels:1000,glossRatio:.012,strictGlossRatio:.004,largestGlossComponentRatio:.25,distributedGlossRatio:.75,roughness:.035,meanValue:.62,...overrides};
}
function payload(surface,body=surface,coating=surface,qc={}){
  return {
    schemaVersion:'tongue-moisture-features-v1',
    surface,body,coating,
    qc:{roiCoverage:.32,overexposedRatio:.002,underexposedRatio:.003,largestGlossComponentRatio:surface.largestGlossComponentRatio,neutralReferencePixels:200,colorNormalizationApplied:true,...qc},
    method:'local-specular-plus-microtexture-v1',
    calibration:'engineering-candidate-not-clinical-threshold'
  };
}

assert.equal(MOISTURE_OBSERVATION_POLICY_VERSION,'tongue-moisture-policy-v1');

const wetRegion=region({glossRatio:.032,strictGlossRatio:.011,distributedGlossRatio:.82,largestGlossComponentRatio:.18,roughness:.022});
const wet=interpretMoistureObservation(payload(wetRegion),{grade:'good'});
assert.equal(wet.surface.status,'moist');
assert.equal(wet.productionEligible,false);
assert.equal(wet.calibrated,false);

const dryRegion=region({glossRatio:.002,strictGlossRatio:.0005,distributedGlossRatio:.50,largestGlossComponentRatio:.20,roughness:.068});
const dry=interpretMoistureObservation(payload(dryRegion),{grade:'good'});
assert.equal(dry.surface.status,'dry');

const split=interpretMoistureObservation(payload(region(),dryRegion,wetRegion),{grade:'good'});
assert.equal(split.body.status,'dry');
assert.equal(split.coating.status,'moist');
assert.notEqual(split.body.status,split.coating.status);

const flashed=interpretMoistureObservation(payload(
  region({glossRatio:.10,strictGlossRatio:.07,largestGlossComponentRatio:.95,distributedGlossRatio:.05,roughness:.015}),
  undefined,undefined,
  {overexposedRatio:.12,largestGlossComponentRatio:.95}
),{grade:'good'});
assert.equal(flashed.surface.status,'unknown');
assert.ok(flashed.qc.flashRisk>=.62);

const poor=interpretMoistureObservation(payload(wetRegion),{grade:'poor'});
assert.equal(poor.active,false);
assert.equal(poor.surface.status,'unknown');

const academic=fs.readFileSync('public/academic-vision.js','utf8');
const server=fs.readFileSync('academic-server.mjs','utf8');
const engine=fs.readFileSync('local-vision-engine.mjs','utf8');
assert.match(academic,/tongue-moisture-features-v1/);
assert.match(academic,/local-specular-plus-microtexture-v1/);
assert.match(academic,/moistureBody/);
assert.match(academic,/moistureCoating/);
assert.match(server,/tongue-moisture-features-v1/);
assert.match(engine,/interpretMoistureObservation/);
assert.match(engine,/moistureObservation/);
assert.doesNotMatch(engine,/moistureObservation[^\n]{0,200}productionEligible:true/);

console.log('MOISTURE OBSERVATION PASS: gloss + microtexture are QC-gated, body/coating remain separate, flash fails closed, and thresholds are not production calibrated.');
