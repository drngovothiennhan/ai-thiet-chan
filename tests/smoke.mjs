import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const port=3217;
const child=spawn(process.execPath,['--import','./runtime-guard.mjs','server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),GEMINI_API_KEY:''},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForHealth(){for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{cache:'no-store'});if(r.ok)return r.json();}catch{}await sleep(250);}throw new Error('health timeout');}
async function text(p){const r=await fetch(`http://127.0.0.1:${port}${p}`);if(!r.ok)throw new Error(`${p} HTTP ${r.status}`);return r.text();}
async function scanPublic(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await scanPublic(full);else if(/\.(mjs|js|html|css|json|webmanifest|svg)$/i.test(entry.name)){const t=await readFile(full,'utf8');if(/appdeploy/i.test(t))throw new Error(`legacy platform reference: ${path.relative(root,full)}`);}}}
function requireMarkers(source,markers,label){for(const marker of markers)if(!source.includes(marker))throw new Error(`${label} missing: ${marker}`);}

try{
  const health=await waitForHealth();
  if(!health.ok||health.app!=='A.I Thiệt Chẩn')throw new Error('health gate failed');
  if(health.architecture!=='independent-web'||health.legacyPlatform!==false)throw new Error('architecture gate failed');
  if(health.sharedProvider!==true||health.clientSuppliedKeyAccepted!==false)throw new Error('provider boundary failed');
  if(health.caseCollection?.mode!=='automatic'||health.caseCollection?.history!==true||health.caseCollection?.deduplicate!=='sha256-composite')throw new Error('automatic case collection gate failed');
  if(!Array.isArray(health.assessmentModes)||!health.assessmentModes.includes('normal')||!health.assessmentModes.includes('general'))throw new Error('assessment mode gate failed');

  const home=await text('/');
  requireMarkers(home,['A.I THIỆT CHẨN','HIU CLB YHCT','normalModeBtn','generalModeBtn','topCameraBtn','bottomCameraBtn','settingsBtn','qualityTitle','toggleHistoryBtn','startInquiryBtn','Giới hạn sử dụng y tế','lưu tự động vào kho dữ liệu học máy'],'home');

  const appJs=await text('/app.js');
  requireMarkers(appJs,["mode:'normal'","openCamera('top')","openCamera('bottom')",'bottomImage','bottomQc','laplacianVariance','loadHistory'], 'app');
  if(appJs.includes('aiThietChanGeminiKey')||appJs.includes('x-gemini-key'))throw new Error('client Gemini key path must stay absent');

  const consultation=await text('/consultation.js');
  requireMarkers(consultation,['questions=[','Hàn – nhiệt','Đại – tiểu tiện','[THAP_VAN_CONTEXT]',"import('/clinical-learning.js?v=2.9.0')"],'consultation');

  const learning=await text('/clinical-learning.js');
  requireMarkers(learning,['Góp ý ca lâm sàng','ai_thiet_chan_submit_feedback_v1','ai_thiet_chan_admin_review_feedback_v1','ai_thiet_chan_find_learned_cases_v1','Bác sĩ','Y sĩ'],'clinical learning');

  const lifecycle=await text('/feedback-lifecycle.js');
  requireMarkers(lifecycle,['hideSubmittedFeedback','reopenForNewCase','Đã gửi về admin',"url.includes('/api/analyze')",'feedbackSubmitted'],'feedback lifecycle');

  const settings=await text('/settings.js');
  requireMarkers(settings,['beforeinstallprompt','pwaInstallBtn',"const RELEASE='2.9.0'",'/ui-controls.js','/admin-center.js','/admin-credentials.js','/feedback-lifecycle.js','/upload-controls.js'],'settings');

  const uploads=await text('/upload-controls.js');
  requireMarkers(uploads,['topUploadBtn','bottomUploadBtn','Tải ảnh mặt trên','Tải ảnh mặt dưới','input.click()'],'upload controls');

  const ui=await text('/ui-controls.js');
  requireMarkers(ui,['qualityToggleBtn','clinicalFeedbackToggleBtn','aitc:quality-open','body.hidden=true'],'collapsed UI');

  const quality=await text('/quality-dashboard.js');
  requireMarkers(quality,["window.addEventListener('aitc:quality-open'","'/api/cases?limit=100'",'Ca đạt QC tối thiểu'],'quality dashboard');
  if(quality.includes('requestIdleCallback(()=>load()'))throw new Error('quality dashboard must load on demand');

  const admin=await text('/admin-center.js');
  requireMarkers(admin,['Admin Center','ai_thiet_chan_admin_verify_v1','ai_thiet_chan_admin_review_feedback_v1','ai_thiet_chan_admin_restore_backup_v1','KHOI_PHUC'],'admin center');

  const credentials=await text('/admin-credentials.js');
  requireMarkers(credentials,['adminCenterUsername','adminCenterPassword','ai_thiet_chan_admin_login_v1','ai_thiet_chan_admin_change_credentials_v1','mustChangePassword','adminNewPasswordConfirm'],'admin credentials');
  if(credentials.includes('localStorage.setItem(TOKEN_KEY'))throw new Error('admin password must not persist in localStorage');

  const sw=await text('/sw.js');
  requireMarkers(sw,['ai-thiet-chan-v2.9.0',"url.pathname.startsWith('/api/')",'/admin-center.js','/admin-credentials.js','/ui-controls.js','/feedback-lifecycle.js','/upload-controls.js'],'service worker');

  const noKey=await fetch(`http://127.0.0.1:${port}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'normal',topImage:'data:image/jpeg;base64,'+'a'.repeat(200)})});
  if(noKey.status!==428)throw new Error(`expected analyze 428 without shared key, got ${noKey.status}`);

  const manifest=JSON.parse(await text('/manifest.webmanifest'));
  if(manifest.display!=='standalone'||!Array.isArray(manifest.icons)||!manifest.icons.length)throw new Error('PWA manifest gate failed');

  await scanPublic(path.join(root,'public'));
  console.log('SMOKE PASS: A.I Thiet Chan production shell, dual-view AI, approved learning, upload controls, PWA and forced first-login admin credential rotation are wired');
} finally { child.kill('SIGTERM'); }
