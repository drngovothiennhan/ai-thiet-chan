import assert from 'node:assert/strict';

const previousVercel=process.env.VERCEL_GIT_COMMIT_SHA;
const previousDeployment=process.env.VERCEL_DEPLOYMENT_ID;
const previousRender=process.env.RENDER_GIT_COMMIT;
try{
  delete process.env.RENDER_GIT_COMMIT;
  process.env.VERCEL_GIT_COMMIT_SHA='0123456789abcdef0123456789abcdef01234567';
  process.env.VERCEL_DEPLOYMENT_ID='dpl_should_not_win';
  await import(`../release-env.mjs?sha=${Date.now()}`);
  assert.equal(process.env.RENDER_GIT_COMMIT,'0123456789abcdef0123456789abcdef01234567');

  delete process.env.RENDER_GIT_COMMIT;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_DEPLOYMENT_ID='dpl_release_identity_fallback';
  await import(`../release-env.mjs?deployment=${Date.now()}`);
  assert.equal(process.env.RENDER_GIT_COMMIT,'dpl_release_identity_fallback');
}finally{
  if(previousVercel===undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA=previousVercel;
  if(previousDeployment===undefined) delete process.env.VERCEL_DEPLOYMENT_ID; else process.env.VERCEL_DEPLOYMENT_ID=previousDeployment;
  if(previousRender===undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT=previousRender;
}

console.log('RELEASE IDENTITY SMOKE PASS: health build identity prefers Vercel Git SHA and falls back to deployment ID.');
