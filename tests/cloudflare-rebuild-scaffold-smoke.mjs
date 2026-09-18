import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync('server.mjs','utf8');
const worker=fs.readFileSync('cloudflare/src/index.mjs','utf8');
const config=fs.readFileSync('wrangler.cloudflare.template.jsonc','utf8');

assert.match(server,/AITC_RUNTIME/);
assert.match(server,/from '#case-retrieval'/);
assert.match(server,/IS_CLOUDFLARE_RUNTIME/);
assert.match(server,/export \{ app, VERSION, AITC_RUNTIME, IS_CLOUDFLARE_RUNTIME \}/);
assert.match(server,/if\(!IS_CLOUDFLARE_RUNTIME\)[\s\S]*express\.static/);
assert.match(server,/if\(!IS_CLOUDFLARE_RUNTIME\)[\s\S]*app\.listen/);
assert.match(server,/IS_CLOUDFLARE_RUNTIME\?null:setInterval/);

assert.match(worker,/cloudflare:workers/);
assert.match(worker,/cloudflare:node/);
assert.match(worker,/httpServerHandler/);
assert.match(worker,/AITC_RUNTIME='cloudflare'/);
assert.match(worker,/url\.pathname\.startsWith\('\/api\/'\)/);
assert.match(worker,/workerEnv\.ASSETS\.fetch\(request\)/);

assert.match(config,/"compatibility_date": "2026-09-18"/);
assert.match(config,/"#case-retrieval": "\.\/cloudflare\/case-retrieval-remote\.mjs"/);
assert.match(config,/"run_worker_first": \["\/api\/\*"\]/);
assert.match(config,/"AITC_CASE_RETRIEVAL_URL": "https:\/\/aitc-case-retrieval-preview\.onrender\.com"/);
assert.doesNotMatch(config,/GEMINI_API_KEY\s*":\s*"[^"]+"/);
assert.doesNotMatch(config,/AI_GATEWAY_API_KEY\s*":\s*"[^"]+"/);

console.log('CLOUDFLARE REBUILD SCAFFOLD PASS');

const remoteRag=fs.readFileSync('cloudflare/case-retrieval-remote.mjs','utf8');
assert.doesNotMatch(remoteRag,/node:sqlite|node:fs|node:path/);
assert.match(remoteRag,/retrieveSimilarCasesRuntime/);
