import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';

const FORWARDED_ENV_KEYS=Object.freeze([
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_TEXT_FALLBACK_MODEL',
  'GEMINI_TEXT_TIMEOUT_MS',
  'GEMINI_TOTAL_BUDGET_MS',
  'GEMINI_RETRY_BASE_MS',
  'GEMINI_RETRY_MAX_MS',
  'GEMINI_CIRCUIT_429_MS',
  'GEMINI_CIRCUIT_503_MS',
  'AI_GATEWAY_API_KEY',
  'AI_GATEWAY_ENABLED',
  'AI_GATEWAY_PRIMARY_MODEL',
  'AITC_AI_GATEWAY_PRIMARY_MODEL',
  'AI_GATEWAY_TIMEOUT_MS',
  'AI_RATE_LIMIT_MAX',
  'AI_RATE_LIMIT_WINDOW_MS',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'AITC_CASE_RETRIEVAL_URL',
  'AITC_CASE_RETRIEVAL_REMOTE_TIMEOUT_MS'
]);

process.env.AITC_RUNTIME='cloudflare';
for(const key of FORWARDED_ENV_KEYS){
  const value=env[key];
  if(value!==undefined&&value!==null&&String(value).length) process.env[key]=String(value);
}

const {app}=await import('../../server.mjs');
const PORT=3000;
app.listen(PORT);
const expressHandler=httpServerHandler({port:PORT});

export default {
  async fetch(request,workerEnv,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      return expressHandler.fetch(request,workerEnv,ctx);
    }
    return workerEnv.ASSETS.fetch(request);
  }
};
