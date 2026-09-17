import assert from 'node:assert/strict';

const previousVercel=process.env.VERCEL_GIT_COMMIT_SHA;
const previousRender=process.env.RENDER_GIT_COMMIT;
try{
  delete process.env.RENDER_GIT_COMMIT;
  process.env.VERCEL_GIT_COMMIT_SHA='0123456789abcdef0123456789abcdef01234567';
  await import(`../release-env.mjs?smoke=${Date.now()}`);
  assert.equal(process.env.RENDER_GIT_COMMIT,'0123456789abcdef0123456789abcdef01234567');
}finally{
  if(previousVercel===undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA=previousVercel;
  if(previousRender===undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT=previousRender;
}

console.log('RELEASE IDENTITY SMOKE PASS: Vercel Git SHA is mapped into the existing health build field without changing server behavior.');
