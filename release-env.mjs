const releaseIdentity=String(process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||'').trim();
if(!process.env.RENDER_GIT_COMMIT&&releaseIdentity){
  process.env.RENDER_GIT_COMMIT=releaseIdentity;
}
