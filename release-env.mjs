const vercelCommit=String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim();
if(!process.env.RENDER_GIT_COMMIT&&vercelCommit){
  process.env.RENDER_GIT_COMMIT=vercelCommit;
}
